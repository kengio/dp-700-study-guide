---
title: Lakehouse Optimization
type: topic
tags:
  - dp-700
  - fabric
  - performance-optimization
  - lakehouse
  - delta-lake
  - v-order
  - vacuum
  - optimize
  - z-order
---

# Lakehouse Optimization

## Overview

Delta Lake tables in a Fabric lakehouse accumulate small files and stale versions the same way any append-heavy storage does, and query performance degrades predictably as a result. This topic covers the maintenance operations that keep tables healthy — `OPTIMIZE` bin-compaction, V-Order, Z-Order, and `VACUUM` — plus the small-file problem they exist to solve, partitioning guidance, the portal's table maintenance UI, statistics on the lakehouse SQL endpoint, and Delta deletion vectors.

> [!abstract]
>
> - `OPTIMIZE` compacts small files into larger ones; adding `VORDER` or `ZORDER BY (col)` layers on additional read optimizations during the same rewrite
> - **V-Order is disabled by default in new Fabric workspaces** (`spark.sql.parquet.vorder.default = false`) — a write-heavy-by-default posture, not an oversight
> - `VACUUM`'s default retention is **7 days**; going shorter requires disabling a safety check and trades away time-travel history
> - The small-file problem is addressed from two directions: **optimize write** (pre-write bin-packing) and **adaptive target file size** (post-write `OPTIMIZE` sizing that scales 128 MB → 1 GB as a table grows)
> - **Deletion vectors** are on by default starting Runtime 2.0 (Delta 4.1), avoiding full-file rewrites for small deletes/updates — but oversized files make their eventual purge more expensive, tying file-size discipline to more than just read speed

> [!tip] What the Exam Tests
>
> - Choosing when to enable V-Order (read-heavy) vs. leave it off (write-heavy ingestion) and knowing the config property name
> - Reading `VACUUM` retention behavior — the 7-day default, why the portal refuses shorter intervals by default, and the property that overrides it
> - Recognizing the small-file problem's symptoms and picking the right lever: optimize write, auto compaction, or scheduled `OPTIMIZE`
> - Knowing when Z-Order helps (multi-column selective filters) vs. when partitioning is the better fit (low-cardinality, coarse pruning)

---

## OPTIMIZE and Bin-Compaction

`OPTIMIZE` is the foundational Delta Lake maintenance command: it groups small files into target-sized bins and rewrites them, reducing file count and metadata overhead on every subsequent read.

```sql
OPTIMIZE dbo.table_name
```

| Property | Description | Default | Session config |
| :--- | :--- | :--- | :--- |
| `minFileSize` | Files smaller than this are grouped and rewritten | 1 GB (`1073741824`) | `spark.databricks.delta.optimize.minFileSize` |
| `maxFileSize` | Target size produced by `OPTIMIZE` | 1 GB (`1073741824`) | `spark.databricks.delta.optimize.maxFileSize` |

`OPTIMIZE` is idempotent by design, but an oversized `minFileSize` can cause **write amplification** — a 900 MB file gets rewritten again after even a small extra write, because it's still "small" relative to a 1 GB threshold. Two mitigations exist and are both opt-in (not on by default):

- **Fast optimize** (`spark.microsoft.delta.optimize.fast.enabled`) skips bins unlikely to reach a meaningfully compacted size, evaluated against `minNumFiles` (default 50) and a `parquetCoefficient` (default 1.3) that accounts for compression gains when merging files. Not applicable to Z-Order or liquid clustering runs.
- **File-level compaction targets** (`spark.microsoft.delta.optimize.fileLevelTarget.enabled`) skip recompacting files that already met at least half the target size when they were last compacted, protecting prior compaction work as the adaptive target grows over time.

### OPTIMIZE with Z-Order and V-Order

```sql
OPTIMIZE dbo.table_name ZORDER BY (column1, column2) VORDER
```

