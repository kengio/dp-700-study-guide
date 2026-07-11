---
title: Mirroring
type: topic
tags:
  - dp-700
  - fabric
  - batch-ingestion
  - mirroring
  - onelake
  - cdc
---

# Mirroring

## Overview

**Mirroring** is Fabric's zero-ETL answer to "I need this operational database continuously available for analytics in OneLake." This topic covers the three mirroring flavors — database mirroring, metadata mirroring, and open mirroring — the current list of supported sources and their status, how near-real-time replication actually works under the hood, the free storage allowance and its limits, and how mirroring fits against shortcuts and pipeline copy in the batch-ingestion decision tree.

> [!abstract]
>
> - **Database mirroring** replicates entire databases/tables continuously into OneLake as Delta tables — sources include Azure SQL Database, Azure SQL Managed Instance, Azure Cosmos DB, Azure Database for PostgreSQL, Azure Database for MySQL (preview), Snowflake, SQL Server, Oracle, SAP, Google BigQuery (preview), and Fabric SQL database (automatic)
> - **Metadata mirroring** (Azure Databricks Unity Catalog, Dremio-preview) syncs only catalog structure and relies on **shortcuts** to reference the source data in place — no data movement at all
> - **Open mirroring** lets any application or provider write change data into a landing zone via a public API/portal-issued URL, following the open mirroring spec
> - Mirroring storage is free up to ==1 TB of OneLake storage per purchased capacity unit (CU)==; background replication compute is always free and never consumes capacity

> [!tip] What the Exam Tests
>
> - Naming the correct mirroring flavor and current source list for a given scenario
> - Distinguishing mirroring (continuous replication) from a shortcut (a live pointer) from a pipeline copy (a scheduled batch move)
> - Understanding the free-storage-tier math and when mirroring starts costing standard OneLake storage rates
> - Recognizing that database mirroring's replication mechanism (log-based, ~15-second cadence) is what makes it "near-real-time," not truly instantaneous

---

## Types of Mirroring

Fabric offers three distinct approaches, all landing in OneLake but working very differently under the hood.

| Mirroring type | What it does | Mechanism |
| :--- | :--- | :--- |
| **Database mirroring** | Replicates entire databases and tables from an external or Fabric-native source into OneLake Delta tables | A replicator engine continuously scans for and merges newly published change files from the source |
| **Metadata mirroring** | Synchronizes only metadata (catalog names, schemas, tables) — the data itself stays at the source | Uses **OneLake shortcuts** under the hood to reference source data in place; supports cross-tenant sharing |
| **Open mirroring** | Lets any application write its own change data directly into a mirrored database item | Application/provider writes to a landing zone URL per the open mirroring spec; Fabric merges inserts/updates/deletes into Delta tables |

> [!note] Mental model — three flavors of "always in sync"
> **Database mirroring** is a security guard that walks a live copy of every document out of a building the moment it's filed — the copy is a real, physical duplicate, just made instantly. **Metadata mirroring** is a museum's shared catalog card system — the card tells you exactly where the artifact lives and what it is, but the artifact itself never leaves its home museum; you're handed a shortcut to go look at it there. **Open mirroring** is a mailbox with a specification sheet taped to it — any application, from any vendor, can drop change data in the right format, and Fabric takes it from there.

---

## Current Source List (verify against Microsoft Learn — this list moves quarterly)

| Source | Mirroring type | Status |
| :--- | :--- | :--- |
| Azure SQL Database | Database mirroring | GA |
| Azure SQL Managed Instance | Database mirroring | GA |
| Azure Cosmos DB | Database mirroring | GA |
| Azure Database for PostgreSQL | Database mirroring | GA |
| Azure Database for MySQL | Database mirroring | ==Preview== |
| SQL Server (2025+) | Database mirroring | GA |
| Snowflake | Database mirroring | GA |
| Oracle | Database mirroring | GA |
| SAP | Database mirroring | GA |
| Google BigQuery | Database mirroring | ==Preview== |
| Fabric SQL database | Database mirroring | GA, ==automatically configured== — no setup needed |
| Azure Databricks (Unity Catalog) | Metadata mirroring | GA |
| Dremio | Metadata mirroring | ==Preview== |
| Open mirrored databases (any provider) | Open mirroring | GA |

