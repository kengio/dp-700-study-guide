---
title: "Optimization Levers — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - performance
  - optimization
  - v-order
  - spark
  - warehouse
---

# Optimization Levers — Quick Reference

The symptom→lever master table across Lakehouse, Warehouse, Spark, Real-Time, and Pipeline/Query surfaces. Condensed from [11-performance-optimization](../../11-performance-optimization/performance-optimization.md), with the error-class boundary from [10-error-resolution](../../10-error-resolution/error-resolution.md).

> [!abstract] Quick Reference
>
> - V-Order/OPTIMIZE/VACUUM numbers and the small-file problem's two defenses
> - Warehouse statistics, caching layers, result-set caching (incl. the disabled disclosure)
> - Spark levers: NEE, AQE, autotune, high concurrency, intelligent cache
> - Real-Time Intelligence levers: caching vs. retention, materialized view vs. update policy
> - Pipeline levers: DIU/parallelism, staging, `ForEach` anti-pattern, Direct Lake guardrails

---

## Error-Class Boundary (read this first)

> [!note] "It failed" has an error code — that's [10-error-resolution](../../10-error-resolution/error-resolution.md). "It's slow but succeeded" is this sheet. Query folding loss, ingestion batching latency, and DirectQuery fallback are all **degraded-but-succeeding** — performance problems, not errors to look up in the other sheet.

---

## Symptom → Lever Master Table

| Symptom | Lever | Surface |
| :--- | :--- | :--- |
| Nightly ingestion slowed after no code change | Disable V-Order for write-heavy sessions; apply later via scheduled `OPTIMIZE...VORDER` | Lakehouse |
| Query performance degrades gradually, no schema change | Optimize write / auto compaction / scheduled `OPTIMIZE` | Lakehouse |
| `MERGE`/`UPDATE` latency climbing on a large table | `OPTIMIZE` to bring files into 128 MB–1 GB adaptive range | Lakehouse |
| First query after bulk load is slow | Expected — synchronous auto statistics; pre-warm with `CREATE STATISTICS...FULLSCAN` | Warehouse |
| Qualifying `SELECT` never shows `result_cache_hit` | Check disqualification list (row count, `GETDATE()`, wide types, security features) — or feature is tenant-disabled | Warehouse |
| Row-by-row `INSERT` loop very slow | Replace with CTAS or set-based `INSERT...SELECT` | Warehouse |
| Notebook slow but correct, heavy joins/aggs over Parquet/Delta | Native execution engine | Spark |
| Same recurring query shape needs manual tuning repeatedly | Autotune | Spark |
| One partition/task runs far longer than peers | AQE skew-join (already on) — investigate why it's not absorbing skew | Spark |
| Many small output files after heavy filter | `coalesce()` before write | Spark |
| Repeated Spark session-start latency across parallel notebooks | High concurrency + `spark.highConcurrency.max` | Spark |
| Queries on old data slow, recent data fast | Caching policy too short | Real-Time (Eventhouse) |
| Data older than expected is simply gone | Retention policy (this is by design, not a bug) | Real-Time (Eventhouse) |
| Same aggregation recomputed every dashboard refresh | Materialized view | Real-Time (Eventhouse) |
| Eventstream throughput plateaus despite raising throughput level | Event Hubs source partition count < 4 (bottleneck, not the level setting) | Real-Time (Eventstream) |
| KQL query scans far more data than expected | Missing/late time-range filter | Real-Time (KQL) |
| Copy activity throughput lower than expected on large relational source | Partition option on the source | Pipeline |
| `ForEach` over large record set takes hours | Redesign to set-based operation, not `batchCount` tuning | Pipeline |
| Direct Lake on OneLake refresh fails on guardrail error | `OPTIMIZE`/`VACUUM` the source lakehouse table | Pipeline/Direct Lake |
| Direct Lake on SQL queries slower, no error | Identify DirectQuery fallback trigger (RLS/DDM/OLS, unmaterialized view, guardrail) | Pipeline/Direct Lake |
| Dataflow Gen2 refresh duration creeping up, no error | Redesign query to preserve folding | Pipeline |
| Long-running Copy job intermittently times out | Workspace staging's 60-minute limit — use external storage | Pipeline |

---

