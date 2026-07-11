---
title: Notebook and T-SQL Errors
type: topic
tags:
  - dp-700
  - fabric
  - error-resolution
  - spark
  - notebooks
  - tsql
  - warehouse
  - out-of-memory
  - transactions
---

# Notebook and T-SQL Errors

## Overview

Notebook/Spark failures and T-SQL Warehouse failures are the two most code-adjacent error surfaces on the exam — both require matching a specific exit code or error number to a root cause rather than guessing from a vague symptom. This topic covers Spark session/capacity errors, the out-of-memory decision tree (driver vs. executor), `AnalysisException` patterns, and the Warehouse-side world of unsupported T-SQL syntax, snapshot-isolation conflicts, and `COPY INTO` rejected-row diagnostics.

> [!abstract]
>
> - Spark executor failures carry an **exit code** (137 = OOM/SIGKILL, 143 = SIGTERM, 134 = SIGABRT, 1 = user code, -100 = preempted) — the exit code is the first diagnostic branch point
> - **Driver OOM** (from `collect()`/`toPandas()`) and **executor OOM** (from data skew or too few partitions) have different fixes — pulling more memory doesn't fix a skew problem
> - Fabric enforces **core-based Spark throttling**: a session submitted when capacity is full returns `TooManyRequestsForCapacity` (HTTP 430), and queued jobs expire after 24 hours
> - Fabric Warehouse uses **snapshot isolation exclusively** — `SET TRANSACTION ISOLATION LEVEL` is silently ignored, and update conflicts throw error **24556** or **24706**, both fixed by retry logic, not a different isolation level
> - `COPY INTO`'s `ERRORFILE` option writes rejected rows to a statement-ID-named folder containing an `error.Json` file (reject reasons) and a `row.csv` file (the rejected rows themselves)

> [!tip] What the Exam Tests
>
> - Diagnosing a Spark OOM by exit code and matching it to driver vs. executor vs. data-skew root causes
> - Recognizing `TooManyRequestsForCapacity` / HTTP 430 as a capacity-queueing signal, not a code bug
> - Distinguishing `AnalysisException` categories (table not found, column not found, schema mismatch) and their fixes
> - Knowing Fabric Warehouse's T-SQL surface-area gaps (no `SET TRANSACTION ISOLATION LEVEL`, no triggers, no synonyms) and snapshot isolation's write-write conflict behavior
> - Configuring `COPY INTO`'s `ERRORFILE`/`MAXERRORS` to diagnose rejected rows instead of a load failing outright

---

## Spark Session and Capacity Errors

Fabric allocates Spark compute from capacity in **Spark VCores** (1 capacity unit = 2 Spark VCores), with **bursting** allowing up to 3× the purchased VCores when capacity is otherwise idle. When a notebook or lakehouse job is submitted while capacity is fully used, Fabric returns:

```text
[TooManyRequestsForCapacity] HTTP Response code 430: This Spark job can't be
run because you have hit a Spark compute or API rate limit. To run this Spark
job, cancel an active Spark job through the Monitoring hub, or choose a larger
capacity SKU or try again later.
```

Jobs triggered from pipelines, the scheduler, or Spark Job Definitions are automatically **queued (FIFO)** and retried as capacity frees up — but ==queue expiration is 24 hours from submission==, after which the job is dropped and must be resubmitted. Queueing does **not** apply to interactive notebook runs or notebook jobs submitted via the public API — those fail immediately instead of queueing. If the capacity itself is in a throttled state, new Spark jobs are rejected outright rather than queued.

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| `TooManyRequestsForCapacity` (HTTP 430) | Capacity's available Spark VCores are fully consumed | Cancel an active job via Monitor hub, wait for the queue, choose a larger SKU, or enable Autoscale Billing to move Spark off shared capacity entirely |
| `403 Forbidden` / "User is not authorized... requires ReadAll permission" | Missing workspace role (need Contributor+) or missing item-level `ReadData`/`ReadAll` permission on the Lakehouse/notebook | Grant the correct workspace role and item permission; for Spark specifically, grant **ReadAll**, not just **ReadData** |
| `SparkContextInitializationTimedOut` | Driver failed to initialize within the timeout — often large/numerous custom libraries slowing startup, or resource contention | Reduce custom library count/size; verify sufficient capacity is free; check for VNet/private-endpoint connectivity delays |
| `SparkSubmitProcessTimedOut` / `PersonalizationFailed` | `spark-submit` took too long to start, or custom environment/library setup failed during session personalization | Reduce large custom libraries; remove recently added packages one at a time to isolate the failure |
| `Spark_System_YARNApplication_KilledByTrustedServiceUser` (exit code 13) | Invalid Spark configuration (bad units, out-of-range value) killed the session on startup | Review `%%configure` values — e.g., `spark.rpc.message.maxSize` must be a plain integer, capped at 2047 MB |

