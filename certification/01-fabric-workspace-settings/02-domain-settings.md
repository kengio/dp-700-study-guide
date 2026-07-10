---
title: Domain Workspace Settings
type: topic
tags:
  - dp-700
  - fabric
  - domains
  - governance
  - workspace-settings
---

# Domain Workspace Settings

## Overview

Fabric **domains** let an organization group workspaces — and everything inside them — by business area, so governance and discovery can be federated instead of purely centralized. Configuring domain settings means understanding the three domain roles, how workspaces get assigned to a domain, what "default domain" automation does, and which tenant-level settings can be delegated down to a domain.

> [!abstract]
>
> - Domains group workspaces (and their items) for discovery and federated governance; **subdomains** refine that grouping further
> - Three roles: **Fabric admin** (create/manage any domain), **domain admin** (manage their domain), **domain contributor** (assign their own workspaces to a domain)
> - Workspaces can be assigned to a domain by name, by workspace admin, or by capacity — and a **default domain** can auto-assign unassigned workspaces going forward
> - Domain assignment changes discovery/governance, **not** item visibility or access — access still flows from workspace roles and item permissions

> [!tip] What the Exam Tests
>
> - Distinguishing what each of the three domain roles can and can't do
> - Understanding that domain assignment doesn't grant or restrict data access by itself
> - How the three workspace-assignment methods (by name / by admin / by capacity) differ, and when overriding an existing assignment requires a tenant setting
> - What "default domain" and "delegated settings" actually configure

---

## Domains and Subdomains

A **domain** is a logical grouping of workspaces — and, by extension, every item inside those workspaces — around a business area (Finance, Marketing, HR, and so on). Fabric's approach to this is a **data mesh**: instead of purely centralized IT-owned data governance, domains let each business unit manage its own data according to its own rules while some governance stays centralized at the tenant.

When a workspace is assigned to a domain, every item in that workspace inherits the domain as metadata. This mainly improves **consumption**: users can filter the [OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview) by domain to find relevant content, and some tenant-level governance settings can be **delegated** to the domain to allow domain-specific configuration.

A **subdomain** further refines a domain's grouping (e.g., "Finance → Accounts Payable"). Subdomains only have **general settings** — name and description — and critically, **a subdomain has no domain admins of its own**; its parent domain's admins manage it.

> [!warning] Common Mistake
> Domain assignment does **not** change who can see or access a workspace's items. Item discovery, visibility, and access still depend entirely on workspace role and item permissions. Every tenant user can see every domain name in the domain selector, regardless of their role in it — domains organize and filter, they don't gate.

---

## Domain Roles

| Role | Grants | Scope |
| :--- | :--- | :--- |
| **Fabric admin** (or higher) | Create/edit/delete domains, assign domain admins and contributors, associate any workspace with any domain | Every domain in the tenant |
| **Domain admin** | Update domain description, define/update domain contributors, assign workspaces to the domain, set the domain image, override delegated tenant settings for the domain | Only the domain(s) they administer — can't delete the domain, rename it, or manage other domain admins |
| **Domain contributor** | Assign the workspaces *they are workspace Admin of* to the domain, or change that workspace's current domain assignment | Only workspaces where they hold the workspace **Admin** role — no access to the admin portal's Domains tab |

Only a **Fabric admin** can create a new domain in the first place (Admin portal → **Domains** tab → **Create new domain**). Creating a *subdomain*, however, only needs Fabric admin **or** domain admin of the parent domain.

> [!note] Mental model — Domain roles
> Think of the tenant as a shopping mall. The **Fabric admin** is mall management — they can open new stores (domains) anywhere. A **domain admin** is a store owner — full control of their own store, no say over anyone else's. A **domain contributor** is a stockroom manager who can move their own store's inventory (workspaces they admin) between shelves (domains) but can't touch the storefront itself.

**Practice Question 1** *(Medium)*

A business analyst who is a workspace Admin for "Sales Reporting" has been designated a domain contributor for the "Sales" domain. What can they do?