## Lakehouse: V-Order / OPTIMIZE / VACUUM

| Fact | Value |
| :--- | :--- |
| `OPTIMIZE` order when combined | ==bin compaction → Z-Order → V-Order== |
| V-Order config property | `spark.sql.parquet.vorder.default`, default ==false== (new workspaces, `writeHeavy` profile) |
| V-Order write cost | ~15% slower writes |
| V-Order read benefit | Up to 50% more compression; ==40–60% faster== cold-cache Direct Lake queries; ~10% faster SQL endpoint reads |
| Precedence | Session > table property |
| `VACUUM` default retention | ==7 days==; shorter requires `spark.databricks.delta.retentionDurationCheck.enabled = false` |
| Adaptive target file size | 128 MB (tables <10 GB) scaling to 1 GB (tables >10 TB) |
| Deletion vectors | On by default from ==Runtime 2.0 (Delta 4.1)==; `OPTIMIZE` auto-purges files >5% DV-referenced rows |

**Small-file problem — two defenses:**

| Mechanism | When | Default |
| :--- | :--- | :--- |
| Optimize write (pre-write bin-packing) | Before write lands | Profile-dependent; off for non-partitioned under `writeHeavy` |
| Auto compaction (post-write) | Immediately after commit | Off by default |

Partition on **low-cardinality** columns (dozens–thousands of values); use **Z-Order** for higher-cardinality or multi-column selective filters. Over-partitioning recreates the small-file problem one level up.

---

## Warehouse: Statistics, Caching, Result-Set Caching

- Automatic statistics: histogram (`_WA_Sys_`), avg column length (`ACE-AverageColumnLength_`, VARCHAR >100 chars), table cardinality (`ACE-Cardinality`) — all synchronous at query time, all in `sys.stats`. Manual `CREATE/UPDATE STATISTICS` is **single-column only**.
- In-memory + disk caching: ==always on, cannot be disabled or manually cleared==.
- ==Result-set caching is currently disabled tenant-wide== (known issue since 2026-02-16, bug risking stale results) — `result_cache_hit = 0` right now may mean the feature is off entirely, not that a query tripped a disqualifier. Documented behavior (when live): item-level default-on, disqualified by row count (<100K scanned or >10K returned), `GETDATE()`/non-deterministic functions, `VARCHAR(MAX)`, RLS/DDM, time travel, cross-database queries.
- `queryinsights.*` views: 30-day retention, up to 15-min ingestion lag. Key view: `exec_requests_history` (CPU, data scanned, `result_cache_hit`, `query_hash`).
- CTAS = preferred bulk transform-load; row-by-row `INSERT` doesn't scale in a distributed engine.

---

## Spark Levers

| Lever | Default | Key facts |
| :--- | :--- | :--- |
| ==NEE== (native execution engine) | Preview, per-env/session | Vectorized C++, auto silent JVM fallback; helps compute-heavy Parquet/Delta joins/aggs, not I/O-bound |
| ==AQE== | ==On by default==, all runtimes | Coalesces post-shuffle partitions, sort-merge→broadcast conversion, skew-join splitting |
| ==Autotune== | ==Off by default== (`spark.ms.autotune.enabled=false`) | ==Preview==, available in all production regions; tunes `shuffle.partitions` (200), `autoBroadcastJoinThreshold` (10 MB), `files.maxPartitionBytes` (128 MB); needs ~20–25 iterations; incompatible with high concurrency/private endpoints/Runtime >1.2 |
| High concurrency | 5 notebooks/session default | Tunable to 50 via `spark.highConcurrency.max`; up to ==36x== faster session start; only initiator billed |
| Intelligent cache | ==On by default==, 50% of node cache | Up to 60% faster repeat reads of OneLake/ADLS shortcut files; self-managing |

`repartition(n)` = full shuffle, increase or decrease. `coalesce(n)` = no full shuffle, decrease only — the fix for post-filter small-file writes.

---

## Real-Time Intelligence (Eventhouse/Eventstream) Levers

| Policy | Controls | Default |
| :--- | :--- | :--- |
| Caching policy | What stays on hot SSD (query speed) | 3,650 days |
| Retention policy | What exists at all (`SoftDeletePeriod`) | 3,650 days (max 36,500) |

