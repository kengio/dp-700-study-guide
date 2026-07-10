---
title: Database Projects
type: topic
tags:
  - dp-700
  - fabric
  - sql-database-projects
  - sqlpackage
  - dacpac
  - cicd
  - lifecycle-management
---

# Database Projects

## Overview

A **SQL database project** is a declarative, file-based representation of a database's schema — tables, views, stored procedures, functions — that Fabric auto-generates the moment a Warehouse or SQL database item is committed to Git. This topic covers what database projects are, how `SqlPackage`/`.dacpac` deployment works, Schema Compare tooling, and when to reach for database projects versus deployment pipelines for promoting database schema changes.

> [!abstract]
>
> - Committing a Warehouse or SQL database to Git auto-converts it into a **SQL database project** (`.sqlproj`), one `.sql` file per object, organized `Schema/Object Type`
> - Building a database project produces a `.dacpac`; **SqlPackage** publishes that `.dacpac` to a target database, calculating only the differential change needed
> - **Schema Compare** (in the SQL Database Projects extension for VS Code) diffs a project against a live database and generates the update script — the interactive counterpart to a scripted SqlPackage publish
> - Database projects track *schema*, not data; **pre/post-deployment scripts** are the supported mechanism for managing small amounts of static reference data

> [!tip] What the Exam Tests
>
> - What a database project is, how it's generated, and its file/folder shape
> - The build → `.dacpac` → SqlPackage publish pipeline, and what SqlPackage does differently for new vs. existing databases
> - When to reach for Git + database projects vs. deployment pipelines for a given database lifecycle scenario
> - What isn't tracked by a database project (security features, data, database-level settings like collation)

---

## What a SQL Database Project Is

A SQL database project is **a local representation of the SQL objects that make up a single database's schema** — declarative T-SQL statements, one object defined exactly once. Change a column? Edit the one file that declares that table; you never hand-write `ALTER` scripts yourself. The underlying tooling is Microsoft's `Microsoft.SqlServer.DacFx` library, surfaced through the newer **SDK-style** project format (`Microsoft.Build.Sql`) — the format Fabric's SQL database integration and the VS Code **SQL Database Projects extension** both use.

In Fabric, database projects aren't something you set up manually — they're **generated automatically** the first time you commit a Warehouse or SQL database item to a Git-connected workspace. The folder structure mirrors `Schema/Object Type` (for example `dbo/Tables/Orders.sql`), and Fabric keeps the generated `.sqlproj` metadata file in sync on every commit — hand-editing that file is a documented anti-pattern since your edits get silently overwritten on the next commit from Fabric.

> [!warning] Common Mistake
> Don't hand-edit the auto-generated `.sqlproj` file thinking it will persist — Fabric regenerates and overwrites it on every commit from the service. If you need custom project settings (like a `master.dacpac` reference for local builds), add them *outside* what Fabric manages, or expect to reapply them after the next commit.

---

## Build and Deploy: SqlPackage and .dacpac

Building a database project produces a **`.dacpac`** — a portable, declarative artifact describing the target schema. `SqlPackage` (the DacFx command-line tool) then **publishes** that `.dacpac` to a database:

```text
sqlpackage /Action:Publish /SourceFile:yourfile.dacpac /TargetConnectionString:{connectionstring}
```

- **New database**: SqlPackage creates every object in dependency order (e.g., a referenced table before the table with the foreign key to it) — you never have to hand-sequence a folder of `CREATE` scripts.
- **Existing database**: SqlPackage diffs the `.dacpac` against the live schema and emits only the necessary `ALTER`/`CREATE`/`DROP` statements — a small column addition doesn't rebuild the whole table.

Fabric's own **Update from source control** action for a SQL database combines a project **build** (which validates syntax/references and emits the `.dacpac`) with a **SqlPackage publish** under the hood, using a fixed set of publish options tuned for the Fabric service:

| Publish option | Value | Effect |
| :--- | :--- | :--- |
| `ScriptDatabaseOptions` | `false` | Database-level settings (collation, etc.) aren't touched by the publish |
| `DoNotAlterReplicatedObjects` | `false` | Replicated objects can still be altered |
| `IncludeTransactionalScripts` | `true` | Publish wraps changes in transactions where supported |
| `GenerateSmartDefaults` | `true` | Fabric supplies defaults for new `NOT NULL` columns instead of failing the publish |

> [!note] Mental model — .dacpac as a shipping manifest
> Think of a `.dacpac` as a signed shipping manifest for a database's schema, not the cargo itself. SqlPackage reads the manifest and the destination's current inventory, then figures out the minimal set of moves (add this shelf, remove that one, resize this bin) to make the destination match the manifest — it never touches what's actually stored on the shelves (the data).

