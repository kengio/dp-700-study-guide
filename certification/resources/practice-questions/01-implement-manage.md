---
title: "Practice Questions: Implement and Manage an Analytics Solution"
type: practice-questions
tags:
  - dp-700
  - practice-questions
  - implement-manage
---

# Practice Questions: Implement and Manage an Analytics Solution

Domain 1 covers 30–35% of the DP-700 exam and spans four sections: Fabric workspace settings, lifecycle management, security & governance, and orchestration. These 27 questions are weighted roughly to match that internal split — none of them repeat the inline practice questions already embedded in the topic files, so treat a miss here as a signal to go re-read the linked section.

---

## Question 1: Attaching an Environment from a Different Workspace

**Question** *(Medium)*:

A team attaches a Spark environment created in Workspace A to a notebook running in Workspace B. Workspace A's environment defines a custom pool with X-Large nodes and several Full-mode libraries. What happens to the notebook's session in Workspace B?

A. It inherits both the compute configuration and the libraries from Workspace A's environment  
B. It inherits only the libraries and resources, not the compute configuration  
C. The attachment fails outright because environments can't be shared across workspaces  
D. It inherits only the compute configuration; the libraries must be reinstalled manually from scratch in Workspace B  

> [!success]- Answer
> **B. It inherits only the libraries and resources, not the compute configuration**
>
> Attaching an environment from a different workspace silently drops that environment's compute configuration — the session falls back to Workspace B's own pool and compute settings, keeping only the libraries and resources.
>
> Option A is the common mistake this scenario is designed to catch: compute doesn't travel with a cross-workspace environment attachment. Option C is wrong because the attachment itself succeeds (it just doesn't carry compute config) — it only fails outright if the two workspaces don't share the same capacity and network security settings. Option D reverses which part actually carries over: libraries and resources are what persist, not compute.

---

## Question 2: Native Execution Engine and JSON Processing

**Question** *(Medium)*:

A notebook has the native execution engine enabled at the environment level. A cell reads a Delta table and applies heavy JSON parsing transformations on a string column, alongside several standard aggregations. What should the team expect?

A. The entire job fails outright, since NEE has no fallback path for an unsupported format  
B. The JSON parsing portion falls back automatically to the standard JVM Spark engine  
C. NEE accelerates JSON parsing identically to how it accelerates Parquet and CSV reads  
D. The job must be entirely rewritten in Scala before NEE will process JSON natively  

> [!success]- Answer
> **B. The JSON parsing portion falls back automatically to the standard JVM Spark engine**
>
> JSON (and XML) aren't accelerated by the native execution engine, but NEE's automatic fallback is granular — an unsupported operator or format only causes that portion of the query to fall back, not the entire job.
>
> Option A overstates the failure mode; NEE never blocks a job outright, it falls back silently. Option C is factually wrong — CSV is vectorized and supported, but JSON and XML explicitly are not. Option D is a distractor with no basis: NEE's language support isn't the limiting factor here, the data format is.

---

## Question 3: Assigning Workspaces to a Domain by Admin

**Question** *(Medium)*:

A Fabric admin assigns a domain to a set of workspaces using the "by workspace admin" method, selecting a security group. Six months later, someone in that security group creates a brand-new workspace. What happens to the new workspace's domain assignment?

A. It's automatically assigned to the same domain, since the method tracks the admin's group membership continuously  
B. It's automatically assigned only if the group is also set as the domain's default domain  
C. Nothing — "by workspace admin" assignment only affects workspaces that existed at the time the assignment ran, not future ones  
D. It's assigned to the domain only after the workspace reaches 100 items  

> [!success]- Answer
> **C. Nothing — "by workspace admin" assignment only affects workspaces that existed at the time the assignment ran, not future ones**
>
> The "by workspace admin" bulk-assignment method is a one-time operation against existing workspaces — it excludes "My workspaces" and doesn't track ongoing group membership for future workspace creation.
>
> Option A confuses this method with **default domain**, which is the mechanism that does auto-assign future workspaces created by covered users/groups — that's a separate, distinct feature (option B correctly hints at it but frames it as a dependency rather than a wholly different mechanism, which is also not how it works: default domain is configured independently). Option D invents a made-up item-count threshold that doesn't exist in Fabric's domain assignment model.