When both clauses are present, Spark applies them in a fixed order: **bin compaction → Z-Order → V-Order**. Z-Order is fully supported in Fabric — it colocates rows with similar values in the Z-Order columns into the same files, improving file-skipping for queries that filter on those columns together (for example, `date` + `customer_id`). Liquid clustering, a newer Delta Lake feature specified as a table option, works similarly but only applies its clustering policy when `OPTIMIZE` runs — regular writes never cluster data, so a compaction schedule (auto compaction or manual `OPTIMIZE`) is required to realize its benefit.

> [!note] Mental model — bin-compaction vs. Z-Order vs. V-Order
> Think of these as three independent layers applied to the same rewrite, in this order: **bin-compaction** decides *how many files* exist (fewer, bigger); **Z-Order** decides *what's colocated inside* those files (similar filter values together, for selective multi-column predicates); **V-Order** decides *how each file is internally encoded* (sorted/compressed for faster reads by any Fabric engine). You can use one, two, or all three — they're not alternatives to each other.

## V-Order: Write Cost vs. Read Benefit

V-Order is a write-time Parquet optimization — applying VertiPaq-style sorting, encoding, and compression — that stays fully open-source Parquet-compliant and composes with Z-Order and standard Delta operations (compaction, vacuum, time travel).

| Aspect | Detail |
| :--- | :--- |
| Where it helps | Read-heavy patterns: dashboarding, interactive analytics, repeated scans |
| Write-time cost | ~15% slower writes on average |
| Read benefit | Up to 50% more compression; ==40–60% faster cold-cache Power BI Direct Lake queries==; ~10% faster SQL analytics endpoint/Warehouse reads |
| Scope | File-level — applies per Parquet file, compatible with Z-Order |
| Current default (new workspaces) | **Disabled** — `spark.sql.parquet.vorder.default = false` |

### Configuration levels

| Level | Mechanism | Notes |
| :--- | :--- | :--- |
| Session | `spark.sql.parquet.vorder.default` (default `false`) | Applies to *all* Parquet writes in the session, including non-Delta Parquet and even Delta tables with the table property explicitly `false` |
| Table | `TBLPROPERTIES("delta.parquet.vorder.enabled")` (unset by default) | A durable per-table default across sessions; `INSERT`/`UPDATE`/`MERGE` apply it once set |
| Write operation | DataFrame writer option `parquet.vorder.enabled` (unset) | Per-write override, useful for one-off jobs against a write-heavy table |

Precedence at write time: **session > table property**, so a session with V-Order on will still V-Order-write a table whose property says `false`. Only *future* writes are affected when you toggle the table property — existing Parquet files keep whatever ordering they were written with until the next `OPTIMIZE ... VORDER` or full rewrite.

```sql
-- Enable V-Order for a session (read-heavy workload)
SET spark.sql.parquet.vorder.default = TRUE;

-- Enable V-Order as a durable table default
ALTER TABLE person SET TBLPROPERTIES("delta.parquet.vorder.enabled" = "true");
```

Fabric also exposes two **resource profiles** that flip V-Order and optimize write together instead of tuning individually: `readHeavyForSpark` and `readHeavyForPBI` (V-Order on, optimize write on with a 1 GB bin size for the PBI profile). New workspaces default to `writeHeavy` (V-Order off, optimize write effectively off for non-partitioned tables).

> [!warning] Common Mistake
> Assuming V-Order is on by default because older material, blog posts, or memory says so. As of the current Fabric docs, **new workspaces default to V-Order disabled** (`writeHeavy` resource profile) specifically to protect write-heavy ingestion and transformation performance. Read-optimized workloads (Direct Lake dashboards, SQL endpoint reporting) need to opt in explicitly — check `spark.conf.get('spark.sql.parquet.vorder.default')` before assuming either way.

**Practice Question 1** *(Medium)*

A team's nightly Spark ingestion job writes 200 GB of new data into a lakehouse table every night, and a separate Power BI Direct Lake report queries that same table throughout the business day. The ingestion job has recently slowed down noticeably. What is the most likely cause, and what's the fix?

