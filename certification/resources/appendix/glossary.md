---
title: DP-700 Glossary
type: resources
tags:
  - dp-700
  - glossary
  - reference
---

# DP-700 Glossary

A reference of key Microsoft Fabric terms and concepts for the DP-700: Implementing Data Engineering Solutions Using Microsoft Fabric exam, drawn from the guide's own topic files and cheat sheets.

> [!abstract] TL;DR
>
> - 65 terms spanning all three exam domains — workspace/lifecycle/security/orchestration, loading/ingestion/transformation/streaming, and monitoring/errors/optimization
> - Use as a lookup during study when a topic file references a term without re-explaining it
> - Terms marked bold are the ones most frequently tested on the exam

---

## A

| Term | Definition |
| :--- | :--- |
| **Activator** | Fabric's event-driven alerting item — evaluates events grouped into objects against stateless or stateful rule conditions, and fires actions (email, Teams, Power Automate, run item) when a condition is met. |
| **Adaptive Query Execution (AQE)** | Spark runtime optimization on by default in every Fabric runtime — coalesces post-shuffle partitions, converts sort-merge joins to broadcast joins, and splits skewed joins mid-query. |
| **Apache Airflow job** | Code-first Fabric orchestration item for Python DAGs, separate from pipelines and Dataflow Gen2; the subject of the July 21, 2026 blueprint's Domain 1 workspace-settings wording change. |
| **Autotune** | An off-by-default Spark feature that tunes `shuffle.partitions`, `autoBroadcastJoinThreshold`, and `files.maxPartitionBytes` for a *repeated* query shape over roughly 20–25 iterations. |
| **AADSTS65002** | The Microsoft Entra ID error raised when a Fabric Eventstream isn't preauthorized to an Azure Event Hub at the tenant level — requires tenant-admin action, not end-user reconfiguration. |

---

## B

| Term | Definition |
| :--- | :--- |
| **Bin compaction** | The file-consolidation phase of Delta `OPTIMIZE` — run before Z-Order and V-Order when combined — that merges small files toward the adaptive target size. |
| **Bursting** | Fabric capacity's ability to temporarily exceed purchased Spark VCores (up to 3×) when the capacity is otherwise idle. |

---

## C

| Term | Definition |
| :--- | :--- |
| **Capacity Unit (CU)** | Fabric's compute-billing unit — 1 CU = 2 Spark VCores before any burst multiplier — and the basis for Capacity Metrics app throttling and CU-consumption reporting. |
| **CDC (Change Data Capture)** | An incremental-sync mechanism, including deletes, used by Copy job's CDC mode — distinct from a one-time Copy activity batch load. |
| **Copy job** | A preview pipeline item for scheduled/triggered incremental sync with CDC support, distinguished from the always-batch Copy activity. |

---

## D

| Term | Definition |
| :--- | :--- |
| **DAG (Directed Acyclic Graph)** | The Python-authored workflow unit in an Apache Airflow job, stored as a `.py` file under the job's `dags` folder. |
| **Data Integration Unit (DIU)** | The compute-power measure (CPU/memory/network) for a pipeline Copy activity, ranging 4–256 and defaulting to **Auto**. |
| **Deletion Vector** | A lightweight row-level tombstone that lets Delta Lake mark rows deleted or updated without rewriting the whole Parquet file; on by default from Spark Runtime 2.0 (Delta 4.1). |
| **Delta Lake** | The open table format underlying every Fabric Lakehouse table — ACID transactions over versioned Parquet files, and the target of `OPTIMIZE`/`VACUUM` maintenance. |
| **Deployment Pipeline** | Fabric's stage-promotion mechanism (2–10 stages, Dev/Test/Prod by default) that copies metadata/schema between workspaces — never data, permissions, or workspace settings. |
| **Direct Lake** | A Power BI semantic-model storage mode that reads Delta Parquet files directly from OneLake without an Import-refresh copy, using **framing** to control which data version is visible. |
| **DirectQuery fallback** | The behavior where a Direct Lake **on SQL** semantic model reverts to DirectQuery when a guardrail is breached — Direct Lake **on OneLake** has no such fallback and fails outright instead. |
| **Domain (Fabric)** | A governance/discovery grouping of workspaces, managed by domain admins; affects discoverability only, never access. |
| **Dynamic Data Masking (DDM)** | A Warehouse/SQL-endpoint feature that obscures column values in query results without blocking access or encrypting the underlying data — not a substitute for RLS/CLS/OLS. |

---

## E

