---
title: Spark Optimization
type: topic
tags:
  - dp-700
  - fabric
  - performance-optimization
  - spark
  - native-execution-engine
  - autotune
  - aqe
  - high-concurrency
---

# Spark Optimization

## Overview

Spark performance in Fabric is shaped by settings at three levels — session/query config, pool/environment settings, and workspace-wide resource profiles — plus a handful of Fabric-specific accelerators layered on top of open-source Spark: the native execution engine, autotune, high concurrency mode, and intelligent cache. This topic covers all of them, cross-linking to [01-Fabric Workspace Settings: Spark Settings](../01-fabric-workspace-settings/01-spark-settings.md) rather than re-explaining pool types, environments, and autoscale from scratch.

> [!abstract]
>
> - The **native execution engine** (Velox + Gluten) offloads supported operators to a vectorized C++ path — currently in preview, enabled per environment or per session, with an automatic JVM fallback for unsupported operators
> - **Autotune** is off by default and tunes exactly three configs (`shuffle.partitions`, `autoBroadcastJoinThreshold`, `files.maxPartitionBytes`) using a per-query-shape ML model
> - **Adaptive Query Execution (AQE) is on by default** in all Fabric runtimes — it's not something you need to remember to enable
> - **High concurrency mode** shares one Spark session across up to 5 notebooks by default (up to 50 with tuning), cutting session-start latency by up to 36x for custom pools
> - **Intelligent cache** is on by default at 50% of node cache size, transparently caching OneLake/ADLS Gen2 shortcut reads

> [!tip] What the Exam Tests
>
> - Knowing native execution engine's enablement levels, current preview status, and its automatic fallback behavior
> - Recognizing autotune's default-off state and which three configs it tunes
> - Knowing AQE is on by default — a distractor option claiming you need to "enable" it should be treated with suspicion
> - Choosing `repartition()` vs. `coalesce()`, and reading `spark.sql.shuffle.partitions` tuning scenarios

---

## Native Execution Engine

