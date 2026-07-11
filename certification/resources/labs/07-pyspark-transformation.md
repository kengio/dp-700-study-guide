---
title: "Lab 07: PySpark Transformation"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - pyspark
  - spark
  - transformation
  - optimize
  - v-order
  - vacuum
status: complete
---

# Lab 07: PySpark Transformation

## Overview

This lab is the PySpark half of Domain 2's transformation surface: a bronze→silver cleanse with real audit columns, a broadcast join, a window-function gold aggregate, a deliberate small-file mess cleaned up with `OPTIMIZE`/V-Order, a `VACUUM` retention rejection you trigger on purpose, and a look at the Spark UI for the job that did the work.

> [!abstract]
>
> - Cleanses `lh_bronze.order_items` into a deduplicated, typed, audited silver table
> - Joins the cleansed fact against `dim_customers` ([Lab 06](./06-loading-patterns-incremental-scd.md)) and `products` using an explicit broadcast hint
> - Builds a gold aggregate table (`gold_sales_by_region_month`) with `groupBy`/`agg` plus a running-total window function
> - Deliberately creates small files, then fixes them with `OPTIMIZE` + V-Order, and triggers (then works around) a `VACUUM` retention-period rejection
> - Opens the Spark UI for the job just run and reads its stage-level shuffle metrics

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md), [Lab 05](./05-batch-ingestion-shortcuts-mirroring.md), and [Lab 06](./06-loading-patterns-incremental-scd.md) completed — `lh_silver` with `dim_customers` and `orders_incremental`.
>
> **Estimated time:** 45 minutes

---

## Steps

### Step 1: Bronze→silver cleanse — dedup, nulls, casts, audit columns

Continue in `nb-loading-patterns` (or a new notebook attached to `lh_silver`) with a fresh cell:

```python
from pyspark.sql import functions as F

df_raw = spark.sql("SELECT * FROM lh_bronze.order_items")

df_silver = (
    df_raw
    # Deduplication: drop exact duplicate order_item_id rows if any slipped in
    .dropDuplicates(["order_item_id"])
    # Handle missing data: a null quantity defaults to 1 rather than dropping the row
    .fillna({"quantity": 1})
    # Explicit casts: guard against a future upstream schema drift silently changing types
    .withColumn("order_item_id", F.col("order_item_id").cast("long"))
    .withColumn("order_id", F.col("order_id").cast("long"))
    .withColumn("product_id", F.col("product_id").cast("int"))
    .withColumn("quantity", F.col("quantity").cast("int"))
    # Audit columns: every silver table should be able to answer "where did this row come from, and when"
    .withColumn("_ingested_at", F.current_timestamp())
    .withColumn("_source_table", F.lit("lh_bronze.order_items"))
)

df_silver.write.format("delta").mode("overwrite").saveAsTable("silver_order_items")

print(f"Bronze rows: {df_raw.count()}, Silver rows: {df_silver.count()}")
df_silver.printSchema()
```

