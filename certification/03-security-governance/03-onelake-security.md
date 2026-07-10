---
title: OneLake Security
type: topic
tags:
  - dp-700
  - fabric
  - onelake
  - security
  - data-access-roles
  - security-governance
---

# OneLake Security

## Overview

**OneLake security** applies role-based access control directly to tables and folders in OneLake, independent of the SQL analytics endpoint's T-SQL security surface. It's the mechanism that lets Spark notebooks, OneLake APIs, Lakehouse explorer, and (optionally) the SQL analytics endpoint all enforce the *same* row/column/table restrictions from a single definition. This topic covers data access roles, the `DefaultReader` default role, folder scoping, how OneLake security interacts with workspace roles, item permissions, and shortcuts, and the current GA/preview status of each capability — verified against Microsoft Learn as of **July 2026**.

> [!abstract]
>
> - OneLake security is **deny-by-default**: a user gets zero data access in an item unless a role explicitly grants it
> - **DefaultReader** is an auto-created role using *virtual membership* — every user with the item's `ReadAll` permission is implicitly a member, until you delete the role or restrict it
> - Supported today: **Lakehouse** (Read, ReadWrite), **Azure Databricks Mirrored Catalog** (Read), **Mirrored Database** (Read) — Warehouse is **not** a OneLake-security-managed item type
> - OneLake security roles can carry their **own** RLS/CLS on top of table-level grants — enforced identically across every engine that supports OneLake security filtering
> - **Shortcuts delegate permission evaluation to the target**: a passthrough shortcut re-checks the querying user's OneLake security access at the shortcut's *target* location, not the shortcut item itself

> [!tip] What the Exam Tests
>
> - `DefaultReader` semantics — who's a member, and why adding a user to a custom role without removing them from `DefaultReader` leaves them with full access anyway
> - How workspace roles interact with OneLake security: Admin/Member/Contributor's implicit Write permission **overrides** any OneLake security Read restriction
> - Permission delegation through shortcuts — whose identity and whose OneLake security role actually gets evaluated
> - Current GA/preview status per engine (Lakehouse, Spark, SQL analytics endpoint, Direct Lake, Eventhouse, third-party engines) — this area has moved fast; know what's GA vs. preview **as of the exam's July 21, 2026 blueprint**

---

## Data Access Roles

A OneLake security role is made of four parts:

- **Type** — only `GRANT` roles are currently supported (no `DENY` role type)
- **Permission** — `Read` or `ReadWrite` (ReadWrite is only meaningful for Viewers/Read-permission users; it's a no-op for Admin/Member/Contributor, who already have Write implicitly)
- **Scope** — the tables/folders the role applies to (all data, or a selected subset)
- **Members** — Microsoft Entra users, groups, or non-user identities

| Fabric item | Supported permissions |
| :--- | :--- |
| ==Lakehouse== | Read, ReadWrite |
| Azure Databricks Mirrored Catalog | Read |
| Mirrored Database | Read |

Warehouse is conspicuously **absent** from this list — Warehouse and SQL analytics endpoint granular security uses T-SQL RLS/CLS/OLS instead (see [02-Granular Access Controls](./02-granular-access-controls.md)).

### `DefaultReader` and Other Default Roles

Every new supported item is created with default roles so privileged users retain a working baseline of access. Most items get a `DefaultReader` role built with **virtual membership** — its members are computed dynamically from item permissions, not manually assigned:

| Fabric item | Role name | Permission | Scope | Assigned members |
| :--- | :--- | :--- | :--- | :--- |
| Lakehouse | `DefaultReader` | Read | All folders under `Tables/` and `Files/` | All users with **ReadAll** permission |
| Lakehouse | `DefaultReadWriter` | Read | All folders | All users with **Write** permission |
| Azure Databricks Mirrored Catalog | `DefaultReader` | Read | `Tables/` and `Files/` | All users with **Read** permission |
| Mirrored Database | `DefaultReader` | Read | `Tables/` and `Files/` | All users with **ReadAll** permission |

> [!warning] Common Mistake
> **Adding a user to a custom, restricted OneLake security role does not restrict them if they're still a member of `DefaultReader`.** Because `DefaultReader`'s membership is virtual (anyone with ReadAll), a user keeps full unrestricted read access through that role regardless of what a new custom role says. To actually restrict a user to specific folders, you must either delete `DefaultReader` or remove the underlying permission (ReadAll) that puts them in it.

### Creating a Custom Role

Role creation happens through the item's **Manage OneLake security** UX (Fabric Write or Reshare permission required — generally Admin/Member workspace users):

1. Name the role (alphanumeric, starts with a letter, case-insensitive, unique, ≤128 characters).
2. Choose **Grant** as the role type, and select **Read** (and optionally **ReadWrite**, for supported item types).
3. Scope the role: **All data**, or **Selected data** — pick specific tables and folders.
4. For any selected table, optionally attach **row-level** or **column-level security** (see below).
5. Add members: manually by name/email, or via **virtual membership** (assign anyone holding a chosen combination of Fabric item permissions — Read, Write, Reshare, Execute, ReadAll).
6. Save — role creation and membership changes take effect immediately (role **definition** changes take ~5 minutes to propagate; **group membership** changes to a role can take up to an hour, plus additional engine-specific caching delay).

```text
Maximum OneLake security roles per item:      250 (increasable to 1,000 via support request)
Maximum members per role:                     500 users or groups
Maximum permissions per role:                 500
```

**Practice Question 1** *(Medium)*

A Lakehouse admin creates a new OneLake security role, `FinanceReader`, scoped to only the `Finance/` folder, and adds `alice@contoso.com` as a member. Alice still sees data outside `Finance/` when browsing the Lakehouse. What is the most likely cause?

A. The role definition hasn't propagated yet (wait 5 minutes)  
B. Alice is also a member of the `DefaultReader` role via her ReadAll permission  
C. OneLake security roles can't scope to a single folder  
D. Alice needs the ReadWrite permission, not Read, to see folder-scoped data  

> [!success]- Answer
> **B. Alice is also a member of the `DefaultReader` role via her ReadAll permission**
>
> Because OneLake security roles are additive (UNION), and `DefaultReader` grants Read across all folders under `Tables/` and `Files/` to anyone with ReadAll, Alice keeps that broader access even after being added to a narrower custom role. To actually restrict her, `DefaultReader` needs to be deleted or its underlying ReadAll access removed for her.

---

## Row-Level and Column-Level Security Within a Role

A OneLake security role can carry RLS and CLS on any table in its scope, defined at role-creation/edit time via the table's **Data access** option:

- **RLS** — a SQL predicate that shows rows where the predicate evaluates `true`. String comparisons are case-insensitive (`Latin1_General_100_CI_AS_KS_WS_SC_UTF8` collation) — avoid string-equality predicates on data with inconsistent casing/accents; prefer integer comparisons.
- **CLS** — hides (removes) specific columns; a hidden column behaves as having no permission at all, so queries touching it return no data for that column. In the SQL analytics endpoint specifically, CLS operates by **deny/intersection** semantics rather than union — see multi-role evaluation below.
- **ReadWrite roles cannot carry RLS or CLS constraints** — write access requires seeing (and being able to modify) the full row/column set.

### Evaluating Multiple Roles

A user can belong to several OneLake security roles simultaneously. Table/folder-level access **unions** (least-restrictive: any role granting access to TableA means the user can see TableA). But *within* a single role, RLS/CLS/OLS-equivalent constraints **intersect**:

```text
Effective role = ( (R1_tables ∩ R1_cls ∩ R1_rls) ∪ (R2_tables ∩ R2_cls ∩ R2_rls) )
```

Except CLS specifically on the **SQL analytics endpoint**, which intersects across all of a user's roles instead of unioning — a `DENY`-equivalent semantic where being blocked from a column in *any* role the user belongs to blocks it everywhere, even if another role would have granted it.

> [!note] Mental model — Tables union, restrictions intersect (except SQL-endpoint CLS)
> Think of each role as a separately-issued visitor badge. Holding badge A *or* badge B gets you into any room either badge unlocks (union, at the table level) — more badges means more rooms. But within a single badge, what you can do once inside — which rows, which columns — is exactly what that badge says, no more (intersection). The one twist: on the SQL analytics endpoint, a column blocked by *any one* badge stays blocked no matter how many other badges would have let you see it.

---

## Table-Level Security and Metadata

Not every folder under `Tables/` is treated as a securable "table" by OneLake security and Fabric query engines. To qualify, a folder must:

- Live in the `Tables/` directory of the item (or a valid schema folder, for schema-enabled items)
- Contain a `_delta_log` folder with valid Delta metadata JSON files
- Contain **no child shortcuts**

Any folder failing these checks is denied access outright if table-level security is configured on it — it simply doesn't resolve as a securable table.

**Metadata security** has a narrower guarantee than data security: OneLake security's Read permission grants both data and metadata access together, and a user with **no** access sees neither. However, OneLake security does **not** guarantee that column *names* stay fully hidden in every surface — some error messages and tooling experiences may still reveal a column's name even when its data is inaccessible.

### `ReadWrite` Permission

`ReadWrite` extends `Read` with the ability to modify data — but only for **Viewer**-tier or Read-permission users; it's a no-op for Admin/Member/Contributor, who already have Write implicitly through their workspace role.

- Includes all `Read` privileges, plus: create/delete/rename a folder or table, upload/edit a file, create/delete/rename a shortcut
- Enabled through Spark notebooks, the OneLake file explorer, or OneLake APIs — **not** through the Lakehouse UX's viewer-facing surface (write operations there still require Contributor+)
- ==A `ReadWrite` role cannot carry RLS or CLS constraints== — granting someone the ability to modify a table is incompatible with also hiding rows/columns from them within that same role
- Because Fabric only supports single-engine writes to a given piece of data, a `ReadWrite` grant lets a user write **only through OneLake** — but read access is enforced consistently by every engine

> [!warning] Common Mistake
> A scenario describing "grant `ReadWrite` with row-level security so the analyst can edit only their region's rows" is describing an **unsupported** configuration. `ReadWrite` roles categorically cannot combine with RLS or CLS — if partial-write access with row restriction is genuinely required, the write path needs to go through a governed pipeline/notebook process instead of a direct OneLake security role.

---

## OneLake Security and Workspace Permissions

Workspace roles are the **first** security boundary — OneLake security layers on top, and workspace roles can **override** it:

| Permission | Admin | Member | Contributor | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| View files in OneLake | Always ✅ | Always ✅ | Always ✅ | No by default — use OneLake security |
| Write files in OneLake | Always ✅ | Always ✅ | Always ✅ | No by default — use OneLake security |
| Can edit OneLake security roles | Always ✅ | Always ✅ | ❌ | ❌ |

> [!warning] Common Mistake
> Because Admin, Member, and Contributor all get **implicit Write** to OneLake, and Write always includes Read, **OneLake security Read restrictions have zero effect on those three roles**. A scenario describing "the Contributor still sees data they were supposedly restricted from via a OneLake security role" isn't a bug — restricting Admin/Member/Contributor via OneLake security **doesn't work**; only Viewer's default-no-access baseline is meaningfully shaped by OneLake security roles.

## OneLake Security and Item Permissions

| Item permission | View files in OneLake | Write files in OneLake | Read via SQL analytics endpoint |
| :--- | :---: | :---: | :---: |
| Read | No by default — use OneLake security | No | No |
| ReadAll | Yes, via DefaultReader (restrictable) | No | Depends on SQL analytics endpoint mode |
| Write | Yes | Yes | Yes |
| Execute, Reshare, ViewOutput, ViewLogs | N/A — can't be granted standalone | N/A | N/A |

## Enabling OneLake Security for the SQL Analytics Endpoint

By default, a SQL analytics endpoint uses a **delegated identity** to evaluate access — OneLake security roles have no effect until you switch it to **User's identity access mode**, a one-time setting per endpoint:

1. Open the Lakehouse's SQL analytics endpoint → **Security** tab.
2. **View data access mode** → **Data access mode settings**.
3. Select **Use OneLake security for tables (User's identity access mode)** → **Apply** → **Continue**.

Once enabled, RLS/CLS/table filtering defined in OneLake security roles is enforced for that endpoint's SQL queries too — this is the GA path referenced in the engine-support table below.

---

## Shortcuts: Permission Delegation

Shortcuts have two authentication modes, and OneLake security behaves differently for each:

### Passthrough shortcuts (SSO)

The **querying user's own identity** is evaluated against the shortcut's target. When a user reads through an internal shortcut to another OneLake location, they need OneLake security permission **at the target**, not the shortcut item itself — you **cannot** define OneLake security directly on an internal shortcut; security must live on the target folder in the target item.

> [!warning] Common Mistake
> **Power BI semantic models using Direct Lake over *SQL*** and **T-SQL in *Delegated* identity mode** do **not** pass the calling user's identity through a shortcut — they delegate to the *item owner's* identity instead. If a scenario requires per-user OneLake security enforcement through a shortcut, the fix is switching to **Direct Lake over OneLake mode** or **T-SQL User's identity mode** — delegated modes silently bypass per-user shortcut security.

If the shortcut's target item type doesn't support OneLake security at all, access falls back to whether the user has Fabric **ReadAll** on the target item — and notably, **the user doesn't need Fabric Read permission on the target item itself** to use the shortcut.

### Delegated shortcuts (ADLS, S3, Dataverse)

Access requires **both** the delegated connection's own authorization for the shortcut creator **and** the requesting user's OneLake security grant:

| Delegated connection authorizes creator? | OneLake security authorizes requester? | Requester gets access? |
| :---: | :---: | :---: |
| Yes | Yes | ✅ |
| Yes | No | ❌ |
| No | Yes | ❌ |
| No | No | ❌ |

Unlike passthrough shortcuts, a user accessing a delegated (external) shortcut **does** need Fabric Read permission on the item where the shortcut resides, to securely resolve the external connection.

### Shortcut Listing vs. Access

Listing a directory always shows internal shortcuts regardless of the user's access to the target — the **access check** only happens when the user tries to open the shortcut, at which point target permissions apply. Nested shortcuts (a shortcut pointing at another shortcut) still ultimately require access to the *original* external target.

**Practice Question 2** *(Hard)*

A Power BI report uses Direct Lake over SQL against a Warehouse whose data includes a shortcut into a separately-secured Lakehouse. OneLake security on that Lakehouse restricts most users to a subset of rows. Report viewers report seeing rows they shouldn't have access to. What's the most likely cause?

A. OneLake security roles don't support row-level security through shortcuts  
B. Direct Lake over SQL delegates to the item owner's identity rather than passing through each viewer's identity  
C. The Lakehouse's DefaultReader role was never deleted  
D. Shortcuts always bypass OneLake security by design  

> [!success]- Answer
> **B. Direct Lake over SQL delegates to the item owner's identity rather than passing through each viewer's identity**
>
> Direct Lake over SQL and T-SQL Delegated identity mode both evaluate shortcut access using the calling *item's owner* identity, not the individual report viewer's identity — so every viewer effectively inherits the owner's (likely broader) access. Switching the semantic model to Direct Lake over OneLake mode restores per-viewer identity pass-through and correct enforcement.

---

## GA / Preview Status by Engine (as of July 2026)

| Engine | RLS/CLS filtering | Status |
| :--- | :--- | :--- |
| Lakehouse (browsing/explorer) | Yes | ==GA== |
| Spark notebooks | Yes | ==GA== |
| SQL analytics endpoint, User's identity access mode | Yes | ==GA== |
| Semantic models, Direct Lake on **OneLake** mode | Yes | ==GA== |
| Eventhouse | RLS only (no CLS) | Preview |
| Authorized third-party engines (via OneLake authorized engine APIs) | Yes, if implemented by the engine | Preview |

> [!note]
> This table reflects Microsoft Learn's OneLake security documentation as last verified in **July 2026**. Given how quickly this surface has evolved through 2026, re-check the [official access control model doc](https://learn.microsoft.com/en-us/fabric/onelake/security/data-access-control-model) before relying on GA/preview status in a real deployment decision.

## Limitations

- B2B guest users need **Guest users have the same access as members** enabled in Entra External ID collaboration settings before they can be assigned a OneLake security role.
- Distribution lists added to a role aren't resolvable by the SQL analytics endpoint (or Direct Lake on SQL) — those users appear as non-members there even though they're in the list.
- Data preview for RLS/CLS-secured tables isn't supported on non-schema-enabled Lakehouses — use schema-enabled Lakehouses with OneLake security.
- OneLake security doesn't work with Azure Data Share or Purview Data Share.

## Use Cases

- Enforcing one row-level restriction definition that Spark, the SQL analytics endpoint, and Direct Lake all honor identically, instead of three separate definitions
- Restricting Viewer-role users to specific folders in a Lakehouse while leaving Admin/Member/Contributor unaffected
- Granting a downstream workspace read access to a shortcut's source data without duplicating the underlying files
- Delegating fine-grained OneLake access to specific security groups via virtual membership tied to Fabric item permissions

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| A user in a restricted custom role still sees everything | They remain a member of `DefaultReader` via ReadAll permission | Delete `DefaultReader` or remove the user's ReadAll permission |
| Restricting Admin/Member/Contributor via OneLake security has no effect | Those roles carry implicit Write, which always includes Read | OneLake security can only meaningfully restrict Viewer-tier access |
| SQL analytics endpoint ignores a OneLake security role | Endpoint is still in default delegated identity mode | Switch to **User's identity access mode** in the endpoint's Security settings |
| Per-user restriction not enforced through a shortcut in a Power BI report | Direct Lake over SQL / Delegated T-SQL mode delegates to item owner identity | Use Direct Lake over OneLake mode or T-SQL User's identity mode |
| Role changes seem to take effect slowly | Group membership propagation can take up to an hour, plus engine caching | Expected latency — role definition changes take ~5 minutes, group membership up to ~1 hour |

## Best Practices

- Delete or restrict `DefaultReader` deliberately as soon as you create a custom role meant to narrow access — leaving it in place silently defeats the new role
- Use schema-enabled Lakehouses when planning to rely on OneLake security's RLS/CLS preview capabilities
- Prefer virtual membership (permission-group-based) over manual member lists for roles that should track Fabric item permission changes automatically
- Enable User's identity access mode on the SQL analytics endpoint early if OneLake security consistency across engines is a requirement, not an afterthought

## Exam Tips

> [!tip] Exam Tips
>
> - `DefaultReader` uses virtual membership (anyone with ReadAll) — must be deleted/restricted to actually narrow access
> - Admin/Member/Contributor's implicit Write overrides any OneLake security Read restriction; only Viewer is meaningfully restricted by it
> - Only Lakehouse, Azure Databricks Mirrored Catalog, and Mirrored Database support OneLake security roles — **not** Warehouse
> - Passthrough shortcuts pass the querying user's identity to the target (needs target OneLake security access); delegated modes (Direct Lake over SQL, T-SQL Delegated identity) pass the item owner's identity instead
> - Table access unions across multiple roles; RLS/CLS intersect within a role — except SQL-endpoint CLS, which intersects across all of a user's roles

## Key Takeaways

- OneLake security is deny-by-default RBAC on OneLake tables/folders, supported today for Lakehouse, Azure Databricks Mirrored Catalog, and Mirrored Database only
- `DefaultReader`'s virtual membership is the most common cause of "restriction didn't work" — check it first
- Workspace role Write (Admin/Member/Contributor) always overrides OneLake security Read restrictions
- Shortcut permission delegation depends on the querying engine's identity mode — passthrough vs. delegated modes behave very differently
- GA status varies by engine as of July 2026: Lakehouse/Spark/SQL endpoint (user identity)/Direct Lake OneLake mode are GA; Eventhouse RLS and third-party engine enforcement are preview

## Related Topics

- [01-Workspace & Item Access](./01-workspace-item-access.md)
- [02-Granular Access Controls](./02-granular-access-controls.md)

## Official Documentation

- [Get started with OneLake security](https://learn.microsoft.com/en-us/fabric/onelake/security/get-started-onelake-security)
- [OneLake security access control model](https://learn.microsoft.com/en-us/fabric/onelake/security/data-access-control-model)
- [Create and manage OneLake security roles](https://learn.microsoft.com/en-us/fabric/onelake/security/create-manage-roles)
- [Permission model in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/security/permission-model)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-granular-access-controls.md) | [↑ Back to Section](./security-governance.md) | [Next →](./04-dynamic-data-masking.md)**
