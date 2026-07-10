---
title: OneLake Workspace Settings
type: topic
tags:
  - dp-700
  - fabric
  - onelake
  - workspace-settings
  - shortcuts
---

# OneLake Workspace Settings

## Overview

OneLake is the single, tenant-wide data lake every Fabric tenant gets automatically — but several of its behaviors are configured **per workspace**: whether apps outside Fabric can reach OneLake data, whether shortcut reads get cached, and whether data-access activity is logged. This file covers those workspace-level OneLake settings plus how they interact with the OneLake file explorer.

> [!abstract]
>
> - OneLake itself is tenant-wide and can't be deleted or duplicated; workspaces and domains organize it, they don't create separate lakes
> - Workspace **OneLake settings** control external-app access, shortcut caching, and diagnostics — configured under **Workspace settings → OneLake**
> - **Shortcut caching** only applies to GCS, S3, S3-compatible, and on-premises data gateway shortcuts — not ADLS or Blob shortcuts — with a 1–28 day retention window and a 1 GB per-file ceiling
> - The **OneLake file explorer** syncs metadata as placeholders, not full file downloads, and a tenant admin can disable the app for the whole org

> [!tip] What the Exam Tests
>
> - What "OneLake availability" means at the workspace level (external app access) versus the tenant-level toggle that disables the file explorer app entirely
> - Which shortcut types are eligible for caching, and the exact retention/size boundaries
> - The difference between OneLake diagnostics (access logging) and shortcut caching (performance/cost) as two distinct workspace OneLake settings
> - How OneLake file explorer's placeholder/sync model differs from a full local copy

---

## OneLake Availability and Workspace-Level Access

Every Fabric tenant automatically includes exactly one OneLake instance — you can't delete it or provision a second one. Data is organized underneath it hierarchically: **tenant → workspace → data items** (lakehouses, warehouses, eventhouses, KQL databases, and so on), with domains layered on top purely for grouping and discovery (see [02-Domain Settings](./02-domain-settings.md)).

"OneLake availability" at the **workspace** level is about whether tools *outside* Fabric can reach that workspace's OneLake data directly. Under **Workspace settings → OneLake**, the setting **Users can access data stored in OneLake with apps external to Fabric** controls this:

- Off by default in many tenants; when enabled, external ADLS Gen2-/Blob-compatible tools (Azure Storage Explorer, custom scripts using the ADLS SDK, etc.) can read/write OneLake data in that workspace using standard ADLS Gen2 APIs.
- Can be scoped to the entire organization or to specific security groups, depending on tenant policy.
- Requires the workspace **Admin** role to change.

