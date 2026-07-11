---
title: "DP-700 Mock Exam 1 — Questions"
type: practice-questions
tags:
  - dp-700
  - mock-exam
---

# DP-700 Mock Exam 1 — Questions

Complete all 50 questions (45 standalone + 5-question case study) before checking answers. Time limit: 100 minutes.

---

<!-- DOMAIN 1: Implement and Manage an Analytics Solution (~15 questions) -->

## Question 1: High Concurrency Mode's Default Sharing Limit *(Medium)*

A workspace admin enables high concurrency mode for notebooks so that multiple data analysts running similar ad hoc queries can share a single Spark session and reduce compute cost. No additional Spark properties are configured. Which statement about the resulting behavior is correct?

A. Up to 50 notebooks can share the session by default, and each is billed separately for its share of compute  
B. Up to 5 notebooks can share the session by default, and only the initiating notebook is billed for the session  
C. Up to 5 notebooks can share the session by default, and billing is split evenly across every attached notebook  
D. Up to 50 notebooks can share the session by default, and only the initiating notebook is billed for the session  

> [!success]- Answer
> **B. Up to 5 notebooks can share the session by default, and only the initiating notebook is billed for the session**
>
> High concurrency mode's default session-sharing limit is 5 notebooks (raisable to 50 via `spark.highConcurrency.max`), and only the notebook that initiated the shared session incurs the compute charge — the others ride along at no extra cost.
>
> Option A gets both numbers and the billing model wrong: the default is 5, not 50, and per-notebook billing isn't how shared sessions are charged. Option C keeps the correct default of 5 but invents an even-split billing model that doesn't exist. Option D has the right billing model but the wrong default limit — 50 is the *raised* ceiling via `spark.highConcurrency.max`, not the out-of-the-box default.

---

## Question 2: Domain Assignment and Item Access *(Easy)*

A tenant admin is troubleshooting a report that a user assigned to the "Sales" domain cannot open a workspace item, even though the user has Contributor access to the workspace. What is the most likely explanation?

A. Domain assignment doesn't grant or restrict item access — the issue is a workspace role or item-permission problem  
B. The user's domain administrator must first approve their access before workspace roles take effect  
C. Contributor role only grants access within the domain's default workspace, not others assigned to the same domain  
D. The workspace must be marked as the domain's "default domain" before Contributor access is honored  

> [!success]- Answer
> **A. Domain assignment does not grant or restrict item access — the issue must be a workspace role or item-permission problem, unrelated to the domain**
>
> Domain assignment affects discovery and delegated governance, never access — access is workspace role + item permissions, full stop. This is one of the most tested facts about domains.
>
> Option B invents an approval gate that domain admins don't have over workspace-role access. Option C invents a default-workspace restriction that doesn't exist — Contributor access applies to the workspace it's granted in, regardless of domain assignment. Option D confuses default domain (which governs *future* workspace creation) with an access gate on an existing workspace.

---

## Question 3: OneLake File Explorer Pull Sync *(Medium)*

A developer mounts a Lakehouse's `Files` folder via OneLake file explorer on their laptop. A colleague uploads a new file directly through the Fabric portal. Without the developer taking any action, what happens to that new file in the developer's local OneLake file explorer view?

A. It appears immediately, since OneLake file explorer keeps a full local copy in sync in both directions automatically  
B. It appears only after the developer's laptop restarts, since sync runs on a boot-time schedule, not on file arrival  
C. It never appears, since OneLake file explorer only reflects files the developer personally uploaded themselves  
D. It doesn't appear until a manual Sync from OneLake, since remote changes aren't pulled automatically  

> [!success]- Answer
> **D. It doesn't appear until the developer manually runs Sync from OneLake, since remote changes aren't pulled automatically**
>
> OneLake file explorer syncs metadata as placeholders, not full downloads, and only pushes local changes automatically — pulling remote changes needs a manual Sync from OneLake action.
>
> Option A overstates automatic bidirectional sync — only the local-to-remote direction is automatic. Option B invents a boot-time sync schedule that doesn't exist. Option C is too restrictive — the file does eventually appear, just not without the manual sync step.

---

## Question 4: Apache Airflow Job on PPU with a VNet Requirement *(Hard)*

A team wants to run Apache Airflow jobs in a Fabric workspace that is currently on a Premium Per User (PPU) license, and they also require the Airflow environment to run inside their organization's private VNet for compliance. Which statement correctly describes what's achievable today?

A. Both requirements are supported today, since Apache Airflow job runs on any licensed Fabric workspace with VNet support enabled  
B. The VNet requirement is supported, but PPU workspaces must first be upgraded to a Fabric capacity before Airflow jobs will run  
C. Neither requirement is achievable today — Apache Airflow job doesn't support Free/PPU workspaces or private networks/VNets  
D. The PPU limitation is a licensing issue that support can waive; the VNet limitation is a hard platform constraint  

> [!success]- Answer
> **C. Neither requirement is achievable today — Apache Airflow job doesn't support Free/PPU workspaces or private networks/VNets**
>
> Free and PPU workspaces don't support Apache Airflow jobs, and private networks/VNets aren't supported yet either — this scenario stacks both documented limitations at once.
>
> Option A ignores both limitations. Option B correctly flags the PPU issue (a capacity upgrade would fix that part) but wrongly implies the VNet requirement is already supported — it isn't. Option D invents a support-waivable licensing gate; the PPU restriction isn't something a support ticket can override, it requires an actual capacity workspace.

---

## Question 5: Commit and Update in a Single Action *(Easy)*

A developer wants to both pull the latest changes from Git into their workspace and push their own uncommitted workspace changes to Git, in a single action. Is this possible in Fabric Git integration?

A. No — sync is always one-directional per action, Commit or Update, never both together  
B. Yes, using the "Sync workspace" action, which performs Commit and Update together  
C. Yes, but only for workspaces connected to GitHub, not for ones connected to Azure DevOps  
D. No — Fabric requires disconnecting and reconnecting Git integration between a Commit and an Update  

> [!success]- Answer
> **A. No — sync is one-directional per action; Commit (workspace → Git) and Update (Git → workspace) are always separate operations**
>
> Sync is one-directional per action: Commit (workspace → Git) or Update (Git → workspace), never both at once.
>
> Option B invents a combined "Sync workspace" action that doesn't exist. Option C invents a GitHub-only capability difference — the one-directional constraint applies identically regardless of Git provider. Option D wildly overstates the friction — no disconnect/reconnect cycle is required between separate Commit and Update actions.

---

## Question 6: Auto-Generating a SQL Database Project *(Medium)*

A team connects their Fabric Warehouse to Git for the first time and expects to need to hand-author a SQL database project to represent the schema before committing. What actually happens?

A. Git integration refuses to connect until a SQL database project is manually created and linked  
B. The team must import the schema using SqlPackage before Git integration will recognize the Warehouse  
C. A blank SQL database project is created, and every table must be defined manually before committing  
D. Fabric automatically generates the SQL database project's schema — there's no manual authoring step  

> [!success]- Answer
> **D. Fabric automatically generates the SQL database project's schema representation — there's no manual authoring step**
>
> Committing a Warehouse or SQL database to Git auto-generates a SQL database project — you don't author it from scratch; Fabric derives the declarative schema files directly from the live database.
>
> Option A invents a connection prerequisite that doesn't exist. Option B confuses SqlPackage (the deployment engine used later) with the initial project-generation step, which Fabric handles automatically. Option C imagines a blank starting point requiring full manual authoring — the opposite of what "auto-generates" means.

---

## Question 7: Data Movement During a Pipeline Deployment *(Hard)*

A team runs a deployment from the Test stage to the Production stage of a deployment pipeline. Production currently holds a Warehouse with 2 million rows of existing data, populated separately by a nightly load process. What happens to that Production data during the deployment?

A. It's overwritten with Test stage's data, since deployment pipelines synchronize both schema and data across stages  
B. It's untouched — deployment pipelines never move data, only metadata and schema, regardless of direction  
C. It's merged with Test stage's data using the Warehouse's primary key, avoiding duplicate rows  
D. It's backed up automatically before the deployment, then overwritten with Test stage's data  

> [!success]- Answer
> **B. It's untouched — deployment pipelines never move data, only metadata and schema, regardless of direction**
>
> Data is never deployed — the single most tested fact about deployment pipelines; only metadata/schema moves between stages, so Production's existing 2 million rows are completely unaffected by the deployment.
>
> Option A, C, and D all assume some form of data movement (full overwrite, merge, or backup-then-overwrite) — deployment pipelines don't move data under any of these mechanisms; that responsibility stays entirely with the team's own load processes.

---

## Question 8: Viewer Role and OneLake API Access *(Medium)*

A user with the Viewer role in a workspace wants to query a Lakehouse table using a Spark notebook via the OneLake APIs. Can they do this with just the Viewer role?

A. Yes — Viewer includes ReadAll by default, identical to every other workspace role  
B. No — Viewer can't access the data at all, through any surface, including the SQL analytics endpoint  
C. No — Viewer gets ReadData (SQL endpoint) but not ReadAll (OneLake APIs/Spark), which is Admin/Member/Contributor-only  
D. Yes, but only if the Lakehouse owner explicitly grants the Viewer a separate Spark-execution permission  

