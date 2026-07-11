---
title: "Security & Governance — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - security
  - governance
  - rls
  - onelake
  - masking
---

# Security & Governance — Quick Reference

Workspace/item access, RLS/CLS/OLS, OneLake security, dynamic data masking, and governance (labels, endorsement, audit) for Fabric. Condensed from [03-security-governance](../../03-security-governance/security-governance.md).

> [!abstract] Quick Reference
>
> - Workspace roles (Admin/Member/Contributor/Viewer) vs. item permissions — two independent access layers
> - The **Who-Bypasses-What** matrix — the single highest-yield table in this domain
> - OneLake security roles, `DefaultReader`, and shortcut permission delegation
> - DDM mask functions and the masking-is-not-encryption trap
> - Sensitivity labels, endorsement tiers, and audit log facts

---

## Workspace Roles — Condensed Capability Matrix

Additive: Admin ⊃ Member ⊃ Contributor ⊃ Viewer for nearly every capability.

| Capability | Admin | Member | Contributor | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| Manage workspace, add/remove Admins | ✅ | | | |
| Add members at own level or below | ✅ | ✅ | | |
| Create/modify database items (Warehouse, mirroring) | ✅ | ✅ | ✅ | |
| Connect to SQL analytics endpoint (**ReadData** / TDS) | ✅ | ✅ | ✅ | ✅ |
| Read via OneLake APIs / Spark (**ReadAll**) | ✅ | ✅ | ✅ | ❌ |
| Write/delete pipelines, notebooks, Lakehouse/Warehouse data | ✅ | ✅ | ✅ | |
| View execution output | ✅ | ✅ | ✅ | ✅ |

> [!note] ==Viewer gets ReadData (TDS/T-SQL) but NOT ReadAll (OneLake APIs/Spark) by default== — the single most tested fact in this table.

Max **1,000** users/groups per workspace in roles. Multi-group membership → **highest** role wins, no capping. Role changes apply on the user's **next login**, not mid-session.

## Item Permissions

| Permission | Grants |
| :--- | :--- |
| Read | Metadata + reports; **not** underlying data |
| ReadAll | OneLake APIs/Spark/Lakehouse explorer data access |
| Write | Full read/write incl. SQL analytics endpoint |
| Reshare / Execute / ViewOutput / ViewLogs | Layer on Read/Write only — never standalone |

Item permission and workspace role are **independent grants** — removing an item share does nothing if the user still holds Contributor+ workspace role (they see it anyway). Full revocation requires clearing **both** layers.

- Gateway permissions are a ==third independent axis== — configuring a scheduled refresh through an on-prem data gateway needs Contributor+ AND a permission on the gateway itself (managed outside Fabric roles); Contributor everywhere still can't schedule the refresh without it.

RLS on a Power BI semantic model (DAX roles) is enforced **only for Viewer** — Contributor+ already has blanket view/modify access that supersedes it. Apps distribute packaged content to audiences; they never grant workspace or item access.

---

## The Who-Bypasses-What Matrix (crown jewel)

Every granular control layer has its own independent bypass rule — mixing them up is the #1 scenario trap.

| Mechanism | Viewer | Contributor | Member | Admin | Why |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Semantic model DAX RLS | ==filtered== | sees all | sees all | sees all | DAX RLS binds only at Viewer; higher roles' blanket access supersedes it |
| Warehouse T-SQL RLS | ==filtered== | ==filtered== | ==filtered== | ==filtered== | Filter predicates apply to **every** principal, including `dbo`/`db_owner` — no role exemption |
| Warehouse DDM | ==masked== | sees all | sees all | sees all | Admin/Member/Contributor carry implicit `CONTROL`, which bundles `UNMASK` |
| OneLake security data access roles | ==filtered== | sees all | sees all | sees all | Implicit workspace **Write** overrides a OneLake security Read restriction |

> [!note] Mental model — bypass logic
> Three different rules, three different answers. **SQL-layer RLS ignores `CONTROL` entirely** — even `db_owner` gets filtered. **DDM and OneLake security both honor implicit role permissions** (`CONTROL` / **Write**) — Contributor+ sails through both. **DAX RLS only binds at Viewer** — a higher role simply outranks it.

**Worked scenario:** A Warehouse table has T-SQL RLS (region filter) + DDM on `Commission`. A Contributor with no explicit `UNMASK` queries it → sees **only their region's rows** (RLS still filters — no bypass), but `Commission` is **unmasked** (implicit `CONTROL` bypasses DDM). RLS and DDM are evaluated completely independently.

