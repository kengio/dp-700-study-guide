---
title: DP-700 Comparison Tables
type: resources
tags:
  - dp-700
  - reference
  - comparison
---

# Comparison Tables

The guide's full-size decision-matrix and comparison tables, collected in one place for exam-day scanning. Every table below is copied verbatim from the cheat sheet it lives in — this page doesn't re-derive them, it's a single-scroll index. Follow the **Source** link under each table for the full surrounding context (worked scenarios, mental models, gotchas).

> [!abstract] TL;DR
>
> - 8 full-size tables: data store, transform tool, orchestration tool, streaming engine, shortcuts vs. mirroring vs. copy (+ Copy job CDC), window-type × surface, the Who-Bypasses-What security matrix, and the monitoring-surfaces table
> - Tables are copied verbatim, not summarized — cross-check against the source cheat sheet if a row looks unfamiliar
> - Use this page for exam-morning table drills; use the source cheat sheets for the reasoning behind each row

## Table of Contents

- [[#1. Data Store — Lakehouse / Warehouse / Eventhouse / Fabric SQL Database]]
- [[#2. Transform Tool — Dataflow Gen2 / Notebook / KQL / T-SQL]]
- [[#3. Orchestration Tool — Dataflow Gen2 / Pipeline / Notebook (+ Airflow)]]
- [[#4. Streaming Engine — Eventstream / Spark Structured Streaming / KQL-Eventhouse]]
- [[#5. Shortcuts vs. Mirroring vs. Copy]]
- [[#6. Window-Type × Surface Support]]
- [[#7. The Who-Bypasses-What Matrix]]
- [[#8. Monitoring Surfaces Table]]

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

**Source:** [Decision Matrices — Quick Reference](../cheat-sheets/decision-matrices-quick-ref.md#1-data-store--lakehouse--warehouse--eventhouse--fabric-sql-database)

---

## 2. Transform Tool — Dataflow Gen2 / Notebook / KQL / T-SQL

| Factor | Dataflow Gen2 | Notebook (PySpark) | KQL (Eventhouse) | T-SQL (Warehouse) |
| :--- | :--- | :--- | :--- | :--- |
| Skill profile | Low-code, Power Query | Code-first, data engineers | KQL, real-time/telemetry analysts | SQL-first, DBA/BI |
| Volume | Low–medium (100s MB–low 10s GB) | ==Low–high==, TB-scale | High-volume streaming, not general batch | Low–high, SQL-shaped |
| Sources | ==150+== connectors | Anything Spark reaches | Eventstream, ADX, storage | Warehouse tables; lakehouse endpoint read-only |
| Expressiveness | ==300+== visual transforms, no custom code | Unlimited — arbitrary code, ML, UDFs | `summarize`/`extend`/`parse`, not general-purpose | Full DML/DDL, window functions, CTEs |

**Source:** [Decision Matrices — Quick Reference](../cheat-sheets/decision-matrices-quick-ref.md#2-transform-tool--dataflow-gen2--notebook--kql--t-sql)

---

## 3. Orchestration Tool — Dataflow Gen2 / Pipeline / Notebook (+ Airflow)

| Dimension | Dataflow Gen2 | Pipeline | Notebook |
| :--- | :--- | :--- | :--- |
| Authoring | Low-code, Power Query | Low-code, drag-and-drop canvas | Code-first |
| Transform power | ==300+== transforms | ==None natively== — calls other tools | Unlimited |
| Orchestration | ==None== — no scheduling of other items | ==Full== — schedules, triggers, control flow, retries | Can call other notebooks via `notebookutils`, no schedule UI of its own |
| Parameterization | Public parameters = **Preview**; required param blocks scheduling/manual trigger | Full — parameters + variables + expressions | Parameter cell / `args` dict |

**Apache Airflow job** = 4th surface: code-first, Python DAGs, Airflow provider ecosystem (e.g. `astronomer-cosmos` for dbt) — reach for it when the team already has Airflow investment, not as a pipeline replacement.

**Source:** [Decision Matrices — Quick Reference](../cheat-sheets/decision-matrices-quick-ref.md#3-orchestration-tool--dataflow-gen2--pipeline--notebook--airflow)

---

## 4. Streaming Engine — Eventstream / Spark Structured Streaming / KQL-Eventhouse

| Factor | Eventstream | Spark Structured Streaming | KQL / Eventhouse |
| :--- | :--- | :--- | :--- |
| Role | No-code ingest + in-flight transform + route | Code-first stream processing | Native real-time query engine + destination |
| Sources | ==30+== connectors (Event Hubs, IoT Hub, CDC, Kafka…) | Anything with a Spark connector | Eventstream, or native ingestion clients |
| Transform | 7 no-code operators, ==no arbitrary code== | ==Unbounded== — full PySpark/Scala, UDFs, ML | KQL operator set — powerful, scoped |
| Query latency | ms–s in transit; query latency = destination's | Micro-batch (seconds); not sub-second interactive | ==Sub-second to seconds== |
| Windowing | Group by: tumbling/hopping/sliding/session, no-code | `window()`/`session_window()`, full control | `bin()` in `summarize`, `row_window_session()` |

**Source:** [Decision Matrices — Quick Reference](../cheat-sheets/decision-matrices-quick-ref.md#4-streaming-engine--eventstream--spark-structured-streaming--kql-eventhouse)

---

## 5. Shortcuts vs. Mirroring vs. Copy

| Factor | Mirroring | Shortcut | Copy Activity (pipeline) | Copy job (CDC, Preview) |
| :--- | :--- | :--- | :--- | :--- |
| Data movement | Continuous replication — data **is** copied, near real-time | ==None== — live pointer | One-time/scheduled batch | Scheduled/triggered incremental, CDC-based (incl. deletes) |
| Freshness | ~15s for database mirroring | Always current (it's the source) | As fresh as last run | As fresh as last run |
| Best fit | Entire operational DB needs continuous availability | Data already query-compatible, no transform needed | Needs transformation/format conversion/orchestration | Selected tables need incremental sync w/ deletes |
| Duplication | Governed duplicate (free tier: 1 TB/CU) | None | Full duplicate, reshaped | Duplicate at destination |

**Decision funnel (in order):** (1) Entire supported operational DB needing continuous sync? → **mirroring**. (2) Data already query-compatible, no transform? → **shortcut**. (3) Needs transformation/reshaping? → **pipeline copy**.

**Source:** [Decision Matrices — Quick Reference](../cheat-sheets/decision-matrices-quick-ref.md#5-shortcuts-vs-mirroring-vs-copy)

---

## 6. Window-Type × Surface Support

| Window type | Eventstream (Group by) | KQL | Spark Structured Streaming |
| :--- | :--- | :--- | :--- |
| Tumbling | Native, no-code | `summarize <agg> by bin(ts, 5m)` | `window(col, "5 minutes")` |
| Hopping | Native, no-code | ==No dedicated operator== — approximate via `bin()` | `window(col, "5 minutes", "1 minute")` |
| Sliding | Native — emits on content change | Not a standing construct | No distinct API |
| Session | Native, set timeout | `row_window_session(...)` | `session_window(col, "10 minutes")` |
| Snapshot | Not a dedicated option | `summarize <agg> by Timestamp` (raw column) | `.groupBy("eventTime")` (raw column) |

**Source:** [Streaming & Windowing — Quick Reference](../cheat-sheets/streaming-windowing-quick-ref.md#window-type--surface-support)

---

## 7. The Who-Bypasses-What Matrix

Every granular control layer has its own independent bypass rule — mixing them up is the #1 scenario trap.

| Mechanism | Viewer | Contributor | Member | Admin | Why |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Semantic model DAX RLS | ==filtered== | sees all | sees all | sees all | DAX RLS binds only at Viewer; higher roles' blanket access supersedes it |
| Warehouse T-SQL RLS | ==filtered== | ==filtered== | ==filtered== | ==filtered== | Filter predicates apply to **every** principal, including `dbo`/`db_owner` — no role exemption |
| Warehouse DDM | ==masked== | sees all | sees all | sees all | Admin/Member/Contributor carry implicit `CONTROL`, which bundles `UNMASK` |
| OneLake security data access roles | ==filtered== | sees all | sees all | sees all | Implicit workspace **Write** overrides a OneLake security Read restriction |

> [!note] Mental model — bypass logic
> Three different rules, three different answers. **SQL-layer RLS ignores `CONTROL` entirely** — even `db_owner` gets filtered. **DDM and OneLake security both honor implicit role permissions** (`CONTROL` / **Write**) — Contributor+ sails through both. **DAX RLS only binds at Viewer** — a higher role simply outranks it.

**Source:** [Security & Governance — Quick Reference](../cheat-sheets/security-governance-quick-ref.md#the-who-bypasses-what-matrix-crown-jewel)

---

## 8. Monitoring Surfaces Table

| Surface | What to monitor | Historical depth | Access path |
| :--- | :--- | :--- | :--- |
| Monitor hub | Cross-item status/timing/error (17 item types) | 100 rows / 30 days (main); 30 days (per-item) | **Monitor** in nav pane |
| Pipeline run/activity monitoring | Run + activity detail, Gantt, I/O JSON, rerun-from-failure | 2,000+ activity runs | Pipeline → View run history → Go to monitor |
| Dataflow Gen2 refresh history | Refresh status, per-table/activity detail, downloadable logs | 50 runs UI / 250 or 6mo in OneLake; logs 28 days | Dataflow → Recent runs |
| Spark application detail | Jobs, executor resources, Livy/Driver/Prelaunch logs, data, snapshots | Per-application | Monitor hub → app, or Recent Runs |
| Spark monitoring APIs | Same data, programmatic | Same as UI | REST API |
| Eventstream Data insights / Runtime logs | Source/dest throughput; engine warn/error/info | Live/session | Eventstream editor |
| Eventhouse ingestion monitoring | Metrics, command logs, data ops, ingestion results, query logs | Workspace-monitoring retention | Workspace settings → Monitoring |
| Copy job monitoring | Status (Monitor hub) + per-mapping detail (workspace monitoring) | 30 days / workspace-monitoring | Monitor hub, or CopyJobActivityRunDetailsLogs |
| Capacity Metrics app | CU utilization, throttling, storage, autoscale | 14 days (Compute); 30 days (Storage) | Installed app (capacity admin only) |

> [!warning] Common Mistake — ==Monitor hub covers 17 item types but NOT Dataflow Gen1== — a frequent distractor. It's also not a durable log: 100-row/30-day cap on the main view. For longer retention or log-level detail, use item-specific history or workspace monitoring's KQL Eventhouse.

**Source:** [Monitoring & Surfaces — Quick Reference](../cheat-sheets/monitoring-surfaces-quick-ref.md#the-monitoring-surfaces-table-keep-whole)

---

**[← Back to Appendix](./appendix.md)**