Full mechanics — Velox/Gluten architecture, enablement at the environment/session level, Spark UI identification, and the detailed limitations list — live in [01-Fabric Workspace Settings: Spark Settings — Native Execution Engine](../01-fabric-workspace-settings/01-spark-settings.md#native-execution-engine). The performance-focused summary:

- **Status**: preview, supported on Runtime 1.3 (Spark 3.5) and Runtime 2.0 (Spark 4.1); requires no code changes
- **Enable**: environment-level via the **Acceleration** tab toggle (all jobs/notebooks inherit it), or session-level via `spark.native.enabled = true` in the first notebook cell / Spark Job Definition
- **When it helps most**: computationally intensive queries over Parquet/Delta with complex transformations and aggregations — not simple or I/O-bound queries
- **Fallback**: automatic and silent by default — an unsupported operator or expression reverts to the JVM engine with no interruption; **Fabric Spark Advisor** surfaces a real-time alert in the notebook cell when a fallback happens, and Spark UI query plans show *Transformer*/`NativeFileScan`/`VeloxColumnarToRowExec`-suffixed nodes (green in the Query Execution Graph) for anything the native engine actually handled

> [!note] Mental model — native execution engine as a fast lane
> Think of the native execution engine as a **fast lane on a highway** — supported operators (Parquet/Delta scans, most aggregations and joins) get routed onto it automatically, unsupported ones (structured streaming, JSON/XML, ANSI mode) merge back into the regular lane without you doing anything. The performance question isn't "did I remember to route traffic correctly" — it's "how much of my workload's traffic *can* use the fast lane," which is what the Spark UI's native/JVM node coloring answers.

## Autotune

Autotune automatically discovers and applies Spark configuration values per query shape, using historical execution data — an alternative to manual trial-and-error tuning.

| Aspect | Detail |
| :--- | :--- |
| Status | Preview, available in all production regions |
| Default | **Off** — `spark.ms.autotune.enabled = false` |
| Enable | Environment-level (all jobs inherit) or single-session (`spark.conf.set('spark.ms.autotune.enabled', 'true')`) |
| Best for | Repetitive queries, long-running queries (>15 seconds), Spark SQL API (not RDD API) |
| Incompatible with | Runtime versions after 1.2, high concurrency mode, private endpoints |

Autotune tunes exactly three configs, each with a documented Spark default it starts from:

| Config | Purpose | Default |
| :--- | :--- | :--- |
| `spark.sql.shuffle.partitions` | Partition count for shuffles during joins/aggregations | 200 |
| `spark.sql.autoBroadcastJoinThreshold` | Max table size to broadcast during a join | 10 MB |
| `spark.sql.files.maxPartitionBytes` | Max bytes packed per partition when reading files (Parquet/JSON/ORC) | 128 MB |

It works iteratively: start from defaults, generate candidate configurations around a baseline, predict the best candidate with a model trained on prior runs, apply and execute, feed results back. Built-in regression detection skips tuning when a run looks anomalous (unusually large data volume, for example). Convergence typically takes **20–25 iterations**. Driver logs prefixed `[Autotune]` show per-query recommendations and status codes (`AUTOTUNE_DISABLED`, `QUERY_DURATION_TOO_SHORT`, `QUERY_TUNING_SUCCEED`, etc.).

> [!warning] Common Mistake
> Enabling autotune and expecting immediate gains on a one-off query. Autotune needs a *repeated query shape* and roughly 20–25 iterations of the same pattern to converge — it's built for recurring notebook/pipeline workloads, not ad hoc exploratory queries. It's also silently incompatible with high concurrency mode and any runtime past 1.2, so enabling it on an incompatible session does nothing and won't produce an error to flag the mismatch.

## Pool Startup Latency and Executor Sizing

Starter pool vs. custom pool tradeoffs, node sizing, and autoscale/dynamic allocation mechanics are covered in full in [01-Fabric Workspace Settings: Spark Settings](../01-fabric-workspace-settings/01-spark-settings.md#starter-pools-vs-custom-pools). The performance framing that matters for this section: starter pools are pre-warmed for near-instant session starts, while custom pools provision on demand unless a session-sharing mechanism (high concurrency mode, below) is in play — the choice between them is a startup-latency-vs-configuration-control tradeoff, not a raw compute-performance one.

## Adaptive Query Execution (AQE)

AQE re-optimizes a query plan at runtime using statistics gathered from completed shuffle/broadcast stages — information that isn't available at plan-compile time. **AQE is enabled by default in all Fabric runtimes.**

What AQE does at runtime:

- **Coalesces post-shuffle partitions** — merges small shuffle partitions to avoid excessive task overhead
- **Converts sort-merge joins to broadcast joins** when runtime statistics show one side is small enough
- **Detects and splits skewed partitions** (`spark.sql.adaptive.skewJoin.enabled`) so one oversized partition doesn't bottleneck an entire stage

The native execution engine preserves AQE, cost-based rewrites, column pruning, and predicate pushdown when it offloads operators — these optimizer behaviors stay active regardless of which engine executes a given operator.

> [!warning] Common Mistake
> Treating a question about "enabling AQE" as requiring an action. AQE ships on by default across Fabric runtimes — a scenario describing skew-related slowness usually wants you to recognize `spark.sql.adaptive.skewJoin.enabled` (already on) or reason about *why* AQE isn't fully solving the problem (for example, extreme skew beyond what dynamic partition splitting can absorb), not to "turn AQE on."

## Broadcast Joins and Hints

`spark.sql.autoBroadcastJoinThreshold` (default 10 MB) controls the max size Spark will automatically broadcast to every worker instead of shuffling both sides of a join — broadcasting the small side of a join avoids an expensive shuffle entirely. When the optimizer's size estimate is wrong (common after a filter that isn't reflected in stale statistics), force the decision explicitly:

```python
from pyspark.sql.functions import broadcast
result = large_df.join(broadcast(small_df), "join_key")
```

AQE's runtime join-conversion (above) reduces how often a manual hint is needed — it can promote a sort-merge join to broadcast mid-query once real shuffle statistics are available, even if the compile-time estimate said no.

## Caching: DataFrame Cache vs. Intelligent Cache

Two distinct caching mechanisms operate at different layers:

| Mechanism | Layer | Scope | Manual control |
| :--- | :--- | :--- | :--- |
| `df.cache()` / `df.persist()` | Spark DataFrame/RDD | A specific DataFrame reused multiple times in one job/session | Yes — explicit, and must be unpersisted when no longer needed |
| **Intelligent cache** | Spark node (SSD) | Any file read from OneLake or ADLS Gen2 via shortcut | No — on by default, self-managing |

Intelligent cache is enabled by default for all Spark pools with **50% of node cache size** allocated, and reports up to a **60% performance improvement** on subsequent reads of already-cached files. It automatically detects source-file staleness (comparing remote storage tags) and refreshes, and evicts least-recently-read data when the allocation fills up — no code change required to benefit from it.

`df.cache()`/`persist()` remains the right tool when a DataFrame is the *result of an expensive transformation* (not just a raw file read) that's reused multiple times downstream in the same job — intelligent cache only helps at the file-read layer, not for materializing intermediate computed results.

> [!note] Mental model — intelligent cache vs. df.cache()
> Intelligent cache is a **library that automatically keeps popular books on the front shelf** — no request needed, it just notices what gets read often. `df.cache()` is **checking a book out and keeping it on your desk** — a deliberate choice for a specific, expensive-to-recompute result you know you'll reference again in the same session. Use the front-shelf behavior implicitly; reach for `cache()` only for genuinely expensive, reused intermediate DataFrames.

## Partition Tuning: repartition() vs. coalesce()

`spark.sql.shuffle.partitions` (default 200, autotune-adjustable) sets the partition count Spark targets after a shuffle (join, `groupBy`, wide aggregation). Two DataFrame methods change partition count directly:

| Method | Shuffle? | Direction | Use when |
| :--- | :--- | :--- | :--- |
| `repartition(n)` | Full shuffle | Increase or decrease, evenly rebalanced | Data is skewed across current partitions, or you need *more* partitions for parallelism before a wide operation |
| `coalesce(n)` | No full shuffle (merges adjacent partitions) | Decrease only | Reducing partition count after a filter that dropped most rows, especially right before a write, to avoid a small-file explosion |

`coalesce()` is cheaper because it avoids a full shuffle, but it can't fix skew or increase partition count — it just merges existing partitions together. A common pattern: filter a large DataFrame down to a small result, then `coalesce(1)` (or a small number) before writing, so the output isn't scattered across hundreds of tiny files.

**Practice Question 1** *(Easy)*

A Spark job filters a 500-partition DataFrame down to roughly 2% of its original rows, then writes the result to a Delta table. The write produces hundreds of very small files. What's the most appropriate fix?

A. Call `repartition(500)` before the write to keep the original partition count  
B. Call `coalesce(n)` with a small `n` before the write  
C. Increase `spark.sql.shuffle.partitions` to 1000  
D. Enable autotune for the session  

> [!success]- Answer
> **B. Call coalesce(n) with a small n before the write**
>
> After an aggressive filter, most of the original 500 partitions hold very few rows — writing them as-is produces hundreds of tiny files. `coalesce()` merges the now-mostly-empty partitions cheaply (no full shuffle) to consolidate into a small number of well-sized output files. `repartition(500)` (A) would keep the small-file problem and add shuffle cost. Increasing `shuffle.partitions` (C) affects future shuffles, not the already-filtered DataFrame's current partition count. Autotune (D) doesn't target post-filter partition consolidation — it tunes shuffle/broadcast/file-read configs, not this specific write pattern.

## optimizeWrite and Bin-Size Configs

The Delta-table-side small-file mechanics (`optimizeWrite`, `optimizeWrite.binSize`, adaptive target file size, resource profiles) are covered in full in [01-Lakehouse Optimization](./01-lakehouse-optimization.md#the-small-file-problem) — this file's angle is purely the Spark session/job configuration surface: these are `spark.conf.set(...)` session properties (or environment-level Spark properties) exactly like the other tuning knobs on this page, so they compose with `shuffle.partitions`, autotune, and resource profiles in the same session.

## High-Concurrency Session Reuse

High concurrency mode lets compatible Spark workloads share one running Spark session instead of each starting its own — see [01-Fabric Workspace Settings: Spark Settings — High Concurrency Mode](../01-fabric-workspace-settings/01-spark-settings.md#high-concurrency-mode) for the full mechanics. Performance-relevant specifics:

- Session sharing requires: single-user boundary, same default Lakehouse, same Spark compute settings
- **Session start can be up to 36x faster** for custom pools running in high concurrency mode, because subsequent workloads join an already-running session instead of provisioning a new one
- Each workload gets its own REPL core (a per-notebook code interpreter) with isolated execution state; executors are allocated via **FAIR scheduling** across REPL cores to reduce starvation
- Default sharing limit: **5 notebooks per session**; tunable up to **50** via `spark.highConcurrency.max` on the shared Environment
- Only the initiating notebook/pipeline activity is billed for Spark compute — subsequent shared sessions aren't billed separately

| Scenario | Recommended action |
| :--- | :--- |
| Large-scale parallel pipelines with many notebook activities | Increase `spark.highConcurrency.max` to reduce session fragmentation |
| Peak-load interactive workloads, many concurrent users | Increase the limit to improve session acquisition time |
| Cost-sensitive workloads where dense packing helps | Tune the limit to match concurrency requirements |
| Strict isolation requirements | Keep the default limit of 5 or lower |

**Practice Question 2** *(Medium)*

A workspace runs 20 notebook activities in parallel every night via a pipeline, all against the same default Lakehouse and identical Spark compute settings, on custom pools with high concurrency mode enabled. Session acquisition is still slow because the default sharing limit caps out well before all 20 activities can join one session. What's the fix?

A. Switch from custom pools to starter pools  
B. Enable autotune to speed up session acquisition  
C. Increase `spark.highConcurrency.max` on the Environment, up to 50  
D. Disable high concurrency mode so each activity gets a dedicated session  

> [!success]- Answer
> **C. Increase spark.highConcurrency.max on the Environment, up to 50**
>
> The default session-sharing limit is 5 notebooks; it's explicitly documented as tunable up to 50 via `spark.highConcurrency.max` on the Environment used by the notebooks/pipeline activities, so more than the default 5 can share one session. Switching pool types (A) doesn't change the sharing limit. Autotune (B) tunes query-level Spark configs, not session-sharing behavior. Disabling high concurrency (D) would make the slow-session-start problem worse, not better, since every activity would then provision its own session from scratch.

## Decision Guidance: Symptom → Lever

| Symptom | Most likely lever | Why |
| :--- | :--- | :--- |
| Notebook is slow but correct, heavy on joins/aggregations over Parquet/Delta | Native execution engine | Vectorized C++ path speeds up exactly this pattern; verify offload via Spark UI |
| Same recurring query shape keeps needing manual `shuffle.partitions`/broadcast tuning | Autotune | Built for repetitive, long-running queries; converges over ~20–25 iterations |
| One partition/task runs far longer than its peers in the same stage | AQE skew-join handling (already on) | Investigate why AQE isn't fully absorbing the skew — extreme skew may need a manual salting strategy beyond AQE's reach |
| Join is slow despite one side being small | Broadcast threshold or hint | Force with `broadcast()`, or trust AQE's runtime join conversion |
| Many small output files after a heavy filter | `coalesce()` before write | Cheaper than `repartition()`, avoids a full shuffle |
| Repeated Spark session start latency across many parallel notebooks | High concurrency + `spark.highConcurrency.max` | Session sharing avoids repeated cold starts; up to 36x faster |
| Repeated reads of the same OneLake/ADLS shortcut files are still slow | Confirm intelligent cache is actually on for the pool | On by default, but verify — a custom pool policy could have altered it |

> [!note] Mental model — layering the accelerators
> These four accelerators aren't alternatives — they stack. A notebook can run on a high-concurrency shared session, with intelligent cache handling file reads, AQE re-optimizing shuffles at runtime, and the native execution engine offloading supported operators, all simultaneously. Troubleshooting slow Spark performance means checking which of these layers *isn't* actually engaged for the specific query, not picking just one to enable.

**Practice Question 3** *(Medium)*

A recurring nightly notebook job runs the same parameterized aggregation query (only a date filter value changes) against a large Delta table, taking 45 seconds each run. The team wants to reduce this without rewriting the query. Which combination of levers is most appropriate to try first?

A. Enable autotune at the environment level for this repetitive query  
B. Manually tune `spark.sql.shuffle.partitions` to a random higher value  
C. Switch to a starter pool to reduce session startup time, since that's the entire 45 seconds  
D. Disable AQE to reduce runtime re-optimization overhead  

> [!success]- Answer
> **A. Enable autotune at the environment level for this repetitive query**
>
> This query matches autotune's ideal profile precisely: repetitive shape, long-running (well over the 15-second minimum), Spark SQL API — a strong autotune candidate, while AQE and intelligent cache stay as-is since they're already active by default and don't need action. Randomly guessing a `shuffle.partitions` value (B) is exactly the manual trial-and-error autotune exists to replace. Startup time (C) is a session-acquisition cost, not query execution time, and 45 seconds of *query* runtime isn't explained by pool startup alone. Disabling AQE (D) would very likely make performance worse, not better.

## Use Cases

- Deciding whether a computationally heavy notebook workload is a good candidate for the native execution engine, and confirming actual offload via the Spark UI or Fabric Spark Advisor
- Enabling autotune for a recurring, long-running pipeline notebook while leaving it off for ad hoc exploratory sessions
- Choosing `coalesce()` over `repartition()` after an aggressive filter, right before a write
- Tuning `spark.highConcurrency.max` upward for a pipeline that fans out many parallel notebook activities against the same Lakehouse

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Native execution engine shows no performance improvement | Query uses unsupported operators/formats (structured streaming, JSON/XML, ANSI mode) and silently falls back to JVM | Check Spark UI for *Transformer*/`NativeFileScan` node presence, or Fabric Spark Advisor alerts, to confirm actual offload |
| Autotune enabled but no tuning applied | Session uses high concurrency mode, a private endpoint, or a runtime past 1.2 — all incompatible with autotune | Disable the incompatible feature for that session, or accept manual tuning for that workload |
| Write produces hundreds of tiny files after a heavy filter | Original partition count (e.g. 500) carried forward into a much smaller result set | `coalesce()` to a small partition count before the write |
| Join is unexpectedly slow despite one side being small | Compile-time size estimate exceeded `autoBroadcastJoinThreshold` due to stale statistics | Force with an explicit `broadcast()` hint, or rely on AQE's runtime join conversion |
| Parallel pipeline notebooks queue up waiting for session capacity | Default high-concurrency sharing limit (5) reached | Increase `spark.highConcurrency.max` up to 50 on the shared Environment |

## Best Practices

- Enable the native execution engine at the environment level for compute-intensive workloads; verify actual offload rather than assuming it's helping
- Reserve autotune for repetitive, long-running (>15s) Spark SQL workloads; skip it for one-off exploratory queries and incompatible session types
- Prefer `coalesce()` over `repartition()` when only reducing partition count post-filter, to avoid an unnecessary full shuffle
- Let intelligent cache and AQE do their default job; reach for `df.cache()` only for expensive, reused intermediate results
- Raise `spark.highConcurrency.max` deliberately for high-fanout parallel pipelines, keeping the default elsewhere for isolation

## Exam Tips

> [!tip] Exam Tips
>
> - Native execution engine: preview, Runtime 1.3/2.0, `spark.native.enabled`, automatic silent fallback to JVM for unsupported operators
> - Autotune: **off by default** (`spark.ms.autotune.enabled = false`), tunes `shuffle.partitions` (200), `autoBroadcastJoinThreshold` (10 MB), `files.maxPartitionBytes` (128 MB); needs ~20–25 iterations, incompatible with high concurrency/private endpoints/Runtime >1.2
> - **AQE is on by default** in all Fabric runtimes — no enablement step needed
> - `repartition()` = full shuffle, can increase or decrease; `coalesce()` = no full shuffle, decrease only
> - High concurrency: default **5** notebooks/session, tunable to **50** via `spark.highConcurrency.max`; up to **36x** faster session start
> - Intelligent cache: on by default, **50%** of node cache size, up to **60%** faster repeat reads

## Key Takeaways

- Native execution engine, autotune, and high concurrency mode are all Fabric-specific accelerators layered on top of standard Spark — each has a distinct enablement mechanism and compatibility boundary
- AQE and intelligent cache require no action to benefit from — they're on by default; the exam angle is recognizing that, not enabling them
- `coalesce()` vs. `repartition()` is a shuffle-cost decision, not just a partition-count decision
- High concurrency's 36x session-start improvement and up-to-50 sharing limit make it the primary lever for high-fanout parallel notebook pipelines
- Small-file mechanics for Spark writes live in [01-Lakehouse Optimization](./01-lakehouse-optimization.md) — this file only covers the session-level configuration surface

## Related Topics

- [01-Fabric Workspace Settings: Spark Settings](../01-fabric-workspace-settings/01-spark-settings.md)
- [01-Lakehouse Optimization](./01-lakehouse-optimization.md)
- [07-Batch Transformation: PySpark Transformations](../07-batch-transformation/02-pyspark-transformations.md)
- [10-Error Resolution: Notebook and T-SQL Errors](../10-error-resolution/02-notebook-tsql-errors.md)

## Official Documentation

- [Native execution engine for Fabric Data Engineering](https://learn.microsoft.com/en-us/fabric/data-engineering/native-execution-engine-overview)
- [Configure autotune for Apache Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/autotune)
- [High concurrency mode in Apache Spark compute for Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/high-concurrency-overview)
- [Intelligent cache in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/intelligent-cache)
- [Configure Resource Profile Configurations](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-resource-profile-configurations)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-warehouse-optimization.md) | [↑ Back to Section](./performance-optimization.md) | [Next →](./04-realtime-optimization.md)**