---

## Schema Compare

**Schema Compare** is the interactive counterpart to a scripted SqlPackage publish, available through the SQL Database Projects extension in Visual Studio Code (and SQL Server Management Studio / Visual Studio for non-Fabric SQL targets). It diffs two schema "endpoints" — a project, a `.dacpac`, or a live database — side by side, lets you review each detected difference, selectively include/exclude individual changes, and then generates (and optionally executes) the update script.

For Fabric development this matters most when:

- Validating what a **local** database project build will actually change in a **live** Fabric SQL database or Warehouse before committing — catching an unintended `DROP` before it ships.
- Reconciling drift after someone modified the live database directly (e.g., via SSMS) instead of through the tracked project — those changes surface as uncommitted changes in Fabric's own source control panel, and Schema Compare can show exactly what differs at the object level.

**Practice Question 1** *(Medium)*

A developer built a SQL database project locally and wants to preview exactly which `ALTER`/`CREATE`/`DROP` statements will run against a Fabric SQL database *before* committing the change, so a reviewer can approve the diff. Which tool accomplishes this?

A. Deployment pipelines' compare-stages view
B. Schema Compare in the SQL Database Projects extension for VS Code
C. The Fabric query editor's Object Explorer
D. Git's `diff` command against the `.sqlproj` file

> [!success]- Answer
> **B. Schema Compare in the SQL Database Projects extension for VS Code**
>
> Schema Compare is purpose-built to diff a project (or its built `.dacpac`) against a live database and generate a reviewable update script — exactly the "preview before commit" workflow described. Deployment pipelines' compare view (A) diffs pipeline *stages*, not a local project against a database. Git diff on the `.sqlproj` (D) only shows metadata changes, not the resulting SQL operations.

---

## Static Data: Pre- and Post-Deployment Scripts

A database project tracks **schema only** — table structure, not rows. To manage a small amount of static/reference data (a lookup table of colors, status codes, etc.) declaratively, Fabric supports **pre-deployment and post-deployment scripts**, stored under **Shared Queries** in the Fabric SQL editor:

1. Write a query (commonly a `MERGE` statement) that reconciles the target table's rows to the desired state.
2. Rename it (convention: `Post-Deployment-StaticData.sql`) and move it to **Shared Queries**.
3. Mark it via the `...` menu → **Set as Post-deployment Script**.

This script runs automatically on every **Update from source control** and every **deployment pipeline** promotion, giving you a version-controlled, idempotent way to keep reference data in sync — without ever touching the "data isn't copied" rule that governs both Git integration and deployment pipelines.

---

## Local Development Workflow with Visual Studio Code

For developers who prefer working outside the Fabric portal, or who have existing SQL project–based CI/CD requirements, the SQL database project lifecycle round-trips cleanly through Visual Studio Code:

1. Install VS Code with the **MSSQL** and **SQL Database Projects** extensions.
2. Create the SQL database in Fabric and commit it to source control **without any objects yet** — this seeds the empty project and item metadata in the repo.
3. Clone the repository locally, then check out the branch connected to the target workspace.
4. Author `.sql` files under the generated `<database>.SQLDatabase` folder structure (for example, a `CREATE TABLE` statement in `dbo/Tables/MyTable.sql`).
5. **Build** the project in VS Code's Database Projects view to validate syntax and references and to produce the `.dacpac`.
6. **Commit** and push the change through VS Code's own Git tooling.
7. Back in the Fabric portal, select **Update (Update All)** in the Source control panel to apply the change — this triggers the build + SqlPackage publish combination described above.

A known quirk: right after an update, the item can briefly show **Uncommitted** again, because Fabric's Git comparison is a literal file-content diff and can flag semantically insignificant regenerated attributes. Committing once more from the Fabric web interface resolves it.

### Branch Workspaces and Merging Database Changes

The same **branch out to a new workspace** mechanic used for other Fabric items (see [01-Version Control](./01-version-control.md)) applies to SQL database projects too, and is the standard pattern for isolated schema development:

1. From a Git-connected workspace with a committed database project, use **Branch out to new workspace** to create a linked branch + workspace pair. Fabric provisions a **new database** containing whatever objects were committed at that point.
2. Develop and commit schema changes against the branched workspace's database as usual.
3. Open a **pull request** in Azure DevOps or GitHub from the feature branch into the primary branch — the PR diff shows the database code changes for review, exactly like reviewing application code.
4. Completing the PR updates source control, but **does not** automatically change the primary workspace's live database — an explicit **Update** in the primary workspace's Source control panel is still required to apply the merged schema.

