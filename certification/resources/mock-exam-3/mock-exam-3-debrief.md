---
title: Mock Exam 3 — Debrief
type: debrief
tags:
  - dp-700
  - mock-exam
  - debrief
  - study-plan
---

# Mock Exam 3 — Debrief

> [!abstract]
>
> - Use this **after** completing Mock Exam 3 and checking your answers
> - Every question maps to a blueprint skill + topic file + cheat sheet
> - The "Study plan by miss count" section turns your total miss count into a re-study plan
> - The domain-level diagnosis grid at the bottom turns per-domain misses into a targeted re-read order
> - This mock is 36% Hard by design — see the **sub-band note** before assuming a lower score than Mocks 1–2 means you regressed

> [!tip] How to use this debrief
>
> 1. List the question numbers you got wrong
> 2. For each, look up the row below — re-read the linked topic file section and the cheat sheet it points to
> 3. Count your total misses, then jump to the matching tier in **Study plan by miss count**
> 4. If 3 or more misses land in the same domain, also check that domain's row in the **diagnosis grid**
> 5. Re-take Mock 3 after a focused re-study pass. Anything wrong **twice** goes on a flashcard list before exam day

---

## Question-by-question map

### Domain 1 — Implement and manage (Qs 1–15)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 1 | Billing When a Pipeline Fans Out to Shared Notebook Activities | Configure Spark workspace settings | [01-spark-settings.md](../../01-fabric-workspace-settings/01-spark-settings.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 2 | Reassigning a Workspace Already Claimed by Another Domain | Configure domain workspace settings | [02-domain-settings.md](../../01-fabric-workspace-settings/02-domain-settings.md) | — |
| 3 | Two OneLake Settings That Look Like the Same Lever | Configure OneLake workspace settings | [03-onelake-settings.md](../../01-fabric-workspace-settings/03-onelake-settings.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 4 | Installing a Private Wheel With No Git Repository Connected | Configure Apache Airflow workspace settings | [04-airflow-settings.md](../../01-fabric-workspace-settings/04-airflow-settings.md) | — |
| 5 | A Switch Branch Blocked by Local Edits | Implement version control | [01-version-control.md](../../02-lifecycle-management/01-version-control.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 6 | Hand-Editing the Auto-Generated .sqlproj File | Create and configure database projects | [02-database-projects.md](../../02-lifecycle-management/02-database-projects.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 7 | Two Lakehouses, Same Name, Different Folder | Configure deployment pipelines | [03-deployment-pipelines.md](../../02-lifecycle-management/03-deployment-pipelines.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 8 | Removing a Share That Doesn't Actually Revoke Access | Implement workspace and item-level access controls | [01-workspace-item-access.md](../../03-security-governance/01-workspace-item-access.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 9 | Blocking a Whole Schema vs. Blocking One Column | Implement RLS, CLS, and OLS | [02-granular-access-controls.md](../../03-security-governance/02-granular-access-controls.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 10 | A New Restrictive Role That Changes Nothing | Implement OneLake security | [03-onelake-security.md](../../03-security-governance/03-onelake-security.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 11 | Masking a Date-of-Birth Column With datetime() | Implement dynamic data masking | [04-dynamic-data-masking.md](../../03-security-governance/04-dynamic-data-masking.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 12 | Write Permission Isn't Enough to Certify | Implement governance (sensitivity labels, endorsement) | [05-governance.md](../../03-security-governance/05-governance.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 13 | One "Best" Tool, or Three Working Together | Choose an orchestration tool | [01-choosing-orchestration-tool.md](../../04-orchestration/01-choosing-orchestration-tool.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 14 | A Trigger Parameter Built From the Wrong Field | Configure schedules and triggers | [02-schedules-triggers.md](../../04-orchestration/02-schedules-triggers.md) | — |
| 15 | One Failure on a Shared Upon-Failure Path | Implement orchestration patterns | [03-orchestration-patterns.md](../../04-orchestration/03-orchestration-patterns.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |

### Domain 2 — Ingest and transform (Qs 16–30)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 16 | A Row Updated in the Same Second as the Captured Watermark | Implement full and incremental loads | [01-full-incremental-loads.md](../../05-loading-patterns/01-full-incremental-loads.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 17 | Overwriting a Dimension Row vs. Keeping Its History | Implement dimensional model loading | [02-dimensional-model-loading.md](../../05-loading-patterns/02-dimensional-model-loading.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 18 | Choosing the Silver-Layer Dedup Mechanism | Implement a streaming loading pattern | [03-streaming-loading-pattern.md](../../05-loading-patterns/03-streaming-loading-pattern.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 19 | An OLTP App That Also Wants Analytics, With No ETL | Choose a data store | [01-choosing-data-store.md](../../06-batch-ingestion/01-choosing-data-store.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 20 | Whose Identity Reads Through an Internal Shortcut | Implement OneLake shortcuts | [02-onelake-shortcuts.md](../../06-batch-ingestion/02-onelake-shortcuts.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 21 | Exposing a Catalog Without Copying a Byte | Implement mirroring | [03-mirroring.md](../../06-batch-ingestion/03-mirroring.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 22 | Binary Copy vs. Parsed Copy for a Straight File Move | Implement pipeline ingestion | [04-pipeline-ingestion.md](../../06-batch-ingestion/04-pipeline-ingestion.md) | — |
| 23 | Matching the Verb to the Tool | Choose a transform tool | [01-choosing-transform-tool.md](../../07-batch-transformation/01-choosing-transform-tool.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 24 | Broadcasting the Wrong Side of a Join | Transform data with PySpark | [02-pyspark-transformations.md](../../07-batch-transformation/02-pyspark-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 25 | Chaining Update Policies Across Three Tables | Transform data with KQL | [04-kql-transformations.md](../../07-batch-transformation/04-kql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 26 | A COPY INTO Load That Rejects a Perfectly Valid File Type | Transform data with T-SQL | [03-tsql-transformations.md](../../07-batch-transformation/03-tsql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 27 | One Eventstream, Two Very Different Query Destinations | Choose a streaming engine | [01-choosing-streaming-engine.md](../../08-streaming-data/01-choosing-streaming-engine.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 28 | Trying to MERGE Straight Into a Streaming Write | Implement Spark structured streaming | [03-spark-structured-streaming.md](../../08-streaming-data/03-spark-structured-streaming.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 29 | Eventstream's Message Size and Retention Ceilings | Implement Eventstreams | [02-eventstreams.md](../../08-streaming-data/02-eventstreams.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 30 | Approximating a Hopping Window in KQL | Implement windowing functions | [05-windowing-functions.md](../../08-streaming-data/05-windowing-functions.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |

### Domain 3 — Monitor and optimize (Qs 31–45)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 31 | Confirming Data Actually Landed in Eventhouse Tables | Monitor Fabric items and activities | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 32 | Diagnosing a Silent DirectQuery Fallback | Monitor semantic model refresh | [02-semantic-model-refresh.md](../../09-monitoring-alerting/02-semantic-model-refresh.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 33 | Trying to Alert Straight From the Capacity Metrics App | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 34 | Reading failureType Before Anything Else | Resolve pipeline and Dataflow errors | [01-pipeline-dataflow-errors.md](../../10-error-resolution/01-pipeline-dataflow-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 35 | A MERGE That Fails With No Data Corruption in Sight | Resolve notebook and T-SQL errors | [02-notebook-tsql-errors.md](../../10-error-resolution/02-notebook-tsql-errors.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 36 | An Eventstream That Can't Reach Its Event Hub, Tenant-Wide | Resolve real-time errors | [03-realtime-errors.md](../../10-error-resolution/03-realtime-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 37 | A Shortcut That Simply Refuses to Query in Delegated Mode | Resolve shortcut errors | [04-shortcut-errors.md](../../10-error-resolution/04-shortcut-errors.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 38 | Two Small-File Defenses, Applied at the Wrong Time | Optimize Lakehouse performance | [01-lakehouse-optimization.md](../../11-performance-optimization/01-lakehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 39 | A Query That Should Have Hit the Result Cache, and Didn't | Optimize Warehouse performance | [02-warehouse-optimization.md](../../11-performance-optimization/02-warehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 40 | Autotune Doesn't React to a One-Off Query | Optimize Spark performance | [03-spark-optimization.md](../../11-performance-optimization/03-spark-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 41 | Materialized View or Update Policy, By Cost Profile | Optimize real-time performance | [04-realtime-optimization.md](../../11-performance-optimization/04-realtime-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 42 | A Long-Running Copy Job That Intermittently Times Out | Optimize pipeline and query performance | [05-pipeline-query-optimization.md](../../11-performance-optimization/05-pipeline-query-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 43 | A "Successful" Pipeline Run That Hides a Stale Dashboard | Monitor Fabric items and activities | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 44 | Departing a Range vs. Going Silent Entirely | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 45 | Why a Refresh Schedule Quietly Stopped Running | Monitor semantic model refresh | [02-semantic-model-refresh.md](../../09-monitoring-alerting/02-semantic-model-refresh.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |

### Case Study: Nordscape Games (Qs 46–50)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 46 | A Deployment Rule for the MatchStats Warehouse | Configure deployment pipelines (D1) | [03-deployment-pipelines.md](../../02-lifecycle-management/03-deployment-pipelines.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 47 | The Leaderboard's Guardrail Failure | Optimize pipeline and query performance (D3) | [05-pipeline-query-optimization.md](../../11-performance-optimization/05-pipeline-query-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 48 | Who Actually Sees the Unmasked Email | Implement dynamic data masking (D1) | [04-dynamic-data-masking.md](../../03-security-governance/04-dynamic-data-masking.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 49 | The Reconnecting Player's Buffered Match Events | Implement Spark structured streaming (D2) | [03-spark-structured-streaming.md](../../08-streaming-data/03-spark-structured-streaming.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 50 | A Malformed Anti-Cheat Payload Under IsTransactional | Transform data with KQL (D2) | [04-kql-transformations.md](../../07-batch-transformation/04-kql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |

---

## Study plan by miss count

> [!tip] Triage rule
> Re-take the mock after focused study. Anything wrong **twice** becomes a flashcard for the morning of the exam.

### 0–5 misses: final-review only

You're at or above passing readiness — on the hardest of the three mocks. Skip full re-reads — instead:

1. Read `resources/final-review.md` cold, the way you would the morning of the real exam (once published — see the [overview](../../dp-700-overview.md) for its status)
2. Re-read only the specific topic-file sections named in the rows above for the questions you missed
3. If you missed the same question type twice across mocks, add it to a personal flashcard list
4. Schedule the real exam — you're ready

### 6–12 misses: targeted re-read map

Re-study is warranted, but only in the sections your misses actually cluster in — don't re-read all three domains cold.

1. Group your missed question numbers by domain using the tables above
2. For each domain with 3+ misses, re-read its linked topic files in question order (lower question numbers first — they roughly follow section order within the domain)
3. Re-read the matching cheat sheet's **Gotchas & Traps** section for each domain with misses
4. Re-attempt just the missed questions' topics via the [practice question bank](../practice-questions/practice-questions.md) before re-taking this mock
5. Re-take Mock 3 in full within a week

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
5. Re-take Mock 3 only after completing steps 1–4 — re-taking it cold won't diagnose anything new
6. If you haven't already cleared Mocks 1 and 2 (`resources/mock-exam/`, `resources/mock-exam-2/`), do those first — Mock 3 assumes both foundations and deliberately leans on documented traps and cross-domain scenarios the first two mocks don't emphasize as heavily

> [!warning] If you cleared Mocks 1–2 but score under 35 here
> A pass on Mocks 1–2 followed by a sub-35 score on Mock 3 usually means one specific thing: you know the facts, but you're not yet catching the documented **traps** — the "Common Mistake" callouts and each cheat sheet's **Gotchas & Traps** section — under scenario pressure. Don't restart full-domain study. Instead, re-read every "Common Mistake" callout across all 11 topic folders and every cheat sheet's Gotchas & Traps section in one sitting, then re-attempt just the **Hard**-tagged questions you missed on this mock (their explanations spell out exactly which trap you fell for). That's a much faster fix than a ground-up re-study, and it's precisely the skill Mock 3 is testing.

---

## Domain-level diagnosis grid

| If you missed... | Likely gap | Start here |
| :--- | :--- | :--- |
| 3+ in Domain 1, concentrated in Qs 1–4 | Workspace settings (Spark high concurrency, domain override settings, OneLake shortcut cache vs. BCDR, Airflow no-Git package install) | [01-fabric-workspace-settings/fabric-workspace-settings.md](../../01-fabric-workspace-settings/fabric-workspace-settings.md) |
| 3+ in Domain 1, concentrated in Qs 5–8 | Lifecycle management (Switch branch, database projects, deployment-rule item-type gaps, gateway permission as a third access axis) | [02-lifecycle-management/lifecycle-management.md](../../02-lifecycle-management/lifecycle-management.md), [lifecycle-cicd cheat sheet](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 3+ in Domain 1, concentrated in Qs 9–12 | Security & governance (RLS predicate types, DefaultReader virtual membership, DDM function set, endorsement authorization) | [03-security-governance/security-governance.md](../../03-security-governance/security-governance.md), [security-governance cheat sheet](../cheat-sheets/security-governance-quick-ref.md) |
| 3+ in Domain 1, concentrated in Qs 13–15 | Orchestration (tool composition, trigger Subject field + null-safe expressions, shared outcome-path semantics) | [04-orchestration/orchestration.md](../../04-orchestration/orchestration.md) |
| 3+ in Domain 2, concentrated in Qs 16–22 | Loading patterns and batch ingestion (watermark timing edge cases, SCD, data store fit, shortcut identity delegation, mirroring flavors, Copy activity modes) | [05-loading-patterns/loading-patterns.md](../../05-loading-patterns/loading-patterns.md), [06-batch-ingestion/batch-ingestion.md](../../06-batch-ingestion/batch-ingestion.md) |
| 3+ in Domain 2, concentrated in Qs 23–30 | Batch transformation and streaming data (tool choice, PySpark/T-SQL/KQL syntax gaps, streaming engine composition, MERGE-on-streaming, windowing) | [07-batch-transformation/batch-transformation.md](../../07-batch-transformation/batch-transformation.md), [language-syntax-map cheat sheet](../cheat-sheets/language-syntax-map.md) |
| 3+ in Domain 3, concentrated in Qs 31–37 | Monitoring, alerting, and error resolution (triage spine, Direct Lake fallback diagnosis, Activator unsupported sources, snapshot-isolation conflicts, delegated-mode shortcut blocking) | [09-monitoring-alerting/monitoring-alerting.md](../../09-monitoring-alerting/monitoring-alerting.md), [10-error-resolution/error-resolution.md](../../10-error-resolution/error-resolution.md), [monitoring-surfaces cheat sheet](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 3+ in Domain 3, concentrated in Qs 38–45 | Performance optimization across engines (small-file defenses, result-set caching disclosure, autotune preconditions, materialized view vs. update policy cost, staging timeout, reframing vs. run status) | [11-performance-optimization/performance-optimization.md](../../11-performance-optimization/performance-optimization.md), [optimization-levers cheat sheet](../cheat-sheets/optimization-levers-quick-ref.md) |
| 3+ in the case study (Qs 46–50) | Applying single-fact knowledge inside a multi-constraint, cross-domain scenario blending streaming, security, and optimization | Re-read the specific per-question rows above, then re-attempt the case study alone before the next full mock |

---

**[← Back to Mock Exam 3](./mock-exam-3.md)**