> [!success]- Answer
> **C. No — Viewer gets ReadData (SQL analytics endpoint) but not ReadAll (OneLake APIs/Spark), which is restricted to Admin/Member/Contributor**
>
> All four workspace roles get ReadData (TDS/T-SQL, i.e., the SQL analytics endpoint), but only Admin, Member, and Contributor get ReadAll (OneLake APIs/Spark) by default — this split is the single most tested fact in this topic, and it means a Viewer can query via SQL but not via Spark/OneLake APIs.
>
> Option A wrongly extends ReadAll to Viewer. Option B is too restrictive — Viewer does have SQL-endpoint access via ReadData, just not the Spark/OneLake path. Option D invents a per-item "Spark-execution permission" that doesn't exist — ReadAll is a role-level default, not an item-grantable capability.

---

## Question 9: SQL-Endpoint RLS and a Direct Spark Read *(Medium)*

A Fabric Warehouse table has a row-level security policy applied via `CREATE SECURITY POLICY` with a filter predicate. A data engineer then queries the same underlying Delta table directly from a Spark notebook using the Lakehouse's OneLake APIs. What do they see?

A. The same filtered rows the RLS policy would return, since RLS is enforced at the storage layer  
B. An error, since Spark can't read a table that has RLS applied through the SQL analytics endpoint  
C. Only the rows the notebook's Spark session's SQL context allows, since Spark inherits SQL Server-style security policies  
D. All rows, unfiltered — SQL-endpoint RLS applies only to SQL analytics endpoint/Warehouse queries, not Spark or OneLake API access  

> [!success]- Answer
> **D. All rows, unfiltered — SQL-endpoint RLS applies only to SQL analytics endpoint/Warehouse queries, not Spark or OneLake API access**
>
> RLS, CLS, and OLS configured through T-SQL apply only to SQL analytics endpoint / Warehouse queries — Spark and OneLake API access read the underlying files directly and need a separate OneLake data access role to enforce an equivalent restriction.
>
> Option A assumes RLS is a storage-layer control, but it's a SQL-query-layer control — nothing prevents a direct file read. Option B invents an error condition that doesn't exist; Spark simply isn't security-policy-aware here. Option C imagines Spark inheriting SQL Server security policies, which isn't how the two engines' security models relate.

---

## Question 10: OneLake Security Roles on a Warehouse *(Hard)*

A security architect wants to apply a custom OneLake security role that restricts a specific user to a folder subset within a Fabric Warehouse's underlying OneLake storage. Is this achievable using OneLake security roles?

A. No — Warehouse isn't on the supported OneLake security role item-type list, unlike Lakehouse or Mirrored Database  
B. Yes, as long as the Warehouse's workspace has OneLake security roles explicitly enabled at the workspace-wide settings level first  
C. Yes, but only for read access — write restrictions via OneLake security roles aren't supported on Warehouse  
D. No — OneLake security roles apply only to Spark-accessed items, and Warehouse is queried exclusively via T-SQL  

> [!success]- Answer
> **A. No — OneLake security roles today support Lakehouse, Azure Databricks Mirrored Catalog, and Mirrored Database only; Warehouse isn't in that list**
>
> Only Lakehouse, Azure Databricks Mirrored Catalog, and Mirrored Database support OneLake security roles today — Warehouse isn't one of the supported item types, so folder-level OneLake security roles simply can't be applied to it; Warehouse-level access control instead goes through T-SQL RLS/CLS/OLS.
>
> Option B invents a workspace-level enablement toggle that doesn't exist — support is determined by item type, not a workspace setting. Option C invents a read-only carve-out; the limitation is total exclusion, not a read/write split. Option D gets the reasoning backward — OneLake security roles aren't Spark-exclusive (Lakehouse access via SQL endpoint and Direct Lake also honor them); the real reason is Warehouse's item type isn't on the supported list.

---

## Question 11: Who Sees Unmasked Values by Default *(Easy)*

A workspace Contributor queries a table with a dynamic data masking rule applied to a column. Do they see the real, unmasked values by default?

A. No — only the Fabric workspace Admin role can ever see unmasked values, regardless of any granted permission  
B. Yes — Admin, Member, and Contributor workspace roles implicitly have the CONTROL permission that reveals unmasked values  
C. No — UNMASK must always be granted individually per user, no matter their workspace role  
D. Yes, but only if the column uses the default() masking function; other mask types always stay hidden from Contributor  

> [!success]- Answer
> **B. Yes — Admin, Member, and Contributor workspace roles implicitly have the CONTROL permission that reveals unmasked values**
>
> `UNMASK` permission (or `CONTROL` on the database) reveals real values, and Fabric's Admin, Member, and Contributor workspace roles have `CONTROL` implicitly — so a Contributor sees unmasked data by default, without any extra grant.
>
> Option A is too restrictive — Member and Contributor share this implicit privilege with Admin. Option C is wrong because the implicit CONTROL grant means individual UNMASK grants aren't always required. Option D invents a distinction between mask function types that doesn't exist — the UNMASK/CONTROL rule applies uniformly regardless of which of the four functions is used.

---

## Question 12: Sensitivity Label Inheritance from Power BI to Fabric *(Easy)*

A Power BI report, created independently in the Power BI service, has a "Confidential" sensitivity label applied. A data engineer then builds a Fabric Lakehouse-based semantic model that references data originally sourced from that report. Does the Lakehouse-side semantic model inherit the report's "Confidential" label?

A. Yes — sensitivity labels always propagate in both directions between Power BI and Fabric items  
B. Yes, but only if the tenant has separately enabled mandatory sensitivity labeling  
C. No — inheritance flows Fabric → Power BI, not the reverse; this is the one unsupported direction  
D. No — sensitivity labels never cross between Power BI and Fabric items in either direction  

> [!success]- Answer
> **C. No — label inheritance flows Fabric → Power BI, not Power BI → Fabric; this is the one unsupported direction**
>
> Sensitivity label inheritance works Fabric → Fabric and Fabric → Power BI, but not the reverse — Power BI → Fabric is the one documented unsupported direction, worth memorizing exactly because it's the exception.
>
> Option A overstates propagation as bidirectional. Option B invents a mandatory-labeling dependency that doesn't govern this specific directional rule. Option D overcorrects — inheritance does work in the other direction (Fabric → Power BI), just not this one.

---

## Question 13: Composing Three Tools for One Requirement *(Medium)*

A team needs to ingest data using a low-code connector-based extraction that a citizen developer maintains, then apply a custom fuzzy-matching algorithm that has no built-in equivalent, and finally trigger both steps on a schedule with a failure-notification branch. Which architecture best fits all three requirements?

A. A pipeline that schedules and sequences a Dataflow Gen2 activity followed by a Notebook activity, with an Upon Failure branch for notification  
B. A single Dataflow Gen2 with a custom Power Query M function to replicate the fuzzy-matching logic, scheduled independently  
C. A single notebook that both extracts the data with library-based connectors and implements the fuzzy-matching logic, scheduled independently  
D. Two independently scheduled items — a Dataflow Gen2 for extraction and a notebook for matching — with no orchestration layer between them  

> [!success]- Answer
> **A. A pipeline that schedules and sequences a Dataflow Gen2 activity followed by a Notebook activity, with an Upon Failure branch for notification**
>
> This scenario stacks a citizen-developer/low-code signal (Dataflow Gen2), a custom-logic-with-no-built-in-equivalent signal (notebook), and a scheduling-with-failure-branch requirement (only a pipeline provides control flow and failure branching across items) — a composed pipeline is the textbook correct answer over any single tool.
>
> Option B tries to force fuzzy-matching into Power Query, which has no built-in equivalent for it — technically painful and not the citizen-developer-friendly path anymore. Option C forces the low-code extraction into custom Spark code, discarding the citizen-developer skillset signal. Option D gets the right two tools but drops the actual requirement — scheduling both steps together with a failure branch needs a pipeline as the coordinating layer.

---

## Question 14: Notebook Execution Identity by Trigger Type *(Medium)*

A notebook is invoked three different ways over the course of a week: once by a user running it interactively, once as an activity inside a pipeline run, and once via its own independent schedule. For each run, whose identity does the notebook execute as?

A. The pipeline's own service identity in all three cases, since Fabric always executes notebooks under one shared identity  
B. The workspace Admin's identity in all three cases, no matter how each of the three runs was actually triggered  
C. The current user's identity in all three cases — execution identity never actually depends on the trigger type at all  
D. It varies by trigger: current user, pipeline's last-modified user, schedule's owner  

> [!success]- Answer
> **D. It varies: the current user (interactive), the pipeline's last-modified user (pipeline-invoked), and the schedule's creator/last-updater (scheduled)**
>
> Notebook execution identity differs by trigger type — interactive runs use the current user, pipeline-invoked runs use the pipeline's last-modified user, and scheduled runs use the schedule's creator/last-updater — three different answers to "who is this running as?" depending on how the run started.
>
> Option A invents a single service-identity model that doesn't reflect how any of the three trigger types actually work. Option B and C both flatten the three distinct behaviors into one, which is exactly the misconception this fact is designed to catch.

---

## Question 15: Wrapping exit() in try/except *(Hard)*

A notebook calls `notebookutils.notebook.exit("done")` inside a `try` block, wrapped so that a subsequent `except` block can catch and log the exit as if it were an error, when the notebook is invoked as a pipeline activity. What actually happens?