---

## Question 4: Subdomain Settings Tabs

**Question** *(Easy)*:

Which **Domain settings** side pane tab is available for a subdomain?

A. Admins  
B. Default domain  
C. Delegated Settings  
D. General settings  

> [!success]- Answer
> **D. General settings**
>
> Subdomains only expose the **General settings** tab (name and description) — Admins, Contributors, Default domain, and Delegated Settings are all domain-only concepts, since a subdomain always inherits its parent domain's admins and governance.
>
> Options A, B, and C are each domain-level tabs that require a subdomain to have its own admins — which it explicitly never does. A subdomain is managed entirely through its parent domain's admin roster.

---

## Question 5: Case-Sensitive Files in OneLake File Explorer

**Question** *(Medium)*:

A Lakehouse's `Files` folder contains two objects that differ only by case: `Report.csv` and `report.csv`. A user browses this folder using OneLake file explorer on Windows. What do they see?

A. Both files, since OneLake file explorer preserves case exactly as OneLake stores it  
B. Only the older of the two files  
C. An error preventing the folder from opening at all  
D. Both files merged into a single entry with combined content  

> [!success]- Answer
> **B. Only the older of the two files**
>
> Windows File Explorer is case-insensitive while OneLake is case-sensitive. This is a documented case-sensitivity mismatch: Windows File Explorer can't distinguish the two names, so when two files differ only by case, it shows only the oldest one.
>
> Option A gets the mismatch backward — OneLake's case sensitivity doesn't help here because the *client* (Windows File Explorer) is the limiting factor, not the server. Option C is too severe a failure mode for a naming collision like this. Option D invents a merge behavior that isn't how File Explorer resolves the collision — it picks one file, it doesn't combine content.

---

## Question 6: Migrating from ADF Workflow Orchestration Manager to Apache Airflow Job

**Question** *(Medium)*:

A team currently uses Azure Data Factory's Workflow Orchestration Manager, which relies on Blob Storage integration for storing DAG artifacts and native diagnostic logs/metrics for monitoring. They plan to migrate to Fabric's Apache Airflow job. Which capability will they need to replace, since Fabric's Apache Airflow job doesn't currently offer it?

A. High availability for the Airflow scheduler component  
B. Deferrable operators, which free idle workers during long waits  
C. Diagnostic logs and metrics, plus Blob Storage integration  
D. Pause/resume TTL for temporarily suspending an idle environment  

> [!success]- Answer
> **C. Diagnostic logs and metrics, plus Blob Storage integration**
>
> Fabric's Apache Airflow job gains high availability, deferrable operators, and pause/resume TTL over ADF's Workflow Orchestration Manager — but it currently lacks diagnostic logs/metrics export and Blob Storage integration, both of which the older ADF tool has.
>
> Options A, B, and D each name a capability Fabric's Apache Airflow job *has* that ADF's tool doesn't — the exact opposite of what the scenario is asking about. The feature-comparison table's whole point is that migration isn't a strict upgrade in every dimension; teams relying on diagnostic logs/metrics or Blob Storage from the ADF side need a replacement plan (per-task-instance logs in the native Airflow UI, for example).

---

## Question 7: GitHub Enterprise Server Support

**Question** *(Easy)*:

A company runs a self-hosted GitHub Enterprise Server behind a private network, accessible only via a corporate VPN. They want to connect a Fabric workspace to a repository on this server using Git integration. Is this supported?

A. Yes, as long as the server is reachable from the Fabric service's IP range  
B. Yes, but only with a service principal, not OAuth2  
C. No — Fabric only supports GitHub Enterprise's cloud offering  
D. Yes, if the workspace is on a Premium Per User (PPU) capacity  

> [!success]- Answer
> **C. No — Fabric only supports GitHub Enterprise's cloud offering**
>
> Fabric Git integration supports GitHub Enterprise cloud (`.com`/`ghe.com`) only. A self-hosted GitHub Enterprise Server instance is explicitly unsupported, regardless of public accessibility, network configuration, or authentication method.
>
> Options A and B both imagine a network- or auth-based workaround that doesn't exist — the limitation is about the product offering itself (cloud vs. self-hosted), not reachability or credentials. Option D invents a licensing tier requirement that has nothing to do with Git provider support.

