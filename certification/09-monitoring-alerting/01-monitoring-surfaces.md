---
title: Monitoring Surfaces
type: topic
tags:
  - dp-700
  - fabric
  - monitoring-alerting
  - monitor-hub
  - spark-monitoring
  - eventstream
  - eventhouse
  - capacity-metrics
---

# Monitoring Surfaces

## Overview

Microsoft Fabric spreads monitoring across a central **Monitor hub** plus several item-specific surfaces — pipeline run history, Dataflow Gen2 refresh history, Spark application details, Eventstream data insights, Eventhouse ingestion logs, Copy job runs, and the capacity-admin-only **Fabric Capacity Metrics** app. This topic maps every surface the exam names to what it shows, who it's for, and — critically — which one to open first for a given symptom.

> [!abstract]
>
> - The **Monitor hub** (opened via **Monitor** in the navigation pane) is the tenant-wide activity view — it covers 17+ item types, filters by status/item type/start time/owner/workspace, and retains up to 30 days of history per activity
> - **Pipeline** monitoring adds Gantt view, per-activity input/output JSON, and **rerun from the failed activity** — not just full reruns
> - **Dataflow Gen2** refresh history stores up to 250 runs (or 6 months) with downloadable detailed logs (28-day retention)
> - **Spark** monitoring layers Monitor hub → item Recent runs → application detail page (Jobs/Resources/Logs/Data/Item snapshots/Diagnostics tabs) → monitoring **APIs** for programmatic access
> - **Eventstream**, **Eventhouse**, and **Copy job** each have their own monitoring surface — data insights/runtime logs, workspace-monitoring KQL tables, and Monitor hub entries, respectively
> - The **Capacity Metrics app** is the only surface built for capacity **admins**, showing CU utilization and throttling across every workspace on a capacity — but it can't itself fire alerts

> [!tip] What the Exam Tests
>
> - Matching a described symptom ("a scheduled job silently stopped running," "a report is slow," "capacity is throttling") to the correct monitoring surface to open first
> - Knowing which item types Monitor hub covers natively vs. which need workspace monitoring (a dedicated monitoring Eventhouse) for log-level detail
> - Recognizing **rerun from failed activity** as a pipeline-specific recovery action distinct from a full pipeline rerun
> - Knowing the Capacity Metrics app is CU/throttling-focused and admin-installed, and that it does **not** support alerts — that's Activator's job (see [03-Activator & Alerts](./03-activator-alerts.md))

---

## The Monitor Hub: Fabric's Central Activity View

Selecting **Monitor** in the Fabric navigation pane opens the **monitoring hub**, a single place to track job execution health across every workspace you can access. Any Fabric user can open it, but you only see activities for items you have permission to view.

The hub has two pages: **Activities** (the main view) and **Schedule failures** *(preview)* — a centralized place to configure failure-notification recipients for scheduled items instead of setting them up one item at a time.

| Feature | What it gives you |
| :--- | :--- |
| Current run status | Track active and recently completed jobs from one place |
| Historical runs | Up to **100 activities from the past 30 days** in the main view; select **More options → Historical runs** on any activity to see its full 30-day history |
| Activity details and diagnostics | Status, timing, and error details via the details pane (point to the activity, select **View details**) |
| Filtering and search | Filter by **Status**, **Item type**, **Start time**, **Submitted by**, **Location** (workspace); keyword search scoped to already-loaded rows |
| Schedule failure notifications | Centralized recipient management for scheduled-item failure emails (preview) |

==Monitor hub's Activities page covers 17 item types==: Copy Job, Dataflow Gen2, Dataflow Gen2 CI/CD, Datamart, Data Build Tool (dbt) Job, Digital Twin Builder Flow, Experiment, Graph model, Lakehouse, Map, Notebook, Pipeline, Semantic model, Snowflake database, Spark job definition, and User data function. **Dataflow Gen1 is not supported** and never appears in the table.