A. The pipeline activity completes normally with the exit value "done" — try/except has no effect on how `exit()` communicates with the pipeline  
B. The `except` block catches and swallows the underlying `NotebookExit` exception, so the pipeline activity never receives the exit value  
C. The notebook run fails outright, since `exit()` can't be called from within a try block in any context  
D. The `except` block is skipped, but the pipeline activity is never marked as complete, leaving the run stuck  

> [!success]- Answer
> **B. The `except` block catches and swallows the underlying `NotebookExit` exception, so the pipeline activity never receives the exit value**
>
> `exit()` works by raising a `NotebookExit` exception that the pipeline runtime relies on to capture the activity's exit value. Wrapping the call in `try/except` catches and swallows that exception before it can propagate — the `except` block runs (silently, if it just logs), but the pipeline activity never gets the exit value it was supposed to capture. This is exactly why the documentation calls out never wrapping `exit()` in try/except: the fix is removing the try/except entirely so the exception propagates.
>
> Option A assumes try/except is a no-op around `exit()` — it isn't; it's the mechanism that swallows the required exception and breaks the value hand-off. Option C invents a hard failure condition tied to try-block placement, which isn't how `exit()` is documented to behave. Option D invents a stuck-run failure mode; the notebook activity still completes (the except block ran, so the cell finished), it just never delivers the exit value to the pipeline.

---

<!-- DOMAIN 2: Ingest and Transform Data (~15 questions) -->

## Question 16: Duplicate Rows After a Retried Append *(Medium)*

A nightly Spark job appends new order records to a Delta table using `df.write.format("delta").mode("append").save(...)`. After a transient failure mid-write, the job is automatically retried from the start using the same source data. The team then notices duplicate order rows. What's the most likely root cause?

A. Delta Lake's append mode is idempotent by default, so the bug must be in the source extraction, not the write  
B. `append` is not idempotent — retrying it re-writes rows that already landed; a MERGE-based upsert is needed instead  
C. The retry logic must have used `overwrite` mode instead of `append`, which caused the duplication  
D. Delta Lake tables can't be retried safely at all; the pipeline needs a fully manual recovery process after any failure  

> [!success]- Answer
> **B. `append` is not idempotent — retrying an append re-writes rows that already landed successfully before the failure; a MERGE-based upsert is needed instead**
>
> Delta's `append` is not idempotent — a retry after a partial failure re-appends rows that already committed, producing duplicates. `MERGE`/`MERGE INTO` is the idempotency mechanism for retry-safe loads; a scenario describing duplicated rows after a retry almost always points to a missing `MERGE`.
>
> Option A wrongly assumes append is idempotent — it explicitly isn't. Option C misdiagnoses the mode; `overwrite` would replace the table's contents, not create duplicates the way described. Option D overstates the problem as unsolvable — a `MERGE`-based upsert keyed on a business key resolves it without a manual process.

---

## Question 17: SCD Type 2 in T-SQL vs. Delta *(Hard)*

A team implementing SCD Type 2 in a Fabric Warehouse using T-SQL wants to close out changed dimension rows and insert their new versions using a single `MERGE` statement, the same way their Delta-based Spark pipeline does it with the `mergeKey`-is-`NULL` trick. Is this achievable in T-SQL?

A. Yes — T-SQL `MERGE` supports the identical mergeKey-is-NULL pattern used in Delta MERGE INTO  
B. Yes, but only if the table uses a Preview IDENTITY column as its dimension surrogate key  
C. No — T-SQL SCD Type 2 needs two steps: a `MERGE` to close changed rows, then an `INSERT` for new versions  
D. No — Fabric Warehouse T-SQL doesn't support `MERGE`, so SCD Type 2 needs `UPDATE` and `INSERT` statements only  

> [!success]- Answer
> **C. No — T-SQL SCD Type 2 requires two separate steps: a `MERGE` to close out changed rows, then an `INSERT` to add the new versions**
>
> T-SQL SCD2 requires two steps — a `MERGE` to close out (expire) changed rows, then a separate `INSERT` to add the new versioned rows — unlike Delta's `MERGE INTO`, which can do both in one statement using the `mergeKey`-is-`NULL` trick. The two engines solve the same problem with a different number of statements.
>
> Option A incorrectly imports Delta's single-statement trick into T-SQL, which doesn't support it. Option B invents an IDENTITY-column dependency that has nothing to do with which SCD2 pattern is available. Option D is factually wrong — `MERGE` is GA and fully supported in Fabric Warehouse T-SQL; it's very much part of the correct two-step pattern, not absent from it.

---

## Question 18: Default Output Mode for a Streaming Delta Write *(Medium)*

A Spark Structured Streaming job writes directly to a Delta bronze table with no explicit output mode configured, and the team expects the write to automatically deduplicate and upsert records as they arrive. What should they expect instead?

A. The write defaults to append mode; upserts and dedup aren't automatic without an explicit `foreachBatch` + `MERGE` step  
B. The write defaults to complete mode, fully rewriting the table on every micro-batch to keep it deduplicated  
C. The write defaults to update mode, which automatically deduplicates on the table's primary key  
D. The job fails to start, since Structured Streaming requires an explicit output mode to be set before any write can begin  

> [!success]- Answer
> **A. The write defaults to append mode; upserts and deduplication aren't automatic — they require an explicit `foreachBatch` + `MERGE` pattern downstream**
>
> Streaming writes to Delta default to `outputMode("append")` — there's no automatic dedup or upsert behavior; `MERGE`/aggregation happen downstream via an explicit `foreachBatch` + `MERGE` pattern, not as a side effect of the write itself.
>
> Option B and C both invent a default output mode other than append, and both incorrectly assume automatic dedup/upsert behavior that Structured Streaming doesn't provide out of the box. Option D overstates the requirement — Structured Streaming does have a sensible default (append), so the job wouldn't fail to start over a missing explicit setting.

---

## Question 19: A Star-Schema Load That Also Needs BI on the Same Tables *(Medium)*

A team of SQL Server-background developers needs to run `MERGE`-based load logic directly against curated star-schema tables, then have Power BI query those exact same tables afterward — no Spark, no separate BI-facing copy. One developer suggests a lakehouse, reasoning "it has a SQL analytics endpoint too, so the 'SQL' in the name means it can run `MERGE` just like a warehouse can." Is that reasoning correct, and which store actually fits?

A. Yes — every Fabric item's "SQL analytics endpoint" is the same read/write query engine, so lakehouse and warehouse are interchangeable for this load  
B. No — Power BI can't connect to a Warehouse's SQL analytics endpoint at all in any tenant configuration, so only a lakehouse satisfies the reporting half  
C. No — a lakehouse's endpoint stays read-only regardless of its name; only Warehouse's T-SQL surface supports the `MERGE` write  
D. Yes, but only if the lakehouse tables are created directly under `/Tables` instead of via a shortcut, which unlocks full DML on the SQL analytics endpoint  

> [!success]- Answer
> **C. No — a lakehouse's SQL analytics endpoint is read-only regardless of the "SQL" in its name; only Warehouse's primary T-SQL surface supports the `MERGE`-based write, so Warehouse is the fit here**
>
> The "SQL analytics endpoint" label refers to the query *engine* (the same engine Warehouse runs), not to write permissions — a documented trap. A lakehouse's endpoint stays read-only no matter how its tables were created, so the `MERGE` step would fail outright there. Warehouse's primary T-SQL surface is the one Fabric item where the SQL surface itself supports full DML, making it the fit for a `MERGE`-based load that also has to serve Power BI directly off the same tables afterward, with no separate copy or pipeline needed.
>
> Option A over-generalizes the "SQL analytics endpoint" name into implying uniform write support everywhere — exactly the trap this scenario is testing. Option B is wrong on its own terms: Power BI connects to a Warehouse's endpoint just as readily as a lakehouse's, so the reporting half was never actually the blocker. Option D invents a `/Tables`-placement exception to the lakehouse's read-only endpoint that doesn't exist — that boundary holds regardless of how the tables were created.

---

## Question 20: Caching an ADLS Gen2 Shortcut *(Medium)*

A team creates a shortcut in a Lakehouse pointing to files in an Azure Data Lake Storage Gen2 container. They then configure caching on this shortcut to reduce repeated cross-region read latency. What happens?

A. Caching applies as configured, since ADLS Gen2 is one of the four cache-eligible external source types  
B. Caching isn't available for this shortcut — ADLS Gen2 isn't on the cache-eligible source list  
C. Caching applies, but only for files under 1 MB, since ADLS Gen2 has a stricter size ceiling than other sources  
D. Caching applies automatically for all external shortcuts by default; no configuration step is needed or possible  

> [!success]- Answer
> **B. Caching isn't available for this shortcut — ADLS Gen2 isn't on the cache-eligible source list (only GCS, S3, S3-compatible, and on-premises via gateway are)**
>
> Shortcut caching supports GCS, S3, S3-compatible, and on-premises data gateway sources only — ADLS Gen2 and Blob Storage are never on that list, regardless of read pattern or region. An ADLS Gen2 shortcut simply has no caching option to configure.
>
> Option A wrongly places ADLS Gen2 on the cache-eligible list. Option C invents a stricter, ADLS-specific size ceiling — the actual constraint (files over 1 GB never cache) applies uniformly across the sources that do support caching, and ADLS isn't one of them anyway. Option D wrongly claims caching is automatic and universal; it's opt-in and source-restricted.

---

## Question 21: Writing a Correction Into a Mirrored Table *(Medium)*

