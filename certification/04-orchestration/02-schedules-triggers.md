---
title: Schedules & Triggers
type: topic
tags:
  - dp-700
  - fabric
  - orchestration
  - pipelines
  - schedules
  - triggers
  - activator
---

# Schedules & Triggers

## Overview

A pipeline run starts in one of three ways: **on-demand** (manual), **scheduled** (time-based), or **event-based** (something happened). This topic covers how each works — fixed and interval-based schedules, storage/OneLake/Blob event triggers built on **Data Activator**, native notebook and Dataflow Gen2 scheduling, trigger monitoring, and the retry policy every activity can configure independently of the pipeline-level trigger.

> [!abstract]
>
> - **Fixed schedules** require both a start *and* end date — there's no open-ended option; set the end date far in the future to approximate "run forever"
> - **Interval-based schedules** (Preview) run on fixed, non-overlapping windows and can't be enabled/disabled/edited in place — delete and recreate to change them
> - **Event-based triggers** run on OneLake, Azure Blob, Fabric, and workspace events, implemented under the hood via **Data Activator** and an auto-created **eventstream**
> - **Notebooks and Dataflow Gen2 can each be scheduled directly**, independent of any pipeline — but the identity each run executes under differs by trigger type
> - Every pipeline **activity** (not just the pipeline itself) has its own independent **retry** setting — up to 1000 retries, configurable interval, and Preview retry *conditions* scoped to error code/message/failure type

> [!tip] What the Exam Tests
>
> - Fixed vs. interval-based schedule differences, and the start/end-date requirement
> - How storage event triggers are wired (OneLake/Blob events → eventstream → Data Activator → pipeline), and the null-safe `?` syntax needed for trigger parameters during manual testing
> - Which identity a notebook run executes under, based on how it was triggered
> - Activity-level retry configuration: count limits, interval, and which activity types support Preview retry conditions

---

## Pipeline Schedules

A pipeline can have **up to 20 schedules**, each with an independent frequency, start/end window, and time zone. Configure schedules from **Schedule** on the pipeline's **Home** tab.

### Fixed Schedule

The standard option: pick a frequency (by minute, hourly, daily, weekly, monthly), a start date/time, an **end date/time**, and a time zone.

> [!warning] Common Mistake
> A fixed schedule has **no open-ended option** — a start date is required *and* an end date is required. A scenario describing "schedule this pipeline to run forever, starting tomorrow" needs an end date set far in the future (Microsoft's own example: `01/01/2099 12:00 AM`) — there's no toggle that removes the end date requirement. This trips up anyone assuming Fabric scheduling behaves like a bare cron entry.

### Interval-Based Schedule (Preview)

Configures fixed, non-overlapping run windows using a **Window start time** / **Window end time** pair, exposed to the pipeline as two automatic trigger parameters under **Trigger parameters**. Unlike a fixed schedule, an interval-based schedule **can't be enabled, disabled, or edited** after creation — to change it, delete it and create a new one. Time-slice monitoring and backfill aren't available for interval-based schedules.

### Schedule Parameters

A scheduled pipeline can pass parameter values to the pipeline at each run, provided the **parameter names match exactly** what's defined on the pipeline — mismatched names are silently ignored at runtime, not rejected with an error. Values come from either a **direct static value** entered in the schedule, or a reference to a centrally-managed **Variable library** item (useful for promoting the same schedule config across Dev/Test/Prod with environment-specific values).

### Failure Notifications

Configure **email notifications** under a schedule's **Failure notifications** setting to alert specific users/groups when a *scheduled* run fails. On-demand runs never trigger these notifications — only scheduled runs do.

**Practice Question 1** *(Easy)*

A team wants a pipeline to run indefinitely on a daily schedule starting next Monday, with no planned end date. How should they configure the fixed schedule?

A. Leave the end date field blank to signal "no end"
B. Set the end date to a date far in the future (e.g., 01/01/2099)
C. Use an interval-based schedule instead, since only it supports open-ended runs
D. Fixed schedules can't run indefinitely; a pipeline must be manually re-triggered each day

> [!success]- Answer
> **B. Set the end date to a date far in the future (e.g., 01/01/2099)**
> Fabric's fixed schedule configuration always requires both a start and an end date/time — there's no blank-for-open-ended option (A) and interval-based schedules don't change this requirement (C). The documented workaround for an effectively indefinite schedule is to pick a far-future end date and update or stop the schedule later if needed.

---

## Event-Based Triggers

Event triggers start a pipeline when something happens — a file lands or is deleted in storage, a database changes, or a Fabric/Azure platform event fires. Fabric implements these using **Data Activator** underneath the pipeline's **Trigger** UI: creating a storage event trigger from the pipeline canvas creates a **Reflex** item (Activator's underlying object type) and, for external sources like Azure Blob, an auto-created **eventstream** to ingest the events.

