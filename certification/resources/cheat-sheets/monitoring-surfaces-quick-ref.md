---
title: "Monitoring & Surfaces — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - monitoring
  - activator
  - semantic-model-refresh
  - capacity-metrics
---

# Monitoring & Surfaces — Quick Reference

The symptom→surface table (Domain 3 Triage Spine), semantic model refresh/framing facts, Activator sources/actions/limits, and Capacity Metrics app facts. Condensed from [09-monitoring-alerting](../../09-monitoring-alerting/monitoring-alerting.md).

> [!abstract] Quick Reference
>
> - Domain 3 Triage Spine: which surface to open first, per symptom
> - Monitor hub coverage, retention, and its known gaps
> - Semantic model refresh: Import vs. Direct Lake framing, DirectQuery fallback
> - Activator: events/objects/conditions/rules, sources, actions, rate limits
> - Capacity Metrics app: admin-only, CU/throttling, no alerts

---

## Domain 3 Triage Spine (keep whole)

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
| "I need to be paged the moment any of the above happens" | Activator |

## THE Monitoring-Surfaces Table (keep whole)

| Surface | What to monitor | Historical depth | Access path |
| :--- | :--- | :--- | :--- |
| Monitor hub | Cross-item status/timing/error (17 item types) | 100 rows / 30 days (main); 30 days (per-item) | **Monitor** in nav pane |
| Pipeline run/activity monitoring | Run + activity detail, Gantt, I/O JSON, rerun-from-failure | 2,000+ activity runs | Pipeline → View run history → Go to monitor |
| Dataflow Gen2 refresh history | Refresh status, per-table/activity detail, downloadable logs | 50 runs UI / 250 or 6mo in OneLake; logs 28 days | Dataflow → Recent runs |
| Spark application detail | Jobs, executor resources, Livy/Driver/Prelaunch logs, data, snapshots | Per-application | Monitor hub → app, or Recent Runs |
| Spark monitoring APIs | Same data, programmatic | Same as UI | REST API |
| Eventstream Data insights / Runtime logs | Source/dest throughput; engine warn/error/info | Live/session | Eventstream editor |
| Eventhouse ingestion monitoring | Metrics, command logs, data ops, ingestion results, query logs | Workspace-monitoring retention | Workspace settings → Monitoring |
| Copy job monitoring | Status (Monitor hub) + per-mapping detail (workspace monitoring) | 30 days / workspace-monitoring | Monitor hub, or CopyJobActivityRunDetailsLogs |
| Capacity Metrics app | CU utilization, throttling, storage, autoscale | 14 days (Compute); 30 days (Storage) | Installed app (capacity admin only) |

> [!warning] Common Mistake — ==Monitor hub covers 17 item types but NOT Dataflow Gen1== — a frequent distractor. It's also not a durable log: 100-row/30-day cap on the main view. For longer retention or log-level detail, use item-specific history or workspace monitoring's KQL Eventhouse.

**Pipeline rerun-from-failed-activity** resumes only the failed activity and everything downstream of it — already-succeeded activities are not re-executed.

---

## Semantic Model Refresh

| Aspect | Import refresh | Direct Lake refresh (==framing==) |
| :--- | :--- | :--- |
| What moves | Entire data volume into VertiPaq cache | Metadata only — Parquet file references |
| Duration | Minutes–hours | ==Seconds== |
| Engine | VertiPaq | VertiPaq (on-demand "transcoding") |

- Between framings, Direct Lake queries see a **fixed point-in-time snapshot** — new Parquet files after the last framing stay invisible until the next reframe. Reframing triggers: automatic updates (default on), manual, scheduled, or programmatic.
- ==Direct Lake on OneLake never falls back to DirectQuery==; Direct Lake on **SQL endpoints** can, governed by `DirectLakeBehavior` (`Automatic` default = silent fallback / `DirectLakeOnly` = hard error / `DirectQueryOnly`). Diagnose with `EVALUATE TABLETRAITS()` → `DirectLakeFallbackInfo` column.
- Fallback causes: SQL-side RLS/DDM/OLS, unmaterialized SQL view, Delta guardrail overrun, model not framed since table change.
- Refresh failure causes: **credentials** (auto-deactivates schedule after ==4 consecutive failures==), **timeout** (default 5h/attempt, 24h total incl. retries), **memory/capacity limits**.
- Scheduled refresh caps: Pro = 8/day; PPU and Premium/Fabric capacity = ==48/day==.
- Enhanced refresh API: `POST /refreshes` (start), `GET /refreshes/{id}` (poll), `DELETE /refreshes/{id}` (cancel — **enhanced-triggered only**, not portal-button refreshes). Supports table/partition scoping (`objects`) and batched commits.
- `sempy.fabric.semantic_model` = notebook-native refresh orchestration + `RefreshExecutionDetails` polling.

