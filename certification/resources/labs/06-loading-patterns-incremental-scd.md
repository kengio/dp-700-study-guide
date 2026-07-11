---
title: "Lab 06: Loading Patterns — Incremental & SCD"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - loading-patterns
  - incremental-load
  - watermark
  - scd2
  - delta-merge
status: complete
---

# Lab 06: Loading Patterns — Incremental & SCD

## Overview

This lab builds the two loading patterns Domain 2 tests hardest, entirely in PySpark against `lh_silver`: a watermark-driven incremental load, and a full SCD Type 2 dimension with a simulated change batch, a late-arriving (inferred) member, and a proof that re-running the same cell twice never duplicates a row.

> [!abstract]
>
> - Creates a watermark control table and an idempotent incremental load of `orders` from `lh_bronze` into `lh_silver`
> - Builds `dim_customers` as a full SCD Type 2 dimension from the Lab 01 `customers` table, then applies a simulated change batch with the single-`MERGE` SCD2 pattern
> - Handles a late-arriving fact row referencing a customer that doesn't exist yet in the dimension — the inferred-member pattern
> - Proves idempotency by re-running the incremental load twice and comparing row counts

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) and [Lab 05](./05-batch-ingestion-shortcuts-mirroring.md) completed — `dp700-labs` workspace with `lh_bronze`'s Delta tables and `lh_silver` (with its `customers` shortcut and `orders_incremental` table). This lab is code-first: almost everything runs from one notebook attached to `lh_silver`.
>
> **Estimated time:** 40 minutes

---

## Steps

### Step 1: Attach a notebook to `lh_silver` and create the watermark control table