This is a different control from the **tenant-level** setting (managed by a tenant admin in the Fabric admin portal) that can disable the **OneLake file explorer application** for the whole organization — that one is about a specific client app, not API-level external access. See [OneLake File Explorer Implications](#onelake-file-explorer-implications) below.

> [!warning] Common Mistake
> Don't conflate "OneLake external app access" (a workspace setting governing ADLS-API-level reachability) with "OneLake file explorer access" (a tenant setting governing one specific Windows client app). They're independently controlled and answer different exam questions.

---

## Workspace-Level OneLake Settings

Beyond external access, the **OneLake** tab in workspace settings exposes:

| Setting | What it controls | Who can change it |
| :--- | :--- | :--- |
| External app access | Whether non-Fabric ADLS/Blob-compatible tools can read/write this workspace's OneLake data | Workspace Admin |
| Shortcut cache | Enable/disable caching for eligible external shortcuts, set retention period, reset cache | Workspace Admin |
| OneLake diagnostics | Stream data-access events (who accessed what, when, how) as logs into a lakehouse | Workspace Admin |

**OneLake diagnostics**, when enabled, captures user actions from the Fabric UI, programmatic API/analytics-engine access, and cross-workspace access through shortcuts — all streamed as logs into a lakehouse you designate. This is distinct from caching: diagnostics is about **auditability**, caching is about **performance and egress cost**.

> [!note] Low exam yield — REST-API-only surface
> Workspace OneLake settings are also readable via the [OneLake Settings REST API](https://learn.microsoft.com/en-us/rest/api/fabric/core/onelake-settings/get-settings) (admin workspace role required: `GET /v1/workspaces/{workspaceId}/onelake/settings`), which additionally surfaces **lifecycle management** fields — a default access tier (`Hot`/`Cool`/`Cold`, mirroring Azure Blob Storage's tiering — Cool/Cold trade lower storage cost for higher transaction cost and a minimum storage duration) and whether an active lifecycle policy exists — plus diagnostic-log immutability policy details (protected scope, minimum retention days). None of this appears in the in-portal settings UI at time of writing; it's not a frequently tested surface, so skim only.

---

## Cache for Shortcuts

**Shortcut caching** reduces egress costs for cross-cloud data access. When OneLake reads a file through an eligible external shortcut, it stores that file in a per-workspace cache; subsequent reads are served from the cache instead of round-tripping to the remote storage provider.

| Rule | Value |
| :--- | :--- |
| Supported shortcut sources | ==Google Cloud Storage (GCS), Amazon S3, S3-compatible, and on-premises data gateway (OPDG)== shortcuts only — including on-prem S3 shortcuts using Microsoft Entra service principal auth |
| Retention period | Configurable **1–28 days**; resets on every access |
| Max cacheable file size | Files **> 1 GB are never cached** |
| Freshness | If the remote source has a newer version than the cached copy, OneLake serves from the source and refreshes the cache |
| Purge | Auto-purged if unaccessed within the retention window, or manually via **Reset cache** |

**To enable**: **Workspace settings → OneLake tab** → toggle caching **On** → set the **Retention Period**. Use **Reset cache** on the same page to immediately clear all cached files for the workspace.

> [!warning] Common Mistake
> ADLS Gen2 and Azure Blob Storage shortcuts are **not** cache-eligible — shortcut caching exists specifically to cut cross-cloud egress cost, and Azure-native sources don't have that egress cost problem when accessed from a Fabric workspace on Azure. Don't pick an ADLS shortcut as the answer to a "which shortcut benefits from caching" scenario question.

> [!note] Mental model — Shortcut caching
> It's a browser cache for a website you revisit often. The first load reaches out to the remote source; every read within the retention window serves from the local copy, and the window resets each time you visit. Let it go stale (unused past the retention period) and it's evicted; a fresher version at the source always wins over a cached one.

**Practice Question 1** *(Medium)*

A workspace has shortcuts to an Amazon S3 bucket, an Azure Data Lake Storage Gen2 account, and a Google Cloud Storage bucket. The team enables shortcut caching with a 14-day retention period. Which shortcuts benefit?

A. All three shortcuts  
B. Only the S3 and GCS shortcuts  
C. Only the ADLS Gen2 shortcut  
D. None — caching requires an on-premises data gateway  

> [!success]- Answer
> **B. Only the S3 and GCS shortcuts**
>
> Shortcut caching currently supports GCS, S3, S3-compatible, and on-premises data gateway shortcuts. ADLS Gen2 (and Blob Storage) shortcuts are Azure-native and aren't part of the cache-eligible source list — they're excluded regardless of retention period settings.

**Practice Question 2** *(Easy)*

A cached file in a shortcut hasn't been accessed in 20 days, and the retention period is set to 14 days. What happens to it?

A. It stays cached indefinitely since it was accessed at least once  
B. It's purged from the cache since it wasn't accessed within the 14-day retention window  
C. It's automatically re-downloaded every 14 days regardless of access  
D. It's moved to Cold access tier  

> [!success]- Answer
> **B. It's purged from the cache since it wasn't accessed within the 14-day retention window**
>
> Each access resets the retention countdown. Going 20 days without an access exceeds the configured 14-day window, so the cached copy is purged. The next read after that falls through to the remote source and re-populates the cache.

---

## OneLake File Explorer Implications

The **OneLake file explorer for Windows** integrates OneLake into Windows File Explorer, letting users drag-and-drop CSV, Excel, and Parquet files directly into OneLake without the Fabric portal or scripts.

Key behavioral points that matter for workspace configuration:

- **Placeholder/sync model, not a full copy**: "sync" pulls up-to-date metadata for files and folders and pushes local changes back to OneLake — it does **not** download file contents automatically. A file only downloads to disk when you double-click it. Files that were synced but not opened stay as lightweight cloud-only placeholders (blue cloud icon).
- **One-way automatic sync**: changes made *inside* File Explorer sync to OneLake automatically. Changes made to the same item by someone else, or outside your File Explorer session, are **not** automatically pulled — you must manually right-click → **OneLake → Sync from OneLake**.
- **Shortcuts are visible and editable**: all folders in an item, including OneLake shortcuts, appear in the file explorer, and you can view, update, and delete files/folders through those shortcuts — subject to your permissions on the shortcut's target.
- **Case sensitivity mismatch**: Windows File Explorer is case-insensitive; OneLake is case-sensitive. If two files differ only by case, File Explorer shows only the oldest one.
- **Tenant-level kill switch**: a tenant admin can disable OneLake file explorer access for the entire organization from the Fabric admin portal. If disabled while the app is running, it exits immediately — local placeholders and previously downloaded content remain on disk, but no further sync to or from OneLake happens until re-enabled.

> [!note] Mental model — OneLake file explorer
> It behaves like OneDrive's Files On-Demand, not like a mapped network drive with everything downloaded upfront. Icons tell you the state: blue cloud = online-only, green check = downloaded locally, spinning arrows = syncing.

**Practice Question 3** *(Medium)*

A user opens a lakehouse folder in OneLake file explorer and sees several files with a blue cloud icon. A colleague, working directly in the Fabric portal, updates one of those files. What does the first user need to do to see the update in File Explorer?

A. Nothing — updates always sync automatically regardless of source  
B. Right-click the file or folder and select OneLake → Sync from OneLake  
C. Reinstall the OneLake file explorer application  
D. Double-click the file — this both downloads and refreshes it  

> [!success]- Answer
> **B. Right-click the file or folder and select OneLake → Sync from OneLake**
>
> OneLake file explorer automatically syncs changes made *within* File Explorer up to OneLake, but it does **not** automatically pull in changes made elsewhere (like directly in the Fabric portal). The user must manually trigger a sync from OneLake to refresh the view. Double-clicking (D) only downloads the file's current — possibly stale — placeholder content; it doesn't force a metadata refresh from the service.

---

## Data Residency and Regional Endpoints

External access settings interact with **where** OneLake requests are routed. The default global endpoint (`https://onelake.dfs.fabric.microsoft.com`) can, during endpoint resolution, route a request through a different region than the workspace's own — a concern if your organization has data-residency requirements. Each workspace's capacity is pinned to a region, and OneLake also exposes **regional endpoints** in the form `https://<region>-onelake.dfs.fabric.microsoft.com` (for example, `westus-onelake.dfs.fabric.microsoft.com`). Tools or scripts that must guarantee in-region traffic — relevant once external app access is enabled for a workspace — should target the regional endpoint that matches the workspace's capacity region rather than the global one.

## Disaster Recovery and Data Protection

OneLake protects data automatically, independent of any workspace toggle:

- **Redundancy**: zone-redundant storage (ZRS) in regions with availability zones, locally redundant storage (LRS) elsewhere.
- **Business continuity and disaster recovery (BCDR)**: can be enabled at the **capacity** level to geo-replicate data to a paired Azure region, protecting against region-wide outages.
- **Soft delete**: deleted files are retained for **7 days**, giving a recovery window for accidental deletions — this applies regardless of whether shortcut caching or diagnostics are configured.

These protections aren't configured from the workspace OneLake settings tab — BCDR is a capacity-level setting — but they're commonly tested alongside workspace-level OneLake settings since both fall under "data protection and monitoring."

## OneLake Catalog and Governance Context

The **OneLake catalog** is the discovery surface where the workspace-level settings in this file become visible to end users: a workspace with external access enabled, shortcut caching configured, and diagnostics turned on still surfaces its items through the same catalog used for domain-based filtering (see [02-Domain Settings](./02-domain-settings.md)). Data owners can review sensitivity-label coverage, endorsements, and data location directly from the catalog — but the underlying access control always resolves through **OneLake security roles** and workspace/item permissions, not catalog visibility. Deep OneLake security role configuration (folder/table/row/column-level permissions) is covered separately in [03-OneLake Security](../03-security-governance/03-onelake-security.md).

## How External Shortcuts Use Cloud Connections

ADLS and S3 shortcuts (the same source types eligible for caching, plus ADLS) don't embed credentials directly — they delegate authorization through a **cloud connection**. When you create a new ADLS or S3 shortcut, you either create a new connection or bind to an existing one; this bind operation requires **permission on the connection itself**, separate from workspace or item permissions. If you don't have permission on the connection, you can't create a shortcut that uses it, even if you otherwise have edit rights on the lakehouse. This is a common source of "why can't I create this shortcut" support questions, and it's worth knowing as a companion fact to shortcut caching: caching optimizes *reads* through an already-working shortcut, while the connection bind governs whether the shortcut can be *created* in the first place.

## Workspace OneLake Settings at a Glance

Three of this file's settings live side by side in the same **Workspace settings → OneLake** panel but solve different problems — worth comparing directly since exam scenarios often describe a symptom and expect you to pick the matching setting:

| Setting | Solves | Doesn't solve | Configured by |
| :--- | :--- | :--- | :--- |
| **External app access** | Letting non-Fabric ADLS/Blob-compatible tools read/write this workspace's OneLake data | Performance of repeated reads; access auditing | Workspace Admin |
| **Shortcut cache** | Egress cost and latency for repeated reads through eligible external shortcuts (GCS/S3/S3-compatible/OPDG) | External tool access; compliance logging | Workspace Admin |
| **OneLake diagnostics** | Compliance/audit visibility into who accessed what data, when, and how | Performance; external tool access | Workspace Admin (destination lakehouse chosen at enable time) |

A scenario describing "our cross-cloud egress bill is too high" points to **shortcut caching**; "auditors need an access trail" points to **diagnostics**; "our data science team wants to point Azure Storage Explorer at this lakehouse" points to **external app access**. Treat them as three independent levers, not a single "OneLake access" toggle.

## Tenant, Capacity, and Workspace: Which Level Owns Which Setting

OneLake behavior spans three configuration levels, and the exam expects you to know which level owns which control:

| Level | Setting | Who configures |
| :--- | :--- | :--- |
| **Tenant** | Whether the OneLake file explorer app can run at all in the organization | Tenant admin, Fabric admin portal |
| **Capacity** | Business continuity / disaster recovery (BCDR) geo-replication | Capacity admin |
| **Workspace** | External app access, shortcut caching, OneLake diagnostics | Workspace Admin |

A question describing "we need to stop everyone in the company from using OneLake file explorer" is a **tenant** setting question, not a workspace OneLake settings question — even though both are conceptually "OneLake access." Keeping these three levels straight is one of the more reliable ways to eliminate distractor answers on this topic.

## A Note on Item-Type Coverage

Not every setting in this file applies uniformly across item types. Shortcut caching, for instance, benefits shortcuts created in **lakehouses** and **KQL databases** — the two item types where OneLake shortcuts can be created in the first place. External app access and OneLake diagnostics operate at the **workspace** level and therefore apply uniformly to every item in that workspace regardless of type (lakehouse, warehouse, eventhouse, and so on), since they govern the OneLake surface underneath all of them rather than any single item's behavior.

## A Note on BCDR vs. Soft Delete

Two data-protection mechanisms are easy to conflate on the exam. **Business continuity and disaster recovery (BCDR)** is an opt-in, capacity-level setting that geo-replicates data to a paired Azure region — it protects against a whole-region outage. **Soft delete** is always-on, workspace-agnostic, and simply retains deleted files for 7 days so an accidental deletion can be recovered — it protects against human error, not regional failure. Neither one is a workspace OneLake setting, but both commonly appear in the same question set as caching and diagnostics because they all fall under "OneLake data protection and monitoring."

## Terminology Quick Reference

| Term | Definition |
| :--- | :--- |
| **OneLake** | The single, tenant-wide data lake automatically included with every Fabric tenant |
| **Shortcut** | A OneLake object that references data at another location (internal or external) without copying it |
| **Shortcut cache** | Per-workspace cache for eligible external shortcut reads, reducing egress cost and latency |
| **Retention period** | The 1–28 day window a cached shortcut file stays cached before being purged if unaccessed |
| **OneLake diagnostics** | Workspace setting that streams data-access events as logs into a designated lakehouse |
| **External app access** | Workspace setting allowing non-Fabric ADLS/Blob-compatible tools to read/write OneLake data |
| **OneLake file explorer** | Windows client app that integrates OneLake into File Explorer using a placeholder/sync model |
| **Cloud connection** | The credential/authorization object an ADLS or S3 shortcut binds to; requires its own permission to use |
| **Data residency** | Guaranteeing OneLake requests stay within a specific Azure region by using that region's dedicated endpoint |
| **Lifecycle management** | Workspace-level default access tier (Hot/Cool/Cold) and policy status, readable via the OneLake Settings REST API |

## Use Cases

- Enabling external app access so a governance team can audit OneLake data with Azure Storage Explorer without a Fabric login
- Turning on shortcut caching for a workspace with heavy S3 shortcut read traffic to cut cross-cloud egress cost
- Enabling OneLake diagnostics ahead of a compliance audit that requires access logs
- Using OneLake file explorer for business users who need drag-and-drop file uploads without touching the Fabric portal

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| External ADLS tool can't reach workspace data | "Users can access data stored in OneLake with apps external to Fabric" is disabled | Workspace Admin enables it in Workspace settings → OneLake |
| ADLS Gen2 shortcut reads still hit the remote source every time | ADLS shortcuts aren't cache-eligible | Expected behavior — caching only covers GCS/S3/S3-compatible/OPDG shortcuts |
| Cached shortcut data seems stale | Retention window hasn't expired and source hasn't changed since last read | Use Reset cache to force a purge, or wait for the source to actually update |
| OneLake file explorer won't start | Tenant admin disabled the app tenant-wide, or Windows search is disabled | Confirm tenant setting with a tenant admin; re-enable Windows search |
| File explorer shows only one of two similarly-named files | Case-sensitivity mismatch between OneLake (case-sensitive) and Windows File Explorer (case-insensitive) | Rename one file to avoid case-only collisions, or manage it through another tool that respects case |
| New ADLS/S3 shortcut creation fails despite having Contributor access | The creator lacks permission on the **cloud connection** the shortcut would bind to | Grant permission on the connection, or have a user with connection permission create it |
| Diagnostic logs never arrive in the target lakehouse | Diagnostics was enabled but no destination lakehouse was selected, or the selected lakehouse was later deleted | Re-open OneLake diagnostics settings and confirm/reselect a valid destination lakehouse |

## Best Practices

- Review the three workspace OneLake settings (external access, caching, diagnostics) together during workspace provisioning rather than reactively, one at a time, after an incident
- Scope external app access to specific security groups rather than the whole org unless there's a clear reason not to
- Enable shortcut caching only for workloads reading eligible sources (GCS/S3/S3-compatible/OPDG) repeatedly — it adds no value for ADLS/Blob shortcuts
- Turn on OneLake diagnostics before, not after, a compliance requirement lands
- Communicate the tenant-level file explorer kill switch to end users before disabling it, since local placeholders remain but stop syncing
- Use the regional OneLake endpoint (not the global one) for any tooling with data-residency requirements
- Treat shortcut cache **Reset cache** as a deliberate, workspace-wide action — it purges every cached file for that workspace, not just one shortcut

## Exam Tips

> [!tip] Exam Tips
>
> - "External app access" (workspace-level) and "file explorer availability" (tenant-level) are two different controls — don't merge them on the exam
> - Shortcut caching source list: **GCS, S3, S3-compatible, on-premises data gateway** — never ADLS/Blob
> - Cache retention is **1–28 days**, files **> 1 GB never cache**, and access resets the countdown
> - OneLake file explorer syncs **metadata as placeholders**, not full downloads, and only pushes local changes automatically — pulling remote changes needs a manual **Sync from OneLake**

## Key Takeaways

- OneLake is one tenant-wide lake; workspace settings control access and behavior, not separate lake instances
- Three distinct workspace OneLake settings: external app access, shortcut caching, and diagnostics
- Shortcut caching is source-restricted (GCS/S3/S3-compatible/OPDG) and bounded by a 1–28 day retention window and 1 GB file size ceiling
- OneLake file explorer is a placeholder-sync client, not a full-copy sync tool, and can be disabled tenant-wide independent of workspace settings

## Related Topics

- [01-Spark Settings](./01-spark-settings.md)
- [02-Domain Settings](./02-domain-settings.md)
- [04-Airflow Settings](./04-airflow-settings.md)

## Official Documentation

- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)
- [OneLake, the unified data lake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- [Unify data sources with OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)
- [How do I connect to OneLake?](https://learn.microsoft.com/en-us/fabric/onelake/onelake-access-api)
- [Access Fabric data locally with OneLake file explorer](https://learn.microsoft.com/en-us/fabric/onelake/onelake-file-explorer)
- [OneLake Settings - Get Settings (REST API)](https://learn.microsoft.com/en-us/rest/api/fabric/core/onelake-settings/get-settings)

---

**[← Previous](./02-domain-settings.md) | [↑ Back to Section](./fabric-workspace-settings.md) | [Next →](./04-airflow-settings.md)**