---

## Activator

### Core Concepts

| Concept | Meaning |
| :--- | :--- |
| Event | Single observation (timestamp + payload + identifying attribute) |
| Object | Events grouped by shared identifier — per-instance evaluation |
| Rule | Condition + action, evaluated continuously |
| Condition | ==Stateless== (`value < threshold`, fires every event) or ==stateful== (`BECOMES`/`DECREASES`/`INCREASES`/`EXIT RANGE`/heartbeat — fires only on state **transition**, not every event) |

### Alert Sources

Eventstreams · KQL querysets/Real-Time dashboards (default check every 5 min) · Power BI report visuals (specific supported types only) · Real-Time hub events (Fabric job/workspace item/OneLake/capacity overview events) · Warehouse SQL query results (preview) · Business events/Ontology entities (preview)

> [!warning] ==Unsupported alert sources== (common distractor): **Capacity Metrics app** and **SQL analytics endpoint** directly. Route capacity alerting through Fabric capacity overview events in Real-Time hub instead; warehouse alerting through the SQL query preview mechanism.

### Actions

Email (internal recipients only) · Teams (shared channels only, not private) · Power Automate · Run a Fabric item (pipeline/notebook/SJD/dataflow/UDF/copy job preview) · Publish a business event (preview). A rule fires and moves on immediately — doesn't block on action completion; one rule can trigger multiple actions.

### Pipeline-Failure Alerting — Two Patterns

| Pattern | Scope | Setup |
| :--- | :--- | :--- |
| Job events per pipeline | One pipeline | Real-Time hub → Job events → pick pipeline + event |
| ==Workspace-wide KQL queryset== | Every pipeline, incl. future ones | Enable workspace monitoring → Activator rule on `ItemJobEventLogs` |

### Rate Limits (know these exist, exact numbers testable)

| Limit | Value |
| :--- | :--- |
| Max incoming events/sec/rule | 10,000 |
| Email messages/Activator item/hour | ==500== |
| Email messages/rule/recipient/hour | 30 |
| Teams messages/Activator item/hour | 500 |
| Fabric item activations/user/minute | 50 |

> [!note] "Alerts stopped during a huge spike" → rate-limit throttling, not a system crash.

---

## Capacity Metrics App

- Scoped to **capacity admins** only — answers "how is my whole capacity doing," not "did my job succeed."
- Pages: Health, Compute (14-day), Storage (30-day), Timepoint, Timepoint summary, Timepoint item detail, Autoscale compute for Spark.
- Data latency: usage ~10–15 min; dimensions (capacities/workspaces/items) refresh once daily at midnight local time.
- ==Does NOT support alerts== — for capacity-condition alerting, use Activator against **Fabric capacity overview events** in Real-Time hub.

---

## Gotchas & Traps

- Monitor hub excludes Dataflow Gen1 and caps at 100 rows / 30 days — not a durable audit log.
- "Successful" notebook/pipeline run status says nothing about whether a downstream Direct Lake model has reframed — check the semantic model's refresh history Direct Lake tab separately.
- A Direct Lake model with no visible refresh schedule can still show stale data if automatic updates are disabled/delayed — framing is the freshness mechanism, not a background live connection.
- `DELETE /refreshes/{requestId}` only cancels enhanced-API-triggered refreshes, not portal-button or scheduled ones.
- Capacity Metrics app cannot fire alerts under any circumstance — a scenario proposing "alert from Capacity Metrics" is describing an unsupported configuration.
- Stateless Activator rules fire on every qualifying event (noisy); stateful rules fire only on transition — pick stateful whenever a scenario says "alert only once" or "don't spam."
- A refresh failing after running for hours with a resource-governance error is a capacity-sizing issue, not automatically a data-source problem.

## Before the Exam, I Can…

- [ ] Map at least 6 symptoms to their correct first-surface from the Triage Spine
- [ ] Explain Monitor hub's exact coverage (17 types, no Dataflow Gen1) and retention limits
- [ ] Distinguish Import refresh from Direct Lake framing and explain when reframing happens
- [ ] Diagnose DirectQuery fallback using `EVALUATE TABLETRAITS()`
- [ ] Name Activator's 4 core concepts and the difference between stateless and stateful conditions
- [ ] List Activator's unsupported alert sources and explain the capacity-alerting workaround
- [ ] Choose between per-pipeline and workspace-wide pipeline-failure alerting patterns
- [ ] Explain why the Capacity Metrics app is admin-only and cannot alert

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
