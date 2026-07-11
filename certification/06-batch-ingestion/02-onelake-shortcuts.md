---
title: OneLake Shortcuts
type: topic
tags:
  - dp-700
  - fabric
  - batch-ingestion
  - onelake
  - shortcuts
---

# OneLake Shortcuts

## Overview

A **shortcut** is an object in OneLake that points to data stored somewhere else — internal to OneLake or external to it — and makes that data appear as a local folder without copying a single byte. This topic covers the internal and external shortcut types, how shortcuts are created and how their permissions are delegated, shortcut caching for external sources, when to choose a shortcut over an actual copy, and how shortcut behavior differs across Spark, the SQL analytics endpoint, and semantic models.

> [!abstract]
>
> - Shortcuts behave like **symbolic links** — deleting a shortcut never deletes the target data; moving or deleting the target can break the shortcut
> - **Internal** shortcuts reference other Fabric items (lakehouse, warehouse, KQL database, mirrored database, semantic model); **external** shortcuts reference ADLS Gen2, Amazon S3, S3-compatible storage, Google Cloud Storage, Dataverse, and on-premises sources via a gateway
> - Internal shortcuts authorize using the ==calling user's identity==, not the shortcut creator's — the caller still needs permission on the target
> - **Caching** applies only to GCS, S3, S3-compatible, and on-premises gateway shortcuts — retention is configurable 1–28 days, and files over 1 GB are never cached

> [!tip] What the Exam Tests
>
> - Naming the correct internal or external shortcut target for a given source system
> - Understanding that shortcut permission checks use the *calling user's* identity against the *target's* permissions, with a specific Direct Lake/delegated-identity exception
> - Knowing which external sources support caching and which don't
> - Choosing a shortcut over a full data copy in cross-workspace or cross-cloud scenarios

---

## What Shortcuts Are and Where They Live

Shortcuts appear as folders in OneLake, and any workload or service with access to OneLake can use them transparently — Spark, SQL, Real-Time Intelligence, Analysis Services, and non-Fabric services via the OneLake API. You create shortcuts inside **lakehouses** and **KQL databases**, either interactively in the Fabric portal or programmatically via the OneLake REST API.

In a lakehouse, the **Tables** folder only allows shortcuts at the top level (no shortcuts nested inside subdirectories of Tables), and a shortcut pointing at Delta-formatted data there is automatically recognized and synchronized as a table. The **Files** folder has no such restriction — shortcuts can live at any depth, pointing at data in any format, but table discovery doesn't happen there.

> [!warning] Common Mistake
> Naming a shortcut (or its target folder) with a space character and expecting it to register as a Delta table. The Delta format doesn't support table names with spaces, and OneLake won't recognize such a shortcut as a Delta table in the lakehouse — even if the underlying files are valid Delta.

---

## Types of Shortcuts

### Internal OneLake Shortcuts

Internal shortcuts reference data already inside another Fabric item, within the same workspace or across workspaces, and the item types don't need to match (a lakehouse shortcut can point at a warehouse's tables). Supported internal targets:

| Internal target |
| :--- |
| KQL databases |
| Lakehouses |
| Mirrored Azure Databricks catalogs |
| Mirrored databases |
| Semantic models |
| SQL databases |
| Warehouses |

### External OneLake Shortcuts

| External target | Notes |
| :--- | :--- |
| **Amazon S3** | Standard AWS object storage |
| **Amazon S3-compatible** | Third-party object stores implementing the S3 API |
| **Azure Data Lake Storage (ADLS) Gen2** | Native Azure hierarchical namespace storage |
| **Azure Blob Storage** | Standard Azure blob containers |
| **Dataverse** | Microsoft's Power Platform data store |
| **Google Cloud Storage (GCS)** | GCP object storage |
| **Iceberg tables** | Apache Iceberg format exposed through OneLake |
| **OneDrive and SharePoint** | Microsoft 365 document sources |
| **On-premises / network-restricted sources** | Via the Fabric on-premises data gateway (OPDG) |

