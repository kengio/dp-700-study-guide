---
title: Spark Structured Streaming
type: topic
tags:
  - dp-700
  - fabric
  - streaming-data
  - spark-structured-streaming
  - delta
  - checkpointing
  - watermark
  - native-execution-engine
---

# Spark Structured Streaming

## Overview

Spark Structured Streaming is Fabric's code-first streaming engine — a scalable, fault-tolerant stream processing model built on Spark that treats a live data stream as a table new rows are continuously appended to. This topic covers the `readStream`/`writeStream` API against Delta and Kafka/Event Hubs sources, output modes and which sinks support which, triggers (including Fabric's current support for each), why checkpointing is mandatory and where it lives, watermarks and late-data handling, the `foreachBatch` pattern for upserts, streaming into lakehouse tables end to end, and the one Native Execution Engine limitation every DP-700 candidate needs memorized.

> [!abstract]
>
> - `spark.readStream` and `df.writeStream` mirror the batch `read`/`write` API — the same DataFrame transformations apply, plus streaming-specific operations like windowing and watermarking
> - **`checkpointLocation` is mandatory** for any production streaming write — it's what makes restart-after-failure safe and enables exactly-once-at-the-sink semantics
> - Output mode determines what a micro-batch writes: **append** (new rows only), **complete** (the full result table every batch), or **update** (only changed rows) — sink support varies by mode
> - `foreachBatch` is the standard pattern for running a Delta `MERGE` (upsert) from inside a streaming query, since `MERGE` isn't a native streaming sink operation
> - The **Native Execution Engine does not support Structured Streaming at all** — streaming queries always run on the standard JVM Spark engine, with no fallback distinction to make since NEE never engages in the first place

> [!tip] What the Exam Tests
>
> - Writing correct `readStream`/`writeStream` pipelines against Delta and Event Hubs/Kafka sources
> - Choosing the correct output mode for a given aggregation/sink combination
> - Setting up checkpointing and explaining why it's required
> - Applying watermarks to bound state growth and handle late-arriving data
> - Using `foreachBatch` to perform an upsert (`MERGE`) from a streaming query
> - Knowing that streaming workloads never benefit from the Native Execution Engine

---

## readStream / writeStream: The Core API

```python
import pyspark.sql.functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType

# readStream from Event Hubs (Kafka-protocol compatible)
rawStream = (
    spark.readStream
    .format("eventhubs")
    .options(**ehConf)
    .load()
)

# Parse the JSON payload against an explicit schema
eventSchema = StructType([
    StructField("deviceId", StringType(), False),
    StructField("temperature", DoubleType(), True),
    StructField("eventTime", LongType(), True),
])

parsed = (
    rawStream
    .withColumn("bodyAsString", F.col("body").cast("string"))
    .select(F.from_json("bodyAsString", eventSchema).alias("e"))
    .select("e.*")
)

# writeStream to a Delta table, append-only
(parsed.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/bronze_devices")
    .outputMode("append")
    .toTable("bronze.device_readings"))
```

`readStream` returns an unbounded streaming DataFrame — the same `select`/`filter`/`withColumn`/`groupBy` operations from batch PySpark apply, plus streaming-only operations like `withWatermark()` and windowed `groupBy`. `writeStream` requires an explicit `outputMode`, a `checkpointLocation`, and either `.toTable(...)` (managed Delta table) or `.start("<path>")` (path-based sink) to actually launch the query.

Structured Streaming natively supports file-based sources (CSV, JSON, ORC, Parquet) and messaging sources via connectors — the Azure Event Hubs connector (`eventhubs` format, also usable against Kafka-protocol endpoints like a Fabric Eventstream custom endpoint or Apache Kafka directly via the `kafka` format).

## Output Modes and Sink Support

| Output mode | Behavior | Typical sink support |
| :--- | :--- | :--- |
| **append** *(default for non-aggregated queries)* | Only new rows added since the last trigger are written | ==Universally supported== — the default for bronze/raw landing and any non-aggregating transform |
| **complete** | The entire updated result table is rewritten every trigger | Requires the query to have an aggregation; supported by sinks that can handle a full-table rewrite each batch (e.g., in-memory tables, some file sinks) — not typically used for high-volume Delta writes |
| **update** | Only rows that changed since the last trigger are written | Requires an aggregation; supported by sinks like the console/memory sink and, with caveats, Delta — most commonly used for continuously-updated aggregate tables |

