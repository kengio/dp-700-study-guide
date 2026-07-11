---
title: Warehouse Optimization
type: topic
tags:
  - dp-700
  - fabric
  - performance-optimization
  - warehouse
  - statistics
  - caching
  - query-insights
  - t-sql
---

# Warehouse Optimization

## Overview

Fabric Data Warehouse (and the lakehouse SQL analytics endpoint, which shares the same query engine) optimizes automatically in more places than most engineers expect — statistics, in-memory/disk caching, and result-set caching all work with little or no manual intervention. This topic covers what's automatic, what's still manually tunable, how to read query performance history through Query Insights, and the table-design choices (constraints, data types, load pattern) that influence the optimizer.

> [!abstract]
>
> - **Statistics are both automatic and manual** — the engine creates and proactively refreshes histogram statistics at query time, while `CREATE`/`UPDATE`/`DROP STATISTICS` remain available for single-column, purpose-built tuning
> - **In-memory and disk caching can't be disabled** — it's fully transparent and always active; **result-set caching** is a separate, item-level feature with its own long list of disqualifying query shapes
> - `queryinsights.*` views hold 30 days of query history with up to a 15-minute ingestion lag — the first stop for "which query is slow" and "was cache used"
> - `PRIMARY KEY`/`UNIQUE`/`FOREIGN KEY` constraints are supported only as **`NOT ENFORCED`** — they help the optimizer and downstream BI tools, but the engine doesn't validate them
> - CTAS is the preferred bulk transform-and-load pattern; row-by-row or per-record `INSERT` patterns don't scale in a distributed warehouse engine

> [!tip] What the Exam Tests
>
> - Distinguishing automatic statistics behavior from when manual `CREATE`/`UPDATE STATISTICS` is worth doing
> - Knowing what disqualifies a query from result-set caching, and how to check whether a cache hit occurred
> - Reading `queryinsights.exec_requests_history` and related views to diagnose a slow or resource-heavy query
> - Understanding why `NOT ENFORCED` constraints still matter for performance despite not being validated

---

## Statistics: Automatic and Manual

The Warehouse query optimizer estimates the cost of candidate execution plans using statistics — objects describing the distribution and cardinality of data in a column or table. Fabric supports two paths that work together:

### Automatic statistics at query time

Whenever a query needs statistics the optimizer doesn't yet have, Fabric creates them **synchronously** as part of that query's execution — so the first query touching a "cold" column pays a small extra latency cost while stats are built. Automatically generated statistics fall into three types, all visible in `sys.stats`:

| Type | Trigger | Naming |
| :--- | :--- | :--- |
| Histogram statistics | Column referenced in `GROUP BY`, `JOIN`, `DISTINCT`, `WHERE`, or `ORDER BY` | `_WA_Sys_` prefix |
| Average column length | `VARCHAR` column wider than 100 characters | `ACE-AverageColumnLength_` prefix |
| Table cardinality | Row-count estimate needed for a table | `ACE-Cardinality` |

Two built-in optimizations reduce the cost of keeping these fresh:

- **Incremental statistics refresh** — for large, mostly-`INSERT` tables, only rows added since the last refresh are sampled and merged into the existing histogram, instead of rescanning the whole column
- **Proactive statistics refresh** — a fully managed process that frontloads statistic refreshes after data changes, aiming to avoid a `SELECT` query stalling on a synchronous refresh; enabled by default, configurable via `ALTER DATABASE`

### Manual statistics

`CREATE STATISTICS`, `UPDATE STATISTICS`, and `DROP STATISTICS` are supported for **single-column, histogram-based** statistics — multi-column statistics aren't supported.

```sql
-- Create statistics with a full scan on a heavily filtered/joined column
CREATE STATISTICS DimCustomer_CustomerKey_FullScan
ON dbo.DimCustomer (CustomerKey) WITH FULLSCAN;

-- Manually refresh after a large data change
UPDATE STATISTICS dbo.DimCustomer (DimCustomer_CustomerKey_FullScan) WITH FULLSCAN;
```

Prioritize manual statistics on columns heavily used in `GROUP BY`, `ORDER BY`, filters, and joins — especially right after a bulk load, where you'd rather pay the `FULLSCAN` cost once, deliberately, than let the first production query pay a synchronous auto-create cost.