> [!note] Mental model — shortcuts as symbolic links
> A shortcut is OneLake's version of a **symlink**: it's a pointer, not a copy. Deleting the shortcut deletes only the pointer — the target is untouched. But delete a *file or folder reached through* the shortcut (if you have write permission at the target), and you delete it at the source too, exactly like following a symlink into a real directory and running `rm`. The shortcut itself has no cascading-delete behavior on its target; only operations that reach *through* it do.

**Practice Question 1** *(Easy)*

A data engineering team wants to make Parquet files sitting in a third-party, S3-compatible object store queryable from a Fabric lakehouse, without copying the files into OneLake. Which feature should they use, and what shortcut category does it fall under?

A. Database mirroring, since it replicates data automatically  
B. A shortcut, external category, targeting the S3-compatible source  
C. A shortcut, internal category, since OneLake supports all storage transparently  
D. A Copy job with a bulk copy mode  

> [!success]- Answer
> **B. A shortcut, external category, targeting the S3-compatible source**
>
> The requirement — reference data in place, no copy — is the textbook shortcut use case, and an S3-compatible object store is an *external* shortcut target (alongside S3, ADLS Gen2, GCS, Dataverse, and on-premises sources via gateway). Mirroring replicates data continuously rather than referencing it in place, and a Copy job would physically move the data, which the scenario explicitly wants to avoid.

---

## Permissions Delegation Model

When a user accesses data through an **internal** shortcut, OneLake authorizes the request using **the calling user's own identity** against the shortcut's target — the user must have permission on the target location, not merely on the shortcut itself.

> [!warning] Common Mistake
> Assuming that once a shortcut exists, anyone who can see the shortcut can read the data behind it. Creating a shortcut doesn't grant access to its target — the calling user still needs their own permissions on the target item. A shortcut with no underlying access for the caller just returns an authorization error, not silently-broken data.

There's one documented exception worth knowing cold for the exam: when users access shortcuts through Power BI semantic models using **Direct Lake over SQL** or T-SQL engines in **Delegated identity mode**, the *calling user's* identity is **not** passed through to the shortcut target — instead, the *calling item's owner's* identity is delegated on the user's behalf. To get true per-user identity pass-through, switch to **Direct Lake over OneLake** mode for semantic models, or **User identity mode** for T-SQL.

**External** shortcuts (ADLS, S3) delegate authorization through **cloud connections** — creating or selecting a connection is a *bind* operation, and only users with permission on that connection can perform it. Someone without connection permission can't create a new external shortcut using it, even if they could otherwise browse to the target.

---

## Shortcut Caching

Shortcut caching reduces egress costs on cross-cloud reads by storing accessed files locally to the Fabric workspace, so repeat reads are served from cache instead of round-tripping to the remote provider.

| Detail | Value |
| :--- | :--- |
| **Supported sources** | Google Cloud Storage (GCS), Amazon S3, S3-compatible, on-premises data gateway shortcuts (including on-prem S3 via Microsoft Entra service principal auth) |
| **Not supported** | ADLS Gen2, Azure Blob Storage, Dataverse, internal OneLake shortcuts |
| **Retention period** | Configurable ==1–28 days==; every access resets the retention clock |
| **File size limit** | Files ==larger than 1 GB are never cached== |
| **Freshness check** | If the remote source has a newer version than the cache, OneLake serves from the remote and refreshes the cache |
| **Where to configure** | Workspace Settings → **OneLake** tab → toggle caching on, set retention period; **Reset cache** clears all cached files for the workspace |

> [!note] Mental model — caching as a toll bridge
> Shortcut caching is a **toll bridge with a memory**: the first trip across (reading a remote file) costs the full egress toll, but the bridge remembers the file for up to 28 days — every subsequent crossing during that window is free, and each crossing resets the clock. Cross a file that's grown too big (over 1 GB) or come from a source the bridge doesn't recognize (ADLS Gen2, internal shortcuts), and you pay full price every time.