> [!warning] Common Mistake
> Assuming Monitor hub is a bottomless log. It's not — the main **Activities** table caps at 100 rows across the last 30 days, and even the per-item **Historical runs** drill-down only goes back 30 days. For anything older, or for raw log-level detail beyond status/timing/error summary, you need item-specific history (Dataflow Gen2 refresh history, Spark application logs) or workspace monitoring's KQL-queryable Eventhouse — Monitor hub itself isn't a durable audit log.

## Pipeline Run and Activity Monitoring

Beyond the generic Monitor hub view, a pipeline's own **View run history** flyout and the **Go to monitor** detail page add pipeline-specific tooling:

- **Gantt view** — each run renders as a bar grouped by pipeline name; bar length shows duration, useful for spotting overlaps, delays, and anomalies across many runs at a glance
- **Activity runs table** — filter by activity status, add/remove columns, search by activity name/type/run ID; **Load more** past the first 2,000 activity runs
- **Input/Output JSON** — select the **Input** or **Output** link next to an activity run to inspect the exact JSON payload the activity received or produced
- **Performance details pane** — select an activity to see **Duration breakdown** and **Advanced** stats (rows/bytes read and written, for Copy-type activities)
- **Export to CSV** — export the currently filtered monitoring table
- **Rerun** — choose **rerun the entire pipeline** or **rerun only from the failed activity**, skipping activities that already succeeded

> [!note] Mental model — rerun from failed activity
> A full pipeline rerun is **starting the whole assembly line over**; **rerun from failed activity** is **resuming the line at the station that jammed** — everything upstream that already finished stays finished, and only the broken station (and everything downstream of it) runs again.

For log-level detail beyond the run history UI, **workspace monitoring** (Workspace settings → Monitoring → add a monitoring Eventhouse → toggle **Log workspace activity**) writes pipeline-level events into an **ItemJobEventLogs** table inside an auto-created KQL database — queryable with KQL for success/failure trend analysis, performance metrics, and error-detail mining across every pipeline in the workspace at once.

**Practice Question 1** *(Easy)*

A pipeline failed on its fifth activity out of eight; the first four activities succeeded and wrote their outputs. The team wants to fix the underlying issue and get the pipeline finished without re-running the four already-successful activities. What's the fastest supported recovery action from the pipeline's monitoring view?

A. Select **Rerun**, and choose to rerun only from the failed activity  
B. Delete the pipeline run record and manually re-trigger the pipeline from the workspace  
C. Export the run to CSV, fix the data manually, and mark the run as succeeded  
D. Open Monitor hub's Historical runs and edit the failed activity's status directly  

> [!success]- Answer
> **A. Select Rerun, and choose to rerun only from the failed activity**
>
> Fabric pipeline monitoring supports rerunning from the point of failure directly — the four succeeded activities aren't re-executed, and the pipeline resumes at activity five. There's no supported way to hand-edit a run's recorded status (C, D), and a full manual re-trigger (B) would waste the already-successful work.

## Dataflow Gen2 Refresh History and Diagnostics

