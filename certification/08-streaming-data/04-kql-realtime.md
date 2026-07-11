---
title: KQL Real-Time
type: topic
tags:
  - dp-700
  - fabric
  - streaming-data
  - kql
  - eventhouse
  - onelake-shortcuts
  - query-acceleration
  - materialized-views
  - update-policy
---

# KQL Real-Time

## Overview

Eventhouse is Fabric's native real-time query engine, and this topic covers the KQL-specific side of "implement a streaming solution": the two Eventhouse ingestion methods (streaming vs. queued), the decision between native tables and OneLake shortcuts for data that already lives elsewhere, the ==generally available== query acceleration policy that closes most of the performance gap between the two, update policies and materialized views as Eventhouse's own streaming-transform mechanisms, and how Eventhouse data becomes available to the rest of Fabric through OneLake availability.

> [!abstract]
>
> - **Streaming ingestion** writes data directly into Kusto with near-real-time latency, best for small/frequent writes across many tables; **queued ingestion** (the default) batches through blob storage first, trading some latency for higher throughput and reliability
> - **Native tables** ingest data physically into the Eventhouse; **OneLake shortcuts** reference Delta tables that live elsewhere (a lakehouse, ADLS, S3, GCS, a mirrored database) without duplicating storage
> - **Query acceleration** is a ==generally available== policy that caches and indexes a shortcut's data, closing most of the performance gap with native tables — at an additional storage/compute cost, and with the same limitations as any external table (no materialized views, no update policies)
> - **Update policies** implement transform-on-ingest; **materialized views** implement always-fresh continuous aggregation — both are native-table mechanisms, covered in transformation-syntax depth in [07-Batch Transformation: KQL Transformations](../07-batch-transformation/04-kql-transformations.md)
> - **OneLake availability** exposes Eventhouse table data as Delta Lake files in OneLake, queryable from Spark, Warehouse, the SQL analytics endpoint, and Power BI Direct Lake

> [!tip] What the Exam Tests
>
> - Choosing streaming vs. queued ingestion for a given latency/throughput/table-count scenario
> - Choosing native tables vs. OneLake shortcuts (accelerated or not) for a given ingestion/duplication/performance tradeoff
> - Knowing what query acceleration does, its GA status, its cost model, and its limitations
> - Recognizing that update policies and materialized views only work on native tables, not accelerated shortcuts
> - Understanding how OneLake availability exposes Eventhouse data to the rest of Fabric

---

## Ingestion Methods: Streaming vs. Queued

| Factor | Streaming ingestion | Queued ingestion *(default)* |
| :--- | :--- | :--- |
| **Path** | Data sent directly to Kusto in the body of a streaming HTTP request | Data uploaded to blob storage first, then queued for batch ingestion |
| **Latency** | ==Near-real-time== — typically sub-second to a few seconds | Batched — typically seconds to low minutes, governed by the ingestion batching policy |
| **Best fit** | Small, frequent writes across a large number of tables, where batching would be inefficient | Large-volume tables where throughput and reliability matter more than per-write latency |
| **Cost/throughput tradeoff** | Cheaper for many small, trickling tables; less efficient at very high aggregate volume | More cost-effective and higher-throughput at scale — the recommended default for most production workloads |

Eventstream's **Direct ingestion** and **Event processing before ingestion** modes into an Eventhouse destination both ultimately use Eventhouse's own ingestion pipeline underneath; a team ingesting directly with the Kusto ingestion client APIs chooses explicitly between the streaming and queued client patterns.

> [!note] Mental model
> Queued ingestion is a **loading dock** — trucks (batches) arrive, get queued, and are unloaded efficiently in bulk; great throughput, but a truck has to fill up (or a timer has to elapse) before it leaves. Streaming ingestion is a **pneumatic tube** — a single small item goes straight to its destination the moment it's sent, no waiting to fill a truck, but running thousands of tubes constantly is less efficient than a few well-loaded trucks at very high volume.

**Practice Question 1** *(Medium)*