1. In `dp700-labs`, select **+ New item → Notebook**. Name it `nb-loading-patterns`.
2. Attach `lh_silver` as the default lakehouse via the **Lakehouses** pane.
3. Run the following cell to create a small Delta control table that tracks the last-loaded watermark per source table — the same pattern from [01-Full vs. Incremental Loads § The Watermark Pattern](../../05-loading-patterns/01-full-incremental-loads.md#the-watermark-pattern), kept as a real table instead of a notebook variable so it survives session restarts:

```python
from pyspark.sql import Row
from delta.tables import DeltaTable

spark.sql("""
CREATE TABLE IF NOT EXISTS wm_control (
    source_table STRING,
    last_watermark STRING
) USING DELTA
""")

# Seed a watermark far in the past so the first incremental run pulls everything
if spark.sql("SELECT * FROM wm_control WHERE source_table = 'orders'").count() == 0:
    spark.createDataFrame(
        [Row(source_table="orders", last_watermark="2000-01-01")]
    ).write.format("delta").mode("append").saveAsTable("wm_control")

spark.sql("SELECT * FROM wm_control").show()
```

> [!success] Expected result
> `wm_control` shows one row: `orders | 2000-01-01`. This table — not a pipeline variable, not a notebook global — is the single source of truth for "how far did the last load get."

### Step 2: Incremental load — `orders` from `lh_bronze` into `lh_silver`, watermarked on `order_date`

```python
# Read the current watermark for orders
watermark_row = spark.sql(
    "SELECT last_watermark FROM wm_control WHERE source_table = 'orders'"
).collect()[0]
last_watermark = watermark_row["last_watermark"]

# Extract only rows changed since the watermark, from lh_bronze via cross-lakehouse Spark SQL
df_incremental = spark.sql(f"""
    SELECT order_id, customer_id, order_date, status
    FROM lh_bronze.orders
    WHERE order_date > '{last_watermark}'
""")

incremental_count = df_incremental.count()
print(f"Rows to merge this run: {incremental_count}")

# Merge into lh_silver.orders_incremental (created in Lab 05's Copy job tour, or created fresh here)
if not spark.catalog.tableExists("orders_incremental"):
    df_incremental.write.format("delta").mode("overwrite").saveAsTable("orders_incremental")
else:
    target = DeltaTable.forName(spark, "orders_incremental")
    (
        target.alias("t")
        .merge(df_incremental.alias("s"), "t.order_id = s.order_id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )

# Advance the watermark to the max order_date just processed
new_watermark = df_incremental.agg({"order_date": "max"}).collect()[0][0]
if new_watermark is not None:
    spark.sql(f"""
        UPDATE wm_control
        SET last_watermark = '{new_watermark}'
        WHERE source_table = 'orders'
    """)

spark.sql("SELECT COUNT(*) AS n FROM orders_incremental").show()
spark.sql("SELECT * FROM wm_control").show()
```

> [!success] Expected result
> First run: `Rows to merge this run: 200` (every order, since the watermark started at `2000-01-01`), `orders_incremental` shows `n = 200`, and `wm_control.last_watermark` advances to the latest `order_date` in the synthetic dataset (mid-2026).

> [!note]
> This is Delta `MERGE INTO` doing double duty: `whenMatchedUpdateAll` handles a status change on an existing order (`Pending` → `Completed`), `whenNotMatchedInsertAll` handles a brand-new order — exactly the [T-SQL/PySpark watermark pattern](../../05-loading-patterns/01-full-incremental-loads.md#the-watermark-pattern) side-by-side comparison from the topic file, now running for real.

### Step 3: Build `dim_customers` as a full SCD Type 2 dimension

```python
from pyspark.sql import functions as F

# Initial load: every current customer becomes a "version 1, currently active" row
df_customers = spark.sql("SELECT * FROM lh_bronze.customers")

df_scd2_initial = (
    df_customers
    .withColumn("effective_start", F.lit("2026-01-01").cast("date"))
    .withColumn("effective_end", F.lit(None).cast("date"))
    .withColumn("is_current", F.lit(True))
)

df_scd2_initial.write.format("delta").mode("overwrite").saveAsTable("dim_customers")

spark.sql("SELECT COUNT(*) AS n, SUM(CASE WHEN is_current THEN 1 ELSE 0 END) AS n_current FROM dim_customers").show()
```

> [!success] Expected result
> `n = 50`, `n_current = 50` — every customer lands as a single active version, matching [02-Dimensional Model Loading § SCD Type 2: PySpark Delta MERGE INTO (Single-MERGE Pattern)](../../05-loading-patterns/02-dimensional-model-loading.md#scd-type-2-pyspark-delta-merge-into-single-merge-pattern)'s starting state.

### Step 4: Simulate a change batch and apply the single-`MERGE` SCD2 pattern

```python
# Simulate 5 customers moving region (a real SCD2-worthy change) — customers 1-5 move to "CENTRAL"
df_changes = (
    spark.sql("SELECT * FROM lh_bronze.customers WHERE customer_id BETWEEN 1 AND 5")
    .withColumn("region", F.lit("CENTRAL"))
)

# Build the merge source: for each changed row, produce both a "close out old version" record
# and a "insert new version" record, using a synthetic mergeKey — NULL mergeKey rows can never
# match an existing row, so they always insert as new current versions.
df_staged = df_changes.withColumn("mergeKey", F.col("customer_id"))
df_staged_close = df_staged.withColumn("mergeKey", F.lit(None).cast("int"))  # forces insert-only
df_merge_source = df_staged.unionByName(df_staged_close)

target = DeltaTable.forName(spark, "dim_customers")

(
    target.alias("t")
    .merge(
        df_merge_source.alias("s"),
        "t.customer_id = s.mergeKey AND t.is_current = true"
    )
    .whenMatchedUpdate(
        condition="t.region <> s.region",
        set={
            "is_current": "false",
            "effective_end": "current_date()",
        },
    )
    .whenNotMatchedInsert(
        values={
            "customer_id": "s.customer_id",
            "customer_name": "s.customer_name",
            "region": "s.region",
            "signup_date": "s.signup_date",
            "email": "s.email",
            "ssn": "s.ssn",
            "effective_start": "current_date()",
            "effective_end": "cast(null as date)",
            "is_current": "true",
        }
    )
    .execute()
)

spark.sql("""
    SELECT customer_id, region, is_current, effective_start, effective_end
    FROM dim_customers WHERE customer_id BETWEEN 1 AND 5
    ORDER BY customer_id, effective_start
""").show()
```

> [!success] Expected result
> Customers 1–5 each show **two** rows: the original (`is_current = false`, `effective_end = today`) and the new `CENTRAL` version (`is_current = true`, `effective_end = NULL`). `dim_customers` now has 55 total rows — 50 customers, with 5 of them carrying full history.

> [!warning] Common Mistake
> The single-`MERGE` pattern only works because the `NULL mergeKey` rows in `df_staged_close` can never satisfy `t.customer_id = s.mergeKey` — that's what forces them down the `whenNotMatchedInsert` path even though their `customer_id` is a duplicate of an existing (now-historical) row. Forgetting to null out the merge key on the "insert" half of the union collapses this into a single-row update instead of proper SCD2 history — see [02-Dimensional Model Loading](../../05-loading-patterns/02-dimensional-model-loading.md#scd-type-2-pyspark-delta-merge-into-single-merge-pattern) for the full mechanics.

### Step 5: Late-arriving dimension — an inferred member

```python
# Simulate a fact row referencing customer_id 51, which doesn't exist in dim_customers yet
df_late_fact = spark.createDataFrame(
    [(9999, 51, "2026-07-05", "Completed")],
    ["order_id", "customer_id", "order_date", "status"],
)

known_ids = {r.customer_id for r in spark.sql("SELECT DISTINCT customer_id FROM dim_customers").collect()}
missing_ids = [r.customer_id for r in df_late_fact.select("customer_id").distinct().collect() if r.customer_id not in known_ids]

if missing_ids:
    df_inferred = spark.createDataFrame(
        [(cid, f"Unknown (inferred {cid})", "UNKNOWN", None, None, None,
          "2026-01-01", None, True) for cid in missing_ids],
        ["customer_id", "customer_name", "region", "signup_date", "email", "ssn",
         "effective_start", "effective_end", "is_current"],
    )
    df_inferred.write.format("delta").mode("append").saveAsTable("dim_customers")

spark.sql("SELECT * FROM dim_customers WHERE customer_id = 51").show()
```

> [!success] Expected result
> A single inferred-member row appears for `customer_id = 51`: `customer_name = 'Unknown (inferred 51)'`, `region = 'UNKNOWN'`, other attribute columns `NULL`, `is_current = true`. The fact row can now join cleanly against `dim_customers` without a dropped or orphaned row — this is the [Late-Arriving Dimensions: Inferred Members](../../05-loading-patterns/02-dimensional-model-loading.md#late-arriving-dimensions-inferred-members) pattern. A later real load of customer 51's attributes would `UPDATE` this row in place rather than inserting a second version, since the row is inferred, not yet a "real" SCD2 version boundary.

### Step 6: Idempotency — re-run the incremental load twice

```python
before_count = spark.sql("SELECT COUNT(*) AS n FROM orders_incremental").collect()[0]["n"]

for i in range(2):
    watermark_row = spark.sql(
        "SELECT last_watermark FROM wm_control WHERE source_table = 'orders'"
    ).collect()[0]
    last_watermark = watermark_row["last_watermark"]

    df_incremental = spark.sql(f"""
        SELECT order_id, customer_id, order_date, status
        FROM lh_bronze.orders
        WHERE order_date > '{last_watermark}'
    """)

    target = DeltaTable.forName(spark, "orders_incremental")
    (
        target.alias("t")
        .merge(df_incremental.alias("s"), "t.order_id = s.order_id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )
    print(f"Re-run {i+1}: {df_incremental.count()} candidate rows evaluated")

after_count = spark.sql("SELECT COUNT(*) AS n FROM orders_incremental").collect()[0]["n"]
print(f"Before: {before_count}, After two re-runs: {after_count}")
```

> [!success] Expected result
> `Re-run 1: 0 candidate rows evaluated` and `Re-run 2: 0 candidate rows evaluated` — because the watermark already advanced past every row in Step 2, both re-runs find nothing new. `Before: 200, After two re-runs: 200` — the row count is identical. This is idempotency in practice: safe to re-run this cell (or re-trigger the pipeline activity that wraps it) any number of times without duplicating a single row, the property [01-Full vs. Incremental Loads § Idempotency](../../05-loading-patterns/01-full-incremental-loads.md#idempotency) names as the reason `MERGE`-based loads are preferred over blind `INSERT`-based ones.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Step 2's incremental load re-pulls all 200 rows every time | `wm_control`'s `UPDATE` didn't commit, or you're reading the watermark before the previous cell's `UPDATE` finished | Re-run Step 1's table check, confirm `wm_control` shows an advanced date, not `2000-01-01` |
| Step 4's `MERGE` throws a schema-mismatch error on `whenNotMatchedInsert` | The `values` map's column list doesn't exactly match `dim_customers`'s schema (order or name) | Compare against `spark.sql("DESCRIBE dim_customers").show()` and align column names exactly |
| Step 5's inferred row doesn't join to the late fact as expected | The fact's `customer_id` type doesn't match `dim_customers.customer_id`'s type (e.g., string vs. int) | Cast explicitly in the fact DataFrame before joining, or check `printSchema()` on both sides |
| Step 6 shows nonzero candidate rows on the second re-run | The synthetic dataset's `order_date` values aren't strictly historical relative to `current_date()` in your environment | Expected only if you regenerated the dataset with a different seed/date range — the watermark logic itself is still correct |

## Cleanup

**Keep**:

- `wm_control`, `orders_incremental`, and `dim_customers` (with its SCD2 history and inferred member) in `lh_silver` — [Lab 07](./07-pyspark-transformation.md) joins against `dim_customers` and extends `orders_incremental` into a gold aggregate
- `nb-generate-dataset`'s dataset in `lh_bronze` is untouched — this lab only reads from it

Nothing to delete. This lab added tables, not items — `lh_silver` still holds only the objects Lab 05 and this lab created.

## What the Exam Asks About This

- [01-Full vs. Incremental Loads](../../05-loading-patterns/01-full-incremental-loads.md) — watermark pattern, append vs. overwrite semantics, idempotency, change detection options
- [02-Dimensional Model Loading](../../05-loading-patterns/02-dimensional-model-loading.md) — surrogate keys, SCD1 vs. SCD2, the single-`MERGE` SCD2 pattern, late-arriving dimensions, fact-table loading
- [03-Streaming Loading Pattern](../../05-loading-patterns/03-streaming-loading-pattern.md) — how this batch-oriented medallion pattern extends to streaming sources (relevant background for [Lab 09](./09-streaming-eventstream-kql.md))

---

**[← Previous: Lab 05](./05-batch-ingestion-shortcuts-mirroring.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 07: PySpark Transformation](./07-pyspark-transformation.md)**