> [!note] Mental model — automatic vs. manual statistics
> Automatic statistics are a **smoke detector** — reactive, fires exactly when needed, no planning required. Manual statistics are a **fire drill** — you choose the timing (right after a bulk load, before a known heavy workload) so the cost lands when it's convenient, not when a user is waiting on a query.

## Caching: In-Memory, Disk, and Result-Set

Fabric Warehouse layers three distinct caching mechanisms, and they behave very differently.

| Cache | Scope | Configurable? | Persists across |
| :--- | :--- | :--- | :--- |
| **In-memory cache** | Transcoded, compressed columnar data from the most recently accessed files | No — always on, fully transparent | Session boundaries, until evicted (LRU-style) |
| **Disk (SSD) cache** | Overflow extension of the in-memory cache for datasets too large to fit in memory | No — always on | Longer than in-memory; data demoted from memory lands here before being read from remote storage again |
| **Result-set caching** | Final result sets of qualifying `SELECT` queries | Yes — item-level and query-level | Up to 24 hours of inactivity; invalidated immediately on any change to referenced tables |

In-memory and disk caching apply regardless of data origin — warehouse tables, OneLake shortcuts, and even shortcuts to non-Azure sources are all cached the same way, and cache management (eviction, consistency on DML) is fully automatic with no user-facing clear/disable control.

### Result-set caching

Result-set caching persists the *final* output of a `SELECT` so a repeated query (same dashboard refresh, same report filter) can skip re-executing joins and aggregations entirely.

- Documented as **enabled by default at the item level** for both Warehouse and lakehouse SQL analytics endpoints
- Can be disabled per item or per query

```sql
-- Check current setting
SELECT name, is_result_set_caching_on FROM sys.databases WHERE database_id = db_id();

-- Disable at the item level
ALTER DATABASE <Fabric_item_name> SET RESULT_SET_CACHING OFF;
```

```sql
-- Disable for a single query (debugging or A/B testing)
SELECT ... OPTION ( USE HINT ('DISABLE_RESULT_SET_CACHE') );
```

Check cache usage via the `result_cache_hit` column in `queryinsights.exec_requests_history`: `2` = cache hit, `1` = this run created the cache, `0` = not applicable.

**Disqualifying query shapes** — a query commonly fails to qualify for result-set caching if it:

- Isn't a pure `SELECT` (CTAS, `SELECT INTO`, any DML)
- References fewer than 100,000 rows in every table, or is estimated to return more than 10,000 result rows
- Uses runtime constants (`GETDATE()`, `CURRENT_USER`), non-deterministic functions, or window/ordered aggregate functions
- Uses `VARCHAR(MAX)`/`VARBINARY(MAX)` output, or a `CAST`/`CONVERT` involving **date** or **sql_variant**
- Uses row-level security, dynamic data masking, or other security features; uses time travel; is a cross-database query
- Runs inside an explicit transaction or a `WHILE` loop, or has session-level `SET` options at non-default values

> [!warning] Common Mistake
> Assuming result-set caching applies to any repeated query. The disqualification list is long and specific — a report query returning 15,000 rows, or one that includes `GETDATE()` for a "last refreshed" column, silently never qualifies. When a query you expect to be cached shows `result_cache_hit = 0` every time, check the disqualification list before assuming the feature is broken. Also note: as documentation for this feature evolves quickly, always verify current status against `sys.databases.is_result_set_caching_on` for your own item rather than assuming the doc-stated default is what's live for you.

## Query Insights

The `queryinsights` schema (visible under **Schemas → queryinsights → Views** in Fabric Explorer) holds historical, per-user query execution data for 30 days — completed queries can take up to 15 minutes to appear, longer under heavy concurrent load.

| View | Purpose |
| :--- | :--- |
| `queryinsights.exec_requests_history` | Per-completed-query execution details: CPU time, data scanned (memory/disk/remote), `result_cache_hit`, query text, `query_hash` |
| `queryinsights.exec_sessions_history` | Per-completed-session details |
| `queryinsights.long_running_queries` | Queries aggregated by execution time |
| `queryinsights.frequently_run_queries` | Queries aggregated by run frequency |
| `queryinsights.sql_pool_insights` | Pool-level resource allocation, configuration changes, and pressure indicators |