**Practice Question 2** *(Medium)*

A workspace has an external shortcut pointing at an ADLS Gen2 container with terabytes of Parquet files that are read repeatedly by multiple Spark jobs each day. The team enables shortcut caching in Workspace Settings expecting reduced latency and egress cost on repeat reads. What actually happens?

A. Caching works as expected — ADLS Gen2 is a fully supported caching source  
B. Caching has no effect for this shortcut — ADLS Gen2 shortcuts aren't a supported caching source; only GCS, S3, S3-compatible, and on-premises gateway shortcuts are cached  
C. Caching works, but only for files under 100 MB  
D. Caching fails and breaks the shortcut entirely  

> [!success]- Answer
> **B. Caching has no effect for this shortcut — ADLS Gen2 shortcuts aren't a supported caching source; only GCS, S3, S3-compatible, and on-premises gateway shortcuts are cached**
>
> Shortcut caching's supported source list is explicit and doesn't include ADLS Gen2 or Azure Blob Storage — likely because ADLS Gen2 already sits inside Azure, where egress costs and cross-cloud latency aren't the same concern caching was built to solve for AWS/GCP/on-prem sources. Toggling the workspace-level caching setting doesn't error for an unsupported shortcut; it simply has no effect on it.

---

## Shortcuts vs. Copying Data: When to Choose Which

| Factor | Favors a Shortcut | Favors Copying (pipeline/mirroring) |
| :--- | :--- | :--- |
| **Source freshness needs** | Source already updates in place; shortcut always reflects the latest version | Need a stable, versioned snapshot decoupled from source changes |
| **Data ownership** | Data must stay governed and stored at its origin (cross-tenant sharing, compliance) | Data needs to be transformed, reshaped, or fully owned by the target workspace |
| **Storage cost** | Avoids duplicate storage entirely — one copy, referenced everywhere | Some duplication is acceptable or even desired for isolation |
| **Latency/format transformation** | Source format is already query-compatible (Delta, or a format the reading engine handles) | Source format needs conversion (e.g., CSV → Delta) before it's efficiently queryable |
| **Write isolation** | Read-only access is sufficient | Downstream writes must not be able to reach back and mutate the source |

> [!warning] Common Mistake
> Reaching for a shortcut when the real requirement is format conversion or transformation. A shortcut exposes the source *as-is* — it doesn't convert CSV to Delta, deduplicate rows, or reshape a schema. If the scenario needs any of that, a pipeline (Copy activity/Copy job) or a Spark notebook is the right tool, not a shortcut.

---

## Shortcut Behavior Across Engines

| Engine | Behavior |
| :--- | :--- |
| **Apache Spark** | Reads shortcuts via relative file paths (`spark.read.format("delta").load("Tables/MyShortcut")`), or as a managed table with Spark SQL (`SELECT * FROM MyLakehouse.MyShortcut`) if the shortcut is in the Tables section and Delta-formatted |
| **SQL analytics endpoint** | Reads Tables-section shortcuts through standard T-SQL (`SELECT TOP (100) * FROM [MyLakehouse].[dbo].[MyShortcut]`) — subject to the same read-only constraint as any other lakehouse table |
| **KQL / Real-Time Intelligence** | A shortcut in a KQL database is treated as an **external table**; query it with the `external_table()` function (`external_table('MyShortcut') \| take 100`) |
| **Semantic models (Direct Lake)** | Semantic models built over a lakehouse's Tables-section shortcuts can run in Direct Lake mode, reading directly from the shortcut's underlying files — subject to the delegated-identity caveat above |
| **Non-Fabric services** | Any service that speaks a subset of the ADLS Gen2/Blob API can reach shortcuts through the OneLake API directly |

## Use Cases

