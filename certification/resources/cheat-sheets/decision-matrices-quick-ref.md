---
title: "Decision Matrices — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - decision-matrix
  - data-store
  - transform-tool
  - orchestration
  - streaming-engine
---

# Decision Matrices — Quick Reference

THE picker sheet. Every "choose between X/Y/Z" family the exam tests, on one page: data store, transform tool, orchestration tool, streaming engine, shortcuts vs. mirroring vs. copy, and native tables vs. shortcuts. Condensed from [06-batch-ingestion](../../06-batch-ingestion/batch-ingestion.md), [07-batch-transformation](../../07-batch-transformation/batch-transformation.md), [04-orchestration](../../04-orchestration/orchestration.md), and [08-streaming-data](../../08-streaming-data/streaming-data.md).

> [!abstract] Quick Reference
>
> - Data store: lakehouse / warehouse / eventhouse / Fabric SQL database — plus the Domain 2 decision spine
> - Transform tool: Dataflow Gen2 / notebook / KQL / T-SQL
> - Orchestration tool: Dataflow Gen2 / pipeline / notebook (+ Apache Airflow job)
> - Streaming engine: Eventstream / Spark Structured Streaming / KQL-Eventhouse
> - Shortcuts vs. mirroring vs. copy; native tables vs. shortcuts + query acceleration

---

## 1. Data Store — Lakehouse / Warehouse / Eventhouse / Fabric SQL Database

| Factor | Lakehouse | Warehouse | Eventhouse (KQL DB) | Fabric SQL Database |
| :--- | :--- | :--- | :--- | :--- |
| Primary workload | Big data engineering, un/semi/structured, ML | Enterprise DW, SQL BI, OLAP | Streaming/time-series, telemetry, logs | OLTP transactional apps |
| Language surface | Spark read/write; SQL endpoint ==read-only== | ==Full T-SQL DML== | KQL native; SQL endpoint ==read-only== | ==Full T-SQL DML== (Azure SQL engine) |
| Latency | Batch/interactive, minutes-scale | Interactive OLAP, batch loads | ==Near real-time== — seconds | Low-latency OLTP (ms) |
| Streaming fit | Spark Structured Streaming sink | Not built for streaming | ==Purpose-built== | Not a stream target; auto-mirrors out |

> [!note] ==Every lakehouse/eventhouse/mirrored-DB SQL analytics endpoint is read-only== — the label "SQL" never implies DML. Only Warehouse and Fabric SQL database's primary surface accept `INSERT`/`UPDATE`/`DELETE`/`MERGE`.

### The Domain 2 Decision Spine — pick the store, the rest follows

| Data lands in… | Native transform | Streaming role | DML |
| :--- | :--- | :--- | :--- |
| Lakehouse | PySpark/Spark SQL | Spark Structured Streaming sink | endpoint read-only |
| Warehouse | T-SQL | not a streaming target | full DML |
| Eventhouse | KQL (update policy/MV, native tables only) | Eventstream destination | endpoint read-only |
| Fabric SQL DB | T-SQL (OLTP) | not a stream target; auto-mirrors | full DML |

**Distractor patterns:** "full T-SQL DML on curated data" → NOT lakehouse (read-only endpoint); "time-series + KQL + sub-second" → eventhouse, not warehouse; "OLTP app needing analytics without ETL" → Fabric SQL database (auto-mirrors), not out-of-scope; "everything lands in OneLake anyway" → store choice still matters (language surface/latency/DML differ).

---

## 2. Transform Tool — Dataflow Gen2 / Notebook / KQL / T-SQL

| Factor | Dataflow Gen2 | Notebook (PySpark) | KQL (Eventhouse) | T-SQL (Warehouse) |
| :--- | :--- | :--- | :--- | :--- |
| Skill profile | Low-code, Power Query | Code-first, data engineers | KQL, real-time/telemetry analysts | SQL-first, DBA/BI |
| Volume | Low–medium (100s MB–low 10s GB) | ==Low–high==, TB-scale | High-volume streaming, not general batch | Low–high, SQL-shaped |
| Sources | ==150+== connectors | Anything Spark reaches | Eventstream, ADX, storage | Warehouse tables; lakehouse endpoint read-only |
| Expressiveness | ==300+== visual transforms, no custom code | Unlimited — arbitrary code, ML, UDFs | `summarize`/`extend`/`parse`, not general-purpose | Full DML/DDL, window functions, CTEs |