Queries are aggregated by **query shape** (same structure, different literal predicate values count as the same query) via the `query_hash` column — useful for spotting a parameterized report query that's slow across every distinct filter value.

```sql
-- Top CPU consumers
SELECT TOP 100 distributed_statement_id, query_hash, allocated_cpu_time_ms, label, command
FROM queryinsights.exec_requests_history
ORDER BY allocated_cpu_time_ms DESC;

-- Cache-vs-remote-storage read comparison
SELECT distributed_statement_id, query_hash, data_scanned_remote_storage_mb,
       data_scanned_memory_mb, data_scanned_disk_mb, label, command
FROM queryinsights.exec_requests_history
ORDER BY data_scanned_remote_storage_mb DESC;
```

Note: `data_scanned_*` values show `0` for `COPY INTO` statements, and don't necessarily account for data moved during intermediate query stages — a large gap between reported scan size and observed runtime can point to intermediate shuffle cost rather than storage I/O.

**Practice Question 1** *(Medium)*

A dashboard query runs against a Fabric Warehouse table and, on every refresh, `queryinsights.exec_requests_history` shows `result_cache_hit = 0`. The query is a plain `SELECT` with no security features, no time travel, and it's a same-database query. What's the most likely remaining disqualifier to check first?

A. The table doesn't have a primary key defined  
B. The query's estimated result size exceeds 10,000 rows, or it references a runtime constant like `GETDATE()`  
C. Result-set caching only works on the lakehouse SQL endpoint, not the Warehouse  
D. Statistics haven't been created on the queried columns yet  

> [!success]- Answer
> **B. The query's estimated result size exceeds 10,000 rows, or it references a runtime constant like GETDATE()**
>
> With security features, time travel, and cross-database access already ruled out, the next most common disqualifiers are result-size (>10,000 rows) and non-deterministic/runtime-constant usage — both very common in dashboard queries with a "last refreshed" timestamp column. A missing primary key (A) doesn't disqualify caching. Result-set caching applies to both Warehouse and SQL analytics endpoint items (ruling out C). Missing statistics (D) affects plan quality, not cache eligibility.

## Data Clustering, Distribution, and Load Patterns

Fabric Warehouse doesn't expose the manual distribution/index knobs of a classic dedicated SQL pool (hash/round-robin distribution, clustered columnstore tuning) — physical layout is engine-managed. The performance levers that remain in your control are architectural:

- **CTAS (`CREATE TABLE AS SELECT`)** is the preferred pattern for bulk transform-and-load: it's fully parallel and produces a table with a fresh, optimizer-friendly layout in one pass. Use it for large rebuilds, dimension reloads, or any transformation that's cheaper to reconstruct wholesale than to patch.
- **`INSERT ... SELECT`** suits incremental, set-based appends — still parallel, but doesn't rewrite existing data, so it's the right choice when only new rows need to land.
- **Row-by-row `INSERT`** (one statement per record, typically from an external orchestration loop) does not scale in a distributed engine designed for set-based operations — see [05-Pipeline and Query Optimization](05-pipeline-query-optimization.md) for the pipeline-side version of this same anti-pattern (`ForEach`-wrapped per-row activities).

> [!note] Mental model — CTAS vs. INSERT
> CTAS is **pouring a fresh concrete slab** — you get a brand-new, optimally laid-out table, but the whole thing gets rebuilt. `INSERT ... SELECT` is **adding a room onto an existing house** — faster for small additions, but the original structure (and any of its layout inefficiencies) stays as-is. Use CTAS when the transformation logic changed or the table's layout has degraded; use `INSERT` for routine incremental loads.

## NOT ENFORCED Constraints

Fabric Warehouse supports `PRIMARY KEY`, `UNIQUE`, and `FOREIGN KEY` constraints, but **only in `NOT ENFORCED` form**:

| Constraint | Required modifiers |
| :--- | :--- |
| `PRIMARY KEY` | `NONCLUSTERED` and `NOT ENFORCED` |
| `UNIQUE` | `NONCLUSTERED` and `NOT ENFORCED` |
| `FOREIGN KEY` | `NOT ENFORCED` |

Constraints can only be added via `ALTER TABLE` — never inline in `CREATE TABLE`.

