---
title: "Lifecycle & CI/CD — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - lifecycle
  - cicd
  - git
  - deployment-pipelines
  - workspace-settings
---

# Lifecycle & CI/CD — Quick Reference

Git integration, database projects, deployment pipelines, and workspace settings (Spark, domains, OneLake, Airflow). Condensed from [01-fabric-workspace-settings](../../01-fabric-workspace-settings/fabric-workspace-settings.md) and [02-lifecycle-management](../../02-lifecycle-management/lifecycle-management.md).

> [!abstract] Quick Reference
>
> - Git integration facts: providers, supported items, sync direction, conflict resolution
> - Database projects: auto-generated `.sqlproj` → `.dacpac` → SqlPackage publish
> - Deployment pipelines: stages, item pairing, deployment rules, what does/doesn't copy
> - Workspace settings: Spark pools/runtime, domains, OneLake, Apache Airflow (incl. the July 21 blueprint change)

---

## Git Integration

| Fact | Value |
| :--- | :--- |
| Supported providers | Azure DevOps (cloud), GitHub (cloud), GitHub Enterprise **cloud only** — ==no on-prem GitHub Enterprise Server== |
| Scope | One workspace ↔ one branch ↔ one folder at a time |
| Connect/disconnect | Workspace **Admin** only |
| Commit/update | Contributor+ with write on all items |
| Sync direction | One direction per action — Commit (workspace→Git) OR Update (Git→workspace), never both |
| Commit size caps | Azure DevOps 25 MB (SP) / 125 MB (SSO); GitHub 50 MB combined/commit |
| Workspace item cap | 1,000 items |
| Folder depth | 10 levels |

### Git Status Icons

| Status | Meaning |
| :--- | :--- |
| Synced | Identical in workspace and Git |
| ==Conflict== | Changed in **both** since last sync — Commit disabled until resolved |
| Uncommitted | Local changes not pushed |
| Update required | Git has commits not yet pulled |
| Unsupported item | Tracked in panel, never committed/updated/deleted |

### Conflict Resolution (3 paths)

1. **UI**: Update all → per item **Accept incoming** or **Keep current**
2. **Revert**: Undo (workspace) or `git revert` (branch), or disconnect/reconnect (overwrites *everything*, not just conflicts)
3. **Resolve in Git**: checkout new branch → commit → PR/merge on the Git provider → switch workspace back — the **only** path supporting real code review

### Supported Items (representative — verify against official list, changes often)

| GA | Preview |
| :--- | :--- |
| Lakehouse, Notebook, Environment, SJD, Pipeline, Copy Job, Dataflow Gen2, Mirrored DB, Eventhouse, EventStream, KQL DB/Queryset, SQL database | ==Warehouse==, Activator, Semantic model, Report, Cosmos database |

Unsupported items are **ignored**, not deleted — still visible in the panel.

**Branch out to new workspace** (Contributor+, uncommitted items are lost): full isolated copy, parent/child relationship shown. **Switch branch** (Admin by default): overwrites current workspace in place with the target branch's content — no uncommitted changes allowed.

---

## Database Projects (Warehouse / SQL database)

- Committing a Warehouse or SQL database to Git **auto-generates** a SQL database project (`.sqlproj`), one `.sql` file per object, `Schema/Object Type` folders. ==Never hand-edit `.sqlproj`== — Fabric overwrites it every commit.
- **Build → `.dacpac` → SqlPackage publish**: new DB → creates objects in dependency order; existing DB → diffs and emits only the needed `ALTER`/`CREATE`/`DROP`.
- **Schema Compare** (VS Code SQL Database Projects extension) previews the diff before commit/deploy — the reviewable counterpart to a scripted publish.
- Tracks **schema only** — no data, no SQL security (roles/RLS/permissions). Use **pre/post-deployment scripts** (Shared Queries, `MERGE` pattern) for static reference data.
- Known gotcha: `ALTER TABLE ... ADD` on a column/constraint currently **drops and recreates the table** — data-loss risk; workaround = create-new/copy-data/rename.
- Git+database projects = incremental, PR-reviewed change; deployment pipelines = stage promotion. Use both together, not as alternatives.

---

## Deployment Pipelines

| Fact | Value |
| :--- | :--- |
| Stages | ==2–10==, default Dev/Test/Prod; **count and names are permanent** after creation |
| Public stages | Changeable anytime (unlike stage count) |
| Item pairing | Name + type match; **folder is the tie-breaker** only when duplicates exist in one stage |
| Backward deployment | Only into an **empty** target stage, **full deploy only** — never selective |
| Data source rule item types | Dataflow Gen1, semantic model, paginated report, mirrored database |
| Parameter rule item types | Dataflow Gen1, semantic model |
| Default lakehouse rule | Notebook only |

> [!note] Deployment rules do **NOT** cover Lakehouse, Warehouse, Pipeline, Eventstream — use item-level parameterization for those. Rules can't be created in the Development stage; must be item owner to create one.

### What Deploys vs. What Doesn't

| Copied | ==Never copied== |
| :--- | :--- |
| Data sources/parameters, report visuals, model metadata, item relationships, sensitivity labels (new item / empty stage / consent prompt) | Data, URL/item ID, permissions, workspace settings, app content, personal bookmarks, semantic-model role assignments/refresh schedules/credentials |

### Permissions (both layers required)