---

## Question 8: Undoing an Uncommitted Item Deletion

**Question** *(Medium)*:

A developer deleted a Lakehouse item in a Git-connected workspace but hasn't committed the deletion yet. They select **Undo** to revert to the last-synced state. What happens to the recreated Lakehouse?

A. It's restored exactly as it was, including its original sensitivity label and ownership  
B. It's recreated with fresh metadata: the sensitivity label is lost and ownership resets  
C. Undo can't recreate a deleted item — only newly added items can be undone  
D. The Lakehouse is restored with its label intact, but ownership resets  

> [!success]- Answer
> **B. It's recreated with fresh metadata: the sensitivity label is lost and ownership resets**
>
> Undoing a deleted item recreates it, but with fresh metadata: any sensitivity label applied to the original is lost, and ownership resets to whoever performed the Undo.
>
> Option A overstates what Undo restores — it isn't a perfect snapshot restore. Option C is wrong in the opposite direction: undoing a newly *added* item permanently deletes it, but undoing a *deleted* item does recreate it, just with the caveats above. Option D is half right (ownership does reset) but wrong about the label, which is also lost, not preserved.

---

## Question 9: Branching Out With Uncommitted Changes

**Question** *(Medium)*:

A developer with the Contributor role has made several changes to workspace items but hasn't committed any of them to Git yet. They then use **Branch out to another workspace**. What happens to those uncommitted changes?

A. They're lost — only content already committed to Git is included in the branched workspace  
B. They're carried over automatically since Branch out copies the live workspace state, not just Git history  
C. Branch out is blocked entirely until all changes are committed  
D. They're preserved in a separate "uncommitted" folder in the new workspace  

> [!success]- Answer
> **A. They're lost — only content already committed to Git is included in the branched workspace**
>
> Branch out to another workspace creates a new Git branch from the source workspace's *connected branch's latest commit* — any workspace items not yet committed to Git are lost in the process, so committing first is essential before branching out.
>
> Option B misunderstands the mechanism: branch out works from Git history, not a live snapshot of the workspace's current uncommitted state. Option C is wrong — Fabric doesn't block the operation, it silently proceeds and drops the uncommitted work, which is exactly why this is a documented common mistake. Option D invents a recovery mechanism that doesn't exist.

---

## Question 10: Adding a Column via a Database Project

**Question** *(Hard)*:

A developer adds a new nullable column to an existing table by editing its `.sql` file in a Git-connected SQL database project, then triggers **Update from source control**. The table currently holds 50 million rows. What is the documented risk of this specific change?

A. The update fails outright because ALTER TABLE isn't supported in database projects  
B. The deployment process drops and recreates the table, risking data loss on a populated table  
C. The column is added instantly with zero risk, since ALTER TABLE ADD COLUMN is always a metadata-only operation  
D. The table is automatically backed up before the ALTER TABLE runs  

> [!success]- Answer
> **B. The deployment process drops and recreates the table, risking data loss on a populated table**
>
> This is a documented, exam-relevant limitation shared by both Git integration and deployment pipelines for Warehouse/SQL database: using `ALTER TABLE` to add a constraint or column currently causes the deployment process to drop and recreate the table, which is a genuine data-loss risk on a populated table.
>
> Option A is wrong — the update doesn't fail, it succeeds but with the drop/recreate side effect. Option C reflects how `ALTER TABLE ADD COLUMN` behaves in most SQL engines generally, but explicitly not how Fabric's current database project deployment process handles it. Option D invents an automatic-backup safety net that doesn't exist — the documented mitigation is a manual create-new-table/copy-data/rename-and-update-project workaround, not an automatic backup.

---

## Question 11: Unassigning a Workspace from a Pipeline Stage

**Question** *(Easy)*:

A pipeline admin unassigns a workspace from the Test stage of a deployment pipeline, intending to reassign a different workspace later. What happens to the Test stage's deployment history and any deployment rules configured on it?

A. Both are preserved and automatically reapplied when a new workspace is assigned to the stage  
B. Deployment history is preserved, but deployment rules are lost  
C. Both are permanently lost  
D. Deployment rules are preserved, but deployment history is lost  

