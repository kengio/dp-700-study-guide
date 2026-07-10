---
title: Workspace & Item Access
type: topic
tags:
  - dp-700
  - fabric
  - security
  - workspace-roles
  - permissions
  - security-governance
---

# Workspace & Item Access

## Overview

Microsoft Fabric layers two independent access mechanisms: **workspace roles** (Admin/Member/Contributor/Viewer) grant broad, workspace-wide capabilities, while **item permissions** grant fine-grained access to a single item regardless of workspace role. This topic covers the full workspace-role capability matrix, how item sharing and reshare work, how SQL analytics endpoint access is governed separately from OneLake file access, and how Power BI apps distribute content differently from direct sharing.

> [!abstract]
>
> - Four workspace roles — **Admin, Member, Contributor, Viewer** — each additive: Admin ⊃ Member ⊃ Contributor ⊃ Viewer for nearly every capability
> - **Item permissions** (Read, ReadAll, Write, Reshare, Execute, ViewOutput, ViewLogs) apply to a single item, independent of workspace role, and layer on top of it
> - **SQL analytics endpoint access has two tiers**: all four workspace roles can connect and read via the TDS endpoint (T-SQL), but only Admin/Member/Contributor get `ReadAll` access via OneLake APIs/Spark — Viewer does not by default
> - **Power BI apps** distribute curated content to defined audiences without granting workspace or item access — a separate distribution layer from direct sharing

> [!tip] What the Exam Tests
>
> - Exact capability differences between the four workspace roles, especially what Viewer can and cannot do
> - How item sharing interacts with workspace roles (does removing item permission actually block access?)
> - Which roles can read data through the SQL analytics endpoint (TDS/T-SQL) vs. through OneLake APIs/Spark (ReadAll)
> - The distinction between distributing content via a Power BI app (audience-scoped) and sharing an item directly (grants item permission)

---

## Workspace Roles

Workspace roles are assigned to individuals, security groups, Microsoft 365 groups, distribution lists, or Microsoft Entra ID service principals. A user in multiple groups gets the **highest** permission level across all their group memberships.

| Capability | Admin | Member | Contributor | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| Update and delete the workspace | ✅ | | | |
| Add or remove people, including other admins | ✅ | | | |
| Add members or others with lower permissions | ✅ | ✅ | | |
| Allow others to reshare items¹ | ✅ | ✅ | | |
| Create or modify database items (Warehouse, mirroring) | ✅ | ✅ | ✅ | |
| Create workspace identity | ✅ | | | |
| Connect workspace to a Git repository | ✅ | | | |
| View and read pipelines, notebooks, Spark job definitions, ML items, eventstreams | ✅ | ✅ | ✅ | ✅ |
| ==Connect to SQL analytics endpoint of Lakehouse or Warehouse== | ✅ | ✅ | ✅ | ✅ |
| Read Lakehouse/Warehouse data via T-SQL through the TDS endpoint (**ReadData**) | ✅ | ✅ | ✅ | ✅ |
| Read Lakehouse/Warehouse data via OneLake APIs and Spark (**ReadAll**) | ✅ | ✅ | ✅ | |
| Read Lakehouse data through Lakehouse explorer (ReadAll) | ✅ | ✅ | ✅ | |
| Subscribe to OneLake events | ✅ | ✅ | ✅ | |
| Write or delete pipelines, notebooks, Spark job definitions, ML items | ✅ | ✅ | ✅ | |
| Write/delete schema and data of Lakehouses, Warehouses, and shortcuts | ✅ | ✅ | ✅ | |
| Execute or cancel pipelines, notebooks, Spark job definitions | ✅ | ✅ | ✅ | |
| View execution output of pipelines, notebooks, ML items | ✅ | ✅ | ✅ | ✅ |
| Schedule data refreshes / modify gateway connection settings² | ✅ | ✅ | ✅ | |

¹ Contributors and Viewers can also reshare items if they've been individually granted Reshare permission on that item.
² Requires separate gateway-level permissions, managed outside of workspace roles.

> [!note]
> Workspace creators are automatically assigned the Admin role. Each workspace supports a maximum of **1,000 users or groups** in workspace roles (a group's internal membership isn't counted against this limit).