A. Create new subdomains under "Sales"  
B. Assign the "Sales Reporting" workspace to the "Sales" domain, since they admin that workspace  
C. Change who the domain admins of "Sales" are  
D. Override tenant-level certification settings for the "Sales" domain  

> [!success]- Answer
> **B. Assign the "Sales Reporting" workspace to the "Sales" domain, since they admin that workspace**
>
> Domain contributors can assign or reassign only the workspaces where they hold the **Admin** role — they assign from the workspace's own settings, not the admin portal. Creating subdomains (A), managing domain admins (C), and delegated-settings overrides (D) all require Fabric admin or domain admin privileges, which a contributor doesn't have.

---

## Assigning Workspaces to Domains

Fabric admins and domain admins assign workspaces to a domain or subdomain from the **Domains** tab in the admin portal, using one of three methods:

| Method | How it works | Notes |
| :--- | :--- | :--- |
| **By workspace name** | Search and multi-select workspaces directly | Useful when naming conventions already encode business context |
| **By workspace admin** | Select users/security groups; every workspace they admin is assigned | Excludes "My workspaces"; affects existing workspaces only, not future ones the same people create |
| **By capacity** | Select one or more capacities; every workspace on those capacities is assigned | Fits organizations with dedicated capacities per department; excludes "My workspaces"; existing workspaces only |

If a workspace is already assigned to a different domain, assigning it again triggers a warning — the reassignment only proceeds (and **overrides** the prior assignment) if the tenant setting **Allow tenant and domain admins to override workspace assignments (preview)** is enabled. This is a **tenant-level** setting (a preview feature) that a tenant admin controls from the admin portal's domain management settings page — it's the gatekeeper that decides whether *any* Fabric or domain admin can forcibly move an already-assigned workspace, independent of which of the three assignment methods they use.

Domain contributors assign workspaces a different way entirely: from **inside the workspace's own settings**, and only for workspaces where they're the workspace Admin.

---

## Default Domain

Defining a domain as the **default domain** for specified users and/or security groups automates future assignment:

1. Fabric scans existing workspaces. For any workspace whose admin is a listed user or group member:
   - If it already has a domain, that assignment is **preserved** (default domain never silently overrides an existing one).
   - If it's unassigned, it's assigned to the default domain.
2. Going forward, **any new workspace** created by a listed user or group member is automatically assigned to the default domain.

Users covered by a default-domain definition generally also become **domain contributors** on the workspaces assigned to them through this mechanism. Setting a domain as default requires Fabric admin or that domain's domain admin.

> [!warning] Common Mistake
> Default domain assignment is **one-directional and non-destructive** to existing assignments — it only fills gaps (unassigned workspaces) and governs future workspace creation. It never reassigns a workspace that already belongs to a different domain; that requires an explicit, override-enabled reassignment instead.

---

## Delegated Settings

Some tenant-level governance settings can be **delegated** to individual domains, letting each business unit set its own rules within a delegation the tenant admin has authorized. Configured from the domain's **Domain settings → Delegated Settings** pane:

- **Domain-level default sensitivity label** — if the tenant enables this feature, a domain admin (or Fabric admin) can specify a sensitivity label applied by default to items in workspaces assigned to that domain.
- **Certification settings** — a domain admin can override the tenant's certification configuration for the domain: enable/disable certification for domain items, specify domain-specific certifiers, and link to domain-specific certification documentation. This requires explicitly checking **Override tenant admin selection**.

Other tabs on the **Domain settings** pane cover general settings (name/description — domain admins can only edit description), domain image, admins, contributors, and default domain — none of those are "delegated tenant settings," they're domain-management settings in their own right.

**Practice Question 2** *(Easy)*

A domain admin wants Finance-domain items to automatically get a specific sensitivity label without changing the tenant-wide default. Where do they configure this?

A. Workspace settings → OneLake  
B. Domain settings → Delegated Settings → Domain-level default sensitivity label  
C. Admin portal → Information Protection (tenant level only)  
D. Item-level frontmatter on each note  