> [!success]- Answer
> **C. Both are permanently lost**
>
> Deployment history and deployment rules for that stage are gone for good. Unassigning a workspace from a pipeline stage loses that stage's deployment history and any configured deployment rules — both disappear entirely, not just hidden until reassignment.
>
> Options A, B, and D each preserve at least one of the two, which doesn't match the documented behavior — neither history nor rules survive an unassignment. Anyone planning to swap a stage's workspace should treat this as a one-way loss and document rules externally if they'll need to reconfigure them.

---

## Question 12: Deployment Rule for a Notebook's Default Lakehouse

**Question** *(Hard)*:

A team wants the Production stage's notebook to always point at the Production lakehouse after every deployment, regardless of which lakehouse the Test-stage notebook currently references. Where and how should this be configured?

A. A default lakehouse rule, defined on the notebook in the Production stage  
B. A data source rule on the notebook, defined in the Development stage  
C. A parameter rule on the notebook, defined in the Test stage  
D. This isn't achievable — deployment rules don't support notebooks  

> [!success]- Answer
> **A. A default lakehouse rule, defined on the notebook in the Production stage**
>
> Notebooks support exactly one deployment rule type: a **default lakehouse rule**, which sets the target stage's default lakehouse for that notebook on every subsequent deployment. Like all deployment rules, it's defined in the *target* stage — here, Production.
>
> Option B picks the wrong rule type (data source rules apply to Dataflow Gen1, semantic model, paginated report, and mirrored database — not notebooks) and the wrong stage (rules can never be created in Development). Option C also picks the wrong rule type for a notebook — parameter rules apply to Dataflow Gen1 and semantic model, not notebooks. Option D is factually wrong: notebooks are one of the five item types that do support a (narrow) deployment rule.

---

## Question 13: Who Can Add New Workspace Members

**Question** *(Easy)*:

A user with the **Contributor** role wants to add a colleague to the workspace with the **Viewer** role. Can they do this?

A. No — only Admin and Member can add other people to the workspace  
B. Yes — Contributor can add anyone at Viewer level or below  
C. Yes, but only if they were granted Reshare permission on an item first  
D. No — only the workspace creator can add new members, regardless of role  

> [!success]- Answer
> **A. No — only Admin and Member can add other people to the workspace**
>
> Adding members or others with lower permissions is a capability granted to **Admin and Member** roles only — Contributor and Viewer both lack it, regardless of what level they're trying to add someone at.
>
> Option B assumes Contributor has some limited version of this capability, which it doesn't — the capability is binary (Admin/Member have it, Contributor/Viewer don't), not tiered by the target role. Option C confuses item-level Reshare permission (which lets someone reshare a specific item) with workspace-level member management, which is a completely separate capability. Option D is wrong — Admin isn't limited to the original creator; any Admin can add members, and multiple Admins can exist.

---

## Question 14: Scheduling a Refresh Through an On-Premises Data Gateway

**Question** *(Medium)*:

A user holds the Contributor role in a workspace and wants to schedule a refresh that connects through an on-premises data gateway. They have Contributor access but the schedule configuration fails. What's the most likely cause?

A. Contributor role doesn't include schedule permissions at all  
B. Only Admins can schedule any refresh, regardless of data source  
C. The user lacks a separate permission on the gateway itself  
D. The gateway must be reconfigured to allow Contributor-level access  

> [!success]- Answer
> **C. The user lacks a separate permission on the gateway itself**
>
> Gateway access is managed independently of workspace roles. Scheduling refreshes through an on-premises data gateway requires Admin/Member/Contributor in the workspace *plus* a matching permission on the gateway itself — gateway access sits entirely outside the Fabric workspace-role system, typically administered by whoever runs the gateway cluster.
>
> Option A is wrong — Contributor does include schedule-refresh capability in general; the gateway is the specific blocker here, not the workspace role. Option B overstates the requirement — Admin isn't needed for non-gateway refreshes, and even for gateway refreshes, Contributor is sufficient *if* the separate gateway permission is also granted. Option D describes a real-sounding but nonexistent "Contributor-level access" concept on the gateway side — gateway permissions aren't expressed in Fabric workspace-role terms at all.

---

## Question 15: RLS Predicate Types in Fabric Warehouse

