---
title: Semantic Model Refresh
type: topic
tags:
  - dp-700
  - fabric
  - monitoring-alerting
  - semantic-model
  - direct-lake
  - framing
  - sempy
---

# Semantic Model Refresh

## Overview

Semantic models refresh differently depending on their storage mode: Import mode copies data wholesale, Direct Lake performs a metadata-only operation called **framing**, and DirectQuery never "refreshes" at all. This topic covers both refresh types, how to diagnose a failed refresh, the enhanced refresh REST API for large/complex models, scheduled-refresh configuration, and how the guide's other monitoring surfaces (Monitor hub, workspace lineage, `sempy`) apply specifically to semantic models.

> [!abstract]
>
> - **Import refresh** copies and caches an entire data volume; **Direct Lake refresh (framing)** copies only metadata — it updates references to the latest Delta table Parquet files, typically completing in seconds
> - **Reframing** happens on a refresh trigger — automatic (via **automatic updates**, enabled by default), manual, scheduled, or programmatic — and it resets the baseline for what data future queries see
> - Direct Lake on SQL endpoints can **fall back to DirectQuery** when framing conditions aren't met (SQL-based RLS/OLS/DDM, unmaterialized views, guardrail overruns); Direct Lake on OneLake never falls back
> - **Enhanced refresh** (the Power BI Refresh Dataset REST API) adds async operation, batched commits, table/partition-level refresh, and cancellation — built for large or complex models
> - Common failure causes: expired/invalid **credentials**, refresh **timeouts** (default 5 hours per attempt), and **memory/capacity limits** (per-model or per-query guardrails, or too many concurrent refreshes on the capacity)
> - **`sempy`** (semantic link) lets a notebook programmatically trigger and poll refresh status without leaving the Fabric portal's Spark runtime

> [!tip] What the Exam Tests
>
> - Distinguishing Import refresh from Direct Lake framing/reframing, and knowing framing is metadata-only
> - Recognizing DirectQuery fallback triggers for Direct Lake on SQL endpoints, and that Direct Lake on OneLake has no fallback
> - Reading refresh history to diagnose a failure and matching the failure to its likely cause (credentials, timeout, memory/capacity)
> - Knowing when the enhanced refresh API is the right tool vs. a standard scheduled refresh

---

## Refresh Types: Import vs. Direct Lake Framing

| Aspect | Import refresh | Direct Lake refresh (framing) |
| :--- | :--- | :--- |
| What moves | Entire data volume, replicated into an in-memory cache | Metadata only — references to the latest Parquet files |
| Typical duration | Minutes to hours, depending on volume | Seconds |
| Resource cost | High — data-source and capacity CPU/memory | Low — metadata analysis of the Delta log |
| Data prep location | Power Query, defined inside the semantic model | Upstream in OneLake (Spark, T-SQL, dataflows, pipelines) |
| Engine | VertiPaq (in-memory cache) | VertiPaq (on-demand column loading, called **transcoding**) |

Both Import and Direct Lake use the same **VertiPaq** query engine — the difference is entirely in how (and how much) data gets into memory. DirectQuery, by contrast, translates every query live against the source and never populates a VertiPaq cache at all.

> [!note] Mental model
> Import refresh is **photocopying the entire book** every time something changes — thorough, but slow and resource-heavy. Direct Lake framing is **updating the book's table of contents** to point at the newest chapters someone else already wrote (in OneLake) — fast, because you're not re-typing the book, just re-pointing to it. DirectQuery is **never keeping a copy of the book at all** — you call the library every single time someone asks a question.

## What Framing Means, and When Reframing Happens

**Framing** gives semantic model owners point-in-time control over what Delta table state a Direct Lake model reflects. During framing, the model analyzes each Delta table's transaction log, evicts only the column segments and join indexes whose underlying data actually changed, and updates references to the newest Parquet files. Dictionaries are usually **retained** (not dropped) — new values just get appended — which is why incremental framing is cheap even on tables that changed since the last framing pass.

Critically: **from the moment framing completes, all queries see the Delta tables exactly as they stood at that framing operation** — not whatever the Delta tables contain right now. New Parquet files written after framing stay invisible to the model until the *next* framing operation.