**Verb heuristic:** "wrangle/clean/combine visually" → Dataflow Gen2. "custom logic/ML/arbitrary Python" → Notebook. "aggregate telemetry/rolling window/real time" → KQL. "upsert/star schema/stored procedure" → T-SQL.

> [!warning] A tool being *capable* (Spark can technically do anything) ≠ the *best* answer. Match skillset + volume first — they eliminate the wrong answer before expressiveness or cost matter.

**Frequently confused pairs:** Dataflow Gen2 (transform) vs. Copy activity (pure movement, no transform beyond type/column mapping). Notebook vs. T-SQL for warehouse-adjacent work — DML requirement decides: writing/upserting into a warehouse → T-SQL `MERGE` wins unless transform logic itself demands Spark.

---

## 3. Orchestration Tool — Dataflow Gen2 / Pipeline / Notebook (+ Airflow)

| Dimension | Dataflow Gen2 | Pipeline | Notebook |
| :--- | :--- | :--- | :--- |
| Authoring | Low-code, Power Query | Low-code, drag-and-drop canvas | Code-first |
| Transform power | ==300+== transforms | ==None natively== — calls other tools | Unlimited |
| Orchestration | ==None== — no scheduling of other items | ==Full== — schedules, triggers, control flow, retries | Can call other notebooks via `notebookutils`, no schedule UI of its own |
| Parameterization | Public parameters = **Preview**; required param blocks scheduling/manual trigger | Full — parameters + variables + expressions | Parameter cell / `args` dict |

> [!warning] Common Mistake — Dataflow Gen2 **cannot** schedule/orchestrate other items; only a **pipeline** does. A dataflow needing a required public parameter **and** an unattended schedule is an unsupported combination as described (Preview limitation).

**Apache Airflow job** = 4th surface: code-first, Python DAGs, Airflow provider ecosystem (e.g. `astronomer-cosmos` for dbt) — reach for it when the team already has Airflow investment, not as a pipeline replacement.

**Composition is the norm**, not the exception: pipeline (conductor) invokes Dataflow Gen2 (prep) and/or notebook (heavy transform) in one run — a scenario naming multiple needs (coordination + custom logic) usually wants **two tools together**, not one "best" tool.

---

## 4. Streaming Engine — Eventstream / Spark Structured Streaming / KQL-Eventhouse

| Factor | Eventstream | Spark Structured Streaming | KQL / Eventhouse |
| :--- | :--- | :--- | :--- |
| Role | No-code ingest + in-flight transform + route | Code-first stream processing | Native real-time query engine + destination |
| Sources | ==30+== connectors (Event Hubs, IoT Hub, CDC, Kafka…) | Anything with a Spark connector | Eventstream, or native ingestion clients |
| Transform | 7 no-code operators, ==no arbitrary code== | ==Unbounded== — full PySpark/Scala, UDFs, ML | KQL operator set — powerful, scoped |
| Query latency | ms–s in transit; query latency = destination's | Micro-batch (seconds); not sub-second interactive | ==Sub-second to seconds== |
| Windowing | Group by: tumbling/hopping/sliding/session, no-code | `window()`/`session_window()`, full control | `bin()` in `summarize`, `row_window_session()` |

> [!note] Eventstream is a **transform-and-route hub, not a query engine** — the query destination is always a separate item (lakehouse, Eventhouse). A single eventstream can fan out to multiple destinations simultaneously (a first-class pattern).

**Reference topology:** `Source → Eventstream (filter/reshape) → [Spark: ML scoring/complex joins] → Lakehouse (batch BI)` and `Eventstream → Eventhouse → sub-second dashboard`. Engines compose; a multi-stage scenario often has more than one "correct" engine, one per stage.

---

## 5. Shortcuts vs. Mirroring vs. Copy

