---
title: Activator & Alerts
type: topic
tags:
  - dp-700
  - fabric
  - monitoring-alerting
  - activator
  - real-time-hub
  - alerts
---

# Activator & Alerts

## Overview

**Fabric Activator** is Fabric's no-code event-detection engine — it watches data streams (and Fabric/Azure/business events) for conditions you define, then automatically fires an action: an email, a Teams message, a Power Automate flow, or running another Fabric item. This topic covers Activator's core concepts (events, objects, conditions, rules), every alert source and action the exam expects, how to set alerts from Monitor hub and other Real-Time Intelligence surfaces, the pipeline-failure alerting pattern, and Activator's documented limits.

> [!abstract]
>
> - Activator became **generally available in November 2024**; as of this writing it's officially named **Fabric Activator** (verify current naming against the linked docs before the exam — Fabric product names shift)
> - Core concepts: **events** (individual records), **objects** (events grouped by a shared identifier), **rules** (the conditions + actions to evaluate), and **conditions** — stateless (`value < threshold`) or stateful (`BECOMES`, `DECREASES`, `INCREASES`, `EXIT RANGE`, absence of data/heartbeat)
> - **Alert sources** span Eventstreams, KQL querysets/Real-Time dashboards, Power BI report visuals, Fabric job/workspace/OneLake events (via Real-Time hub), and — in preview — Warehouse SQL query results
> - **Actions** include email, Teams, Power Automate, and running a Fabric pipeline/notebook/Spark job definition/dataflow/User Data Function/copy job (preview), or publishing a business event (preview)
> - Alerts can be authored **in-context** from Eventstream, KQL querysets, Real-Time dashboards, Power BI visuals, and Real-Time hub — not only from a standalone Activator item
> - Rate limits exist per action type (e.g., 500 email messages/Activator item/hour) — the exam may test recognizing throttling as the cause of "missing" alerts under high event volume

> [!tip] What the Exam Tests
>
> - Mapping a described alerting need (streaming threshold, pipeline failure, dashboard condition) to the correct alert source and where to configure it
> - Distinguishing stateless from stateful rule conditions, and recognizing `BECOMES`/`DECREASES`/`INCREASES`/heartbeat vocabulary
> - Knowing the full action list, especially the Fabric-item-execution actions (pipeline, notebook, Spark job definition, dataflow, UDF, copy job)
> - Recognizing Activator's documented limitations — unsupported sources (Capacity Metrics app, SQL analytics endpoint, Dynamic M parameters), email/Teams recipient restrictions, and action rate limits

---

## Core Concepts: Events, Objects, Conditions, Rules