> [!warning] Common Mistake
> Merging a pull request into the primary branch does **not** push the change into the primary workspace's live database automatically. Source control and the live database are only reconciled by an explicit Update (or Commit, in the opposite direction) — a merged PR just means the *target branch* now has the change; someone still has to pull it into the workspace.

**Practice Question 2** *(Easy)*

A developer merges a pull request containing a new stored procedure into the primary branch connected to a production SQL database's workspace. What additional step is required before the procedure exists in the live database?

A. Nothing — merging the PR automatically updates the live database
B. Rebuild the `.dacpac` locally and run SqlPackage manually
C. Select Update (Update All) in the primary workspace's Source control panel
D. Branch out to a new workspace and switch back

> [!success]- Answer
> **C. Select Update (Update All) in the primary workspace's Source control panel**
>
> A merged PR only changes the contents of the Git branch — it doesn't push anything into Fabric automatically. The workspace still needs an explicit **Update** to pull the merged branch's contents in, which triggers Fabric's own build + SqlPackage publish process against the live database. Rebuilding manually with SqlPackage (B) would work outside Fabric entirely but skips the whole point of using Fabric's own Update action, and branching out (D) creates an unrelated new environment rather than updating the primary one.

---

## When to Use Database Projects vs. Deployment Pipelines vs. Git Integration

All three lifecycle tools can move a Fabric SQL database or Warehouse's schema from one place to another, but they solve different halves of the problem — and for Warehouse/SQL database specifically, Git integration and database projects aren't separate choices at all (database projects *are* what Git integration generates for these items).

| Dimension | Git Integration (+ Database Projects) | Deployment Pipelines |
| :--- | :--- | :--- |
| **Best for** | Incremental change tracking, code review, commit history at the individual-object level | Promoting a tested body of work through Dev → Test → Prod stages |
| **Granularity** | Per-object `.sql` files; diff/review one table or procedure at a time | Whole-item deployment (with selective deployment to choose which items) |
| **Underlying mechanism** | SQL database project build (`.dacpac`) + SqlPackage publish | Item pairing + Fabric-native copy, plus deployment rules for narrow config overrides |
| **Static data handling** | Pre/post-deployment scripts (both mechanisms honor these) | Same scripts run on deployment too — not a separate feature |
| **Stage-specific config** | Not built in — you'd branch or parameterize manually | **Deployment rules** — but only for the narrow set of item types that support them (see [03-Deployment Pipelines](./03-deployment-pipelines.md)) |
| **Support status for Warehouse** | Git integration: preview; database project generation: part of that preview | Preview |
| **Support status for SQL database** | GA | Preview |

> [!note] Mental model — Which lifecycle tool when
> **Git + database projects** is your day-to-day *editor's history* — every small schema edit, reviewed and versioned like application code. **Deployment pipelines** is the *release manager* — it doesn't care about individual `ALTER` statements, it cares about "is Test's content now what Dev approved, and is Prod now what Test verified." Use Git for the granular "what changed and why," and deployment pipelines for the coarse-grained "promote this whole workspace's tested state forward."

**Practice Question 3** *(Hard)*

A team's Fabric SQL database is Git-connected. A developer wants to (1) review every incremental schema change with a code reviewer via pull request before it reaches the shared Dev database, and separately (2) promote the fully-tested Dev schema to a Test workspace and then to Production on a release cadence. Which combination of tools fits both needs?

A. Use only deployment pipelines for both needs
B. Use Git integration + database projects (with PR review) for (1), and deployment pipelines for (2)
C. Use only Git integration for both — deployment pipelines can't handle SQL database items
D. Use deployment rules for (1) and Schema Compare for (2)

> [!success]- Answer
> **B. Use Git integration + database projects (with PR review) for (1), and deployment pipelines for (2)**
>
> This is exactly the split Microsoft's own guidance draws for Fabric Warehouse and SQL database: Git and database projects manage incremental change, team collaboration, and commit history at the object level (including PR-based review); deployment pipelines promote the resulting tested state across Dev/Test/Prod stages. Option A ignores that deployment pipelines don't give per-object PR review; option C is factually wrong (SQL database is a preview-supported deployment pipeline item); option D mismatches tools to needs — deployment rules configure stage-specific values, they don't provide code review, and Schema Compare doesn't perform stage promotion.

---

## Integration with Warehouse and SQL Database Items