Dataflow Gen2 has two monitoring entry points: **Recent runs** (per-dataflow, from the workspace item's context menu) and the shared **Monitoring hub** dashboard.

**Refresh history** (Recent runs) shows, at the list level: start time, status, duration, and refresh type. Fabric keeps **up to 50 refresh histories or 6 months of history (whichever limit hits first)** visible in the UI, and stores up to **250 refresh histories or 6 months** in OneLake underneath. Drilling into a single run (select its **Start time**) surfaces:

- General run info — status, refresh type, start/end time, duration, Request ID, Session ID, Dataflow ID
- **Tables** section — every entity with loading enabled, each drillable to its own detail screen
- **Activities** section — every action taken during the refresh (e.g., loading to an output destination), each drillable to activity statistics: endpoints contacted, bytes/rows read and written

For deeper troubleshooting, select **Download detailed logs** on a run's details screen — a zipped file of mashup-engine logs, available a few minutes after the refresh completes and for **up to 28 days** afterward (requires at least workspace Viewer permission; gateway-based refreshes need **Admin consent for gateway diagnostics** enabled at both tenant and gateway level first). A lighter-weight **CSV export** of one or more selected runs is also available directly from the run list.

At the workspace level, the **Status** column on the workspace list view shows the last refresh's outcome plus the last save/validate result, with a red exclamation icon (hover for details) on failure of either.

The shared **Monitoring hub** dashboard (distinct from the per-dataflow Recent runs list) rolls up: dataflow status, refresh start time, refresh duration, submitter, workspace name, capacity used, average refresh duration, refreshes per day, and refresh type — useful for spotting a dataflow whose refresh duration is trending up before it becomes a hard failure.

> [!warning] Common Mistake
> Confusing a Dataflow Gen2 **save/validate failure** with a **refresh failure**. The workspace Status column's red icon can mean either — a failed validation (something's wrong in the Power Query logic itself, fixed by reopening the dataflow editor) is a different failure mode from a failed refresh (typically a data-source or capacity issue, diagnosed via refresh history). Hovering the icon tells you which one occurred; don't assume "refresh history" is the fix for every red icon.

## Spark Application Monitoring

Spark monitoring in Fabric layers multiple entry points on top of one shared application-detail experience:

| Entry point | What it's for |
| :--- | :--- |
| **Monitor hub** | Centralized portal for Spark activity across every item in a workspace — in-progress applications from Notebooks, Spark Job Definitions, and Pipelines, searchable/filterable |
| **Item Recent Runs** | Per-item (Notebook or Spark Job Definition) view of current and recent activities: submitter, status, duration |
| **Notebook contextual monitoring** | Author, monitor, and debug Spark jobs in one place — job progress, tasks/executors, and Spark logs at the notebook-cell level, plus the built-in **Spark Advisor** for real-time code/execution advice |
| **Spark job definition inline monitoring** | Real-time submission/run status plus past runs and configurations, right on the SJD item |
| **Pipeline Spark activity inline monitoring** | Deep links from a Pipeline's Notebook/SJD activity straight to Spark execution details, snapshot, and logs — including inline error messages on failure |

