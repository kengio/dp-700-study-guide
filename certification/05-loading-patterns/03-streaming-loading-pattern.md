---
title: Streaming Loading Pattern
type: topic
tags:
  - dp-700
  - fabric
  - loading-patterns
  - streaming
  - medallion
  - structured-streaming
  - eventhouse
---

# Streaming Loading Pattern

## Overview

Streaming data still needs a loading pattern — it just applies medallion architecture continuously instead of per-batch. This topic covers bronze/silver/gold applied to streams, why streaming writes default to append-only, dedup on ingest (watermark + `dropDuplicates` in Spark Structured Streaming, materialized-view dedup in Eventhouse), a landing-zone preview (Eventstream → Lakehouse vs. Eventstream → Eventhouse — full engine-choice coverage lives in [08-Streaming Data](../08-streaming-data/streaming-data.md)), micro-batch vs. continuous processing, and exactly-once vs. at-least-once semantics across Fabric's streaming surfaces.

> [!abstract]
>
> - Medallion applies to streams the same way it applies to batch: **bronze** = raw append-only landing, **silver** = cleansed and deduplicated, **gold** = business-level aggregates
> - Streaming writes into Delta almost always use `outputMode("append")` — upserts and aggregation happen downstream, not in the streaming write itself
> - Dedup on ingest uses **watermark + `dropDuplicates`** in Spark Structured Streaming, or a **materialized view** (`arg_max`-style) in Eventhouse
> - Eventstream can land data in a **Lakehouse** (Delta, Spark-native) or an **Eventhouse** (KQL, sub-second query latency) — the full decision matrix for that choice lives in Section 08
> - Fabric's streaming surfaces default to **at-least-once** delivery; **exactly-once** at the sink requires checkpointing plus an idempotent write (Delta `MERGE`/dedup, or Eventhouse dedup)

> [!tip] What the Exam Tests
>
> - Mapping medallion layers to the right Fabric technology for a streaming scenario
> - Recognizing why streaming writes default to append, and where the upsert/aggregation step actually happens
> - Implementing dedup on ingest with `dropDuplicates` + watermark (Spark) or a materialized view (Eventhouse)
> - Distinguishing micro-batch triggers (`processingTime`, `availableNow`) from continuous processing, and at-least-once from exactly-once semantics

---

## Medallion Architecture Applied to Streams

| Layer | Streaming role | Typical Fabric technology |
| :--- | :--- | :--- |
| **Bronze** | Raw events landed as received, minimal parsing, append-only | Eventstream default destination into a Lakehouse Delta table, or a raw Eventhouse table |
| **Silver** | Cleansed, conformed, **deduplicated** — still near-real-time | Spark Structured Streaming with watermark + `dropDuplicates`, or an Eventhouse update policy transforming raw → conformed |
| **Gold** | Aggregated, business-level, ready for consumption | A scheduled/triggered Delta `MERGE` aggregation job, or a KQL **materialized view** in Eventhouse |

Real-Time Intelligence in Fabric documents this same bronze/silver/gold refinement explicitly for Eventhouse-based pipelines — raw ingested tables refine into update-policy-derived tables, which refine again into materialized views for consumption.

> [!note] Mental model
> Medallion for streams is the same **refinery pipeline** as medallion for batch — crude data goes in one end, gets progressively cleaned and refined at each stage, and only the refined product at the far end is meant for direct consumption. The only difference streaming adds is that the refinery never stops running.

## Append-Only Ingestion

Streaming writes into a Delta table are written with `outputMode("append")` — new micro-batches add new files, and matching/upserting is deliberately **not** part of the streaming write itself:

```python
rawEvents = (
    spark.readStream
    .format("eventhubs")
    .options(**ehConf)
    .load()
)

parsed = (
    rawEvents
    .withColumn("bodyAsString", F.col("body").cast("string"))
    .select(F.from_json("bodyAsString", eventSchema).alias("e"))
    .select("e.*")
)

(parsed.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/bronze_events")
    .outputMode("append")
    .toTable("bronze.raw_events"))
```

Bronze almost always stays append-only by design — it's the raw, replayable record. Any upsert or aggregation semantics that a business scenario needs are applied **downstream** of the streaming write, typically via a micro-batch `foreachBatch` callback that runs a Delta `MERGE` against a silver or gold table, or via an Eventhouse update policy/materialized view layered on top of a raw table.

## Dedup on Ingest

