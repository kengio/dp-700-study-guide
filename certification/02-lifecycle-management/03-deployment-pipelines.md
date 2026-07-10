---
title: Deployment Pipelines
type: topic
tags:
  - dp-700
  - fabric
  - deployment-pipelines
  - cicd
  - lifecycle-management
---

# Deployment Pipelines

## Overview

**Deployment pipelines** are Fabric's stage-based promotion tool: they clone content — Dev → Test → Prod, or any custom stage set — while preserving item relationships, applying stage-specific **deployment rules**, and never copying underlying data. This topic covers pipeline structure, assigning workspaces, item pairing, deployment methods (full/selective/backward), deployment rules, what is and isn't copied during a deploy, and the two-layer permission model that governs who can do what.

> [!abstract]
>
> - A pipeline has **2–10 stages** (default 3: Development/Test/Production); the stage **count and names are permanent** once created
> - **Item pairing** — based on name, type, and folder — determines whether a deploy overwrites an item or creates a duplicate ("clean deploy")
> - **Deployment rules** (data source, parameter, default lakehouse) exist for a **narrow, specific list of item types** — not everything deployable supports them
> - **Data is never copied** by a deployment — only metadata/schema; refresh or reload data manually after promotion
> - **Backward deployment** (a later stage → an earlier one) only works when the target stage is **empty**, and only as a full (not selective) deploy

> [!tip] What the Exam Tests
>
> - Pipeline structure limits (2–10 stages), and the difference between assigning a workspace to a stage vs. deploying content into it
> - How item pairing decides overwrite vs. clean-deploy behavior, including the folder tie-breaker rule
> - Which item types support deployment rules, and which rule type (data source / parameter / default lakehouse) applies to each
> - Pipeline-level permissions (Admin only) vs. workspace-role permissions, and how both combine to allow a deployment
> - What deployment does **not** copy (data, URL, ID, permissions, workspace settings) — the most commonly tested trap in this topic

---

## Pipeline Structure and Stages

A pipeline has **2 to 10 stages**, defaulting to **Development**, **Test**, and **Production** — you can rename, add, or delete stages during creation, but **the number of stages and their names become permanent once the pipeline is created**. Each stage typically maps to one workspace.

Any stage can optionally be made **public** — a consumer without pipeline access then sees a public stage as an ordinary workspace, with no stage badge. By default only the final stage is public, but you can make any number of stages public, or none.

> [!warning] Common Mistake
> Don't confuse "changing the public status of a stage" (changeable anytime) with "changing the number/names of stages" (locked in permanently at pipeline creation). A scenario asking "the team needs a 4th stage after the pipeline is already live" has one answer: **create a new pipeline** — you cannot add a stage to an existing one.

---

## Assigning Workspaces to Stages

**Assigning** a workspace to a vacant stage is different from **deploying content** into one:

- **Assign**: attaches an *existing* workspace to an empty stage as-is — no content is copied, pairing is attempted immediately based on existing items in adjacent stages.
- **Deploy to an empty stage**: creates a **brand-new workspace** for that stage and copies content into it from the adjacent stage.

A workspace qualifies for assignment only if: you're its Admin, it isn't already assigned to another pipeline, it sits on a Fabric capacity, you have Contributor+ on the adjacent stages' workspaces, and it isn't a template-app or sample-dataset workspace. **Unassigning** a workspace loses that stage's deployment history and any configured deployment rules — both are gone for good, not just hidden.

> [!warning] Common Mistake
> Deleting a workspace that's currently assigned to a pipeline stage **fails outright** — you must unassign it from the pipeline first (via **View Deployment Pipeline** from the workspace page), then delete it.

---

## Item Pairing

**Pairing** links an item in one stage to "the same" item in the adjacent stage, so a future deploy **overwrites** it rather than duplicating it. Renaming a paired item **doesn't unpair it** — paired items can have different names across stages.

Pairing happens two ways, with slightly different rules each time:

| Trigger | Pairing criteria | Failure mode |
| :--- | :--- | :--- |
| **Deploying an unpaired item** | The deploy itself creates the pairing — a "clean deploy" | If a same-name/type item already exists unpaired in the target, you end up with two separate items (one paired, one not), not an overwrite |
| **Assigning a workspace to a stage** | Item **name** + **type** must match; **folder location** breaks ties when duplicates exist | If two-or-more items share name+type in either stage, pairing fails **unless folder location also matches** — if folders differ, pairing fails outright |

Adding a *new* item directly into an already-assigned stage's workspace does **not** auto-pair it with an identical item elsewhere — you can end up with identical unpaired items sitting in adjacent stages indefinitely.