```sql
CREATE TABLE PrimaryKeyTable (c1 INT NOT NULL, c2 INT);

ALTER TABLE PrimaryKeyTable
  ADD CONSTRAINT PK_PrimaryKeyTable PRIMARY KEY NONCLUSTERED (c1) NOT ENFORCED;
```

Because they're `NOT ENFORCED`, the engine never validates uniqueness or referential integrity at write time — duplicate keys or orphaned foreign keys can exist without error. So why declare them at all? Two performance-relevant reasons:

- **Query optimizer hints** — a declared (even unenforced) primary/foreign key relationship gives the optimizer additional cardinality and join-elimination information it wouldn't otherwise have, which can improve plan quality for joins across those tables
- **Downstream BI tooling** — Power BI and other semantic-layer tools use declared relationships to infer joins and cardinality automatically, avoiding manual relationship configuration

> [!warning] Common Mistake
> Declaring a `NOT ENFORCED` primary key on a column that *isn't actually unique* in practice, then wondering why join results look wrong. Because the constraint isn't validated, bad data silently violates it — and a query optimizer that trusts the declared uniqueness for cardinality estimation can produce a plan (or even results) that assume uniqueness that doesn't hold. Only declare constraints that reflect the real data shape; the performance benefit depends on the declaration being true, not just present.

## Table Design for Performance

- **Choose data types that match the domain** — a `VARCHAR(20)` for a fixed-format code is cheaper to store, compare, and build statistics on than a `VARCHAR(MAX)` used out of habit
- **Avoid `VARCHAR(MAX)`/`VARBINARY(MAX)` unless genuinely needed** — beyond the storage cost, these types disqualify a query from result-set caching entirely (see disqualification list above)
- **Watch average-column-length statistics** on wide `VARCHAR` columns (>100 characters) — they're auto-created for a reason; a table full of oversized text columns generates more statistics overhead than a normalized design would

**Practice Question 2** *(Easy)*

A data modeler adds `FOREIGN KEY` constraints between a fact table and its dimension tables in a Fabric Warehouse, expecting the engine to reject any fact row referencing a dimension key that doesn't exist. After deployment, several orphaned fact rows are found with no matching dimension key. What's the explanation?

A. Foreign keys aren't supported at all in Fabric Warehouse  
B. Foreign keys in Fabric Warehouse are only supported as `NOT ENFORCED`, so referential integrity isn't validated by the engine — the constraint still helps the optimizer and BI tools, but doesn't block bad writes  
C. The constraint was created inline in `CREATE TABLE`, which silently disables enforcement  
D. Foreign keys only enforce integrity when result-set caching is enabled  

> [!success]- Answer
> **B. Foreign keys in Fabric Warehouse are only supported as NOT ENFORCED, so referential integrity isn't validated by the engine — the constraint still helps the optimizer and BI tools, but doesn't block bad writes**
>
> Fabric Warehouse does support foreign keys (ruling out A), but exclusively as `NOT ENFORCED` — there's no enforced variant to fall back to. Constraints must be added via `ALTER TABLE` regardless of enforcement (C is a red herring — inline creation isn't even allowed). Result-set caching (D) is unrelated to constraint enforcement.

## Use Cases

- Deciding whether a slow, frequently-run query needs manual statistics or is already covered by automatic/proactive refresh
- Diagnosing why a dashboard query never hits the result-set cache using the disqualification list and `queryinsights.exec_requests_history`
- Using `queryinsights.long_running_queries` and `frequently_run_queries` to triage which queries are worth tuning first
- Choosing CTAS over `INSERT` for a large dimension rebuild, or the reverse for an incremental load
- Declaring `NOT ENFORCED` primary/foreign keys to improve join plan quality and enable automatic BI-tool relationship detection

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| First query against a newly loaded table is unexpectedly slow | Synchronous automatic statistics creation on cold columns | Expected one-time cost; pre-warm with manual `CREATE STATISTICS ... WITH FULLSCAN` after bulk loads if the latency is unacceptable |
| A qualifying-looking `SELECT` never shows a result-set cache hit | Query trips one of the documented disqualifiers (row count, runtime constants, wide types, security features, etc.) | Check `queryinsights.exec_requests_history.result_cache_hit` and cross-reference the disqualification list |
| Join between fact and dimension tables produces unexpected duplicate rows | A `NOT ENFORCED` primary/unique key was declared but the underlying data isn't actually unique | Fix the data quality issue; the constraint won't catch it for you |
| Query plan seems to badly misestimate row counts on a large text column | Missing or stale average-column-length statistics on a wide `VARCHAR` | Run `UPDATE STATISTICS` on the column, or reduce the column width if `MAX`/oversized types aren't needed |
| Row-by-row `INSERT` loop from an external orchestrator is far slower than expected | Fabric Warehouse is a distributed, set-based engine — single-row inserts don't parallelize well | Replace with CTAS or set-based `INSERT ... SELECT`; see [05-Pipeline and Query Optimization](05-pipeline-query-optimization.md) for the pipeline-side equivalent |