> [!note] Mental model — queueing vs. throttling vs. rejection
> Think of Spark admission as three doors in sequence. **Queueing** is a waiting room — your job gets in eventually (within 24 hours) once a seat frees up. **Throttling** is a bouncer slowing the door — requests get delayed, not dropped. **Rejection** (`CapacityLimitExceeded`) is the door closed entirely — the platform has moved past throttling because there's truly no room, and the request fails outright rather than waiting.

## Out-of-Memory: Driver vs. Executor

Exit codes are the entry point for any Spark memory investigation, checked from the **Executors** tab of the Spark UI (reached via Monitor hub → application → **Jobs** tab → select a job description):

| Exit Code | Meaning | Most Likely Cause |
| :--- | :--- | :--- |
| **137** | Killed by OS (`SIGKILL`) | Out of memory — container exceeded its memory limit |
| **143** | Terminated (`SIGTERM`) | Timeout, preemption, or a normal dynamic-allocation scale-down |
| **134** | Aborted (`SIGABRT`) | JVM crash or native memory corruption |
| **1** | General error | User code exception, misconfiguration, or missing dependency |
| **-100** | Container preempted/lost | Node preemption or platform-side container loss |

Container memory is `spark.executor.memory + spark.executor.memoryOverhead`; in Fabric, `memoryOverhead` defaults to a fixed **384 MB regardless of node size** (unlike open-source Spark's `max(384 MB, 10% of executor memory)`), which is frequently too small for PySpark UDFs, large shuffles, or native libraries.

**Driver OOM** typically comes from pulling too much data to the driver process:

- `.collect()`, `.toPandas()`, or `display(df)` without a `.limit(N)` first — all three pull the *entire* result set into driver memory
- A broadcast join where Spark auto-broadcasts a table too large for the configured threshold
- Very complex query plans under Adaptive Query Execution (AQE), which regenerates plan text on every plan change — mitigate with `spark.sql.maxPlanStringLength`

**Executor OOM** typically comes from uneven or oversized partitions:

- **Data skew** — a handful of tasks process 10–100× more input than the rest (confirm in the Spark UI **Stages** tab, sorted by input size); fix with `spark.sql.adaptive.skewJoin.enabled` (AQE is on by default in Fabric) or manual salting
- **Too few partitions** for the data volume — repartition toward 128–256 MB per partition
- **Over-caching** — multiple large `.cache()`/`.persist()` calls without `.unpersist()`
- **PySpark/Pandas UDFs** — a separate Python process competes with the JVM executor for the same node memory; prefer built-in Spark SQL functions, or reduce `spark.sql.execution.arrow.maxRecordsPerBatch`

> [!warning] Common Mistake
> Reflexively increasing `spark.executor.memory` for every OOM. If the Spark UI's **Stages** tab shows a handful of tasks with dramatically larger input than the rest, the problem is **skew**, and more memory per executor doesn't fix it — the oversized partition still lands entirely on one executor. Enable AQE skew-join handling or repartition first; only scale up memory once partition sizes are actually balanced.

> [!note] Mental model — %%configure vs. spark.conf.set()
> `spark.executor.*`, `spark.driver.*`, `spark.network.*`, and `spark.yarn.*` settings are **poured at session cast time** — they're read once when the session/executors launch and can't be reshaped afterward with `spark.conf.set()`. Put them in a `%%configure` cell as literally the first cell in the notebook (it restarts the session). Only `spark.sql.*` settings (AQE, shuffle partitions, broadcast threshold) are **still-wet clay** — changeable mid-session with `spark.conf.set()`.

**Practice Question 1** *(Medium)*

A Spark job's Executors tab shows most tasks completing in under a minute, but two specific tasks run for 40+ minutes before failing with exit code 137. All other Spark configuration is default. What is the most likely root cause and first fix?

A. Insufficient `spark.driver.memory` — increase the driver's heap size  
B. Data skew — a few partitions are processing disproportionately more data  
C. A missing library dependency — reinstall the environment's Python packages  
D. Gateway throttling — reduce the number of concurrent pipeline triggers  

> [!success]- Answer
> **B. Data skew — a few partitions are processing disproportionately more data**
>
> A small subset of long-running, eventually-OOM-killed tasks against many fast-completing tasks is the textbook data-skew signature, confirmed by comparing input size across tasks in the Stages tab; the fix is enabling AQE skew-join handling or repartitioning the affected keys. Driver memory (A) wouldn't explain executor-level exit code 137 on specific tasks, a missing dependency (C) would fail immediately and consistently rather than after 40 minutes, and gateway throttling (D) is unrelated to Spark task execution.

## AnalysisException Patterns

`AnalysisException` fires during Spark's **query analysis phase**, before any data is processed — it's almost always a user-side authoring issue (typo, missing table, incompatible type), and because it fails early, no compute is wasted.

| Scenario | Message pattern | Fix |
| :--- | :--- | :--- |
| Table/view not found | `Table or view not found: my_table` | Check spelling/case; use a fully-qualified `catalog.schema.table` name; re-create expired temp views |
| Column not found | `[UNRESOLVED_COLUMN.WITH_SUGGESTION]` cannot be resolved, with suggested valid columns listed | Compare against `df.printSchema()`; check for an upstream rename/drop |
| Ambiguous reference | `[AMBIGUOUS_REFERENCE] Reference 'X' is ambiguous` | Qualify the column with its table alias (`a.id` vs. `b.id`) after a join |
| Data type mismatch | `Data type mismatch: differing types in '(col_a = col_b)': int vs string` | Explicitly `.cast()` to a common type before comparing/joining |
| Schema mismatch on write | `A schema mismatch detected when writing to the Delta table` | Compare `df.printSchema()` against `DESCRIBE my_table`; align columns/types, or use `.option("mergeSchema", "true")` for intentional evolution |
| Path doesn't exist | `Path does not exist: abfss://...` | Verify the path in the Lakehouse explorer; a "path not found" sometimes really means "access denied" |

## Session, Library, and Runtime Errors

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| `Spark_User_Conda_PipFailed` | Library install failed during environment setup — bad package name/version, a conflicting pre-installed package version, or a missing system-level dependency | Verify the package on PyPI; remove version pins to let pip resolve compatibility; check the Fabric runtime's pre-installed package list |
| `Spark_System_MetaStore_HiveException` — "lock acquisition timed out" | Concurrent DDL (`ALTER`/`DROP`/`CREATE`) from multiple sessions against the same table | Avoid concurrent DDL on one table; retry after the other session's operation completes |
| `Spark_Ambiguous_UserApp_NullPointer` / Python `KeyError`/`TypeError`/`AttributeError` | Null values reaching a UDF, a missing dictionary key, or an API method called on the wrong object type (e.g., calling `.show()` on the *list* returned by `.collect()`) | Filter nulls before UDF calls; use `.get(key, default)`; check Spark version migration notes for renamed/removed methods |
| `INCONSISTENT_BEHAVIOR_CROSS_VERSION` — datetime values shift after a runtime upgrade | Spark 3.0+ switched to the Proleptic Gregorian calendar; historical dates written under the old (Julian-hybrid) behavior read back differently | Set `spark.sql.parquet.datetimeRebaseModeInRead/Write` to `CORRECTED`, but validate on a sample first — `CORRECTED` on `LEGACY`-written historical data (pre-1582) can silently shift values |

The **Spark UI**, reached from Monitor hub → application → **Jobs** tab → job description, is the primary diagnostic surface: **Executors** for exit codes and memory, **Stages** for skew/duration, **Storage** for cached DataFrame size vs. node RAM, and **Environment** for the active configuration. For text-level detail beyond the UI's graphs — the exact stack trace, `stdout`/`stderr` — download **Driver**, **Livy**, or **Prelaunch** logs from the application's **Logs** tab (see [09-Monitoring Surfaces: Spark Application Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md#spark-application-monitoring)); logs may be unavailable if the job never left the queue or cluster creation failed, in which case check capacity utilization instead.

## T-SQL Warehouse: Unsupported Syntax and Data-Type Errors

Fabric Warehouse and the SQL analytics endpoint support a **subset** of T-SQL. Commands the exam expects you to recognize as **not supported** — attempting them can appear to succeed while corrupting warehouse state, so don't rely on trial and error:

==`BULK LOAD`, `CREATE USER`, materialized views, `PREDICT`, recursive queries, `SELECT...FOR XML`, `SET ROWCOUNT`, `SET TRANSACTION ISOLATION LEVEL`, `sp_showspaceused`, synonyms, triggers, and the vector data type/search functions.== `ALTER TABLE` support is limited to adding nullable columns, dropping columns, `NOT ENFORCED` key constraints, and (preview) `ALTER COLUMN` — every other `ALTER TABLE` variant is blocked.

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| A `SET TRANSACTION ISOLATION LEVEL` statement runs without error but has no effect | Fabric Warehouse enforces **snapshot isolation on every transaction**; isolation-level changes are silently ignored | Don't attempt to change isolation level — design around snapshot isolation's behavior instead |
| `tempdb` space exhaustion during a large query | Missing/stale column statistics, or a query with heavy `GROUP BY`/`ORDER BY`/`JOIN` returning a huge result set | Verify and refresh statistics; reduce grouping/ordering columns where possible; avoid running the query concurrently with other heavy workloads |
| A `SELECT` completes on the backend but the client never receives results | Front-end/client-side issue delivering the result set, not a query failure | Retry from a different client (SSMS, VS Code MSSQL extension, Fabric SQL query editor); use `CTAS` to send results to a table instead of back to the client, to isolate backend vs. client |

## Transaction and Locking Conflicts: Snapshot Isolation

Fabric Warehouse uses **table-level locking** for every statement, regardless of how many rows are actually touched — `SELECT` takes a Schema-Stability (`Sch-S`) lock, `INSERT`/`UPDATE`/`DELETE`/`MERGE`/`COPY INTO` take Intent Exclusive (`IX`), and DDL takes Schema-Modification (`Sch-M`). Snapshot isolation means readers never block writers and writers never block readers — but **two transactions writing to the same table can still conflict**, evaluated at commit time:

| Error | Message | Trigger |
| :--- | :--- | :--- |
| **Error 24556** | "Snapshot isolation transaction aborted due to update conflict... can cause update conflicts if rows in that table have been deleted or updated by another concurrent transaction. Retry the transaction." | Two transactions both attempt `UPDATE`/`DELETE`/`MERGE`/`TRUNCATE` against the same table |
| **Error 24706** | "Snapshot isolation transaction aborted due to update conflict... cannot use snapshot isolation to access table... to update, delete, or insert the row that has been modified or deleted by another transaction. Please retry the transaction." | Same conflict class, triggered on insert/update/delete against a row another transaction already touched |

Conflicts are evaluated at the **table level**, not the individual parquet file — so even a `MERGE` that only *appends* new rows can still register as a write-write conflict if it isn't the first transaction to commit. `INSERT` statements always create new parquet files, so they conflict less often than `UPDATE`/`DELETE`/`MERGE`/`TRUNCATE`. The documented fix for both errors is the same: ==retry the failed transaction== (ideally with exponential backoff) — there's no isolation-level workaround, because snapshot isolation is the only level Fabric Warehouse offers.

> [!note] Mental model — table-level snapshot locking
> Every table in Fabric Warehouse behaves like a **single shared whiteboard, photographed at the start of each transaction**. Two people can read the whiteboard freely without blocking each other. But if two people try to *erase and rewrite* the same whiteboard at once, only the first to finish gets to keep their version — the second discovers their photo is stale and has to redo their edit (retry) against the now-current whiteboard.

**Practice Question 2** *(Medium)*

Two concurrent ETL jobs both run `MERGE` statements against the same Warehouse table, updating different sets of rows. The second job to commit fails with error 24706. What is the correct interpretation and fix?

A. The table has corrupted statistics; run `UPDATE STATISTICS` before retrying  
B. Switch the session to `READ COMMITTED` isolation to avoid the conflict  
C. Fabric Warehouse doesn't support concurrent `MERGE` statements at all; serialize all writes through a single job  
D. This is expected snapshot-isolation behavior for concurrent writers on one table; add retry logic to the failing job  

> [!success]- Answer
> **D. This is expected snapshot-isolation behavior for concurrent writers on one table; add retry logic to the failing job**
>
> Write-write conflicts are a documented, expected outcome of table-level snapshot isolation when two transactions modify the same table concurrently — even when they touch different rows, since locking is table-scoped. The fix is retry logic (with backoff), not a statistics rebuild (A), and Fabric Warehouse doesn't forbid concurrent MERGE (C) — it just resolves conflicts at commit time. Isolation level changes (B) are silently ignored; Fabric Warehouse only offers snapshot isolation.

## COPY INTO Rejected-Row Diagnostics

`COPY INTO`'s `ERRORFILE` option redirects rows that fail to load instead of aborting the whole statement. In Fabric Data Warehouse, `ERRORFILE` applies to **CSV and JSONL** (not Parquet — Parquet data-type conversion errors always fail the whole `COPY INTO`, ignoring `MAXERRORS`):

```sql
COPY INTO dbo.TaxiTrips
FROM 'https://account.blob.core.windows.net/container/data/'
WITH (
    FILE_TYPE = 'CSV',
    ERRORFILE = '/errorsfolder',       -- path relative to the container
    MAXERRORS = 10
)
```

Under the target `ERRORFILE` directory, Fabric creates a `_rejectedrows` child folder, then a subfolder named by load timestamp (`YearMonthDay-HourMinuteSecond`), then a subfolder named by **statement ID**. Inside that folder are two files:

| File | Contents |
| :--- | :--- |
| **`error.Json`** | The reject reasons — why each row failed to load |
| **`row.csv`** | The rejected rows themselves, for inspection or reprocessing |

`MAXERRORS` caps how many rejected rows are tolerated before the whole `COPY INTO` fails (default **0** — any rejected row fails the load unless `MAXERRORS` is raised). If `ERRORFILE` points at the full path of a *different* storage account than the source, `ERRORFILE_CREDENTIAL` authenticates to it (only Shared Access Signature is supported in Fabric); otherwise the same `CREDENTIAL` used for the source applies. When using a firewall-protected storage account for the error file, `MAXERRORS` must also be specified.

## Query Insights for Diagnosis

Beyond ad hoc error messages, the Warehouse-side **query insights** views (queryable via T-SQL against `queryinsights.exec_requests_history` and related DMVs) surface historical query text, duration, and resource consumption without needing to reproduce a failure live — useful for diagnosing an intermittent `tempdb` exhaustion or a query that degrades gradually rather than failing outright. Pair query insights with `sys.dm_tran_locks` when a symptom looks like blocking rather than an outright error — see [11-Performance Optimization](../11-performance-optimization/performance-optimization.md) for query-tuning depth beyond error diagnosis.

## Use Cases

- Triaging a Spark OOM by exit code before touching any configuration — 137 means memory, 143 usually means a benign scale-down, 1 means read the stack trace
- Distinguishing driver OOM (fix the collect/toPandas call) from executor OOM caused by skew (fix the partitioning)
- Recognizing `TooManyRequestsForCapacity` as a queueing signal and knowing the 24-hour queue-expiration window
- Diagnosing a rejected-row `COPY INTO` load by reading `error.Json` next to `row.csv` instead of re-running the whole load blind
- Explaining a snapshot-isolation write-write conflict (24556/24706) as expected behavior requiring retry logic, not a bug report

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Notebook fails immediately with HTTP 430 during a busy period | Capacity's Spark VCores are fully consumed; interactive runs don't queue | Cancel a running job via Monitor hub, wait, or move to Autoscale Billing |
| Executor exit code 137 recurs even after increasing `spark.executor.memory` | The real cause is data skew, not insufficient total memory | Enable `spark.sql.adaptive.skewJoin.enabled`; repartition toward 128–256 MB partitions |
| `AnalysisException: Table or view not found` right after an upstream cell wrote the table | Session/catalog caching lag, or the write hasn't actually completed | Confirm the write succeeded before querying; use a fully-qualified name |
| A T-SQL script with `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` runs but behaves like snapshot isolation | Fabric Warehouse ignores isolation-level changes and always uses snapshot isolation | Remove the statement; design retry logic around snapshot isolation instead |
| `COPY INTO` fails outright on a Parquet load with a handful of bad rows despite `MAXERRORS = 100` | `MAXERRORS` doesn't apply to Parquet data-type conversion failures | Pre-validate/clean Parquet source data, or switch to CSV/JSONL where `ERRORFILE`/`MAXERRORS` are honored |

## Best Practices

- Check the Spark UI **Executors** tab's exit codes before changing any `spark.*` configuration
- Put `spark.executor.*`/`spark.driver.*`/network/YARN settings in a `%%configure` first cell; reserve `spark.conf.set()` for `spark.sql.*` runtime-tunable settings
- Build retry-with-backoff into any application or pipeline stored procedure that writes to a Fabric Warehouse table under concurrent load
- Use `ERRORFILE`/`MAXERRORS` proactively on CSV/JSONL `COPY INTO` loads from external, less-trusted sources rather than letting one bad row fail the whole batch
- Validate `CORRECTED` datetime rebase mode against a sample of historical dates before applying it broadly to a runtime-upgraded pipeline

## Exam Tips

> [!tip] Exam Tips
>
> - Exit codes: **137** = OOM/SIGKILL, **143** = SIGTERM (often benign scale-down), **134** = SIGABRT, **1** = user code error, **-100** = preempted
> - `TooManyRequestsForCapacity` = **HTTP 430**; queued jobs expire after **24 hours**; interactive notebook runs don't queue at all
> - Fabric Warehouse: snapshot isolation **only** — `SET TRANSACTION ISOLATION LEVEL` is silently ignored
> - Write-write conflict errors: **24556** and **24706** — both fixed by retry logic, evaluated at the **table level**
> - `COPY INTO` `ERRORFILE` applies to **CSV and JSONL only**; output = **`error.Json`** + **`row.csv`** under a statement-ID folder; default `MAXERRORS` = **0**
> - Unsupported T-SQL to memorize: triggers, synonyms, materialized views, `SET ROWCOUNT`, `SET TRANSACTION ISOLATION LEVEL`, recursive queries

## Key Takeaways

- Spark OOM diagnosis starts with the exit code, then branches to driver-side (collect/toPandas) or executor-side (skew, partitioning, caching) fixes — they are not interchangeable
- Fabric's Spark admission model is core-based: queueing (FIFO, 24h expiry) for scheduled/pipeline jobs, immediate failure for interactive sessions when capacity is exhausted
- Fabric Warehouse's single isolation level (snapshot) makes write-write conflicts (24556/24706) an expected, retry-driven outcome rather than a defect
- `COPY INTO`'s `ERRORFILE` + `MAXERRORS` combination turns a hard load failure into a partial, diagnosable success — but only for CSV/JSONL, not Parquet
- `AnalysisException` fails fast, before compute is spent, and its message almost always names the exact table/column/type at fault

## Related Topics

- [01-Pipeline and Dataflow Gen2 Errors](./01-pipeline-dataflow-errors.md)
- [09-Monitoring Surfaces: Spark Application Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md)
- [07-Batch Transformation: PySpark Transformations](../07-batch-transformation/02-pyspark-transformations.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Official Documentation

- [Troubleshooting guide for Spark jobs in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/troubleshoot-spark)
- [Troubleshoot permission and capacity errors in Data Engineering](https://learn.microsoft.com/en-us/fabric/data-engineering/troubleshoot-permissions-capacity)
- [Concurrency limits and queueing in Apache Spark for Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-job-concurrency-and-queueing)
- [Troubleshoot the Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/troubleshoot-fabric-data-warehouse)
- [Transactions in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/transactions)
- [T-SQL surface area in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area)
- [Ingest data into your Warehouse using the COPY statement](https://learn.microsoft.com/en-us/fabric/data-warehouse/ingest-data-copy)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-pipeline-dataflow-errors.md) | [↑ Back to Section](./error-resolution.md) | [Next →](./03-realtime-errors.md)**