Opening a specific application (from Monitor hub or an item's Recent Runs) lands on the **Spark application detail page**, with these tabs:

- **Jobs** — every job run for the application: Job ID, description, status, stages, tasks, duration, data processed/read/written, and a code snippet per job; job description links straight into the underlying **Spark UI**
- **Resources** — near-real-time executor allocation/utilization graph
- **Logs** — full logs for **Livy**, **Prelaunch**, and **Driver** processes, filterable by keyword/status/notebook, downloadable (logs may be unavailable if the job is still queued or cluster creation failed)
- **Data** — input/output file details: name, format, size, source, path; copy/download/view-properties actions
- **Item snapshots** — the exact notebook code and parameters (or SJD settings) as they were at execution time, plus the triggering pipeline/activity if applicable
- **Diagnostics panel** — real-time recommendations and error analysis from **Spark Advisor**, built on pattern-matching against common failure causes

For programmatic access, Fabric exposes **Spark monitoring APIs** at two levels:

- **Workspace/item-level list APIs** — list Spark applications in a workspace, for a notebook, for a Spark Job Definition, or for a lakehouse
- **Single-application deep-dive APIs** — get a specific notebook run or SJD submission's details; **Spark open-source metrics APIs** (aligned with the Spark History Server API); **Livy Log**, **Driver Log**, and **Executor Log** endpoints; **resource usage APIs**

> [!note] Mental model
> Monitor hub and Recent Runs are the **flight board** — status and timing at a glance. The application detail page's Logs/Diagnostics tabs are the **black box recorder** — what actually happened inside a specific flight. The monitoring APIs are the **maintenance crew's terminal** — the same data, but scriptable for automated dashboards or alerting pipelines that don't live inside the Fabric portal.

**Practice Question 2** *(Medium)*

A notebook run failed inside a Spark job. The team needs the exact driver-process log output to diagnose the failure, and wants to build an automated nightly report that pulls this information without opening the Fabric portal. Which two capabilities together satisfy both needs?

A. The Monitor hub's Activities table for the log output, and CSV export for automation  
B. Dataflow Gen2's detailed logs download for diagnosis, and the Capacity Metrics app for automation  
C. The Spark application detail page's **Logs** tab (Driver logs) for diagnosis, and the **Driver Log** monitoring API for automation  
D. The notebook's Item snapshot for the log output, and Real-Time hub for automation  

> [!success]- Answer
> **C. The Spark application detail page's Logs tab (Driver logs) for diagnosis, and the Driver Log monitoring API for automation**
>
> The Logs tab surfaces full Livy/Prelaunch/Driver logs interactively for a human diagnosing a failure; the Driver Log API returns the same underlying data programmatically, making it the right building block for an unattended nightly job. Monitor hub's Activities table shows status/timing, not log content. Dataflow Gen2's detailed logs (B) are unrelated to Spark. Item snapshots capture code/config, not runtime log output.

## Eventstream Monitoring

An eventstream exposes two monitoring views inside its own editor:

- **Data insights** — metrics on the status and performance of the eventstream, its sources, and its destinations; selecting a node on the canvas scopes the panel to that node's metrics
- **Runtime logs** — detailed logs from the eventstream engine itself, at three severity levels: **warning**, **error**, **information**

Availability of each view depends on which source/destination is selected — an Azure Event Hubs source or a Lakehouse destination, specifically, must be present to unlock these panels for that node. See [08-Streaming Data: Eventstreams](../08-streaming-data/02-eventstreams.md) for the full source/destination catalog these metrics apply to.

## Eventhouse Ingestion Monitoring

Eventhouse monitoring rides on the same **workspace monitoring** mechanism as pipelines and Copy jobs: from the Eventhouse explorer pane (or Workspace settings → Monitoring), add a monitoring Eventhouse, which auto-provisions a KQL database that captures workspace activity logs. That monitoring KQL database exposes five queryable table families:

| Table family | Covers |
| :--- | :--- |
| **Metrics** | Numeric performance counters for the eventhouse |
| **Command logs** | Management commands executed against the eventhouse |
| **Data operation logs** | Data-management operations (e.g., merges, extents) |
| **Ingestion results logs** | Per-ingestion outcome — success/failure detail for both queued and streaming ingestion |
| **Query logs** | Queries executed against the eventhouse's KQL databases |

Prebuilt **Real-Time Dashboard** and **Power BI report** monitoring templates (from the `fabric-toolbox` GitHub repo) visualize these tables without hand-writing KQL. See [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md) for the underlying streaming-vs-queued ingestion mechanics these logs describe.

## Copy Job Monitoring

**Copy Job** is one of the 17 item types natively tracked in **Monitor hub** — status, duration, and submitter show up alongside every other job type without extra setup. For row-level and per-mapping detail, enabling **workspace monitoring** produces a dedicated **CopyJobActivityRunDetailsLogs** table in the monitoring Eventhouse — one record per source-to-destination table/object mapping in a Copy job run, queryable with KQL alongside pipeline and eventhouse logs from the same workspace.

## Capacity Metrics App: The Admin-Side View

Unlike every surface above, the **Microsoft Fabric Capacity Metrics** app is scoped to **capacity administrators**, not item owners — it answers "how is my whole capacity doing," not "did my job succeed."

| Page | Shows |
| :--- | :--- |
| **Health** | High-level overview across every capacity you administer; flags the ones consuming the most compute or hitting throttling/query rejections |
| **Compute** | 14-day compute-performance view — ribbon charts, utilization trends, a matrix of operations by item |
| **Storage** | 30-day storage usage by workspace, including soft-deleted data |
| **Timepoint** | Drill into a specific 30-second window to see which operations consumed the most compute |
| **Timepoint summary** | Same window, summarized by operation type rather than individual operation |
| **Timepoint item detail** | Granular per-operation detail within an item at a timepoint — filterable by operation ID, user, CU threshold |
| **Autoscale compute for Spark** / **detail** | Autoscaling behavior for Spark workloads specifically |

Installing the app requires **capacity admin** rights; after install, an admin can **share** the report with other users or B2B guests without granting them admin rights. Data has processing latency — usage typically appears within **10–15 minutes**, while dimensions like capacities/workspaces/items refresh once at midnight (local time) via the app's own scheduled semantic model refresh, so a brand-new capacity or workspace won't show up until the next refresh (or a manual one).

==The Capacity Metrics app does not support alerts or notifications on its own.== For real-time alerting on capacity conditions, the exam expects you to reach for **Activator** against **Fabric capacity overview events** in Real-Time hub instead — see [03-Activator & Alerts](./03-activator-alerts.md).

> [!warning] Common Mistake
> Treating the Capacity Metrics app as a per-job failure/success dashboard. It's a **capacity resource-consumption** tool — CU%, throttling, memory, storage — not a job-status tool. A scenario about "why did my pipeline fail" points to Monitor hub or pipeline run history; a scenario about "why is everything on this capacity slow" or "are we about to get throttled" points to the Capacity Metrics app.

**Practice Question 3** *(Medium)*

A capacity administrator notices multiple items across several workspaces on the same F64 capacity are experiencing intermittent slow performance during business hours, but no individual pipeline or notebook is reporting failures. Which surface should the administrator open first to investigate, and why?

A. Monitor hub, because it lists every item type's run status in one place  
B. Dataflow Gen2 refresh history, because dataflows are the most common cause of capacity throttling  
C. Eventhouse ingestion monitoring, because ingestion logs capture all capacity events  
D. The Capacity Metrics app's Compute or Timepoint page, because the symptom is capacity-wide resource contention, not a single item's failure  

> [!success]- Answer
> **D. The Capacity Metrics app's Compute or Timepoint page, because the symptom is capacity-wide resource contention, not a single item's failure**
>
> Slowness across multiple items with no individual failures is a classic capacity-throttling signature — the Compute page's utilization trends or the Timepoint page's 30-second breakdown identify which operations are consuming the capacity during the affected windows. Monitor hub is item-status-centric and won't surface capacity-wide CU consumption. Eventhouse ingestion logs are scoped to one eventhouse's ingestion, not capacity-wide compute. Dataflow Gen2 (B) is only one of many possible consumers.

## THE Monitoring-Surfaces Table

| Surface | What to monitor | Historical depth | Access path |
| :--- | :--- | :--- | :--- |
| **Monitor hub** | Cross-item status/timing/error summary (17 item types) | 100 rows / 30 days (main); 30 days (per-item historical) | **Monitor** in nav pane |
| **Pipeline run/activity monitoring** | Run + activity-level detail, Gantt, input/output JSON, rerun-from-failure | 2,000+ activity runs (Load more) | Pipeline **···** → View run history → Go to monitor |
| **Dataflow Gen2 refresh history** | Refresh status, per-table/per-activity detail, downloadable logs | 50 runs UI / 250 runs or 6 months in OneLake; logs 28 days | Dataflow **···** → Recent runs |
| **Spark application detail** | Jobs, executor resources, Livy/Driver/Prelaunch logs, input/output data, code snapshots | Per-application, while retained | Monitor hub → Spark application, or item Recent Runs |
| **Spark monitoring APIs** | Same data as above, programmatically | Same as UI | REST API (workspace/item list + single-application) |
| **Eventstream Data insights / Runtime logs** | Source/destination throughput, engine warnings/errors/info | Live/session-scoped | Eventstream editor, lower pane |
| **Eventhouse ingestion monitoring** | Metrics, command logs, data ops, ingestion results, query logs | Per workspace-monitoring retention | Workspace settings → Monitoring → Eventhouse |
| **Copy job monitoring** | Job status (Monitor hub) + per-mapping detail (workspace monitoring) | 30 days (Monitor hub) / workspace-monitoring retention | Monitor hub, or CopyJobActivityRunDetailsLogs table |
| **Capacity Metrics app** | CU utilization, throttling, storage, autoscale, by capacity | 14 days (Compute); 30 days (Storage) | Installed app (capacity admin only) |

## Decision Guidance: Symptom → Which Surface to Open First

| Symptom | Open first |
| :--- | :--- |
| "Did my pipeline/notebook/dataflow run succeed, and when?" | Monitor hub |
| "My pipeline failed partway through — how do I fix and resume without redoing everything?" | Pipeline run history → **Rerun from failed activity** |
| "My dataflow refresh failed — what exactly went wrong in which table?" | Dataflow Gen2 refresh history → detailed logs |
| "My Spark job is slow or failing — what's the driver actually logging?" | Spark application detail page → **Logs** tab |
| "I need Spark run data in an automated dashboard, not the portal" | Spark monitoring APIs |
| "Is my eventstream actually receiving/forwarding events?" | Eventstream **Data insights** |
| "Why did an event get dropped or transformed unexpectedly?" | Eventstream **Runtime logs** |
| "Is data landing in my Eventhouse tables?" | Eventhouse ingestion monitoring (Ingestion results logs) |
| "Which rows failed in my Copy job's table mapping?" | Workspace monitoring → CopyJobActivityRunDetailsLogs |
| "Everything on this capacity feels slow, or we're getting throttled" | Capacity Metrics app |
| "I need to be paged the moment any of the above happens" | Activator (see [03-Activator & Alerts](./03-activator-alerts.md)) |

## Use Cases

- Diagnosing a partial pipeline failure and resuming from the failed activity instead of a full rerun
- Investigating a slow Spark job by comparing the Resources tab's executor graph against the Logs tab's driver output
- Building a KQL-based cross-item failure dashboard from workspace monitoring's ItemJobEventLogs, CopyJobActivityRunDetailsLogs, and Eventhouse ingestion tables in one query
- Identifying capacity-wide throttling as the root cause of scattered, non-failing-but-slow symptoms across unrelated items
- Downloading Dataflow Gen2 detailed logs to hand to Microsoft support within the 28-day retention window

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Monitor hub shows no history for a job older than 30 days | Monitor hub's retention (main view and Historical runs) is capped at 30 days | Use item-specific history (Dataflow refresh history up to 6 months) or a workspace-monitoring KQL query for longer retention |
| Dataflow Gen2 "Download detailed logs" button is missing or fails for a gateway-based refresh | Admin consent for gateway diagnostics isn't enabled at the tenant and/or gateway level | Enable **Admin consent for gateway diagnostics** at both levels, then retry after the next refresh |
| Spark application Logs tab shows no content | The job is still queued, or cluster creation failed before logs could be generated | Wait for the job to start executing, or investigate the cluster-creation failure separately (Diagnostics panel / Spark Advisor) |
| A newly created workspace or item doesn't appear in the Capacity Metrics app | Dimensions (capacities/workspaces/items) refresh once daily via the app's own scheduled semantic model refresh | Wait for the next scheduled refresh, or trigger a manual refresh of the app's semantic model |
| Eventstream Data insights / Runtime logs panel is empty or unavailable for a node | The selected source/destination type doesn't support these panels (only Event Hubs sources / Lakehouse destinations expose them) | Select a supported node, or rely on the destination's own monitoring surface (e.g., Eventhouse ingestion monitoring) instead |
| Team can't find why a specific row failed to copy in a Copy job | Monitor hub only shows job-level status, not row/mapping-level detail | Enable workspace monitoring and query the CopyJobActivityRunDetailsLogs table |

## Best Practices

- Enable workspace monitoring early in a workspace's life — the KQL-queryable logs it produces (pipelines, Copy jobs, Eventhouse) are the only cross-item way past Monitor hub's 30-day cap
- Use pipeline **rerun from failed activity** by default for partial failures — a full rerun wastes compute and can duplicate already-written output on non-idempotent sinks
- Check the Spark application's **Diagnostics** panel (Spark Advisor) before manually digging through raw logs — it flags common failure patterns automatically
- Install and share the Capacity Metrics app proactively, before a throttling incident forces a scramble to get admin access
- Pair a monitoring surface with an Activator rule for anything that needs a page/Teams alert rather than a human checking a dashboard — see [03-Activator & Alerts](./03-activator-alerts.md)

## Exam Tips

> [!tip] Exam Tips
>
> - Monitor hub covers 17 item types but **not** Dataflow Gen1 — memorize this exclusion, it's a common distractor
> - "Rerun from failed activity" is pipeline-specific vocabulary — don't confuse it with a generic retry
> - Dataflow Gen2 detailed logs: **28-day** download window; refresh history: **50 UI rows / 250 or 6 months in OneLake**
> - Spark monitoring API names to recognize: **Livy Log**, **Driver Log**, **Executor Log**, plus the Spark open-source metrics APIs
> - Eventstream's two monitoring tabs are **Data insights** and **Runtime logs** (three severities: warning/error/information)
> - Eventhouse's five monitoring table families: **Metrics, Command logs, Data operation logs, Ingestion results logs, Query logs**
> - Capacity Metrics app is **admin-installed**, CU/throttling-focused, and explicitly **does not support alerts**

## Key Takeaways

- Monitor hub is the tenant-wide first stop for status across 17 item types, but its 30-day/100-row cap means it's not a durable log — workspace monitoring's KQL Eventhouse fills that gap
- Pipeline monitoring's standout capability is resuming from a failed activity instead of a full rerun
- Spark monitoring is layered: Monitor hub/Recent Runs for status → application detail tabs for deep diagnosis → REST APIs for programmatic access
- Eventstream, Eventhouse, and Copy job each have a purpose-built monitoring view, and workspace monitoring ties several of them into one KQL-queryable Eventhouse
- The Capacity Metrics app is the only admin-scoped, capacity-wide surface — CU utilization and throttling, not job success/failure, and it can't alert on its own

## Related Topics

- [02-Semantic Model Refresh](./02-semantic-model-refresh.md)
- [03-Activator & Alerts](./03-activator-alerts.md)
- [08-Streaming Data: Eventstreams](../08-streaming-data/02-eventstreams.md)
- [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Official Documentation

- [Monitoring hub: View and track Fabric activity](https://learn.microsoft.com/en-us/fabric/admin/monitoring-hub)
- [Monitor pipeline runs](https://learn.microsoft.com/en-us/fabric/data-factory/monitor-pipeline-runs)
- [An overview of refresh history and monitoring for dataflows](https://learn.microsoft.com/en-us/fabric/data-factory/dataflows-gen2-monitor)
- [Apache Spark monitoring overview](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-monitoring-overview)
- [Apache Spark application detail monitoring](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-detail-monitoring)
- [Spark monitoring APIs to get Spark application details](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-monitoring-api-overview)
- [Monitor the status and performance of an eventstream](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/monitor)
- [Eventhouse monitoring overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/monitor-eventhouse)
- [Workspace monitoring for Copy job](https://learn.microsoft.com/en-us/fabric/data-factory/copy-job-workspace-monitoring)
- [What is the Microsoft Fabric Capacity Metrics app?](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../08-streaming-data/05-windowing-functions.md) | [↑ Back to Section](./monitoring-alerting.md) | [Next →](./02-semantic-model-refresh.md)**