| Term | Definition |
| :--- | :--- |
| **Endorsement** | Fabric's item-trust signal with three tiers — Promoted (any write-permission holder), Certified, and Master data (the latter two require tenant-admin authorization). |
| **Eventhouse** | Fabric's KQL-native real-time analytics store, purpose-built for streaming/time-series data with sub-second query latency. |
| **Eventstream** | A no-code ingest/transform/route hub with 7 built-in operators that fans events out to one or more destinations — not itself a query engine. |
| **Exactly-once** | A delivery guarantee no Fabric streaming surface provides end-to-end on its own — Eventstream is at-least-once everywhere; "exactly-once" only ever describes a downstream idempotent sink (Delta checkpoint-to-sink, KQL dedup). |
| **Extent** | Kusto/Eventhouse's underlying storage unit; the engine's default time-based extent organization enables fast time-range pruning without a custom partitioning policy. |

---

## F

| Term | Definition |
| :--- | :--- |
| **Framing** | The metadata-only refresh operation for a Direct Lake semantic model — updates which Parquet file versions are visible in seconds, versus a full Import-refresh data copy. |

---

## G

| Term | Definition |
| :--- | :--- |
| **Governance** | The umbrella term for Fabric's sensitivity labels, endorsement, and audit-log capabilities that control data classification, trust, and accountability — distinct from raw access control. |

---

## H

| Term | Definition |
| :--- | :--- |
| **High concurrency** | A Spark session-sharing mode (default 5 notebooks/session, tunable to 50) that cuts session-start latency by up to 36× versus one session per notebook. |
| **Hot window (Hot property)** | The Eventhouse query-acceleration setting controlling how many days of shortcut data stay cached at native-table speed. |

---

## I

| Term | Definition |
| :--- | :--- |
| **Idempotency** | A load-design property where re-running the same job twice produces the same end state — the property most watermark/incremental-load exam traps test for. |
| **Item permission** | A Fabric access grant (Read/ReadAll/Write/Reshare/Execute/...) layered independently on top of workspace role — removing one without the other leaves access intact. |

---

## K

| Term | Definition |
| :--- | :--- |
| **KQL (Kusto Query Language)** | The native query language of Eventhouse/Azure Data Explorer, used for real-time analytics, update policies, and materialized views. |

---

## L

| Term | Definition |
| :--- | :--- |
| **Lakehouse** | A Fabric data store combining file-based (Delta Lake) storage with a read-only SQL analytics endpoint — the default Spark read/write target. |

---

## M

| Term | Definition |
| :--- | :--- |
| **Materialized View** | An Eventhouse object that continuously maintains an aggregated or deduplicated result over a source table, billed as ongoing background CU rather than per-ingested-batch. |
| **Medallion architecture** | The bronze (raw) → silver (cleansed/deduplicated) → gold (aggregated) layering pattern applied to both batch and streaming loads in Fabric. |
| **MERGE** | The T-SQL/Delta statement performing insert-or-update (upsert) in one pass; in Spark Structured Streaming it must run inside `foreachBatch`, since it isn't a native streaming sink write. |
| **Mirroring** | Continuous, governed replication of an entire operational database (or catalog metadata) into OneLake with near-zero ETL — contrasted with shortcuts (no data movement) and pipeline copy (transformable). |

---

## N

| Term | Definition |
| :--- | :--- |
| **Native Execution Engine (NEE)** | A preview, vectorized C++ Spark execution path that accelerates compute-heavy Parquet/Delta joins/aggregations with automatic, silent JVM fallback — never active during Structured Streaming. |

---

## O

| Term | Definition |
| :--- | :--- |
| **OneLake** | Fabric's single, tenant-wide data lake underlying every workspace and item — the common storage layer shortcuts, mirroring, and Direct Lake all read from. |
| **OneLake security** | A deny-by-default, item-level row/column security layer enforced consistently for Spark and user-identity-mode SQL, but bypassed entirely by delegated-mode SQL. |
| **OLS (Object-Level Security)** | A Warehouse/SQL-endpoint `GRANT`/`REVOKE`/`DENY` control that blocks access to whole tables or schemas. |
| **OPTIMIZE** | The Delta Lake maintenance command that bin-compacts small files and can additionally apply Z-Order and/or V-Order in one combined operation. |

---

## P

| Term | Definition |
| :--- | :--- |
| **Passthrough (shortcut)** | The default OneLake-to-OneLake shortcut authentication mode, where the calling user's own identity is evaluated at the target. |
| **Power Query** | The low-code mashup engine behind Dataflow Gen2, whose failures surface as `DataFormat.Error`, `DataSource.Error`, or `Expression.Error`. |