A. VACUUM retention is too short, causing time-travel failures during ingestion  
B. V-Order was enabled at the session or table level, adding write-time cost to every nightly write; disable it for the ingestion session and instead enable it only via a scheduled read-optimizing `OPTIMIZE ... VORDER` pass  
C. The lakehouse SQL endpoint has stale statistics, slowing the Spark write path  
D. Auto compaction is disabled, so file counts have grown unbounded  

> [!success]- Answer
> **B. V-Order was enabled at the session or table level, adding write-time cost to every nightly write; disable it for the ingestion session and instead enable it only via a scheduled read-optimizing `OPTIMIZE ... VORDER` pass**
>
> V-Order's documented tradeoff is exactly this: ~15% slower writes for faster reads. A write-heavy nightly job doesn't need V-Order applied during ingestion — applying it later via a scheduled `OPTIMIZE ... VORDER` (or switching only the read-facing table copy to a read-heavy profile) captures the Direct Lake benefit without taxing every nightly write. VACUUM retention (A) and stale SQL endpoint statistics (C) don't affect Spark write throughput, and auto compaction being off (D) would show up as growing file counts, not uniformly slower writes.

## VACUUM and Retention

`VACUUM` removes files no longer referenced by the Delta transaction log and older than the retention threshold — cleaning up files left behind by `OPTIMIZE` rewrites, overwrites, and deletes.

- **Default retention: 7 days.**
- Fabric portal and API maintenance requests **fail by default** for retention intervals under 7 days — this is a deliberate safety guard, not a bug.
- To use a shorter interval, set `spark.databricks.delta.retentionDurationCheck.enabled = false` in the Spark environment's properties.

### Time-travel interplay

`VACUUM`'s retention window directly bounds Delta's time-travel history — you can't query a table version whose underlying files have been vacuumed away. Shortening retention below 7 days:

- Reduces how far back `RESTORE`, `DESCRIBE HISTORY`, and version-based/timestamp-based time travel can reach
- Can affect concurrent long-running readers or writers if files they still need get removed mid-operation

> [!warning] Common Mistake
> Treating the 7-day retention-check failure as a bug to work around reflexively. The portal and API are failing the request *on purpose* — a shorter retention window is a real tradeoff against time travel and concurrent-operation safety, not just an arbitrary default. Only disable the check when you've confirmed no reader/writer needs the history you're about to delete.

## The Small-File Problem

Small files hurt performance from two directions: task/scheduling overhead (Spark has to open, plan, and process many more file handles) and metadata overhead (more entries in the Delta log and more file-skipping decisions). Delta Lake uses file-level metadata for partition pruning and data skipping, so file *size* directly affects how efficient that skipping is.

Fabric attacks the small-file problem from both ends of the write path:

| Mechanism | When it acts | What it does | Default |
| :--- | :--- | :--- | :--- |
| **Optimize write** | Before the write lands | Shuffles in-memory data into optimally sized bins before writing Parquet, so fewer/larger files are produced in the first place | Profile-dependent — off for non-partitioned tables under the default `writeHeavy` profile, on (128 MB bins) for partitioned tables, on with 1 GB bins under `readHeavyForPBI` |
| **Auto compaction** | Immediately after a write commits | Evaluates partition health post-write; if fragmentation is excessive, synchronously triggers `OPTIMIZE` on just that partition | Off by default (session config `spark.databricks.delta.autoCompact.enabled` or table property `delta.autoOptimize.autoCompact`) |
| **Adaptive target file size** | At `OPTIMIZE` time (and CTAS/overwrite writes) | Estimates an ideal target file size from table-size heuristics — 128 MB for tables under 10 GB, scaling linearly up to 1 GB for tables over 10 TB — instead of a fixed size | Not enabled by default; Microsoft recommends enabling it (`spark.microsoft.delta.targetFileSize.adaptive.enabled`) |

