---
title: Choosing a Data Store
type: topic
tags:
  - dp-700
  - fabric
  - batch-ingestion
  - lakehouse
  - warehouse
  - eventhouse
  - sql-database
---

# Choosing a Data Store

## Overview

Every Fabric data store — lakehouse, warehouse, eventhouse, and SQL database — lands its data in OneLake in an open table format by default, so the choice between them is never about "where the data ends up." It's about **which engine, which language surface, and which consumer** the workload needs. This topic builds the decision matrix the exam expects for the "choose a data store" family of questions, the read-only nuance of the SQL analytics endpoint, and the scenarios where Fabric SQL database — the OLTP option — quietly becomes the right answer in an otherwise data-engineering-flavored question.

> [!abstract]
>
> - **Lakehouse** = Spark-first, big-data engineering; its SQL analytics endpoint is **read-only** T-SQL
> - **Warehouse** = SQL-first, full T-SQL DML (`INSERT`/`UPDATE`/`DELETE`/`MERGE`), enterprise BI and OLAP
> - **Eventhouse** = streaming/telemetry engine, KQL-native, ==sub-second to seconds ingestion latency==, T-SQL endpoint is read-only
> - **Fabric SQL database** = the OLTP engine of Fabric — full transactional T-SQL, auto-mirrors into OneLake near real time for analytics without a pipeline

> [!tip] What the Exam Tests
>
> - Matching a scenario's skillset, workload, and DML requirement to the correct data store
> - Recognizing that "read-only T-SQL" always means a SQL analytics endpoint (lakehouse, eventhouse, mirrored DB), while "full T-SQL DML" always means warehouse or Fabric SQL database
> - Spotting an OLTP-flavored scenario (high concurrency, foreign keys, an app backend) dressed up as a data engineering question — the answer is Fabric SQL database, not lakehouse or warehouse
> - Recognizing eventhouse as the answer whenever the scenario says "time-series," "telemetry," "KQL," or needs sub-second streaming ingestion

---

## The Decision Matrix

| Factor | Lakehouse | Warehouse | Eventhouse (KQL DB) | Fabric SQL Database |
| :--- | :--- | :--- | :--- | :--- |
| **Primary workload** | Big data engineering, un/semi/structured data, ML | Enterprise data warehousing, SQL-based BI, OLAP | Streaming/time-series events, telemetry, logs, free-text/semistructured search | Operational (OLTP) transactional applications |
| **Language surface** | Spark (PySpark, Scala, Spark SQL, R) for read/write; T-SQL via SQL analytics endpoint is **read-only** | ==Full T-SQL DML== — `INSERT`, `UPDATE`, `DELETE`, `MERGE`, multi-table transactions | KQL native for read/write; T-SQL via SQL endpoint is **read-only** | ==Full T-SQL DML==, same SQL Database Engine as Azure SQL Database |
| **Latency profile** | Batch/interactive, minutes-scale for typical Spark jobs | Interactive OLAP queries, batch loads | ==Near real-time ingestion== — changes can appear in seconds | Low-latency OLTP transactions (milliseconds), typical of an app backend |
| **Streaming ingestion fit** | Via Spark Structured Streaming (`readStream`/`writeStream`) | Not built for streaming ingestion — batch-oriented `COPY INTO`/pipeline loads | ==Purpose-built== — Eventstream, Kafka, SDKs land directly with update policies | Not a streaming ingestion target — OLTP writes are transactional, not stream-shaped |
| **Consumer types** | Data engineers, data scientists (notebooks); T-SQL consumers via read-only endpoint | Data warehouse developers, BI analysts, SQL Server-tooling users | App developers, data scientists, KQL analysts; Power BI DirectQuery over KQL | App developers, database developers/admins; SQL Server-tooling users |
| **Medallion role** | Classic bronze/silver/gold home — most engineering pipelines live here | Typically the curated gold layer, or an end-to-end SQL-only medallion for SQL-skilled teams | Specialized bronze/silver for high-volume streaming telemetry, often feeding a downstream gold via materialized views | Usually **outside** the medallion — an operational source feeding it, or a reverse-ETL sink (serving cleaned data back to apps) receiving curated gold data |