> [!note] Mental model — Item pairing as a name tag, not a memory
> Pairing isn't Fabric "remembering" that two items came from the same source — it's re-derived every time from name + type (+ folder as tiebreaker). Two items that look identical but were never paired by an actual deploy or assignment stay strangers to each other forever, even if you rename them to match exactly.

**Practice Question 1** *(Medium)*

A workspace is assigned to the Test stage of a pipeline. The Dev stage has a report named "Sales Report" in `Folder A`; Test has a report with the same name and type in `Folder B`. What happens when the workspace is assigned?

A. The items pair automatically because name and type match
B. The items don't pair because the folder locations differ — deployment can still succeed but the items are treated as unrelated
C. Assignment fails outright because of the folder mismatch
D. Fabric automatically moves the Test report into Folder A to force a match

> [!success]- Answer
> **B. The items don't pair because the folder locations differ — deployment can still succeed but the items are treated as unrelated**
>
> Folder location is only consulted as a **tie-breaker when duplicates exist within a single stage** — but a folder mismatch between the two candidate items themselves prevents pairing. The items remain unpaired (not an assignment failure), meaning a future deploy of the Dev report creates a separate, second report in Test rather than overwriting the existing one.

---

## Deployment Methods

Deploying content to another stage offers three approaches:

### Full deployment

Deploys **all** content from the source stage to the target, overwriting paired items and adding unpaired/new items alongside.

### Selective deployment

Choose specific items to deploy via **Show more**. Key rules:

- The default folder view only lets you select items **within the same folder level**; switching to **flat list view** (a toggle at the top of the stage) lets you select across folders, and adds a **Location** column showing full item paths.
- **Select related** auto-selects an item's dependencies (e.g., the semantic model behind a report) so the deployment doesn't break — this button only works in flat list view; using it from folder view auto-switches you into flat list view.
- Deploying an item **without** its dependency fails if that dependency doesn't already exist in the target stage.
- Switching between flat list and folder view, or changing a filter, **resets your current selection**.

### Backward deployment

Deploys from a **later** stage back to an **earlier** one (e.g., Production → Test). Two hard constraints:

- Only possible when the **target stage is empty** (unassigned).
- Only available as a **full** deployment — you **cannot** selectively backward-deploy individual items.

> [!warning] Common Mistake
> "Backward deployment" on the exam always implies an **empty target stage** and a **full** (not selective) deploy. If a scenario describes backward-deploying only *some* items, or into a stage that already has content, that scenario is describing something Fabric deployment pipelines **don't support** as of this writing.

Every deployment (any method) shows a confirmation listing the items about to move, with an optional **note** — recorded in deployment history, and worth adding since it's the main way to make pipeline history legible later.

**Practice Question 2** *(Hard)*

A team has a fully populated Production stage and wants to pull last quarter's approved content back into a freshly reset Test stage, deploying only the three reports that changed — leaving everything else in Test untouched. Is this possible as described?

A. Yes — select the three reports and use backward deployment
B. No — backward deployment requires the target stage to be empty and only supports deploying all items, not a selective subset
C. Yes, but only if deployment rules are configured first
D. No — backward deployment doesn't exist in Fabric deployment pipelines

> [!success]- Answer
> **B. No — backward deployment requires the target stage to be empty and only supports deploying all items, not a selective subset**
>
> Both constraints in the scenario are violated: the target stage isn't empty ("leaving everything else... untouched" implies existing content), and the request is for a selective (three-report) deploy. Backward deployment exists (ruling out D) but is restricted to full deploys into empty stages only — the team would need to fully reset Test (unassign/reassign to empty it) and then backward-deploy everything, or reconsider the approach entirely.

---

## Deployment Rules

Deployment rules let a **target stage** keep stage-specific configuration (a different database connection, a different query parameter) across repeated deployments, instead of being overwritten every time. A rule is defined **in the target stage**, under the specific item, and takes effect starting with the **next** deployment into that stage — not retroactively.

Only a narrow set of item types support rules, and each supports a specific subset of rule types:

| Item | Data source rule | Parameter rule | Default lakehouse rule |
| :--- | :--- | :--- | :--- |
| **Dataflow Gen1** | ✅ | ✅ | ❌ |
| **Semantic model** | ✅ | ✅ | ❌ |
| **Paginated report** | ✅ | ❌ | ❌ |
| **Mirrored database** | ✅ | ❌ | ❌ |
| **Notebook** | ❌ | ❌ | ✅ (sets the target stage's default lakehouse) |

> [!warning] Common Mistake
> Deployment rules **don't cover Lakehouse, Warehouse, Pipeline, Eventstream, or most other modern Fabric items** — this table is small and specific to legacy Power BI-era items plus notebooks. A scenario asking "configure a deployment rule for a Warehouse's connection string" is describing something **unsupported**; the right answer for stage-specific Warehouse or Pipeline configuration is typically **parameterization within the item itself**, not a deployment rule.

Data source rules only work when swapping to a data source **of the same type**, and only for a specific supported list (Azure Analysis Services, Azure Synapse, SSAS, Azure/SQL Server, OData Feed, Oracle, SapHana import mode, SharePoint, Teradata) — anything else should use item-level parameters instead.

Additional constraints:

- Rules **can't be created in the Development stage** (there's nothing "earlier" for a Dev-stage rule to protect against).
- You must be the **owner** of the item to create a rule for it.
- Deleting the item deletes its rules permanently; unassigning/reassigning a workspace also loses its rules.
- If the underlying data source or parameter is later changed/removed from the source item, the rule becomes invalid and **deployment fails**.