> [!success]- Answer
> **B. Domain settings → Delegated Settings → Domain-level default sensitivity label**
>
> This is exactly what domain settings delegation is for: if the tenant has enabled the domain-level default sensitivity label feature, a domain admin (or Fabric admin) sets it per-domain from **Delegated Settings**, overriding the tenant-wide default only for items in workspaces assigned to that domain.

**Practice Question 3** *(Medium)*

A new employee is added to a security group that is set as the default domain for "Marketing." They immediately create a brand-new workspace. What happens to that workspace?

A. Nothing — default domain only affects pre-existing workspaces  
B. It's automatically assigned to the "Marketing" domain  
C. It requires a Fabric admin to manually assign it  
D. It's assigned to "Marketing" only if the employee is also a domain contributor beforehand  

> [!success]- Answer
> **B. It's automatically assigned to the "Marketing" domain**
>
> Once a domain is set as default for a user or group, any **new** workspace created by a covered user is automatically assigned to that domain going forward — this is the ongoing half of the default-domain mechanism, distinct from the one-time scan of pre-existing workspaces at setup time.

---

## Domain Image

Each domain can be assigned an **image** (or a solid color) to represent it visually in the OneLake catalog. When a user filters the catalog to a specific domain, the domain image becomes part of the catalog's theme — a quick visual cue for which domain's data they're browsing. This is purely cosmetic for discovery; it carries no security or governance behavior. Configure it from **Domain settings → Image → Select an image**.

## Auditing Domain Changes