**Question** *(Easy)*:

A developer migrating security logic from an on-premises SQL Server database wants to implement a BLOCK predicate to prevent inserts that would violate a row-level rule in a Fabric Warehouse. Is this supported?

A. Yes, BLOCK predicates work identically to on-premises SQL Server  
B. Yes, but only for INSERT and UPDATE, not DELETE  
C. No — Fabric Warehouse doesn't support RLS of any kind  
D. No — Fabric Warehouse RLS supports FILTER predicates only  

> [!success]- Answer
> **D. No — Fabric Warehouse RLS supports FILTER predicates only**
>
> Fabric Warehouse RLS is built on `CREATE SECURITY POLICY` with FILTER predicates, silently filtering rows from `SELECT`/`UPDATE`/`DELETE`. There's no BLOCK predicate type as in on-premises Azure SQL/SQL Server — a scenario describing a BLOCK predicate for Fabric Warehouse RLS is describing a feature Fabric doesn't have.
>
> Options A and B both assume BLOCK predicate support exists in some form, which it doesn't — this is exactly the kind of on-premises-experience assumption the exam tests. Option C overcorrects: Fabric Warehouse absolutely supports RLS — just the FILTER predicate type only, not BLOCK.

---

## Question 16: Querying a Table with a Missing CLS Grant

**Question** *(Medium)*:

A user has been granted `SELECT` on every column of `dbo.Customers` except `CreditCard`. They run `SELECT * FROM dbo.Customers`. What happens?

A. The entire query fails with a permission-denied error naming the CreditCard column  
B. The query succeeds, silently omitting the CreditCard column from the results  
C. The query succeeds and CreditCard displays as NULL for every row  
D. The query succeeds, and CreditCard displays a default-masked value  

> [!success]- Answer
> **A. The entire query fails with a permission-denied error naming the CreditCard column**
>
> CLS treats every column grant as its own guest list. A `SELECT *` that touches an un-granted column doesn't quietly drop it — it rejects the entire statement with a hard permission error naming the specific column.
>
> Option B describes what many people assume CLS does (silently omit the column) but is factually wrong for Fabric's `GRANT SELECT ON table(columns)` mechanism. Option C confuses CLS with a NULL-out behavior it doesn't have. Option D confuses CLS with dynamic data masking (DDM), which is a completely different, complementary mechanism — DDM masks values and lets the query succeed; CLS blocks the query outright when an un-granted column is referenced.

---

## Question 17: Blocking Access Despite Role-Inherited Grants

**Question** *(Hard)*:

`AnalystRole` has been granted `SELECT` on `dbo.CustomerPayments` via `GRANT SELECT ON dbo.CustomerPayments TO [AnalystRole]`. A security review requires that no member of `AnalystRole` can read that table, without removing them from the role (they still need other role privileges). Which statement achieves this?

A. `REVOKE SELECT ON dbo.CustomerPayments FROM [AnalystRole]`  
B. `DENY SELECT ON dbo.CustomerPayments TO [AnalystRole]`  
C. `DROP ROLE [AnalystRole]`  
D. `ALTER ROLE [AnalystRole] DROP MEMBER`  

> [!success]- Answer
> **B. `DENY SELECT ON dbo.CustomerPayments TO [AnalystRole]`**
>
> `DENY` is an explicit, overriding block that guarantees access is denied regardless of any other grant path — exactly what "guaranteed blocked, without removing role membership" requires.
>
> Option A (`REVOKE`) only erases the specific grant entry; it doesn't guarantee the block, because if access was also granted through some other path (a different role, a direct grant), `REVOKE` wouldn't touch that. Option C removes the entire role definition, which is far more destructive than the requirement calls for and breaks every other privilege the role provides. Option D removes members from the role entirely, directly violating the stated requirement that members keep their other role privileges.

---

## Question 18: Removing a User's Broad Lakehouse Access

**Question** *(Hard)*:

A Lakehouse has the default `DefaultReader` role (virtual membership: all users with ReadAll permission) alongside a custom role `RegionEUReader` scoped to the `EU/` folder. An administrator wants a specific user, who currently has the item's ReadAll permission, to see only the `EU/` folder going forward. Adding them to `RegionEUReader` alone isn't enough. What else must happen?