A finance team mirrors their on-premises SQL Server database into Fabric using database mirroring. A business analyst asks whether they can write a correction directly into the mirrored table inside Fabric to fix a bad value, since it would be faster than waiting for a source-side fix. Is this possible?

A. Yes — mirrored tables support both reads and writes, since they're materialized as ordinary Delta tables  
B. Yes, but only through the SQL analytics endpoint, and never through Spark or a notebook  
C. No — mirrors stay read-only in Fabric; any correction must go back to the source system instead  
D. No — mirrored data can't even be queried until the source connection is fully disconnected first  

> [!success]- Answer
> **C. No — mirrors are read-only in Fabric; any correction must be made in the original source system**
>
> Mirrors are read-only in Fabric — writes always go to the original source system, regardless of which engine or surface is used to access the mirrored data.
>
> Option A and B both assume some write path exists into the mirror, which contradicts the read-only guarantee that makes mirroring safe to run continuously against a live source. Option D invents a disconnect requirement for querying that doesn't exist — mirrored data is queryable live, continuously, while the mirror is running.

---

## Question 22: Upsert Write Behavior on a File Sink *(Hard)*

A team configures a Copy activity to land data into a Parquet file sink in a Lakehouse `Files` folder, and they want to enable the sink's "Upsert" write behavior so that matching rows are updated in place rather than duplicated. What do they find?

A. Upsert write behavior isn't available — it's a sink-side setting on database-family connectors only, not file-based sinks  
B. Upsert write behavior works identically for file and database sinks, since Copy activity abstracts the difference away  
C. Upsert write behavior is available for Parquet file sinks specifically, but not for CSV or JSON sinks  
D. Upsert write behavior requires switching from Copy activity to Copy job, which supports it for all sink types including files  

> [!success]- Answer
> **A. Upsert write behavior isn't available — it's a sink-side setting exposed only by database-family connectors (Azure SQL DB, Warehouse, Lakehouse tables, Dataverse), not file-based sinks**
>
> Upsert write behavior is a sink-side setting available on database-family connectors (Azure SQL DB, Warehouse, Lakehouse tables, Dataverse) — file-based sinks, including a Parquet file sink, don't expose it at all, so there's no toggle to enable here.
>
> Option B wrongly claims uniform behavior across sink types. Option C invents a Parquet-specific carve-out that doesn't exist — the split is database-family vs. file-based, not by file format. Option D correctly names Copy job as the tool with expanded native capabilities (CDC-based incremental copy, SCD Type 2 Preview) but wrongly claims it extends Upsert to file sinks — the database-vs-file distinction still applies.

---

## Question 23: What partitionBy Actually Controls *(Medium)*

A developer calls `df.write.format("delta").partitionBy("region").saveAsTable("sales")`, expecting this to control how many in-memory partitions Spark uses while processing the DataFrame before the write. What does `partitionBy` actually control here?

A. Both the physical storage layout and the DataFrame's in-memory partition count simultaneously  
B. Only the DataFrame's in-memory partition count during processing — it has no effect on how files are stored  
C. Nothing measurable — `partitionBy` in `saveAsTable` is a no-op left over from earlier Spark versions  
D. Only the physical storage layout (folder structure) — a storage optimization, not a partition-count control  

> [!success]- Answer
> **D. Only the physical storage layout (folder structure on disk/OneLake) — it's a storage optimization, not an in-memory partition count control**
>
> `partitionBy()` in `saveAsTable`/`write` is a physical storage optimization (folder pruning by partition value) — it says nothing about how many in-memory partitions Spark uses while processing the DataFrame beforehand; that's controlled separately (e.g., `repartition()`/`coalesce()` or the shuffle partition count).
>
> Option A conflates two unrelated concepts that share the word "partition." Option B gets it backward — `partitionBy` affects storage layout, not the in-memory partition count. Option C dismisses a real, actively used feature as a no-op, which it isn't.

---

## Question 24: A Foreign Key That Doesn't Block a Bad Insert *(Easy)*

A developer defines a `FOREIGN KEY` constraint between two tables in a Fabric Warehouse, expecting the engine to reject any `INSERT` that violates referential integrity, the same way it would in an on-premises SQL Server database. What actually happens on a violating insert?

A. The insert fails with a foreign-key-violation error, identical to on-premises SQL Server's default behavior  
B. The insert succeeds — Warehouse constraints are `NOT ENFORCED`, informing the optimizer but never blocking bad data  
C. The insert succeeds, but a warning is logged for the team to review and catch violations later on  
D. The insert fails only when the constraint was created with an explicit `WITH CHECK` option specified  

> [!success]- Answer
> **B. The insert succeeds — Fabric Warehouse constraints are always `NOT ENFORCED`, so they inform the optimizer but never block bad data**
>
> `PRIMARY KEY`/`FOREIGN KEY`/`UNIQUE` constraints exist in Fabric Warehouse but are always `NOT ENFORCED` — they inform the query optimizer (join elimination, cardinality estimates) but never block bad data. A violating insert succeeds silently.
>
> Option A assumes on-premises SQL Server enforcement behavior carries over — it doesn't. Option C invents a warning-logging mechanism that doesn't exist. Option D invents a `WITH CHECK` option as a way to force enforcement, which Fabric Warehouse doesn't support for these constraint types.

---

## Question 25: Continuous Aggregation Without External Orchestration *(Medium)*

A team wants continuously aggregated, always-fresh rollup data in an Eventhouse table, updated automatically as new rows land, without any external orchestration. Which KQL mechanism is the correct fit?

A. An update policy referencing the source table with a fully qualified `database().table()` path  
B. A `lookup` operator scheduled to run on a timer against the raw ingestion table  
C. A standard `join` between the raw table and itself, scheduled via a pipeline every few minutes  
D. A materialized view, which solves continuous aggregation with no external orchestration required  

> [!success]- Answer
> **D. A materialized view, which solves continuous aggregation with no external orchestration required**
>
> Materialized views solve continuous *aggregation* specifically — they stay always-fresh with no external orchestration, which is exactly what this scenario asks for. Update policies solve general transform-on-ingest (aggregation or not), but the "continuously aggregated, always-fresh rollup" framing points specifically at materialized views.
>
> Option A picks a real mechanism (update policy) but adds a fatal syntax error — update policy queries must reference the source table **unqualified**, with no `database()`/`cluster()` prefix. Option B misapplies `lookup`, which is a broadcast join operator, not an aggregation mechanism, and "scheduled on a timer" reintroduces the external orchestration the scenario explicitly wants to avoid. Option C makes the same orchestration mistake as B, using a generic `join` instead of a purpose-built continuous-aggregation construct.

---

## Question 26: COALESCE vs. ISNULL for a Three-Column Fallback *(Medium)*

A T-SQL developer needs to replace NULLs across three columns of differing data types with fallback default values in a single expression, and wants the most standards-compliant, portable choice. Which function should they prefer over `ISNULL`?

A. `COALESCE` — it's ANSI-standard, accepts any number of arguments, with more predictable typing than `ISNULL`  
B. `ISNULL`, since it's the Microsoft-native function and therefore always outperforms `COALESCE` in Fabric Warehouse  
C. `TRY_CONVERT`, since it's the function designed specifically for cross-type NULL replacement  
D. Neither — Fabric Warehouse requires a `CASE WHEN col IS NULL THEN ... END` expression for any NULL replacement  

> [!success]- Answer
> **A. `COALESCE`, since it's ANSI-standard, accepts any number of arguments, and has more predictable result typing than `ISNULL`**
>
> `COALESCE` is preferred over `ISNULL` for exam-safe answers — it's ANSI standard, accepts any argument count (useful for the three-column fallback chain described), and has more predictable result typing than the two-argument, Microsoft-proprietary `ISNULL`.
>
> Option B asserts a performance advantage for `ISNULL` that isn't the documented reasoning — the real distinction is standards-compliance and argument-count flexibility, not raw performance. Option C misapplies `TRY_CONVERT`, which handles type-conversion failures, not NULL replacement. Option D overstates the requirement — `CASE WHEN` can express NULL replacement but isn't required when `COALESCE` already does it more concisely.

---

## Question 27: Pre-Ingestion Operators on a KQL Queryset Destination *(Hard)*

A team wants to apply a Filter operator directly before data lands in a KQL Queryset-backed dashboard destination inside their eventstream, the same way they can apply one directly before data lands in their Lakehouse destination. Is this configuration directly supported?

A. Yes — every eventstream destination supports a pre-ingestion operator identically, including a KQL Queryset  
B. No — pre-ingestion operators are still Preview-only and not yet available for any destination at all  
C. No — only Lakehouse, Eventhouse, Derived stream, and Activator support one directly; others need a derived stream first  
D. Yes, but only if the KQL Queryset destination sits in the same workspace as the eventstream  

> [!success]- Answer
> **C. No — only Lakehouse, Eventhouse, Derived stream, and Activator support a pre-ingestion operator directly; other destinations need a derived stream as an intermediate hop first**
>
> Only Lakehouse, Eventhouse (event processing before ingestion), Derived stream, and Activator support a pre-ingestion operator directly — everything else, including a KQL Queryset-backed destination, needs a derived stream as an intermediate hop to apply that same Filter logic first.
>
> Option A wrongly claims universal support. Option B is wrong on two counts — pre-ingestion operators aren't Preview-only, and they are available for the four listed destinations right now. Option D invents a same-workspace requirement that has nothing to do with why this specific destination lacks direct pre-ingestion operator support.