## Best Practices

- Pre-warm statistics with `CREATE STATISTICS ... WITH FULLSCAN` right after large bulk loads instead of letting the first production query pay the cost
- Check `sys.databases.is_result_set_caching_on` for your specific item rather than assuming the documented default applies
- Use `queryinsights.frequently_run_queries` and `long_running_queries` together to prioritize tuning effort — a moderately slow query that runs 1,000 times a day often matters more than a rare, very slow one
- Prefer CTAS for full rebuilds and set-based `INSERT ... SELECT` for incremental loads; never wrap single-row writes in an external loop
- Declare `NOT ENFORCED` constraints only where the underlying data genuinely satisfies them

## Exam Tips

> [!tip] Exam Tips
>
> - Automatic statistics types: histogram (`_WA_Sys_`), average column length (`ACE-AverageColumnLength_`), table cardinality (`ACE-Cardinality`) — all visible in `sys.stats`
> - Manual statistics are **single-column only** — no multi-column statistics support
> - Result-set caching is **item-level** (`ALTER DATABASE ... SET RESULT_SET_CACHING OFF`) and **query-level** (`OPTION (USE HINT('DISABLE_RESULT_SET_CACHE'))`); check hits via `result_cache_hit` (0/1/2) in `queryinsights.exec_requests_history`
> - In-memory/disk caching is always on and can't be disabled or manually cleared
> - `queryinsights` retains **30 days** of history, up to **15-minute** ingestion lag
> - Constraints: `PRIMARY KEY`/`UNIQUE` require `NONCLUSTERED` + `NOT ENFORCED`; `FOREIGN KEY` requires `NOT ENFORCED` — none are validated by the engine

## Key Takeaways

- Statistics maintenance in Fabric Warehouse is mostly automatic (proactive refresh, incremental refresh); manual statistics are a targeted tool for pre-warming after bulk loads
- In-memory/disk caching is unconditional; result-set caching is conditional on a long list of query-shape rules — check `queryinsights` before assuming either is or isn't helping
- `queryinsights.*` views are the primary performance-diagnosis surface, aggregating by `query_hash` so parameterized queries are analyzed as one pattern
- `NOT ENFORCED` constraints trade validation for optimizer and BI-tool benefit — they only help if the declared relationship is actually true
- CTAS and set-based `INSERT` are the scalable load patterns; per-row loops are an anti-pattern in a distributed warehouse engine

## Related Topics

- [01-Lakehouse Optimization](01-lakehouse-optimization.md)
- [05-Pipeline and Query Optimization](05-pipeline-query-optimization.md)
- [09-Monitoring & Alerting: Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md)
- [10-Error Resolution: Notebook and T-SQL Errors](../10-error-resolution/02-notebook-tsql-errors.md)

## Official Documentation

- [Statistics](https://learn.microsoft.com/en-us/fabric/data-warehouse/statistics)
- [Query Insights](https://learn.microsoft.com/en-us/fabric/data-warehouse/query-insights)
- [In-memory and disk caching](https://learn.microsoft.com/en-us/fabric/data-warehouse/caching)
- [Result Set Caching](https://learn.microsoft.com/en-us/fabric/data-warehouse/result-set-caching)
- [Primary, Foreign, and Unique Keys](https://learn.microsoft.com/en-us/fabric/data-warehouse/table-constraints)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](01-lakehouse-optimization.md) | [↑ Back to Section](./performance-optimization.md) | [Next →](03-spark-optimization.md)**