### Supported Sources

- **OneLake events** — file created/deleted within a Lakehouse
- **Azure Blob Storage events** — the familiar source for anyone coming from Azure Data Factory
- **Fabric events** — workspace item created/updated/deleted, pipeline/job status changes
- **Business events** and **Fabric Ontology business entities** (Preview) — see [Data Activator](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction) for the full event-source catalog beyond storage

### Setting Up a Storage Event Trigger

1. Select **Trigger** on the pipeline canvas's **Home** ribbon — this opens the **Set alert** panel (Data Activator's alert authoring surface)
2. Choose the event source type: `OneLake` for OneLake file events, or an external source like Azure Blob Storage
3. For Azure Blob, select the subscription and storage account — Fabric auto-creates an **eventstream** object in the workspace to carry the events
4. Choose specific **event types** (file created, file deleted, and others beyond that pair)
5. **Filter events** using the `Subject` field — folder name, file name, file type, container are all part of `Subject`, not separate top-level fields
6. Choose the workspace, target pipeline, and pipeline action; name the trigger (creates the Reflex item)

An event carries this top-level shape (CloudEvents-based): `source`, `subject`, `type` (e.g., `Microsoft.Storage.BlobCreated`), `time`, `id`, `data`, `specversion`.

### Using Trigger Parameters in Expressions

Fabric automatically parses the file name and folder path out of the triggering event's `Subject`/`Topic` fields and exposes them as built-in trigger parameters:

```text
@pipeline()?.TriggerEvent?.FileName
```

> [!note]
> Notice the `?` after `pipeline()` and after `TriggerEvent`. This is the expression language's null-safe accessor — required here because during a **manual test run**, no triggering event exists, so `TriggerEvent` is `NULL`. Without the `?`, a manual test run of an event-triggered pipeline throws an expression error instead of just evaluating to an empty value.

### Viewing and Managing Triggers

The trigger itself is a **Reflex** object, visible in the workspace item list by name. Open it directly to edit the underlying rule, or use **Triggers → View triggers** from the pipeline menu to see triggers scoped to that specific pipeline.

**Practice Question 2** *(Medium)*

A pipeline uses `@pipeline().TriggerEvent.FileName` (without the `?` operator) in an expression, and the pipeline author runs a **manual test** from the canvas to validate logic before enabling the trigger. What happens?

A. The expression evaluates to an empty string with no error
B. The expression throws an error, because `TriggerEvent` is NULL during a manual run and the expression doesn't null-safely handle that
C. Fabric automatically substitutes a placeholder file name for testing
D. Manual test runs are blocked entirely for event-triggered pipelines

> [!success]- Answer
> **B. The expression throws an error, because `TriggerEvent` is NULL during a manual run and the expression doesn't null-safely handle that**
> `TriggerEvent` and its nested fields are only populated when the pipeline is actually invoked by a matching storage event. During manual testing there's no event, so the field is `NULL` — accessing `.FileName` on a null object without the `?` null-safe operator (`@pipeline()?.TriggerEvent?.FileName`) throws an expression evaluation error rather than silently returning empty.

---

## Notebook and Dataflow Gen2 Scheduling

Both notebooks and Dataflow Gen2 items support **native scheduling**, independent of any pipeline — you don't need to wrap either in a pipeline just to run it on a timer.

### Notebook Scheduling and Execution Identity

A Fabric notebook can be triggered three distinct ways, and **the security context differs by trigger type**:

| Trigger type | Runs as |
| :--- | :--- |
| Interactive run (manual, UI or REST) | The current user |
| Pipeline Notebook activity | The **pipeline's last-modified user** — not the pipeline owner, not the notebook owner |
| Native notebook schedule | Whoever **created or last updated that schedule** |

> [!warning] Common Mistake
> Don't assume a scheduled or pipeline-invoked notebook runs with *your* permissions, or the notebook owner's permissions. A scenario where a notebook that worked fine interactively suddenly fails on its schedule with a permissions error is almost always explained by the schedule owner (or, for pipeline-invoked runs, whoever last edited the pipeline) lacking the data access the notebook needs — check *that* identity's permissions, not the notebook author's.