Optimize write's target bin size is tunable via `spark.databricks.delta.optimizeWrite.binSize`; a durable per-table target that unifies `OPTIMIZE`, auto compaction, and optimize write behavior is available via the `delta.targetFileSize` table property (byte string, e.g. `256m`).

> [!note] Mental model — pre-write vs. post-write small-file defense
> Optimize write is a **bouncer at the door** — it stops badly-sized files from ever being written. Auto compaction and scheduled `OPTIMIZE` are **cleanup crews** — they fix files after the fact. Optimize write costs a shuffle on every write (some latency now); post-write compaction costs a rewrite later (more I/O, but only when triggered). Streaming/micro-batch ingestion with frequent small writes usually wants auto compaction; large batch jobs that can tolerate a shuffle usually want optimize write.

Auto compaction's default thresholds: `maxFileSize` 128 MB, `minNumFiles` 50 files below the size threshold before it triggers. Starting in Runtime 2.0, `onCheckpointOnly` mode defers the fragmentation evaluation to log-checkpoint time (roughly every 10 commits) instead of every single write, reducing per-commit overhead.

## Partitioning Guidance: When and at What Cardinality

Partitioning a Delta table by a column creates a separate physical folder per distinct value, letting queries that filter on the partition column skip entire folders instead of individual files.

| Choose | When |
| :--- | :--- |
| **Partitioning** | Low-cardinality column (dozens to low thousands of distinct values), queries frequently filter on it alone, each partition holds enough data to produce reasonably sized files |
| **Z-Order** | Higher-cardinality columns, or queries filter on *combinations* of two or more columns together, and coarse folder-level pruning isn't selective enough |
| **Neither** | Table is small enough that full scans are already fast, or filter columns change too often to commit to a physical layout |

Over-partitioning (a high-cardinality column, or partitioning by a column with a long tail of rarely-queried values) recreates the small-file problem one level up — each partition ends up with too few rows to produce a well-sized file, and the number of partition folders itself becomes metadata overhead. See [07-Batch Transformation: PySpark Transformations](../07-batch-transformation/02-pyspark-transformations.md) for the write-side partition syntax (`.write.partitionBy(...)`).

## Table Maintenance UI and Statistics

### Lakehouse table maintenance (portal)

From Lakehouse Explorer, right-click a table (or use the ellipsis) → **Maintenance** opens the **Run maintenance commands** dialog:

- **Optimize** toggle — compacts small files; when on, an **Apply V-Order** checkbox is available, applying V-Order as part of the same rewrite
- **Vacuum** toggle — runs `VACUUM` using the retention-threshold behavior described above
- A third toggle merges transactions into Parquet files and removes obsolete deletion-vector files, cleaning up space from accumulated row-level tombstones

Maintenance applies to Delta tables only — legacy Hive tables (Parquet/ORC/AVRO/CSV without Delta) aren't supported. Runs are trackable via the Notifications pane or **Monitoring hub**, filtering for `TableMaintenance` activity entries. For recurring/scheduled maintenance, the **Lakehouse Maintenance activity** (a Fabric Data Factory pipeline activity, in preview) exposes the same `OPTIMIZE`/`VORDER`/`VACUUM` options and can be chained with data loads and a **Refresh SQL Endpoint** activity in one pipeline.

### Statistics in the lakehouse SQL endpoint

The lakehouse SQL analytics endpoint shares the same statistics engine as Fabric Warehouse (see [02-Warehouse Optimization](02-warehouse-optimization.md) for the full mechanics) — statistics are **automatically created and refreshed at query time** for columns used in `GROUP BY`, `JOIN`, `WHERE`, and `ORDER BY`, with no manual step required. Manual `CREATE STATISTICS`/`UPDATE STATISTICS` is also supported against the SQL endpoint for cases where you want to pre-warm statistics ahead of a known heavy workload rather than pay the cost synchronously on first query.

## Deletion Vectors