- Referencing a partner organization's ADLS Gen2 data in a joint analytics workspace without duplicating storage or losing governance over the source
- Making mirrored Azure Databricks Unity Catalog tables visible inside a Fabric lakehouse via metadata mirroring's underlying shortcut mechanism
- Cross-workspace analytics where a gold-layer lakehouse shortcuts tables from several domain-specific lakehouses instead of copying and re-syncing them
- Sharing a KQL database's specific tables, materialized views, and functions with another team via an eventhouse database shortcut, without exposing the entire source database

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Shortcut appears but querying it returns an authorization error | Caller lacks permission on the shortcut *target*, not just the shortcut object | Grant the calling user (or their group) access to the target location |
| Direct Lake semantic model doesn't reflect per-user row-level security on a shortcut's target | Semantic model is running in Direct Lake over SQL / Delegated identity mode, which passes the calling item owner's identity, not the caller's | Switch to Direct Lake over OneLake mode, or T-SQL User identity mode, for true per-user pass-through |
| Shortcut isn't recognized as a Delta table | Target folder or shortcut name contains a space character | Rename the target/shortcut to remove spaces — Delta doesn't support space-containing table names |
| Caching toggle produces no visible latency or cost improvement | Shortcut source isn't a supported caching type (e.g., ADLS Gen2) | Confirm the source is GCS, S3, S3-compatible, or on-prem gateway before expecting caching benefits |
| A file behind a shortcut was unexpectedly deleted at the source | User had write permission on the target and deleted a file/folder *through* the shortcut path, which propagates to the target | Restrict write permissions at the target if shortcuts should be read-only in practice |

## Best Practices

- Use shortcuts to eliminate cross-workspace or cross-cloud copies whenever the source is already in a query-compatible format
- Enable caching only for the sources that support it (GCS/S3/S3-compatible/on-prem gateway), and size the retention window to the read pattern — longer for stable reference data, shorter for frequently-changing sources
- Remember that shortcut permission checks flow through the calling user's identity against the target — audit target permissions, not just who can see the shortcut
- Reserve pipelines and mirroring for scenarios that genuinely need transformation, format conversion, or a decoupled snapshot — don't build a copy pipeline where a shortcut would do

## Exam Tips

> [!tip] Exam Tips
>
> - Internal shortcut targets: KQL database, lakehouse, mirrored Azure Databricks catalog, mirrored database, semantic model, SQL database, warehouse
> - External shortcut targets: ADLS Gen2, Blob Storage, S3, S3-compatible, GCS, Dataverse, Iceberg, OneDrive/SharePoint, on-premises via gateway
> - Caching supports GCS, S3, S3-compatible, and on-prem gateway only — retention 1–28 days, files over 1 GB never cached
> - Internal shortcut authorization uses the calling user's identity against the target, **except** Direct Lake over SQL / Delegated identity mode, which delegates the calling item owner's identity instead

## Key Takeaways

- Shortcuts are symbolic-link-like pointers in OneLake; they eliminate copies but require the caller to have real permission on the target
- Internal shortcuts reference other Fabric items; external shortcuts reach ADLS Gen2, S3, S3-compatible, GCS, Dataverse, Iceberg, OneDrive/SharePoint, and on-premises sources via a gateway
- Only GCS, S3, S3-compatible, and on-prem gateway shortcuts support caching, with a 1–28 day retention window and a 1 GB per-file ceiling
- Shortcuts don't transform data — reach for a pipeline or mirroring when format conversion or a decoupled snapshot is required

## Related Topics

- [01-Choosing a Data Store](./01-choosing-data-store.md)
- [03-Mirroring](./03-mirroring.md)

## Official Documentation

- [Unify data sources with OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)
- [OneLake shortcut security](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcut-security)
- [Create an internal OneLake shortcut](https://learn.microsoft.com/en-us/fabric/onelake/create-onelake-shortcut)
- [Manage connections for shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/manage-shortcut-connections)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-choosing-data-store.md) | [↑ Back to Section](./batch-ingestion.md) | [Next →](./03-mirroring.md)**
