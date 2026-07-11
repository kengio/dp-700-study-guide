---
title: Pipeline Ingestion
type: topic
tags:
  - dp-700
  - fabric
  - batch-ingestion
  - copy-activity
  - copy-job
  - data-factory
  - connectors
---

# Pipeline Ingestion

## Overview

Pipeline-based ingestion is the tool of last resort in the batch-ingestion decision tree: reach for it only when a shortcut or mirroring genuinely can't do the job, because the data needs real movement, format conversion, or write-behavior control (upsert, merge, SCD Type 2) that a live pointer or a passive replica can't provide. This topic covers Copy activity's source/sink configuration (staging, partitioning, fault tolerance, upsert), the simplified Copy job item and what it adds on top, the Data Factory connector ecosystem, file formats and compression, and how pipeline copy stacks up against T-SQL `COPY INTO` and Dataflow Gen2 for ingestion.

> [!abstract]
>
> - **Copy activity** is the pipeline-embedded, full-control data mover: per-connector source/sink settings, staging, partitioned parallel reads, and fault-tolerant row skipping
> - **Copy job** is a simplified, standalone item purpose-built for bulk, incremental (watermark-based), and CDC-based copy — no hand-built control table needed, unlike the watermark pattern in [05-Loading Patterns](../05-loading-patterns/01-full-incremental-loads.md)
> - Data Factory connects to ==170+ data sources== overall, though coverage differs by tool: Copy activity and Copy job each cover 50+ sources/40+ destinations, Dataflow Gen2 covers 150+
> - **Binary copy** preserves files byte-for-byte with no format awareness; **tabular copy** converts between source and destination schemas through an interim data-type system

> [!tip] What the Exam Tests
>
> - Configuring Copy activity source/sink settings for a scenario: partition option, write behavior (Insert vs. Upsert), staging, fault tolerance
> - Recognizing when Copy job's native incremental/CDC copy replaces hand-built watermark logic
> - Choosing between pipeline Copy activity, Copy job, T-SQL `COPY INTO`, and Dataflow Gen2 for a given ingestion scenario
> - Knowing which sinks support upsert, and what "fault tolerance" actually skips

---

## Copy Activity Deep-Dive

**Copy activity** is a pipeline activity that connects to a source, optionally stages and converts the data, and writes it to a sink — all inside a broader pipeline that can also orchestrate other activities before or after it.

### Source and Sink Configuration

Settings vary by connector, but the shape is consistent. For a database source like Azure SQL Database:

| Source setting | Purpose |
| :--- | :--- |
| **Table / Query / Stored procedure** | Choose whether to read a whole table, a custom SQL query, or the result of a stored procedure (last statement must be `SELECT`) |
| **Isolation level** | Transaction locking behavior for the read: `None` (default), `ReadCommitted`, `ReadUncommitted`, `RepeatableRead`, `Serializable`, `Snapshot` |
| **Partition option** | `None`, `Physical partitions of table`, or `Dynamic range` — see [Partition Options](#partition-options-and-parallel-copies) below |
| **Additional columns** | Inject extra columns (e.g., source file path, a static value) into the copied data |

| Destination (sink) setting | Purpose |
| :--- | :--- |
| **Write behavior** | `Insert`, `Upsert`, or `Stored procedure` — see [Upsert Support](#which-sinks-support-upsert) below |
| **Table option** | `None` or `Auto create table` — automatically creates the destination table from the source schema |
| **Pre-copy script** | A script run before each write, commonly used to truncate/clean staged data |
| **Write batch size / timeout** | Rows per batch insert (auto-tuned by default) and how long a batch write can run before timing out (default 30 minutes) |

> [!warning] Common Mistake
> Assuming every connector exposes the same sink settings. Write behavior, table auto-creation, and partition options are connector-specific — a file-based sink (ADLS Gen2, S3) has no `Write behavior` dropdown at all, because "insert vs. upsert" only makes sense against a row-addressable destination like a database or lakehouse table.

### Which Sinks Support Upsert

Database-family sinks expose a **Write behavior** setting with an explicit `Upsert` option — for example, Azure SQL Database:

- **Insert**: appends every row from the source
- **Upsert**: inserts new rows and updates matched rows, using an interim table (a global temp table by default, or a physical table in a specified schema) and configurable **Key columns** for matching — if key columns aren't specified, the destination table's primary key is used
- **Stored procedure**: hands each batch to a stored procedure that defines its own insert/update/merge logic

Lakehouse and Warehouse table sinks, Dataverse, and several other database-family connectors expose equivalent upsert-style write behavior; pure file-based sinks (ADLS Gen2, S3, Blob Storage) do not, since there's no row-matching key to upsert against a folder of files.

---

## Staging

**Staging** copies data through an interim storage location before the final write, useful for certain source/sink combinations that benefit from (or require) a bulk-load-friendly intermediate format.

| Staging option | Detail |
| :--- | :--- |
| **Workspace (built-in)** | Uses Fabric's own staging storage; requires the pipeline's last-modified user to have at least **Contributor** role in the workspace; ==times out after 60 minutes== — long-running jobs should use external staging instead |
| **External** | An Azure Blob Storage or ADLS Gen2 connection you provide, optionally scoped to a specific storage path; supports compression before staging |

> [!note] Mental model
> Staging is a **loading dock between the truck and the warehouse**: instead of the truck (source) backing directly up to every shelf (sink) it needs to reach, everything gets dropped at one dock first, then moved into place from there — faster and more reliable for bulk drops, unnecessary overhead for a quick single-item delivery.

---

## Partition Options and Parallel Copies

For database sources that support it, **Partition option** controls how the source table is split for parallel reads:

| Partition option | Behavior |
| :--- | :--- |
| **None** (default) | Single-threaded read — no partitioning |
| **Physical partitions of table** | Auto-detects the table's existing physical partitions and copies by partition — best performance when the table is already partitioned |
| **Dynamic range** | Splits an integer/date/datetime column into ranges for parallel reads; optionally set **Partition column**, **Partition upper bound**, and **Partition lower bound** to control the split (bounds set the partition *stride*, not row filtering — every row is still copied) |

The actual concurrency is set separately by **Degree of copy parallelism** in the Settings tab — enabling a partition option is what makes that parallelism apply to the source read; without it, the source is read single-threaded regardless of the parallelism setting.

> [!warning] Common Mistake
> Setting a high **Degree of copy parallelism** while leaving **Partition option** at `None`. Parallelism only helps once the source read itself is split into partitions — cranking up parallel copies on an unpartitioned read doesn't speed up the read, it just adds overhead.

Best practice: choose a distinctive partition column (primary key or unique key) to avoid data skew across partitions.

---

## Fault Tolerance

Copy activity can tolerate certain row- and file-level failures without aborting the whole run:

| Setting | Behavior |
| :--- | :--- |
| **Fault tolerance / Skip incompatible rows** (`enableSkipIncompatibleRow`) | Ignores rows that fail to convert or map between source and destination types instead of failing the whole copy |
| **Skip error file** (`skipErrorFile`) | Skips specific file-level failures during the copy: `fileMissing`, `fileForbidden`, `invalidFileName` |
| **Enable logging** | Logs which files/rows were copied vs. skipped, for later review |
| **Data consistency verification** (`validateDataConsistency`) | For tabular data, checks that source row count equals destination rows written plus incompatible rows skipped; for binary files, checks size/last-modified/checksum — catches silent data loss, at some performance cost |

> [!note] Mental model
> Fault tolerance is a **shipping manifest with a "damaged goods" bin**: a handful of malformed items get pulled aside and logged instead of stopping the entire truck. It's not a substitute for fixing a systematically broken source feed — if most rows are landing in the "skipped" bin, that's a data-quality problem, not something fault tolerance is meant to paper over.

**Practice Question 1** *(Medium)*

A Copy activity loads 2 million rows from a CSV source into a Warehouse table. During a run, 40 rows fail because their date column contains an unparseable string, while the other 1,999,960 rows are well-formed. The pipeline has **Fault tolerance / Skip incompatible rows** enabled, but **Enable logging** and **Data consistency verification** are both off. What happens, and what's the risk?

A. The entire copy activity fails because of the 40 bad rows  
B. The 40 bad rows are silently skipped, the other rows load successfully, and there's no record of which 40 rows were skipped or confirmation that the final count is right  
C. The 40 bad rows are automatically corrected using type coercion  
D. Skip incompatible rows only applies to binary copies, so this setting has no effect here  

> [!success]- Answer
> **B. The 40 bad rows are silently skipped, the other rows load successfully, and there's no record of which 40 rows were skipped or confirmation that the final count is right**
>
> `enableSkipIncompatibleRow` does exactly what it says — it lets the run succeed by skipping rows that can't convert. But without **Enable logging**, there's no record of *which* rows were skipped for follow-up, and without **Data consistency verification**, there's no automated check confirming the destination row count matches source rows minus skipped rows. Skip incompatible rows without its companion settings is a "runs green, silently loses data" trap — pair it with logging and consistency verification whenever data completeness matters.

---

## Copy Job

**Copy job** is a simplified, standalone Fabric item for data movement — no pipeline canvas required — purpose-built for bulk, incremental, and CDC-driven copy scenarios that would otherwise mean hand-building the watermark pattern from [05-Loading Patterns](../05-loading-patterns/01-full-incremental-loads.md).

| What Copy job adds over Copy activity | Detail |
| :--- | :--- |
| **Incremental copy — watermark-based** | Native tracking on `ROWVERSION`, datetime, date, integer, or string-interpreted-as-datetime columns; Copy job manages the "last successful run" state automatically |
| **Incremental copy — CDC-based** | ==Preview== — when CDC is enabled on the source and supported by the connector, replicates inserts, updates, **and deletes** — the same capability the watermark pattern's modified-date approach can't provide on its own |
| **Update methods** | `Append` (default, keeps full history), `Merge` (upsert on a key column, defaults to the primary key), `Overwrite` (replace), or `SCD Type 2` (==Preview== — versioned rows with effective dating; deletes become soft deletes under CDC replication) |
| **Automatic table creation + truncation** | Can create destination tables from source schema, and optionally truncate the destination before the first full load |
| **Audit columns** | Optionally appends lineage metadata to every row: extraction time, source path, workspace/job/run IDs, incremental window bounds |
| **Auto-partitioning** | ==Preview== — automatically selects a partition column and parallel-read strategy for large tables on supported connectors, no manual tuning |
| **Run options** | Run once, schedule (with support for multiple independent schedules per job), or event-triggered via a pipeline's copy job activity |
| **Failure recovery** | Always resumes from the end of the last successful run — a failed run doesn't corrupt or advance the tracked state |

> [!note] Mental model
> If Copy activity is a **fully-equipped moving truck** you drive yourself — you choose the route, the loading order, what happens if a box is damaged — Copy job is **hiring movers who already know how to pack a truck**: point them at the source and destination, tell them what's changed since last time, and they handle the incremental tracking and update logic without you writing the watermark control table by hand.

> [!warning] Common Mistake
> Assuming Copy job is strictly "Copy activity, but easier" and therefore always the right default. Copy job has no pipeline-level transformation or control-flow surface — no conditional branching, no chaining with notebooks or stored procedures in the same item. When the scenario needs orchestration beyond "move this data, handle deletes, incremental please," that's a pipeline with Copy activity (or a broader orchestration pattern from [04-Orchestration](../04-orchestration/orchestration.md)), not Copy job.

**Practice Question 2** *(Medium)*

A data engineer needs to ingest data from an on-premises SQL Server instance that already has CDC enabled on the source tables, into an Azure SQL Database. The requirement is a low-code, wizard-driven setup that performs an initial full load, then automatically switches to incremental loads based on CDC, on a recurring schedule — with no custom code or hand-built watermark logic. Which Fabric capability fits best?

A. A Copy activity inside a pipeline, using a modified-date watermark column  
B. Copy job, using CDC-based incremental copy over the on-premises gateway  
C. Database mirroring, since CDC is involved  
D. A Dataflow Gen2 with a scheduled refresh  

> [!success]- Answer
> **B. Copy job, using CDC-based incremental copy over the on-premises gateway**
>
> Every signal points to Copy job: CDC already enabled on the source, a request for a low-code wizard experience, "initial full load then automatic incremental," and no appetite for hand-built watermark logic. Copy job connects through the on-premises data gateway, natively supports CDC-based incremental copy, and needs no custom control-table code. A hand-built watermark in a Copy activity would work but contradicts "no custom code." Mirroring targets continuous replication of a whole supported database into OneLake, not a scheduled load into Azure SQL Database. Dataflow Gen2 is a transformation-first, Power Query-based tool, not a CDC-aware incremental copy mechanism.
>
> Note: CDC-based incremental copy in Copy job is currently ==Preview== — confirm GA status before committing a production design to it.

---

## Connectors Overview

Fabric Data Factory connects to ==170+ data sources== in total, but exact coverage depends on which tool is being used:

| Tool | Approximate source coverage | Approximate destination coverage |
| :--- | :--- | :--- |
| **Pipeline Copy activity** | 50+ connectors | 40+ connectors |
| **Copy job** | 50+ connectors | 40+ connectors |
| **Dataflow Gen2** | 150+ connectors (Power Query-based) | Lakehouse, Azure SQL database, Azure Data Explorer, Azure Synapse Analytics |

Many long-tail connectors (Excel workbook, SharePoint list, Google Analytics, dozens of SaaS/Power Query connectors) are **Dataflow Gen2-only** — they never appear as Copy activity or Copy job source/sink options at all, because they're Power Query connectors, not pipeline connectors. Conversely, high-throughput database and storage connectors (Azure SQL Database, ADLS Gen2, Snowflake, Oracle, SAP) are supported across all three tools.

> [!warning] Common Mistake
> Assuming any connector visible in the Fabric portal works with Copy activity because it works with Dataflow Gen2, or vice versa. Always check the connector's own support matrix — a scenario naming a Dataflow Gen2-only connector (e.g., "pull data from an Excel workbook via a pipeline") is describing something that can't be built as stated; the fix is switching to Dataflow Gen2 or converting the source to a pipeline-compatible format first.

---

## File Formats and Compression

Copy activity supports a standard set of file formats for file-based sources/sinks (ADLS Gen2, S3, Blob Storage, Lakehouse Files, and others): **Avro**, **Binary**, **DelimitedText** (CSV/TSV-style), **Excel**, **JSON**, **ORC**, **Parquet**, and **XML**. Compression support varies by format:

| Format | Supported compression codecs |
| :--- | :--- |
| **Parquet** | None, gzip, snappy, lzo, Brotli, Zstandard, lz4, lz4frame, bzip2, lz4hadoop — plus an optional **V-Order** write-time optimization (on by default) that tunes the Parquet layout for faster Fabric reads |
| **DelimitedText (CSV)** | None, bzip2, gzip, deflate, ZipDeflate, TarGzip, tar — with a configurable **Optimal** vs. **Fastest** compression level tradeoff |

### Binary vs. Tabular Copy

| Copy type | Behavior |
| :--- | :--- |
| **Binary copy** | Copies files exactly as-is, byte-for-byte, with no schema awareness or type conversion — the fastest option when source and destination formats already match and no transformation is needed |
| **Tabular copy** | Converts between source and destination schemas via an interim type system (Boolean, Byte, Datetime, Decimal, GUID, Integer, String, and others) — required whenever source and destination formats or column types differ |

> [!note] Mental model
> Binary copy is **photocopying a document** — exact, fast, no understanding of the content required. Tabular copy is **translating the document into another language** — it has to understand the structure (columns, types) to produce a correct result in the target format, which is inherently more work but is what makes format conversion (CSV → Delta, for example) possible at all.

---

## Pipeline vs. `COPY INTO` vs. Dataflow Gen2 Ingestion

Three genuinely different tools can all "get data into Fabric," and the exam expects picking the right one for a scenario's skillset, transformation need, and destination:

| Factor | Pipeline (Copy activity / Copy job) | T-SQL `COPY INTO` | Dataflow Gen2 |
| :--- | :--- | :--- | :--- |
| **Primary skillset** | ETL, SQL, JSON — low-code/no-code | T-SQL | Power Query (M), low-code |
| **Destination** | Lakehouse, Warehouse, and 40+ other connector destinations | ==Warehouse only== — not lakehouse | Lakehouse, Azure SQL database, Azure Data Explorer, Azure Synapse Analytics |
| **Source scope** | Any supported connector, cloud or on-premises via gateway | An external Azure storage account (ADLS Gen2/Blob) holding Parquet, CSV, or other supported file formats | 150+ Power Query connectors |
| **Transformation** | Lightweight only (type conversion, column mapping, merge/split files, flatten hierarchy) | None — pure high-throughput bulk load | Rich — 300+ Power Query transformation functions |
| **Best fit** | Petabyte-scale binary or tabular copy into any Fabric store, historical or incremental, with orchestration | Fast, code-first bulk load straight into a Warehouse table from files already staged in Azure storage | Cleaning, reshaping, and profiling data from many sources before landing it, especially for less Spark/code-comfortable teams |

`COPY INTO` (also called the T-SQL `COPY` statement) is the recommended way to bulk-load a Warehouse table directly from external Azure storage:

```sql
COPY INTO dbo.TaxiTrips
FROM 'https://azureopendatastorage.blob.core.windows.net/nyctlc/yellow'
WITH (
    FILE_TYPE = 'PARQUET'
)
```

`BULK INSERT` remains available in Warehouse as well, mainly for teams porting existing SQL Server/Azure SQL Database code — `COPY INTO` is the recommended statement for new ingestion work.

> [!note] Mental model — the decision funnel
> Ask, in order: *(1) Does the destination have to be a Warehouse table, the source is already sitting in Azure storage, and the team is SQL-first with no transformation needed?* → `COPY INTO`. *(2) Does the data need real transformation — cleaning, reshaping, joins — before it lands, by a Power Query-comfortable team?* → Dataflow Gen2. *(3) Otherwise* → pipeline Copy activity (full control, any destination) or Copy job (simplified, incremental/CDC-native) — and default to Copy job specifically when the scenario says "incremental," "CDC," or "no pipeline required."

**Practice Question 3** *(Hard)*

A finance team needs to bulk-load 200 GB of Parquet files, already sitting in an ADLS Gen2 account, directly into a Fabric Warehouse table as fast as possible. The team is entirely T-SQL-skilled, has no Spark or Power Query experience, and the load needs no transformation — just a straight bulk copy on a nightly schedule via a T-SQL script already wrapped in a stored procedure. Which ingestion method fits best, and why would Dataflow Gen2 be the wrong choice here?

A. Dataflow Gen2 — because it supports the most connectors  
B. `COPY INTO` inside the nightly T-SQL stored procedure — matches the team's skillset, needs no transformation, and is the fastest bulk-load path from Azure storage into a Warehouse table; Dataflow Gen2 would force a Power Query-based tool onto a T-SQL-only team for a job that needs zero transformation  
C. Copy job — because it's the simplest UI  
D. Database mirroring — because the source is already in Azure storage  

> [!success]- Answer
> **B. `COPY INTO` inside the nightly T-SQL stored procedure — matches the team's skillset, needs no transformation, and is the fastest bulk-load path from Azure storage into a Warehouse table; Dataflow Gen2 would force a Power Query-based tool onto a T-SQL-only team for a job that needs zero transformation**
>
> Every signal in the scenario points to `COPY INTO`: T-SQL-only team, Warehouse destination, source already in Azure storage in a supported format (Parquet), no transformation requirement, and a stored-procedure-based nightly schedule that a T-SQL team can maintain directly. Dataflow Gen2 is the wrong tool not because it lacks capability, but because it's the wrong skillset fit for a job with zero transformation need — it would add a Power Query layer the team doesn't need and isn't equipped to maintain. Copy job is a reasonable alternative in general, but it doesn't beat a native T-SQL bulk-load statement for a T-SQL-first team with no incremental/CDC requirement stated. Mirroring isn't relevant — the source is a storage account, not an operational database.

## Use Cases

- Loading historical and incremental data from on-premises and multicloud sources into a bronze-layer lakehouse using pipeline Copy activity, when the team prefers a low-code UI over Spark
- Replacing a hand-built watermark control table with Copy job's native CDC-based incremental copy when the source database already has CDC enabled
- Bulk-loading Parquet or CSV files already staged in ADLS Gen2 directly into a Warehouse table via `COPY INTO`, for a T-SQL-first team with no transformation requirement
- Upserting changed records into an Azure SQL Database or Lakehouse table sink using Copy activity's `Upsert` write behavior, keyed on a business identifier

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Rows silently missing after a Copy activity run, with no error raised | `Skip incompatible rows` was enabled without `Enable logging` or `Data consistency verification` | Turn on logging and consistency verification alongside fault tolerance so skipped rows are visible and counted |
| Increasing `Degree of copy parallelism` has no effect on throughput | `Partition option` is set to `None` — parallelism has nothing to parallelize | Enable `Physical partitions of table` or `Dynamic range` partitioning on the source before increasing parallel copies |
| Duplicate rows appear in a database sink after retries | `Write behavior` was left at `Insert` for a scenario that needs upsert semantics | Switch to `Upsert` with the correct key columns, or add a `Pre-copy script` to clean up before re-running |
| Workspace staging fails on a long-running Copy activity | Built-in workspace staging times out at 60 minutes | Switch to external Azure Blob Storage/ADLS Gen2 staging for long-running jobs |
| A needed connector doesn't appear as a Copy activity source/sink option | The connector is Dataflow Gen2 (Power Query)-only, not a pipeline connector | Use Dataflow Gen2 instead, or land the data in a pipeline-compatible intermediate format first |
| `COPY INTO` fails to load into a lakehouse table | `COPY INTO` targets Warehouse tables only, not lakehouses | Use a pipeline Copy activity, Copy job, or a Spark notebook to load a lakehouse instead |

## Best Practices

- Default to Copy job for incremental/CDC-driven copy scenarios — it's less to build and maintain than a hand-rolled watermark table in a Copy activity
- Always pair `Skip incompatible rows` with `Enable logging` and (when completeness matters) `Data consistency verification` — fault tolerance alone hides data loss
- Enable a `Partition option` before increasing `Degree of copy parallelism` — parallelism without partitioning is a no-op
- Use external (not workspace) staging for any Copy activity expected to run longer than 60 minutes
- Reach for `COPY INTO` when the destination is a Warehouse table, the source is already in Azure storage, and the team is T-SQL-first with no transformation need — it beats a pipeline for that specific shape

## Exam Tips

> [!tip] Exam Tips
>
> - Upsert write behavior is a sink-side setting on database-family connectors (Azure SQL DB, Warehouse, Lakehouse tables, Dataverse) — file-based sinks don't have it
> - Partition option and Degree of copy parallelism are two separate settings that work together — partitioning without parallelism (or vice versa) under-delivers
> - Copy job's headline additions over Copy activity: native CDC-based incremental copy (including deletes), SCD Type 2 (Preview), auto-partitioning (Preview), no pipeline canvas required
> - `COPY INTO` is Warehouse-only, source must be external Azure storage, and it does zero transformation — a T-SQL-skilled-team + Warehouse-destination scenario is the signal
> - Binary copy = byte-for-byte, no type awareness; tabular copy = schema-aware conversion via an interim type system

## Key Takeaways

- Copy activity gives full pipeline control over source/sink settings, staging, partitioned parallel reads, and fault-tolerant row/file skipping
- Copy job trades some flexibility for a simplified, pipeline-free experience purpose-built for incremental and CDC-based copy, replacing hand-built watermark logic
- Connector coverage differs by tool — 170+ sources overall, but Copy activity/Copy job (50+/40+) and Dataflow Gen2 (150+) don't fully overlap
- `COPY INTO` is the fast, code-first path for bulk-loading a Warehouse table from external Azure storage; Dataflow Gen2 is the transformation-rich, Power Query-based option; pipelines cover everything else
- Fault tolerance settings (skip incompatible rows, skip error file) prevent hard failures but need logging/consistency verification alongside them to avoid silent data loss

## Related Topics

- [03-Mirroring](./03-mirroring.md)
- [01-Full vs. Incremental Loads](../05-loading-patterns/01-full-incremental-loads.md)

## Official Documentation

- [How to copy data using copy activity](https://learn.microsoft.com/en-us/fabric/data-factory/copy-data-activity)
- [What is Copy job in Data Factory](https://learn.microsoft.com/en-us/fabric/data-factory/what-is-copy-job)
- [Connector overview](https://learn.microsoft.com/en-us/fabric/data-factory/connector-overview)
- [What is Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/data-factory-overview)
- [Fabric decision guide — copy activity, dataflow, Eventstream, or Spark](https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-pipeline-dataflow-spark)
- [Ingest data into your Warehouse using the COPY statement](https://learn.microsoft.com/en-us/fabric/data-warehouse/ingest-data-copy)
- [Configure Azure SQL Database in a copy activity](https://learn.microsoft.com/en-us/fabric/data-factory/connector-azure-sql-database-copy-activity)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-mirroring.md) | [↑ Back to Section](./batch-ingestion.md) | [Next →](../07-batch-transformation/batch-transformation.md)**
