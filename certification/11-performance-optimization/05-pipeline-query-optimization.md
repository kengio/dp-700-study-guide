---
title: Pipeline and Query Optimization
type: topic
tags:
  - dp-700
  - fabric
  - performance-optimization
  - pipelines
  - copy-activity
  - direct-lake
  - dataflow-gen2
  - query-optimization
---

# Pipeline and Query Optimization

## Overview

This closing topic covers two related but distinct performance surfaces: tuning a pipeline's Copy activity (parallelism, staging, partitioning, batch-vs-per-row patterns) and choosing the right compute/consumption mode for a query workload (Direct Lake vs. Import vs. DirectQuery, Dataflow Gen2 folding, and a cross-engine decision recap). Both surfaces lean heavily on tables rather than long explanations — this is a decision-guidance topic more than a mechanics one.

> [!abstract]
>
> - Copy activity performance is governed by **Data Integration Units (DIUs)** (4–256, default Auto) and **degree of copy parallelism** — both auto-tuned by the service unless explicitly overridden
> - **Staging** is required for certain sinks (notably Fabric Warehouse) and separately useful for compressing data before a slow network hop
> - `ForEach` activities default to sequential execution; batching and set-based operations beat per-row activity patterns at any meaningful scale
> - Direct Lake's **guardrails** (file count, table size) tie query performance directly back to the file-size health covered in [01-Lakehouse Optimization](01-lakehouse-optimization.md) — a poorly maintained table can force a slower fallback mode or block queries entirely
> - Dataflow Gen2's query folding — covered as an *error* symptom in [10-Error Resolution](../10-error-resolution/01-pipeline-dataflow-errors.md) — is really a performance topic: losing it doesn't fail the refresh, it just makes it much slower

> [!tip] What the Exam Tests
>
> - Reasoning about DIU/parallelism auto-tuning vs. when manual override is worth it
> - Knowing when Copy activity staging is required vs. optional-but-beneficial
> - Recognizing per-row pipeline anti-patterns and the batch-oriented fix
> - Connecting Direct Lake guardrail violations back to file-size maintenance, and choosing the right consumption mode for a given query pattern

---

## Copy Activity Parallelism

Fabric Data Factory pipelines share the same copy engine and terminology as Azure Data Factory, so **Data Integration Units (DIUs)** remain the unit of measure for Copy activity compute power (a combination of CPU, memory, and network allocation), applicable when using the Azure integration runtime.

| Setting | Range | Default | Behavior |
| :--- | :--- | :--- | :--- |
| **DIUs** | 4–256 | **Auto** | Service dynamically applies the optimal DIU setting based on the source-sink pair and data pattern unless explicitly overridden |
| **Degree of copy parallelism** | Configurable in the Settings tab | Auto | Maximum number of threads within the copy activity; the service's default auto-determined parallelism (based on source-sink pair, data pattern, and DIU count) usually gives the best throughput |

> [!note] Mental model — DIU and parallelism as Auto-first knobs
> Both settings work like a car's automatic transmission — the default (**Auto**) already picks a near-optimal gear for the road (source-sink pair, data shape) it detects. Manual override exists for edge cases (a specific source/sink combination the auto-heuristic doesn't handle well, or a cost-vs-speed tradeoff you want to control explicitly) — it's not the first lever to reach for when a copy feels slow.

## Staging: When Required vs. When Beneficial

- **Required**: staging is required when the Copy activity's sink is a **Fabric Warehouse**, since the Warehouse doesn't accept every source type through a direct high-throughput write path.
- **Time limit**: workspace-managed staging times out after **60 minutes** — long-running Copy jobs that exceed this should use external storage for staging instead of workspace-managed staging.
- **Beneficial (not required) elsewhere**: staged copy can compress data at the source before moving it to the staging store, reducing transfer time across slow or bandwidth-limited links (for example, on-premises to cloud) even when the sink doesn't strictly require staging.

## Partition Option on Sources

For relational sources, the Copy activity's **partition option** splits a single large table read into multiple parallel sub-reads by a dynamic range on a partitioning column, instead of reading the whole table through one connection. This is the source-side analog to increasing DIUs/parallelism — for very large source tables, partitioned reads are frequently the difference between a copy that scales and one that's bottlenecked on a single connection's throughput regardless of how much compute is thrown at it.

## Binary vs. Parsed Copies

| Copy type | What happens | When to use |
| :--- | :--- | :--- |
| **Binary copy** | Raw bytes copied directly, no schema/type translation | File-to-file moves with no transformation need — fastest option, skips all parsing overhead |
| **Parsed (format-aware) copy** | Source and sink datasets require type conversion, delimited parsing, or schema mapping | Any copy involving a schema change, format conversion, or column-level transformation |