> [!warning] Shortening retention never speeds up queries — it only deletes data. **Caching policy is the query-speed lever.**

| Mechanism | Cost lands | Best for |
| :--- | :--- | :--- |
| Update policy | Per-ingested-batch (folded into ingest) | Parsing/typing/enriching, no aggregation state |
| ==Materialized view== | Continuous background CU | Deduplication/rolling aggregate read repeatedly |

Streaming ingestion: sub-second latency, lower throughput ceiling. Queued (default): seconds-minutes, much higher throughput — queued wins at scale.

Eventstream: Event Hubs source with **<4 partitions is the bottleneck**, regardless of throughput-level setting. KQL's single highest-leverage, zero-config win: **filter on time first** (extent-level pruning).

---

## Pipeline & Query Levers

| Setting | Range | Default |
| :--- | :--- | :--- |
| DIUs | 4–256 | ==Auto== |
| Degree of copy parallelism | Configurable | Auto |

- Staging **required** for Fabric Warehouse sinks; workspace-managed staging **times out at 60 minutes** — use external storage for longer jobs. Staged copy compression helps constrained network links even when staging isn't required.
- Partition option (source-side, relational): splits one large read into parallel range-based sub-reads.
- Binary copy (no parsing) vs. parsed copy (schema/type conversion needed) — pick binary when no transform is genuinely needed.
- `ForEach` is sequential by default; the real fix for row-scale slowness is **redesigning to set-based**, not just tuning `batchCount`.

### Direct Lake Guardrail Fallback (differs by variant)

| Variant | On guardrail breach |
| :--- | :--- |
| Direct Lake on OneLake | ==Refresh FAILS== — no DirectQuery fallback exists |
| Direct Lake on SQL | ==Falls back to DirectQuery== (if enabled) — succeeds, slower |

Both trace back to lakehouse file-size health — `OPTIMIZE`/`VACUUM` is the fix either way.

Query folding loss (Dataflow Gen2): a **performance** symptom (slow, no error) — preserve it by keeping filter/select steps early, avoiding cross-source mixing, and being deliberate about `Table.Buffer` (which always ends folding from that point forward).

---

## Gotchas & Traps

- V-Order defaults to **off** in new workspaces — don't assume it's on because older material says so.
- Shortening `VACUUM` retention or Eventhouse retention policy is a data-lifecycle decision, never a performance fix — caching policy (Eventhouse) or file-size health (Lakehouse) are the actual speed levers.
- AQE is already on — a scenario option to "enable AQE" is a distractor; investigate why it isn't fully absorbing the problem instead.
- Autotune needs a *repeated* query shape and ~20-25 iterations — it does nothing useful for a one-off query, and is silently incompatible with high concurrency/private endpoints/Runtime >1.2 with no error to flag the mismatch.
- Result-set caching is tenant-disabled right now — don't diagnose a live `result_cache_hit=0` purely against the documented disqualification list without checking current status first.
- Direct Lake on OneLake and Direct Lake on SQL behave completely differently on guardrail breach — memorize which one fails outright vs. falls back.
- A `ForEach`-wrapped per-row pattern is not fixed by tuning `batchCount` — it needs a set-based redesign, the same lesson as Warehouse's row-by-row `INSERT` anti-pattern.
- Eventstream throughput plateaus below 4 Event Hubs source partitions no matter how high you set the throughput level — the fix is repartitioning the Event Hub, not the Eventstream setting.

## Before the Exam, I Can…

- [ ] State the `OPTIMIZE` combined order (bin compaction → Z-Order → V-Order) and V-Order's write/read tradeoff numbers
- [ ] Explain the two small-file defenses (optimize write vs. auto compaction) and when each applies
- [ ] Recite Warehouse's 3 automatic statistics types and the current result-set-caching disclosure
- [ ] Distinguish AQE (always on) from autotune (off by default, 3 specific configs) from NEE (preview, silent fallback)
- [ ] Explain caching policy vs. retention policy in Eventhouse and why only one affects query speed
- [ ] Choose materialized view vs. update policy based on cost profile
- [ ] Explain the Direct Lake guardrail fallback difference between OneLake and SQL variants
- [ ] Recognize the `ForEach` per-row anti-pattern and its Warehouse-side twin

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
