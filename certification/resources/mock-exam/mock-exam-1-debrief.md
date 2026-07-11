---
title: Mock Exam 1 — Debrief
type: debrief
tags:
  - dp-700
  - mock-exam
  - debrief
  - study-plan
---

# Mock Exam 1 — Debrief

> [!abstract]
>
> - Use this **after** completing Mock Exam 1 and checking your answers
> - Every question maps to a blueprint skill + topic file + cheat sheet
> - The "Study plan by miss count" section turns your total miss count into a re-study plan
> - The domain-level diagnosis grid at the bottom turns per-domain misses into a targeted re-read order

> [!tip] How to use this debrief
>
> 1. List the question numbers you got wrong
> 2. For each, look up the row below — re-read the linked topic file section and the cheat sheet it points to
> 3. Count your total misses, then jump to the matching tier in **Study plan by miss count**
> 4. If 3 or more misses land in the same domain, also check that domain's row in the **diagnosis grid**
> 5. Re-take Mock 1 after a focused re-study pass. Anything wrong **twice** goes on a flashcard list before exam day

---

## Question-by-question map

### Domain 1 — Implement and manage (Qs 1–15)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 1 | High Concurrency Sharing Limit | Configure Spark workspace settings | [01-spark-settings.md](../../01-fabric-workspace-settings/01-spark-settings.md) | — |
| 2 | Domain Assignment and Item Access | Configure domain workspace settings | [02-domain-settings.md](../../01-fabric-workspace-settings/02-domain-settings.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 3 | OneLake File Explorer Pull Sync | Configure OneLake workspace settings | [03-onelake-settings.md](../../01-fabric-workspace-settings/03-onelake-settings.md) | — |
| 4 | Airflow Job on PPU with a VNet | Configure Apache Airflow workspace settings | [04-airflow-settings.md](../../01-fabric-workspace-settings/04-airflow-settings.md) | — |
| 5 | Commit and Update in One Action | Implement version control | [01-version-control.md](../../02-lifecycle-management/01-version-control.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 6 | Auto-Generating a SQL Database Project | Create and configure database projects | [02-database-projects.md](../../02-lifecycle-management/02-database-projects.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 7 | Data Movement During a Pipeline Deployment | Configure deployment pipelines | [03-deployment-pipelines.md](../../02-lifecycle-management/03-deployment-pipelines.md) | [lifecycle-cicd](../cheat-sheets/lifecycle-cicd-quick-ref.md) |
| 8 | Viewer Role and OneLake API Access | Implement workspace and item-level access controls | [01-workspace-item-access.md](../../03-security-governance/01-workspace-item-access.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 9 | SQL-Endpoint RLS and a Direct Spark Read | Implement RLS, CLS, and OLS | [02-granular-access-controls.md](../../03-security-governance/02-granular-access-controls.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 10 | OneLake Security Roles on a Warehouse | Implement OneLake security | [03-onelake-security.md](../../03-security-governance/03-onelake-security.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 11 | Who Sees Unmasked Values by Default | Implement dynamic data masking | [04-dynamic-data-masking.md](../../03-security-governance/04-dynamic-data-masking.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 12 | Sensitivity Label Inheritance | Implement governance (sensitivity labels, endorsement) | [05-governance.md](../../03-security-governance/05-governance.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 13 | Composing Three Tools for One Requirement | Choose an orchestration tool | [01-choosing-orchestration-tool.md](../../04-orchestration/01-choosing-orchestration-tool.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 14 | Notebook Execution Identity by Trigger Type | Configure schedules and triggers | [02-schedules-triggers.md](../../04-orchestration/02-schedules-triggers.md) | — |
| 15 | Wrapping exit() in try/except | Implement orchestration patterns | [03-orchestration-patterns.md](../../04-orchestration/03-orchestration-patterns.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |

### Domain 2 — Ingest and transform (Qs 16–30)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 16 | Duplicate Rows After a Retried Append | Implement full and incremental loads | [01-full-incremental-loads.md](../../05-loading-patterns/01-full-incremental-loads.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 17 | SCD Type 2 in T-SQL vs. Delta | Implement dimensional model loading | [02-dimensional-model-loading.md](../../05-loading-patterns/02-dimensional-model-loading.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 18 | Default Output Mode for a Streaming Write | Implement a streaming loading pattern | [03-streaming-loading-pattern.md](../../05-loading-patterns/03-streaming-loading-pattern.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 19 | A Star-Schema Load That Also Needs BI on the Same Tables | Choose a data store | [01-choosing-data-store.md](../../06-batch-ingestion/01-choosing-data-store.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 20 | Caching an ADLS Gen2 Shortcut | Implement OneLake shortcuts | [02-onelake-shortcuts.md](../../06-batch-ingestion/02-onelake-shortcuts.md) | — |
| 21 | Writing a Correction Into a Mirrored Table | Implement mirroring | [03-mirroring.md](../../06-batch-ingestion/03-mirroring.md) | — |
| 22 | Upsert Write Behavior on a File Sink | Implement pipeline ingestion | [04-pipeline-ingestion.md](../../06-batch-ingestion/04-pipeline-ingestion.md) | — |
| 23 | What partitionBy Actually Controls | Transform data with PySpark | [02-pyspark-transformations.md](../../07-batch-transformation/02-pyspark-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 24 | A Foreign Key That Doesn't Block an Insert | Transform data with T-SQL | [03-tsql-transformations.md](../../07-batch-transformation/03-tsql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 25 | Continuous Aggregation Without Orchestration | Transform data with KQL | [04-kql-transformations.md](../../07-batch-transformation/04-kql-transformations.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 26 | COALESCE vs. ISNULL for a Fallback | Implement data quality patterns | [05-data-quality-patterns.md](../../07-batch-transformation/05-data-quality-patterns.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 27 | Pre-Ingestion Operators on a KQL Destination | Implement Eventstreams | [02-eventstreams.md](../../08-streaming-data/02-eventstreams.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 28 | Output Mode for a Changed-Rows-Only Sink | Implement Spark structured streaming | [03-spark-structured-streaming.md](../../08-streaming-data/03-spark-structured-streaming.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 29 | Materialized View on an Accelerated Shortcut | Implement KQL real-time analytics | [04-kql-realtime.md](../../08-streaming-data/04-kql-realtime.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |
| 30 | What Happens to a Very Late Event | Implement windowing functions | [05-windowing-functions.md](../../08-streaming-data/05-windowing-functions.md) | [streaming-windowing](../cheat-sheets/streaming-windowing-quick-ref.md) |

### Domain 3 — Monitor and optimize (Qs 31–45)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 31 | Where a Pipeline's Notebook Activity Deep-Links To | Monitor Fabric items and activities | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 32 | Finding Dataflow Gen2 History Beyond 50 Rows | Monitor Fabric items and activities | [01-monitoring-surfaces.md](../../09-monitoring-alerting/01-monitoring-surfaces.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 33 | Direct Lake on OneLake Exceeding Guardrails | Monitor semantic model refresh | [02-semantic-model-refresh.md](../../09-monitoring-alerting/02-semantic-model-refresh.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 34 | Detecting a Threshold Crossing | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 35 | Alerting on a Scheduled KQL Query vs. a Live Eventstream | Configure Activator alerts | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 36 | A Staging Permission Error With No Gateway in Sight | Resolve pipeline and Dataflow errors | [01-pipeline-dataflow-errors.md](../../10-error-resolution/01-pipeline-dataflow-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 37 | Exit Code 143 During a Scale-Down | Resolve notebook and T-SQL errors | [02-notebook-tsql-errors.md](../../10-error-resolution/02-notebook-tsql-errors.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 38 | Data Is Arriving, Just Late | Resolve real-time errors | [03-realtime-errors.md](../../10-error-resolution/03-realtime-errors.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 39 | Delegated Mode Against an RLS-Protected Source | Resolve shortcut errors | [04-shortcut-errors.md](../../10-error-resolution/04-shortcut-errors.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 40 | Order of Operations in a Combined OPTIMIZE | Optimize Lakehouse performance | [01-lakehouse-optimization.md](../../11-performance-optimization/01-lakehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 41 | Clearing the Warehouse's In-Memory Cache | Optimize Warehouse performance | [02-warehouse-optimization.md](../../11-performance-optimization/02-warehouse-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 42 | Autotune With High Concurrency Enabled | Optimize Spark performance | [03-spark-optimization.md](../../11-performance-optimization/03-spark-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 43 | A Join That Gets Faster Mid-Query, With No Hint Written | Optimize Spark performance | [03-spark-optimization.md](../../11-performance-optimization/03-spark-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 44 | Raising Throughput on a Low-Partition Event Hub | Optimize real-time performance | [04-realtime-optimization.md](../../11-performance-optimization/04-realtime-optimization.md) | [optimization-levers](../cheat-sheets/optimization-levers-quick-ref.md) |
| 45 | Reframing After a Compaction Pass, Not a Data Change | Monitor semantic model refresh | [02-semantic-model-refresh.md](../../09-monitoring-alerting/02-semantic-model-refresh.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |

### Case Study: Fabrikam Freight (Qs 46–50)

| # | Topic | Blueprint skill | Re-read | Cheat sheet |
| :---: | :--- | :--- | :--- | :--- |
| 46 | Orchestrating the Nightly Finance Load | Choose an orchestration tool (D1) | [01-choosing-orchestration-tool.md](../../04-orchestration/01-choosing-orchestration-tool.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 47 | Row Filtering and Masking Behind a Contributor Role | Implement RLS, CLS, and OLS (D1) | [02-granular-access-controls.md](../../03-security-governance/02-granular-access-controls.md) | [security-governance](../cheat-sheets/security-governance-quick-ref.md) |
| 48 | Choosing a Streaming Engine for Dispatch | Choose a streaming engine (D2) | [01-choosing-streaming-engine.md](../../08-streaming-data/01-choosing-streaming-engine.md) | [decision-matrices](../cheat-sheets/decision-matrices-quick-ref.md) |
| 49 | Idempotent Loading for Partner CSV Drops | Implement full and incremental loads (D2) | [01-full-incremental-loads.md](../../05-loading-patterns/01-full-incremental-loads.md) | [language-syntax-map](../cheat-sheets/language-syntax-map.md) |
| 50 | Paging Before the Capacity Throttles | Configure Activator alerts (D3) | [03-activator-alerts.md](../../09-monitoring-alerting/03-activator-alerts.md) | [monitoring-surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md) |

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
5. Re-take Mock 1 in full within a week

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
5. Re-take Mock 1 only after completing steps 1–4 — re-taking it cold won't diagnose anything new
6. Once Mock 1 clears 35/50, move on to Mock Exam 2 (`resources/mock-exam-2/`, once published)

---

## Domain-level diagnosis grid

| If you missed... | Likely gap | Start here |
| :--- | :--- | :--- |
| 3+ in Domain 1, concentrated in Qs 1–7 | Workspace settings and lifecycle management (Spark/domain/OneLake/Airflow settings, Git integration, deployment pipelines) | [01-fabric-workspace-settings/fabric-workspace-settings.md](../../01-fabric-workspace-settings/fabric-workspace-settings.md), [02-lifecycle-management/lifecycle-management.md](../../02-lifecycle-management/lifecycle-management.md) |
| 3+ in Domain 1, concentrated in Qs 8–12 | Security & governance (RLS/CLS/OLS, OneLake security, DDM, sensitivity labels) | [03-security-governance/security-governance.md](../../03-security-governance/security-governance.md), [security-governance cheat sheet](../cheat-sheets/security-governance-quick-ref.md) |
| 3+ in Domain 1, concentrated in Qs 13–15 | Orchestration tool choice and patterns | [04-orchestration/orchestration.md](../../04-orchestration/orchestration.md), [decision-matrices cheat sheet](../cheat-sheets/decision-matrices-quick-ref.md) |
| 3+ in Domain 2, concentrated in Qs 16–22 | Loading patterns and batch ingestion (idempotency, SCD, data store choice, shortcuts, mirroring) | [05-loading-patterns/loading-patterns.md](../../05-loading-patterns/loading-patterns.md), [06-batch-ingestion/batch-ingestion.md](../../06-batch-ingestion/batch-ingestion.md) |
| 3+ in Domain 2, concentrated in Qs 23–30 | Batch transformation and streaming data (PySpark/T-SQL/KQL, Eventstreams, Structured Streaming, windowing) | [07-batch-transformation/batch-transformation.md](../../07-batch-transformation/batch-transformation.md), [language-syntax-map cheat sheet](../cheat-sheets/language-syntax-map.md) |
| 3+ in Domain 3, concentrated in Qs 31–39 | Monitoring, alerting, and error resolution | [09-monitoring-alerting/monitoring-alerting.md](../../09-monitoring-alerting/monitoring-alerting.md), [monitoring-surfaces cheat sheet](../cheat-sheets/monitoring-surfaces-quick-ref.md) |
| 3+ in Domain 3, concentrated in Qs 40–45 | Performance optimization across engines | [11-performance-optimization/performance-optimization.md](../../11-performance-optimization/performance-optimization.md), [optimization-levers cheat sheet](../cheat-sheets/optimization-levers-quick-ref.md) |
| 3+ in the case study (Qs 46–50) | Applying single-fact knowledge inside a multi-constraint scenario | Re-read the specific per-question rows above, then re-attempt the case study alone before the next full mock |

---

**[← Back to Mock Exam 1](./mock-exam-1.md)**