Every domain lifecycle event — creation, edit, deletion — is written to Fabric's **audit log**, viewable through the unified Microsoft Purview audit log or the Fabric activity log. This matters operationally: if a workspace unexpectedly changes domains, or a domain's delegated settings shift, the audit trail is the first place to check before assuming a bug. The domain-specific fields captured in this log (actor, target domain, before/after values) are documented in the [domains audit schema](https://learn.microsoft.com/en-us/fabric/governance/domains-audit-schema).

## Automating Domain Management via REST API

Nearly every admin-portal domain action — creating a domain, assigning workspaces, updating admins/contributors, reading delegated settings — is also exposed through the [Fabric REST Admin API for domains](https://learn.microsoft.com/en-us/rest/api/fabric/admin/domains). This matters for scenario questions about **bulk** domain assignment: reassigning hundreds of workspaces by hand through the admin portal doesn't scale, but scripting it against the Domains API does. The API honors the same role requirements as the UI — a caller still needs Fabric admin or domain admin privileges for the actions they attempt.

---

## Domain Settings Side Pane Reference

The **Domain settings** side pane (open a domain → **Domain settings**, or hover a domain on the Domains tab → **More options → Settings**) organizes every domain-level control into six tabs:

| Tab | Configures | Minimum role |
| :--- | :--- | :--- |
| **General settings** | Name and description | Fabric admin (full edit); domain admin (description only) |
| **Image** | Domain image/color shown in the OneLake catalog | Fabric admin or domain admin |
| **Admins** | Who the domain admins are | Fabric admin only |
| **Contributors** | Who can assign workspaces to the domain (everyone by default, or restricted to specific users/groups, or tenant+domain admins only) | Fabric admin or that domain's domain admin |
| **Default domain** | Users/groups whose unassigned and future workspaces auto-assign here | Fabric admin or that domain's domain admin |
| **Delegated Settings** | Overrides for tenant-level settings (sensitivity label, certification) | Fabric admin or that domain's domain admin |

**Subdomains** only expose the **General settings** tab — every other tab (Admins, Contributors, Default domain, Delegated Settings) is a domain-only concept, reinforcing that a subdomain always inherits its parent domain's admins and governance.

## Domains vs. Subdomains at a Glance

| Aspect | Domain | Subdomain |
| :--- | :--- | :--- |
| Own admins | Yes — assigned by a Fabric admin | ==No== — always the parent domain's admins |
| Own contributors | Yes | No — governed by the parent |
| Settings tabs available | All six | General settings only |
| Can be a default domain | Yes | No |
| Can receive delegated tenant settings | Yes | No |
| Created by | Fabric admin | Fabric admin or the parent domain's domain admin |

## Create a Domain and Subdomain: Step by Step

**Creating a domain** (Fabric admin only):

1. Open the **admin portal** → **Domains** tab.
2. Select **Create new domain**.
3. In the **New domain** dialog, provide a **name** (mandatory) and optionally specify domain admins — you can also add admins later from domain settings.
4. Select **Create**.

**Creating a subdomain** (Fabric admin or that domain's domain admin):

1. Open the parent domain → select **New subdomain**.
2. Provide a name in the **New subdomain** dialog.
3. Select **Create**.

Once created, you organize data into the domain or subdomain by **assigning workspaces** to it (see below) — creating the domain itself doesn't move or associate any data on its own.

## Worked Scenario: Standing Up Governance for a New Business Unit

A tenant admin needs to onboard a new "Regional Sales" business unit that will manage its own Fabric workspaces going forward, while the tenant keeps central control over sensitivity labeling everywhere else. A typical sequence, tying the concepts above together:

1. **Fabric admin** creates the "Regional Sales" domain and assigns an initial domain admin from the business unit.
2. The new **domain admin** creates subdomains for finer grouping (e.g., "APAC," "EMEA") — subdomains inherit the domain admin, so no separate admin assignment is needed per region.
3. The domain admin (or a Fabric admin) uses **Assign workspaces → by capacity** to bulk-assign every workspace on the business unit's dedicated capacity to the new domain in one action.
4. The domain admin designates specific team leads as **domain contributors**, so future ad hoc workspaces they admin can self-assign without looping in a Fabric admin each time.
5. The domain admin sets "Regional Sales" as the **default domain** for the business unit's security group, so new workspaces those users create are automatically captured going forward.
6. If the tenant has enabled domain-level default sensitivity labels, the domain admin can optionally override the tenant default under **Delegated Settings** — but only for that specific delegation, not for governance broadly. Everything else (item-level access, audit logging, endorsement) stays governed the same way it was before the domain existed.

This scenario illustrates the core exam distinction: domains orchestrate *discovery and specific delegated settings*, while workspace roles and item permissions continue doing all the actual access-control work untouched.

## A Note on Multi-Domain Organizations

Nothing stops a workspace from *wanting* to belong to two domains — but Fabric enforces a strict **one domain (or subdomain) per workspace** model. When you reassign a workspace to a new domain, it fully leaves the old one; there's no dual-membership or inheritance across sibling domains. If an organization's data genuinely spans two business areas, the usual pattern is either a dedicated shared-ownership workspace assigned to whichever domain is the primary owner, or splitting the data across two workspaces so each can be assigned independently. This single-assignment model is what makes the **by capacity** and **by workspace admin** bulk-assignment methods safe to run repeatedly — they always produce a deterministic, non-overlapping result.

## Terminology Quick Reference

| Term | Definition |
| :--- | :--- |
| **Data mesh** | Decentralized data architecture organizing data by business domain instead of purely centralized IT ownership |
| **Domain** | A logical grouping of workspaces (and their items) around a business area, used for discovery and federated governance |
| **Subdomain** | A finer-grained grouping under a domain; has no admins of its own |
| **Fabric admin** | Tenant-wide role that can create/manage any domain |
| **Domain admin** | Manages a specific domain's settings, contributors, and workspace assignment |
| **Domain contributor** | A workspace admin authorized to assign their own workspaces to a domain |
| **Default domain** | A domain auto-assigned to specified users'/groups' unassigned and future workspaces |
| **Delegated settings** | Tenant-level settings (sensitivity label, certification) a domain admin can override per-domain |
| **Domain image** | A picture or color representing a domain in the OneLake catalog's domain filter |
| **Data mesh** vs. centralized governance | Data mesh distributes ownership to business units; some settings still stay tenant-controlled unless explicitly delegated |
| **OneLake catalog** | The discovery surface where domain assignment becomes a filterable attribute on items |

## Use Cases

- Large organizations splitting governance by business unit (Finance, Marketing, HR) while keeping some settings centrally controlled
- Filtering the OneLake catalog to discover only relevant department data
- Auto-assigning newly created workspaces for a team without manual admin intervention (default domain)
- Letting a business unit set its own default sensitivity label or certification policy without touching tenant-wide settings

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Domain contributor can't assign a workspace | They aren't the workspace **Admin** for that workspace | Grant them the workspace Admin role, or have an actual admin assign it |
| Reassigning a workspace to a new domain silently fails to override | The **Allow tenant and domain admins to override workspace assignments (preview)** tenant setting is disabled | Enable the tenant setting, or unassign then reassign manually |
| Expected auto-assignment didn't happen for an existing workspace | The workspace was already assigned to a different domain — default domain never overrides existing assignments | Manually reassign if that's actually desired |
| Domain admin can't rename the domain | Only Fabric admins can rename or delete a domain; domain admins can only edit description | Have a Fabric admin perform the rename |
| Subdomain has no admins listed | Subdomains never have their own domain admins — they inherit the parent domain's admins | Manage the subdomain via the parent domain's admins |
| A workspace's domain changed unexpectedly and nobody remembers doing it | Bulk assignment (by admin or by capacity) or the Domains REST API reassigned it as a side effect | Check the Fabric/Purview audit log for the domain change event and its actor before assuming a bug |
| User can't see a "Delegated Settings" override option on a domain | The underlying feature (e.g., domain-level default sensitivity label) isn't enabled at the tenant level yet | Ask the tenant admin to enable the feature tenant-wide before it can be delegated to a domain |
| Domain contributor tries to configure Delegated Settings and can't | Contributors can only assign workspaces — Delegated Settings requires domain admin or Fabric admin | Escalate to the domain's domain admin or a Fabric admin |

## Best Practices

- Use **by capacity** assignment when capacities already map 1:1 to departments — it scales better than per-workspace assignment
- Reserve default-domain automation for teams with a stable, predictable workspace-creation pattern
- Delegate sensitivity-label and certification settings only to domains with a designated data owner who understands the org's classification scheme
- Document who your domain admins vs. domain contributors are — they have very different blast radii
- Enable **Allow tenant and domain admins to override workspace assignments** deliberately, not by default — accidental bulk reassignment disrupts teams relying on their domain's delegated settings
- Prefer subdomains for organizational nuance (regions, sub-teams) over spinning up many top-level domains that each need their own admin roster

## Exam Tips

> [!tip] Exam Tips
>
> - Domain assignment affects **discovery and delegated governance**, never access — access is workspace role + item permissions, full stop
> - Fabric admin creates domains; domain admin manages their own; domain contributor only assigns workspaces they admin
> - Subdomains have **no domain admins of their own** — this is a frequently tested trap
> - Default domain fills gaps and governs *future* workspace creation; it never silently overrides an existing domain assignment
> - Overriding an existing domain assignment via the admin portal requires the **Allow tenant and domain admins to override workspace assignments (preview)** tenant setting

## Key Takeaways

- Domains + subdomains implement a data-mesh-style federated governance model on top of workspaces
- Three roles (Fabric admin, domain admin, domain contributor) form a strict permission hierarchy
- Three assignment methods (by name, by admin, by capacity) cover different organizational structures
- Default domain automates future assignment without disturbing existing assignments
- Delegated settings (sensitivity label, certification) let domains override specific tenant defaults, not domain assignment itself

## Related Topics

- [01-Spark Settings](./01-spark-settings.md)
- [03-OneLake Settings](./03-onelake-settings.md)
- [04-Airflow Settings](./04-airflow-settings.md)

## Official Documentation

- [Domains - Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/governance/domains)
- [Best practices for planning and creating domains](https://learn.microsoft.com/en-us/fabric/governance/domains-best-practices)
- [OneLake catalog overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)
- [Domains API reference](https://learn.microsoft.com/en-us/rest/api/fabric/admin/domains)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-spark-settings.md) | [↑ Back to Section](./fabric-workspace-settings.md) | [Next →](./03-onelake-settings.md)**