> [!warning] Common Mistake
> Attaching `outputMode("complete")` or `outputMode("update")` to a query with **no aggregation**. Both modes require the query to compute an aggregate (a `groupBy(...).agg(...)` or windowed aggregation) — Structured Streaming raises an analysis exception otherwise. A bronze/raw landing write with no aggregation must use `outputMode("append")`.

**Practice Question 1** *(Medium)*

A streaming query computes a running count of orders per store using `groupBy("storeId").count()` and needs the destination table to always reflect the current total per store, with only the stores that changed in a given micro-batch actually rewritten. Which output mode fits, and why is `append` not viable here?

A. `append` — because it's the default and works with any query  
B. `complete` — because it rewrites everything, guaranteeing correctness  
C. `update` — because only changed aggregate rows need to be rewritten each trigger; `append` can't be used because the query is aggregating, and `append` only emits new rows, not updates to prior aggregate results  
D. There's no valid output mode for a running aggregate  

> [!success]- Answer
> **C. `update` — because only changed aggregate rows need to be rewritten each trigger; `append` can't be used because the query is aggregating, and `append` only emits new rows, not updates to prior aggregate results**
>
> `append` mode cannot express "this store's running total changed" — it only ever adds new rows, never revises previously emitted ones, which is fundamentally incompatible with a continuously-updating aggregate. `complete` would technically work but wastefully rewrites every store's total on every trigger, when only a subset changed. `update` is purpose-built for exactly this "emit only what changed" aggregate pattern.

## Triggers

| Trigger | Behavior | Fabric support |
| :--- | :--- | :--- |
| Default (no `.trigger(...)` call) | Micro-batch, starting the next batch immediately after the previous one completes | ==Fully supported== — the out-of-the-box behavior |
| `.trigger(processingTime="1 minute")` | Fixed-interval micro-batch — accumulates data and writes in fewer, larger, better-compacted files | ==Fully supported== — the standard way to trade a small latency increase for reduced small-file overhead |
| `.trigger(availableNow=True)` | Processes all currently available data as a bounded set of micro-batches, then stops — a batch-like "catch up and finish" run | ==Fully supported== — useful for backfills or scheduled "process what's arrived since last run" jobs |
| Continuous processing mode | An experimental, low-latency mode with a much smaller supported operator set | Not the primary documented pattern for Fabric streaming workloads — treat as unsupported/edge-case for exam purposes; default to micro-batch triggers |

```python
(parsed.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/bronze_devices")
    .outputMode("append")
    .trigger(processingTime="1 minute")
    .toTable("bronze.device_readings"))
```

> [!note] Mental model
> The default trigger is a **relay runner who starts the next leg the instant they cross the line** — maximum responsiveness, but potentially many small handoffs. `processingTime` is **running the leg on a fixed schedule** instead — you accept a small delay in exchange for each leg covering more ground (larger, better-compacted files). `availableNow` is **running the whole race once, then stopping** — perfect for "catch up on everything that's arrived, then finish," not for an always-on service.

## Checkpointing

`checkpointLocation` is a required option for any production streaming write. It tracks two things: **offsets** (which source data has been read for each micro-batch) and **committed batch IDs** (which batches have been fully, successfully written to the sink). Together, these let Structured Streaming resume correctly after a failure or planned restart — replaying only the data that wasn't yet durably committed, and recognizing (and skipping) a replayed batch that already succeeded.

```python
.option("checkpointLocation", "Files/checkpoints/silver_orders")
```

Checkpoints are stored per-query — a checkpoint directory is tied to one specific streaming query's logical plan, and changing that query's structure (adding/removing a `groupBy`, changing a schema in an incompatible way) can invalidate an existing checkpoint. Each independent streaming query needs its own dedicated checkpoint path; reusing one checkpoint location across two different queries corrupts both.