### Spark Structured Streaming: Watermark + `dropDuplicates`

```python
from pyspark.sql import functions as F

deduped = (
    parsed
    .withWatermark("event_time", "10 minutes")   # bounds how long state is retained
    .dropDuplicates(["event_id", "event_time"])   # dedup key, scoped by the watermark
)

(deduped.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/silver_events")
    .outputMode("append")
    .toTable("silver.events"))
```

The watermark tells Structured Streaming how long to keep state for deduplication before discarding it — without one, `dropDuplicates` on an unbounded stream would keep every seen key in state forever, growing without limit. A 10-minute watermark means a duplicate arriving more than 10 minutes late (relative to the latest seen `event_time`) is no longer guaranteed to be caught.

### Eventhouse: Materialized-View Dedup

Materialized views in a KQL database deduplicate records as they arrive, using an `arg_max`/`summarize`-style aggregation over a raw ingestion table, and make deduplicated rows immediately available for query:

```kql
.create materialized-view DedupedEvents on table RawEvents
{
    RawEvents
    | summarize arg_max(ingestion_time(), *) by event_id
}
```

`arg_max(ingestion_time(), *)` keeps only the latest-ingested row per `event_id`, which is the KQL equivalent of Structured Streaming's `dropDuplicates` — the difference is that a materialized view continuously maintains this deduplicated result set as new rows land, rather than deduplicating within a bounded streaming window.

> [!warning] Common Mistake
> Enabling **query acceleration** on a OneLake shortcut into an Eventhouse and then trying to layer a materialized view or update policy on top of it. Accelerated external delta tables behave like standard external tables with the same limitations — **materialized views and update policies aren't supported on them**. Dedup against shortcut-accelerated data needs to happen at query time (e.g., `arg_max` in the query itself), not via a materialized view.

**Practice Question 1** *(Medium)*

A Structured Streaming job ingests IoT events and applies `dropDuplicates(["device_id", "reading_id"])` with no `.withWatermark(...)` call beforehand. The job runs correctly at first but its state store grows unbounded over several days of continuous operation. What's the most likely fix?

A. Switch `dropDuplicates` to a batch job instead of streaming  
B. Add `.withWatermark("event_time", "<duration>")` before `dropDuplicates`, so old dedup state can be safely expired instead of retained forever  
C. Increase the cluster's memory instead of changing the code  
D. Remove `dropDuplicates` entirely — streaming sources never send duplicates  

> [!success]- Answer
> **B. Add `.withWatermark("event_time", "<duration>")` before `dropDuplicates`, so old dedup state can be safely expired instead of retained forever**
>
> Without a watermark, Structured Streaming has no signal for when it's safe to forget a previously-seen key, so the dedup state store grows without bound as the stream runs. A watermark on an event-time column tells the engine how late a duplicate can arrive and still be caught, after which older state can be dropped — bounding memory/state usage while still catching duplicates within the tolerated lateness window.

## Landing-Zone Patterns: Eventstream Destination Preview

Eventstream can route the same incoming data to different destinations depending on what the consuming workload needs:

| Destination | Best for | Tradeoff |
| :--- | :--- | :--- |
| **Lakehouse** (Delta table) | Batch analytics, ML feature engineering, anything consumed by Spark/notebooks downstream | Query latency is Spark-job-scale (seconds to minutes), not sub-second |
| **Eventhouse** (KQL database) | Sub-second time-series queries, high-cardinality event exploration, dashboards | KQL-specific skillset; not the natural fit for heavy Spark/ML workloads |

This is a preview of the choice only — the full decision matrix by source type, latency requirement, and transform complexity is covered in [08-Streaming Data: Choosing a Streaming Engine](../08-streaming-data/01-choosing-streaming-engine.md).

## Micro-Batch vs. Continuous

By default, Spark Structured Streaming processes data in **micro-batches**, starting the next batch as soon as the previous one completes. This is tunable:

| Trigger | Behavior |
| :--- | :--- |
| Default (no `.trigger(...)` call) | Micro-batch, as fast as the previous batch allows |
| `.trigger(processingTime="1 minute")` | Fixed-interval micro-batch — accumulates data and writes in fewer, larger operations |
| `.trigger(availableNow=True)` | Processes all currently-available data as a bounded set of micro-batches, then stops — a batch-like "catch up and finish" run |
| Continuous processing mode | An experimental, low-latency mode with a much smaller supported operator set; not the primary documented pattern for Fabric streaming workloads |