Choosing binary copy when no transformation is genuinely needed avoids paying parsing overhead for nothing — a common miss when a pipeline defaults to a format-aware dataset pair out of habit rather than necessity.

## ForEach Tuning and Avoiding Per-Row Activities

`ForEach` activities execute **sequentially by default**. Setting `isSequential = false` enables parallel execution, controlled by `batchCount` (up to a documented maximum of concurrent iterations) — but the deeper performance question is usually whether a `ForEach`-wrapped per-row activity pattern should exist at all.

> [!warning] Common Mistake
> Wrapping a Copy or Web activity inside a `ForEach` to process data one row (or one file, one API call) at a time, when a single set-based operation could do the same work. A `ForEach` over 100,000 rows — even with `batchCount` parallelism tuned up — pays per-iteration activity overhead 100,000 times. The scalable fix is almost always to push the logic into a single set-based Copy activity, a notebook processing the full dataset in one pass, or a Warehouse CTAS/`INSERT ... SELECT` (see [02-Warehouse Optimization](02-warehouse-optimization.md#data-clustering-distribution-and-load-patterns)) — the same anti-pattern the Warehouse topic covers as row-by-row `INSERT`.

Increasing `batchCount` parallelism helps when a `ForEach` is genuinely the right tool (iterating over a small, bounded list of distinct sub-tasks — different file paths, different API endpoints) but doesn't fix the underlying scalability problem when the real issue is a per-row pattern applied to row-scale data.

**Practice Question 1** *(Medium)*

A pipeline uses a `ForEach` activity to loop over 50,000 individual customer records, calling a Web activity once per record to post each one to an external API, then a Copy activity to load each response into a Lakehouse table one file at a time. The pipeline takes hours to run and the team wants to tune `batchCount` to speed it up. What's the more effective fix?

A. Increase `batchCount` and set `isSequential = false` to parallelize the existing per-row loop  
B. Recognize this as a per-row activity anti-pattern at row-scale data volume; batch records into a smaller number of set-based API calls (or a Spark/notebook step for bulk processing) and load results with a single Copy activity instead of one per record  
C. Increase the Copy activity's DIUs to speed up each individual per-record load  
D. Add staging to the Copy activity  

> [!success]- Answer
> **B. Recognize this as a per-row activity anti-pattern at row-scale data volume; batch records into a smaller number of set-based API calls (or a Spark/notebook step for bulk processing) and load results with a single Copy activity instead of one per record**
>
> At 50,000 iterations, even a fully parallelized `ForEach` (A) still pays substantial per-iteration overhead — tuning `batchCount` improves this pattern only marginally. DIUs (C) and staging (D) tune a single Copy activity's throughput, not the fundamental problem of invoking 50,000 separate activity executions. The scalable fix restructures the pipeline around set-based operations instead of a per-row loop.

## Direct Lake vs. Import vs. DirectQuery: Performance Traps

Direct Lake reads Delta Parquet files directly into a Power BI semantic model without a full Import-mode refresh cycle or DirectQuery's per-query pass-through — but it has documented conditions under which it silently degrades.

| Mode | Behavior | Performance profile |
| :--- | :--- | :--- |
| **Import** | Data copied and compressed into the semantic model at refresh time | Fast queries always, but refresh latency scales with data volume; data is only as fresh as the last refresh |
| **DirectQuery** | Every visual/query passes through live to the source engine | Always fresh, but every query pays source-engine query latency directly |
| **Direct Lake** | Reads Delta Parquet files directly, without a full Import copy | Import-like query speed *when conditions hold*; can silently degrade or block depending on the variant (below) |

Direct Lake queries stay in **DirectLakeOnly** mode (best performance) only when *all* of these hold: no SQL row-level security (RLS), dynamic data masking (DDM), or object-level security (OLS) defined on referenced tables at the SQL analytics endpoint; no table is based on an unmaterialized SQL view; and no table exceeds capacity **guardrail limits** (including Parquet file count).

What happens when a guardrail is exceeded depends on which Direct Lake variant is in use:

| Direct Lake variant | Fallback behavior when guardrails are exceeded |
| :--- | :--- |
| **Direct Lake on OneLake** | No DirectQuery fallback exists — behaves like Import mode: refresh **fails**, and the model can't be queried until the Delta tables are optimized back within guardrail limits |
| **Direct Lake on SQL** | Falls back to **DirectQuery** mode (if fallback is enabled) — refresh succeeds with a warning, queries still return results, but at DirectQuery's slower per-query latency |

> [!note] Mental model — Direct Lake guardrails as a credit limit
> Think of a Direct Lake table's guardrail limits (file count, table size) as a **credit limit**. Under the limit, you get Import-mode speed without an Import-mode refresh. Cross it, and the consequence depends on which card you're holding: Direct Lake on OneLake **freezes the account** (refresh fails, nothing queryable until you pay down the balance — i.e., run `OPTIMIZE`/`VACUUM`); Direct Lake on SQL **downgrades your rate** (falls back to DirectQuery — still usable, just slower and more expensive per query).

This is exactly why [01-Lakehouse Optimization](01-lakehouse-optimization.md) matters beyond raw Spark/SQL query speed: a table accumulating small files from skipped `OPTIMIZE` runs can push past the Parquet-file-count guardrail and force a Direct Lake table into fallback or failure — a semantic-model performance problem whose root cause and fix live entirely in lakehouse table maintenance.

**Practice Question 2** *(Hard)*

A Direct Lake on OneLake semantic model, previously performing well, suddenly fails to refresh with an error referencing exceeded storage guardrails. Power BI reports say the underlying lakehouse table hasn't been formally resized, but it has been receiving frequent small streaming writes for weeks with no scheduled maintenance. What's the most likely fix?

A. Switch the semantic model from Direct Lake on OneLake to Direct Lake on SQL to enable DirectQuery fallback  
B. Run `OPTIMIZE` (and `VACUUM` as appropriate) on the lakehouse table to compact accumulated small files back within the Parquet file-count guardrail, then retry the refresh  
C. Increase the Fabric capacity SKU to raise the guardrail limits  
D. Enable V-Order on the table to reduce file count  

> [!success]- Answer
> **B. Run OPTIMIZE (and VACUUM as appropriate) on the lakehouse table to compact accumulated small files back within the Parquet file-count guardrail, then retry the refresh**
>
> Weeks of frequent small streaming writes with no maintenance is a textbook small-file accumulation scenario — the Parquet file-count guardrail is most directly addressed by compaction (`OPTIMIZE`), not by switching Direct Lake variants (A, which changes fallback *behavior* but doesn't fix the underlying file-count problem and requires a model rebuild) or scaling capacity (C, which doesn't change per-table guardrail limits, which are about table health, not overall capacity size). V-Order (D) changes file *encoding*, not file *count* — it doesn't reduce how many Parquet files exist.

## SQL Endpoint Query Tuning: Recap

The SQL analytics endpoint shares its statistics engine, in-memory/disk caching, result-set caching, and `queryinsights` diagnostic views with Fabric Warehouse — see [02-Warehouse Optimization](02-warehouse-optimization.md) for the full mechanics. The one addition worth noting here: because the SQL endpoint sits directly on top of the same Delta tables Direct Lake and Spark read, file-size health (covered in [01-Lakehouse Optimization](01-lakehouse-optimization.md)) affects SQL endpoint query speed too — a table with a well-maintained file layout benefits every consuming engine simultaneously, not just Spark.

## Dataflow Gen2 Query Folding: Performance Framing

[10-Error Resolution: Pipeline and Dataflow Errors](../10-error-resolution/01-pipeline-dataflow-errors.md#query-folding-failures) covers query folding loss as a symptom to *diagnose* (a refresh that succeeds but runs far slower than its historical average, with no error in refresh history). The performance-optimization framing is the same fact from the *prevention* side: query folding pushes Power Query transformation steps back to the source system (SQL pushdown, for example) instead of pulling all rows into the mashup engine and transforming them locally — so authoring queries to *preserve* folding is a performance decision made at design time, not just an error to chase after the fact.

Practical folding-preservation guidance:

- Keep filtering and column-selection steps early, before custom columns or type transformations that might not have a source-side equivalent
- Avoid mixing data from two different connections/sources in one query if the combined query needs to stay foldable
- Be deliberate about `Table.Buffer` — it intentionally materializes a table and stops folding from that point forward, which is sometimes necessary (to fix a step ordering issue) but always ends folding for the rest of the query
- Treat **staging** awareness as part of the same design decision: a staged Dataflow Gen2 query writes intermediate results to a Lakehouse before downstream queries reference them — those downstream queries read from OneLake (not re-folding against the original source), so folding loss upstream of staging and downstream of staging are two separate performance questions

## Choosing Compute Per Query Pattern

This table summarizes the performance-relevant angle of engine selection — see [07-Batch Transformation: Choosing a Transform Tool](../07-batch-transformation/01-choosing-transform-tool.md) and [08-Streaming Data: Choosing a Streaming Engine](../08-streaming-data/01-choosing-streaming-engine.md) for the full selection frameworks; this recap is scoped strictly to the performance dimension.

| Query pattern | Best-fit engine | Why |
| :--- | :--- | :--- |
| Interactive BI dashboard, sub-second expectation | Direct Lake (within guardrails) | Import-like speed without a refresh cycle, as long as file health and security settings keep it in DirectLakeOnly mode |
| Ad hoc heavy transformation, custom logic, large scale | Spark notebook | Native execution engine, AQE, and intelligent cache all apply; full programmatic control |
| Repeated analytical SQL queries, reporting workload | Warehouse / SQL endpoint | Automatic statistics, in-memory/disk caching, and result-set caching all apply transparently |
| Sub-second filters over recent time-series/event data | Eventhouse (KQL) | Extent-level time pruning and (optionally) materialized views give the fastest path for this exact shape |
| High-volume streaming ingestion with need for immediate simple transforms | Eventstream processor + Eventhouse update policy | Cost lands per-event, avoiding a separate orchestrated batch step |
| Business-user-authored, no-code transformation | Dataflow Gen2 (fold-preserving design) | Accessible authoring, but only performant when transformation steps stay foldable to the source |

> [!note] Mental model — matching engine to query shape, not habit
> The recurring exam trap across this whole guide is picking a familiar engine instead of the one that matches the query's actual shape. A dashboard needing sub-second response shouldn't be built on DirectQuery out of habit if Direct Lake's guardrails are achievable; a genuinely complex, large-scale transform shouldn't be forced into Dataflow Gen2 just because it's low-code, if folding can't hold across the transformation. Performance optimization, at the compute-selection level, is mostly about not fighting the engine's natural strengths.

## Decision Guidance: Symptom → Lever

| Symptom | Most likely lever | Why |
| :--- | :--- | :--- |
| Copy activity throughput lower than expected on a large relational source | Partition option on the source | Splits a single-connection read into parallel range-based sub-reads |
| Pipeline takes hours iterating a `ForEach` over a large record set | Redesign to a set-based operation | Per-row activity overhead multiplies at row-scale; `batchCount` tuning only helps marginally |
| File-to-file copy with no transformation is slower than expected | Switch to binary copy | Skips schema/type parsing overhead entirely |
| Direct Lake on OneLake semantic model refresh fails on a guardrail error | Run `OPTIMIZE`/`VACUUM` on the source lakehouse table | Guardrail is file-count/size based, not capacity based |
| Direct Lake on SQL semantic model queries got slower with no error | Identify the DirectQuery fallback trigger (RLS/DDM/OLS, unmaterialized view, guardrail) | Fallback succeeds but runs at DirectQuery latency |
| Dataflow Gen2 refresh duration creeping up with no error message | Redesign the query to preserve folding | Folding loss degrades performance silently, it doesn't fail the refresh |
| Long-running Copy job intermittently times out | Workspace staging's 60-minute limit | Move to external storage for staging on long jobs |

**Practice Question 3** *(Medium)*

A Copy activity moves data from an on-premises SQL Server to a Fabric Warehouse over a constrained network link. The pipeline owner wants to reduce transfer time without changing the source or sink. Which setting is most directly aimed at this specific bottleneck?

A. Increase the degree of copy parallelism only  
B. Enable staged copy with compression, so data is compressed before crossing the constrained network link to the staging store  
C. Switch the copy to binary mode  
D. Increase DIUs to the maximum of 256  

> [!success]- Answer
> **B. Enable staged copy with compression, so data is compressed before crossing the constrained network link to the staging store**
>
> Staging to Fabric Warehouse is already required for many source types, and staged copy's compression option specifically targets a slow/constrained network hop — compressing data before it crosses the bottleneck link reduces transfer time in a way parallelism or DIU increases (A, D) don't address, since those tune compute, not the network link itself. Binary mode (C) skips parsing overhead but doesn't compress data for a constrained link, and a SQL Server source with typed columns moving into a Warehouse sink typically isn't a pure binary-copy scenario in the first place.

## Use Cases

- Deciding when a Copy activity needs manual DIU/parallelism overrides vs. trusting Auto
- Recognizing a `ForEach`-wrapped per-row pattern and redesigning it around a set-based operation
- Diagnosing a Direct Lake refresh failure or unexpected DirectQuery fallback back to file-count guardrails and lakehouse maintenance
- Designing a Dataflow Gen2 query to preserve folding from the start, rather than discovering folding loss after a slow refresh
- Choosing the right compute engine for a new query workload based on its latency/throughput/authoring-audience profile

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Copy activity to a Fabric Warehouse fails without staging configured | Warehouse sink requires staging for many source types | Enable staging on the Copy activity |
| Long-running Copy job fails around the 60-minute mark | Workspace-managed staging timeout | Use external storage for staging on long-running jobs |
| `ForEach`-based pipeline takes hours over a large record set | Per-row activity pattern at row-scale data volume | Replace with a set-based Copy/notebook/CTAS operation |
| Direct Lake on OneLake semantic model refresh fails on a guardrail error | Table exceeded Parquet file-count guardrail from unmaintained small-file accumulation | Run `OPTIMIZE`/`VACUUM` on the underlying lakehouse table, then retry |
| Direct Lake on SQL semantic model suddenly slower but still returning results | Fallback to DirectQuery triggered by RLS/DDM/OLS, an unmaterialized view, or a guardrail breach | Identify and remove the specific fallback trigger, or accept DirectQuery-level latency for that condition |
| Dataflow Gen2 refresh duration creeping upward with no error | Query folding silently lost partway through the query | Redesign the query to keep filtering/selection steps foldable before non-foldable custom logic |

## Best Practices

- Trust Auto DIU/parallelism as the starting point; override only for a specific, observed source-sink bottleneck
- Use the source-side partition option for very large relational table reads instead of relying on DIUs alone
- Prefer binary copy whenever no schema/type transformation is actually needed
- Audit pipelines for `ForEach`-wrapped per-row activities at meaningful data volume and replace them with set-based operations
- Keep lakehouse tables feeding Direct Lake models within guardrail limits via routine `OPTIMIZE`/`VACUUM`, not just for Spark/SQL query speed
- Design Dataflow Gen2 queries with folding preservation in mind from the start, not as an after-the-fact fix

## Exam Tips

> [!tip] Exam Tips
>
> - DIUs: **4–256**, default **Auto**; degree of copy parallelism also defaults to Auto and usually gives the best throughput
> - Staging is **required** for Fabric Warehouse sinks; workspace staging **times out at 60 minutes**
> - `ForEach` is sequential by default; the real fix for row-scale slowness is usually eliminating the per-row pattern, not just tuning `batchCount`
> - Direct Lake on OneLake exceeding guardrails → **refresh fails**, no fallback; Direct Lake on SQL exceeding guardrails → **falls back to DirectQuery** (if enabled), slower but functional
> - Query folding loss is a **performance** symptom (slow, no error), not a refresh failure — design queries to preserve folding, filter/select before custom logic

## Key Takeaways

- Copy activity performance settings (DIUs, parallelism, staging) are Auto-first by design — manual tuning is a targeted override, not a default step
- The `ForEach` per-row pattern is the pipeline-side twin of the Warehouse's row-by-row `INSERT` anti-pattern — both need a set-based redesign, not just more parallelism
- Direct Lake guardrail behavior differs meaningfully by variant (OneLake fails, SQL falls back to DirectQuery) and both ultimately trace back to lakehouse table maintenance
- Query folding is best treated as a design-time performance concern, even though it surfaces operationally as a slow-refresh symptom
- Compute selection across this whole guide (Spark, Warehouse, Eventhouse, Dataflow Gen2, Direct Lake) is fundamentally about matching engine strengths to query shape, not defaulting to a familiar tool

## Related Topics

- [01-Lakehouse Optimization](01-lakehouse-optimization.md)
- [02-Warehouse Optimization](02-warehouse-optimization.md)
- [07-Batch Transformation: Choosing a Transform Tool](../07-batch-transformation/01-choosing-transform-tool.md)
- [08-Streaming Data: Choosing a Streaming Engine](../08-streaming-data/01-choosing-streaming-engine.md)
- [10-Error Resolution: Pipeline and Dataflow Errors](../10-error-resolution/01-pipeline-dataflow-errors.md)

## Official Documentation

- [Copy activity performance and scalability guide](https://learn.microsoft.com/en-us/fabric/data-factory/copy-activity-performance-and-scalability-guide)
- [How to copy data using copy activity](https://learn.microsoft.com/en-us/fabric/data-factory/copy-data-activity)
- [How Direct Lake works](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-how-it-works)
- [Understand Direct Lake query performance](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-understand-storage)
- [Dataflow Gen2 refresh](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-refresh)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](04-realtime-optimization.md) | [↑ Back to Section](./performance-optimization.md) | [Next →](../resources/cheat-sheets/cheat-sheets.md)**