**Reframing** — a fresh framing pass — is triggered by any of:

- **Automatic updates** (enabled by default) — the model detects OneLake data changes and reframes without any user action
- **Manual refresh** — a user selects Refresh in the portal
- **Scheduled refresh** — same schedule mechanism as Import mode
- **Programmatic refresh** — via the enhanced refresh API, XMLA/TOM/TMSL, or `sempy`

Disable automatic updates when you specifically want framing to happen only on your own schedule — useful when upstream ETL is long-running and you don't want report users to see a half-written intermediate state mid-load.

> [!warning] Common Mistake
> Assuming a Direct Lake model always shows "live" data because there's no visible refresh schedule to configure. It doesn't — a Direct Lake model only reflects data as of its **last successful framing operation**. If automatic updates are disabled (or delayed) and no manual/scheduled/programmatic refresh has run since new data landed, users see stale data despite Direct Lake's reputation for near-real-time freshness.

## DirectQuery Fallback

**Direct Lake on SQL endpoints** can silently switch a table to DirectQuery mode when Direct Lake conditions aren't met. **Direct Lake on OneLake** never falls back — it runs exclusively in `DirectLakeOnly` mode.

Direct Lake mode holds only when **all** of these are true:

- No table references SQL row-level security (RLS), dynamic data masking (DDM), or object-level security (OLS) defined at the SQL analytics endpoint
- No table is based on an unmaterialized SQL view
- No table exceeds Fabric capacity guardrails (Parquet files, row groups, rows per table)
- The model was refreshed (framed) after the underlying Delta tables were created or modified