> [!note] Mental model — choosing a data store
> Think of OneLake as **one shared floor**, and each data store as a **room built for a different kind of work** happening on that floor. The lakehouse is the workshop — Spark tools, raw materials, engineers building things by hand. The warehouse is the boardroom — polished, SQL-only, built for people who need clean answers fast. The eventhouse is the security control room — screens full of live feeds, built to react to things *as they happen*. Fabric SQL database is the front desk — where the business actually transacts, with a camera (mirroring) quietly streaming a copy of everything to the shared floor for everyone else to analyze. All four rooms open onto the same floor; nothing needs to be carried between them.

**Practice Question 1** *(Easy)*

A team of data warehouse developers, skilled in T-SQL and coming from an on-premises SQL Server background, needs to build a star-schema BI solution where multiple analysts will write ad hoc `INSERT`, `UPDATE`, and `MERGE` statements against staging tables as part of the load process. Which Fabric data store fits best?

A. Lakehouse, because it stores data in open Delta format  
B. Warehouse, because it provides full T-SQL DML and matches the team's existing skillset  
C. Eventhouse, because it supports T-SQL queries  
D. Fabric SQL database, because it supports T-SQL  

> [!success]- Answer
> **B. Warehouse, because it provides full T-SQL DML and matches the team's existing skillset**
>
> The scenario names two decisive signals: a T-SQL-skilled team and a requirement to run `INSERT`/`UPDATE`/`MERGE` directly against the data store. A lakehouse's SQL analytics endpoint is read-only, so a team needing DML would have to switch to Spark — friction the warehouse avoids entirely. Eventhouse's T-SQL endpoint is also read-only. Fabric SQL database supports full DML too, but it's built for OLTP application workloads, not star-schema BI staging — the warehouse is purpose-built for exactly this scenario.

---

## The Domain 2 Decision Spine: Store → Transform → Streaming

The data store decision doesn't stand alone — it usually **determines** which transform tool and which streaming engine a workload ends up using, because each store exposes a different native language surface and a different (or absent) streaming role. Exam questions in Domain 2 frequently cross these three axes in a single scenario, expecting you to trace a store choice through to its transform tool ([07-Batch Transformation](../07-batch-transformation/01-choosing-transform-tool.md)) and its streaming fit ([08-Streaming Data](../08-streaming-data/01-choosing-streaming-engine.md)) rather than treating the three decisions as independent.

| Data lands in… | Native transform surface | Streaming role | DML / endpoint |
| :--- | :--- | :--- | :--- |
| Lakehouse | PySpark / Spark SQL (notebook) | Spark Structured Streaming sink | SQL analytics endpoint ==read-only== |
| Warehouse | T-SQL | not a streaming target | full T-SQL DML |
| Eventhouse | KQL (update policy / materialized view, native tables only) | Eventstream destination + KQL query engine | T-SQL endpoint ==read-only== |
| Fabric SQL DB | T-SQL (OLTP) | not a stream target; auto-mirrors to OneLake | full DML on primary surface |

> [!note] Mental model — pick the store, the rest follows
> Once you've named the data store, the transform tool and streaming engine are rarely a free choice — they're a consequence. Land data in a lakehouse and you're reaching for PySpark; land it in a warehouse and you're writing T-SQL; land it in an eventhouse and both transformation and streaming happen in KQL. Picking the store first, then reading its row across this table, resolves most "which tool should I use" questions that look like they need a second decision matrix.

---

## The SQL Analytics Endpoint Read-Only Nuance

Every lakehouse, warehouse, eventhouse, mirrored database, and SQL database in Fabric auto-provisions a **SQL analytics endpoint** — but what that endpoint lets you *do* depends on which item it belongs to.

| Item | SQL analytics endpoint behavior |
| :--- | :--- |
| **Lakehouse** | ==Read-only== — `SELECT` only. Runs on the same engine as Fabric Data Warehouse, but writes require switching to Spark |
| **Eventhouse / KQL database** | ==Read-only== — exposed only when OneLake availability and schema sync are enabled on the database; native writes happen via KQL ingestion, not T-SQL |
| **Mirrored database** | ==Read-only== — the endpoint reflects the continuously-replicated source; you don't write into a mirror through it |
| **Fabric SQL database** | The endpoint itself is still read-only, but the SQL database's own primary T-SQL surface (not the analytics endpoint) supports full DML — the two are different connection targets |
| **Warehouse** | Full read/write T-SQL DML through its primary endpoint — this is the one item where "the SQL surface" and "the analytics endpoint" support the same full DML |

