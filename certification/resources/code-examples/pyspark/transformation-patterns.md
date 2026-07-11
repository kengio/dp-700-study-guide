---
title: PySpark Transformation Patterns
type: code-examples
tags:
  - dp-700
  - fabric
  - code-examples
  - pyspark
  - delta
  - scd
  - streaming
---

# PySpark Transformation Patterns

Complete, runnable PySpark patterns for Fabric notebooks — each one is a full script, not an isolated snippet. Syntax-level teaching (broadcast joins, `when`/`otherwise`, `dropDuplicates`) lives in [07-Batch Transformation: PySpark Transformations](../../../07-batch-transformation/02-pyspark-transformations.md); these patterns assemble that vocabulary into the end-to-end jobs the exam scenarios describe.

## Table of Contents

- [[#1. Bronze→Silver Cleanse]]
- [[#2. SCD Type 2 with Delta MERGE INTO]]
- [[#3. Incremental Watermark Load]]
- [[#4. Late-Arriving Dimension: Inferred Member]]
- [[#5. Streaming foreachBatch Upsert]]
- [[#6. Gold Aggregation with Window Functions]]
- [[#7. Small-File Compaction with OPTIMIZE]]

---

## 1. Bronze→Silver Cleanse

**Scenario:** Raw `bronze.orders_raw` lands with string-typed numeric columns, duplicate order IDs from replayed source batches, and nulls in an optional discount field. Clean it into a typed, deduplicated, audited `silver.orders` table.

```python
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, DecimalType, DateType
from pyspark.sql.window import Window

bronze = spark.table("bronze.orders_raw")

# 1. Cast raw string columns to their real types
typed = (
    bronze
    .withColumn("order_id", F.col("order_id").cast(IntegerType()))
    .withColumn("customer_id", F.col("customer_id").cast(IntegerType()))
    .withColumn("amount", F.col("amount").cast(DecimalType(10, 2)))
    .withColumn("order_date", F.to_date(F.col("order_date_str"), "yyyy-MM-dd"))
)

# 2. Fill/standardize nulls — business default for a missing discount is 0
cleaned = typed.na.fill({"discount_pct": 0})

# 3. Drop rows missing a required key — can't load an order with no id
cleaned = cleaned.na.drop(subset=["order_id", "customer_id"])

# 4. Deterministic dedup: keep the most recently ingested row per order_id
dedup_window = Window.partitionBy("order_id").orderBy(F.col("_ingested_at").desc())
deduped = (
    cleaned
    .withColumn("row_num", F.row_number().over(dedup_window))
    .filter(F.col("row_num") == 1)
    .drop("row_num")
)

# 5. Audit columns — every silver write records when and from what batch
batch_id = "2026-07-11-01"  # in production, pass in via a notebook parameter cell

silver = (
    deduped
    .withColumn("_silver_loaded_at", F.current_timestamp())
    .withColumn("_source_batch_id", F.lit(batch_id))
)

(silver.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable("silver.orders"))

# Expected: one row per order_id (no dupes), correct types, discount_pct never null.
```

> [!note]
> `row_number()` over a `desc()`-ordered ingestion timestamp is the deterministic alternative to `dropDuplicates(["order_id"])` — see [02-PySpark Transformations](../../../07-batch-transformation/02-pyspark-transformations.md) for why plain `dropDuplicates` doesn't guarantee which row survives.

---

## 2. SCD Type 2 with Delta MERGE INTO

**Scenario:** `dim.customer` must preserve history for `segment` and `address` changes so historical fact rows always report the segment at the time of sale. Apply a batch of staged customer changes as SCD2 versions in a single `MERGE INTO`.

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

# staged_customers columns: customer_key, customer_business_key, address, segment, effective_date
staged_customers = spark.table("staging.customer_changes")
customers = DeltaTable.forName(spark, "dim.customer")

# Rows whose current version actually changed vs. what's staged
changed_cond = "customers.is_current = true AND (updates.address <> customers.address OR updates.segment <> customers.segment)"
changed = (
    staged_customers.alias("updates")
    .join(customers.toDF().alias("customers"), "customer_business_key")
    .where(changed_cond)
    .select("updates.*")
)

# NULL merge_key rows can never match an existing row -> they always insert
staged_updates = (
    changed.selectExpr("NULL as merge_key", "*")
    .unionByName(staged_customers.selectExpr("customer_business_key as merge_key", "*"))
)

match_cond = "customers.is_current = true AND (customers.address <> staged.address OR customers.segment <> staged.segment)"
(customers.alias("customers")
    .merge(staged_updates.alias("staged"), "customers.customer_business_key = staged.merge_key")
    .whenMatchedUpdate(
        condition=match_cond,
        set={"is_current": "false", "end_date": "staged.effective_date"},
    )
    .whenNotMatchedInsert(values={
        "customer_key": "staged.customer_key",
        "customer_business_key": "staged.customer_business_key",
        "address": "staged.address",
        "segment": "staged.segment",
        "is_current": "true",
        "effective_date": "staged.effective_date",
        "end_date": "expr(null)",
    })
    .execute())

# Verify: every business key has exactly one is_current = true row (expect 0 rows back)
spark.sql("""
    SELECT customer_business_key, COUNT(*) AS current_versions
    FROM dim.customer WHERE is_current = true
    GROUP BY customer_business_key HAVING COUNT(*) > 1
""").show()
```

> [!note]
> The `merge_key` trick and the two-step T-SQL equivalent are explained fully in [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md). This pattern is that same technique wired into a complete, runnable job with its own verification query.

---

## 3. Incremental Watermark Load

**Scenario:** `fact.sales` is refreshed hourly from `source.sales`, which has a reliable `last_modified_utc` column. Read the watermark, extract only changed rows, upsert them, and advance the watermark — all as one callable function.

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

def run_incremental_load(source_table: str, target_table: str, watermark_key: str):
    watermark_row = (
        spark.table("control.watermark_table")
        .filter(F.col("source_table_name") == watermark_key)
        .collect()
    )
    old_watermark = watermark_row[0]["last_watermark_value"] if watermark_row else "1900-01-01"
    staged = spark.table(source_table).filter(F.col("last_modified_utc") > old_watermark)
    new_watermark = staged.agg(F.max("last_modified_utc")).collect()[0][0]
    if new_watermark is None:
        return  # no new rows since old_watermark; nothing to load or advance

    target = DeltaTable.forName(spark, target_table)
    (target.alias("tgt")
        .merge(staged.alias("src"), "tgt.sales_order_id = src.sales_order_id")
        .whenMatchedUpdate(set={
            "amount": "src.amount",
            "last_modified_utc": "src.last_modified_utc",
        })
        .whenNotMatchedInsert(values={
            "sales_order_id": "src.sales_order_id",
            "amount": "src.amount",
            "last_modified_utc": "src.last_modified_utc",
        })
        .execute())

    spark.sql(f"""
        MERGE INTO control.watermark_table AS tgt
        USING (SELECT '{watermark_key}' AS k, TIMESTAMP'{new_watermark}' AS v) AS src
        ON tgt.source_table_name = src.k
        WHEN MATCHED THEN UPDATE SET
            last_watermark_value = src.v, last_run_utc = current_timestamp()
        WHEN NOT MATCHED THEN INSERT (source_table_name, last_watermark_value, last_run_utc)
            VALUES (src.k, src.v, current_timestamp())
    """)

run_incremental_load("source.sales", "fact.sales", "fact_sales")
# Expected: fact.sales upserted for rows past the prior watermark; the
# control table's last_watermark_value now equals the max just loaded.
```

> [!warning] Common Mistake
> The watermark `MERGE` above runs as a **separate statement** after the data `MERGE INTO` — not in one transaction. That's safe here because both are idempotent and keyed: a failure between them just re-processes the same window on retry. See [05-Loading Patterns](../../../05-loading-patterns/01-full-incremental-loads.md) for why the watermark update must never run *before* the load commits.

---

## 4. Late-Arriving Dimension: Inferred Member

**Scenario:** `fact.sales` receives a sale for `customer_business_key = 'ACME-777'`, but `dim.customer` has no current row for that key yet. Stub an inferred member so the fact load isn't blocked, then backfill it in place once the real record arrives.

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F
from pyspark.sql.window import Window

staged_sales = spark.table("staging.sales_batch")
customers = DeltaTable.forName(spark, "dim.customer")

# Step 1: find fact business keys with no current dimension row
current_customers = customers.toDF().filter("is_current = true")
missing_keys = (
    staged_sales.select("customer_business_key").distinct()
    .join(current_customers.select("customer_business_key"), "customer_business_key", "left_anti")
)
max_key = spark.table("dim.customer").agg(F.max("customer_key")).collect()[0][0] or 0
inferred_stubs = (
    missing_keys
    .withColumn("customer_key", max_key + F.row_number().over(Window.orderBy("customer_business_key")))
    .withColumn("address", F.lit(None).cast("string"))
    .withColumn("segment", F.lit(None).cast("string"))
    .withColumn("is_current", F.lit(True)).withColumn("is_inferred", F.lit(True))
)

if inferred_stubs.count() > 0:
    inferred_stubs.write.format("delta").mode("append").saveAsTable("dim.customer")

# Step 2: fact load now resolves cleanly against dim.customer (real + inferred)
current_customers = spark.table("dim.customer").filter("is_current = true")
fact_ready = (
    staged_sales.alias("s")
    .join(F.broadcast(current_customers).alias("c"), "customer_business_key", "left")
    .withColumn("customer_key", F.coalesce(F.col("c.customer_key"), F.lit(-1)))  # -1 = Unknown Member fallback
    .select("s.order_id", "customer_key", "s.amount", "s.order_date")
)
fact_ready.write.format("delta").mode("append").saveAsTable("fact.sales")

# Step 3: real record backfills later -> plain update in place, NOT the SCD2
# mergeKey pattern (the stub never represented a real prior state)
real_customer_batch = spark.table("staging.customer_updates")
(customers.alias("tgt")
    .merge(real_customer_batch.alias("src"), "tgt.customer_business_key = src.customer_business_key")
    .whenMatchedUpdate(
        condition="tgt.is_inferred = true",
        set={"address": "src.address", "segment": "src.segment", "is_inferred": "false"},
    )
    .execute())
# Expected: every staged sale has a joinable customer_key (real, inferred,
# or -1 Unknown); inferred stubs flip is_inferred=false once backfilled.
```

> [!note]
> The T-SQL version of this exact pattern is worked in [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md); this is the fully-coded PySpark equivalent that file only sketches in prose.

---

## 5. Streaming foreachBatch Upsert

**Scenario:** A customer-profile change stream must be deduplicated on ingest and upserted into `silver.customer_profile`, while also appending every applied change to an `audit.customer_profile_changes` log — two writes per micro-batch, both inside one `foreachBatch`.

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

raw_stream = (
    spark.readStream.format("eventhubs").options(**ehConf).load()
    .withColumn("bodyAsString", F.col("body").cast("string"))
    .select(F.from_json("bodyAsString", profileSchema).alias("e"))
    .select("e.*")
)

deduped_stream = (
    raw_stream
    .withWatermark("event_time", "10 minutes")
    .dropDuplicates(["customer_id", "event_time"])
)

def upsert_and_audit(micro_batch_df, batch_id: int):
    micro_batch_df.persist()
    target = DeltaTable.forName(spark, "silver.customer_profile")
    (target.alias("t")
        .merge(micro_batch_df.alias("s"), "t.customer_id = s.customer_id")
        .whenMatchedUpdateAll().whenNotMatchedInsertAll()
        .execute())
    (micro_batch_df
        .withColumn("_batch_id", F.lit(batch_id)).withColumn("_applied_at", F.current_timestamp())
        .write.format("delta").mode("append")
        .saveAsTable("audit.customer_profile_changes"))
    micro_batch_df.unpersist()

(deduped_stream.writeStream
    .foreachBatch(upsert_and_audit)
    .option("checkpointLocation", "Files/checkpoints/silver_customer_profile")
    .trigger(processingTime="1 minute")
    .start())
# Expected: silver.customer_profile always reflects the latest profile per
# customer_id; audit log accumulates one row per applied change, tagged with batch_id.
```

> [!warning] Common Mistake
> Calling `.persist()`/`.unpersist()` around the micro-batch DataFrame matters here because it's read **twice** inside `foreachBatch` (once for the `MERGE`, once for the audit append) — without caching, Spark would re-evaluate the upstream dedup/watermark logic for each read. See [03-Spark Structured Streaming](../../../08-streaming-data/03-spark-structured-streaming.md) for the single-write version of `foreachBatch`.

---

## 6. Gold Aggregation with Window Functions

**Scenario:** Build a gold-layer `gold.customer_revenue_summary` table combining a per-customer rank, a running total within each segment, and a 3-order moving average — three window-function techniques in one materialization job.

```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

silver_orders = spark.table("silver.orders").join(
    spark.table("dim.customer").filter("is_current = true").select(
        "customer_key", "customer_business_key", "segment"
    ),
    on="customer_key",
)

segment_window = Window.partitionBy("segment").orderBy(F.col("amount").desc())
running_total_window = (Window.partitionBy("segment").orderBy("order_date")
    .rowsBetween(Window.unboundedPreceding, Window.currentRow))
moving_avg_window = (Window.partitionBy("customer_key").orderBy("order_date")
    .rowsBetween(-2, Window.currentRow))  # current order + 2 preceding

gold_summary = (
    silver_orders
    .withColumn("segment_rank", F.rank().over(segment_window))
    .withColumn("segment_running_total", F.sum("amount").over(running_total_window))
    .withColumn("customer_moving_avg_3", F.avg("amount").over(moving_avg_window))
    .withColumn(
        "pct_of_segment_total",
        F.round(100.0 * F.col("amount") / F.sum("amount").over(Window.partitionBy("segment")), 2),
    )
)

(gold_summary.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable("gold.customer_revenue_summary"))

gold_summary.select(
    "customer_business_key", "segment", "amount",
    "segment_rank", "segment_running_total", "customer_moving_avg_3", "pct_of_segment_total",
).orderBy("segment", "segment_rank").show(5)
# Expected: segment_rank=1 is each segment's largest single order;
# segment_running_total accumulates by order_date; moving_avg_3 reflects
# at most a customer's 3 most recent orders.
```

---

## 7. Small-File Compaction with OPTIMIZE

**Scenario:** `bronze.device_readings` accumulates thousands of small files from frequent streaming micro-batch writes, slowing downstream reads. Compact it, optionally clustering on the columns the gold job filters by most.

```python
from delta.tables import DeltaTable

# Plain bin-compaction — merges small files into fewer, larger ones
spark.sql("OPTIMIZE bronze.device_readings")

# ZORDER colocates similar values together (use when queries filter on these
# columns together); VORDER applies Fabric's read-heavy Parquet optimization —
# both run in one pass: bin compaction -> Z-Order -> V-Order, in that order
spark.sql("OPTIMIZE bronze.device_readings ZORDER BY (device_id, reading_date) VORDER")

# Equivalent DeltaTable API form (bin-compaction only — no ZORDER/VORDER
# support in this API path; use the SQL form above when either is needed)
DeltaTable.forName(spark, "bronze.device_readings").optimize().executeCompaction()

# Auto compaction: compact automatically right after a write leaves a
# partition fragmented, instead of relying only on a scheduled OPTIMIZE
spark.conf.set("spark.databricks.delta.autoCompact.enabled", True)

# VACUUM: remove files no longer referenced by the Delta log, past the
# default 7-day (168-hour) retention — never go below 7 days without also
# disabling the retention safety check (spark.databricks.delta.retentionDurationCheck.enabled)
spark.sql("VACUUM bronze.device_readings RETAIN 168 HOURS")

# Expected result: numFilesRemoved > numFilesAdded, and subsequent reads
# scan noticeably fewer files.
spark.sql("DESCRIBE HISTORY bronze.device_readings").select(
    "version", "operation", "operationMetrics"
).show(3, truncate=False)
```

> [!note]
> `OPTIMIZE ... ZORDER BY (...)` runs bin compaction, then Z-Order, then V-Order (if `VORDER` is present) — in that order, in one command. Fabric's V-Order is **disabled by default** for new workspaces (`spark.sql.parquet.vorder.default = false`); the `VORDER` keyword on `OPTIMIZE` forces it for that command regardless of the session/table default.

## Related Topics

- [07-Batch Transformation: PySpark Transformations](../../../07-batch-transformation/02-pyspark-transformations.md)
- [05-Loading Patterns: Full vs. Incremental Loads](../../../05-loading-patterns/01-full-incremental-loads.md)
- [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md)
- [05-Loading Patterns: Streaming Loading Pattern](../../../05-loading-patterns/03-streaming-loading-pattern.md)
- [08-Streaming Data: Spark Structured Streaming](../../../08-streaming-data/03-spark-structured-streaming.md)

---

**[↑ Back to Code Examples](../code-examples.md)**