| Factor | Mirroring | Shortcut | Copy Activity (pipeline) | Copy job (CDC, Preview) |
| :--- | :--- | :--- | :--- | :--- |
| Data movement | Continuous replication — data **is** copied, near real-time | ==None== — live pointer | One-time/scheduled batch | Scheduled/triggered incremental, CDC-based (incl. deletes) |
| Freshness | ~15s for database mirroring | Always current (it's the source) | As fresh as last run | As fresh as last run |
| Best fit | Entire operational DB needs continuous availability | Data already query-compatible, no transform needed | Needs transformation/format conversion/orchestration | Selected tables need incremental sync w/ deletes |
| Duplication | Governed duplicate (free tier: 1 TB/CU) | None | Full duplicate, reshaped | Duplicate at destination |

**Decision funnel (in order):** (1) Entire supported operational DB needing continuous sync? → **mirroring**. (2) Data already query-compatible, no transform? → **shortcut**. (3) Needs transformation/reshaping? → **pipeline copy**.

**Mirroring flavors:** Database mirroring (known RDBMS/NoSQL: Azure SQL, Snowflake, Postgres, Oracle, SAP, Cosmos DB) → full replication. Metadata mirroring (Unity Catalog, Dremio) → catalog only, shortcuts under the hood, **no data movement**. Open mirroring → any app writes to a landing zone per spec.

**Shortcut types:** Internal (KQL DB, lakehouse, mirrored ADB catalog, mirrored DB, semantic model, SQL DB, warehouse) — authorizes via ==calling user's identity== against the target, **except** Direct Lake over SQL / T-SQL Delegated mode (delegates to item owner's identity instead). External (S3, S3-compatible, ADLS Gen2, Blob, Dataverse, GCS, Iceberg, OneDrive/SharePoint, on-prem via gateway) — delegates via **cloud connections** (separate bind permission).

**Shortcut caching** (workspace-level, OneLake settings): ==GCS/S3/S3-compatible/on-prem gateway only== — never ADLS/Blob. Retention 1–28 days, files >1 GB never cached.

---

## 6. Native Tables vs. Shortcuts + Query Acceleration (Eventhouse)

| Option | Speed | Duplication | Update policy / MV support |
| :--- | :--- | :--- | :--- |
| Native table | Fastest — fully indexed, owned | Full copy in Eventhouse | ✅ |
| Unaccelerated shortcut | Slowest — network round-trip per query | None | ❌ (external table) |
| ==Query-accelerated shortcut== (GA) | Near-native — cached + indexed | Partial (cached subset, "Hot" window) | ==❌ still== — acceleration closes query speed, NOT feature parity |

> [!warning] Common Mistake — accelerating a shortcut never unlocks materialized views or update policies; those remain **native-table-only**. Dedup/aggregation on an accelerated shortcut must happen at query time (`arg_max`/`lookup`), not via a standing MV.

**Query acceleration limits:** ≤900 columns, Parquet files >6 GB not cached, no partition-pruning index support, same region as source recommended. Billing: OneLake Premium cache meter, tuned via the **Hot** property (days cached).

Query acceleration ≠ shortcut caching (that's the OneLake-wide GCS/S3/OPDG feature above) — two different mechanisms with the same goal (avoid remote round-trips) at two different layers.

---

## Gotchas & Traps

- "SQL analytics endpoint" never implies write access except for Warehouse and Fabric SQL database's primary surface — lakehouse/eventhouse/mirrored-DB endpoints are always read-only.
- Dataflow Gen2 cannot schedule or orchestrate other items — only a pipeline does; a required public parameter blocks scheduling entirely (Preview limitation).
- A tool's raw power never wins over skillset + volume fit — Spark being "capable" of a low-code job isn't the deciding factor.
- Query acceleration is a query-speed fix only — it never grants materialized views/update policies on a shortcut.
- Shortcut caching and query acceleration are different mechanisms for different layers (general OneLake shortcuts vs. Eventhouse-specific) — don't conflate them.
- Metadata mirroring moves zero data — confusing it with database mirroring leads to expecting replication lag that doesn't apply.
- Backward-deployment-style thinking doesn't apply here, but the same "read requirement literally" discipline does: "everything ends up in OneLake" is never a valid reason to skip the store/tool decision matrix.
- Eventstream is not a query engine — always trace a streaming scenario to its actual query destination before answering "which engine."

## Before the Exam, I Can…

- [ ] Pick lakehouse vs. warehouse vs. eventhouse vs. Fabric SQL database from a scenario's DML/latency/skillset signals alone
- [ ] Trace the Domain 2 decision spine from store choice to transform tool to streaming role
- [ ] Pick Dataflow Gen2 vs. notebook vs. KQL vs. T-SQL using the verb heuristic, then verify against volume/skillset
- [ ] Explain why Dataflow Gen2 can't orchestrate other items and what a pipeline adds
- [ ] Match a streaming scenario to Eventstream / Spark Structured Streaming / KQL-Eventhouse and identify the actual query destination
- [ ] Run the shortcuts vs. mirroring vs. copy decision funnel in order
- [ ] Explain what query acceleration does and does NOT unlock on a shortcut
- [ ] Recognize when a scenario needs two or three tools composed together, not one "best" tool

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
