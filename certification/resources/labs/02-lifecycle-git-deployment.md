---
title: "Lab 02: Lifecycle, Git & Deployment"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - git
  - version-control
  - cicd
  - deployment-pipelines
  - database-projects
status: complete
---

# Lab 02: Lifecycle, Git & Deployment

## Overview

This lab wires `dp700-labs` into Git, exercises the commit/update cycle, branches out to an isolated dev workspace, and builds a deployment pipeline to promote content across stages — the full Application Lifecycle Management (ALM) toolset Domain 1 tests.

It closes with a tour of database-project export/import, deferred to a full T-SQL treatment once a Warehouse exists in Lab 08.

> [!abstract]
>
> - Connects `dp700-labs` to a Git repository (GitHub or Azure DevOps — both auth paths documented)
> - Exercises commit → Git and update ← Git, deliberately triggers and resolves a Git conflict, plus branch-out to an isolated dev workspace
> - Builds a 3-stage deployment pipeline and deploys `dp700-labs` content into an empty Test stage
> - Configures a deployment rule (default-lakehouse rule on a notebook — one of the few item types deployment rules actually support)
> - Tours the SQL database project export/import workflow

All three ALM layers get exercised in the order a real team would meet them: **Git integration** for day-to-day item versioning, **deployment pipelines** for promoting a working set of items between environments, and **database projects** for schema-level review of the one item type (Warehouse/SQL database) that doesn't version well as an opaque blob. None of these three tools replaces another — this lab is designed to make that boundary tangible rather than just memorized.

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) completed — `dp700-labs` workspace with `lh_bronze` and the `nb-generate-dataset` notebook. You'll also need a **workspace Admin** role in `dp700-labs` (you have this by default if you created it) and a free GitHub account or Azure DevOps organization.
>
> **Estimated time:** 40 minutes

---

## Steps

### Step 1: Prepare a Git repository

Pick **one** provider — both work identically for the rest of this lab. Whichever you skip, keep the other's connection steps in mind: a real DP-700 scenario question is just as likely to describe the provider you didn't pick, and the mechanics genuinely differ (a PAT vs. an interactive sign-in) even though the end result — a workspace synced to a branch — looks the same either way.

**Option A — GitHub**