**Practice Question 3** *(Medium)*

A team wants the Production stage of a semantic model to always point at the production SQL database, regardless of what the Test stage's semantic model points to. Where should this be configured?

A. A parameter in the pipeline's global settings
B. A data source rule, defined on the semantic model in the Production stage
C. A data source rule, defined on the semantic model in the Development stage
D. This isn't achievable with deployment pipelines

> [!success]- Answer
> **B. A data source rule, defined on the semantic model in the Production stage**
>
> Deployment rules are always defined **in the target stage**, under the specific item — here, the semantic model in Production. Once set, every future deployment into Production applies that rule, overriding whatever data source the Test-stage semantic model pointed to. Rules can't be created in the Development stage (C is structurally impossible for a rule protecting Production), and there's no pipeline-wide "global settings" parameter mechanism (A) — configuration is always per-item, per-target-stage.

---

## What Gets Deployed — and What Doesn't

Understanding this list is the single highest-yield fact in this topic.

**Copied and overwritten in the target stage:**

- Data sources and parameters (deployment rules, if configured, apply here)
- Report visuals, report pages, dashboard tiles
- Model metadata, item relationships
- Sensitivity labels — but **only** when deploying a new item, deploying into an empty stage, or when the source has a protected label and the target doesn't (with a consent prompt)

**Never copied:**

- ==Data== — only metadata/schema moves; refresh semantic models or reload tables manually after deployment
- URL and item ID (stable across deployments — this is how paired items stay "the same item" even as content changes)
- Permissions (per-workspace and per-item)
- Workspace settings (each stage has its own, independently configured)
- App content/settings (Power BI apps must be updated separately, even after a successful deployment)
- Personal bookmarks
- Semantic-model-specific: role assignments, refresh schedules, data source credentials, query caching settings, endorsement settings

> [!note] Mental model — Deployment as moving the blueprint, not the building
> A deployment ships the *architectural drawings* (schema, visuals, relationships, parameters) to the target stage — never the *furniture* (data) already sitting there, and never the *keys* (permissions) to the building. After the blueprint arrives, someone still has to move the furniture in (refresh the data) and reissue the keys (permissions stay whatever the target stage already had).

## Backward Deployment Restrictions (Recap)

Covered above under Deployment Methods, but worth isolating since it's tested in isolation: backward deployment (later stage → earlier stage) requires an **empty target stage** and is **full-deploy only** — no selective backward deployment exists.

---

## Pipeline Access vs. Workspace Roles

Two permission layers apply independently and **both** must be satisfied for most actions:

- **Pipeline permission**: there's only one — **Pipeline Admin** — granted when someone shares the pipeline with you. It lets you view/share/edit/delete the pipeline and see which workspaces are assigned to which stage, but grants **zero** visibility into workspace *content*.
- **Workspace role**: the ordinary Fabric workspace roles (Admin/Member/Contributor/Viewer), assigned per workspace exactly as elsewhere in Fabric.

| Role combination | Can do |
| :--- | :--- |
| **Pipeline Admin only** (no workspace role) | View and share the pipeline, see assigned-workspace tags — **cannot** view content or deploy |
| **Pipeline Admin + workspace Viewer** | Consume content; unassign a workspace from a stage |
| **Pipeline Admin + workspace Contributor** | Consume content, compare stages, view semantic models, **deploy items** (must be Contributor+ in both source and target workspaces) |
| **Pipeline Admin + workspace Member** | Everything Contributor can, plus update semantic models and configure semantic model rules (if item owner) |
| **Pipeline Admin + workspace Admin** | Everything above, plus assign workspaces to stages |

Key required-permission facts worth memorizing directly:

- **Deploy to an empty stage**: Pipeline Admin + source-workspace Contributor.
- **Deploy items to the next stage**: Pipeline Admin + Contributor in **both** source and target workspaces (dataflows additionally require item ownership).
- **Assign a workspace to a stage**: Pipeline Admin + Admin of the workspace being assigned.
- **Compare two stages**: Pipeline Admin + Contributor/Member/Admin in **both** stages.
- Microsoft 365 groups **aren't supported** as pipeline admins.