Deletion vectors let Delta Lake mark rows as deleted (or updated-away) without rewriting the entire Parquet file that contains them — a lightweight row-level tombstone instead of a full-file rewrite. They're **enabled by default starting in Fabric Spark Runtime 2.0 (Delta 4.1)**.

- Benefit: `DELETE`, `UPDATE`, and `MERGE` operations that touch a small fraction of rows in a large file skip the full rewrite, making those operations meaningfully faster
- Maintenance: `OPTIMIZE` automatically purges files where more than 5% of records are referenced by deletion vectors, folding cleanup into routine compaction rather than requiring a separate step
- File-size interaction: oversized files make deletion-vector cleanup more expensive — the earlier tune-file-size guidance (128 MB–1 GB adaptive targets) matters *more*, not less, once deletion vectors are active, because a poorly sized file accumulates more tombstoned rows before its 5%-purge threshold triggers a full rewrite

**Practice Question 2** *(Hard)*

A 40 GB lakehouse table receives frequent `MERGE` statements that each update roughly 0.1% of its rows, on Fabric Spark Runtime 2.0. The table currently sits in a handful of 30 GB files left over from an early bulk load, and `MERGE` latency has been climbing. What's the most likely explanation?

A. Deletion vectors are disabled on Runtime 2.0, forcing full-file rewrites on every MERGE  
B. The 30 GB files are far above the adaptive target file size range (128 MB–1 GB); even with deletion vectors avoiding full rewrites for the tiny row-level changes, the oversized files make eventual cleanup and any full-file operations disproportionately expensive — run `OPTIMIZE` to bring files into the adaptive size range  
C. V-Order is enabled, which is incompatible with MERGE operations  
D. The table needs a `ZORDER BY` on the merge key to fix MERGE performance  

> [!success]- Answer
> **B. The 30 GB files are far above the adaptive target file size range (128 MB–1 GB); even with deletion vectors avoiding full rewrites for the tiny row-level changes, the oversized files make eventual cleanup and any full-file operations disproportionately expensive — run OPTIMIZE to bring files into the adaptive size range**
>
> Deletion vectors are on by default on Runtime 2.0 (ruling out A), and they aren't incompatible with V-Order (ruling out C). Z-Order (D) helps selective multi-column filtering, not MERGE latency driven by oversized files. The real issue is file size: 30 GB files are roughly 30–240× the adaptive target range, so any operation that eventually needs to touch or rewrite them (including deletion-vector purges once the 5% threshold is crossed) does dramatically more I/O than necessary.

## Use Cases

- Deciding whether a lakehouse table should run with V-Order on (read-heavy Direct Lake/SQL endpoint reporting) or off (write-heavy nightly ingestion)
- Diagnosing degraded query performance back to file-size health and choosing between optimize write, auto compaction, and a scheduled `OPTIMIZE`
- Setting up recurring `OPTIMIZE`/`VACUUM` via the Lakehouse Maintenance pipeline activity instead of manual portal runs
- Choosing partitioning vs. Z-Order for a table based on filter-column cardinality and query patterns
- Recognizing when oversized files are inflating deletion-vector cleanup cost on a MERGE-heavy table

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Nightly ingestion job slowed down after no code changes | V-Order enabled at session or table level, adding ~15% write-time cost | Disable V-Order for the ingestion session/table; apply it later via a scheduled `OPTIMIZE ... VORDER` pass instead |
| `VACUUM` fails with a retention-interval error | Requested retention is under the 7-day default and the safety check is still enabled | Use 7+ days, or explicitly set `spark.databricks.delta.retentionDurationCheck.enabled = false` after confirming no reader/writer needs the shorter history |
| Query performance degrades gradually on a frequently-updated table with no schema changes | Small-file accumulation from frequent small writes | Enable optimize write and/or auto compaction on the table, or schedule `OPTIMIZE` |
| `MERGE`/`UPDATE` latency climbing on a large table | Files are far outside the adaptive target size range, inflating the cost of any full-file rewrite including deletion-vector purges | Run `OPTIMIZE` to bring files into the 128 MB–1 GB adaptive range |
| Time travel to a version from 10 days ago fails | Default 7-day `VACUUM` retention (or a shortened custom retention) already removed the underlying files | Query within the active retention window; increase retention going forward if longer time travel is a requirement |