A team ingests small, sporadic configuration-change events into 200 separate KQL tables, one per tenant, with each tenant producing only a handful of events per minute. Batching would mean most tables wait unnecessarily long for enough data to trigger a batch. Which ingestion method fits, and why?

A. Queued ingestion, because it's the default and recommended for most workloads  
B. Streaming ingestion, because it's designed for small, frequent writes across many tables where batching is inefficient  
C. Direct ingestion via Eventstream only, since native Kusto ingestion clients don't support this pattern  
D. Materialized views, since they can absorb ingestion directly  

> [!success]- Answer
> **B. Streaming ingestion, because it's designed for small, frequent writes across many tables where batching is inefficient**
>
> This is precisely the scenario streaming ingestion is built for: many tables, small per-write volume, latency-sensitive. Queued ingestion's batching model works against this pattern rather than for it. Materialized views are a query/transformation mechanism over already-ingested data, not an ingestion method themselves.

## Native Tables vs. OneLake Shortcuts

| Factor | Native Eventhouse table | OneLake shortcut (unaccelerated) | OneLake shortcut (query-accelerated) |
| :--- | :--- | :--- | :--- |
| **Data location** | Physically ingested and stored inside the Eventhouse | Referenced in place — no duplication; source stays in a lakehouse, ADLS, S3, GCS, or a mirrored database | Referenced, but a caching/indexing layer is added on top |
| **Query performance** | ==Fastest== — fully indexed, native storage | Slower — network calls to fetch from storage, no indexes | Comparable to native tables — cached, indexed, same performance class |
| **Storage cost** | Counted as Eventhouse storage | No additional Eventhouse storage — the source owns the storage cost | Adds to Eventhouse storage/SSD consumption (OneLake Premium cache meter) on top of the source's own storage |
| **Update policies / materialized views** | ==Fully supported== | Not supported (behaves as an external table) | ==Not supported== — accelerated shortcuts still behave like external tables with the same limitations |
| **Best fit** | Streaming telemetry that needs transform-on-ingest or continuous aggregation | Combining Eventhouse queries with data managed elsewhere, when query performance parity isn't critical | Combining Eventhouse queries with data managed elsewhere, when query performance parity **is** critical — e.g., joining a large fact stream with dimension data mirrored from another system |

> [!note] Mental model — native table vs. shortcut vs. accelerated shortcut
> A native table is **owning the book** — it's on your shelf, fully indexed, instant to find any page. An unaccelerated shortcut is **borrowing the book from the library across town** — you can read it, but every lookup means a trip. An accelerated shortcut is **photocopying the pages you use most onto your own shelf** — the original stays at the library (no duplication of ownership or authoritative source), but your local copy reads exactly as fast as owning the book outright.

> [!warning] Common Mistake
> Assuming query acceleration turns a shortcut into a native table in every respect. Accelerated shortcuts close the **query performance** gap, but they remain external tables for every other purpose — materialized views and update policies still aren't supported on them. A scenario describing "we accelerated our shortcut and now want to add a materialized view on top" is a trap: the fix is either ingesting natively into Eventhouse, or performing the equivalent dedup/aggregation at query time (e.g., `arg_max` directly in the query) instead of via a materialized view.

**Practice Question 2** *(Hard)*

A team has high-volume clickstream data streaming natively into an Eventhouse, and needs to enrich it by joining against a small "customer tier" dimension table that's mirrored from a CRM system into OneLake. Query performance for this join needs to match native-table speed, since it backs a live dashboard. What's the best approach, and what would happen if they tried adding a materialized view over the joined result on top of an accelerated shortcut for the dimension table?

A. Ingest the dimension table natively into Eventhouse instead of shortcutting it, since shortcuts are always too slow  
B. Create an unaccelerated OneLake shortcut to the mirrored dimension table; a materialized view over the join would work fine  
C. Create a query-accelerated OneLake shortcut to the mirrored dimension table for native-table-class join performance; a materialized view still can't be created directly on an accelerated shortcut, since it behaves like an external table — the dedup/enrichment logic would need to run at query time instead (e.g., using `lookup` or `arg_max` in the query itself)  
D. Query acceleration isn't applicable to dimension data, only to fact tables  