---

## Question 28: Output Mode for a Changed-Rows-Only Sink *(Medium)*

A streaming aggregation query groups incoming events by customer ID and computes a running total, then writes to a downstream sink expecting only the rows whose totals actually changed in each micro-batch, not a full table rewrite. Which output mode fits?

A. `append`, since it's the default and works for any streaming query regardless of whether it aggregates  
B. `update`, since it emits only the rows that changed since the last trigger, without rewriting the whole result table  
C. `complete`, since it always contains the entire, latest result table on every single trigger  
D. `complete`, since it's always required for any query involving a `groupBy` aggregation step  

> [!success]- Answer
> **B. `update`, since it emits only the rows that changed since the last trigger, without rewriting the whole result table**
>
> `update` mode is the fit here — it requires an aggregation (which this query has) and emits only the changed rows on each trigger, exactly matching "only the rows whose totals actually changed." `complete` would instead emit the entire result table every time, and `append` doesn't support emitting revised aggregate rows at all.
>
> Option A is wrong on two counts: `append` requires no aggregation revisions, and this query's running total is exactly the kind of revised row `append` mode can't emit. Option C describes `complete` correctly but misapplies it — a full rewrite isn't what "only the rows that changed" is asking for. Option D wrongly claims `complete` is the *only* valid mode for any aggregating query — `update` is equally valid and often the better fit for change-only downstream consumption.

---

## Question 29: Attaching a Materialized View to an Accelerated Shortcut *(Easy)*

A team enables query acceleration on a OneLake shortcut pointing to Parquet files in ADLS Gen2, closing most of the performance gap versus a native Eventhouse table. They then try to attach a materialized view directly to that accelerated shortcut. What happens?

A. It fails — materialized views require a native table; even an accelerated shortcut remains an external table for this purpose  
B. It succeeds, since query acceleration makes an accelerated shortcut behave identically to a native table in every respect  
C. It succeeds, but the materialized view refreshes only once every 24 hours instead of continuously  
D. It fails, but only because the source files are Parquet rather than a Delta-formatted source  

> [!success]- Answer
> **A. It fails — materialized views require a native table; even an accelerated shortcut remains an external table for this purpose**
>
> Update policies and materialized views are native-table-only mechanisms — accelerated shortcuts remain external tables for that specific purpose even after acceleration closes most of the raw query-performance gap.
>
> Option B overstates what acceleration does — it improves query performance, but doesn't change the shortcut's fundamental external-table status for materialized-view/update-policy purposes. Option C invents a degraded-but-working refresh cadence that doesn't exist — the operation fails outright, it doesn't run on a reduced schedule. Option D misattributes the failure to file format rather than the actual cause (external vs. native table status).

---

## Question 30: What Happens to a Very Late Event *(Easy)*

A Spark Structured Streaming job uses a watermark to bound state for a windowed aggregation. An event arrives well after the watermark threshold has passed for its window. What happens to that late event?

A. It's rejected outright at the source and never enters the stream in any form  
B. It's included in the next window instead, shifted forward to the nearest still-open window  
C. It causes the entire streaming query to fail immediately with a late-data exception  
D. It's silently excluded from its finalized window — a watermark bounds state retention, not entry  

> [!success]- Answer
> **D. It's silently excluded from the aggregation result for its (already-finalized) window — the watermark bounds state retention, it doesn't reject data from the stream**
>
> A watermark doesn't reject late data from the stream — it bounds how long window/dedup *state* is retained. Once a window's state has been dropped because the watermark passed, a very late event for that window is silently excluded from the result, but the event itself isn't blocked from entering the stream.
>
> Option A misplaces the rejection at the source, which isn't where or how watermarking works. Option B invents a forward-shifting reassignment mechanism that doesn't exist. Option C overstates the consequence as a hard failure — Structured Streaming handles this silently, not by crashing.

---

<!-- DOMAIN 3: Monitor and Optimize an Analytics Solution (~15 questions) -->

## Question 31: Where a Pipeline's Notebook Activity Deep-Links To *(Easy)*

A pipeline's Notebook activity fails, and the pipeline's own run-history view shows only a generic activity-failure summary. The team wants the actual Spark-level error message and logs without leaving the pipeline monitoring experience to separately hunt through Monitor hub for the matching application. Is this possible, and how?

A. No — Spark execution detail is only reachable by searching Monitor hub separately for the matching application ID  
B. Yes, but only if workspace monitoring is enabled and the pipeline is separately configured to log to the `ItemJobEventLogs` table first  
C. Yes — inline monitoring deep-links the Notebook activity straight to its Spark execution details and logs  
D. No — pipeline-triggered notebook activities don't produce a queryable Spark application at all, only ad hoc interactive runs do  

> [!success]- Answer
> **C. Yes — Pipeline Spark activity inline monitoring deep-links directly from the Notebook activity to its Spark execution details, snapshot, and logs, including inline error messages**
>
> Fabric documents this as its own dedicated Spark monitoring entry point: a Pipeline's Notebook/SJD activity deep-links straight into Spark execution details, the item snapshot, and logs — including inline error messages on failure — without the team needing to separately search Monitor hub for the matching application.
>
> Option A denies this documented inline deep-link and describes an unnecessary workaround as if it were the only path. Option B invents a workspace-monitoring/`ItemJobEventLogs` dependency for a capability that's available by default on any pipeline-triggered Notebook activity. Option D is factually wrong — a pipeline-triggered notebook activity produces a full Spark application, tracked the same as an interactive run, just triggered differently.

---

## Question 32: Finding Dataflow Gen2 History Beyond 50 Rows *(Medium)*

A team needs to review Dataflow Gen2 refresh history older than what's shown in the 50-row UI list, going back several months. Where should they look?

A. Monitor hub, which retains Dataflow Gen2 history indefinitely beyond the 50-row UI limit  
B. The refresh history persisted to OneLake, which retains up to 250 refreshes or 6 months, whichever is reached first  
C. The detailed logs download, which covers the same 6-month window as the UI refresh history list  
D. There's no way to see history beyond the 50 most recent rows; older refreshes are permanently discarded  

> [!success]- Answer
> **B. The refresh history persisted to OneLake, which retains up to 250 refreshes or 6 months, whichever is reached first**
>
> Dataflow Gen2 refresh history is capped at 50 rows in the UI, but a longer history — up to 250 refreshes or 6 months, whichever comes first — is persisted to OneLake for the team to query beyond that UI limit.
>
> Option A misattributes the extended retention to Monitor hub, which isn't where Dataflow Gen2's OneLake-persisted history lives. Option C confuses two different retention windows — detailed logs have a 28-day download window, distinct from the 250-refresh/6-month OneLake history. Option D wrongly claims older data is unrecoverable; the OneLake-persisted history exists precisely to cover this gap.

---

## Question 33: Direct Lake on OneLake Exceeding Guardrails *(Medium)*

A semantic model uses Direct Lake mode directly on OneLake (not via a SQL analytics endpoint). A query exceeds the Direct Lake guardrails for that model. What happens?

A. The query automatically falls back to DirectQuery against the model's SQL analytics endpoint instead  
B. The query falls back to DirectQuery, but only when `DirectLakeBehavior` is explicitly set to `Automatic`  
C. The query falls back to Import mode temporarily, until the model's next scheduled refresh runs  
D. The query fails outright — OneLake mode has no DirectQuery fallback path  

> [!success]- Answer
> **D. The query fails — Direct Lake on OneLake has no DirectQuery fallback path; that fallback behavior is specific to Direct Lake on SQL endpoints**
>
> Direct Lake on OneLake never falls back to DirectQuery — that fallback mechanism, governed by `DirectLakeBehavior` (`Automatic`/`DirectLakeOnly`/`DirectQueryOnly`), is specific to Direct Lake on SQL endpoints. A guardrail-exceeding query against a OneLake-mode model simply fails.
>
> Option A and B both wrongly extend the SQL-endpoint-specific DirectQuery fallback mechanism to the OneLake variant, which doesn't have it at all — not even conditionally. Option C invents an Import-mode fallback that doesn't exist for either Direct Lake variant.

---

## Question 34: Detecting a Threshold Crossing, Not a Single Point *(Medium)*

A team wants an Activator rule that fires specifically when a sensor's reported value crosses from below a threshold to above it — not just whenever the value happens to be above the threshold on any given check. Which condition type is required?

A. A stateful condition using `BECOMES`, since it tracks the value's change over time, not a single point  
B. A stateless condition using a simple greater-than comparison, since Activator has no concept of value transitions  
C. A stateful condition using `EXIT RANGE`, since crossing a single threshold is functionally identical to exiting a range  
D. Either a stateful or stateless condition works identically here, since both evaluate the same underlying event stream  

> [!success]- Answer
> **A. A stateful condition using `BECOMES` (or a similar transition-based operator), since it tracks the value's change over time rather than a single-point comparison**
>
> Stateful conditions track value transitions over time — `BECOMES`, `DECREASES`, `INCREASES`, `EXIT RANGE`, and absence-of-data/heartbeat all compare a new state against a prior one. A "crosses from below to above" requirement is exactly a transition, which only a stateful condition (here, `BECOMES`) can express; a stateless condition only evaluates a single point in isolation.
>
> Option B wrongly claims stateless conditions can express transitions — they can't, that's the entire distinction. Option C misapplies `EXIT RANGE`, which is for detecting departure from a bounded range, not a single-threshold crossing — a plausible-sounding but wrong stateful operator for this specific case. Option D flattens the stateful/stateless distinction, which is the core concept this fact tests.

