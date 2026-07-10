---
title: Version Control (Git Integration)
type: topic
tags:
  - dp-700
  - fabric
  - git
  - version-control
  - cicd
  - lifecycle-management
---

# Version Control (Git Integration)

## Overview

Fabric **Git integration** connects a workspace to a branch in Azure DevOps or GitHub so item definitions — not data — can be versioned, reviewed, and collaborated on using standard Git workflows. This topic covers connecting a workspace, the commit/update sync cycle, supported items, conflict resolution, Git status indicators, required permissions, and current limitations.

> [!abstract]
>
> - Git integration is **workspace-scoped**: one workspace connects to one branch in one repo/folder at a time
> - **Commit** pushes workspace changes to Git; **Update** pulls Git changes into the workspace — you can only sync in one direction at a time
> - **Branch out to a new workspace** creates an isolated dev environment backed by a new Git branch
> - Only a defined, evolving list of item types support Git integration — some GA, many still **preview**

> [!tip] What the Exam Tests
>
> - Which Git providers are supported and what a workspace Admin must do to connect one
> - The direction and mechanics of commit vs. update, and what a Git status icon (Synced/Conflict/Uncommitted) means
> - How conflicts are detected and the three ways to resolve them
> - Required workspace role + Git repo permission combinations for common Git operations

---

## Supported Git Providers

Git integration works with cloud-based Git only:

| Provider | Notes |
| :--- | :--- |
| **Azure DevOps** | Cloud-based only; supports OAuth2 or a service principal for authentication |
| **GitHub** | Cloud-based only; requires a fine-grained or classic personal access token |
| **GitHub Enterprise** | Cloud (`.com`/`ghe.com`) only — **on-premises GitHub Enterprise Server is not supported**, even when publicly accessible |

> [!warning] Common Mistake
> "GitHub Enterprise" on the exam does **not** mean any self-hosted GitHub install. Fabric only supports GitHub Enterprise's cloud offering — a GitHub Enterprise Server instance behind a private network, a custom domain, or an IP allowlist is explicitly **not supported**, regardless of public accessibility.

---

## Connecting a Workspace to Git

Only a **workspace Admin** can connect (or disconnect) a workspace to a repo. Once connected, anyone with adequate permissions can work in the workspace.

1. Go to **Workspace settings → Git integration**.
2. Select the Git provider (Azure DevOps or GitHub) and sign in / authorize.
3. Specify the target: for Azure DevOps, **Organization → Project → Repository → Branch → Folder**; for GitHub, **Repository URL → Branch → Folder**. You connect to exactly **one branch** and **one folder** at a time.
4. Select **Connect and sync**.

### Initial Sync Direction

- If either the workspace or the Git branch is **empty**, content is copied automatically from the non-empty side.
- If **both** have content, Fabric asks which direction to sync:
  - **Commit workspace → Git**: exports all supported workspace content, overwriting the Git branch's current content.
  - **Update workspace ← Git**: overwrites the workspace with Git's content — since a Git branch can be restored but a workspace state can't, Fabric asks for explicit confirmation before this option proceeds.

> [!note] Mental model — Commit vs. Update
> Think of the workspace and the Git branch as two rooms connected by a one-way door that flips direction on demand. **Commit** opens the door workspace → Git. **Update** opens it Git → workspace. The door is never open both ways at once — you always pick a direction, and you can't commit and update in the same action.

---

## Commit, Update, and Sync Direction

Day-to-day work happens through the **Source control** panel, reachable from the icon at the top of the workspace (it shows a badge with the number of uncommitted changes).

### Commit changes to Git

1. Open **Source control → Changes**. Each changed item shows an icon: *new*, *modified*, *deleted*, *conflict*, or *same change*.
2. Select the items to commit (or check the top box for all), add a commit message (a default is used if you leave it blank), and select **Commit**.
3. Committed items flip from **Uncommitted** to **Synced**.

A related feature, **Commit to standalone branch**, lets you spin up a brand-new Git branch and commit your current changes to it in one action — without switching away from your connected branch. The new branch isn't connected to the workspace, is based on the workspace's last synced state, and doesn't change the current workspace's state.

### Update workspace from Git