## Best Practices

- Default new write-heavy tables to the `writeHeavy` resource profile's V-Order-off behavior; opt read-heavy or reporting-facing tables into V-Order deliberately
- Enable auto compaction for streaming/micro-batch ingestion; prefer optimize write for controlled batch loads that can tolerate a shuffle
- Enable adaptive target file size rather than hand-tuning `delta.targetFileSize` per table, unless you have a specific hyper-tuning or testing need
- Schedule full-table `OPTIMIZE` (with Z-Order where selective multi-column filters justify it) during quiet windows, not during peak ingestion
- Don't shorten `VACUUM` retention below 7 days without confirming no time-travel or concurrent-operation dependency on that history

## Exam Tips

> [!tip] Exam Tips
>
> - V-Order config property: **`spark.sql.parquet.vorder.default`**, default **`false`** in new Fabric workspaces (`writeHeavy` resource profile)
> - V-Order tradeoff: **~15% slower writes**, up to 50% more compression, 40–60% faster Direct Lake cold-cache reads, ~10% faster SQL endpoint reads
> - `VACUUM` default retention: **7 days**; shorter requires `spark.databricks.delta.retentionDurationCheck.enabled = false`
> - Adaptive target file size: **128 MB** for tables under 10 GB, scaling to **1 GB** for tables over 10 TB
> - `OPTIMIZE` order of operations when combined: **bin compaction → Z-Order → V-Order**
> - Deletion vectors: on by default starting **Runtime 2.0 (Delta 4.1)**; `OPTIMIZE` auto-purges files with >5% deletion-vector-referenced rows

## Key Takeaways

- V-Order and optimize write are both **opt-in by default** in new Fabric workspaces — the platform defaults toward write throughput, not read speed
- The small-file problem has pre-write (optimize write) and post-write (auto compaction, scheduled `OPTIMIZE`) defenses; pick based on whether your write path can tolerate a shuffle
- `VACUUM`'s 7-day default retention is a deliberate safety boundary tied directly to time-travel history, not an arbitrary number
- Partitioning suits low-cardinality single-column filters; Z-Order suits higher-cardinality or multi-column selective filters
- Deletion vectors reduce the cost of small deletes/updates, but file-size discipline still matters — oversized files make their eventual cleanup expensive

## Related Topics

- [02-Warehouse Optimization](02-warehouse-optimization.md)
- [05-Pipeline and Query Optimization](05-pipeline-query-optimization.md) — Direct Lake guardrails tie back to file-size health covered here
- [07-Batch Transformation: PySpark Transformations](../07-batch-transformation/02-pyspark-transformations.md)
- [10-Error Resolution: Pipeline and Dataflow Errors](../10-error-resolution/01-pipeline-dataflow-errors.md)

## Official Documentation

- [Optimize Delta Lake tables with V-Order in Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/delta-optimization-and-v-order)
- [Delta Table Maintenance in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-table-maintenance)
- [Table Compaction](https://learn.microsoft.com/en-us/fabric/data-engineering/table-compaction)
- [Tune File Size](https://learn.microsoft.com/en-us/fabric/data-engineering/tune-file-size)
- [Configure Resource Profile Configurations](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-resource-profile-configurations)
- [Deletion vectors for Delta tables](https://learn.microsoft.com/en-us/fabric/data-engineering/delta-lake-deletion-vectors)
- [Cross-workload table maintenance and optimization](https://learn.microsoft.com/en-us/fabric/fundamentals/table-maintenance-optimization)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../10-error-resolution/04-shortcut-errors.md) | [↑ Back to Section](./performance-optimization.md) | [Next →](02-warehouse-optimization.md)**