| Combination | Can do |
| :--- | :--- |
| Pipeline Admin only | View/share pipeline, see stage tags — no content, no deploy |
| + workspace Viewer | Consume content, unassign |
| + workspace Contributor | Deploy items (Contributor+ in **both** source and target) |
| + workspace Admin | Assign workspaces to stages |

---

## Workspace Settings

### Spark

| Aspect | Starter Pool | Custom Pool |
| :--- | :--- | :--- |
| Node size | Medium only | Small–XX-Large |
| Startup | 5–10s best-effort | ~3 min on-demand, ~5s as custom live pool |
| Who configures | Nobody (managed) | Workspace **Admin** + capacity toggle **Customized workspace pools** |
| Autopause | 20 min idle | 2 min idle (default), or always-on |

- **Environment** = Spark compute (incl. runtime) + libraries + resources, versioned/reusable; Save stages, **Publish** applies (Resources are live immediately).
- Runtime 1.3 (Spark 3.5.5) = ==GA== and default; Runtime 2.0 (Spark 4.1) = Public Preview.
- **High concurrency**: default **5** notebooks/session, raisable to **50** via `spark.highConcurrency.max`; only the initiating notebook/activity is billed.
- **Native execution engine (NEE)**: preview overall; no structured streaming, no JSON/XML, no ANSI mode (forces full fallback); falls back to JVM automatically and silently on unsupported operators.

### Domains

| Role | Scope |
| :--- | :--- |
| Fabric admin | Create/manage any domain |
| Domain admin | Manage own domain only; **cannot** rename/delete or manage other domain admins |
| Domain contributor | Assign only workspaces they're workspace **Admin** of |

- Domain assignment affects **discovery/governance only** — never access (that's workspace role + item permission).
- ==Subdomains have no domain admins of their own== — always inherit the parent's.
- Default domain fills **gaps only** (unassigned workspaces) + governs future workspace creation — never overrides an existing assignment.
- 3 assignment methods: by name, by workspace admin, by capacity.

### OneLake (workspace-level)

| Setting | Solves | Level |
| :--- | :--- | :--- |
| External app access | Non-Fabric ADLS/Blob tools reading/writing | Workspace Admin |
| Shortcut cache | Egress cost/latency for **GCS/S3/S3-compatible/OPDG only** (never ADLS/Blob) — 1–28 day retention, files >1 GB never cached | Workspace Admin |
| OneLake diagnostics | Audit trail (who accessed what) | Workspace Admin |
| File explorer app kill switch | Disables the Windows client entirely | ==Tenant== admin (not workspace) |
| BCDR geo-replication | Region outage protection | ==Capacity== admin |

Soft delete = always-on, 7-day recovery window, not a toggle.

### Apache Airflow (July 21, 2026 blueprint change)

> [!note] =="Configure Dataflows Gen2 workspace settings" → "Configure Apache Airflow workspace settings"== — the *only* Domain 1 wording change vs. April 20, 2026. Dataflows Gen2 itself is not removed from the product.

| Aspect | Starter Pool | Custom Pool |
| :--- | :--- | :--- |
| Node size | Large (fixed) | Small (simple DAGs) or Large (complex/prod) |
| Uptime | Shuts down after 20 min inactivity | Always-on until paused |

- DAG `.py` files → **`dags`** folder. Private packages/wheels → **`plugins`** (or `plugins/libs` if no Git connected — path `plugins/libs/<file>.whl`, then **restart the job**).
- ==Free and PPU workspaces don't support Apache Airflow jobs==; private networks/VNets not yet supported.
- Airflow 2.10.5 / Python 3.12; version can't be changed on an existing job — create a new one.

---

## Gotchas & Traps

- Commit is disabled whenever the workspace has pending Git updates — you must Update before you can Commit; sync is never bidirectional in one action.
- A folder mismatch between two same-name/type items **prevents pairing outright** in deployment pipelines — it's not a tie-breaker success case, it's a failure mode.
- Deployment rules are a short, specific list (Dataflow Gen1, semantic model, paginated report, mirrored database, notebook) — Warehouse/Lakehouse/Pipeline connection differences need item-level parameters instead.
- Data is **never** copied by a deployment pipeline or by Git integration — schema/metadata only, every time.
- `ALTER TABLE ... ADD` in a database project drops and recreates the table — a real data-loss risk if deployed carelessly.
- Backward deployment demands an empty target stage AND full deploy — a scenario describing selective backward deployment or a non-empty target is unsupported.
- Pipeline Admin alone grants zero content visibility — workspace role must also be present for any real action.
- Shortcut caching never applies to ADLS/Blob — only GCS/S3/S3-compatible/OPDG.

## Before the Exam, I Can…

- [ ] Explain why Commit gets disabled and how to unblock it
- [ ] State the 3 conflict-resolution paths and which one supports a real PR-based merge
- [ ] Trace the database project build → `.dacpac` → SqlPackage publish pipeline and name what it excludes (data, security)
- [ ] List which item types support deployment rules and which rule type each supports
- [ ] Recite what a deployment pipeline never copies
- [ ] Distinguish starter vs. custom pools for both Spark and Apache Airflow, including who configures each
- [ ] Explain why subdomains have no admins and what default domain does and doesn't override
- [ ] State the one July 21, 2026 blueprint wording change and what it did NOT remove from the product

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