> [!warning] Common Mistake
> Memorizing a mirroring source list once and assuming it's static. This list has changed multiple times across the DP-700 blueprint's lifetime (new sources like Oracle, SAP, and Google BigQuery have been added over time), so treat any list — including this one — as something to spot-check against the [official mirroring overview](https://learn.microsoft.com/en-us/fabric/mirroring/overview) close to exam day, especially for GA-vs-preview labels.

**Practice Question 1** *(Easy)*

A team needs to analyze data from a Snowflake data warehouse alongside their existing Fabric lakehouse data, without building or maintaining an ETL pipeline, and with changes reflected in OneLake within roughly 15 seconds to a few minutes of the source changing. What should they use?

A. An external shortcut pointing at Snowflake  
B. Database mirroring for Snowflake  
C. A Copy job with full copy mode scheduled hourly  
D. Metadata mirroring, since Snowflake is a catalog-based system  

> [!success]- Answer
> **B. Database mirroring for Snowflake**
>
> The requirement — near-real-time, pipeline-free replication into OneLake — is exactly what database mirroring provides, and Snowflake is a supported database mirroring source. Snowflake isn't a shortcut target (shortcuts don't apply to Snowflake as a database engine the way they do to blob-style storage), a scheduled Copy job would only be as fresh as its schedule, and metadata mirroring only applies to Azure Databricks Unity Catalog and Dremio (catalog-shortcut-based systems), not Snowflake.

---

## How Database Mirroring Works

Change data arrives incrementally from the source as Delta files. The exact change-detection mechanism varies by source — for example, SQL Server 2025 scans the source database's transaction log at high frequency and publishes per-table change files to a Fabric landing zone. Inside Fabric, a **replicator engine** runs continuously, scanning for newly published files and merging incoming changes into the target Delta table. Changes can be published as fast as ==every 15 seconds==, with backoff logic that reduces overhead on the source during low-activity periods.

Near real-time replication latency depends on several factors:

- Source and destination region/location
- Volume and frequency of changes
- Network bandwidth and latency from the source
- Compute resources allocated to the on-premises data gateway (for gateway-routed sources)

## How Metadata Mirroring Works

Metadata mirroring synchronizes only **catalog structure** — names, schemas, tables — and relies on OneLake shortcuts to reference the actual source data in place. Because it's shortcut-based, it also supports **cross-tenant data sharing**: organizations can consume live, governed data from another tenant through shortcuts without copying data or building ETL pipelines. When a Fabric workspace mirrors an Azure Databricks Unity Catalog, only the catalog structure is mirrored — the underlying data stays in Databricks-managed storage and is accessed through shortcuts, so changes at the source are reflected instantly without any data movement.

## How Open Mirroring Works

Creating an open mirrored database (via the public API or the Fabric portal) provisions a **landing zone URL** in OneLake. Any application — a custom script, a third-party provider's connector — writes change data into that landing zone following the open mirroring specification. Fabric's replication process then merges the inserts, updates, and deletes into Delta tables, reflecting changes as soon as they're written to the landing zone in the correct format.

> [!note] Mental model — mirroring source-type recognition
> If the scenario describes a **known relational/NoSQL platform** (Azure SQL, Snowflake, PostgreSQL, Oracle, SAP, Cosmos DB) → **database mirroring**. If it mentions a **catalog** (Unity Catalog, Dremio) → **metadata mirroring**, and the underlying mechanism is shortcuts, not replication. If it says a **custom app or unsupported source wants to write change data itself** → **open mirroring**.

---

## Cost of Mirroring