> [!success]- Answer
> **C. Create a query-accelerated OneLake shortcut to the mirrored dimension table for native-table-class join performance; a materialized view still can't be created directly on an accelerated shortcut, since it behaves like an external table — the dedup/enrichment logic would need to run at query time instead (e.g., using `lookup` or `arg_max` in the query itself)**
>
> Query acceleration is exactly designed for this scenario — small, high-value dimension data mirrored from elsewhere, joined against a native fact stream, with performance parity to a native table. But acceleration doesn't lift the external-table restriction on materialized views/update policies; any standing aggregation or transform logic has to happen at query time (or the dimension data would need to be ingested natively instead, which defeats the "avoid duplicating the CRM mirror" goal).

## Query Acceleration: Limitations and Billing

Query acceleration is powerful but not unconditional — several limitations shape when it's the right choice:

> [!note]
> Query acceleration ≠ shortcut caching — shortcut caching is a OneLake-wide feature for GCS/S3/S3-compatible/on-prem gateway shortcuts, see [06-Batch Ingestion: OneLake Shortcuts](../06-batch-ingestion/02-onelake-shortcuts.md).

| Limitation | Detail |
| :--- | :--- |
| Column count | The accelerated external table can't exceed 900 columns |
| File count | Query performance may degrade past 2.5 million data files in the accelerated table |
| Parquet file size | Individual Parquet files larger than 6 GB aren't cached |
| Schema stability assumption | The policy assumes static advanced features (column mapping, partitions); changing them requires disabling, changing, then re-enabling the policy — a breaking schema change can force re-acceleration from scratch |
| Partition pruning | Index-based pruning isn't supported for partitions |
| Region | For compliance, the Eventhouse capacity should be in the same region as the external table/shortcut source |

**Billing:** accelerated data is charged under the OneLake Premium cache meter, the same meter as native Eventhouse table storage. The cached amount is controlled by the **Hot** property (number of days to cache) in the query acceleration policy — a smaller Hot window reduces both storage cost and cache freshness guarantees. Indexing and ingestion activity contribute to compute (CU) consumption as well, visible in the Fabric metrics app under the owning Eventhouse.

> [!note] Mental model
> The Hot property is a **thermostat for how much history stays warm**. A short Hot window keeps only the most recent slice cached at native-table speed (cheap, but older queries fall back to unaccelerated shortcut performance); a long Hot window keeps more history fast, at proportionally higher storage cost.

## Update Policies and Materialized Views for Streaming Transform

Update policies and materialized views are Eventhouse's own transform-on-ingest and continuous-aggregation mechanisms — full syntax, examples, and the T-SQL→KQL translation table live in [07-Batch Transformation: KQL Transformations](../07-batch-transformation/04-kql-transformations.md). In the streaming context, the pattern that matters most is:

- **Update policy** on a native raw-ingestion table, parsing/typing/enriching every incoming event automatically as it lands — the KQL equivalent of a Spark `foreachBatch` transform step, but triggered per-ingest with no orchestration
- **Materialized view** with an `arg_max`-style aggregation, deduplicating a high-volume streaming table or maintaining an always-fresh rolling aggregate for a live dashboard

Both require the source to be a **native table** — this is the same constraint already covered above for accelerated shortcuts, and it's worth restating because the exam blueprint calls out "native tables vs. OneLake shortcuts" and "query acceleration" as explicit, separate bullets alongside update policies and materialized views.

## OneLake Availability of Eventhouse Data

**OneLake availability** creates a logical copy of a KQL database's (or a single table's) data in Delta Lake format inside OneLake, making it queryable from Spark notebooks, the Warehouse engine, the lakehouse SQL analytics endpoint, and Power BI Direct Lake mode — without an ETL pipeline. It can be turned on at the database level (all current and future tables) or the table level (just that table), and existing data can be backfilled into OneLake retroactively.