> [!warning] Common Mistake
> Omitting `checkpointLocation` "to keep things simple" during initial development, then relying on that same code for a production job. Without a checkpoint, a restarted query has no memory of what it already processed — it either reprocesses everything from the source's earliest retained offset (duplicates) or starts from the latest offset and silently skips whatever arrived during the outage (data loss), depending on the source's default starting-position behavior.

## Watermarks and Late Data

A **watermark** tells Structured Streaming how long to keep state (for deduplication or windowed aggregation) before it's safe to expire, based on how late data is allowed to arrive relative to the latest seen event-time.

```python
from pyspark.sql import functions as F

deduped = (
    parsed
    .withWatermark("eventTime", "10 minutes")
    .dropDuplicates(["deviceId", "eventTime"])
)
```

Without a watermark, `dropDuplicates` (or a windowed `groupBy`) on an unbounded stream keeps every seen key/window in state forever — memory grows without bound. A 10-minute watermark means any event arriving more than 10 minutes late (relative to the maximum `eventTime` seen so far) is no longer guaranteed to be included in the affected window's result or caught by dedup.

> [!note] Mental model — watermark
> A watermark is the **tide line marking the last-processed row** — Structured Streaming tracks the highest event-time it's seen, subtracts the watermark's tolerance, and treats anything behind that line as "safe to forget." Data arriving after the tide has moved past its window isn't rejected outright — it's simply no longer guaranteed to be counted, the same way debris washing ashore after the tide has receded past that point won't be swept back out to sea with the rest.

**Practice Question 2** *(Hard)*

A streaming job computes 5-minute tumbling-window counts with `.withWatermark("eventTime", "15 minutes")`. An event with `eventTime` arrives 20 minutes after the latest `eventTime` seen so far. What happens to that event?

A. The job crashes with a late-data exception  
B. The event is guaranteed to be included, since Structured Streaming always processes every event it receives  
C. The event's window has likely already been finalized and its state dropped, so the event is not guaranteed to be reflected in that window's aggregate — a longer watermark tolerance would be needed to catch it  
D. The event is automatically routed to a new window starting at its own arrival time  

> [!success]- Answer
> **C. The event's window has likely already been finalized and its state dropped, so the event is not guaranteed to be reflected in that window's aggregate — a longer watermark tolerance would be needed to catch it**
>
> A 15-minute watermark tolerance means state for windows older than (latest event-time − 15 minutes) can be dropped. An event arriving 20 minutes late falls outside that tolerance, so its window's state may already be gone — the event is silently excluded from that window's result rather than causing an error or being placed in a new window. This is the core tradeoff of watermarking: bounding state growth means accepting some data loss beyond the tolerance window.

## foreachBatch: Upserts from a Streaming Query

`MERGE INTO` isn't a native streaming sink write mode — to perform an upsert from a streaming query, use `foreachBatch` to run a batch `MERGE` against each micro-batch's DataFrame:

```python
from delta.tables import DeltaTable

def upsert_to_delta(microBatchDf, batchId):
    target = DeltaTable.forName(spark, "silver.customer_profile")
    (target.alias("t")
        .merge(microBatchDf.alias("s"), "t.customerId = s.customerId")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute())

(parsed.writeStream
    .foreachBatch(upsert_to_delta)
    .option("checkpointLocation", "Files/checkpoints/silver_customer_profile")
    .trigger(processingTime="1 minute")
    .start())
```

`foreachBatch` receives each micro-batch as a regular (non-streaming) DataFrame plus a `batchId`, so any batch API — including Delta's `MERGE`, multi-table writes, or calling out to another system — is available inside it. Checkpointing still applies at the outer `writeStream` level, so a replayed batch after a failure re-runs the same `MERGE` idempotently rather than double-applying it.

> [!warning] Common Mistake
> Writing raw upsert logic directly against the streaming DataFrame with `.writeStream.format("delta")` and expecting `MERGE` semantics. Delta's native streaming sink only supports **append** (and, with restrictions, update/complete for aggregates) — it does not perform upserts on write. Any upsert requirement inside a streaming pipeline needs `foreachBatch`.

## Optimizing Streaming Writes