---

## Q

| Term | Definition |
| :--- | :--- |
| **Query acceleration** | An Eventhouse feature that caches and indexes shortcut data to near-native query speed — it never unlocks materialized views or update policies on that shortcut. |
| **Query folding** | Power Query's pushdown of transformation steps to the source system; losing it degrades a Dataflow Gen2 refresh's performance without producing an error. |
| **Queued ingestion** | Eventhouse's default, blob-staged ingestion path — higher throughput than streaming ingestion, at seconds-to-minutes latency instead of sub-second. |

---

## R

| Term | Definition |
| :--- | :--- |
| **Rerun from failed activity** | A pipeline recovery action that re-executes only the failed activity and everything downstream of it, skipping already-succeeded work. |
| **Row-Level Security (RLS)** | A filter-predicate mechanism that silently restricts which rows a principal sees; enforced identically for every principal in Fabric Warehouse T-SQL (no `CONTROL` bypass), unlike DDM or OneLake security. |

---

## S

| Term | Definition |
| :--- | :--- |
| **SCD (Slowly Changing Dimension)** | A dimensional-modeling pattern for tracking attribute change — Type 1 overwrites in place (no history), Type 2 preserves history via new versioned rows. |
| **Sensitivity label** | A Microsoft Purview classification that flows Fabric → Fabric and Fabric → Power BI, but never Power BI → Fabric. |
| **Shortcut** | A OneLake virtual pointer to data in another location (internal or external) with no data movement — always reflects the source's current state. |
| **Snapshot isolation** | The only isolation level Fabric Warehouse supports — readers never block writers and vice versa, but concurrent writers to the same table can still conflict at commit time (errors 24556/24706). |
| **Spark Job Definition (SJD)** | The production-oriented, code-first Spark artifact recommended over interactive notebooks for scheduled/unattended streaming and batch jobs. |
| **Staging (Dataflow Gen2)** | The Fabric-managed intermediate Lakehouse/Warehouse a dataflow's compute engine writes to before a destination; workspace-managed staging times out after 60 minutes. |
| **Surrogate key** | A synthetic, warehouse-generated dimension key (via `ROW_NUMBER()`, a hash, or the Preview `IDENTITY` column) that every fact row must reference, generated before the fact load runs. |

---

## T

| Term | Definition |
| :--- | :--- |
| **T-SQL** | The full-DML query language for Fabric Warehouse and Fabric SQL database; the Lakehouse/Eventhouse/mirrored-DB SQL analytics endpoint only ever exposes a read-only subset. |
| **Transitive shortcut** | A shortcut whose target is itself another shortcut; Fabric caps direct shortcut-to-shortcut chaining at 5 hops. |

---

## U

| Term | Definition |
| :--- | :--- |
| **Update policy** | An Eventhouse mechanism that automatically runs a query against newly ingested data and writes the result to a derived table — transactional mode rolls back the source ingestion on failure, non-transactional mode does not. |

---

## V

| Term | Definition |
| :--- | :--- |
| **VACUUM** | The Delta Lake command that permanently removes files no longer referenced by the table's history, subject to a default 7-day retention window. |
| **V-Order** | A Fabric-specific Parquet write optimization (~15% slower writes) that improves compression and delivers up to 40–60% faster cold-cache Direct Lake reads; off by default in new workspaces. |

---

## W

| Term | Definition |
| :--- | :--- |
| **Warehouse** | Fabric's full-DML, T-SQL-native data store for enterprise DW/BI workloads, distinguished from Lakehouse by its read-write SQL surface. |
| **Watermark** | A tracked high-water mark (a column value or timestamp) used to identify only new/changed rows for an incremental load, or to bound streaming state for windowed aggregation and deduplication. |
| **Window function** | A T-SQL/PySpark/KQL construct that computes a value across a set of related rows without collapsing them — foundational to both dimensional ranking and streaming tumbling/hopping/sliding aggregation. |
| **Workspace role** | One of four additive Fabric roles (Admin ⊃ Member ⊃ Contributor ⊃ Viewer) governing workspace-wide capabilities, independent of item-level permissions. |

---

## Z

| Term | Definition |
| :--- | :--- |
| **Z-Order** | A Delta `OPTIMIZE` co-location technique for higher-cardinality or multi-column selective filters, applied after bin compaction and before V-Order in a combined optimize. |

---

**[← Back to Appendix](./appendix.md)**