Key behaviors:

- An **adaptive batching mechanism** delays writing Parquet files to OneLake until enough data accumulates for an efficiently-sized file (default up to 3 hours, or sooner once ~200–256 MB accumulates) — configurable down to a 5-minute minimum via `TargetLatencyInMinutes` on the table's mirroring policy
- The resulting Delta files in OneLake are **read-only** and can't be manually optimized after creation
- The KQL database's own data retention policy also governs the OneLake copy — data purged from Eventhouse at the end of its retention period is removed from OneLake too
- While OneLake availability is on, certain operations are blocked on the source table: renaming, altering a column type, applying row-level security, or deleting/truncating/purging data — turn availability off, perform the operation, then turn it back on

> [!warning] Common Mistake
> Expecting Eventhouse data to appear in OneLake the instant it's ingested. OneLake availability's adaptive batching can delay the OneLake copy by up to 3 hours by default, specifically to avoid writing many small, inefficient Parquet files. A scenario complaining that "data is in the KQL database but not showing up in a Spark notebook reading the OneLake path" is very often this batching delay, not a configuration failure — check `.show table mirroring operations` for the actual latency, and lower `TargetLatencyInMinutes` (down to a 5-minute floor) if faster availability is a hard requirement, accepting the tradeoff of smaller, less-optimal files.

**Practice Question 3** *(Medium)*

A Spark notebook reads an Eventhouse table's OneLake path immediately after enabling OneLake availability and sees no data yet, even though the KQL database itself returns rows for a direct KQL query. What's the most likely explanation, and what setting controls it?

A. OneLake availability failed silently; it should be re-enabled  
B. The adaptive Parquet-file batching mechanism hasn't written data to OneLake yet — `TargetLatencyInMinutes` on the table's mirroring policy controls how long this can take (default up to 3 hours, minimum 5 minutes)  
C. Spark notebooks can never read Eventhouse OneLake data directly, only Power BI can  
D. OneLake availability only applies to tables created before the feature was enabled  

> [!success]- Answer
> **B. The adaptive Parquet-file batching mechanism hasn't written data to OneLake yet — `TargetLatencyInMinutes` on the table's mirroring policy controls how long this can take (default up to 3 hours, minimum 5 minutes)**
>
> This is expected, documented behavior — OneLake availability intelligently delays writes to avoid producing many small, inefficient Parquet files, batching up to 3 hours by default (or until ~200–256 MB accumulates). Lowering `TargetLatencyInMinutes` (down to a 5-minute floor) trades faster availability for smaller, less-optimal files. Spark absolutely can read Eventhouse OneLake data directly via `spark.read.format("delta").load(<path>)`.

## Reading Delta Tables Directly from a Notebook

Once OneLake availability is enabled, a Fabric notebook can read an Eventhouse table's Delta representation with a plain path-based load — no special connector:

```python
delta_table_path = "abfss://<workspaceGuid>@onelake.dfs.fabric.microsoft.com/<eventhouseGuid>/Tables/<tableName>"

df = spark.read.format("delta").load(delta_table_path)
df.show()
```

This is the same OneLake path pattern used for any other Fabric item's Delta tables — Eventhouse data isn't a special case for Spark once OneLake availability exposes it, which is exactly the point of the feature: one storage format, queryable identically from every Fabric compute engine.

## Use Cases