Within a lakehouse's read-only boundary, you can still do a lot: run `SELECT` queries (including against shortcut tables), create views, functions, and stored procedures, apply row-/object-level security, and build Power BI reports over the TDS endpoint. To modify the underlying data, you switch to the lakehouse's Spark experience — the SQL analytics endpoint is a query surface, not a write path.

> [!warning] Common Mistake
> Assuming any Fabric item with a "SQL analytics endpoint" supports `INSERT`/`UPDATE`/`DELETE` because the label says "SQL." The endpoint name refers to the *query engine* (same engine as Warehouse), not to write permissions. Only a genuine **Warehouse** item — or the primary T-SQL surface of a **Fabric SQL database** — accepts DML. If a scenario says "run `UPDATE` against the SQL analytics endpoint of a lakehouse," that's a trap: it can't be done; the fix is either switching to Spark or choosing a warehouse instead.

---

## Eventhouse: When "Time-Series + KQL" Is the Signal

An **eventhouse** is a container for one or more KQL databases, purpose-built for time-based streaming data — telemetry, logs, IoT signals, security/compliance events, financial tick data. It ingests from Eventstream, Kafka, Logstash, SDKs, and dataflows, and is tuned to answer "what happened, and when" queries over billions of rows in seconds. Eventhouse data is exposed in OneLake in Delta format when **OneLake availability** is enabled at the database or table level, making it queryable from the read-only SQL analytics endpoint or from Spark alongside every other Fabric item.

> [!note] Mental model — eventhouse vs. warehouse
> A warehouse answers "what does the business look like as of last night's load." An eventhouse answers "what is happening right now, and what happened in the last five minutes." If a scenario's clock is measured in **seconds**, reach for eventhouse; if it's measured in **hours or a nightly batch**, reach for warehouse or lakehouse.

**Practice Question 2** *(Medium)*

An IoT platform ingests 50,000 sensor readings per second and needs sub-second query latency over the last 24 hours of readings, using time-series functions to detect anomalies. The team is comfortable with Kusto Query Language. Which data store should they use, and why would a lakehouse be the wrong choice?

A. Lakehouse — Spark Structured Streaming can handle any ingestion rate  
B. Eventhouse — purpose-built for high-volume streaming telemetry with near real-time query latency and native time-series/KQL functions; a lakehouse's batch-oriented Spark jobs and minutes-scale latency don't fit a sub-second query SLA  
C. Warehouse — because T-SQL is more standard than KQL  
D. Fabric SQL database — because OLTP databases handle high write throughput  

> [!success]- Answer
> **B. Eventhouse — purpose-built for high-volume streaming telemetry with near real-time query latency and native time-series/KQL functions; a lakehouse's batch-oriented Spark jobs and minutes-scale latency don't fit a sub-second query SLA**
>
> Every signal in the scenario — 50K events/second, sub-second query latency, 24-hour rolling window, KQL skillset, anomaly detection over time-series data — points to eventhouse. A lakehouse *can* ingest streaming data via Spark Structured Streaming, but its query latency profile and operational model target batch/interactive analytics, not sub-second dashboards over a firehose of telemetry. Warehouse and Fabric SQL database aren't designed for this ingestion volume or query pattern at all.

---

## Worked Scenario: Choosing Between Lakehouse and Warehouse

A retail data engineering team has:

- 40 TB of semi-structured clickstream data landing daily, requiring custom Python transformation logic
- A downstream BI team of 15 analysts who only write `SELECT` queries and are unfamiliar with Spark
- No requirement for anyone to run `INSERT`/`UPDATE`/`DELETE` against the curated layer

**Resolution:** Lakehouse. The ingestion and transformation workload (semi-structured data, custom Python logic) is squarely a Spark/data-engineering job. The BI team's needs are fully met by the lakehouse's read-only SQL analytics endpoint — they never need DML, so the warehouse's main advantage (full T-SQL DML) is irrelevant here. Choosing a warehouse instead would force the engineering team to express Python-shaped transformation logic in T-SQL, a worse fit for the actual workload.