Two additional levers improve streaming write performance beyond triggers:

- **`partitionBy()`** organizes output into subdirectories by column value — choose columns with good cardinality that produce well-sized files; avoid columns that create too many tiny partitions or too few enormous ones
- **`repartition()` / `coalesce()`** control the number of in-memory partitions before a write — `repartition()` does a full shuffle to rebalance data evenly (increasing or decreasing partition count); `coalesce()` only decreases partition count, minimizing data movement
- **Optimized Write** (`spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", True)`) automatically merges or splits partitions before writing, maximizing disk throughput without manually calling `repartition()`/`coalesce()` — `partitionBy()` can still be layered on top for disk-level organization

```python
rawData = (
    df
    .withColumn("bodyAsString", F.col("body").cast("string"))
    .select(F.from_json("bodyAsString", eventSchema).alias("e"))
    .select("e.*")
    .repartition(48)
    .writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/bronze_devices")
    .outputMode("append")
    .partitionBy("region", "deviceType")
    .toTable("bronze.device_readings")
)
```

## Running Streaming Jobs in Production

Notebooks are effective for developing and testing streaming logic interactively, but production streaming workloads that need to run continuously should use **Spark job definitions** instead — non-interactive, code-oriented tasks that provide greater robustness and availability than an interactive notebook session.

Because infrastructure issues (hardware failures, patching) can stop a running streaming job, a **retry policy** on the Spark job definition automatically restarts it — configurable for a maximum retry count (up to infinite) and the interval between retries. With a retry policy enabled and `checkpointLocation` set correctly, a streaming job resumes exactly where it left off after an unplanned restart.

The **Fabric monitoring hub** includes a dedicated **Structured Streaming** tab with metrics such as Input Rate, Process Rate, Input Rows, Batch Duration, and Operation Duration — the primary place to observe a running streaming query's health without instrumenting custom logging.

> [!warning] Common Mistake
> Running a production, always-on streaming job from an interactive notebook session and expecting the same reliability as a Spark job definition. Notebooks are optimized for iterative development; a production streaming workload needs a Spark job definition's retry policy to survive infrastructure interruptions without manual intervention.

## Native Execution Engine: No Streaming Support

The **Native Execution Engine (NEE)** — Fabric's vectorized C++ acceleration layer for Spark, covered in [01-Fabric Workspace Settings: Spark Settings](../01-fabric-workspace-settings/01-spark-settings.md) — ==does not currently support Structured Streaming at all==. This isn't a per-operator fallback situation the way JSON/XML or ANSI mode are; streaming queries simply never engage the native path, and run entirely on the standard JVM Spark engine regardless of whether NEE is enabled for the environment or workspace.

> [!warning] Common Mistake
> Enabling the native execution engine at the environment level and expecting a streaming job's write throughput to improve. NEE's performance gains apply to batch, ETL, and interactive Spark workloads over Parquet/Delta/CSV — a Structured Streaming query attached to that same environment sees no acceleration, because NEE doesn't participate in streaming execution at all.

**Practice Question 3** *(Easy)*

A team enables the native execution engine at the environment level, hoping to speed up both their nightly batch ETL notebook and their always-on Structured Streaming ingestion job. What should they expect?

A. Both workloads run faster  
B. Only the batch ETL notebook benefits — the streaming job runs on the standard JVM Spark engine regardless, since NEE doesn't support Structured Streaming  
C. Only the streaming job benefits, since NEE is optimized for continuous workloads  
D. Neither workload benefits until Runtime 2.0 is adopted  

> [!success]- Answer
> **B. Only the batch ETL notebook benefits — the streaming job runs on the standard JVM Spark engine regardless, since NEE doesn't support Structured Streaming**
>
> NEE accelerates supported batch/interactive Spark operators over Parquet/Delta/CSV; Structured Streaming queries are entirely outside its scope, with no automatic acceleration and no fallback message to notice — the streaming job simply always runs on standard JVM Spark, in both Runtime 1.3 and Runtime 2.0.

## Use Cases