```python
(deduped.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/silver_events")
    .outputMode("append")
    .trigger(processingTime="1 minute")
    .toTable("silver.events"))
```

Batching writes with a fixed `processingTime` interval trades a small amount of latency for materially larger, better-compacted Delta files — reducing the small-file overhead that unbatched micro-batch writes tend to accumulate.

## Exactly-Once vs. At-Least-Once Semantics

| Layer | Default delivery guarantee | How to reach effectively-once |
| :--- | :--- | :--- |
| **Eventstream / Event Hubs ingestion** | At-least-once — a redelivered or retried event can be re-ingested | Dedup downstream: `dropDuplicates` (Spark) or `arg_max` materialized view (Eventhouse) |
| **Spark Structured Streaming → Delta** | Exactly-once **at the sink**, when checkpointing is enabled and the sink write is idempotent (Delta's transaction log tracks committed batch IDs) | Always set `checkpointLocation`; never write to a non-idempotent sink without additional dedup |
| **Eventhouse raw ingestion** | At-least-once | Materialized view dedup, or `arg_max` in the consuming query |

> [!note] Mental model
> Think of at-least-once as a **postal service that occasionally delivers the same letter twice** rather than losing it — safe by default, but the recipient (your dedup step) has to recognize and discard the duplicate. Exactly-once at the Delta sink works because the **checkpoint is the recipient's receipt log**: Spark records which batch IDs it has already committed, so replaying a batch after a failure is recognized and skipped rather than double-applied.

> [!warning] Common Mistake
> Assuming "exactly-once" describes the entire streaming pipeline end-to-end. Structured Streaming's exactly-once guarantee is specifically about the **checkpoint-to-sink** relationship for a supported, idempotent sink like Delta — it says nothing about whether the *source* (Eventstream, Event Hubs, Kafka) redelivered the same event twice upstream. A scenario describing duplicate events reaching a Delta table despite checkpointing usually means the dedup step (`dropDuplicates` or a business-key `MERGE`) is missing, not that checkpointing failed.

**Practice Question 2** *(Hard)*

A streaming pipeline reads from Eventstream, writes to a Delta table with `checkpointLocation` configured and `outputMode("append")`, and the team asserts the pipeline is "exactly-once end to end." A downstream audit finds a small number of duplicate event IDs in the Delta table. What's the most likely explanation?

A. Delta tables can never guarantee exactly-once writes, so this is expected  
B. The checkpoint-to-Delta-sink relationship is exactly-once for the write itself, but Eventstream's at-least-once delivery upstream can redeliver the same event, and no dedup step (`dropDuplicates`/`MERGE`) was applied to catch it  
C. `outputMode("append")` is incompatible with checkpointing  
D. The checkpoint location is misconfigured and needs to point at the Delta table's own path  

> [!success]- Answer
> **B. The checkpoint-to-Delta-sink relationship is exactly-once for the write itself, but Eventstream's at-least-once delivery upstream can redeliver the same event, and no dedup step (`dropDuplicates`/`MERGE`) was applied to catch it**
>
> Checkpointing makes the Structured Streaming job's *own* batch processing idempotent — a replayed micro-batch after a failure won't be double-applied. It does nothing about the upstream source redelivering the same logical event as two distinct messages, which Eventstream's at-least-once guarantee explicitly allows. Without a `dropDuplicates`/watermark step (or a downstream `MERGE` keyed on the business event ID), upstream redelivery surfaces as genuine duplicate rows in the sink.

**Practice Question 3** *(Easy)*

A team needs a streaming bronze layer that's cheap to write, replayable, and never rejects or transforms incoming events — just lands them as received. Which write pattern fits?

A. Delta `MERGE INTO` keyed on a business key  
B. `outputMode("append")` with no dedup or transformation applied  
C. `outputMode("complete")` with a full aggregation  
D. A KQL materialized view as the landing target  

> [!success]- Answer
> **B. `outputMode("append")` with no dedup or transformation applied**
>
> A bronze layer's entire purpose is to be the raw, replayable record of what arrived — append-only writes with minimal parsing satisfy exactly that. `MERGE INTO` and aggregation belong at silver/gold, once the data needs deduplication or business-level shaping; a materialized view is a KQL-side refinement mechanism, not a raw landing target.

## Use Cases

- Landing IoT telemetry into a bronze Delta table with `outputMode("append")`, then deduplicating into a silver table with `withWatermark` + `dropDuplicates`
- Building a KQL materialized view over a raw Eventhouse ingestion table to serve deduplicated, immediately-queryable events to a real-time dashboard
- Choosing `trigger(processingTime="1 minute")` over the default trigger to produce fewer, larger, better-compacted Delta files for a moderate-latency-tolerant workload
- Recognizing that a duplicate-row audit finding points to a missing downstream dedup step, not a checkpointing failure

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Streaming dedup state store grows unbounded | `dropDuplicates` used with no preceding `withWatermark` call | Add a watermark on an event-time column so old dedup state can expire |
| Duplicate rows in a Delta sink despite checkpointing | Checkpointing guarantees exactly-once at the sink, not upstream — the source redelivered the same event | Add `dropDuplicates`/watermark, or a downstream `MERGE` keyed on the business event ID |
| Materialized view creation fails on an accelerated OneLake shortcut | Materialized views and update policies aren't supported on query-acceleration-enabled external tables | Deduplicate at query time (`arg_max` in the query) instead of via a materialized view, or ingest natively into Eventhouse instead of shortcut-accelerating |
| Streaming write produces many small Delta files | No trigger interval set, so each micro-batch writes a small, unbatched file | Add `trigger(processingTime="<interval>")` to batch writes into fewer, larger files |
| A silver-layer streaming table unexpectedly has upsert/aggregation logic embedded directly in the streaming write | Confusing the streaming write step with the downstream refinement step | Keep the streaming write append-only; apply `MERGE`/aggregation in a separate `foreachBatch` step or scheduled job |

## Best Practices

- Keep bronze append-only and unopinionated; push transformation, dedup, and upserts to silver/gold
- Always pair `dropDuplicates` with `withWatermark` in a streaming job to bound state growth
- Use a fixed `processingTime` trigger when a small latency tradeoff is acceptable, to avoid excessive small-file writes
- Treat "exactly-once" as scoped to the checkpoint-to-sink relationship, not the whole pipeline — always add an explicit dedup step if the source can redeliver
- Prefer query-time dedup (`arg_max`) over materialized views when the source table is a query-acceleration-enabled OneLake shortcut, since materialized views aren't supported there

## Exam Tips

> [!tip] Exam Tips
>
> - Medallion for streams: bronze = raw append-only, silver = deduped/conformed, gold = aggregated/business-level
> - Streaming writes to Delta default to `outputMode("append")`; `MERGE`/aggregation happen downstream, not in the streaming write
> - `dropDuplicates` needs a preceding `withWatermark` to bound state — without one, state grows unbounded
> - Eventhouse materialized views dedup via `arg_max`-style `summarize`; they are **not** supported on query-acceleration-enabled OneLake shortcuts
> - Checkpointing gives exactly-once at the Delta sink, not end-to-end — upstream at-least-once redelivery still needs an explicit dedup step

## Key Takeaways

- Medallion architecture applies to streams the same way it does to batch, just continuously — bronze/silver/gold map to append-only landing, deduped/conformed data, and business-level aggregates respectively
- Streaming writes default to append; upserts and aggregation are a downstream concern, via `foreachBatch` + `MERGE` or an Eventhouse materialized view
- Dedup on ingest needs watermark + `dropDuplicates` in Spark, or a materialized view (`arg_max`) in Eventhouse — the latter isn't supported on accelerated shortcuts
- Eventstream can land in a Lakehouse or an Eventhouse; the full engine-choice decision matrix is covered in Section 08
- Fabric's streaming surfaces are at-least-once by default; exactly-once is a checkpoint-to-idempotent-sink property, not an end-to-end guarantee

## Related Topics

- [01-Full vs. Incremental Loads](./01-full-incremental-loads.md)
- [02-Dimensional Model Loading](./02-dimensional-model-loading.md)

## Official Documentation

- [Data streaming into a lakehouse with Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-streaming-data)
- [Query Microsoft Fabric Eventstream from a notebook with Spark Structured Streaming](https://learn.microsoft.com/en-us/fabric/data-engineering/notebook-with-event-stream)
- [Create and edit materialized views](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/materialized-view)
- [Implement medallion architecture in Real-Time Intelligence](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/architecture-medallion)
- [Query acceleration for OneLake shortcuts - overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/query-acceleration-overview)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-dimensional-model-loading.md) | [↑ Back to Section](./loading-patterns.md) | [Next →](../06-batch-ingestion/batch-ingestion.md)**