---

## Question 35: Alerting on a Scheduled KQL Query vs. a Live Eventstream *(Easy)*

A team has two separate alerting needs: (1) fire when a batch of computed values from a scheduled KQL query exceeds a threshold, and (2) fire on values as they arrive continuously in a raw eventstream, before anything lands downstream. Which Activator alert source fits each need, and what's the default check frequency for the first?

A. KQL queryset alert (default 5-minute check) for the scheduled need; an alert set on the eventstream from the eventstream editor for the raw-arrival need  
B. An alert set on the eventstream from the eventstream editor for both needs, since Eventstream can also run scheduled KQL queries directly  
C. KQL queryset alert for both needs, since Eventstream doesn't support Activator as a destination  
D. KQL queryset alert (default 1-minute check) for the scheduled-query need; Real-Time dashboard tile for the continuous raw-arrival need  

> [!success]- Answer
> **A. KQL queryset alert (default 5-minute check) for the scheduled-query need; an alert set on the eventstream from the eventstream editor for the continuous raw-arrival need**
>
> Activator's alert sources map to different points in the data lifecycle. KQL querysets support **Set Alert** against a query's results, checked on a schedule with a default frequency of **5 minutes** — the fit for a periodic, computed-threshold check. Eventstreams are the primary continuous streaming source, with alert authoring embedded directly in the Eventstream editor's operator chain — the fit for raw, continuously-arriving events before they land anywhere. The two sources serve genuinely different needs and aren't interchangeable.
>
> Option B invents an Eventstream-runs-scheduled-KQL capability that doesn't exist — Eventstream and KQL queryset are separate alert sources with separate authoring surfaces. Option C denies Eventstream's role as a supported (in fact primary) Activator source. Option D gets the KQL queryset's default check frequency wrong (it's 5 minutes, not 1) and misapplies Real-Time dashboard tiles, which alert on a dashboard tile's condition, not raw continuous event arrival.

---

## Question 36: A Staging Permission Error With No Gateway in Sight *(Medium)*

A cloud-only Dataflow Gen2 refresh (no on-premises gateway involved anywhere in the chain) fails with "The dataflow refresh failed due to insufficient permissions for accessing staging artifacts." The team confirms the current dataflow's owner has full workspace Contributor access and signed in this morning. What's the most likely root cause, and where should the team look?

A. The dataflow owner's Contributor role needs to be manually upgraded to workspace Admin before staging artifacts become accessible again  
B. The workspace's very first dataflow creator hasn't signed in for 90+ days, or has left the org  
C. The workspace's staging capacity has been exhausted and needs a manual cleanup before the next scheduled refresh attempt  
D. Dataflow Gen2 staging artifacts require the on-premises gateway's service account to be re-authenticated first  

> [!success]- Answer
> **B. The user who created the very first dataflow in this workspace hasn't signed into Fabric in 90+ days, or has left the organization**
>
> This exact error traces back to a specific, non-obvious cause: staging-artifact access in a workspace ties back to the user who created the *first* Dataflow Gen2 item in that workspace — not the current dataflow's owner or their role level. If that original creator hasn't signed into Fabric in 90+ days, or has left the organization, staging access breaks for every dataflow in the workspace, even ones a fully-permissioned Contributor set up recently. The fix is having that original user sign back in, or opening a support ticket if they've left.
>
> Option A invents a role-upgrade fix that doesn't address the actual dependency — the current owner's role level was never the problem. Option C invents a capacity-exhaustion cause with no basis; the documented cause is identity-based, not storage-based. Option D misapplies a gateway-specific fix to a scenario that explicitly has no gateway involved.

---

## Question 37: Exit Code 143 During a Scale-Down *(Hard)*

A Spark job in a notebook terminates with exit code 143 during a period when the team knows autoscaling was actively reducing node count. Should the team treat this as an out-of-memory failure requiring immediate remediation?

A. Yes — 143 always indicates OOM (SIGKILL) regardless of context, so remediation is always warranted  
B. No — 143 always indicates a user code error unrelated to memory or scaling, so the team should review their code logic  
C. Yes — any non-zero, non-one exit code indicates a genuine failure requiring the same OOM remediation steps  
D. Not necessarily — 143 is SIGTERM, often a benign side effect of scale-down, distinct from 137 (OOM/SIGKILL)  

> [!success]- Answer
> **D. Not necessarily — 143 is SIGTERM, which is often a benign side effect of scale-down; it's distinct from 137 (OOM/SIGKILL), so this needs different diagnosis than an actual memory failure**
>
> Exit code 143 is SIGTERM, which is often a benign consequence of autoscaling scale-down — a node being reclaimed sends SIGTERM to running executors. This is a distinct signal from 137 (OOM/SIGKILL), and conflating the two leads to chasing a memory problem that may not exist.
>
> Option A misidentifies 143 as OOM — that's specifically 137. Option B misidentifies 143 as a user code error — that's specifically exit code 1. Option C treats all non-zero/non-one codes identically, ignoring that the exit-code taxonomy (137/143/134/1/-100) exists precisely because each points to a different root cause and remediation path.

---

## Question 38: Data Is Arriving, Just Late *(Easy)*

An eventstream shows a healthy "Connected" status, and its Data insights panel confirms events are still arriving continuously from the source. Downstream, though, a Lakehouse destination is receiving data noticeably later than usual, and Runtime logs show no errors at any severity. What's the most likely explanation, and where should the team look first to confirm it?

A. The source's throughput-unit allocation, or the destination itself, can't sustain the rate — check Data insights' throughput panel  
B. An `IncorrectDataFormat` error is being silently suppressed from Runtime logs — download the eventstream's own detailed logs to find it  
C. The eventstream's connection has quietly dropped into an `EventHubException` state without updating its displayed "Connected" status  
D. `AADSTS65002` is occurring intermittently, failing only a fraction of incoming events rather than the whole connection  

> [!success]- Answer
> **A. The Event Hubs source's throughput-unit allocation is undersized for the current event rate, or the destination can't sustain the incoming rate — check Data insights' throughput panel for the lag**
>
> Eventstream throughput problems rarely throw a hard error at all — they show up as lag (destination data arriving later than expected) or dropped events instead. Common causes are an undersized Event Hubs throughput-unit allocation on the source, or a destination that can't sustain the incoming rate; Data insights' throughput panel is exactly the surface for confirming this, since it answers "is data flowing, and how fast" for the eventstream and each source/destination node.
>
> Option B invents a silently-suppressed error that contradicts the premise — connection/format errors like `IncorrectDataFormat` do surface in Runtime logs; they aren't the documented cause of pure lag with no errors anywhere. Option C invents a status-display inconsistency that isn't documented — a genuine `EventHubException` would show up in Runtime logs, not silently vanish while the status stays green. Option D misapplies `AADSTS65002`, which is a full connection-level tenant-authorization failure, not a partial or intermittent one that would produce "lag but no errors."

---

## Question 39: Delegated Mode Against an RLS-Protected Source *(Hard)*

A team tries to create a shortcut, using Delegated identity mode, to a source table that has RLS, CLS, or OLS security policies applied via OneLake security. What happens?

A. The shortcut is created successfully, and Delegated mode transparently enforces the source's RLS/CLS/OLS policies for every querying user  
B. The shortcut creation is blocked — Delegated mode is intentionally prevented from targeting sources with RLS/CLS/OLS in OneLake security, by design  
C. The shortcut is created, but RLS/CLS/OLS silently stops being enforced for any user querying through the shortcut  
D. The shortcut is created only if the creating user personally has UNMASK/CONTROL permission on the source table  

> [!success]- Answer
> **B. The shortcut creation is blocked — Delegated mode is intentionally prevented from targeting sources with RLS/CLS/OLS in OneLake security, by design**
>
> Delegated mode blocks shortcuts to sources with RLS/CLS/OLS applied via OneLake security — this is an intentional, by-design restriction, not a bug, because Delegated mode uses a single configured connection identity rather than the querying user's own identity, which would otherwise silently bypass row/column-level restrictions meant for individual users.
>
> Option A invents transparent enforcement that Delegated mode specifically can't provide, which is exactly why the block exists in the first place. Option C describes what the restriction is *designed to prevent* — silent bypass — as if it were the actual (unblocked) outcome, which contradicts the by-design block. Option D invents a permission-based override path that doesn't exist; this restriction can't be worked around by the creating user's own permissions.

---

## Question 40: The Order of Operations in a Combined OPTIMIZE *(Medium)*

A team runs `OPTIMIZE` with both Z-Order and V-Order specified on the same table in a single command. In what order does Fabric apply these operations?

A. Z-Order runs first, then V-Order, then bin compaction last  
B. V-Order runs first, then bin compaction, then Z-Order last  
C. Bin compaction runs first, then Z-Order, then V-Order last  
D. All three run simultaneously, in one pass with no defined order  

> [!success]- Answer
> **C. Bin compaction first, then Z-Order, then V-Order**
>
> `OPTIMIZE`'s documented order of operations when combined is bin compaction → Z-Order → V-Order — files are first compacted into properly sized files, then Z-Order clusters the data for selective-filter performance, and V-Order applies its read-optimized encoding last.
>
> Options A and B both scramble this documented sequence into an incorrect order. Option D wrongly claims the operations run with no defined order — the sequence is specific and deterministic, not simultaneous or arbitrary.