**Practice Question 1** *(Easy)*

A user has the Viewer role in a workspace. They open a Lakehouse's SQL analytics endpoint and run a `SELECT` query via a T-SQL client. What happens?

A. The query fails — Viewers can't connect to the SQL analytics endpoint  
B. The query succeeds — Viewer includes ReadData (TDS/T-SQL) access by default  
C. The query succeeds only if the Viewer also has the Contributor role in another workspace  
D. The query fails because Viewers only have ReadAll, not ReadData  

> [!success]- Answer
> **B. The query succeeds — Viewer includes ReadData (TDS/T-SQL) access by default**
>
> All four workspace roles, including Viewer, can connect to the SQL analytics endpoint and read data through the TDS endpoint (ReadData). What Viewer lacks by default is **ReadAll** — read access via OneLake APIs and Spark, and Lakehouse explorer browsing. This ReadData/ReadAll split is one of the most exam-relevant facts in this topic.

---

## Assigning Roles

Workspace access is granted from the workspace's **Manage access** panel (Admin/Member only): search for a user, security group, mail-enabled security group, distribution list, or Microsoft 365 group, then pick a role. A user in several groups always gets the **highest** role across all memberships — there's no way to "cap" a user's effective access below what any single group grants them.

A few assignment rules worth knowing precisely:

- **Members can only add others at Member level or below** (Member, Contributor, Viewer) — only an Admin can grant or remove the Admin role.
- Access changes take effect the **next time the affected user logs into Fabric** — not instantly for an already-open session.
- **Microsoft Entra ID service principals** (app registrations) can be assigned workspace roles exactly like users, inheriting the same permissions for API-driven operations (Items REST API, Job Scheduler API) — this is the standard pattern for CI/CD pipelines and unattended automation.
- To enforce **row-level security (RLS)** on Power BI items for Fabric Pro users browsing a workspace, they must specifically hold the **Viewer** role — a higher role (Contributor+) sees unfiltered data regardless of any RLS defined on the underlying semantic model, since higher roles can already view/modify all workspace content.

> [!warning] Common Mistake
> Assigning a Pro user **Contributor** (instead of Viewer) to a workspace containing an RLS-protected semantic model defeats the RLS — Contributor's blanket "view and modify all content" capability overrides any row filtering intended for report consumers. If a scenario asks how to make RLS actually apply to workspace browsers, the answer is always **Viewer**, never a higher role.

### Gateway Permissions Are Separate

Scheduling refreshes through an **on-premises data gateway**, or modifying a gateway's connection settings, requires Admin/Member/Contributor in the workspace **plus** a matching permission on the gateway itself — gateway access is managed independently, outside the Fabric workspace-role system entirely (typically by whoever administers the gateway cluster). A user can hold Contributor in every relevant workspace and still be unable to configure a refresh schedule if they were never granted the corresponding gateway permission.

### Worked Example — Assigning a Data Team

A department has a manager, a team lead, several team members, and a shared analyst pulling data from all department workspaces. A workable role layout:

| Role in org | Requirement | Workspace role setup |
| :--- | :--- | :--- |
| Manager | View/modify all department content across regions | Member on every regional workspace |
| Team lead | View/modify all content for one region only | Member on that region's workspace |
| Team member | View only their own figures; edit their own report | No workspace role; item-level share on their specific report, with RLS on the underlying semantic model scoping it further |
| Cross-department analyst | Read-only visibility across every workspace, no edit rights | Viewer on every relevant workspace |

Layering RLS on a shared semantic model (e.g., quarterly figures per team member) on top of this role structure lets each team member see only their own rows even though they're accessing the *same* report as their teammates — role assignment controls *whether* they can reach the workspace/item at all, and RLS controls *what* they see once there.

---

## Item-Level Permissions and Sharing

Item permissions apply to a **single item**, independent of the item's workspace role assignments. Fabric defines these item permissions:

| Permission | Grants |
| :--- | :--- |
| ==Read== | View item metadata and any associated reports; does **not** grant access to underlying data in OneLake or SQL |
| ==ReadAll== | Read underlying data via OneLake APIs, Spark, and Lakehouse explorer (subject to the item's DefaultReader OneLake security role) |
| ==Write== | Full read/write on the item's data and definition, including through the SQL analytics endpoint |
| Reshare | Lets the grantee share the item further with others — can't be granted standalone; layers on Read/Write |
| Execute | Run/trigger the item (e.g., a pipeline or notebook) — can't be granted standalone |
| ViewOutput / ViewLogs | See execution output/logs of runs — can't be granted standalone |

Sharing an item with a user grants **Read** by default; the sharer chooses whether to add further permissions (Write, Reshare, and so on) during the share flow. Item permissions and workspace roles are **evaluated independently** — an item can be shared with someone who has no role at all in the containing workspace, and conversely, a workspace role can grant access that item-level sharing alone wouldn't.

> [!warning] Common Mistake
> Removing someone's **item** permission does not fully revoke their access if they still hold a **workspace** role that covers that item (Contributor+ sees all workspace content by default). To fully block a specific user from a report they can currently see via workspace access, you must remove their **workspace role** too — item-level removal alone leaves them able to browse to it from inside the workspace.

> [!note] Mental model — Two independent doors
> Think of workspace role and item permission as two separate doors into the same room, not a hierarchy. Workspace role is the front door to the whole building (the workspace) — Contributor+ walks straight into every room. Item sharing is a side door cut directly into one specific room, usable by someone who's never even in the building otherwise. Closing the side door does nothing if the person can still walk in the front.

**Practice Question 2** *(Medium)*

Veronica owns a report and shares it directly with Marta, who has no role in the containing workspace. Later, Veronica removes Marta's item-level sharing on the report. What happens to Marta's access?

A. Marta immediately loses all access to the report  
B. Marta retains access because she has a workspace role  
C. Marta loses access, because without a workspace role, item permission was her only path in  
D. Marta's access converts automatically to Viewer workspace role  

> [!success]- Answer
> **C. Marta loses access, because without a workspace role, item permission was her only path in**
>
> Since Marta never had a workspace role, item-level sharing was the only mechanism granting her access. Removing it cuts off access entirely — this is the mirror case of the Common Mistake above: item-only access truly is revocable by removing the item permission, unlike workspace-role-backed access.

---

## Permission Differences by Item Type

Item permissions apply consistently in name (Read, Write, Reshare, and so on) but their practical effect differs by item type — each item type documents its own sharing model:

| Item type | Notable permission behavior |
| :--- | :--- |
| Semantic model | Read grants viewing reports built on it; separate `Build` permission is needed to create new reports/connect Excel directly to the model |
| Warehouse | Read/Write map onto the SQL analytics endpoint's own T-SQL permission surface once connected (see [02-Granular Access Controls](./02-granular-access-controls.md)) |
| Lakehouse | ReadAll (via OneLake security's `DefaultReader`) governs Lakehouse explorer and Spark/OneLake API access; ReadData (via workspace role or item Read) governs SQL analytics endpoint access |
| SQL database | Follows the same Entra-based connection model as Warehouse, with its own row/column security surface |
| Mirrored database | Read-only by nature — mirrored data can't be written back through Fabric |

> [!note] Mental model — Same permission name, different lock mechanism
> "Read" on a semantic model, a Warehouse, and a Lakehouse all sound identical, but each item type wires that permission into a different underlying mechanism — DAX-level report viewing, T-SQL connection rights, or OneLake file listing, respectively. Never assume a permission behaves identically just because the name matches across item types; check the specific item's sharing documentation for what "Read" or "Write" actually unlocks there.

## SQL Analytics Endpoint Access vs. Workspace Role

Connecting to a Lakehouse or Warehouse's SQL analytics endpoint is open to **all four workspace roles** (Admin/Member/Contributor/Viewer) — a minimum of item **Read** permission also suffices for a user with no workspace role. But what a connected user can actually read splits along the same ReadData/ReadAll line as the workspace-role table above:

| Access path | Who gets it | Notes |
| :--- | :--- | :--- |
| TDS endpoint / T-SQL (ReadData) | All 4 workspace roles; item Read+ | Standard SQL client connections (SSMS, VS Code, Power BI DirectQuery) |
| OneLake APIs / Spark (ReadAll) | Admin, Member, Contributor only | Viewer needs an explicit OneLake security grant (see [03-OneLake Security](./03-onelake-security.md)) to get equivalent access |

If [OneLake security](./03-onelake-security.md) is enabled on the SQL analytics endpoint (User's identity access mode), table/row/column-level restrictions defined there apply on top of this baseline — a user can hold ReadData but still see zero rows in a table they're not granted OneLake security access to.

## Removing and Auditing Access

Fully removing a user's access to an item requires checking **both** layers, in this order:

1. **Item permission** — remove the direct share on the item, if one exists.
2. **Workspace role** — remove or downgrade the user's workspace role if it's Contributor+ (which would still expose the item regardless of step 1).

Only after both are cleared is the user's access to that specific item actually gone. If the user was accessing the item only via a workspace role (no separate item-level share ever existed), step 1 is a no-op and step 2 alone suffices.

| Starting access | Item permission removed | Workspace role removed | Net result |
| :--- | :---: | :---: | :--- |
| Item share only, no workspace role | ✅ | n/a | Access revoked |
| Workspace role only (Contributor+), no item share | n/a | ✅ | Access revoked |
| Both item share and Contributor+ workspace role | ❌ (item share only) | — | **Access retained** via workspace role |
| Both item share and Contributor+ workspace role | ✅ | ✅ | Access revoked |

> [!warning] Common Mistake
> Auditing "who has access to this report" by only reviewing its item-level share list **misses** anyone reaching it through a workspace role — the share list doesn't surface Contributor+ users at all, since they don't need an explicit item grant. A complete access audit always checks both the item's share list and the workspace's role assignments.

## App Audiences vs. Direct Sharing

A **Power BI app** packages one or more reports/dashboards from a workspace into a separate, curated consumption surface, distributed to defined **audiences** — named subsets of the app's installed users, each potentially seeing a different combination of content. Installing an app grants access **only to the packaged content**, not to the underlying workspace or its other items.

| | Direct item sharing | App audience |
| :--- | :--- | :--- |
| Grants workspace access? | No | No |
| Grants access to other workspace items? | No (item-scoped) | No (app-scoped) |
| Supports per-recipient content variation? | No — same item for everyone shared | Yes — different audiences see different report/dashboard subsets |
| Typical use | One-off access to a single item for a specific person | Broad, governed distribution to a business audience |

> [!warning] Common Mistake
> Installing an app does **not** give a user Viewer access to the source workspace — they can't browse to other items in that workspace, use the OneLake catalog to find related data, or connect to the SQL analytics endpoint through the app alone. App access and workspace/item access are fully separate grants.

**Practice Question 3** *(Medium)*

A workspace has a semantic model with row-level security (RLS) roles defined in DAX. The business wants report consumers to see only their own region's data via RLS, but data engineers need to see everything while building pipelines. How should roles be assigned?

A. Assign everyone Contributor, and rely on RLS to filter what each person sees  
B. Assign report consumers Viewer (so RLS applies) and data engineers Contributor or higher (so RLS doesn't restrict their pipeline work)  
C. Assign everyone Viewer, and use item-level sharing to grant engineers extra access  
D. RLS can't coexist with workspace roles — engineers and consumers must be in separate workspaces  

> [!success]- Answer
> **B. Assign report consumers Viewer (so RLS applies) and data engineers Contributor or higher (so RLS doesn't restrict their pipeline work)**
>
> RLS on Power BI items is only enforced for users at the **Viewer** role — any higher role already has blanket view/modify access to all workspace content, which supersedes DAX-level row filtering. Splitting the audience by role (Viewer for consumers who need filtering, Contributor+ for builders who need full visibility) is the standard, supported pattern — no separate workspace is required, and D overstates the limitation.

## Use Cases

- Assigning a broad analyst team the Viewer role so they can browse dashboards and query via SQL client, without letting them modify pipelines
- Sharing a single sensitive report with an external stakeholder who has no other access to the workspace
- Distributing a governed Power BI app to "Sales - EMEA" and "Sales - APAC" audiences, each seeing region-filtered report pages from the same underlying workspace
- Granting Contributor (not Member) to a data engineering team so they can build and modify pipelines without being able to reshare items or manage workspace membership
- Assigning a CI/CD service principal a workspace role so automated deployments via the Items REST API don't depend on a human's credentials
- Keeping report consumers at Viewer specifically so a semantic model's RLS roles are actually enforced when they browse the workspace directly

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Viewer can query via SQL client but sees "access denied" using a Spark notebook against the same Lakehouse | Viewer role grants ReadData (TDS) but not ReadAll (OneLake APIs/Spark) by default | Grant explicit OneLake security read access, or elevate the user to Contributor+ |
| Removing item sharing didn't block a user | User still holds a workspace role (Contributor+) that covers all workspace content | Remove the workspace role as well, not just the item-level share |
| App installer can't see other workspace items | Apps only expose the packaged content, not the source workspace | Share the specific additional item directly, or grant a workspace role |
| A resharer can't share an item further | User has Read/Write but not the Reshare permission specifically | Grant Reshare explicitly when sharing, or via workspace Admin/Member (who can always reshare) |
| RLS on a semantic model doesn't filter a workspace browser's results | The browser holds Contributor+ rather than Viewer | Reassign the user (or their group) to Viewer if RLS enforcement is required |
| A newly-added workspace member still has the old access after being reassigned a lower role | Access changes apply on next login, not the current session | Have the user sign out and back in, or wait for their session to refresh |
| Service principal can't perform notebook CRUD via the Items REST API | Service principal was assigned Viewer, which the API treats the same as the UI (no create/modify) | Assign the service principal Contributor or higher |

## Best Practices

- Default to workspace roles for anyone doing ongoing work in a workspace; reserve item-level sharing for one-off, single-item access needs
- Assign Contributor rather than Member to teams that build content but shouldn't manage workspace membership or reshare freely
- Use app audiences instead of sharing dozens of individual reports when distributing to a large, segmented business audience
- Periodically audit item-level shares — they're easy to grant and easy to forget, and don't show up when reviewing only workspace role assignments
- Use service principals (not personal accounts) for CI/CD and unattended automation against workspace roles and the Items/Job Scheduler REST APIs
- Keep report-consuming audiences at Viewer deliberately when RLS enforcement matters — verify this explicitly during any workspace access review

## Exam Tips

> [!tip] Exam Tips
>
> - Workspace roles are additive: Admin ⊃ Member ⊃ Contributor ⊃ Viewer for nearly every listed capability
> - All 4 roles get ReadData (TDS/T-SQL); only Admin/Member/Contributor get ReadAll (OneLake APIs/Spark) by default — this split is the single most tested fact in this topic
> - Item permission and workspace role are independent grants — removing one doesn't remove access still held via the other
> - Reshare, Execute, ViewOutput, and ViewLogs can't be granted standalone — they layer on top of Read or Write
> - Apps distribute packaged content to audiences; they never grant workspace or item access to anything outside the app

## Key Takeaways

- Four workspace roles (Admin/Member/Contributor/Viewer) are additive and apply to all items in a workspace
- Item permissions (Read, ReadAll, Write, Reshare, Execute, ViewOutput, ViewLogs) are independent of workspace role and item-scoped
- SQL analytics endpoint connectivity is open to all roles, but ReadAll (OneLake APIs/Spark) is restricted to Admin/Member/Contributor
- Power BI apps distribute curated content to audiences without granting workspace or item access
- Fully revoking a user's access to an item requires checking both the item-permission layer and the workspace-role layer

## Related Topics

- [02-Granular Access Controls](./02-granular-access-controls.md)
- [03-OneLake Security](./03-onelake-security.md)

## Official Documentation

- [Roles in workspaces in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/roles-workspaces)
- [Give users access to workspaces](https://learn.microsoft.com/en-us/fabric/fundamentals/give-access-workspaces)
- [Permission model in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/security/permission-model)
- [OneLake data access control model](https://learn.microsoft.com/en-us/fabric/onelake/security/data-access-control-model)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../02-lifecycle-management/03-deployment-pipelines.md) | [↑ Back to Section](./security-governance.md) | [Next →](./02-granular-access-controls.md)**