1. A notification appears in the workspace whenever someone commits to the connected branch.
2. Open **Source control → Updates**, then select **Update all** (Update always applies the *entire* branch — you can't cherry-pick individual items to update, unlike commit).
3. Confirm; items flip to **Synced**.

### Undo saved changes

Uncommitted workspace changes can be reverted to the last-synced state via **Undo** — this requires checking "I understand that workspace items may be deleted and can't be restored." Undoing a newly *added* item **permanently deletes it**; undoing a *deleted* item recreates it but with fresh metadata (sensitivity labels are lost, ownership resets to the current user).

> [!warning] Common Mistake
> If commits were made to the Git branch since your last sync, **Commit is disabled** until you update the workspace first. You can't commit and update at the same time — sync is strictly one direction per action.

**Practice Question 1** *(Easy)*

A developer wants to push their workspace changes to the connected Git branch, but the Commit button is greyed out. What's the most likely cause?

A. They lack a GitHub personal access token
B. There are pending updates from the Git branch that haven't been applied to the workspace yet
C. The workspace has more than 1,000 items
D. Commit is only available to workspace Viewers

> [!success]- Answer
> **B. There are pending updates from the Git branch that haven't been applied to the workspace yet**
>
> Fabric enforces one-direction-at-a-time syncing. If the Git branch has commits the workspace hasn't pulled in yet, Commit is disabled until the workspace is updated — this prevents a commit from silently overwriting changes the workspace hasn't seen. A missing token (A) would block the *connection* itself, not disable Commit selectively, and Viewers (D) can't see Git information in the workspace at all.

---

## Git Status Indicators

After connecting, the workspace shows a **Git status** column per item, reflecting its sync state against the remote branch:

| Status | Meaning |
| :--- | :--- |
| ==Synced== | Item is identical in the workspace and the Git branch |
| ==Conflict== | The item changed in **both** the workspace and the Git branch since the last sync — Commit is disabled until resolved |
| Unsupported item | Item type isn't on the Git integration supported-items list; it's tracked in the panel but can't be committed or updated |
| Uncommitted changes | Workspace has local changes not yet pushed to Git |
| Update required | The Git branch has commits not yet pulled into the workspace |
| Needs re-sync (identical content) | Content matches but the item still needs to point at the latest commit |

At the bottom of the screen, Fabric also shows the **connected branch name**, **time of last sync**, and a **link to the last synced commit**.

---

## Supported Items

Git integration supports a growing, versioned list of item types, spanning Data Engineering, Data Science, Data Factory, Real-Time Intelligence, Data Warehouse, Power BI, and Database categories. A representative slice relevant to DP-700:

| Item | Status |
| :--- | :--- |
| Lakehouse, Notebook, Environment, Spark Job Definition, User Data Functions, GraphQL | GA |
| Pipeline, Copy Job, Dataflow Gen2, Mirrored database | GA |
| Eventhouse, EventStream, KQL database, KQL Queryset, Real-time Dashboard | GA |
| Activator, Mirrored Snowflake, Event Schema Set, Anomaly detection | Preview |
| Warehouse | ==Preview== |
| SQL database | GA |
| Cosmos database | Preview |
| Semantic model, Report, Paginated report, Org app, Metrics Set | Preview (with exclusions — e.g., push datasets, live-connected AS models) |

> [!warning] Common Mistake
> This list changes frequently as items graduate from preview to GA — **never memorize a static snapshot for the exam**. If a workspace or Git repo contains an unsupported item, the connection still succeeds: the unsupported item is **ignored** (visible in the panel, but not committed, updated, or deleted). Always verify current support against the [official supported-items list](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/intro-to-git-integration#supported-items) rather than trusting a memorized table — this one included.

**Practice Question 2** *(Medium)*

A workspace contains a Lakehouse, a Warehouse, and a Power BI Dashboard. After connecting the workspace to Git, the team notices the Dashboard doesn't appear to sync via commit or update, though it's visible in the source control panel. What's the correct explanation?

A. The workspace exceeded the 1,000-item limit
B. Power BI Dashboard isn't a Git integration supported item, so it's tracked but ignored for commit/update
C. Dashboards require a separate Azure DevOps project
D. The Git connection is broken and must be reconnected

> [!success]- Answer
> **B. Power BI Dashboard isn't a Git integration supported item, so it's tracked but ignored for commit/update**
>
> Unsupported items still appear in the source control panel (so you know they exist and aren't silently dropped), but they can't be committed, updated, or deleted through Git integration — they're neither versioned nor synced. This is expected behavior, not a broken connection.

---

## Branching Out to a New Workspace

**Branch out to another workspace** creates a new Git branch from the source workspace's connected branch's latest commit, then either spins up a brand-new workspace or switches an existing one's Git connection to that new branch — giving developers an isolated environment.

- By default, **all** items from the source branch come along; **Select items individually (preview)** narrows this to a chosen subset (plus their required dependencies, via **Select related items**).
- The resulting *branched workspace* shows a parent/child relationship to the source workspace in the workspace tree, breadcrumbs, and the Source control **Related branches** tab.
- Any workspace items **not yet committed to Git are lost** when branching out — always commit first.
- Requires **Contributor** role or above in the source workspace (plus Git branch-create permission) and available capacity for the new workspace.

**Switch branch** (workspace Admin by default, or Contributor+ with all-items write access when **Allow users with at least Contributor role to change Git branch** is enabled) re-syncs the current workspace to a different branch, overwriting all items with that branch's content. You can't switch branches with uncommitted changes pending — commit or undo them first.

> [!note] Mental model — Branch out vs. switch branch
> **Branch out** is like cloning a house to a new address — you get a second copy to renovate independently, and the original stays untouched. **Switch branch** is like gutting and remodeling the *same* house to match a different blueprint — the workspace you're standing in gets overwritten in place.

---

## Conflict Resolution

A **conflict** occurs when the *same item* changes in both the workspace and the Git branch since the last sync. The item's status shows **Conflict**, and Commit is disabled until it's resolved. There are three resolution paths:

1. **Resolve in the UI** — select **Update all**, then per conflicted item choose:
   - **Accept incoming changes**: overwrites the workspace item with the Git version; status becomes Synced.
   - **Keep current content**: keeps the workspace version; status becomes Uncommitted (still needs a commit to push it to Git).
2. **Revert to a previous synced state** — use **Undo** to revert the workspace, or `git revert` to roll back the branch. Reconnecting the workspace (disconnect → reconnect, choosing a sync direction) is a blunter variant: it overwrites **all** items in one location with the other's content, not just the conflicted ones.
3. **Resolve in Git** — checkout a new branch from the last synced state, commit your changes there, resolve the conflict with normal Git tooling (PR/merge) against the original branch, then switch the workspace back to the original branch.

> [!warning] Common Mistake
> A scenario question describing "resolve the conflict using a pull request and merge in Azure DevOps" is describing option 3 (resolve in Git) — not something Fabric does natively. Fabric's own UI only offers a binary accept/keep choice per item; anything requiring a three-way merge or code review has to happen on the Git provider's side.

**Practice Question 3** *(Hard)*

A semantic model was modified in both the connected Git branch (by a teammate's commit) and the workspace (by a local edit) since the last sync. The team wants a proper code review of the merge before it lands in the workspace, rather than simply picking one version. What's the correct approach?

A. Select "Accept incoming changes" in the UI conflict resolution dialog
B. Select "Keep current content" in the UI conflict resolution dialog
C. Checkout a new branch from the last synced state, commit the workspace changes there, resolve the conflict via a pull request in Git, then switch the workspace back to the original branch
D. Disconnect and reconnect the workspace, choosing to update from Git

> [!success]- Answer
> **C. Checkout a new branch from the last synced state, commit the workspace changes there, resolve the conflict via a pull request in Git, then switch the workspace back to the original branch**
>
> Options A, B, and D all pick one version wholesale — none of them support a reviewed, merged resolution. Only the "resolve in Git" path lets the team use normal PR/merge tooling to reconcile both sets of changes before the result flows back into the workspace.

---

## Permissions

Two permission systems apply independently: the **Fabric workspace role** and the **Git repo role**.

### Workspace roles

| Operation | Required workspace role |
| :--- | :--- |
| Connect / disconnect / sync workspace to Git repo | Admin |
| Switch branch or checkout a new branch | Admin (always); Contributor/Member with write access on all items, if **Allow users with at least Contributor role to change Git branch** is enabled |
| View Git connection details / Git status | Admin, Member, Contributor |
| Commit or update | Contributor (write on all items) — plus item ownership if the tenant blocks non-owner updates, plus Build on external dependencies where applicable |
| Branch out to another workspace | Admin, Member, Contributor |

Workspace **Viewers can't see any Git-related information** in the workspace at all.

### Git roles

- **Azure Repos**: Read=Allow covers connecting, syncing, and viewing status; committing additionally needs Contribute=Allow (and a branch policy that permits direct commits); creating a branch needs Role=Write + Create branch=Allow.
- **GitHub (fine-grained token)**: Contents=Read covers connecting/syncing/status; committing and branch creation need Contents=Read and write.

A workspace **Admin can always do everything a Contributor can**, limited only by their Git role — the workspace role hierarchy is additive, not a separate track.

---

## Limitations

- **Commit size caps**: Azure DevOps — 25 MB (service principal) / 125 MB (SSO user); GitHub — 50 MB combined per commit (split large commits into several).
- **Sensitivity labels** aren't exported by default; a tenant setting can enable exporting items with applied labels.
- **1,000-item workspace cap** applies to everything Git-managed; if a Git branch exceeds it, syncing to the workspace fails — split into more workspaces/branches/folders instead.
- **Submodules** and **sovereign clouds** aren't supported.
- **MyWorkspace** can never connect to Git; workspaces with **template apps installed** can't connect either.
- Folder structure syncs up to **10 levels deep**; directory/file names have their own character and length restrictions.
- You can only sync **one direction per action** — no simultaneous commit + update.
- Only [Git-supported items](#supported-items) sync; everything else is ignored, not deleted.

## Use Cases

- Teams wanting code review, rollback, and audit history on Fabric item definitions before they reach production
- Isolated feature development via branch-out, merged back through a normal PR workflow
- Standardizing on GitHub or Azure DevOps as the org's single source of truth for Fabric artifacts across many workspaces
- Recovering a workspace's prior state after an unwanted change, by reverting to a previous commit

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Commit button greyed out | Pending updates from Git haven't been applied yet | Update the workspace first, then commit |
| Item stuck as "Unsupported" in source control panel | Item type isn't on the Git integration supported-items list | Confirm support status against the official list; it isn't synced either direction |
| Can't connect workspace to Azure DevOps repo in a different region | Tenant admin hasn't enabled cross-geo export | Ask the tenant admin to enable cross-geo export (not required for GitHub) |
| Update fails with "workspace exceeds item limit" | Git branch has more items than the 1,000-item workspace cap | Split items across more workspaces/branches/folders |
| Branching out loses recent workspace edits | Items weren't committed to Git before the branch-out operation | Always commit pending changes before branching out |
| Switch branch is greyed out | User isn't a workspace Admin and the Contributor-branch-switch setting is off, or there are uncommitted changes | Enable the setting (Admin) or commit/undo pending changes first |
| Git status shows Conflict and won't clear | Same item changed in both workspace and Git branch since last sync | Resolve via UI accept/keep, revert, or resolve directly in Git (PR/merge) |

## Best Practices

- Commit early and often with meaningful messages — large, infrequent commits make conflict resolution much harder
- Use **branch out** for all non-trivial feature work instead of editing the shared connected branch directly
- Enable **Allow users with at least Contributor role to change Git branch** deliberately for teams that need it, not by default — it widens who can overwrite workspace content via branch switch
- Treat the supported-items list as a living document — check it before assuming an item type is (or isn't) versioned
- Prefer resolving genuine merge conflicts in Git (PR review) over the UI's binary accept/keep choice when the changes need reconciliation, not replacement

## Exam Tips

> [!tip] Exam Tips
>
> - Only Azure DevOps and GitHub (cloud, including GitHub Enterprise cloud) are supported — no on-prem GitHub Enterprise Server
> - Sync is one-directional per action: Commit (workspace → Git) or Update (Git → workspace), never both at once
> - Conflict = same item changed in both places since the last sync; three resolution paths: UI accept/keep, revert, or resolve in Git
> - Connect/disconnect/sync require workspace Admin; commit/update require Contributor+ with write access on all items
> - Unsupported items are ignored, not deleted — they stay visible in the source control panel

## Key Takeaways

- Git integration is workspace-level, one branch/folder at a time, against Azure DevOps or GitHub only
- Commit and Update move content in opposite directions and can't happen simultaneously
- Git status (Synced/Conflict/Uncommitted/Update required/Unsupported) drives what actions are available per item
- Branch out creates an isolated workspace linked to a new Git branch; switch branch overwrites the current workspace in place
- Conflicts have three resolution paths — UI pick, revert, or Git-side merge — each suited to a different scenario

## Related Topics

- [02-Database Projects](./02-database-projects.md)
- [03-Deployment Pipelines](./03-deployment-pipelines.md)

## Official Documentation

- [Overview of Fabric Git integration](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/intro-to-git-integration)
- [Get started with Git integration](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/git-get-started)
- [Git integration process (permissions, status, limitations)](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/git-integration-process)
- [Resolve conflicts with Git integration](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/conflict-resolution)
- [Development process using Branch-Out experience](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/branched-workspace)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../01-fabric-workspace-settings/04-airflow-settings.md) | [↑ Back to Section](./lifecycle-management.md) | [Next →](./02-database-projects.md)**
