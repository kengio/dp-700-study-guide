---
title: Real-Time Errors — Eventhouse and Eventstream
type: topic
tags:
  - dp-700
  - fabric
  - error-resolution
  - eventhouse
  - eventstream
  - kql
  - ingestion
  - real-time-intelligence
---

# Real-Time Errors — Eventhouse and Eventstream

## Overview

Real-time errors split across two items: **Eventhouse**, where ingestion either succeeds, queues for retry, or fails permanently, and **Eventstream**, where the failure is usually upstream (a source can't connect) or downstream (a destination can't keep up). This topic covers the KQL-native `.show ingestion failures` diagnostic, the permanent-vs-transient failure taxonomy, update-policy failure behavior, and Eventstream's connection, throughput, and processor error classes.

> [!abstract]
>
> - `.show ingestion failures` returns a **`FailureKind`** column of either `Permanent` (won't succeed on retry — bad format, missing permission) or `Transient` (may succeed on retry — throttling, timeout); retention for this command's records is **14 days**
> - Ingestion error codes are grouped into named categories: `BadFormat`, `BadRequest`, `DataAccessNotAuthorized`, `DownloadFailed`, `EntityNotFound`, `FileTooLarge`, `InternalServiceError`, `UpdatePolicyFailure`, `ThrottledOnEngine`
> - **Update policies** propagate failures differently depending on transactional vs. non-transactional configuration — a transactional failure blocks the *entire source batch* from committing; non-transactional lets the source batch commit while only the derived-table write fails
> - Eventstream's most-cited exam scenario is **AADSTS65002** — Fabric Eventstream isn't preauthorized against a specific Azure Event Hub, and the fix is tenant-side, not something an end user can self-resolve
> - **Runtime logs** (three severities: warning, error, information) diagnose engine-level processing problems; **Data insights** diagnoses throughput/connectivity at the source or destination node

> [!tip] What the Exam Tests
>
> - Reading `.show ingestion failures` output and classifying a failure as retry-worthy or not
> - Knowing which ingestion failures are permanent (schema mismatch, bad format) vs. transient (throttling, timeout, unknown)
> - Understanding what happens to a batch when an update policy fails, and whether that failure is transactional
> - Recognizing AADSTS65002 and similar auth errors as tenant-preauthorization issues rather than end-user misconfiguration
> - Matching an Eventstream symptom (no data flowing, dropped/transformed events, delivery lag) to Data insights vs. Runtime logs

---

## Eventhouse Ingestion Failures: `.show ingestion failures`

The KQL management command `.show ingestion failures` returns every recorded ingestion management-command failure for a database, with a **14-day retention window**. It does **not** cover every stage of ingestion — for a comprehensive view spanning all stages, pair it with ingestion **metrics** and **diagnostic logs** (see [09-Monitoring Surfaces: Eventhouse Ingestion Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md#eventhouse-ingestion-monitoring) for the workspace-monitoring KQL tables that fill this gap).

Key output columns:

| Column | Meaning |
| :--- | :--- |
| `Database` / `Table` | Where the failure occurred |
| `FailedOn` | UTC timestamp of the failure |
| `Details` | The actual root-cause message |
| ==`FailureKind`== | **`Permanent`** or **`Transient`** — the single most exam-relevant column |
| `ErrorCode` | The specific ingestion error code (see table below) |
| `OriginatesFromUpdatePolicy` | Boolean — whether the failure happened while an update policy was executing |

```kql
.show ingestion failures
| where FailedOn > ago(1d)
| where FailureKind == "Permanent"
```

> [!note] Mental model — Permanent vs. Transient
> A **Permanent** failure is a **returned letter — undeliverable address**. Resending it (retrying) changes nothing; you have to fix the address (the data format, the mapping, the permission) before it can succeed. A **Transient** failure is a **delayed flight** — the same request will likely get through if you just try again once the runway (throttling, timeout, network blip) clears.

## Ingestion Error Code Categories

| Category | Representative errors | `FailureKind` | Typical fix |
| :--- | :--- | :--- | :--- |
| **BadFormat** | `Stream_WrongNumberOfFields`, `Stream_ClosingQuoteMissing`, `BadRequest_InvalidMapping`, `BadRequest_FormatNotSupported` | Permanent | Fix the source file's structure or the ingestion mapping — retrying won't help |
| **BadRequest** | `BadRequest_EmptyBlob`, `BadRequest_InvalidOrEmptyTableName`, `BadRequest_DuplicateMapping`, `Stream_DynamicPropertyBagTooLarge` | Permanent | Fix the request/ingestion-properties definition |
| **DataAccessNotAuthorized** | `Download_Forbidden`, `BadRequest_TableAccessDenied`, `BadRequest_InvalidAuthentication` | Permanent | Grant the missing role/permission on the source storage or target table |
| **DownloadFailed** | `Download_NotTransient` (Permanent), `Download_UnknownError` / `Download_TransientNameResolutionFailure` (Transient) | Mixed | Transient variants: retry; `NotTransient`: investigate storage connectivity directly |
| **EntityNotFound** | `BadRequest_DatabaseNotExist`, `BadRequest_TableNotExist`, `BadRequest_MappingReferenceWasNotFound` | Permanent | Create the missing entity or fix the reference name |
| **FileTooLarge** | `Stream_InputStreamTooLarge`, `BadRequest_FileTooLarge` | Permanent | Split the source file/field below the size limit |
| **InternalServiceError** | `General_InternalServerError`, `Timeout`, `OutOfMemory` (Transient); `Schema_PermanentUpdateFailure` (Permanent) | Mixed | Transient variants: retry; schema failures need manual correction |
| **UpdatePolicyFailure** | `UpdatePolicy_QuerySchemaDoesNotMatchTableSchema` (Permanent); `UpdatePolicy_IngestionError` (Transient) | Mixed | See Update Policy Failure Behavior below |
| **ThrottledOnEngine** | `General_ThrottledIngestion` | Transient | Retry, or reduce ingestion rate/batch size |
| **RetryAttemptsExceeded** | `General_RetryAttemptsExceeded` | Permanent | The platform already retried repeatedly on your behalf and gave up — investigate the underlying transient cause directly rather than retrying again |

> [!warning] Common Mistake
> Assuming *any* ingestion failure is worth an automatic retry. `General_RetryAttemptsExceeded` specifically means Kusto **already retried** past a recurring transient error and gave up — retrying again from the application layer just repeats a failure the engine has already exhausted its patience with. At that point, treat it as effectively permanent and go find the underlying transient cause (storage throttling, a flaky network path) instead of looping retries indefinitely.

**Practice Question 1** *(Easy)*

`.show ingestion failures` returns a row with `ErrorCode = Stream_ClosingQuoteMissing` and `FailureKind = Permanent` for a CSV ingestion into an Eventhouse table. What is the most appropriate response?

A. Fix the malformed CSV source file (the closing quote is missing) before re-ingesting  
B. Retry the exact same ingestion request — permanent failures often succeed on a second attempt  
C. Increase the ingestion batching latency to give the engine more time  
D. Switch the table's update policy from transactional to non-transactional  

> [!success]- Answer
> **A. Fix the malformed CSV source file (the closing quote is missing) before re-ingesting**
>
> `Stream_ClosingQuoteMissing` is a `BadFormat` category error with `FailureKind = Permanent` — the CSV itself is malformed (an unclosed quoted field), and no amount of retrying (B), batching-latency tuning (C), or update-policy configuration (D) fixes malformed source data. The file must be corrected before it will ingest successfully.

## Streaming vs. Queued Ingestion Error Surfaces

Eventhouse supports two ingestion paths with different latency/reliability tradeoffs and, correspondingly, different places failures surface:

- **Queued ingestion** batches data through the Data Management (DM) service before committing — optimized for high throughput, with a default **batching latency** (time or size threshold, whichever hits first) before a batch commits. Failures here are visible via `.show ingestion failures` and the workspace-monitoring **Ingestion results logs** table family.
- **Streaming ingestion** commits rows with sub-second latency directly into the engine, bypassing the DM queue. Failures surface faster but through the same underlying error-code taxonomy — streaming ingestion failures still classify as Permanent/Transient the same way.

> [!warning] Common Mistake
> Confusing **batching latency** with an ingestion failure. If rows aren't queryable immediately after a queued-ingestion call, that's expected behavior — the batch hasn't committed yet, not a silent failure. Check the configured batching policy (time/size/count threshold) before assuming something broke; only escalate to `.show ingestion failures` if data is missing *after* the batching window has clearly elapsed.

## Update Policy Failure Behavior

An **update policy** on a source table automatically runs a query against newly ingested data and writes the result into one or more target tables — it's how Eventhouse implements derived/transformed tables without a separate pipeline. Update-policy failure behavior depends on whether the policy is configured as **transactional**:

| Configuration | What happens when the update-policy query fails |
| :--- | :--- |
| **Transactional** (`IsTransactional = true`) | The **entire ingestion into the source table is rolled back** — nothing commits, including the original raw data, if any transactional update policy on it fails |
| **Non-transactional** (default) | The **source table's ingestion still commits** even if the update-policy query fails; only the derived target table's write is skipped, and the failure is logged (`UpdatePolicy_IngestionError` or `UpdatePolicy_QuerySchemaDoesNotMatchTableSchema`) |

`UpdatePolicy_QuerySchemaDoesNotMatchTableSchema` is Permanent (the update-policy query's output columns don't match the target table's schema — fix the query or the target schema); `UpdatePolicy_IngestionError` and `UpdatePolicy_UnknownError` are Transient (retry-worthy, reported against the source and target table respectively).

> [!note] Mental model — transactional update policies
> A **non-transactional** update policy is a **photocopy machine attached to a filing cabinet** — if the photocopier jams, the original document still goes in the cabinet; only the copy is missing. A **transactional** update policy is a **two-part carbon-copy form** — if the carbon copy can't be produced correctly, the whole form (original included) gets rejected, because the design assumes both copies must exist together.

## Eventstream Source Connection Errors

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| **AADSTS65002** — "Fabric Eventstream isn't preauthorized to access Azure Event Hub through Azure AD" | The Eventstream service principal isn't preauthorized against that specific Event Hubs namespace at the Microsoft Entra tenant level | End users cannot self-resolve this — it requires tenant-level preauthorization; escalate to a tenant admin or Microsoft support rather than retrying connection settings |
| `EventHubNotFound` (Activator-side, but diagnostic of the same root cause) | The eventstream feeding an object was deleted, or the connection to a downstream Fabric Activator item was removed | Recreate the eventstream or reconnect the Activator object to a valid eventstream |
| `EventHubException` | Eventstream received an exception importing data from the source Event Hub | Open the eventstream, inspect the source connection configuration and recent errors |
| `UnauthorizedAccess` | Permissions on the source eventstream item changed after the downstream connection was configured | Restore the required permission on the eventstream item for the consuming identity |
| `IncorrectDataFormat` | Source data isn't in the expected JSON dictionary format | Reshape the source payload to valid JSON before it reaches the eventstream |
| Connection timeout to Azure Event Hubs | Network latency/connectivity issue between Fabric and the Event Hubs endpoint — firewall, VPN, or NSG interference | Verify no firewall/VPN/NSG is blocking the path; check Event Hubs-side throttling |

## Throughput, Throttling, and Destination Delivery Issues

Eventstream throughput problems rarely throw a hard error — they show up as **lag** (destination data arriving later than expected) or **dropped events**, diagnosed through the same two panels covered next. Common causes: an undersized Event Hubs throughput-unit allocation on the source, a destination (Lakehouse, Eventhouse) that can't sustain the incoming rate, or a downstream Eventhouse paused/scaled down between capacity changes — enabling **Eventhouse Always-On** or setting a minimum consumption unit prevents pause-triggered ingestion gaps.

## Runtime Logs and Data Insights

Eventstream exposes two monitoring panels inside its own editor (introduced in [09-Monitoring Surfaces: Eventstream Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md#eventstream-monitoring); this topic covers what each is *for* diagnostically):

| Panel | Diagnoses | Availability |
| :--- | :--- | :--- |
| **Data insights** | Throughput and status metrics for the eventstream and its sources/destinations; scoping to a specific node shows that node's metrics | Requires an Event Hubs source or Lakehouse destination for the scoped node |
| **Runtime logs** | Detailed engine-level logs at three severities — **warning**, **error**, **information** | Same source/destination requirement as Data insights |

> [!note] Mental model — Data insights vs. Runtime logs
> **Data insights** answers "**is data flowing, and how fast**" — it's the speedometer and fuel gauge. **Runtime logs** answers "**why did the engine do what it did**" — it's the engine diagnostic code reader. If the question is "did an event get dropped or transformed unexpectedly," go straight to Runtime logs; if it's "is my eventstream even receiving anything," start with Data insights.

## Common Processor Errors: Schema Drift and Type Mismatch

Eventstream's built-in transformation processors (filter, aggregate, join, manage fields) can fail or silently misbehave when the source schema changes:

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| A processor's output is missing fields that were present in earlier events | **Schema drift** — the source added, removed, or renamed a field, and the processor was configured against the old schema | Reconfigure the processor against the current schema; use the live sample view to confirm schema correctness before saving |
| A filter/aggregate condition silently never matches | **Type mismatch** — a field's type changed (e.g., string vs. numeric) between the processor's configuration and the live data | Inspect the field's live sample value/type; adjust the condition or add an explicit cast/transform upstream of the processor |
| Downstream Activator rule never fires despite data flowing | Field name typo or type mismatch between the eventstream schema and the rule's object-key mapping | Use Eventstream's live sample view and Activator's rule preview together to confirm the schema binding before troubleshooting the rule logic itself |

**Practice Question 2** *(Medium)*

A source table has a **non-transactional** update policy that writes to a derived summary table. After a schema change upstream, the update-policy query starts failing with `UpdatePolicy_QuerySchemaDoesNotMatchTableSchema`. What happens to new data arriving at the source table while this failure persists?

A. Ingestion into the source table also fails, because the update policy is part of the same transaction  
B. Ingestion pauses automatically until an administrator manually acknowledges the schema mismatch  
C. Ingestion into the source table continues to succeed; only the derived summary table stops receiving new rows  
D. The source table's ingestion succeeds, but so does the derived table's, using stale cached results  

> [!success]- Answer
> **C. Ingestion into the source table continues to succeed; only the derived summary table stops receiving new rows**
>
> A non-transactional update policy decouples the source table's ingestion from the update-policy query's success — the source table keeps ingesting normally, while the failed update-policy write is logged as `UpdatePolicy_QuerySchemaDoesNotMatchTableSchema` (Permanent) against the target. A transactional policy (A) would instead roll back the whole ingestion. There's no automatic pause-and-acknowledge workflow (B), and a non-transactional failure doesn't silently substitute stale data (D) — it simply skips the write.

**Practice Question 3** *(Easy)*

A team wants to build an automated dashboard that tracks Eventhouse ingestion success/failure trends across every table in a workspace, going back further than the 14-day retention of `.show ingestion failures`. What should they use instead?

A. Re-run `.show ingestion failures` more frequently to capture more history before it ages out  
B. Enable workspace monitoring and query the Ingestion results logs table family in the auto-provisioned monitoring Eventhouse  
C. Export the Capacity Metrics app's Compute page to a Power BI report  
D. Increase the source table's batching latency policy to retain more history  

> [!success]- Answer
> **B. Enable workspace monitoring and query the Ingestion results logs table family in the auto-provisioned monitoring Eventhouse**
>
> `.show ingestion failures` is capped at 14 days and only covers management-command failures; workspace monitoring's Ingestion results logs table family (see [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md#eventhouse-ingestion-monitoring)) is the durable, KQL-queryable, cross-table history built for exactly this dashboard use case. Re-running the command more often (A) doesn't extend its retention window, the Capacity Metrics app (C) is CU/throttling-focused rather than ingestion-status-focused, and batching latency (D) controls commit timing, not diagnostic retention.

## Diagnosing via Workspace Monitoring KQL

For failures beyond the 14-day window or spanning multiple tables/databases at once, query the monitoring Eventhouse's **Ingestion results logs** table directly instead of the per-database `.show ingestion failures` command:

```kql
IngestionResultsLogs
| where Timestamp > ago(7d)
| where Result == "Failure"
| summarize FailureCount = count() by Table, FailureKind, ErrorCode
| order by FailureCount desc
```

This pattern — aggregate by `Table`, `FailureKind`, and `ErrorCode` over a rolling window — is the fastest way to spot a table that's silently accumulating permanent failures (a broken upstream mapping, for example) versus one with a transient blip that resolved itself. Pair it with the **Command logs** and **Data operation logs** table families when a failure seems to originate from a management command (like a manual `.ingest` or schema change) rather than the normal ingestion pipeline.

## Use Cases

- Filtering `.show ingestion failures` by `FailureKind == "Permanent"` to find issues that need a data/config fix rather than a retry
- Explaining to a data owner why raw data kept landing even though a derived summary table stopped updating (non-transactional update policy)
- Diagnosing "Eventstream can't connect to my Event Hub" as a tenant-level AADSTS65002 preauthorization gap rather than a wrong connection string
- Distinguishing normal queued-ingestion batching latency from an actual silent ingestion failure
- Using Eventstream's live sample view to catch schema drift before a downstream processor or Activator rule silently stops matching

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Ingestion keeps failing on retry with the same error | `FailureKind = Permanent` — retrying doesn't change a bad format, missing entity, or authorization problem | Fix the underlying data/config issue identified in `Details`/`ErrorCode` before re-ingesting |
| Derived table is empty or stale while the source table has current data | Non-transactional update policy silently failing on the query (schema mismatch) | Check `.show ingestion failures` filtered to `OriginatesFromUpdatePolicy == true`; fix the update-policy query or target schema |
| Eventstream shows connected but no data appears in the destination | Data insights shows zero throughput at the source node — check upstream Event Hubs configuration and firewall/NSG rules | Verify Event Hubs throughput-unit allocation and network path; confirm AADSTS65002 isn't blocking the connection |
| A processor condition that used to match stops matching after a source change | Schema drift or a type change in the field the processor evaluates | Use the live sample view to confirm current field name/type; update the processor configuration |
| Data appears in Eventhouse later than expected but isn't missing | Normal queued-ingestion batching latency, not a failure | Check the batching policy threshold before escalating; use streaming ingestion if sub-second latency is required |

## Best Practices

- Query `.show ingestion failures` with a `FailureKind` filter as the first triage step, not the raw unfiltered table
- Use transactional update policies only when the derived table's correctness is a hard requirement for the source data to be considered "landed" — non-transactional is the safer default for most derived/summary tables
- Enable Eventhouse Always-On or set a minimum consumption unit for any Eventhouse feeding time-sensitive Eventstream destinations
- Validate schema with the live sample view before saving any Eventstream processor, not after it starts silently under-matching
- Escalate AADSTS65002 to a tenant admin immediately rather than repeatedly reconfiguring the eventstream's connection settings

## Exam Tips

> [!tip] Exam Tips
>
> - `.show ingestion failures`: **`FailureKind`** is `Permanent` or `Transient`; **14-day** retention; command-level only — pair with metrics/diagnostic logs for full-stage coverage
> - Error category families to recognize: **BadFormat, BadRequest, DataAccessNotAuthorized, DownloadFailed, EntityNotFound, FileTooLarge, InternalServiceError, UpdatePolicyFailure, ThrottledOnEngine**
> - `General_RetryAttemptsExceeded` means the platform already retried and gave up — don't keep retrying at the application layer
> - Transactional update policy = source **and** target rollback together on failure; non-transactional = source commits, only the target write is skipped
> - **AADSTS65002** = Eventstream not preauthorized to an Event Hub at the tenant level — not end-user fixable
> - Eventstream monitoring split: **Data insights** = throughput/status; **Runtime logs** = engine-level detail at **warning/error/information** severities

## Key Takeaways

- `FailureKind` is the single most important field in `.show ingestion failures` — it decides whether retry is even worth attempting
- Update-policy transactionality determines blast radius: transactional policies can block otherwise-healthy raw ingestion, non-transactional policies isolate the failure to the derived table
- Eventstream connection failures like AADSTS65002 are frequently tenant-level authorization gaps, not per-user misconfiguration
- Batching latency in queued ingestion is expected behavior, not a failure state — check the policy threshold before troubleshooting
- Data insights and Runtime logs answer different questions (flow/throughput vs. engine-level cause) — picking the right one first saves diagnostic time

## Related Topics

- [09-Monitoring Surfaces: Eventhouse Ingestion Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md#eventhouse-ingestion-monitoring)
- [08-Streaming Data: Eventstreams](../08-streaming-data/02-eventstreams.md)
- [08-Streaming Data: KQL Real-Time](../08-streaming-data/04-kql-realtime.md)
- [02-Notebook and T-SQL Errors](./02-notebook-tsql-errors.md)
- [04-Shortcut Errors](./04-shortcut-errors.md)

## Official Documentation

- [.show ingestion failures command - Kusto](https://learn.microsoft.com/en-us/kusto/management/ingestion-failures?view=microsoft-fabric)
- [Ingestion error codes - Azure Data Explorer](https://learn.microsoft.com/en-us/azure/data-explorer/error-codes)
- [Troubleshooting errors in Activator](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-troubleshooting)
- [Eventstream Workspace Monitoring Overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/fabric-workspace-monitoring)
- [Monitor the status and performance of an eventstream](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/monitor)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-notebook-tsql-errors.md) | [↑ Back to Section](./error-resolution.md) | [Next →](./04-shortcut-errors.md)**