A. Nothing further — role scopes always take precedence over DefaultReader  
B. RegionEUReader must be given a higher priority number than DefaultReader  
C. The user's ReadAll permission must be removed (or DefaultReader deleted)  
D. The user must be removed from the workspace entirely  

> [!success]- Answer
> **C. The user's ReadAll permission must be removed (or DefaultReader deleted)**
>
> DefaultReader's virtual membership otherwise still grants them broad access. OneLake security roles are additive at the table/folder level — a user in *any* role granting access to a table can see it. Because `DefaultReader`'s membership is computed dynamically from anyone holding ReadAll, the user keeps full unrestricted read access through that role no matter what a new narrower role says, unless `DefaultReader` is deleted or their underlying ReadAll permission is removed.
>
> Option A is the exact misconception this scenario tests — there's no "narrower role wins" precedence rule in OneLake security. Option B invents a priority/ranking mechanism that doesn't exist for OneLake security roles. Option D is a wildly disproportionate fix — removing the user from the workspace entirely isn't necessary; only their ReadAll permission (or the DefaultReader role itself) needs to change.

---

## Question 19: Masking a Date-of-Birth Column

**Question** *(Medium)*:

A developer wants to mask a `DateOfBirth` column in a Fabric Warehouse table, following an example from on-premises SQL Server training material that uses a `datetime()` masking function for a partial date reveal. What should they expect in Fabric?

A. `datetime()` works identically in Fabric, revealing a partial date exactly as it would on-premises  
B. Fabric supports `datetime()`, but only through the SQL analytics endpoint, not the Warehouse's own T-SQL surface  
C. Date columns are entirely unsupported by dynamic data masking in Fabric, regardless of function  
D. Fabric documents only four masking functions  

> [!success]- Answer
> **D. Fabric documents only four masking functions**
>
> `default()`, `email()`, `random(m,n)`, `partial()` — so `datetime()` isn't one of them; dates use `default()` instead. Fabric Data Warehouse's own masking-functions reference documents exactly four functions. Unlike some on-premises SQL Server versions, there's no dedicated `datetime()` partial-date-reveal function — a date column masked in Fabric uses `default()`, which fully replaces the value with a fixed date rather than partially revealing it.
>
> Options A and B both assume `datetime()` exists somewhere in Fabric, which it doesn't, in either the Warehouse or the SQL analytics endpoint. Option C overcorrects — date columns absolutely can be masked in Fabric, just with `default()` rather than a dedicated partial-date function.

---

## Question 20: Label Inheritance When Creating a New Item

**Question** *(Medium)*:

A Lakehouse is labeled "Confidential." A data engineer creates a new Notebook directly from that Lakehouse (using the "New notebook" action from within the Lakehouse item). Does the new Notebook inherit the label?

A. Yes — inheritance upon creation also covers specific non-Power BI patterns  
B. No — inheritance upon creation only applies to Power BI items  
C. Only if the tenant has enabled mandatory labeling  
D. Only if the Notebook is created inside the same domain as the Lakehouse  

> [!success]- Answer
> **A. Yes — inheritance upon creation also covers specific non-Power BI patterns**
>
> "Inheritance upon creation" — a new item created from an existing labeled item inheriting that label — works for all Power BI items *and* a specific list of non-Power BI patterns, one of which is exactly this case: a Pipeline or Notebook created from a Lakehouse.
>
> Option B is too restrictive — inheritance upon creation explicitly extends beyond Power BI items to a documented set of Fabric-native patterns. Option C confuses inheritance upon creation with mandatory labeling, which is an unrelated setting about whether an item can be saved without any label at all. Option D invents a domain-scoping condition that doesn't govern label inheritance — domains affect discovery and delegated settings, not label propagation rules.

---

## Question 21: Who Can Mark an Item as Promoted

**Question** *(Medium)*:

A data analyst has Write permission on a semantic model but is not on the Fabric admin's list of authorized reviewers. Can they mark the semantic model as **Promoted**?

A. Yes — Promoted only requires write permission on the item  
B. No — Promoted requires the same tenant-admin authorization as Certified  
C. No — only workspace Admins can apply any endorsement tier  
D. Yes, but only if the item is also endorsed as Certified first  