- Streaming ingestion for many small, sporadic per-tenant tables where batching wastes latency budget
- Queued ingestion (the default) for high-volume telemetry tables where throughput matters more than per-event latency
- An update policy parsing raw JSON telemetry into a typed target table automatically on every ingest, with no external orchestration
- A query-accelerated OneLake shortcut joining a native fact stream against a small dimension table mirrored from another system, for dashboard-grade join performance without duplicating the dimension data
- Enabling OneLake availability so a Spark notebook or Power BI Direct Lake report can consume Eventhouse data without a dedicated export pipeline

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Materialized view creation fails on an accelerated OneLake shortcut | Materialized views and update policies aren't supported on external tables, including accelerated shortcuts | Ingest natively into Eventhouse, or perform the dedup/aggregation at query time (`arg_max`/`lookup` in the query) |
| Query over an unaccelerated shortcut is much slower than an equivalent native-table query | Unaccelerated shortcuts incur network calls and lack indexes | Enable query acceleration on the shortcut, or ingest the data natively if update policies/materialized views are also needed |
| Data ingested into Eventhouse doesn't appear at the expected OneLake path for a while | Adaptive Parquet-file batching delays the write (default up to 3 hours) | Check `.show table mirroring operations` for current latency; lower `TargetLatencyInMinutes` if faster availability is required |
| Attempting to rename a table or alter a column type while OneLake availability is enabled | Certain schema/data operations are blocked while availability is on | Turn off OneLake availability, perform the operation, then re-enable it |
| Query acceleration billing is higher than expected | Accelerated data adds to the OneLake Premium cache meter and SSD storage consumption on top of the source's own storage cost | Tune the caching period ("Hot" property) in the query acceleration policy to control how much data stays cached |

## Best Practices

- Default to queued ingestion for high-volume production tables; reserve streaming ingestion for genuinely small/frequent, latency-sensitive writes across many tables
- Use query acceleration on a shortcut whenever join/query performance needs to match native-table speed, but keep materialized views and update policies on native tables only
- Enable OneLake availability at the database level when most/all tables should be broadly consumable, and at the table level for narrower, deliberate exposure
- Monitor `.show table mirroring operations` before assuming OneLake availability has "failed" — it's very often just batching latency

## Exam Tips

> [!tip] Exam Tips
>
> - Streaming ingestion = near-real-time, small/frequent writes across many tables; queued ingestion = default, higher throughput, blob-staged batches
> - Query acceleration is ==generally available== and closes the performance gap between shortcuts and native tables — but accelerated shortcuts still can't host materialized views or update policies
> - Update policies and materialized views require native tables — this is the same underlying constraint tested from two different angles (KQL transformation mechanics in Section 07, streaming architecture in Section 08)
> - OneLake availability's adaptive batching can delay data appearing in OneLake by design (up to 3 hours default) — `TargetLatencyInMinutes` tunes this down to a 5-minute floor
> - OneLake availability blocks table rename, column-type changes, row-level security, and delete/truncate/purge while it's enabled

## Key Takeaways

- Streaming and queued ingestion trade latency for throughput/reliability differently — choose based on table count, write frequency, and latency tolerance
- Native tables, unaccelerated shortcuts, and accelerated shortcuts form a spectrum from "owned and fastest" to "referenced and slowest," with acceleration (GA) closing most of the performance gap without duplicating storage
- Update policies and materialized views are native-table-only mechanisms — accelerated shortcuts remain external tables for that purpose even after acceleration
- OneLake availability exposes Eventhouse data as Delta Lake files for Spark/Warehouse/Power BI consumption, governed by an adaptive batching policy and the KQL database's own retention

## Related Topics

- [01-Choosing a Streaming Engine](./01-choosing-streaming-engine.md)
- [07-Batch Transformation: KQL Transformations](../07-batch-transformation/04-kql-transformations.md)
- [06-Batch Ingestion: Choosing a Data Store](../06-batch-ingestion/01-choosing-data-store.md)
- [06-Batch Ingestion: OneLake Shortcuts](../06-batch-ingestion/02-onelake-shortcuts.md)

## Official Documentation

- [Query acceleration for OneLake shortcuts - overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/query-acceleration-overview)
- [Turn on OneLake availability for an eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-house-onelake-availability)
- [Eventhouse overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [Materialized views](https://learn.microsoft.com/en-us/kusto/management/materialized-views/materialized-view-overview?view=microsoft-fabric)
- [Update policy overview](https://learn.microsoft.com/en-us/kusto/management/update-policy?view=microsoft-fabric)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-spark-structured-streaming.md) | [↑ Back to Section](./streaming-data.md) | [Next →](./05-windowing-functions.md)**