---

## Question 41: Clearing the Warehouse's In-Memory Cache *(Medium)*

A performance engineer wants to manually clear the Fabric Warehouse's in-memory/disk cache to get a clean baseline before a benchmark test, the same way they might clear a buffer pool on an on-premises SQL Server instance. Can they do this?

A. No — in-memory/disk caching is always on and can't be disabled; only result-set caching has a toggle  
B. Yes, using `DBCC DROPCLEANBUFFERS`, exactly like on-premises SQL Server behavior  
C. Yes, using `ALTER DATABASE ... SET RESULT_SET_CACHING OFF`, which clears both cache layers together  
D. No — no caching of any kind exists in Fabric Warehouse; every query reads from storage fresh  

> [!success]- Answer
> **A. No — in-memory/disk caching in Fabric Warehouse is always on and can't be disabled or manually cleared; only result-set caching has an on/off toggle**
>
> In-memory/disk caching in Fabric Warehouse is always on and can't be disabled or manually cleared — only result-set caching has a configurable on/off toggle, at both the item level (`ALTER DATABASE ... SET RESULT_SET_CACHING OFF`) and the query level (`OPTION (USE HINT('DISABLE_RESULT_SET_CACHE'))`).
>
> Option B imports an on-premises SQL Server command that doesn't apply to Fabric Warehouse's caching architecture. Option C correctly names the result-set-caching toggle but wrongly claims it also clears the always-on in-memory/disk cache layer — the two are independent. Option D overstates the absence of caching; Fabric Warehouse actively caches at multiple layers, just not with manual clearing available for all of them.

---

## Question 42: Autotune With High Concurrency Mode Enabled *(Medium)*

A team enables Autotune on a notebook attached to a Runtime 1.3 environment with high concurrency mode also enabled, expecting Autotune to begin tuning `shuffle.partitions` after a handful of runs. What should they expect?

A. Autotune works as expected, tuning shuffle.partitions after roughly 20–25 iterations, unaffected by high concurrency mode  
B. Autotune is incompatible with high concurrency mode — this combination won't tune as expected regardless of iteration count  
C. Autotune tunes shuffle.partitions correctly, but only after 200 iterations instead of the usual 20–25  
D. Autotune works, but only for `autoBroadcastJoinThreshold`, not `shuffle.partitions`, when high concurrency is enabled  