- Streaming IoT telemetry from Event Hubs into a bronze Delta table with `outputMode("append")` and no aggregation
- Maintaining a live per-store running total with `outputMode("update")` over a windowed or unbounded `groupBy`
- Upserting a slowly-changing customer-profile table from a stream using `foreachBatch` + Delta `MERGE`
- Using `trigger(availableNow=True)` to run a bounded catch-up pass over everything that arrived since the last scheduled run

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Analysis exception on an aggregating query with `outputMode("append")` | `append` only supports emitting new, never-revised rows; an aggregation revises prior results | Switch to `outputMode("update")` or `outputMode("complete")`, or restructure to avoid the requirement |
| Restarted streaming job either duplicates or loses data | No `checkpointLocation` was configured | Always set `checkpointLocation`, and use a unique path per query |
| Dedup state store grows unbounded over days of operation | `dropDuplicates`/windowed `groupBy` used without a preceding `withWatermark` | Add `.withWatermark(<event-time column>, <tolerance>)` before the dedup/aggregation step |
| `MERGE` fails when called directly on a streaming DataFrame | Delta's native streaming sink doesn't support upsert semantics on write | Use `foreachBatch` to run a batch `MERGE` per micro-batch instead |
| Streaming job shows no performance change after enabling the native execution engine | NEE doesn't support Structured Streaming at all | Expect no acceleration for streaming workloads; NEE benefits apply only to batch/interactive Spark jobs in the same environment |

## Best Practices

- Always set `checkpointLocation`, with one dedicated path per streaming query
- Pair every `dropDuplicates`/windowed aggregation with a `withWatermark` call to bound state growth
- Use `foreachBatch` for any upsert/`MERGE` requirement inside a streaming pipeline
- Use `trigger(processingTime=...)` to batch writes into fewer, larger, better-compacted Delta files when a small latency increase is acceptable
- Don't enable the native execution engine expecting streaming acceleration — evaluate it for the workspace's batch workloads instead

## Exam Tips

> [!tip] Exam Tips
>
> - `append` = no revisions, no aggregation required; `update`/`complete` = require an aggregation, differ in "only changed rows" vs. "full rewrite"
> - `checkpointLocation` is mandatory for production; it tracks offsets and committed batch IDs, enabling safe restart and exactly-once-at-the-sink
> - `availableNow=True` is the batch-like "catch up and stop" trigger; continuous processing mode is not the primary Fabric pattern
> - `MERGE` requires `foreachBatch` — Delta's native streaming sink doesn't upsert directly
> - The Native Execution Engine **never** accelerates Structured Streaming — no per-operator fallback nuance, it simply doesn't apply

## Key Takeaways

- `readStream`/`writeStream` mirror the batch DataFrame API, with `checkpointLocation` and an explicit `outputMode` as the two mandatory streaming-specific settings
- Output mode choice depends on whether the query aggregates and how the sink needs to receive updates: append (no aggregation), update (changed rows), complete (full rewrite)
- Watermarks bound state growth for dedup and windowed aggregations at the cost of dropping data that arrives beyond the tolerance
- `foreachBatch` is the standard bridge between streaming ingestion and Delta `MERGE`-based upserts
- The Native Execution Engine has zero involvement in Structured Streaming workloads — plan performance expectations accordingly

## Related Topics

- [01-Choosing a Streaming Engine](./01-choosing-streaming-engine.md)
- [05-Windowing Functions](./05-windowing-functions.md)
- [01-Fabric Workspace Settings: Spark Settings](../01-fabric-workspace-settings/01-spark-settings.md)
- [05-Loading Patterns: Streaming Loading Pattern](../05-loading-patterns/03-streaming-loading-pattern.md)

## Official Documentation

- [Data streaming into a lakehouse with Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-streaming-data)
- [Native execution engine for Fabric Data Engineering](https://learn.microsoft.com/en-us/fabric/data-engineering/native-execution-engine-overview)
- [Query Microsoft Fabric Eventstream from a notebook with Spark Structured Streaming](https://learn.microsoft.com/en-us/fabric/data-engineering/notebook-with-event-stream)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-eventstreams.md) | [↑ Back to Section](./streaming-data.md) | [Next →](./04-kql-realtime.md)**