> [!success]- Answer
> **A. Yes — Promoted only requires write permission on the item**
>
> Promoted is the one endorsement tier open to *any* item owner or write-permission holder. Certified and Master data both additionally require the applier to be on the Fabric admin's authorized-reviewers list — Promoted has no such gate.
>
> Option B incorrectly extends Certified's authorization requirement to Promoted, which is exactly the distinction this topic tests. Option C is too restrictive — workspace Admin isn't required for Promoted; ordinary write permission suffices. Option D invents a dependency between the tiers that doesn't exist — Promoted, Certified, and Master data are each independently applicable, not sequential.

---

## Question 22: Can Dataflow Gen2 Trigger a Notebook?

**Question** *(Easy)*:

A team wants a Dataflow Gen2 item to automatically trigger a Notebook run immediately after the dataflow finishes refreshing, without using a pipeline. Is this possible?

A. Yes, using Dataflow Gen2's built-in "On refresh complete" trigger  
B. Yes, but only if the notebook is in the same workspace  
C. Yes, via a Dataflow Gen2 output destination set to "Notebook"  
D. No — Dataflow Gen2 can't trigger or orchestrate other items on its own  

> [!success]- Answer
> **D. No — Dataflow Gen2 can't trigger or orchestrate other items on its own**
>
> This is one of the most common exam distractor shapes: Dataflow Gen2 can be scheduled itself, but it has no native mechanism to trigger or orchestrate any other item. Only a pipeline provides that coordination layer — the correct architecture is a pipeline with a Dataflow Gen2 activity followed by a Notebook activity.
>
> Options A and C both invent Dataflow Gen2 features (a completion trigger, a "Notebook" output destination) that don't exist — Dataflow Gen2's destinations are data sinks (Lakehouse, Warehouse, and similar), not other orchestration items. Option B is a plausible-sounding qualifier on a capability that doesn't exist in the first place, regardless of workspace boundaries.

---

## Question 23: Choosing Between a Pipeline and Apache Airflow Job

**Question** *(Hard)*:

A team migrating from Azure Data Factory has two kinds of workloads: straightforward copy-and-transform jobs that map cleanly to drag-and-drop activities, and a subset of Python-authored DAGs that call third-party Airflow provider operators unavailable in Fabric's pipeline activity catalog. What's the correct architecture?

A. Use pipelines for the copy/transform workloads, and Apache Airflow job for the Python-DAG subset  
B. Force everything into pipelines, since Fabric consolidates all orchestration into one tool  
C. Use Apache Airflow job for everything, since it's the newer "next generation" tool  
D. Rewrite the third-party Airflow provider operators as custom pipeline activities before migrating  

> [!success]- Answer
> **A. Use pipelines for the copy/transform workloads, and Apache Airflow job for the Python-DAG subset**
>
> Fabric's orchestration surface isn't limited to Dataflow Gen2/pipelines/notebooks — Apache Airflow job is a fourth, code-first surface purpose-built for teams with existing Airflow DAGs or a dependency on the Airflow provider ecosystem. The correct migration doesn't force every workload into one tool; it matches each workload's requirements to the tool that actually satisfies them.
>
> Option B ignores that the Python-DAG subset has a real constraint (third-party Airflow provider operators) that pipelines don't solve. Option C over-corrects in the other direction — Apache Airflow job being described as "next generation" doesn't mean it's the right tool for straightforward copy/transform work, which pipelines handle more simply. Option D describes an enormous, unnecessary engineering effort to avoid using a tool (Apache Airflow job) that already solves the problem natively.

---

## Question 24: Modifying an Interval-Based Schedule

**Question** *(Easy)*:

A pipeline has an interval-based schedule (Preview) configured. The team wants to change the window start time. What must they do?

A. Edit the Window start time field directly, since it behaves like any other schedule setting  
B. Disable the schedule first, apply the change, then toggle it back to enabled  
C. Open a support ticket, since interval-based schedules require Microsoft-side changes  
D. Delete the interval-based schedule and create a new one with the desired window  

