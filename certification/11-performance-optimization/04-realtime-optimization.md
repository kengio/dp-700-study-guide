---
title: Real-Time Optimization
type: topic
tags:
  - dp-700
  - fabric
  - performance-optimization
  - eventhouse
  - eventstream
  - kql
  - real-time-intelligence
---

# Real-Time Optimization

## Overview

Eventhouse and Eventstream performance tuning revolves around two independent policy knobs (caching and retention), an ingestion-path tradeoff (streaming vs. queued), and a small number of capacity/scaling settings that most workloads never need to touch manually. This topic covers the performance angle of each; the underlying mechanics of ingestion, native tables vs. shortcuts, query acceleration, and OneLake availability are already covered in depth in [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md) and are cross-linked rather than repeated here.

> [!abstract]
>
> - **Caching policy** (hot cache) and **retention policy** are independent — caching controls what stays fast (local SSD), retention controls what still exists at all (soft-delete horizon) — both default to **3,650 days**
> - Streaming ingestion trades per-event overhead for low latency; queued ingestion trades a small batching delay for far better throughput at scale
> - **Materialized views** cost continuous background compute (CU) to stay current; **update policies** fold their cost into the ingestion path itself, running once per incoming event
> - Eventstream CU consumption autoscales with the **event throughput level**, transform complexity, and **input partition count** — not a fixed allocation
> - Filtering early on `ingestion_time`/timestamp columns lets KQL's implicit extent-level time indexing skip whole extents before scanning rows

> [!tip] What the Exam Tests
>
> - Distinguishing caching policy from retention policy and picking the right one for a given symptom (slow queries on old data vs. data disappearing entirely)
> - Choosing streaming vs. queued ingestion based on latency/throughput requirements
> - Reasoning about the cost tradeoff between materialized views and update policies
> - Knowing what makes a KQL query efficient (time-filter pushdown, avoiding cross-cluster joins) vs. what silently degrades it

---

## Eventhouse: Caching Policy vs. Retention Policy

These two policies are frequently confused because they're both configured from the same **Manage → Data policies** screen on a KQL database, and both default to the same number — but they control entirely different things.

| Policy | Controls | Default | Effect when data ages past the threshold |
| :--- | :--- | :--- | :--- |
| **Caching policy** | Which data stays on local SSD ("hot cache") for fast query access | 3,650 days | Data moves to cold storage (cheaper, reliable, slower to query) — still queryable, just slower |
| **Retention policy** | How long data exists in the table/materialized view at all (`SoftDeletePeriod`) | 3,650 days (max 36,500 days) | Data is **permanently removed** — no longer queryable at any speed |

Both are set per-database (or per-table) via `.alter-merge` policy commands or the portal's Data policies UI, and both can be set to **Unlimited**.

> [!note] Mental model — hot/cold cache vs. retention
> Caching policy is a **thermostat**: it decides how much of your data's *history* stays warm (fast) versus goes cold (slower but still there). Retention policy is a **shredder**: it decides how much history *exists* at all. You can have a short cache window and long retention (recent data fast, old data slow-but-queryable — cost-optimized for occasional historical lookups) or the reverse relationship never makes sense the other way: retention can't be shorter than what you'd want cached, because once retention purges data, there's nothing left to cache.

Performance-tuning implication: if dashboards or alerts only ever query the last 7 days of data but the caching policy is left at the 3,650-day default, you're paying SSD cost to keep years of rarely-queried data hot for no query-latency benefit. Right-sizing the caching policy to match actual query patterns (not the retention requirement) is the actual lever — shrinking retention is a data-lifecycle decision, not a performance one.

> [!warning] Common Mistake
> Shortening the **retention** policy to try to speed up queries. Retention doesn't control query speed at all — it controls whether data exists. A team trying to improve dashboard performance by trimming retention to 30 days will find queries against the last 7 days unaffected (they were already fast, within the hot cache) while permanently losing everything older than 30 days for no performance gain. The caching policy is the actual query-speed lever.

## Streaming vs. Queued Ingestion: Performance Tradeoff