> [!success]- Answer
> **B. Autotune is incompatible with high concurrency mode — this combination won't tune as expected regardless of iteration count**
>
> Autotune is documented as incompatible with high concurrency mode, private endpoints, and Runtime versions above 1.2 — enabling it alongside high concurrency mode here means the team shouldn't expect the usual ~20–25-iteration tuning behavior to kick in at all, regardless of how many runs they let it accumulate.
>
> Option A ignores the documented incompatibility entirely. Option C invents a longer-but-still-functional iteration count, when the real issue is the feature not functioning as intended in this configuration, not simply needing more time. Option D invents a partial-functionality carve-out (one setting works, the other doesn't) that isn't how the documented incompatibility is described.

---

## Question 43: A Join That Gets Faster Mid-Query, With No Hint Written *(Hard)*

A join between a large fact table and a dimension table is estimated at 15 MB at compile time — above the default 10 MB `autoBroadcastJoinThreshold` — so it starts running as a sort-merge join. Partway through, actual shuffle statistics show the dimension side is really only 3 MB after an upstream filter that stale statistics didn't account for. No `broadcast()` hint was written anywhere in the code. What should the team expect, and was a manual hint required to get a broadcast join here?

A. The join stays sort-merge for the entire run — only a manual `broadcast()` hint could have promoted it, since the compile-time estimate exceeded the threshold  
B. AQE promotes the join to broadcast mid-query once real post-filter shuffle statistics confirm the dimension side is under the threshold — no manual hint was required  
C. The join fails outright, since the compile-time size estimate exceeded `autoBroadcastJoinThreshold` and Spark never reconsiders that decision once execution starts  
D. Raising `autoBroadcastJoinThreshold` to 20 MB before the run was the only way to get a broadcast join here, since AQE only tunes shuffle partition count, not join strategy  

> [!success]- Answer
> **B. AQE promotes the join to broadcast mid-query once real post-filter shuffle statistics confirm the dimension side is under the threshold — no manual hint was required**
>
> AQE re-optimizes a query plan at runtime using statistics gathered from completed shuffle stages — one of its documented behaviors is converting a sort-merge join to a broadcast join once those statistics show one side is small enough, even when the compile-time estimate said otherwise. Here the dimension side's actual post-filter size (3 MB) is under the 10 MB default threshold, so AQE promotes the join automatically, reducing how often a manual hint is needed in exactly this stale-statistics situation.
>
> Option A denies AQE's runtime join-conversion capability, describing the exact case a manual hint exists for as if AQE couldn't handle it. Option C invents a fixed compile-time-only decision that contradicts the entire premise of AQE re-optimizing plans mid-query. Option D confuses AQE with Autotune (a separate, off-by-default mechanism) and misattributes AQE's tuning scope — even setting that aside, raising the threshold isn't "the only way," since AQE's join conversion already handles this case with no configuration change at all.

---

## Question 44: Raising Throughput on a Low-Partition Event Hub *(Medium)*

A team raises an Eventstream's throughput level setting to the maximum tier to fix slow processing, but the underlying Event Hubs source only has 2 partitions. What should they expect?

A. Throughput improves proportionally, since the throughput level setting is the only factor at play  
B. Throughput improves, but only after the Event Hubs source is migrated to Kafka-compatible mode  
C. No change, since Eventstream Processor CU never actually autoscales based on partition count  
D. Little to no improvement — under-4-partition sources are bottlenecked regardless of throughput level  

> [!success]- Answer
> **D. Little to no improvement — a source with fewer than 4 partitions is partition-bottlenecked regardless of the throughput level setting**
>
> Eventstream Processor CU autoscales by throughput level, transform complexity, and input partition count together — an Event Hubs source with fewer than 4 partitions is partition-bottlenecked regardless of how high the throughput level setting is raised, since the source itself can't feed more parallel consumers than it has partitions.
>
> Option A ignores the partition-count factor entirely, treating throughput level as the sole variable. Option B invents an unrelated Kafka-compatible-mode migration as a fix — partition count, not protocol, is the actual bottleneck. Option C wrongly denies that Processor CU autoscaling considers partition count at all — it explicitly is one of the three inputs.

---

## Question 45: Reframing After a Compaction Pass, Not a Data Change *(Hard)*

A lakehouse table backing a Direct Lake on OneLake semantic model runs a nightly `OPTIMIZE` job that compacts small files — the compaction changes which Parquet files exist, but doesn't add, remove, or modify a single logical row. Automatic updates are enabled on the semantic model. What should the team expect regarding reframing, and why does it matter even though no data actually changed?

A. No reframing is needed or triggered, since framing only reacts to logical row changes, and `OPTIMIZE` doesn't change any row's content  
B. Reframing happens automatically, but only if `VORDER` was also specified in the same statement — a bare compaction doesn't register as a change at all  
C. Automatic updates still reframes on the `OPTIMIZE` rewrite, since a later `VACUUM` could delete the pre-compaction files the model still references  
D. `OPTIMIZE` is blocked entirely on any table feeding a Direct Lake on OneLake model, specifically to avoid this reframing question altogether  

> [!success]- Answer
> **C. Automatic updates still detects the `OPTIMIZE` rewrite as a OneLake change and reframes, which matters because a later `VACUUM` could delete the pre-compaction files the model was still referencing**
>
> Framing works off each Delta table's transaction log, not row-level content — `OPTIMIZE` writes a new commit with new Parquet file references even though the logical rows are unchanged, so automatic updates (on by default) detects that OneLake change and triggers a reframe. This matters operationally: until reframing runs, the model keeps referencing the pre-compaction files, and `VACUUM`'s default 7-day retention window could remove those now-superseded files before the model ever reframes — reframing after `OPTIMIZE` is what keeps the model's file references valid, not optional busywork.
>
> Option A wrongly assumes framing only reacts to logical data changes — it reacts to transaction-log/file-reference changes, which `OPTIMIZE` produces regardless of row content. Option B invents a `VORDER`-specific dependency for triggering reframing that doesn't exist — any `OPTIMIZE` rewrite changes file references, with or without `VORDER` in the same statement. Option D invents a blanket restriction on running `OPTIMIZE` against Direct Lake-backing tables that isn't documented anywhere.

---

## Case Study: Fabrikam Freight *(5 linked questions, ~10 minutes)*

> [!info] Case-study format
> The real DP-700 includes interactive case studies — a multi-paragraph scenario followed by linked questions. Read the whole scenario once, then answer Q46–Q50 in order. You can navigate within the case study, but cannot return to it after submission.

**Scenario**

Fabrikam Freight is a mid-size logistics and freight-forwarding company modernizing its analytics estate on Microsoft Fabric. Its fleet of delivery trucks is equipped with GPS/telematics sensors that stream vehicle location, fuel level, and engine-diagnostic events roughly every five seconds per truck. Separately, a legacy on-premises SQL Server ERP system holds vendor invoices and shipment cost data, reachable only through an on-premises data gateway. Fabrikam also receives daily CSV order-status extracts from 40 regional freight partners over SFTP, landed nightly into an Azure Blob Storage container.

The analytics team consists of three T-SQL-strong data engineers, one engineer comfortable writing PySpark, and a small operations group that monitors dispatch dashboards in near real time using KQL. Dispatch supervisors need sub-second visibility into truck location and any engine-fault codes so they can reroute drivers immediately. Finance needs a nightly, auditable batch pipeline that copies ERP invoice data from the gateway-connected source, runs a Spark-based currency-normalization transform, branches its logic depending on which regions actually submitted data that day, and emails the finance director if any step fails.

Regional account managers should each see only shipment and invoice records for their own region, and a sensitive `InvoiceAmount` column should stay masked from anyone without an explicit need to see raw dollar figures. Every account manager was granted the workspace Contributor role during the pilot rollout so they could also build their own ad hoc reports directly against the Warehouse. The team has also noticed that an occasional transient failure causes the nightly partner-CSV load to retry, and duplicate order rows have shown up in the bronze Lakehouse table afterward. Finally, leadership wants the on-call ops engineer paged automatically before Fabric capacity is throttled — not after a job has already failed — using only browser-accessible tools, with no admin-installed app and no waiting on a scheduled report.

---

### Question 46: Orchestrating the Nightly Finance Load *(Medium)*

Finance needs a nightly, auditable pipeline that copies ERP invoice data from the on-premises SQL Server (via gateway), runs a Spark-based currency-normalization notebook, branches based on which regions actually submitted data that day, and emails the finance director if any step fails. Which orchestration approach satisfies all of these requirements?

A. Schedule the notebook independently, since notebooks can already read from a gateway-connected source and email on failure  
B. Use a Dataflow Gen2 with a Power Query branching step, since Dataflow Gen2 natively supports conditional logic and email notifications  
C. Use a pipeline with Copy and Notebook activities, an If Condition for per-region branching, and an Upon Failure notification path  
D. Use Activator to detect a missing region's data and trigger the notebook directly, since Activator can run notebooks as an action  

> [!success]- Answer
> **C. Use a pipeline with a Copy activity, a Notebook activity, an If Condition (or Switch) for the per-region branching, and an Upon Failure path with a Teams/Outlook notification activity**
>
> Only a pipeline provides scheduling, control-flow (If Condition/Switch for the per-region branching), and failure-branch orchestration across multiple items (Copy + Notebook) in one coordinated run — exactly the shape finance is asking for, including the Upon Failure notification path.
>
> Option A ignores that notebooks can't orchestrate the Copy step or express per-region conditional branching on their own. Option B misapplies Dataflow Gen2, which has no native item-orchestration or multi-activity control-flow capability, regardless of what Power Query itself can express. Option D misapplies Activator, which is an event-detection/alerting engine — running a notebook as an action doesn't give it Copy-activity orchestration or the branching logic the scenario requires.

---

### Question 47: Row Filtering and Masking Behind a Contributor Role *(Hard)*

Fabrikam applies a T-SQL row-level security filter predicate on the Warehouse's shipment and invoice tables, keyed to each account manager's own region, and separately masks the `InvoiceAmount` column with dynamic data masking. Every account manager holds the workspace Contributor role, granted during the pilot so they could build their own ad hoc reports. When an account manager queries these tables directly, what do they see?

A. Every region's rows, with `InvoiceAmount` unmasked — Contributor bypasses both RLS and DDM entirely  
B. Only their own region's rows, with `InvoiceAmount` still masked — Contributor bypasses neither control here  
C. Only their own region's rows, unmasked — RLS still filters every role, but implicit CONTROL bypasses DDM  
D. Every region's rows, but `InvoiceAmount` stays masked — Contributor bypasses RLS, not DDM  

> [!success]- Answer
> **C. Only their own region's rows, with `InvoiceAmount` unmasked — RLS still filters regardless of workspace role, but Contributor's implicit CONTROL bypasses DDM**
>
> Two mechanisms, two different bypass rules apply here. T-SQL RLS filter predicates (`CREATE SECURITY POLICY`) filter rows for every querying principal, with no workspace-role exemption — even a Contributor (or `db_owner`) still only sees their own region's rows. DDM, by contrast, is bypassed by the implicit `CONTROL` permission that Admin, Member, and Contributor all carry on the Warehouse database, so `InvoiceAmount` displays unmasked without any explicit `UNMASK` grant. The two controls are evaluated completely independently.
>
> Option A wrongly extends the DDM bypass to RLS as well — RLS has no role-based bypass at all. Option B assumes Contributor bypasses neither control — it does bypass DDM specifically, just not RLS. Option D swaps which mechanism gets bypassed: RLS is the one with no bypass, DDM is the one Contributor bypasses — the opposite of what D claims.

---

### Question 48: Choosing a Streaming Engine for Dispatch *(Easy)*

Dispatch supervisors need sub-second visibility into truck GPS location and engine-fault codes as they stream in, and the ops team that will build and maintain the dashboards is comfortable with KQL but not with writing Spark code. Which streaming architecture fits?

A. Route the eventstream to an Eventhouse (KQL database) for sub-second, code-free query latency  
B. Route the eventstream to a Lakehouse table and have the ops team query it via the SQL analytics endpoint  
C. Build a Spark Structured Streaming job that writes directly to a dashboard-ready table, since Spark offers the most control  
D. Use Dataflow Gen2 to poll the telemetry source every few seconds and refresh a Lakehouse table  

> [!success]- Answer
> **A. Route the eventstream to an Eventhouse (KQL database), giving the KQL-savvy ops team sub-second query latency without needing custom code**
>
> "Sub-second query latency," "KQL," and "telemetry/time-series investigation" are the textbook signals for Eventhouse — it's purpose-built for exactly this combination, and it matches the ops team's existing KQL skillset with no custom code required.
>
> Option B routes to a Lakehouse, whose SQL analytics endpoint doesn't offer the sub-second query latency dispatch supervisors need. Option C requires Spark code the ops team isn't positioned to build and maintain, ignoring the skillset signal. Option D misapplies Dataflow Gen2, which isn't designed for continuous sub-second streaming ingestion at all — it's a scheduled/refresh-based low-code ETL tool.

---

### Question 49: Idempotent Loading for Partner CSV Drops *(Medium)*

The 40 regional partners' daily CSV order-status extracts land nightly in an Azure Blob Storage container via SFTP. A transient failure occasionally causes the nightly job to retry, and the team has noticed duplicate order rows appear in the bronze Lakehouse table after a retry reprocesses the same day's file. What should they change?

A. Switch from a pipeline Copy activity to a OneLake shortcut pointing at the Blob container  
B. Enable database mirroring on the Blob Storage account so retries are handled automatically  
C. Reduce the retry count to zero, accepting occasional missed nightly loads instead of duplicate rows  
D. Load into the bronze table using a business-key-based `MERGE`/upsert instead of a plain append  

> [!success]- Answer
> **D. Load into the bronze table using a business-key-based `MERGE`/upsert instead of a plain append, so a retried load of the same file doesn't re-insert already-landed rows**
>
> This is the same idempotency problem covered by the loading-patterns topic: a plain `append` isn't idempotent, so a retry that reprocesses the same file re-inserts rows that already landed. A business-key-based `MERGE`/upsert (keyed on order ID) makes the retry safe regardless of how many times the same day's file gets reprocessed.
>
> Option A misapplies shortcuts — they're pointers to existing data, not a transformation or dedup mechanism, and they don't solve an idempotency problem at the load layer. Option B misapplies mirroring, which replicates supported source databases, not ad hoc CSV drops in Blob Storage. Option C avoids the symptom by creating a worse problem (silently missing data) instead of fixing the actual idempotency gap.

---

### Question 50: Paging Before the Capacity Throttles *(Hard)*

Leadership wants the on-call ops engineer paged automatically before the Fabric capacity is throttled — not after a job has already failed — using only browser-accessible tools (no admin-installed app, no waiting on a scheduled report). Which approach satisfies this?

A. Install the Capacity Metrics app and configure a threshold alert on CU utilization directly within it  
B. Wait for pipeline failure alerts, since a throttled capacity will eventually cause a job to fail  
C. Create an Activator rule on a Real-Time hub capacity overview event, using a stateful condition on CU utilization  
D. Configure a scheduled Power BI report that emails a daily CU utilization summary to the on-call engineer  

> [!success]- Answer
> **C. Create an Activator rule on a Real-Time hub capacity overview event, using a stateful condition (e.g., `INCREASES`/`BECOMES`) on CU utilization, with an email or Teams action**
>
> The Capacity Metrics app is explicitly unsupported as an Activator alert source and requires admin installation — disqualifying option A on both counts. Real-Time hub's capacity overview events are a supported Activator source, and a stateful condition catches the CU utilization *trend* rising toward the throttling threshold, paging the engineer proactively via email/Teams before throttling actually happens, with nothing beyond a browser required.
>
> Option A fails both stated constraints: it requires an admin-installed app, and that app doesn't support alerting at all. Option B is reactive, not proactive — it waits for a failure that's already downstream of the throttling event the scenario wants to catch earlier. Option D is a scheduled daily summary, not a real-time proactive page, and doesn't satisfy "before the capacity is throttled."

---

**[← Back to Mock Exam 1](./mock-exam-1.md)**