> [!success]- Answer
> **D. Delete the interval-based schedule and create a new one with the desired window**
>
> Unlike a fixed schedule, an interval-based schedule can't be enabled, disabled, or edited in place after creation — the only supported way to change it is to delete it and create a new one with the desired configuration.
>
> Option A assumes in-place editing is possible, which it explicitly isn't for interval-based schedules. Option B invents a disable/re-enable workaround that also isn't supported — interval-based schedules don't have an enable/disable toggle at all. Option C is unnecessary; this is a documented, self-service limitation, not something requiring a support ticket.

---

## Question 25: Filtering a Storage Event Trigger by Folder

**Question** *(Medium)*:

A team configures a OneLake event trigger and wants to filter it so it only fires for files landing in a specific folder. Where is this filter configured?

A. A dedicated "Folder" field, separate from the event source configuration  
B. It isn't possible to filter by folder — only by file extension  
C. The `Subject` field  
D. A pipeline parameter passed at trigger creation time  

> [!success]- Answer
> **C. The `Subject` field**
>
> Folder name, file name, file type, and container are all part of `Subject`, filtered together, not as separate top-level fields. Event triggers filter using the `Subject` field of the underlying CloudEvents-shaped event — folder name, file name, file type, and container are all encoded within `Subject`, not exposed as separate top-level filter fields in the trigger authoring UI.
>
> Option A invents a dedicated folder field that doesn't exist as a separate concept from `Subject`. Option B is too restrictive — file extension is one of several things filterable via `Subject`, not the only option. Option D confuses trigger-time filtering (which determines *whether* the pipeline runs) with pipeline parameters (which pass values *into* a run that's already been triggered) — these are different mechanisms.

---

## Question 26: Retry Conditions on a Web Activity

**Question** *(Hard)*:

A pipeline includes a Web activity calling an external REST API. The team wants to configure a Preview retry condition that only retries on a `429` error code, failing fast on anything else. Is this supported directly on the Web activity?

A. Yes — retry conditions are a universal setting available on every pipeline activity type  
B. No — condition-based retry only covers Copy data, Notebook, Dataflow, and Stored procedure  
C. No — Web activities don't support any form of retry, conditional or otherwise  
D. Yes, but only when the Web activity is nested inside a ForEach loop's child activities  

> [!success]- Answer
> **B. No — condition-based retry only covers Copy data, Notebook, Dataflow, and Stored procedure**
>
> Conditional retries (matching a specific error code/message/failure type) are documented as available only for a narrow subset of activity types. A Web activity can still retry — every activity supports the basic count/interval retry settings — but it can't restrict *which* failures trigger a retry using the Preview condition feature.
>
> Option A overstates the feature's scope — conditional retries specifically are narrowly scoped, even though basic retry (count/interval) is universal. Option C is wrong in the opposite direction — basic retry is available on every activity type, including Web. Option D invents an unrelated workaround; wrapping an activity in a ForEach loop has nothing to do with unlocking retry-condition support.

---

## Question 27: Nesting a ForEach Inside Another ForEach

**Question** *(Medium)*:

A pipeline needs to iterate over a list of regions, and for each region, iterate over a list of tables within that region — a genuinely nested loop. How should this be structured in Fabric?

A. Nest a `ForEach` activity directly inside another `ForEach` activity's child activities  
B. Use a single `ForEach` with a combined region+table array, flattened via an expression  
C. Use `Until` instead of the inner `ForEach`, since `Until` supports nesting  
D. The outer `ForEach` should call a child pipeline via `Invoke Pipeline` per region  

> [!success]- Answer
> **D. The outer `ForEach` should call a child pipeline via `Invoke Pipeline` per region**
>
> `ForEach` can't be nested directly inside another `ForEach` (or an `Until`). The documented workaround for genuinely nested iteration is a two-level pipeline pattern: the outer `ForEach` invokes a child pipeline per item via `Invoke Pipeline`, and the inner loop lives inside that child pipeline.
>
> Option A describes exactly the unsupported configuration the scenario is testing for. Option B is a real technique in some cases but doesn't actually solve *nested, independent* iteration the way the scenario describes (per-region table lists) — flattening loses the two-level structure the team needs. Option C is wrong on two counts: `Until` doesn't support nesting `ForEach` either, and `Until` is a do-while condition loop, not a substitute for iterating over an items array in the first place.

---

**[← Back to Practice Questions](./practice-questions.md)**