---

## Granular Access Controls (SQL endpoint only)

| Control | Syntax | Blocks or masks? | Scope |
| :--- | :--- | :--- | :--- |
| RLS | `CREATE SECURITY POLICY ... ADD FILTER PREDICATE fn(col) ON table` | Blocks rows (silent filter) | SQL endpoint/Warehouse only |
| CLS | `GRANT SELECT ON table(col1, col2)` | Blocks columns (hard error on `SELECT *`) | SQL endpoint/Warehouse only; Entra auth only |
| OLS | Standard `GRANT`/`REVOKE`/`DENY` | Blocks objects | SQL endpoint/Warehouse only |
| DDM | `MASKED WITH (FUNCTION = '...')` | ==Masks values, does NOT block access== | SQL endpoint/Warehouse only |

- ==Fabric Warehouse RLS supports FILTER predicates only== — no BLOCK predicate type (that's SQL Server/Azure SQL only). A "block predicate" option in a Fabric scenario is a distractor.
- To modify an RLS predicate function: **drop policy → alter function → recreate policy** (schema-bound policy blocks direct `ALTER FUNCTION`).
- CLS: missing column → **hard permission error**, not a silently dropped column.
- OLS: `DENY` always overrides `GRANT` (even via role); `REVOKE` just erases a grant/deny entry, it doesn't itself block.
- None of RLS/CLS/OLS reach Spark or OneLake API callers — that requires a **OneLake data access role**.

### Decision: Which Layer?

| Need | Layer |
| :--- | :--- |
| Filter rows for SQL clients / DirectQuery | RLS (SQL endpoint) |
| Block a column for some SQL users | CLS (SQL endpoint) |
| Block whole tables/schemas | OLS (SQL endpoint) |
| Restrict Spark/OneLake API readers | OneLake data access role |
| One definition enforced across Spark + SQL endpoint + Direct Lake | OneLake security role w/ RLS/CLS |
| Restrict Power BI report viewers regardless of underlying storage | Semantic model RLS (DAX) |
| Obscure PII without blocking access | DDM |

---

## OneLake Security

Deny-by-default. Supported items: ==Lakehouse== (Read, ReadWrite), Azure Databricks Mirrored Catalog (Read), Mirrored Database (Read). **Warehouse is NOT supported** — it uses T-SQL RLS/CLS/OLS instead.

- **`DefaultReader`** — auto-created, **virtual membership** = anyone with item `ReadAll`. Adding a user to a narrow custom role does nothing if they're still in `DefaultReader` — delete/restrict it to actually narrow access.
- Table access **unions** across multiple roles (any role granting access = access). RLS/CLS **intersect** within a role — except SQL-endpoint CLS, which intersects **across all** a user's roles (deny-wins semantics).
- `ReadWrite` roles **cannot** carry RLS/CLS — write access is incompatible with hiding rows/columns in the same role.
- Admin/Member/Contributor's implicit **Write** always includes Read → OneLake security Read restrictions have **zero effect** on those three roles. Only Viewer is meaningfully restricted.
- Limits: max **250** roles/item (1,000 via support), **500** members/role, **500** permissions/role. Role definition changes ~5 min to propagate; group membership changes up to ~1 hour.

### Shortcuts — Permission Delegation

| Shortcut type | Identity evaluated | Notes |
| :--- | :--- | :--- |
| Passthrough (internal, SSO) | ==Querying user's own identity==, at the target | Can't define OneLake security on the shortcut itself — only on the target |
| Direct Lake over **SQL** / T-SQL **Delegated** mode | Item owner's identity | Per-user OneLake security is silently bypassed — switch to Direct Lake over OneLake or T-SQL User's identity mode |
| Delegated (ADLS/S3/Dataverse) | Both connection auth (creator) **and** requester's OneLake security | Requester also needs Fabric Read on the shortcut's containing item |

### GA / Preview by Engine (as of July 2026)

| Engine | Status |
| :--- | :--- |
| Lakehouse browsing, Spark notebooks, SQL endpoint (User's identity mode), Direct Lake on OneLake mode | ==GA== |
| Eventhouse (RLS only, no CLS) | Preview |
| Authorized third-party engines | Preview |

---

## Dynamic Data Masking (DDM)

| Function | Effect | Example |
| :--- | :--- | :--- |
| ==default()== | Type-based full mask (strings→`XXXX`, numerics→`0`, dates→`1900-01-01`) | |
| ==email()== | `aXXX@XXXX.com` shape | |
| ==random(m,n)== | Random numeric in range | numeric only |
| ==partial(prefix,"pad",suffix)== | Custom partial reveal | `partial(0,"XXX-XX-",4)` → `XXX-XX-6789` |

- Fabric ships **only these 4** — no `datetime()` (that's an on-prem SQL Server extra). Date columns use `default()`.
- Reveal unmasked: `UNMASK` on the column, or `CONTROL` on the database.
- ==Admin/Member/Contributor carry implicit `CONTROL`== → see unmasked data with **no explicit `GRANT UNMASK`**. Differs from on-prem SQL Server mental model (only `db_owner`/`sysadmin` bypass there).
- **DDM ≠ encryption.** Masks are display-only; `WHERE` clauses still evaluate against real stored values, so range/equality queries let a user infer masked values row-by-row. DDM guards against accidental exposure only — pair with RLS/CLS/OLS for real protection.
- No OneLake-security equivalent — a Spark notebook reading the same Delta table directly sees real values regardless of Warehouse-side DDM.

---

## Governance

### Sensitivity Labels

| Direction | Supported? |
| :--- | :---: |
| Fabric → Fabric | ✅ |
| Fabric → Power BI | ✅ |
| ==Power BI → Fabric== | ❌ |

Domain-level default label (if tenant feature enabled) overrides the tenant-wide default within that domain's scope. Export carries the label only via: Excel/PDF/PowerPoint export, Analyze in Excel, PivotTable in Excel (E3+), download to `.pbix`. `.csv`/`.txt` export does **not** carry the label.

### Endorsement Tiers

| Tier | Who can apply |
| :--- | :--- |
| Promoted | Any item owner / write-permission holder |
| Certified | Only tenant-admin-authorized reviewers (+ write permission) |
| Master data | Only authorized reviewers (+ write permission); data items only |

Write permission alone is **never** sufficient for Certified/Master data — the option is greyed out without admin authorization.

### Audit Logs

- Recorded in the M365 **unified audit log**, viewed/searched via **Microsoft Purview portal** or `Search-UnifiedAuditLog`.
- Power BI/Fabric events require auditing enabled in the **Power BI admin portal** first — not automatic.
- Retention: ==180 days== (non-E5) / **1 year** (E5) / up to **10 years** (retention add-on). Entra ID/Exchange/SharePoint always default to 1 year. (Not the outdated 90-day figure — changed Oct 2023.)
- Restricted admins (assigned administrative units) see only in-scope activity; some record types (AIP Discover, some Exchange/Dynamics 365 ops) are visible **only to unrestricted admins**.

---

## Gotchas & Traps

- Removing an item-level share does **not** revoke access if the user still holds a Contributor+ workspace role — check both layers when auditing or removing access.
- RLS ignores `CONTROL`; DDM and OneLake security both honor it. Don't assume one control's bypass rule applies to another.
- `DefaultReader`'s virtual membership silently defeats a new restrictive OneLake security role unless it's deleted or the user's ReadAll is removed.
- Direct Lake over **SQL** and T-SQL **Delegated** mode evaluate shortcuts using the item owner's identity, not the viewer's — per-user row security silently breaks unless you're on OneLake mode / User's identity mode.
- DDM range/equality queries still leak values via inference — masking a column is not a substitute for RLS/CLS/OLS.
- Sensitivity labels never flow Power BI → Fabric — only Fabric → Fabric and Fabric → Power BI.
- Certified/Master data require tenant-admin authorization on top of write permission — write permission alone never unlocks them.
- A flat "90-day" audit retention figure is stale; current defaults are 180 days / 1 year / up to 10 years.

## Before the Exam, I Can…

- [ ] State which of the 4 workspace roles gets ReadData vs. ReadAll, and explain why Viewer is different
- [ ] Explain why a Contributor still can't configure a gateway refresh
- [ ] Recite the Who-Bypasses-What matrix from memory for RLS (SQL), DDM, OneLake security, and DAX RLS
- [ ] Write the RLS drop→alter→recreate sequence and explain why direct `ALTER FUNCTION` fails
- [ ] Name all 4 DDM mask functions and explain why DDM is not encryption
- [ ] Explain `DefaultReader` virtual membership and why deleting it is often required to restrict access
- [ ] Trace shortcut permission delegation for passthrough vs. Direct Lake over SQL vs. delegated (external) shortcuts
- [ ] State the one unsupported sensitivity label inheritance direction and the three endorsement tiers with their authorization requirements
- [ ] Recall current audit log retention defaults by license tier

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