> [!warning] Common Mistake
> Having Pipeline Admin access is **not sufficient on its own** to deploy or even view content — it's a management/sharing permission layered on top of, not a substitute for, workspace roles. A user who's Pipeline Admin but has no role in either workspace can share the pipeline with a teammate but can't push a single deployment.

## Use Cases

- Promoting tested Dev content through Test into Production on a predictable release cadence
- Standing up parallel environments from existing workspaces via assignment, without a fresh initial deploy
- Keeping Production's data source pointed at production systems automatically via deployment rules, even as Dev/Test iterate against sample data
- Auditing release history via deployment notes and per-stage "last deployed" timestamps

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Deploy overwrote the wrong item, or duplicated an item unexpectedly | Item pairing didn't match what was assumed — name/type/folder mismatch | Check the pipeline content list for items shown on separate lines (unpaired) vs. same line (paired) before deploying |
| Can't delete a workspace | It's still assigned to a deployment pipeline stage | Open **View Deployment Pipeline** from the workspace, unassign it there, then delete |
| Selective deployment fails on a report | The report's dependent semantic model doesn't exist in the target stage | Use **Select related** to include dependencies, or pre-deploy the semantic model first |
| Deployment rule silently stopped applying | The source item's underlying data source/parameter was changed or removed | Reconfigure the rule against the item's current data source/parameter |
| Tried to add a deployment rule in Development | Rules can't be created in the Development stage | Configure the rule in Test or Production instead |
| Backward deployment button is unavailable | Target (earlier) stage isn't empty, or a selective set of items was chosen | Fully unassign/empty the target stage first, and deploy all items (not a subset) |
| Data appears stale or missing after deployment | Deployment never copies data — only metadata/schema | Manually refresh the semantic model or reload source tables in the target stage |
| Rules disappeared after reassigning a workspace | Unassigning a workspace from a stage permanently deletes its configured rules | Reconfigure rules after reassignment; there's no rule-recovery mechanism |

## Best Practices

- Always check pairing status (same line vs. separate line in the content list) before a full deploy, especially after ad hoc items were added directly to a stage's workspace
- Use **Select related** for any selective deployment involving reports, dashboards, or dependent semantic models
- Reserve deployment rules for the specific item types that support them; use item-level parameters for everything else (Lakehouse, Warehouse, Pipeline, Eventstream)
- Add a deployment note every time — deployment history is only as useful as the notes attached to it
- Treat Pipeline Admin and workspace role as two separate grants when troubleshooting "why can't this person deploy" — check both

## Exam Tips

> [!tip] Exam Tips
>
> - Pipelines: 2–10 stages, count/names permanent after creation; public status changeable anytime
> - Item pairing = name + type (+ folder as tiebreaker); pairing status controls overwrite vs. duplicate on deploy
> - Deployment rules only cover Dataflow Gen1, semantic model, paginated report, mirrored database, and notebook (default lakehouse) — nothing else
> - **Data is never deployed** — this is the single most tested fact in this topic; only metadata/schema moves
> - Backward deployment = empty target stage + full deploy only, never selective
> - Two independent permission layers: Pipeline Admin (sharing/management) and workspace role (content access) — both required together for most actions

## Key Takeaways

- Deployment pipelines promote content across up to 10 named, permanent stages using item pairing to decide overwrite vs. duplicate
- Full, selective, and backward are the three deployment methods, each with distinct constraints (backward = empty target + full only)
- Deployment rules are narrowly scoped to legacy Power BI items plus notebooks — Lakehouse/Warehouse/Pipeline configuration differences are handled with parameters instead
- Data, permissions, URLs/IDs, workspace settings, and app content are never copied by a deployment
- Pipeline permission (Admin-only) and workspace roles are independent layers that both gate deployment actions

## Related Topics

- [01-Version Control](./01-version-control.md)
- [02-Database Projects](./02-database-projects.md)

## Official Documentation

- [Overview of Fabric deployment pipelines](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/intro-to-deployment-pipelines)
- [Get started using deployment pipelines](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/get-started-with-deployment-pipelines)
- [The Fabric deployment pipelines process (permissions, item properties copied/not copied)](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/understand-the-deployment-process)
- [Deploy content with deployment pipelines (full/selective/backward)](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/deploy-content)
- [Assign a workspace to a deployment pipeline (item pairing rules)](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/assign-pipeline)
- [Create deployment rules](https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/create-rules)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-database-projects.md) | [↑ Back to Section](./lifecycle-management.md) | [Next →](../03-security-governance/security-governance.md)**
