---
title: Mock Exam 2 — Debrief
type: debrief
tags:
  - dp-700
  - mock-exam
  - debrief
  - study-plan
---

# Mock Exam 2 — Debrief

> [!abstract]
>
> - Use this **after** completing Mock Exam 2 and checking your answers
> - Every question maps to a blueprint skill + topic file + cheat sheet
> - The "Study plan by miss count" section turns your total miss count into a re-study plan
> - The domain-level diagnosis grid at the bottom turns per-domain misses into a targeted re-read order

> [!tip] How to use this debrief
>
> 1. List the question numbers you got wrong
> 2. For each, look up the row below — re-read the linked topic file section and the cheat sheet it points to
> 3. Count your total misses, then jump to the matching tier in **Study plan by miss count**
> 4. If 3 or more misses land in the same domain, also check that domain's row in the **diagnosis grid**
> 5. Re-take Mock 2 after a focused re-study pass. Anything wrong **twice** goes on a flashcard list before exam day

---

## Question-by-question map

### Domain 1 — Implement and manage (Qs 1–15)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 1 | Save vs. Publish on a Spark Environment | Configure Spark workspace settings | [01-spark-settings.md](../../01-fabric-workspace-settings/01-spark-settings.md) | — |
| 2 | A Domain Admin Reaching Into Another Domain | Configure domain workspace settings | [02-domain-settings.md](../../01-fabric-workspace-settings/02-domain-settings.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 3 | Disabling OneLake File Explorer for the Whole Org | Configure OneLake workspace settings | [03-onelake-settings.md](../../01-fabric-workspace-settings/03-onelake-settings.md) | — |
| 4 | How Long an Airflow Starter Pool Stays Warm | Configure Apache Airflow workspace settings | [04-airflow-settings.md](../../01-fabric-workspace-settings/04-airflow-settings.md) | — |
| 5 | Discarding Local Changes on a Conflicted Item | Implement version control | [01-version-control.md](../../02-lifecycle-management/01-version-control.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 6 | A Commit Blocked by a Missing Item-Level Grant | Implement version control | [01-version-control.md](../../02-lifecycle-management/01-version-control.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 7 | Loading Static Reference Data Into a Database Project | Create and configure database projects | [02-database-projects.md](../../02-lifecycle-management/02-database-projects.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 8 | One Permission Layer Isn't Enough to Deploy | Configure deployment pipelines | [03-deployment-pipelines.md](../../02-lifecycle-management/03-deployment-pipelines.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 9 | What a Power BI App Actually Grants | Implement workspace and item-level access controls | [01-workspace-item-access.md](../../03-security-governance/01-workspace-item-access.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 10 | CLS Against a SQL-Authenticated Connection | Implement RLS, CLS, and OLS | [02-granular-access-controls.md](../../03-security-governance/02-granular-access-controls.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 11 | A Contributor Under a Restrictive OneLake Security Role | Implement OneLake security | [03-onelake-security.md](../../03-security-governance/03-onelake-security.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 12 | Adding a Mask to an Already-Populated Column | Implement dynamic data masking | [04-dynamic-data-masking.md](../../03-security-governance/04-dynamic-data-masking.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 13 | Trying to Endorse a Report as Master Data | Implement governance (sensitivity labels, endorsement) | [05-governance.md](../../03-security-governance/05-governance.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 14 | What Actually Fires a OneLake Event Trigger | Configure schedules and triggers | [02-schedules-triggers.md](../../04-orchestration/02-schedules-triggers.md) | — |
| 15 | One Failed Sibling Blocks the Shared Downstream Activity | Implement orchestration patterns | [03-orchestration-patterns.md](../../04-orchestration/03-orchestration-patterns.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |

### Domain 2 — Ingest and transform (Qs 16–30)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 16 | A Hard Delete a Modified-Date Watermark Can't See | Implement full and incremental loads | [01-full-incremental-loads.md](../../05-loading-patterns/01-full-incremental-loads.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 17 | Trying to MERGE Through an Eventhouse's T-SQL Surface | Choose a data store | [01-choosing-data-store.md](../../06-batch-ingestion/01-choosing-data-store.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 18 | Deleting a Shortcut, Not the Data | Implement OneLake shortcuts | [02-onelake-shortcuts.md](../../06-batch-ingestion/02-onelake-shortcuts.md) | — |
| 19 | Is a Warehouse a Valid Internal Shortcut Target? | Implement OneLake shortcuts | [02-onelake-shortcuts.md](../../06-batch-ingestion/02-onelake-shortcuts.md) | — |
| 20 | Exposing a Unity Catalog's Tables Without Copying Storage | Implement mirroring | [03-mirroring.md](../../06-batch-ingestion/03-mirroring.md) | — |
| 21 | A Homegrown App With No Built-In Mirroring Connector | Implement mirroring | [03-mirroring.md](../../06-batch-ingestion/03-mirroring.md) | — |
| 22 | Copying a Folder of Mixed File Types Byte-for-Byte | Implement pipeline ingestion | [04-pipeline-ingestion.md](../../06-batch-ingestion/04-pipeline-ingestion.md) | — |
| 23 | A SQL-Skilled Team With a High-Volume Custom Transform | Choose a transform tool | [01-choosing-transform-tool.md](../../07-batch-transformation/01-choosing-transform-tool.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 24 | Dropping Rows Based on a Minimum Non-Null Count | Transform data with PySpark | [02-pyspark-transformations.md](../../07-batch-transformation/02-pyspark-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 25 | Case-Sensitive Matching, By Design and Forever | Transform data with T-SQL | [03-tsql-transformations.md](../../07-batch-transformation/03-tsql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 26 | An Update Policy Reaching Across Databases | Transform data with KQL | [04-kql-transformations.md](../../07-batch-transformation/04-kql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 27 | Missing the Initial CDC Snapshot in Eventstream | Implement Eventstreams | [02-eventstreams.md](../../08-streaming-data/02-eventstreams.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 28 | Removing checkpointLocation "Just for Testing" | Implement Spark structured streaming | [03-spark-structured-streaming.md](../../08-streaming-data/03-spark-structured-streaming.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 29 | Renaming a Table While OneLake Availability Is On | Implement KQL real-time analytics | [04-kql-realtime.md](../../08-streaming-data/04-kql-realtime.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 30 | A Hopping Window Directly in Eventstream | Implement windowing functions | [05-windowing-functions.md](../../08-streaming-data/05-windowing-functions.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |

### Domain 3 — Monitor and optimize (Qs 31–45)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 31 | Pipeline History Older Than Monitor Hub Retains | Monitor Fabric items and activities | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 32 | A Pro-Licensed Workspace's Refresh Schedule Ceiling | Monitor semantic model refresh | [02-semantic-model-refresh.md](../../09-monitoring-alerting/02-semantic-model-refresh.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 33 | What an Activator Rule's Action Can Actually Run | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 34 | Hitting Dataflow Gen2's 24-Hour Refresh Ceiling | Resolve pipeline and Dataflow errors | [01-pipeline-dataflow-errors.md](../../10-error-resolution/01-pipeline-dataflow-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 35 | A Scheduled Job vs. an Interactive Session at Full Capacity | Resolve notebook and T-SQL errors | [02-notebook-tsql-errors.md](../../10-error-resolution/02-notebook-tsql-errors.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 36 | Looking for a Two-Week-Old Ingestion Failure Record | Resolve real-time errors | [03-realtime-errors.md](../../10-error-resolution/03-realtime-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 37 | Reading a Shortcut Failure's HTTP Status Code | Resolve shortcut errors | [04-shortcut-errors.md](../../10-error-resolution/04-shortcut-errors.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 38 | Sizing Auto Compaction for a Small Table vs. a Huge One | Optimize Lakehouse performance | [01-lakehouse-optimization.md](../../11-performance-optimization/01-lakehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 39 | Multi-Column Statistics in Fabric Warehouse | Optimize Warehouse performance | [02-warehouse-optimization.md](../../11-performance-optimization/02-warehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 40 | A Cursor-Based Load That Takes Six Hours | Optimize Warehouse performance | [02-warehouse-optimization.md](../../11-performance-optimization/02-warehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 41 | Caching Repeated Shortcut Reads Without Any Setup | Optimize Spark performance | [03-spark-optimization.md](../../11-performance-optimization/03-spark-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 42 | Two Cost Models for Two Different Eventhouse Mechanisms | Optimize real-time performance | [04-realtime-optimization.md](../../11-performance-optimization/04-realtime-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 43 | Manually Overriding DIUs "Just to Be Safe" | Optimize pipeline and query performance | [05-pipeline-query-optimization.md](../../11-performance-optimization/05-pipeline-query-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 44 | A Dataflow Getting Slower With No Error in Sight | Optimize pipeline and query performance | [05-pipeline-query-optimization.md](../../11-performance-optimization/05-pipeline-query-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 45 | Setting an Alert Without Opening Activator First | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |

### Case Study: Meridian Health Network (Qs 46–50)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 46 | A Deployment Rule for the Paginated Report | Configure deployment pipelines (D1) | [03-deployment-pipelines.md](../../02-lifecycle-management/03-deployment-pipelines.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 47 | The Compliance Officer's Audit Log Window | Implement governance (D1) | [05-governance.md](../../03-security-governance/05-governance.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 48 | Mirroring the On-Premises EHR Database | Implement mirroring (D2) | [03-mirroring.md](../../06-batch-ingestion/03-mirroring.md) | — |
| 49 | Getting Raw Spark Logs for a Failed Notebook Run | Monitor Fabric items and activities (D3) | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 50 | Execute Permission Without Read or Write | Implement workspace and item-level access controls (D1) | [01-workspace-item-access.md](../../03-security-governance/01-workspace-item-access.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |

---

## Study plan by miss count

> [!tip] Triage rule
> Re-take the mock after focused study. Anything wrong **twice** becomes a flashcard for the morning of the exam.

### 0–5 misses: final-review only

You're at or above passing readiness. Skip full re-reads — instead:

1. Read `resources/final-review.md` cold, the way you would the morning of the real exam (once published — see the [overview](../../dp-700-overview.md) for its status)
2. Re-read only the specific topic-file sections named in the rows above for the questions you missed
3. If you missed the same question type twice across mocks (or on a re-take of this one), add it to a personal flashcard list
4. Schedule the real exam — you're ready

### 6–12 misses: targeted re-read map

Re-study is warranted, but only in the sections your misses actually cluster in — don't re-read all three domains cold.

1. Group your missed question numbers by domain using the tables above
2. For each domain with 3+ misses, re-read its linked topic files in question order (lower question numbers first — they roughly follow section order within the domain)
3. Re-read the matching cheat sheet's **Gotchas & Traps** section for each domain with misses
4. Re-attempt just the missed questions' topics via the [practice question bank](../practice-questions/practice-questions.md) before re-taking this mock
5. Re-take Mock 2 in full within a week

### 13+ misses: full domain re-study plan

> [!note] Check the sub-band before you commit to a full re-study
> Not every 13+ result means starting from zero:
>
> - **13–20 misses, clustered in one domain** — this is still a targeted gap, just a bigger one. Use the **6–12 misses** re-read map above, but work through the whole domain's topic files (not just the sections tied to your specific misses) since a cluster this size usually means the gaps run wider than the individual questions missed.
> - **20+ misses, or misses spread across all three domains** — this is a genuine foundational gap. Follow the full plan below.

This score means foundational gaps, not just edge-case gaps. Work through the guide's full study path before re-attempting:

1. Re-read every topic file in the domain(s) with the most misses, start to finish, in folder order (e.g., `01-fabric-workspace-settings/` through `04-orchestration/` for Domain 1)
2. Work every inline practice question embedded in those topic files — don't skip the foldable answers
3. Complete the matching [practice question bank](../practice-questions/practice-questions.md) file for each weak domain, aiming for 75%+ before returning here
4. Re-read the relevant [cheat sheets](../cheat-sheets/cheat-sheets.md) in full, not just the Gotchas & Traps section
5. Re-take Mock 2 only after completing steps 1–4 — re-taking it cold won't diagnose anything new
6. If you haven't already cleared Mock 1 (`resources/mock-exam/`), do that first — Mock 2 assumes that foundation and leans on less-common corners of the same domains
7. Once Mock 2 clears 35/50, move on to Mock Exam 3 (`resources/mock-exam-3/`, once published)

---

## Domain-level diagnosis grid

| If you missed... | Likely gap | Start here |
| :--- | :--- | :--- |
| 3+ in Domain 1, concentrated in Qs 1–4 | Workspace settings (Spark/domain/OneLake/Airflow settings) | [01-fabric-workspace-settings/fabric-workspace-settings.md](../../01-fabric-workspace-settings/fabric-workspace-settings.md) |
| 3+ in Domain 1, concentrated in Qs 5–8 | Lifecycle management (Git conflict resolution, database projects, deployment rules and permission layers) | [02-lifecycle-management/lifecycle-management.md](../../02-lifecycle-management/lifecycle-management.md), [lifecycle-cicd cheat sheet](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 3+ in Domain 1, concentrated in Qs 9–13 | Security & governance (workspace/item access layering, RLS/CLS/OLS, OneLake security, DDM, endorsement tiers) | [03-security-governance/security-governance.md](../../03-security-governance/security-governance.md), [security-governance cheat sheet](../cheat-sheets/security-governance-quick-ref.md) |
| 3+ in Domain 1, concentrated in Qs 14–15 | Orchestration (event triggers, outcome-path logic) | [04-orchestration/orchestration.md](../../04-orchestration/orchestration.md) |
| 3+ in Domain 2, concentrated in Qs 16–22 | Loading patterns and batch ingestion (change detection, shortcuts, mirroring flavors, Copy activity modes) | [05-loading-patterns/loading-patterns.md](../../05-loading-patterns/loading-patterns.md), [06-batch-ingestion/batch-ingestion.md](../../06-batch-ingestion/batch-ingestion.md) |
| 3+ in Domain 2, concentrated in Qs 23–30 | Batch transformation and streaming data (tool choice, PySpark/T-SQL/KQL syntax, Eventstream mechanics, windowing) | [07-batch-transformation/batch-transformation.md](../../07-batch-transformation/batch-transformation.md), [language-syntax-map cheat sheet](../cheat-sheets/language-syntax-map.md) |
| 3+ in Domain 3, concentrated in Qs 31–37 | Monitoring, alerting, and error resolution | [09-monitoring-alerting/monitoring-alerting.md](../../09-monitoring-alerting/monitoring-alerting.md), [monitoring-surfaces cheat sheet](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 3+ in Domain 3, concentrated in Qs 38–45 | Performance optimization across engines | [11-performance-optimization/performance-optimization.md](../../11-performance-optimization/performance-optimization.md), [optimization-levers cheat sheet](../cheat-sheets/optimization-levers-quick-ref.md) |
| 3+ in the case study (Qs 46–50) | Applying single-fact knowledge inside a multi-constraint scenario | Re-read the specific per-question rows above, then re-attempt the case study alone before the next full mock |

---

**[← Back to Mock Exam 2](./mock-exam-2.md)**