1. Create a new empty repository, e.g. `dp700-labs-git`, at [github.com/new](https://github.com/new). Don't initialize it with a README (an empty repo makes the first sync trivial).
2. Create a personal access token: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) (fine-grained, recommended) with **Contents: Read and write** permission scoped to the new repo. Copy the token now — GitHub only shows it once.
3. A [classic token](https://github.com/settings/tokens/new) with the full `repo` scope also works if you'd rather not scope a fine-grained token — it's less locked-down but simpler to set up for a throwaway lab repo. Fine-grained is the documented, recommended choice for anything beyond a one-off lab.

**Option B — Azure DevOps**

1. Create a free organization and project at [dev.azure.com](https://dev.azure.com) if you don't have one.
2. Create an empty Git repository inside the project, e.g. `dp700-labs-git`.
3. No token needed for the OAuth2 path — Fabric signs you in interactively when you connect (Step 2). A **service principal** authentication path also exists (needed for unattended CI/CD where no human signs in interactively) — it requires registering an app in Entra ID and granting it access to the Azure DevOps org separately; skip it for this hands-on lab and use interactive OAuth2 instead.

> [!success] Expected result
> An empty repository exists, and (GitHub only) you're holding a valid fine-grained PAT.

> [!warning] Common Mistake
> "GitHub Enterprise" on the exam means GitHub Enterprise **Cloud** (`.com`/`ghe.com`) only — an on-premises GitHub Enterprise Server instance is explicitly **not supported** for Git integration, even if it's publicly reachable. If your organization runs a self-hosted GitHub Enterprise Server, use Azure DevOps for this lab (and in a real project) instead.

> [!note]
> Neither provider requires a paid tier for this lab — a free GitHub account and a free Azure DevOps organization both support everything Git integration needs.

### Step 2: Connect `dp700-labs` to Git

1. In `dp700-labs`: **Workspace settings → Git integration**.
2. Select your provider.
   - **GitHub**: **Add account** → paste display name + personal access token → **Connect**.
   - **Azure DevOps**: **Connect** → sign in with the Entra account tied to your Azure DevOps org.
3. Fill in the connection target:
   - **GitHub**: Repository URL, Branch (**+ New Branch** → `main` if none exists), Folder (leave blank for repo root).
   - **Azure DevOps**: Organization → Project → Repository → Branch → Folder.
4. Select **Connect and sync**. Since the workspace has content and the repo is empty, Fabric copies workspace content **to** Git automatically — no direction prompt appears.

> [!success] Expected result
> The **Source control** icon (top of the workspace) shows **Synced**. Refreshing the GitHub/Azure DevOps repo in your browser shows folders matching your Fabric item types (`lh_bronze.Lakehouse`, `nb-generate-dataset.Notebook`, and so on).
>
> Open one of the generated folders — `lh_bronze.Lakehouse`, for example — and note what's actually inside: a handful of small metadata/definition files (item properties, references), not the lakehouse's Delta table data. This is the same "definitions, not data" boundary you'll see again in Step 7's deployment pipeline.

> [!warning] Common Mistake
> Connecting requires the workspace **Admin** role — if you're a Member/Contributor in `dp700-labs`, the Git integration option won't let you connect. This matches [01-Version Control](../../02-lifecycle-management/01-version-control.md#connecting-a-workspace-to-git).

> [!note] Two independent permission layers
> Connecting, committing, and updating all require **both** a sufficient Fabric workspace role **and** a matching Git repo permission — one without the other blocks the action. For GitHub with a fine-grained token, `Contents: Read` alone covers connecting/syncing/status, but committing and branch creation need `Contents: Read and write` — which is why Step 1 asked for read-and-write up front. For Azure DevOps, `Read=Allow` covers connecting and viewing status, while committing additionally needs `Contribute=Allow` (plus a branch policy permitting direct commits) and creating a branch needs `Role=Write` + `Create branch=Allow`. A workspace Admin can always do everything a Contributor can, but is still capped by whatever their Git role allows — the two tracks are additive on the Fabric side, independent on the Git side.

### Step 3: Exercise the commit cycle

1. Open `nb-generate-dataset` and add a comment cell at the top: `# DP-700 lab pack — Lab 02 commit exercise`. Save the notebook.
2. Go to **Source control** (icon shows a badge with `1` uncommitted change) → **Changes** tab.
3. Select the checkbox next to `nb-generate-dataset`, type a commit message (`"Lab 02: add header comment"`), select **Commit**.

> [!success] Expected result
> The item's status flips from **Uncommitted** to **Synced**, and the badge on the Source control icon clears. The commit is now visible in your Git provider's history.
>
> If you left the commit message box blank, note that Fabric auto-generated a default message rather than blocking the commit — worth knowing, but don't rely on it for anything beyond a lab: a real team's commit history is only as useful as the messages attached to it.

### Step 4: Exercise Update from Git

Since you're working solo, simulate a teammate's change directly in Git:

1. In GitHub/Azure DevOps, edit `nb-generate-dataset.Notebook`'s definition file directly in the web UI (a trivial whitespace or comment change is enough) and commit it to the connected branch.
2. Back in Fabric, a notification badge appears on **Source control**. Open **Updates** → **Update all** → confirm.

> [!success] Expected result
> The item's status returns to **Synced**, and the notebook in the Fabric portal reflects the change you made directly in Git — proving the Git → workspace direction works, not just workspace → Git.

> [!note]
> Real teams get this "someone else committed" scenario for free — this step exists only because a solo lab has no second person to generate it for you.

### Step 5: Trigger and resolve a Git conflict

A **conflict** happens when the *same item* changes in both the workspace and the Git branch since the last sync. Manufacture one deliberately so you can practice the resolution flow instead of only reading about it:

1. In the Fabric portal, edit `nb-generate-dataset` (add another trivial comment cell) and **save it** — don't commit yet.
2. In GitHub/Azure DevOps, edit the **same file** (`nb-generate-dataset.Notebook`'s definition) directly in the web UI with a different change, and commit it to the connected branch.
3. Back in Fabric, open **Source control**. `nb-generate-dataset` now shows status **Conflict**, and **Commit** is disabled.
4. Resolve it: open **Updates**, select **Update all**, then for the conflicted item choose one of:
   - **Accept incoming changes** — overwrites your local edit with the Git version.
   - **Keep current content** — keeps your local edit; status becomes **Uncommitted**, still needing a commit afterward.
5. Pick **Keep current content**, then commit it normally (as in Step 3) to push your version back to Git.

> [!success] Expected result
> Before resolution, `nb-generate-dataset` shows the **Conflict** icon and the Commit button is greyed out. After choosing **Keep current content** and committing, the item returns to **Synced**, and the Git provider's commit history shows your version as the latest commit on the branch.

> [!warning] Common Mistake
> Fabric's UI conflict resolution is a **binary accept/keep choice** — it isn't a three-way merge. A scenario requiring an actual code-reviewed merge of both changes needs the "resolve in Git" path instead: checkout a new branch from the last synced state, commit there, open a pull request against the original branch, resolve the conflict with normal Git tooling, then switch the workspace back. See [01-Version Control § Conflict Resolution](../../02-lifecycle-management/01-version-control.md#conflict-resolution).

### Step 6: Branch out to an isolated dev workspace

1. **Source control** → look for **Branch out to a new workspace** (or via the workspace's context menu).
2. New workspace name: `dp700-labs-dev`. New branch name: `dev`. Leave **Select items individually** off (default: all items come along).
3. Select **Branch out**.

> [!success] Expected result
> A new workspace `dp700-labs-dev` appears, connected to a new `dev` Git branch, containing the same items as `dp700-labs` at the time of branching. The workspace tree shows a parent/child relationship back to `dp700-labs`.

> [!warning] Common Mistake
> Anything **uncommitted** in `dp700-labs` at branch-out time is left behind — always commit first (you did, in Step 3). This matches [01-Version Control § Branching Out](../../02-lifecycle-management/01-version-control.md#branching-out-to-a-new-workspace).

By this point you've personally triggered every Git status indicator Domain 1 tests. Before moving on, match what you saw against the full list:

| Status | When you saw it in this lab |
| :--- | :--- |
| **Synced** | Immediately after the initial connect (Step 2), and after every successful commit or update |
| **Uncommitted changes** | After editing `nb-generate-dataset` in Step 3, before committing |
| **Update required** | After the direct Git edit in Step 4, before running Update all |
| **Conflict** | After editing the same item in both places in Step 5, before resolving |

`dp700-labs-dev`, the branched workspace from this step, won't be touched again in this lab pack — its only purpose was letting you feel the branch-out mechanic once.

### Step 7: Build a deployment pipeline and deploy to an empty Test stage

1. From the Workspaces flyout, select **Deployment pipelines → Create pipeline**. Name: `dp700-pipeline`.
2. Accept the default 3 stages: **Development**, **Test**, **Production**.
3. Assign `dp700-labs` to the **Development** stage (this workspace already exists, so use **Assign a workspace** on that stage rather than "deploy to empty" — no content is copied by an assignment).
4. On the **Test** stage, select **Deploy** (this stage has no workspace yet, so deploying creates a brand-new one and copies content into it). Confirm the deployment.

> [!success] Expected result
> A new workspace (something like `dp700-pipeline [Test]`) appears as the Test stage's backing workspace, containing copies of `lh_bronze` and `nb-generate-dataset`. The pipeline canvas shows **Development** and **Test** with matching item counts and a **Last deployed** timestamp on Test.

> [!note]
> Remember what did **not** move: the Delta table **data** inside the copied `lh_bronze` did not come along — only metadata/schema. If you check the Test-stage lakehouse's Tables section, the tables exist but are empty until you manually reload them. This is the single most-tested fact in [03-Deployment Pipelines](../../02-lifecycle-management/03-deployment-pipelines.md#what-gets-deployed--and-what-doesnt).

**Mini-exercise — see item pairing in action:** rename `nb-generate-dataset` in the Development-stage workspace to `nb-generate-dataset-v2`, then select **Deploy** on the Test stage again.

> [!success] Expected result
> Because pairing is derived from **name + type** at deploy time and the item's URL/ID stays stable across a rename, the Test-stage notebook is still recognized as the same paired item — it gets renamed to match, not duplicated. Rename the Test-stage `nb-generate-dataset-v2` back to `nb-generate-dataset` afterward (or leave it, if you're comfortable — no later lab in this pack touches the Test-stage workspace directly) to avoid confusion later. If you instead deployed a *new* item that happened to share a name with an already-unpaired Test-stage item, you'd see two separate items on adjacent lines in the content list rather than one paired line — that's the signal to check before any real production deployment.

### Step 8: Configure a deployment rule on the notebook

Deployment rules only support a narrow list of item types — Dataflow Gen1, semantic model, paginated report, mirrored database, and **notebook (default-lakehouse rule only)**. Use the notebook:

1. In the pipeline's **Test** stage, open `nb-generate-dataset` → item settings → **Deployment rules** (or via the pipeline's rule configuration panel for that item).
2. Add a **Default lakehouse** rule pointing at the Test stage's own copy of `lh_bronze` (not Development's).
3. Save the rule.

> [!success] Expected result
> A rule icon appears next to `nb-generate-dataset` in the Test stage. Redeploy Development → Test (**Deploy** again) and confirm the notebook in Test still points at the Test-stage `lh_bronze`, not Development's — the rule survives the redeploy instead of being overwritten, which is exactly what a deployment rule is for.

> [!warning] Common Mistake
> Don't try to add this rule to a Lakehouse, Warehouse, or Pipeline item — deployment rules simply don't exist for those types. A scenario asking for a Warehouse connection-string rule is testing whether you know it's unsupported (see [03-Deployment Pipelines § Deployment Rules](../../02-lifecycle-management/03-deployment-pipelines.md#deployment-rules)).

### Step 9: Tour database project export/import

This lab pack doesn't provision a Warehouse until [Lab 08](./08-warehouse-tsql.md), so treat this step as a read-only portal/tooling tour rather than a hands-on build. One fact worth flagging now: **Warehouse** is currently listed as a **preview** item on the Git-supported-items list, alongside GA items like Lakehouse, Notebook, Pipeline, and SQL database — a status that changes over time, so verify it against the [official supported-items list](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/intro-to-git-integration#supported-items) rather than trusting this or any other static snapshot.

1. Read [02-Database Projects](../../02-lifecycle-management/02-database-projects.md) for the concept: once a Warehouse or SQL database is committed to Git, Fabric auto-generates a `.sqlproj` representation of its schema.
2. If you have the [SQL Database Projects extension](https://learn.microsoft.com/en-us/sql/tools/sql-database-projects/sql-database-projects-extension) installed in VS Code, open the Git repo you created in Step 1 locally after Lab 08 lands a Warehouse in it, and inspect the generated `.sqlproj`/`.sql` files — that's the artifact this workflow produces. The generated layout looks roughly like:

```text
wh_gold.Warehouse/
├── wh_gold.sqlproj
└── dbo/
    ├── Tables/
    │   └── Customers.sql
    └── Security/
        ├── CustomerRegionFilter.sql        # the security policy from Lab 03
        └── tvf_regionpredicate.sql          # the predicate function
```

1. Note the two-tool relationship: **Schema Compare** diffs the project against a live database; **SqlPackage**/`.dacpac` is the deploy mechanism — neither is exercised hands-on until Lab 08 gives you a Warehouse to commit.
2. Note when you'd reach for a database project instead of a deployment pipeline: a deployment pipeline promotes an entire Warehouse item (and everything else in the workspace) between stages; a database project targets **schema-level** changes to one database, diffable and reviewable object-by-object in a pull request — useful when a team wants code review on individual `CREATE TABLE`/`CREATE SECURITY POLICY` statements rather than an opaque item-level deploy.

> [!success] Expected result
> You can explain, without running it yet, what a database project *is* (a Git-versioned `.sqlproj` schema representation) and *why* it exists (schema-level version control and diffing for Warehouse/SQL database items, which don't otherwise version well as opaque items), and articulate one concrete reason to prefer it over a deployment pipeline for a given change.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| **Connect** button greyed out in Git integration settings | You're a Member/Contributor, not an Admin, in `dp700-labs` | Have a workspace Admin connect it, or take Admin yourself |
| **Commit** button disabled after Step 4/5 | Pending updates from Git haven't been pulled into the workspace yet | Run **Update all** first — sync is one direction per action |
| GitHub connection fails with an authorization error | Personal access token lacks **Contents: Read and write**, or has expired | Regenerate the fine-grained token with the correct repository permission |
| Test-stage deployment in Step 7 copies schema but the lakehouse tables are empty | Expected — deployments never copy **data**, only metadata/schema | Manually reload the Test-stage tables if you need populated data there |
| Deployment rule from Step 8 silently stops applying after a redeploy | The rule targets a lakehouse that was later renamed or deleted | Reconfigure the rule against the item's current default lakehouse |

## Cleanup

**Keep**:

- `dp700-labs`, still connected to Git — later labs keep committing to it, and the habit of checking Source control after each lab is worth building now
- The Git repository itself (`dp700-labs-git`) — Lab 08 will commit a Warehouse into it for the database-project tour to become concrete

**Safe to delete** (not referenced by any later lab):

- `dp700-labs-dev` (the branched-out workspace from Step 6) — its only purpose was demonstrating the branch-out mechanic
- The Test-stage workspace created by `dp700-pipeline` in Step 7, and the pipeline itself, **if** you want to conserve trial capacity — unassign it from the pipeline first (**View Deployment Pipeline** from the workspace page) before deleting, or deletion fails outright

If you keep `dp700-pipeline`, no further lab depends on it — feel free to leave it as a reference for later study. Either way, double-check that `dp700-labs` itself (the Development-stage workspace, and the one every remaining lab uses) is untouched — only the derived workspaces (`dp700-labs-dev`, the Test-stage workspace) are candidates for cleanup here.

> [!note] Why this matters for the exam, not just this lab
> The single most common way candidates lose points on lifecycle-management scenario questions is conflating "deployed" with "the same as production now." Every mechanic you exercised in this lab — pairing, deployment rules, what does/doesn't copy — exists specifically because a deployment pipeline promotes **definitions**, not a running, data-populated environment. Keep that distinction sharp heading into Lab 08, where you'll commit a real Warehouse schema through this same Git connection.

## What the Exam Asks About This

- [01-Version Control](../../02-lifecycle-management/01-version-control.md) — Git providers, commit/update mechanics, branching out, conflict resolution, permissions
- [02-Database Projects](../../02-lifecycle-management/02-database-projects.md) — `.sqlproj`/dacpac workflow, Schema Compare, when to use it vs. deployment pipelines
- [03-Deployment Pipelines](../../02-lifecycle-management/03-deployment-pipelines.md) — stages, item pairing, deployment rules, what is/isn't copied by a deployment

Pair this lab with the [Lifecycle & CI/CD cheat sheet](../cheat-sheets/lifecycle-cicd-quick-ref.md) for a compact recap of everything you just did by hand — Git status indicators, deployment-rule item coverage, and the full what-gets-deployed/what-doesn't table.

---

**[← Previous: Lab 01](./01-workspace-capacity-setup.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 03: Security, OneLake & DDM](./03-security-onelake-ddm.md)**