## Worked Scenario: Fabric SQL Database Sneaking Into a DE Scenario

An application team is building a new order-management system that needs:

- High-concurrency transactional writes with strongly enforced foreign-key constraints
- Automatic performance tuning without a dedicated DBA
- The data engineering team to build Power BI dashboards over the *same* data in near real time, without building an ETL pipeline

**Resolution:** Fabric SQL database. This scenario reads like an application/OLTP requirement (concurrency, ACID transactions, foreign keys, automatic index tuning) — easy to mistake for "not a DP-700 topic" — but the requirement that DE consume the same data for BI *without a pipeline* is exactly what Fabric SQL database's automatic near-real-time mirroring into OneLake solves. A lakehouse or warehouse would require building an ingestion pipeline from the application database; Fabric SQL database eliminates that pipeline by mirroring itself.

> [!warning] Common Mistake
> Dismissing Fabric SQL database as "not a real Fabric data store" because it's an OLTP engine, not an analytics engine. The exam blueprint explicitly includes it in the data-store decision family — its distinguishing trait for DP-700 purposes is that it **auto-mirrors into OneLake**, making it a legitimate zero-ETL source for the rest of the medallion architecture, even though the engineering team never queries it directly for analytics.

**Practice Question 3** *(Hard)*

An IoT platform ingests 1,000,000 sensor readings per minute. The analytics team is SQL-only — no Spark, no KQL — and needs dashboards refreshed within about 5 seconds of an event arriving, using as little custom code as possible. Which Fabric data store fits, and how do the SQL-only analysts query it?

A. Warehouse — the SQL-only team can query and load data with full T-SQL DML support  
B. Eventhouse — the team queries it via the T-SQL analytics endpoint for near-real-time dashboards  
C. Lakehouse — Spark Structured Streaming lands events, and analysts run T-SQL against the endpoint  
D. Fabric SQL database — its OLTP engine ingests high-throughput writes with full T-SQL DML  

> [!success]- Answer
> **B. Eventhouse — the team queries it via the T-SQL analytics endpoint for near-real-time dashboards**
>
> At roughly 16,700 events/second with a ~5-second freshness target, eventhouse is the only store built for this ingestion-and-query profile — KQL-native ingestion delivers sub-second to seconds latency, matching the SLA with minimal engineering. The twist: the analysts are SQL-only, not KQL-fluent, but that doesn't rule out eventhouse — every eventhouse auto-provisions a SQL analytics endpoint, so the team queries it with familiar T-SQL, with the caveat that the endpoint is **read-only**. Warehouse (A) is SQL-native but isn't built for continuous high-volume streaming ingestion at this rate. Lakehouse with Spark Structured Streaming (C) could land the data, but its batch-oriented query path doesn't reliably hit a 5-second dashboard SLA, and it adds Spark code the "minimal code" requirement rules out. Fabric SQL database (D) is an OLTP engine not designed to ingest a continuous million-events-per-minute stream — its distinguishing trait is mirroring, not real-time streaming ingestion.

---

## Distractor Patterns to Recognize