> [!success] Expected result
> `Bronze rows` and `Silver rows` match exactly (the synthetic dataset has no real duplicates) — `dropDuplicates` is here to make the pattern explicit, not because this run needs it. The schema now shows explicit types plus `_ingested_at` (timestamp) and `_source_table` (string) trailing columns, matching [02-PySpark Transformations § Deduplication](../../07-batch-transformation/02-pyspark-transformations.md#deduplication-dropduplicates) and [§ Handling Missing Data](../../07-batch-transformation/02-pyspark-transformations.md#handling-missing-data).

### Step 2: Join with a broadcast hint

```python
df_products = spark.sql("SELECT product_id, product_name, category, unit_price FROM lh_bronze.products")
df_dim_customers = spark.sql("SELECT customer_id, customer_name, region FROM dim_customers WHERE is_current = true")
df_orders = spark.sql("SELECT order_id, customer_id, order_date FROM orders_incremental")

df_enriched = (
    df_silver
    .join(F.broadcast(df_products), on="product_id", how="left")
    .join(df_orders, on="order_id", how="left")
    .join(F.broadcast(df_dim_customers), on="customer_id", how="left")
    .withColumn("line_total", F.col("quantity") * F.col("unit_price"))
)

df_enriched.select(
    "order_id", "product_name", "category", "customer_name", "region", "quantity", "line_total"
).show(5)
```

> [!success] Expected result
> Five sample rows print with every dimension attribute populated — `product_name`, `category`, `customer_name`, `region` — and a computed `line_total`. `products` (30 rows) and the current-version slice of `dim_customers` (50 rows) are both small enough that `F.broadcast()` sends a full copy to every executor instead of shuffling the much larger fact side, exactly the tradeoff in [02-PySpark Transformations § Joins and the Broadcast Hint](../../07-batch-transformation/02-pyspark-transformations.md#joins-and-the-broadcast-hint).

> [!warning] Common Mistake
> `F.broadcast()` is a hint, not a guarantee — Spark's cost-based optimizer can still choose a different join strategy if the DataFrame is larger than `spark.sql.autoBroadcastJoinThreshold` (10 MB by default) at execution time. For this lab's tiny synthetic tables it always takes effect, but on a real `products` table with millions of rows, broadcasting would either be silently skipped or, worse, force-broadcast a table too large for executor memory. Check the Spark UI's physical plan (Step 6) to confirm a `BroadcastHashJoin`, don't just assume the hint took.

### Step 3: `groupBy`/`agg` + window functions — build the gold aggregate

```python
from pyspark.sql.window import Window

df_monthly = (
    df_enriched
    .withColumn("order_month", F.date_format("order_date", "yyyy-MM"))
    .groupBy("region", "order_month")
    .agg(
        F.sum("line_total").alias("monthly_revenue"),
        F.count("order_item_id").alias("line_item_count"),
        F.countDistinct("order_id").alias("order_count"),
    )
)

# Window function: running total of revenue per region, ordered by month
region_window = Window.partitionBy("region").orderBy("order_month").rowsBetween(Window.unboundedPreceding, Window.currentRow)

df_gold = df_monthly.withColumn(
    "running_revenue_by_region", F.sum("monthly_revenue").over(region_window)
)

df_gold.write.format("delta").mode("overwrite").saveAsTable("gold_sales_by_region_month")

spark.sql("""
    SELECT region, order_month, monthly_revenue, running_revenue_by_region
    FROM gold_sales_by_region_month
    ORDER BY region, order_month
""").show(20)
```

> [!success] Expected result
> `gold_sales_by_region_month` shows one row per region/month with `running_revenue_by_region` strictly non-decreasing within each region as `order_month` advances — proof the window function's `rowsBetween(unboundedPreceding, currentRow)` frame is accumulating correctly rather than resetting per row. This table is what [Lab 08](./08-warehouse-tsql.md) pulls into `wh_gold` via cross-database CTAS.

> [!note] Mental model
> `groupBy().agg()` collapses many rows into one per group — you lose row-level detail. A window function (`.over(windowSpec)`) computes a value *per row* using a frame of related rows, without collapsing anything — every input row survives with a new column attached. This lab uses both: `groupBy` to build the monthly grain, then a window function on top of the already-grouped result to add the running total — see [02-PySpark Transformations § Window Functions](../../07-batch-transformation/02-pyspark-transformations.md#window-functions).

### Step 4: Small-file demo, then `OPTIMIZE` with V-Order

```python
# Deliberately fragment the table into many small files — simulates many small streaming
# micro-batch writes landing over time, a common real-world small-file cause.
for i in range(15):
    (
        df_gold.limit(2)
        .write.format("delta").mode("append")
        .save(f"Tables/gold_sales_by_region_month")
    )

file_count_before = spark.sql(
    "DESCRIBE DETAIL gold_sales_by_region_month"
).select("numFiles").collect()[0]["numFiles"]
print(f"Files before OPTIMIZE: {file_count_before}")
```

> [!success] Expected result
> `Files before OPTIMIZE` shows well over 15 — every tiny append created at least one new Parquet file, and Delta's own transaction log adds overhead per commit. This is the [small-file problem](../../11-performance-optimization/01-lakehouse-optimization.md#the-small-file-problem) in miniature.

```python
spark.sql("OPTIMIZE gold_sales_by_region_month")

file_count_after = spark.sql(
    "DESCRIBE DETAIL gold_sales_by_region_month"
).select("numFiles").collect()[0]["numFiles"]
print(f"Files after OPTIMIZE: {file_count_after}")
```

> [!success] Expected result
> `Files after OPTIMIZE` drops to a small handful (often 1, given how little data this table holds) — bin-compaction merged the fragments into larger, read-efficient files. To apply V-Order on top (Fabric's optimized sort/encoding/compression layer), use the Lakehouse explorer's table **Maintenance** dialog instead of raw `OPTIMIZE` SQL — right-click `gold_sales_by_region_month` → **Maintenance** → enable **Optimize** and check **Apply V-Order** → **Run now**. V-Order costs roughly 15% more write time in exchange for up to 50% better compression and faster downstream reads (Power BI Direct Lake and the SQL analytics endpoint benefit most) — see [11-Lakehouse Optimization § V-Order](../../11-performance-optimization/01-lakehouse-optimization.md#v-order-write-cost-vs-read-benefit).

### Step 5: `VACUUM` — trigger the retention rejection, then run it correctly

```python
try:
    spark.sql("VACUUM gold_sales_by_region_month RETAIN 0 HOURS")
except Exception as e:
    print(f"Rejected as expected: {type(e).__name__}")
```

> [!success] Expected result
> The call fails — Fabric's default `VACUUM` safety check rejects any retention interval under seven days to protect Delta time-travel history and concurrent readers/writers, exactly as documented in [Delta Table Maintenance § Vacuum retention settings](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-table-maintenance#vacuum-retention-settings). This is a deliberate guardrail, not a bug — don't disable it outside a lab.

```python
# The supported way to shorten retention for a lab/demo: disable the safety check at the
# Spark-session level, run VACUUM with a short window, then re-enable the check immediately.
spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
spark.sql("VACUUM gold_sales_by_region_month RETAIN 0 HOURS")
spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "true")

print("VACUUM completed with the safety check temporarily disabled, then re-enabled.")
```

> [!success] Expected result
> `VACUUM` now succeeds and removes the now-unreferenced small Parquet files `OPTIMIZE` orphaned in Step 4. Setting the config back to `true` immediately afterward matters — leaving it disabled at the environment level (via `env-dp700`'s Spark properties, per Lab 01 Step 4) is the production-relevant version of this toggle, and it should be scoped as narrowly as possible.

> [!warning] Common Mistake
> A short `VACUUM` retention window destroys Delta's time-travel history for anything older than the window, and can break a concurrent long-running reader that's still referencing a file version `VACUUM` just deleted. The 7-day default isn't arbitrary — it's calibrated to typical streaming/batch job run lengths. Never run `RETAIN 0 HOURS` against a table with active concurrent writers outside a controlled lab.

### Step 6: Inspect the Spark UI for the job you just ran

1. In `dp700-labs`, select **Monitor** (left nav) → filter **Item type: Notebook**.
2. Select the most recent run of `nb-loading-patterns`.
3. In the run details pane, select **Spark application details** (or the run's application ID link) to open the full Spark UI.
4. On the **Jobs** tab, find the job corresponding to Step 4's `OPTIMIZE` call — note its stage count and duration.
5. Drill into that job's **Stages** tab and look at **Shuffle Read** / **Shuffle Write** columns for the bin-compaction stage.
6. Select **SQL / DataFrame** tab, open the query plan for Step 2's join, and confirm it shows `BroadcastHashJoin` (not `SortMergeJoin`) for the `products` and `dim_customers` joins.

> [!success] Expected result
> You can point to the exact stage that did `OPTIMIZE`'s file compaction, read its shuffle metrics, and confirm the broadcast join actually took effect in the physical plan — turning Step 2's "Common Mistake" callout from a warning into something you verified yourself. [Lab 10](./10-monitor-optimize.md) returns to Spark application monitoring in more depth across the whole lab pack's notebook history.

### Step 7: Worked scenario — picking the right lever

Before moving on, work through this cold, then check your reasoning:

**Scenario**: A production notebook writes to a Delta table every 5 minutes via a streaming micro-batch job. After a month, reads against the table have slowed noticeably, `DESCRIBE DETAIL` shows thousands of small Parquet files, and the on-call engineer wants to fix read performance without breaking the always-on write job or losing the ability to time-travel to yesterday's data for a scheduled reconciliation job.

> [!success]- Answer
>
> Run `OPTIMIZE` (with V-Order, since downstream consumption is read-heavy) on a **schedule**, separate from the write job — compaction is safe to run concurrently with ongoing appends and doesn't require pausing the streaming writer. Leave `VACUUM`'s retention at the **7-day default** — shortening it below what the reconciliation job needs (a lookback to "yesterday") would break that job's time-travel query the moment `VACUUM` runs, exactly the trap this lab's Step 5 walked through on purpose. The fix here is entirely about *when* to run `OPTIMIZE` (regularly, off the write path), not about touching `VACUUM`'s retention window at all.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Step 2's join plan shows `SortMergeJoin` instead of `BroadcastHashJoin` | `spark.sql.autoBroadcastJoinThreshold` is set lower than the DataFrame's estimated size, or Spark's cost estimate is stale | Check the config value; for this lab's tiny tables this shouldn't happen, but re-run `ANALYZE TABLE ... COMPUTE STATISTICS` if it does |
| Step 4's `numFiles` doesn't drop after `OPTIMIZE` | The table is too small for compaction to matter, or you ran `OPTIMIZE` before the small-file loop finished writing | Confirm the loop's 15 appends completed (check `DESCRIBE DETAIL` before `OPTIMIZE`) |
| Step 5's first `VACUUM` call doesn't raise an exception | You're on a workspace/environment where `retentionDurationCheck` was already disabled by a previous lab or session | Expected if a prior session left the config `false` — re-enable it after this lab regardless, per the warning above |
| Spark UI in Step 6 shows no jobs for the notebook run | The run already aged out of the Spark history server's retention window | Re-run the notebook cell and open Monitor immediately afterward — history retention is time-limited |

## Cleanup

**Keep**:

- `silver_order_items` and `gold_sales_by_region_month` in `lh_silver` — [Lab 08](./08-warehouse-tsql.md) CTASes `gold_sales_by_region_month` into `wh_gold`'s star schema
- `dim_customers` and `orders_incremental` from Lab 06, unchanged

**Confirm before moving on**: `spark.conf.get("spark.databricks.delta.retentionDurationCheck.enabled")` should read `true` (or be unset, which defaults to enabled) — Step 5 re-enables it, but confirm before starting Lab 08.

## What the Exam Asks About This

- [02-PySpark Transformations](../../07-batch-transformation/02-pyspark-transformations.md) — joins/broadcast, groupBy/window functions, deduplication, missing-data handling, casting
- [05-Data Quality Patterns](../../07-batch-transformation/05-data-quality-patterns.md) — dedup/missing-data/late-arriving patterns in PySpark, T-SQL, and KQL side by side
- [01-Lakehouse Optimization](../../11-performance-optimization/01-lakehouse-optimization.md) — `OPTIMIZE`, V-Order, `VACUUM` retention, the small-file problem
- [03-Spark Optimization](../../11-performance-optimization/03-spark-optimization.md) — broadcast joins and hints, AQE, partition tuning
- [01-Monitoring Surfaces](../../09-monitoring-alerting/01-monitoring-surfaces.md) — Spark application monitoring, what each tab of the Spark UI shows

---

**[← Previous: Lab 06](./06-loading-patterns-incremental-scd.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 08: Warehouse T-SQL](./08-warehouse-tsql.md)**