> [!note] Mental model — Whoever holds the remote drives the car
> A notebook's code doesn't change based on how it's started, but *whose credentials* are in the driver's seat does. Interactive runs: you're driving. Pipeline-invoked runs: whoever last touched the pipeline's controls is driving, even if they never opened the notebook itself. Scheduled runs: whoever set (or most recently reset) the alarm clock is driving. Always check who's actually behind the wheel before debugging a permissions failure.

### Dataflow Gen2 Scheduling

Dataflow Gen2 items are scheduled directly from the item itself, similar to a pipeline's schedule UI. The key constraint (see [01-Choosing an Orchestration Tool](./01-choosing-orchestration-tool.md)) is that a dataflow with **required public parameters** can't be scheduled or manually triggered at all — that constraint applies regardless of which scheduling surface you use.

## Trigger and Schedule Monitoring

Pipeline runs — whether on-demand, scheduled, or event-triggered — surface in the **Monitoring Hub** and the pipeline's own **Output** tab, showing status progression through each activity as it completes. Dataflow Gen2 refreshes have their own **Refresh History** view, integrated with Monitoring Hub as well. Note the earlier caveat: Monitoring Hub does **not** display the specific parameter values used during a Dataflow Gen2 public-parameter run — only that a run happened.

## Activity Retry Policies

Retry is configured **per activity**, not per pipeline or per trigger — every activity's **General** tab exposes:

| Setting | Behavior |
| :--- | :--- |
| Timeout | Default 12 hours; max 7 days; format `D.HH:MM:SS` |
| Enable retries | Toggles retry behavior on for that activity |
| Retry | Number of retry attempts, 1–1000 (default 1) |
| Retry conditions (Preview) | Restrict retries to specific error code/message/failure type matches, combined with AND/OR |
| Retry interval (sec) | Wait time between attempts (default 30 seconds) |