The **`DirectLakeBehavior`** model property (set via TOM/TMSL, or the Model view's Properties pane) controls what happens when conditions aren't met:

| Value | Behavior |
| :--- | :--- |
| **Automatic** *(default)* | Silently falls back to DirectQuery; slower but functional — use in production |
| **DirectLakeOnly** | Query fails with an error instead of falling back — use during development to surface problems early |
| **DirectQueryOnly** | Always uses DirectQuery — use to benchmark fallback performance |

To diagnose which tables are falling back and why, run `EVALUATE TABLETRAITS()` as a DAX query — the `DirectLakeFallbackInfo` column reports a fallback reason per table, or `None` if the table is running in Direct Lake mode.

| Fallback cause | Fix |
| :--- | :--- |
| Table isn't framed | Refresh the semantic model to frame it |
| Table is based on a SQL view | Materialize the view as a Delta table, or accept DirectQuery for that table |
| OLS at the SQL endpoint | Move object-level security to the semantic model, or accept fallback |
| RLS or DDM at the SQL endpoint | Move row-level security to the semantic model, or accept fallback |
| Delta table exceeds guardrails | Run `OPTIMIZE`/`VACUUM`, or move to a higher Fabric SKU |
| Capacity under memory pressure | Reduce concurrent workloads, or upgrade the capacity SKU |

**Practice Question 1** *(Medium)*

A Direct Lake on SQL endpoints semantic model has DirectLakeBehavior set to Automatic. Report users notice queries against one particular table are consistently slower than the rest of the model, though the reports still return correct results. What's the most likely explanation and where would you confirm it?

A. The table is using Import mode instead of Direct Lake — check the table's storage mode in Model view  
B. The table is falling back to DirectQuery — confirm with `EVALUATE TABLETRAITS()` and check the `DirectLakeFallbackInfo` column  
C. The capacity is completely out of memory and the whole model has stopped refreshing — check the Capacity Metrics app  
D. The table has an incremental refresh policy misconfigured — check the refresh policy settings  

> [!success]- Answer
> **B. The table is falling back to DirectQuery — confirm with `EVALUATE TABLETRAITS()` and check the `DirectLakeFallbackInfo` column**
>
> Slower-but-still-correct results on one specific table, with `DirectLakeBehavior` set to Automatic (silent fallback), is the textbook signature of DirectQuery fallback for that table only — not a model-wide issue. `TABLETRAITS()` reports the exact fallback reason per table so you can apply the matching fix from the table above.

## Refresh History and Failure Diagnosis

To view refresh history for any semantic model, select the model, then **Refresh → Refresh history** — this shows status, duration, and error messages per attempt. For Direct Lake models specifically, the Fabric portal's refresh history includes a **Direct Lake tab** listing Direct Lake-related refresh (framing) failures; successful framing operations aren't always listed individually unless the status actually changed (e.g., from failure to success).

Common refresh failure causes and how they present:

| Cause | Typical symptom | Fix direction |
| :--- | :--- | :--- |
| **Credentials** | Refresh fails immediately with an authentication/authorization error; after **4 consecutive failures**, Power BI automatically deactivates the refresh schedule | Update the data source credentials/connection, then re-enable the schedule |
| **Timeout** | Refresh runs the full duration then fails with a timeout error | Adjust the `timeout` parameter (enhanced refresh), reduce data volume per refresh, or split into multiple table/partition refreshes |
| **Memory / capacity limits** | Resource-governance error — the refresh exceeds the per-model or per-query memory limit the capacity enforces, or too many models are refreshing concurrently | Reduce concurrent refreshes, optimize the model, or scale up the capacity SKU |

> [!warning] Common Mistake
> Treating every refresh failure as a data-source problem. A refresh that fails after running for hours and hitting a resource-governance error is a **capacity sizing** issue, not a source-connectivity issue — check the Capacity Metrics app's Compute page for concurrent refresh load before assuming the data source itself is broken.

## The Enhanced Refresh API

The classic Refresh Dataset REST API triggers a refresh but ties up a long-running HTTP connection. **Enhanced refresh** — the same API family used asynchronously — removes that requirement and adds capabilities aimed at large or complex models:

- **Batched commits** (`commitMode`: `transactional` or `partialBatch`)
- **Table- and partition-level refresh** (`objects` array — refresh only what changed)
- **Incremental refresh policy application** (`applyRefreshPolicy`)
- **`GET` refresh details** — poll `requestId` for status without blocking
- **Refresh cancellation** — `DELETE` an in-progress enhanced refresh by `requestId`
- **Timeout configuration** (`timeout`, default 5 hours per attempt; total duration including retries capped at 24 hours)

| Verb | Purpose |
| :--- | :--- |
| `POST /refreshes` | Start a refresh; returns a `requestId` in the `Location` header |
| `GET /refreshes` | List historical/current/pending refreshes (supports `$top`) |
| `GET /refreshes/{requestId}` | Poll one refresh's status (`Unknown`, `InProgress`, `Completed`, `Failed`, `Disabled`, `Cancelled`) |
| `DELETE /refreshes/{requestId}` | Cancel an in-progress **enhanced** refresh only — standard refreshes triggered via the portal button can't be cancelled this way |

> [!note] Mental model
> A standard scheduled refresh is **calling and waiting on hold** — the connection has to stay open. Enhanced refresh is **leaving a voicemail and checking back later with a claim ticket** (`requestId`) — you can hang up immediately and poll status whenever convenient, which matters for large models where a refresh might run for hours.

## Scheduled Refresh Configuration

Standard scheduled refresh frequency is license-gated:

| License | Max scheduled refreshes/day |
| :--- | :--- |
| Power BI Pro | 8 |
| Power BI Premium Per User (PPU) | 48 |
| Premium / Fabric capacity | 48 |

A schedule is **automatically deactivated after 4 consecutive failures**, or immediately if Power BI detects an unrecoverable configuration error (e.g., invalid/expired credentials) — in both cases, the fix is correcting the underlying issue, then manually re-enabling the schedule; it doesn't reactivate itself once the root cause is fixed.

## Monitoring via Workspace Lineage and Monitor Hub

Semantic model refreshes are one of the item types Monitor hub tracks natively (see [01-Monitoring Surfaces](./01-monitoring-surfaces.md)) — status, duration, and error details appear alongside pipelines, dataflows, and every other tracked item type. **Workspace lineage view** additionally shows a semantic model's upstream dependencies (lakehouse/warehouse tables, dataflows) as a visual graph, which is the fastest way to confirm *what a semantic model actually depends on* before diagnosing why its refresh failed — a credential or availability problem in an upstream source shows up as a refresh failure on the model, even though the root cause lives upstream.

## Semantic Link (`sempy`) for Programmatic Checks

**Semantic link**, via the `sempy.fabric` Python package (available by default in the Fabric Spark runtime, Spark 3.4+), lets a notebook read from and orchestrate semantic models without leaving the notebook environment. Relevant to refresh monitoring specifically:

- The `sempy.fabric.semantic_model` module provides functions to list, deploy, refresh, and manage semantic models — including Direct Lake connection management and refresh-request orchestration
- `RefreshExecutionDetails` represents the status of a refresh request, mirroring what the enhanced refresh API's `GET /refreshes/{requestId}` returns — but callable directly from Python inside a notebook, useful for building a refresh-orchestration or validation step into a larger pipeline without a separate REST call

> [!note] Mental model
> `sempy` is the enhanced refresh API's **native Python front door** — anything you could do with a raw REST call, you can do inline in a notebook cell, which matters when refresh orchestration needs to sit in the same Spark pipeline that just finished writing the Delta tables the semantic model depends on.

**Practice Question 2** *(Medium)*

A large Import-mode semantic model's nightly scheduled refresh keeps timing out at the default limit, and the team wants to shorten failure-detection time for a specific problematic table while leaving the rest of the model on its normal schedule. What approach fits best?

A. Switch the entire model to Direct Lake to avoid refresh timeouts altogether  
B. Use the enhanced refresh API with the `objects` parameter scoped to the problematic table and an adjusted `timeout`  
C. Increase the scheduled refresh frequency so failures are caught sooner  
D. Disable automatic updates on the model  

> [!success]- Answer
> **B. Use the enhanced refresh API with the objects parameter scoped to the problematic table and an adjusted timeout**
>
> Enhanced refresh's `objects` array supports table/partition-level refresh, and `timeout` is independently configurable per request — exactly the tool for isolating one table's refresh behavior without touching the rest of the model's schedule. A full Direct Lake migration (A) is a much bigger architectural change than the problem calls for; refreshing more often (C) doesn't fix a timeout; automatic updates (D) is a Direct Lake concept and doesn't apply to Import mode.

**Practice Question 3** *(Easy)*

A semantic model's scheduled refresh has silently stopped running for the past several days, and no one on the team disabled it manually. What's the most likely cause, and where would you confirm it?

A. The capacity was paused — check the Capacity Metrics app's paused-capacity tracking  
B. Four consecutive refresh failures automatically deactivated the schedule — check refresh history for the failure pattern, then fix the root cause and re-enable  
C. The model switched to Direct Lake automatically, which doesn't need scheduled refresh  
D. Workspace lineage view removed the model's data source connection  

> [!success]- Answer
> **B. Four consecutive refresh failures automatically deactivated the schedule — check refresh history for the failure pattern, then fix the root cause and re-enable**
>
> Power BI/Fabric automatically deactivates a refresh schedule after four consecutive failures (or immediately on an unrecoverable configuration error like expired credentials) — this is a deliberate protective behavior, not a bug, and the schedule stays off until someone fixes the underlying cause and manually re-enables it.

## Use Cases

- Diagnosing why a Direct Lake report shows stale data by checking the time of the last successful framing operation
- Using `EVALUATE TABLETRAITS()` to confirm whether a performance complaint is actually a DirectQuery fallback on one table
- Scoping an enhanced refresh to just the tables that changed, instead of a full-model refresh, to cut refresh duration on a large model
- Orchestrating a semantic model refresh from the same notebook that just finished a Spark write, via `sempy`, instead of a separate scheduled trigger racing the ETL job
- Using workspace lineage to identify an upstream source outage as the real cause of a semantic model's refresh failures

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Direct Lake report shows data that's missing recently loaded rows | The model hasn't been reframed since the new data landed (automatic updates disabled or delayed) | Trigger a manual/programmatic refresh (framing), or verify automatic updates is enabled |
| A specific table's queries are slower than the rest of a Direct Lake on SQL endpoints model | The table is falling back to DirectQuery | Run `EVALUATE TABLETRAITS()`, identify the fallback cause, apply the matching fix |
| Refresh fails with a resource-governance / memory error | Refresh exceeds per-model/per-query memory limits, or too many concurrent refreshes on the capacity | Reduce concurrency, optimize the model, or scale the capacity SKU |
| Refresh schedule stopped running with no manual change | 4 consecutive failures auto-deactivated it, or an unrecoverable credential error occurred | Check refresh history, fix the root cause, manually re-enable the schedule |
| Enhanced refresh `POST` returns `400 Bad Request` | A refresh is already running on that model — only one refresh operation is accepted at a time per model | Wait for the in-progress refresh to complete, or poll `GET /refreshes` before submitting a new one |
| `DELETE /refreshes/{requestId}` fails to cancel a refresh | The refresh was triggered by a scheduled/on-demand portal action, not the enhanced refresh API — those can't be cancelled via `DELETE` | Let it complete, or trigger future refreshes via the enhanced refresh API if cancellation support is needed |

## Best Practices

- Prefer Direct Lake on OneLake over Direct Lake on SQL endpoints for new models when DirectQuery fallback must never silently degrade performance — it has no fallback path at all
- Set `DirectLakeBehavior` to `DirectLakeOnly` in development to surface fallback conditions as hard errors before they reach production as silent slowdowns
- Use the enhanced refresh API's table/partition scoping for large models instead of always refreshing the entire model
- Monitor refresh history for the 4-consecutive-failure pattern proactively, rather than discovering a dead schedule days later
- Check workspace lineage before assuming a refresh failure is the semantic model's own fault — many failures originate upstream

## Exam Tips

> [!tip] Exam Tips
>
> - Framing = metadata-only refresh; Import refresh = full data copy — know this distinction cold
> - Direct Lake on OneLake **never** falls back to DirectQuery; Direct Lake on SQL endpoints can, controlled by `DirectLakeBehavior` (`Automatic`/`DirectLakeOnly`/`DirectQueryOnly`)
> - `EVALUATE TABLETRAITS()` + `DirectLakeFallbackInfo` is the diagnostic tool for fallback, table by table
> - Enhanced refresh API verbs: `POST` (start), `GET` (status/list), `DELETE` (cancel — enhanced-triggered refreshes only)
> - Scheduled refresh limits: Pro = 8/day, PPU and Premium/Fabric capacity = 48/day; auto-deactivates after 4 consecutive failures
> - `sempy.fabric.semantic_model` gives notebook-native refresh orchestration and `RefreshExecutionDetails` status polling

## Key Takeaways

- Import refresh copies data; Direct Lake framing copies only metadata references — framing is why Direct Lake refreshes in seconds, not minutes
- Reframing triggers on automatic updates, manual action, schedule, or programmatic calls; between framings, Direct Lake queries see a fixed point-in-time snapshot
- DirectQuery fallback is a Direct Lake on SQL endpoints-only behavior, governed by `DirectLakeBehavior` and diagnosable via `TABLETRAITS()`
- The enhanced refresh REST API adds async operation, table/partition scoping, and cancellation — the right tool for large or complex models
- `sempy` brings refresh orchestration and status polling natively into notebooks, alongside the portal, Monitor hub, and workspace lineage as ways to watch a semantic model's health

## Related Topics

- [01-Monitoring Surfaces](./01-monitoring-surfaces.md)
- [03-Activator & Alerts](./03-activator-alerts.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Official Documentation

- [Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)
- [How Direct Lake works](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-how-it-works)
- [Enhanced refresh with the Power BI REST API](https://learn.microsoft.com/en-us/power-bi/connect-data/asynchronous-refresh)
- [Configure scheduled refresh](https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-scheduled-refresh)
- [Troubleshoot refresh scenarios](https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-troubleshooting-refresh-scenarios)
- [What is semantic link?](https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview)
- [sempy.fabric.semantic_model package](https://learn.microsoft.com/en-us/python/api/semantic-link-sempy/sempy.fabric.semantic_model?view=semantic-link-python)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-monitoring-surfaces.md) | [↑ Back to Section](./monitoring-alerting.md) | [Next →](./03-activator-alerts.md)**