| Scenario phrase | Trap | Correct read |
| :--- | :--- | :--- |
| "Team needs to run full T-SQL DML against curated data" | Picking lakehouse because "it's in OneLake" | Warehouse (or Fabric SQL database's primary surface) — lakehouse's SQL endpoint is read-only |
| "Time-series telemetry, KQL, sub-second queries" | Picking warehouse because "T-SQL is more familiar" | Eventhouse — purpose-built for this workload and latency |
| "High-concurrency OLTP app with foreign keys, needs analytics without ETL" | Dismissing as out-of-scope, or picking warehouse | Fabric SQL database — OLTP engine that auto-mirrors to OneLake |
| "Data scientists doing ML with unstructured data and Python" | Picking warehouse because of "enterprise" framing | Lakehouse — Spark/Python-first, un/semi-structured data |
| "Everything ends up in OneLake anyway, so store choice doesn't matter" | Treating stores as interchangeable | They share storage format, not language surface, latency, or write model — the decision still matters |

## Use Cases

- A BI team consuming a curated gold layer purely with `SELECT` queries and Power BI — lakehouse's read-only endpoint is sufficient and avoids warehouse licensing/skillset overhead
- A finance team needing multi-table `MERGE` transactions across a staging and target table as part of a nightly load — warehouse's full T-SQL DML
- A security operations team analyzing log and telemetry streams with sub-second freshness requirements — eventhouse
- An application team building a translytical (transactional + analytical combined) app that needs both OLTP writes and near-real-time analytics on the same data without a pipeline — Fabric SQL database

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `UPDATE`/`DELETE` statement fails against a lakehouse table via the SQL analytics endpoint | The endpoint is read-only by design | Perform the write in Spark, or move the workload to a warehouse if T-SQL DML is a hard requirement |
| External Delta tables written by Spark code don't appear in the SQL analytics endpoint | Tables created outside the lakehouse's `/Tables` folder aren't autodiscovered | Create a shortcut in the `Tables` section pointing at the external Delta location, or write tables directly under `/Tables` |
| A KQL database's data isn't queryable from T-SQL | OneLake availability / schema sync wasn't enabled on the database or table | Enable OneLake availability at the database or table level in the eventhouse settings |
| Team picks warehouse for a Python-heavy ML workload and hits a wall | Warehouse has no Spark/Python execution surface | Re-evaluate — lakehouse is the correct store for Spark-based data engineering and ML workloads |

## Best Practices

- Match the store to the **language surface and DML requirement** first, then confirm workload/latency fit — this ordering catches the most common exam traps
- Default to lakehouse for Spark-first data engineering with occasional SQL consumption; default to warehouse when the whole team, including the load process, is SQL-only
- Reach for eventhouse the moment a scenario's freshness requirement is measured in seconds rather than minutes/hours
- Don't rule out Fabric SQL database in a DE scenario just because it's described as an "application" or "operational" database — its automatic OneLake mirroring makes it a legitimate zero-ETL source

## Exam Tips

> [!tip] Exam Tips
>
> - "Read-only T-SQL" = lakehouse, eventhouse, or mirrored database SQL analytics endpoint; "full T-SQL DML" = warehouse or Fabric SQL database's primary surface
> - Eventhouse is the answer whenever the scenario mentions KQL, telemetry, time-series, or sub-second/near-real-time streaming query latency
> - Fabric SQL database is the answer whenever a scenario needs OLTP characteristics (foreign keys, high concurrency, ACID transactions) *and* zero-pipeline analytics on the same data
> - All four stores land data in OneLake in open table format — that fact never disqualifies a choice, so don't use "it's all in OneLake anyway" as a deciding factor

## Key Takeaways

- The data store decision hinges on language surface (read-only vs. full DML), workload type, latency profile, and primary consumer — not just "where the data lands"
- Lakehouse and eventhouse both expose a **read-only** SQL analytics endpoint; only warehouse and Fabric SQL database's primary surface support full T-SQL DML
- Eventhouse is purpose-built for streaming, time-series, KQL-native workloads with near-real-time query latency
- Fabric SQL database is the OLTP engine of Fabric, distinguished for DP-700 purposes by its automatic, pipeline-free near-real-time mirroring into OneLake

## Related Topics

- [02-OneLake Shortcuts](./02-onelake-shortcuts.md)
- [03-Mirroring](./03-mirroring.md)
- [07-Batch Transformation: Choosing a Transform Tool](../07-batch-transformation/01-choosing-transform-tool.md)
- [08-Streaming Data: Choosing a Streaming Engine](../08-streaming-data/01-choosing-streaming-engine.md)

## Official Documentation

- [Fabric decision guide — choose a data store](https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-data-store)
- [What is the SQL analytics endpoint for a lakehouse?](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)
- [Eventhouse overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [SQL database in Microsoft Fabric — overview](https://learn.microsoft.com/en-us/fabric/database/sql/overview)
- [Fabric Data Warehouse — data warehousing](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../05-loading-patterns/03-streaming-loading-pattern.md) | [↑ Back to Section](./batch-ingestion.md) | [Next →](./02-onelake-shortcuts.md)**