| Concept | Definition |
| :--- | :--- |
| **Event** | A single observation about the state of something — a telemetry reading, a file drop, a row change — carrying a timestamp, a payload, and one or more identifying attributes |
| **Object** | Events grouped by a shared identifier (e.g., every event with the same `device_id`) so rules evaluate per instance — a freezer, a vehicle, a user session — independently of every other instance |
| **Rule** | The condition to detect on an object (or on raw events) plus the action to take when that condition fires; each Activator item can hold one or more rules, evaluated continuously |
| **Condition** | The logic a rule tests — a **stateless** comparison (`value < 50`) evaluated on each event in isolation, or a **stateful** expression (`BECOMES`, `DECREASES`, `INCREASES`, `EXIT RANGE`, or absence-of-data/**heartbeat**) that tracks state across events per object |

Rules come in three flavors: rules **on events** (fire every time a matching event arrives), rules **on objects** (fire on the arrival of an object, or an object meeting a condition), and rules **on properties** (monitor a specific attribute of an object over time, e.g., a package's temperature staying within range).

Stateful evaluation relies on **delta detection** (tracking changes between prior and current values), **temporal sequencing** (time-based conditions like heartbeat absence), and **state transitions** (a rule fires only on *entry* into a new state, not on every event while that state persists) — this last point is what keeps a threshold breach from spamming one alert per incoming event.

> [!note] Mental model
> Stateless rules are a **motion-triggered light** — every qualifying event flips it on, no memory required. Stateful rules are a **smoke detector with a memory** — it doesn't scream continuously while smoke is present, it alarms once on the transition into "smoke detected," then waits for a transition back to normal before it can alarm again. That transition-only behavior is exactly why `BECOMES`/`DECREASES` conditions are preferred over raw thresholds for anything that could otherwise spam recipients.

Each rule condition compiles into an execution graph evaluated continuously, in memory, targeting **subsecond latency** for stateless rules on streaming data; rules with aggregations or lookback windows take longer, bounded by the lookback period and late-arrival tolerance.

## Alert Sources

Activator (and the surfaces that create Activator rules in-context) can watch:

| Source | Notes |
| :--- | :--- |
| **Eventstreams** | The primary streaming source — Activator subscribes to one or more eventstreams; alert authoring is embedded directly in the Eventstream editor |
| **KQL querysets / Real-Time dashboards** | Set an alert on a scheduled KQL query's results (default check frequency: 5 minutes), or on a Real-Time dashboard tile meeting a condition — authored via **Set Alert** on the query results ribbon, or directly on a dashboard tile |
| **Power BI report visuals** | Table-visual row detection on a published report; Activator only supports a defined list of visual types (stacked/clustered column and bar, line, area, pie, donut, gauge, card, KPI, and specific map types using a *Location* field — not Latitude/Longitude) |
| **Real-Time hub events** | **Fabric job events** (e.g., pipeline succeeded/failed), **Fabric workspace item events**, **Fabric OneLake events**, and **Fabric capacity overview events** — all set up as alerts directly from their respective Real-Time hub pages |
| **Fabric Data Warehouse SQL query results** *(preview)* | Evaluate a SQL query on a configurable schedule and trigger on the result set — enables alerting on warehouse data without a streaming source |
| **Business events** *(preview)* / **Fabric Ontology business entities** *(preview)* | Set alerts directly on published business events, or on modeled ontology entities for operational decisioning |

==Creating alerts from the Fabric or Power BI Capacity Metrics app, or from a SQL analytics endpoint directly, is not supported== — a scenario naming either of those as the alert source is a distractor; route capacity-throttling alerting through **Fabric capacity overview events** in Real-Time hub instead, and warehouse alerting through the SQL query (preview) mechanism, not the SQL analytics endpoint.

## Actions

When a rule's condition is met, Activator can trigger:

- **Email** — internal recipients only (see Limits below)
- **Teams** — message to an individual, group chat, or channel (shared channels only, not private)
- **Power Automate** — a custom flow, for integration with external/third-party systems
- **Run a Fabric item** — pipeline, notebook, Spark job definition, dataflow, User Data Function, or **copy job** *(preview)*
- **Publish a business event** *(preview)* — for triggering further downstream processes that consume business events

When a rule fires, Activator sends the action and continues monitoring immediately — it doesn't wait for the action to complete, which is what lets it process many objects' state transitions concurrently without one slow downstream action blocking detection on the rest.

> [!warning] Common Mistake
> Assuming Activator can trigger literally any Fabric item type as an action, or that a single Activator alert scenario always maps to exactly one action. It supports a specific list (pipeline, notebook, Spark job definition, dataflow, UDF, copy job, business-event publish, Power Automate, Teams, email) — and a single rule can be configured to take more than one of these when a scenario calls for it (e.g., email the on-call engineer *and* rerun the failed pipeline).

## Setting Alerts from Monitor Hub and RTI Surfaces

Alert authoring is deliberately **decentralized** — rather than forcing every alert through a single Activator item editor, Fabric embeds "Set Alert" directly into the surface where the condition naturally lives:

| Where you are | How you set the alert |
| :--- | :--- |
| **Eventstream editor** | Attach an operator chain, then configure an Activator destination directly in the event-processing canvas |
| **KQL queryset results** | Run the query, select **Set Alert** in the ribbon, configure frequency and condition in the **Add Rule** pane |
| **Real-Time dashboard tile** | Select the tile's alert option directly (tile must be KQL-based, non-static, single time range, no `make-series`) |
| **Power BI report visual** | Set alert directly on a supported visual type in a published report |
| **Real-Time hub → Fabric events** | Select **Job events**, **Workspace item events**, **OneLake events**, or **Capacity overview events**, pick the specific item/event, and either target an existing Activator item or create a new one |

Regardless of entry point, every alert ultimately lives inside an **Activator item** in a workspace — the in-context "Set Alert" flows are shortcuts that create or add to that item, not a separate alerting mechanism.

## Alert on Pipeline Failure Pattern

The canonical "alert me when this pipeline fails" pattern uses **Fabric job events** as the source, since pipeline runs triggered by schedules or manual triggers are surfaced as job events:

1. From **Real-Time hub**, select **Fabric events → Job events** (or start directly from an Activator item's **Get Data** tile and pick **Job events**)
2. Select the specific pipeline to monitor and the event of interest (e.g., run failed)
3. Choose the workspace/Activator item to save the rule into — create a new Activator item or add to an existing one
4. Configure the action — typically email or Teams to the on-call owner, and optionally a Fabric-item action to trigger a remediation pipeline

For **workspace-wide** failure alerting (many pipelines, one rule) rather than per-pipeline rules, the alternative is enabling **workspace monitoring** and building a single Activator rule on a **KQL queryset** that queries the monitoring Eventhouse's `ItemJobEventLogs` table for recent failures — one rule covers every pipeline in the workspace instead of maintaining a rule per pipeline. This is a distinct data-source path (KQL queryset) from the direct job-events path, and the exam may present both as valid alternatives with different maintenance tradeoffs.

> [!note] Mental model — per-item vs. workspace-wide pipeline alerting
> A **job-events rule per pipeline** is a **smoke detector in every room** — precise, but you're installing and maintaining one per room. A **workspace-monitoring KQL rule** is **one central fire-alarm panel wired to every room's sensor** — less setup per new pipeline, but you're relying on the wiring (workspace monitoring) being enabled and the query being written to actually catch every case.

**Practice Question 1** *(Medium)*

A team wants to be notified in Teams the moment any of their 40 pipelines in a workspace fails, without configuring 40 separate alert rules and without needing to touch each pipeline individually as new ones get added. What approach fits best?

A. Create a Job events alert on each of the 40 pipelines individually, targeting the same Activator item  
B. Install the Capacity Metrics app and configure a capacity-wide failure alert  
C. Enable workspace monitoring and create a single Activator rule on a KQL queryset  
D. Create a single Power BI report visual showing pipeline status and set an alert on it  

> [!success]- Answer
> **C. Enable workspace monitoring and create a single Activator rule on a KQL queryset**
>
> This is the workspace-wide alerting pattern — one KQL queryset rule, querying the monitoring Eventhouse's `ItemJobEventLogs` table for recent failures, covers every pipeline in the workspace, including ones added later, without per-pipeline setup. Option A technically works but doesn't scale and requires touching every new pipeline. The Capacity Metrics app doesn't support alerts at all (B). A Power BI visual alert (D) is possible in principle but is a much heavier, indirect path compared to querying the log directly.

**Practice Question 2** *(Easy)*

A cold-chain logistics team wants an alert only when a package's average temperature over a 3-hour window exceeds 8°C — not an alert on every single temperature reading, even ones briefly over 8°C that immediately drop back down. Which rule type fits, and why?

A. A stateless rule comparing each raw event's temperature to 8°C  
B. A stateful rule using a lookback-window average with a `BECOMES` entry condition  
C. An action-only rule with no condition, scheduled every 3 hours  
D. A Power BI visual alert on a card showing the latest temperature reading  

> [!success]- Answer
> **B. A stateful rule using a lookback-window average with a BECOMES entry condition**
>
> The scenario explicitly wants averaging over a window (requiring a lookback period) and a single alert on entering the bad state, not repeated alerts — that's the defining behavior of a stateful, transition-based rule: it fires only once, on the transition into the "too warm" state, not on every reading that happens to be above threshold. A stateless per-event comparison (A) would fire on every qualifying raw reading, including transient spikes, which is exactly the noise the team wants to avoid.

**Practice Question 3** *(Medium)*

An Activator rule is configured to send an email for every threshold breach on a high-volume IoT eventstream. During a sustained anomaly affecting thousands of devices simultaneously, some team members report they stopped receiving emails partway through the incident, even though the anomaly was still ongoing. What's the most likely explanation?

A. Activator crashed under load and stopped evaluating rules entirely  
B. The eventstream exceeded its 1 MB message size limit and dropped events  
C. The semantic model backing the alert fell back to DirectQuery and slowed down  
D. The rule's action hit Activator's email rate limit and began throttling further sends  

> [!success]- Answer
> **D. The rule's action hit Activator's email rate limit and began throttling further sends**
>
> Activator enforces documented per-action rate limits — email is capped at **500 messages per Activator item per hour** and **30 messages per rule per recipient per hour**. A sustained, high-cardinality incident that fires many state transitions in a short window can hit these caps, and Activator throttles or cancels excess actions rather than crashing. Eventstream's 1 MB limit (B) is a per-message size cap, unrelated to alert-volume throttling, and nothing here suggests a semantic model or DirectQuery (C) is involved.

## Limits and Licensing Notes

Activator instances are scoped to a **Fabric capacity** and billed pay-as-you-go — cost accrues only while rules are actively running, which favors intermittent detection scenarios over always-on polling.

Documented general limitations:

- Alerts from **Dynamic M parameters** in a report aren't supported
- Alerts from the **Fabric or Power BI Capacity Metrics app** aren't supported
- Alerts from a **SQL analytics endpoint** directly aren't currently supported (use the Warehouse SQL query preview mechanism instead)
- Email recipients must be **internal** addresses on the creator's verified Entra tenant domains — no external or guest email addresses
- Teams group chats must be **recently active** to appear as a target; only **shared channels** are supported, not private channels
- **Lifecycle management** (deployment pipelines, Git integration) doesn't support Activator items that use Azure Blob Storage events, Power BI, or User Data Functions as a source/action — including one in a deployment pipeline or Git-integrated workspace produces a deploy/commit error

Documented numeric limits:

| Limit | Value |
| :--- | :--- |
| Max incoming events/second/rule | 10,000 (Activator stops the rule if exceeded) |
| Email messages/Activator item/hour | 500 |
| Email messages/rule/recipient/hour | 30 |
| Teams messages/Activator item/hour | 500 |
| Teams messages/rule/recipient/hour | 30 |
| Teams messages/recipient/hour | 100 |
| Teams messages/Teams tenant/second | 50 |
| Power Automate flow executions/rule/hour | 10,000 |
| Fabric item activations/user/minute | 50 |

Activator reached **General Availability in November 2024**; all preview-era items and rules were phased to read-only in January 2025 and deleted in March 2025 — a reminder that Activator's exact feature list (particularly what's still preview vs. GA) is worth re-verifying against current docs close to exam day rather than memorized from older material.

## Use Cases

- Alerting an on-call engineer via Teams the instant a critical pipeline's job event reports failure, with an automatic rerun triggered as a second action on the same rule
- Detecting a cold-chain temperature excursion using a stateful, windowed rule instead of noisy per-event thresholds
- Setting one workspace-wide KQL-queryset-based alert against the monitoring Eventhouse instead of maintaining dozens of per-pipeline rules
- Watching a Power BI report's KPI visual and triggering a Power Automate approval flow when a business metric crosses a threshold
- Alerting on Fabric capacity overview events in Real-Time hub, since the Capacity Metrics app itself can't fire alerts

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Alert never fires despite the condition clearly being met | Rule may be evaluating a stateless condition that already "settled" into the triggering state before the rule was activated, or state-transition logic requires exiting and re-entering the state | Review whether the condition needs `BECOMES`/transition logic vs. a raw stateless comparison |
| Emails stop arriving mid-incident during a high-volume event | Action rate limit exceeded (e.g., 500 emails/Activator item/hour) | Reduce alert granularity (e.g., aggregate/dedupe upstream), or split rules across more Activator items if genuinely independent |
| Can't add an Activator item to a deployment pipeline | The item uses Azure Blob Storage events, Power BI, or User Data Functions as a source/action — unsupported in lifecycle management | Recreate the dependency using a supported source/action, or manage that Activator item outside the deployment pipeline for now |
| Email alert recipient never receives the notification | Recipient's domain isn't a verified domain on the creator's Entra tenant, or the recipient is external/guest | Verify the domain in Microsoft Entra ID → Custom domain names; use an internal recipient |
| Power BI visual alert can't be created on a chosen visual | The visual type isn't in Activator's supported list, or the visual uses Dynamic M parameters | Switch to a supported visual type, or remove the Dynamic M parameter dependency |
| Attempt to alert directly from the Capacity Metrics app fails | Not a supported alert source | Use Fabric capacity overview events in Real-Time hub instead |

## Best Practices

- Prefer stateful, transition-based conditions (`BECOMES`, `DECREASES`) over raw stateless thresholds whenever a scenario risks repeated firing on a single sustained condition
- Use workspace monitoring + a single KQL queryset rule for workspace-wide failure alerting instead of one rule per item when the item count is large or growing
- Combine actions on one rule (e.g., notify + remediate) rather than building separate rules for notification and remediation of the same condition
- Preview a rule's estimated firing rate against historical data before activating it, to catch alert-spam risk before it reaches recipients
- Re-verify Activator's current feature/preview status close to exam day — it's one of the fastest-moving areas of Fabric, and this guide's naming and preview labels should be checked against the live docs

## Exam Tips

> [!tip] Exam Tips
>
> - Know the four core concepts cold: **events, objects, conditions, rules** — and that objects are how per-instance (per-device, per-package) evaluation works
> - Stateful condition vocabulary: `BECOMES`, `DECREASES`, `INCREASES`, `EXIT RANGE`, absence-of-data/heartbeat — stateless is just a raw comparison
> - Alert sources: Eventstreams, KQL querysets/Real-Time dashboards, Power BI visuals, Real-Time hub events (job/workspace item/OneLake/capacity overview), Warehouse SQL query (preview)
> - Unsupported alert sources are a common distractor: **Capacity Metrics app** and **SQL analytics endpoint** directly are both explicitly unsupported
> - Actions: email, Teams, Power Automate, and running a pipeline/notebook/Spark job definition/dataflow/UDF/copy job (preview), or publishing a business event (preview)
> - Pipeline-failure alerting uses **Fabric job events**, either per-pipeline (Real-Time hub → Job events) or workspace-wide (KQL queryset against `ItemJobEventLogs`)
> - Know the rate limits exist even if not memorized exactly — a scenario about "alerts stopped during a huge spike" points to throttling, not a system failure

## Key Takeaways

- Activator is Fabric's no-code event-detection engine: events feed objects, rules evaluate conditions (stateless or stateful) per object, and actions fire on condition match
- Alert authoring is decentralized — Eventstream, KQL querysets, Real-Time dashboards, Power BI visuals, and Real-Time hub all offer in-context "Set Alert," all ultimately backed by an Activator item
- Pipeline-failure alerting has two valid patterns: per-pipeline job events, or workspace-wide via workspace monitoring's KQL logs — different maintenance tradeoffs, not a right/wrong split
- The Capacity Metrics app and SQL analytics endpoints are explicitly unsupported alert sources — capacity alerting routes through Real-Time hub's capacity overview events instead
- Documented rate limits (email, Teams, Power Automate, Fabric item activations) are a real exam trap for "why did alerts stop" scenarios during high event volume

## Related Topics

- [01-Monitoring Surfaces](./01-monitoring-surfaces.md)
- [02-Semantic Model Refresh](./02-semantic-model-refresh.md)
- [08-Streaming Data: Eventstreams](../08-streaming-data/02-eventstreams.md)

## Official Documentation

- [What is Fabric Activator?](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction)
- [Overview of Activator rules](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-rules-overview)
- [Activator limitations](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-limitations)
- [Create Activator alerts from KQL query results](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-alert-queryset)
- [Create an alert rule on a SQL query](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/set-alerts-warehouse-sql-query)
- [Set alerts on Job events in Real-Time hub](https://learn.microsoft.com/en-us/fabric/real-time-hub/set-alerts-fabric-job-events)
- [Set alerts on Fabric capacity overview events in Real-Time hub](https://learn.microsoft.com/en-us/fabric/real-time-hub/set-alerts-fabric-capacity-overview-events)
- [Create alerts for pipeline runs](https://learn.microsoft.com/en-us/fabric/data-factory/create-alerts-for-pipeline-runs)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-semantic-model-refresh.md) | [↑ Back to Section](./monitoring-alerting.md) | [Next →](../10-error-resolution/error-resolution.md)**