Full ingestion-method mechanics are covered in [08-Streaming Data: KQL Real-Time — Ingestion Methods](../08-streaming-data/04-kql-realtime.md#ingestion-methods-streaming-vs-queued). The performance-specific summary:

| Ingestion mode | Latency | Throughput | Per-event overhead | Best fit |
| :--- | :--- | :--- | :--- | :--- |
| **Streaming** | Sub-second to low seconds | Lower ceiling | Higher — each small batch is committed individually | Low-to-moderate event rates where latency matters more than raw throughput |
| **Queued** | Seconds to minutes (batched) | Much higher ceiling | Lower — batching amortizes commit overhead across many events | High-volume ingestion where a small latency tax is acceptable for efficiency at scale |

The practical decision rule: as event volume grows, queued ingestion's batching efficiency matters more than streaming's latency advantage — a table ingesting a handful of events per second rarely justifies the overhead tradeoff that streaming's low latency costs at scale.

## Materialized Views vs. Update Policies: Cost Profile

Both mechanisms transform or aggregate data automatically, but their compute cost lands in different places — this is the performance-relevant distinction beyond the syntax/use-case coverage in [07-Batch Transformation: KQL Transformations](../07-batch-transformation/04-kql-transformations.md) and [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md#update-policies-and-materialized-views-for-streaming-transform).

| Mechanism | When it runs | Where the cost lands | Typical use |
| :--- | :--- | :--- | :--- |
| **Update policy** | Once per ingested batch, synchronously as part of ingest | Folded into the ingestion path — every event pays a small transform cost | Parsing, typing, enriching raw events as they land (no aggregation state to maintain) |
| **Materialized view** | Continuously, as a background aggregation process | Dedicated, ongoing background CU consumption, independent of query volume | Deduplication (`arg_max`) or a rolling aggregate that many queries read repeatedly, so paying the aggregation cost once (in the background) is cheaper than every querier re-aggregating raw data |

> [!note] Mental model — pay-per-event vs. pay-standing
> An update policy is like **tipping per delivery** — a small, predictable cost added to every single event as it arrives. A materialized view is like **a subscription service** — a standing background cost that exists whether or not anyone queries it right now, justified because it saves *every* querier from redoing the same aggregation work. A high-read, low-cardinality-of-queries-per-event workload favors materialized views; a low-read, transform-only workload favors update policies.

Both mechanisms require the source to be a **native table** — this constraint (already covered in the streaming-context discussion) matters for performance planning too: you can't apply an update policy or materialized view directly against an accelerated OneLake shortcut, so a hybrid architecture (native ingestion table feeding a shortcut-backed archive) needs its transform/aggregation layer built on the native side.

**Practice Question 1** *(Medium)*

An Eventhouse table receives 50,000 events per minute. A dashboard repeatedly queries a rolling 5-minute deduplicated count against this table, and the query is currently re-running a full `arg_max` deduplication over raw data on every refresh. What change reduces both query latency and overall compute cost?

A. Switch ingestion from queued to streaming to reduce data volume  
B. Replace the per-query `arg_max` deduplication with a materialized view that maintains the deduplicated aggregate continuously in the background, so dashboard queries read the pre-aggregated result instead of re-computing it  
C. Add an update policy that runs the `arg_max` deduplication once per ingested batch  
D. Shorten the caching policy to reduce the volume of hot data being scanned  

> [!success]- Answer
> **B. Replace the per-query arg_max deduplication with a materialized view that maintains the deduplicated aggregate continuously in the background, so dashboard queries read the pre-aggregated result instead of re-computing it**
>
> A materialized view is exactly the mechanism designed for this pattern: high-read, repeated-aggregation workloads where paying the aggregation cost once in the background (continuously, incrementally) beats every dashboard refresh re-scanning and re-deduplicating raw data. Switching ingestion mode (A) doesn't reduce query-time deduplication cost. An update policy (C) runs per-ingested-batch, not as a maintained rolling aggregate a dashboard can read directly — it doesn't solve repeated re-aggregation at query time the way a materialized view does. Shortening caching policy (D) would make the query's raw-data scan cost *worse*, not better, since data would fall out of hot cache sooner.

## Partitioning Policy

An Eventhouse table's partitioning policy controls how the engine organizes extents (the underlying storage unit) beyond the default time-based extent grouping that happens automatically from ingestion order. Configured via `.alter-merge table policy partitioning`, an explicit partitioning policy groups extents by a specified key (commonly a high-cardinality identifier used in frequent point-lookup or filter queries), trading extra ingestion/indexing overhead for faster filtered queries at very high scale.

- **Default**: no explicit partitioning policy — extents are grouped primarily by ingestion time, and time-range filters already prune effectively without any extra configuration
- **When to add one**: very high-scale tables where queries filter heavily on a specific non-time column (a tenant ID, device ID) and time-based pruning alone isn't selective enough
- **Cost**: additional indexing work at ingestion time — not a free performance win, so it's reserved for tables where the query-side benefit clearly outweighs it

Most exam-relevant Eventhouse performance scenarios rely on the *default* time-based extent organization rather than a custom partitioning policy — treat an explicit partitioning policy as a targeted, high-scale optimization rather than a default recommendation.

## Query Best Practices

- **Filter early on `ingestion_time` or the table's timestamp column.** KQL extents carry implicit time-range metadata from ingestion order, so a time-bounded filter early in the query lets the engine skip whole extents before scanning any rows — the single highest-leverage query optimization available with zero configuration.
- **Avoid unbounded time ranges.** A query with no time filter (or an extremely wide one) forces a scan across the entire retention window's extents, defeating the pruning benefit above.
- **Avoid cross-cluster/cross-database queries where possible.** Federated queries move data across the network to a coordinating node before it can be processed together, which is inherently more expensive than a query scoped to a single database's own extents.
- **Push aggregation into materialized views for repeated dashboard queries** rather than re-aggregating raw data on every refresh (see comparison above).
- **Project only the columns a query actually needs**, as early as possible in the pipeline. KQL's columnar storage means unreferenced columns are cheap to skip, but only if the query doesn't carry them through unnecessary intermediate steps first.

```kql
// Good: time filter first, then narrow columns, then the business filter
Events
| where Timestamp between (ago(1h) .. now())
| project Timestamp, DeviceId, Value
| where DeviceId == "sensor-042"
```

> [!warning] Common Mistake
> Writing a KQL query that filters on a business column (`customer_id == "X"`) but omits a time-range filter, assuming the engine will "figure out" the relevant window from context. Without an explicit time filter, KQL has no basis to skip extents by time — it scans the full retention window's data (however large that's grown to be) before the non-time filter is even applied. Always lead with the tightest reasonable time bound the query logic allows.

## OneLake Availability: Performance Cost Recap

Full mechanics live in [08-Streaming Data: KQL Real-Time — OneLake Availability](../08-streaming-data/04-kql-realtime.md#onelake-availability-of-eventhouse-data). The performance-relevant summary: enabling OneLake availability doesn't slow down ingestion into the Eventhouse itself — the adaptive batching mechanism that delays the OneLake Delta copy (up to 3 hours by default, configurable down to a 5-minute floor via `TargetLatencyInMinutes`) runs asynchronously specifically to avoid producing many small, inefficient Parquet files in OneLake. The performance tradeoff is entirely on the *consumption* side: a shorter `TargetLatencyInMinutes` gets fresher data into OneLake sooner, at the cost of smaller, less-optimal Parquet files for anything reading that OneLake copy (Spark, SQL endpoint, Direct Lake) — directly echoing the small-file tradeoffs covered in [01-Lakehouse Optimization](01-lakehouse-optimization.md).

## Query Acceleration for Shortcuts: Recap

Query acceleration (caching an external shortcut's data at native-table speed) is covered in full — including the 900-column limit, 2.5-million-file degradation threshold, 6 GB per-file cache exclusion, and the Hot-property billing model — in [08-Streaming Data: KQL Real-Time — Query Acceleration](../08-streaming-data/04-kql-realtime.md#query-acceleration-limitations-and-billing). The one-line performance framing for this section: query acceleration is the lever when a workload needs native-table query speed against data that must physically live outside the Eventhouse (a OneLake shortcut or external source) — without it, shortcut-backed tables query at the underlying source's native speed, not Eventhouse-native speed.

## Eventstream: Throughput Units and Scaling

Fabric recommends a minimum of **F4 capacity** for eventstreams workloads. Scaling is governed by the **event throughput setting** (Low/Medium/High), which optimizes performance for the eventstream's sources and destinations, combined with automatic CU autoscaling as traffic grows.

For the Eventstream Processor specifically, CU consumption correlates with three factors together — event traffic throughput, transform/processing logic complexity, and the input data's partition count. At the **Low** throughput setting, the processor's CU rate starts at one-third of a base rate (0.778 CU-hours) and autoscales upward through two-thirds base (1.555), one base (2.333), two bases, and four bases as load increases.

| Source type | Throughput ceiling |
| :--- | :--- |
| Generic streaming connector sources | Up to 30 MB/s |
| Azure Event Hubs, source partition count < 4 | **Bottlenecked by partition count**, regardless of the selected throughput level |
| Azure Event Hubs, source partition count 4/16/32 | Throughput depends on the selected level (Low/Medium/High) |

> [!warning] Common Mistake
> Raising the Eventstream's throughput level to fix low ingestion speed from an Azure Event Hubs source with fewer than 4 partitions. Below 4 source partitions, **partition count is the bottleneck**, not the selected throughput level — increasing the throughput setting does nothing until the Event Hub itself is repartitioned to 4 or more partitions.

## Processor Operator Efficiency and Destination Batching

- **Processor operator efficiency**: every added transform operator (filters, aggregations, enrichments) in an Eventstream's processing pipeline increases CU consumption on top of the base throughput-driven rate. Keeping the operator graph as simple as the use case allows, and aligning input partition count to actual throughput needs, keeps CU cost proportional to genuine processing work rather than pipeline complexity.
- **Destination batching**: Eventstream destinations (Eventhouse, Lakehouse, Warehouse, etc.) batch incoming events before committing them, for the same reason Delta's optimize write batches records before writing Parquet files — fewer, larger writes at the destination instead of many small ones. This is conceptually the same small-write-avoidance pattern covered for Delta tables in [01-Lakehouse Optimization](01-lakehouse-optimization.md#the-small-file-problem), applied at the streaming-destination layer instead of the Spark-write layer.

**Practice Question 2** *(Easy)*

An Eventstream ingests from an Azure Event Hubs source configured with 2 partitions. Despite setting the Eventstream's event throughput level to High, ingestion throughput doesn't improve. What's the most likely explanation?

A. The Eventhouse destination's caching policy is too short  
B. With fewer than 4 source partitions, Event Hubs throughput is bottlenecked by partition count regardless of the selected throughput level — the Event Hub needs more partitions  
C. Materialized views are consuming all available CU  
D. The Eventstream needs to switch from streaming to queued ingestion  

> [!success]- Answer
> **B. With fewer than 4 source partitions, Event Hubs throughput is bottlenecked by partition count regardless of the selected throughput level — the Event Hub needs more partitions**
>
> This is documented, specific behavior: when an Azure Event Hubs source has fewer than 4 partitions, that partition count — not the Eventstream's throughput level setting — is the limiting factor. Caching policy (A) affects Eventhouse query speed, not Eventstream ingestion throughput. Materialized views (C) and streaming-vs-queued ingestion mode (D) are unrelated to Event Hubs source-side partition bottlenecks.

## Decision Guidance: Symptom → Lever

| Symptom | Most likely lever | Why |
| :--- | :--- | :--- |
| Queries against recent data are fast, queries against old data are slow but still return results | Caching policy too short for the query pattern | Old data has fallen to cold storage; widen the caching window if that history is queried often |
| Data older than expected is simply gone | Retention policy | Retention permanently purges past its threshold — not a query-speed issue |
| Same aggregation re-computed on every dashboard refresh | Materialized view | Moves the aggregation cost to a continuous background process instead of every query |
| High per-event ingest cost with simple parsing/enrichment logic | Update policy (already the right tool) | Confirm the transform logic itself isn't doing more work than necessary per event |
| KQL query scans much more data than expected | Missing or late time-range filter | Lead the query with the tightest reasonable time bound |
| Eventstream throughput plateaus despite raising the throughput level | Event Hubs source partition count < 4 | Partition count bottlenecks throughput below the throughput-level setting's ceiling |
| High-cardinality non-time filter queries are slow at very large table scale | Missing Eventhouse partitioning policy | Consider an explicit partitioning policy, weighing the added ingestion/indexing cost |

**Practice Question 3** *(Easy)*

A KQL database's caching policy is set to 30 days and its retention policy is set to 3,650 days (the default). A query filtering for data from 6 months ago returns results, but noticeably slower than an equivalent query against the last week's data. What explains this?

A. The retention policy has purged the 6-month-old data, so the query is scanning empty extents  
B. The 6-month-old data has aged out of the 30-day hot cache into cold storage; it's still within the 3,650-day retention window so it's queryable, just slower to access than cached data  
C. The query needs a `ZORDER BY` clause to speed up  
D. Materialized views need to be enabled on the table  

> [!success]- Answer
> **B. The 6-month-old data has aged out of the 30-day hot cache into cold storage; it's still within the 3,650-day retention window so it's queryable, just slower to access than cached data**
>
> This is exactly the caching-vs-retention distinction: a 30-day caching policy only keeps the most recent 30 days on fast local SSD, while the 3,650-day retention policy means data far older than that is still queryable — from cold storage, which is slower. If retention had purged the data (A), the query would return no rows at all rather than slower ones. `ZORDER BY` (C) is a Delta Lake/Spark concept, not a KQL/Eventhouse one. Materialized views (D) address repeated-aggregation cost, not raw cold-storage read latency.

## Use Cases

- Diagnosing "queries against old data are slow" as a caching-policy problem vs. "old data is missing entirely" as a retention-policy problem
- Choosing streaming vs. queued ingestion for a new Eventhouse table based on expected event rate and latency tolerance
- Deciding between an update policy and a materialized view for a new streaming transform, based on read frequency vs. write frequency
- Diagnosing an Eventstream throughput ceiling that doesn't respond to the throughput-level setting back to Event Hubs source partition count
- Tuning `TargetLatencyInMinutes` on OneLake availability against the small-file cost of a shorter batching window

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Dashboard performance unchanged after shortening retention policy | Retention controls data existence, not query speed | Adjust the caching policy instead — retention is a data-lifecycle decision |
| Dashboard re-runs full deduplication on every refresh, high query latency and cost | No materialized view backing a repeated aggregation query | Create a materialized view for the deduplicated/aggregated result |
| Eventstream ingestion throughput plateaus despite raising the throughput level | Azure Event Hubs source has fewer than 4 partitions | Increase Event Hubs source partition count |
| KQL query scans far more data than expected | No time-range filter, or filter applied late in the query pipeline | Lead the query with the tightest reasonable time-range filter |
| OneLake copy of Eventhouse data lags behind ingestion | Adaptive batching's default up-to-3-hour delay, by design | Lower `TargetLatencyInMinutes` if fresher availability is required, accepting smaller/less-optimal Parquet files |

## Best Practices

- Size the caching policy to actual query patterns, not the retention requirement — they're independent decisions
- Default to queued ingestion at scale; reserve streaming for genuinely latency-sensitive, lower-volume tables
- Favor materialized views for aggregations read repeatedly by many queries; keep update policies for per-event transform/enrichment work
- Always lead KQL queries with a time-range filter before other predicates
- Only add an explicit Eventhouse partitioning policy when default time-based extent pruning genuinely isn't selective enough for a high-scale, non-time filter pattern

## Exam Tips

> [!tip] Exam Tips
>
> - Caching policy = query speed (hot/cold), retention policy = data existence (soft-delete) — both default to **3,650 days**, independently configurable
> - Materialized views = continuous background CU cost, best for repeated-read aggregations; update policies = per-ingest cost, best for per-event transforms
> - Eventstream Processor CU autoscales by throughput level, transform complexity, and **input partition count**; Event Hubs sources with **< 4 partitions** are partition-bottlenecked regardless of throughput level setting
> - KQL's biggest free performance win: filter on time first, to exploit extent-level time pruning
> - Eventhouse partitioning policy is an opt-in, high-scale optimization on top of the default time-based extent grouping — not a default recommendation

## Key Takeaways

- Caching and retention policies are independent levers that are frequently confused because they share a UI and a default value
- The streaming-vs-queued and materialized-view-vs-update-policy decisions are both throughput/cost tradeoffs, not correctness questions — either choice works, but one costs more at a given scale
- Eventstream throughput is gated by source partition count as much as by the throughput-level setting, especially for low-partition-count Event Hubs sources
- KQL time-filter pushdown is the single highest-leverage, zero-configuration query optimization available
- OneLake availability's batching delay and Eventhouse partitioning policy both echo the same core pattern seen in [01-Lakehouse Optimization](01-lakehouse-optimization.md): batching writes trades freshness for file/extent health

## Related Topics

- [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md)
- [08-Streaming Data: Eventstreams](../08-streaming-data/02-eventstreams.md)
- [01-Lakehouse Optimization](01-lakehouse-optimization.md)
- [10-Error Resolution: Realtime Errors](../10-error-resolution/03-realtime-errors.md)

## Official Documentation

- [Change data policies in Real-Time Intelligence](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-policies)
- [Caching policy (hot and cold cache) — Kusto](https://learn.microsoft.com/en-us/kusto/management/cache-policy?view=microsoft-fabric)
- [Microsoft Fabric Eventstreams overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/overview)
- [Configure settings for a Fabric eventstream](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/configure-settings)
- [Turn on OneLake availability for an eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-house-onelake-availability)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](03-spark-optimization.md) | [↑ Back to Section](./performance-optimization.md) | [Next →](05-pipeline-query-optimization.md)**
