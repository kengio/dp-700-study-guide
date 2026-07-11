---
title: Code Examples
type: code-examples
tags:
  - dp-700
  - fabric
  - code-examples
  - pyspark
  - t-sql
  - kql
---

# Code Examples

This folder contains standalone, runnable code patterns referenced throughout the DP-700 study guide — full end-to-end implementations (medallion cleanse steps, SCD Type 2, watermark loads, streaming upserts, dedup, aggregation) rather than isolated syntax snippets. Each pattern includes a one-line scenario, complete code, and an expected-result comment so you can paste it into the matching Fabric surface and run it as-is.

Where the topic files in [05-Loading Patterns](../../05-loading-patterns/loading-patterns.md), [07-Batch Transformation](../../07-batch-transformation/batch-transformation.md), and [08-Streaming Data](../../08-streaming-data/streaming-data.md) teach the *syntax and decision rules*, these files go one level deeper — a full working script or query set for the pattern, with no gaps to fill in.

> [!tip] How to Practice
> Run PySpark patterns in a **Fabric notebook** attached to a Lakehouse. Run T-SQL patterns in a **Fabric Warehouse's SQL editor** (or the SQL analytics endpoint for read-only queries). Run KQL patterns in a **KQL queryset** attached to an Eventhouse/KQL database. All three assume a small `orders`/`customers`/`products` sample schema consistent with the examples used across the DP-700 topic files.

---

## Pattern Files

| File | Language | What it covers | Run in |
| :--- | :--- | :--- | :--- |
| [pyspark/transformation-patterns.md](./pyspark/transformation-patterns.md) | PySpark | Bronze→silver cleanse, SCD2 `MERGE INTO`, incremental watermark load, late-arriving dimension, streaming `foreachBatch` upsert, gold window aggregation, `OPTIMIZE` compaction | Fabric notebook (Lakehouse) |
| [tsql/warehouse-patterns.md](./tsql/warehouse-patterns.md) | T-SQL | `COPY INTO` with error handling, CTAS medallion chain, watermark `MERGE` upsert, SCD2 via `UPDATE`+`INSERT`, surrogate keys without `IDENTITY`, cross-database gold view, dedup with `ROW_NUMBER` | Fabric Warehouse SQL editor |
| [kql/kql-patterns.md](./kql/kql-patterns.md) | KQL | Update-policy transform-on-ingest, materialized-view dedup, tumbling-window aggregation, sessionization, T-SQL→KQL rosetta table, `ingestion_time()` late/duplicate handling, alert-feeding aggregation | KQL queryset (Eventhouse) |

## How to Run Each

- **PySpark** — open a new notebook in a Fabric workspace, attach a Lakehouse as the default lakehouse, and paste a pattern into a cell. Patterns that reference `dim.*`/`fact.*`/`bronze.*`/`silver.*`/`gold.*` tables create their own mock data first, so each pattern runs standalone without a pre-built schema.
- **T-SQL** — open a Fabric Warehouse, use the **New SQL query** editor, and run a pattern top to bottom. `COPY INTO` patterns need a real storage location and credential substituted for the placeholder path — everything else runs against the pattern's own `CREATE TABLE`/`#temp` staging statements.
- **KQL** — open a KQL queryset attached to an Eventhouse database with **Edit** permission (management commands like `.create table` and `.alter table ... policy` require write access, not just query access). Patterns run as ordered command blocks — execute each `.create`/`.alter` statement before the query that depends on it.

## Related Topics

- [05-Loading Patterns](../../05-loading-patterns/loading-patterns.md) — full vs. incremental loads, dimensional model loading, streaming loading pattern
- [06-Batch Ingestion](../../06-batch-ingestion/batch-ingestion.md) — choosing a data store, OneLake shortcuts, mirroring, pipeline ingestion
- [07-Batch Transformation](../../07-batch-transformation/batch-transformation.md) — choosing a transform tool, PySpark/T-SQL/KQL transformation syntax, data quality patterns
- [08-Streaming Data](../../08-streaming-data/streaming-data.md) — choosing a streaming engine, Eventstreams, Spark Structured Streaming, KQL real-time, windowing functions

---

**[↑ Back to Certification](../../dp-700-overview.md)**