- **Warehouse**: committing to Git converts the warehouse to a SQL database project; table data and SQL security features (roles, permissions, row-level security) are **not** included — migrate those via a scripted, post-deployment-script approach instead. Deployment pipelines don't expose the database project directly; they deploy the warehouse item as a whole.
- **SQL database**: the same project generation applies, plus first-class VS Code tooling — clone the repo, edit `.sql` files locally with the MSSQL + SQL Database Projects extensions, build to validate, then commit and let Fabric's **Update from source control** apply the diff.
- Both items share a documented gotcha: using `ALTER TABLE` to add a constraint or column in the database project currently causes the deployment process to **drop and recreate the table** — a data-loss risk requiring a create-new-table/copy-data/rename workaround (see Common Issues below).

## Use Cases

- Reviewing every schema change to a shared Dev Warehouse or SQL database via pull request before it merges
- Standing up a fresh branch workspace whose database schema exactly matches a known-good commit
- Keeping a small reference/lookup table's rows in sync across environments via a post-deployment script
- Locally validating a database project build (and previewing the generated diff with Schema Compare) before committing, to catch an unintended breaking change

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Deploying an `ALTER TABLE ... ADD` change drops and recreates the table, losing data | Documented limitation of the current database project deployment process for Warehouse/SQL database | Create a new table with `CREATE TABLE AS SELECT`/clone, apply the `ALTER`, drop the old table, rename via `sp_rename`, then update the project definition to match |
| Item shows "Uncommitted" immediately after an Update from source control | Fabric's file-content comparison flags semantically insignificant differences (e.g., inline column attribute ordering) | Commit again from the Fabric web interface to resync the generated definition |
| Security roles/permissions missing after restoring from a database project | SQL security features aren't included in the database project | Manage security via a scripted, post-deployment-script approach instead |
| `.sqlproj` edits keep disappearing | Fabric regenerates and overwrites the project file on every commit | Don't hand-edit the auto-generated file; add custom settings outside Fabric-managed sections, or reapply after each commit |
| Update from source control fails after a local project edit | Syntax error or unsupported feature in the SQL project | Fix and revert the change in source control before retrying — a failed update must be manually reverted |
| Static lookup table drifts between environments | No post-deployment script defined for that table | Add a `MERGE`-based post-deployment script under Shared Queries and mark it as the post-deployment script |

## Best Practices

- Never hand-edit Fabric's auto-generated `.sqlproj` — treat it as a build artifact, not a source file
- Validate a database project build locally (or via Schema Compare) before committing, especially for `ALTER TABLE` changes with the drop/recreate gotcha
- Use post-deployment scripts (not manual inserts) for any reference/lookup data that must stay consistent across environments
- Keep SQL security definitions in version-controlled scripts outside the database project, since they aren't tracked by it
- Clone the source-controlled project locally with VS Code + the SQL Database Projects extension for larger schema changes, rather than editing many objects one at a time in the Fabric portal

## Exam Tips

> [!tip] Exam Tips
>
> - Committing a Warehouse or SQL database to Git **auto-generates** a SQL database project — you don't author it from scratch
> - Build → `.dacpac` → SqlPackage publish is the deployment mechanism; SqlPackage diffs against existing databases and sequences creates for new ones
> - Data and SQL security features are **not** included in a database project — only schema
> - Git integration + database projects = incremental, reviewed change; deployment pipelines = stage promotion — know which scenario calls for which
> - The `ALTER TABLE` drop-and-recreate data-loss gotcha is a documented, exam-relevant limitation for both Git integration and deployment pipelines on Warehouse/SQL database

## Key Takeaways

- A SQL database project is Fabric's auto-generated, declarative schema representation for Git-connected Warehouse and SQL database items
- SqlPackage publish is the deployment engine underneath both manual `.dacpac` publishing and Fabric's own Update-from-source-control action
- Schema Compare gives an interactive, reviewable diff between a project and a live database — useful before committing or deploying
- Database projects and deployment pipelines are complementary, not competing: incremental review vs. stage promotion
- Static data uses pre/post-deployment scripts; SQL security and table data are explicitly out of scope for both tools

## Related Topics

- [01-Version Control](./01-version-control.md)
- [03-Deployment Pipelines](./03-deployment-pipelines.md)

## Official Documentation

- [Source control with Fabric Data Warehouse (Preview)](https://learn.microsoft.com/en-us/fabric/data-warehouse/source-control)
- [Fabric SQL database source control integration](https://learn.microsoft.com/en-us/fabric/database/sql/source-control)
- [What are SQL database projects?](https://learn.microsoft.com/en-us/sql/tools/sql-database-projects/sql-database-projects)
- [SqlPackage publish](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-publish)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-version-control.md) | [↑ Back to Section](./lifecycle-management.md) | [Next →](./03-deployment-pipelines.md)**