| Aspect | Detail |
| :--- | :--- |
| **Storage** | Free up to a capacity-based limit — ==1 TB of OneLake storage per purchased capacity unit (CU)==. An F64 capacity gets 64 free TB exclusively for mirroring storage |
| **Beyond the free limit** | Standard OneLake storage rates apply, or when the capacity is paused |
| **Background replication compute** | Always free — doesn't consume capacity |
| **Query compute** | Requests directly to OneLake for mirrored data, and querying via SQL/Power BI/Spark, consume capacity at regular rates |
| **Capacity requirement** | A **running** Fabric capacity is required for mirroring to function at all — a paused or deleted capacity halts replication (though background compute itself doesn't draw from capacity units) |

**Practice Question 2** *(Medium)*

A team purchases an F32 Fabric capacity and enables database mirroring for an Azure SQL Database that's expected to grow to 50 TB of mirrored data in OneLake over the next year. What's the most accurate statement about storage cost?

A. All 50 TB is free indefinitely because mirroring storage is always free  
B. The first 32 TB (1 TB per CU × F32) is free; storage beyond that is billed at standard OneLake rates, or if the capacity is paused  
C. Mirroring storage is never free — only compute is free  
D. Free storage only applies to Fabric SQL database mirrors, not Azure SQL Database  

> [!success]- Answer
> **B. The first 32 TB (1 TB per CU × F32) is free; storage beyond that is billed at standard OneLake rates, or if the capacity is paused**
>
> The free mirroring storage allowance scales with capacity size at a rate of 1 TB of OneLake storage per purchased CU — an F32 capacity includes 32 CUs, so 32 TB is free. Growth beyond that free allowance, or storage retained while the capacity is paused, is billed at standard OneLake storage rates. The free tier applies broadly to database mirroring and open mirroring, not exclusively to Fabric SQL database.

---

## Retention

Mirroring automatically runs a vacuum process to remove old Delta files no longer referenced by the transaction log, keeping storage efficient. Retention is configurable: mirrored databases created via the Fabric portal after mid-June 2025 default to **1 day** of retention; older mirrors default to **7 days**. You can adjust retention in the mirrored database's **Settings → Delta table management** tab, or via the `retentionInDays` property on the public REST API — extending it enables longer Delta time-travel windows at the cost of more storage.

---

## Mirrored Database → Shortcut Consumption Patterns

Every mirrored database provisions a SQL analytics endpoint, and because its data lands as Delta tables in OneLake, it's fully shortcut-able like any other internal Fabric item. Common consumption patterns:

- A gold-layer lakehouse creates an **internal shortcut** into a mirrored database's tables, joining mirrored operational data with engineered fact/dimension tables without a copy step
- Cross-database T-SQL queries reference the mirrored database directly by its three-part name (`MirroredDB.dbo.TableName`) alongside warehouses and lakehouse SQL analytics endpoints in the same query
- Power BI semantic models connect via **Direct Lake** mode directly to a mirrored database's Delta tables for near-real-time reporting with no import/refresh cycle

```sql
-- Cross-database query joining a mirrored database with a warehouse
SELECT *
FROM ContosoWarehouse.dbo.ContosoSalesTable AS Contoso
INNER JOIN MirroredCrmDb.dbo.Affiliation AS Affiliation
    ON Affiliation.AffiliationId = Contoso.RecordTypeID;
```

> [!warning] Common Mistake
> Assuming a mirrored database's SQL analytics endpoint supports DML because "the source database it's mirroring supports writes." The mirror is a **read-only replica** in Fabric — writes must go to the original source system, and they'll appear in the mirror on the next replication cycle. This mirrors (no pun intended) the same read-only nuance covered for lakehouses and eventhouses.

---

## Mirroring vs. Shortcuts vs. Pipeline Copy

| Factor | Mirroring | Shortcuts | Pipeline Copy (activity/job) |
| :--- | :--- | :--- | :--- |
| **Data movement** | Continuous replication — data *is* copied, automatically and near-real-time | None — a live pointer to data that stays at its source | One-time or scheduled batch movement, on-demand |
| **Setup effort** | Low — configure a connection, choose tables, done | Low — point-and-click target selection | Higher — design source/sink, mapping, schedule, error handling |
| **Freshness** | Near-real-time (as fast as ~15 seconds for database mirroring) | Always current — it's the live source, not a copy | As fresh as the last scheduled/triggered run |
| **Best fit** | An entire operational database needs to be continuously available for analytics | Data is already in a queryable format and doesn't need continuous sync guarantees beyond live access | Data needs transformation, format conversion, or movement between systems that mirroring/shortcuts don't reach |
| **Data ownership/duplication** | Creates a governed duplicate in OneLake (subject to free-tier storage) | No duplication at all | Creates a duplicate, fully owned and often reshaped by the target |

> [!note] Mental model — the decision funnel
> Ask, in order: *(1) Is this an entire supported operational database that needs continuous sync?* → mirroring. *(2) Is the data already sitting somewhere query-compatible, with no transformation needed?* → shortcut. *(3) Does it need transformation, reshaping, or a source/target combination mirroring and shortcuts don't cover?* → pipeline copy (Copy activity or Copy job).

## Use Cases

- Continuously replicating a production Azure SQL Database into OneLake so BI teams can query it via Direct Lake without touching the operational system
- Making an Azure Databricks Unity Catalog's tables visible in Fabric without copying petabytes of Databricks-managed data — metadata mirroring's shortcut-based approach
- A third-party SaaS vendor building an open mirroring integration so their customers' Fabric workspaces stay continuously in sync with the vendor's data, without the vendor needing Fabric-specific pipeline expertise
- Joining mirrored Snowflake data with native Fabric warehouse tables in a single cross-database T-SQL query for a unified reporting layer

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Mirrored data stops updating | Fabric capacity was paused or deleted | Resume or recreate the capacity — mirroring requires a running capacity to replicate |
| Unexpected OneLake storage charges appear for a mirrored database | Mirrored data exceeded the free 1 TB-per-CU allowance | Review capacity size vs. mirrored data volume; scale capacity or reduce retention to lower storage footprint |
| `UPDATE`/`INSERT` fails against a mirrored database's SQL analytics endpoint | Mirrors are read-only in Fabric | Write to the original source system; changes propagate to the mirror on the next cycle |
| Databricks Unity Catalog mirror shows stale row counts | Confusing metadata mirroring with database mirroring — metadata mirroring doesn't move data, so "staleness" is really shortcut/source access latency, not a replication lag | Check source access performance and shortcut resolution rather than looking for a replication delay that doesn't apply here |
| Team can't find a mirroring option for an unsupported source system | Source isn't on the current database mirroring list | Use open mirroring if the source can write to a landing zone per spec, or fall back to pipeline-based Copy activity/Copy job |

## Best Practices

- Default to mirroring for any fully-supported operational source that needs continuous, pipeline-free analytics availability
- Monitor mirrored storage against the free-tier allowance (1 TB per CU) before it silently starts consuming standard OneLake billing
- Use metadata mirroring, not database mirroring, for catalog-based sources like Unity Catalog — it avoids unnecessary data duplication entirely
- Adjust Delta retention on a mirrored database deliberately — shorter retention saves storage, longer retention preserves more time-travel history

## Exam Tips

> [!tip] Exam Tips
>
> - Three flavors: database mirroring (full replication), metadata mirroring (shortcuts, Unity Catalog/Dremio only), open mirroring (any app writes to a landing zone)
> - Free storage = 1 TB of OneLake storage per purchased capacity unit; compute for replication is always free, query compute is billed normally
> - Database mirroring changes can publish as fast as every 15 seconds — "near-real-time," not instantaneous
> - Mirrors are read-only in Fabric — writes always go to the original source system
> - Verify the current source list close to exam day; it has grown steadily (Oracle, SAP, BigQuery, MySQL are recent additions) and preview labels change

## Key Takeaways

- Database mirroring replicates entire databases into OneLake Delta tables from a growing list of GA and preview sources
- Metadata mirroring (Unity Catalog, Dremio) syncs only catalog structure and uses shortcuts — no data movement
- Open mirroring lets any application write change data to a landing zone per an open, public specification
- Mirroring storage is free up to 1 TB per purchased capacity unit; background compute is always free
- Choose mirroring for continuous replication of a supported source, shortcuts for referencing already-queryable data, and pipeline copy for anything needing transformation

## Related Topics

- [02-OneLake Shortcuts](./02-onelake-shortcuts.md)
- [04-Pipeline Ingestion](./04-pipeline-ingestion.md)

## Official Documentation

- [Mirroring in Fabric — overview](https://learn.microsoft.com/en-us/fabric/mirroring/overview)
- [Microsoft Fabric mirrored databases from Azure SQL Database](https://learn.microsoft.com/en-us/fabric/mirroring/azure-sql-database)
- [Microsoft Fabric mirrored databases from Snowflake](https://learn.microsoft.com/en-us/fabric/mirroring/snowflake)
- [Open mirrored databases](https://learn.microsoft.com/en-us/fabric/mirroring/open-mirroring)
- [Microsoft Fabric mirrored databases from Azure Databricks](https://learn.microsoft.com/en-us/fabric/mirroring/azure-databricks)
- [SQL database in Fabric — overview (automatic mirroring)](https://learn.microsoft.com/en-us/fabric/database/sql/overview)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-onelake-shortcuts.md) | [↑ Back to Section](./batch-ingestion.md) | [Next →](./04-pipeline-ingestion.md)**