By default (no retry conditions specified), an activity **retries on any failure**. Retry conditions narrow that — for example, matching only `Error code` `Contains` `429` to retry solely on rate-limiting, and fail fast on anything else (like an authentication error that a retry won't fix).

> [!warning] Common Mistake
> The **retry interval always runs before the condition is evaluated**. If an activity is configured with a 1-hour retry interval and its retry condition *doesn't* match the actual failure, the pipeline still waits the full hour before moving on — the condition check doesn't short-circuit the wait. Don't assume a non-matching retry condition fails fast; it fails only after the full interval elapses.

Conditional retries (the Preview **Retry conditions** feature specifically) are currently supported only for a subset of activity types: **Copy data, Notebook, Dataflow, and Stored procedure** activities. Other activity types can still use the basic retry count/interval, just not condition-based filtering.

**Practice Question 3** *(Hard)*

An activity is configured with **Enable retries** on, **Retry** set to 3, a **Retry interval** of 3600 seconds, and a retry condition matching only `Error code Contains 429`. The activity fails with a 500 (server error), which doesn't match the condition. How long before the pipeline moves past this activity's failure handling?

A. Immediately — the condition doesn't match, so no retry or wait occurs
B. The pipeline waits the full 3600-second interval once, then proceeds without retrying, since the interval runs before the condition is checked
C. The pipeline retries 3 times regardless of the condition, ignoring it entirely
D. The activity fails instantly and the retry interval is skipped for non-matching errors

> [!success]- Answer
> **B. The pipeline waits the full 3600-second interval once, then proceeds without retrying, since the interval runs before the condition is checked**
> Per documented behavior, the retry interval elapses *before* the retry condition is evaluated. So even though the 500 error doesn't match the `429`-only condition, the pipeline still waits the configured 3600 seconds before recognizing that no retry should occur and proceeding to the activity's failure path.

## Use Cases

- Nightly ELT run using a fixed schedule with a far-future end date, since the workload is meant to run indefinitely
- File-arrival-driven ingestion: a Blob/OneLake event trigger starts a pipeline the moment a new export lands, instead of polling on a tight schedule
- A notebook scheduled natively (no pipeline) for a self-contained daily aggregation job, scoped to run under a dedicated service-account-owned schedule for consistent permissions
- Retrying a flaky external API call (Web/Copy activity) up to 5 times with a short interval and a retry condition scoped to `429`/`5xx` codes, while failing fast on `401`/`403`

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Schedule save fails or behaves unexpectedly with no end date set | Fixed schedules require both start and end dates | Set an explicit end date, far in the future if the schedule should run indefinitely |
| Interval-based schedule can't be toggled off temporarily | Interval-based schedules (Preview) don't support enable/disable/edit in place | Delete the schedule and recreate it when you need to change or pause it |
| Scheduled parameter values are ignored at runtime | Parameter names in the schedule don't exactly match the pipeline's defined parameter names | Correct the parameter names in the schedule configuration to match exactly |
| Manual test run of an event-triggered pipeline throws an expression error | Expression references `TriggerEvent` fields without the `?` null-safe operator; `TriggerEvent` is `NULL` outside a real event | Use `@pipeline()?.TriggerEvent?.FileName` (and similar `?`-guarded paths) throughout |
| A scheduled notebook fails with a permissions error despite working interactively | The schedule's creator/last-updater identity lacks the data access the notebook needs | Grant the required permissions to that identity, or have an appropriately-permissioned user update the schedule |
| A dataflow won't accept a schedule or manual trigger at all | Public parameters mode is enabled with one or more required parameters | Make parameters optional with defaults, or drive the parameterized run from a pipeline's Dataflow activity instead |
| Failure notification emails never arrive for a failed run | The run was on-demand, not scheduled — failure notifications only fire for scheduled runs | Rely on Monitoring Hub for on-demand run status, or wrap the on-demand logic in a scheduled trigger if email alerts are required |

## Best Practices

- Prefer event-based triggers over tight polling schedules for file-arrival scenarios — lower latency and lower unnecessary run volume
- Always use the `?` null-safe operator on `TriggerEvent` expressions so manual test runs don't fail on a NULL reference
- Scope retry conditions narrowly (specific error codes) rather than leaving retries blanket-enabled for every failure, especially for expensive activities like Notebook or Dataflow
- Assign native notebook schedules to a dedicated, correctly-permissioned identity rather than an individual's personal account that might lose access later
- Set failure notifications on every production schedule — they're the only built-in "someone tell me if this breaks overnight" mechanism

## Exam Tips

> [!tip] Exam Tips
>
> - Fixed schedule = mandatory start **and** end date; interval-based = Preview, can't be edited in place, exposes Window start/end time trigger parameters
> - Storage event triggers run through Data Activator + an auto-created eventstream — the Reflex item is the actual trigger artifact
> - `@pipeline()?.TriggerEvent?.FileName` — memorize the `?` null-safe pattern; it's specifically needed because manual test runs have no real trigger event
> - Notebook execution identity: interactive = you; pipeline-invoked = pipeline's last-modified user; scheduled = schedule's creator/last-updater — three different answers to "who is this running as?"
> - Retry interval always elapses *before* the retry condition is checked — a non-matching condition still costs the full wait time
> - Conditional retry (Preview) only covers Copy data, Notebook, Dataflow, and Stored procedure activities

## Key Takeaways

- Three ways to start a pipeline run: on-demand, scheduled (fixed with mandatory end date, or Preview interval-based), and event-based via Data Activator
- Event triggers are Data Activator under the hood — a Reflex item plus, for external sources, an auto-created eventstream
- Notebooks and Dataflow Gen2 both schedule independently of pipelines, but notebook execution identity depends on *how* the run was triggered
- Retry is per-activity, supports up to 1000 attempts and a configurable interval, and Preview retry conditions only apply to Copy data, Notebook, Dataflow, and Stored procedure activities
- The retry interval always runs before condition evaluation — a documented, exam-relevant ordering detail

## Related Topics

- [01-Choosing an Orchestration Tool](./01-choosing-orchestration-tool.md)
- [03-Orchestration Patterns](./03-orchestration-patterns.md)

## Official Documentation

- [Run, schedule, or use events to trigger a pipeline](https://learn.microsoft.com/en-us/fabric/data-factory/pipeline-runs)
- [What is Fabric Activator?](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction)
- [Activity overview — retry settings](https://learn.microsoft.com/en-us/fabric/data-factory/activity-overview)
- [How to use Fabric notebooks — security context](https://learn.microsoft.com/en-us/fabric/data-engineering/how-to-use-notebook)
- [Fabric Data Factory expression language](https://learn.microsoft.com/en-us/fabric/data-factory/expression-language)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-choosing-orchestration-tool.md) | [↑ Back to Section](./orchestration.md) | [Next →](./03-orchestration-patterns.md)**
