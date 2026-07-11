---
title: Pipeline and Dataflow Gen2 Errors
type: topic
tags:
  - dp-700
  - fabric
  - error-resolution
  - pipelines
  - dataflow-gen2
  - power-query
  - throttling
  - oauth
---

# Pipeline and Dataflow Gen2 Errors

## Overview

Pipeline and Dataflow Gen2 are the two most common places a Domain 3 exam scenario starts: an activity fails with a specific error code, or a dataflow refresh dies partway through. This topic covers how to read a pipeline activity's failure output, the error classes the exam names by category (connection/auth, staging, timeout, throttling, parameter/expression), the built-in recovery actions, and Dataflow Gen2's refresh diagnostics and Power Query error vocabulary.

> [!abstract]
>
> - Every failed pipeline activity produces an **Output JSON** with `errorCode`, `message`, `failureType` (`UserError` or `SystemError`), and `target` — read this before opening any other surface
> - **OAuth/token-related failures** cluster around expiry: Databricks tokens (90-day default), `LSROBOTokenFailure` (Conditional Access/password change), and gateway-based connections all fail with distinct messages that point to different fixes
> - **Throttling** shows up as HTTP 429/430 or error code 2003 (subscription-level concurrency); Dataflow Gen2 has its own 300-refreshes-per-24-hours limit plus burst protection
> - **Rerun from failed activity** (not a full rerun) is the fastest recovery path for a partial pipeline failure — see [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md) for where to trigger it
> - Dataflow Gen2's three Power Query error families — `DataFormat.Error`, `DataSource.Error`, `Expression.Error` — map to different root causes: bad source data, connectivity/gateway, and mashup logic, respectively

> [!tip] What the Exam Tests
>
> - Reading a pipeline activity's error output and matching `errorCode`/`failureType` to the right fix category
> - Distinguishing throttling/capacity errors from genuine authentication or configuration errors that look similar
> - Knowing which Dataflow Gen2 failure needs the gateway fixed vs. the mashup query fixed vs. the staging Lakehouse permissions fixed
> - Recognizing when a firewall/port issue (specifically port 1433) is the actual root cause behind a generic "network-related" Dataflow Gen2 error

---

## Reading the Pipeline Activity Failure Output

Every pipeline activity that fails writes an **Output** JSON payload, visible from the activity's monitoring row (select **Output** next to the run — see [09-Monitoring Surfaces: Pipeline Run and Activity Monitoring](../09-monitoring-alerting/01-monitoring-surfaces.md#pipeline-run-and-activity-monitoring)). The payload follows a consistent shape:

```json
{
  "errorCode": "InvalidTemplate",
  "message": "The template function 'dataset' is not defined or not valid.",
  "failureType": "UserError",
  "target": "Copy_DeltaData"
}
```

| Field | Meaning |
| :--- | :--- |
| `errorCode` | A short machine-readable identifier for the failure class (for example `InvalidTemplate`, or a numeric connector code like `2003`) |
| `message` | The human-readable description — often includes the exact bad value or a suggestion |
| `failureType` | `UserError` (fix the pipeline/config) or `SystemError` (transient, usually safe to retry) |
| `target` | The activity name that failed, useful when the failure originates several activities deep in a `ForEach` or nested pipeline |

You can also build a custom failure with the **Fail activity**, which lets you set your own `errorCode` and `message` — these values then appear in run history and logs exactly like a system-generated failure, which is how conditional data-validation failures get a meaningful message instead of a generic downstream error.

> [!note] Mental model — errorCode vs. failureType
> `failureType` is the **triage tag** — it tells you who owns the fix (you, or "try again"). `errorCode` is the **specific complaint** — it tells you what to fix. Always check `failureType` first: a `SystemError` on a transient network blip doesn't need a pipeline edit, just a rerun.

## Connection, Authentication, and Gateway Errors

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| ==`LSROBOTokenFailure`== — "Access has been blocked by Conditional Access policies" / "provided grant has expired" | The pipeline's stored refresh token can no longer get a new access token — the user's device left the tenant, password changed, or Conditional Access requirements changed | Update and save the affected pipeline (refreshes its auth context) using the Fabric portal or the [linked PowerShell scripts](https://github.com/microsoft/fabric-samples/blob/main/docs-samples/data-factory/update-few-pipelines.ps1) for bulk updates |
| Databricks **Error code: 3200** — "Error 403... The Databricks access token has expired" | Azure Databricks access tokens default to a 90-day validity | Generate a new Databricks token and update the connection |
| Databricks **Error code: 3208** — "An error occurred while sending the request" | Network connection to the Databricks service was interrupted | Verify network reliability from the runtime; usually resolves on retry |
| Web activity **Error Code: 2403** — "Get access token from MSI failed" | The resource URL provided for a managed-identity token request is wrong or unreachable | Verify the resource URL matches what the managed identity is scoped to |
| Dataflow Gen2 gateway refresh — "A network-related or instance-specific error occurred... TCP Provider, error: 0" | On-premises gateway can't reach the **dataflow staging Lakehouse** over **port 1433** (TDS protocol) — usually a firewall/proxy blocking outbound TCP on that port | Open outbound TCP 1433 to `*.datawarehouse.pbidedicated.windows.net`, `*.datawarehouse.fabric.microsoft.com`, `*.dfs.fabric.microsoft.com` on the gateway server; or combine referencing queries / disable staging as a workaround |

> [!warning] Common Mistake
> Treating every "network-related error" from a gateway-based Dataflow Gen2 refresh as a general connectivity problem. The dataflow engine writes to a Lakehouse over HTTPS (port 443) but **reads staged data back over TDS (port 1433)** — so the *first* query in a chain can succeed while a query that *references* it fails, even though both point at the same OneLake instance. Many corporate proxies pass generic HTTP/TCP traffic but don't support the TDS protocol at all, which is why "combine the queries" or "disable staging" are documented workarounds, not just firewall fixes.

## Staging, Timeout, and Throttling Errors

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| Dataflow Gen2 — "The dataflow refresh failed due to insufficient permissions for accessing staging artifacts" | The user who created the **first** dataflow in the workspace hasn't signed in for 90+ days, or has left the organization | That user signs back into Fabric; if they've left, open a support ticket |
| Dataflow Gen2 — "The key didn't match any rows in the table" (via the Dataflows connector) | Intermittent timeout in the internal API a downstream item uses to read a Dataflow Gen2's results through the **Dataflows connector** — a misleading message, not missing data | Configure a data destination (Lakehouse/Warehouse) on the source dataflow and have downstream items read directly from OneLake instead of through the Dataflows connector |
| Web activity **Error Code: 2003** — "substantial concurrent external activity executions... causing failures due to throttling" | Too many pipelines triggered concurrently against the same subscription/region limit | Reduce concurrency; stagger trigger times across pipelines |
| Capacity — `CapacityLimitExceeded` / "Your organization's Fabric compute capacity has exceeded its limits" | The capacity moved past throttling into the **rejection phase** — not enough resources to admit the operation | Use the Capacity Metrics app's Compute/Timepoint pages to find the consuming item (see [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md#capacity-metrics-app-the-admin-side-view)); scale up, enable autoscale, or reschedule the offending job |
| Web activity **Error Code: 2001/2002** — payload/output size limits | Activity output exceeds ~4 MB, or the combined activity/data/connection payload exceeds 896 KB | Reduce the size of parameter values passed between activities; avoid passing large data through control-flow parameters |
| **"Activity stuck"** — a run shows barely any progress for far longer than normal | The activity (often Copy or Data Flow) has stalled | Cancel and retry; for Copy activities, check performance-tuning guidance in [11-Performance Optimization](../11-performance-optimization/performance-optimization.md) |

Dataflow Gen2 refresh limits worth memorizing for throttling scenarios: ==up to 300 refreshes per 24-hour rolling window== (150 for non-CI/CD dataflows), a single query evaluation capped at 8 hours, total refresh time capped at 24 hours, and a max of 50 staged/output-destination queries per dataflow. A short burst of refresh requests (many within 60 seconds) can trigger throttling even when the daily total is well under the cap. Three consecutive scheduled-refresh failures over a defined window (72 hours with 100% failure and ≥6 attempts, or 168 hours with 100% failure and ≥5 attempts) pauses the schedule automatically and emails the dataflow owner.

## Parameter and Expression Errors

| Error / message | Cause | Resolution |
| :--- | :--- | :--- |
| Web activity **Error Code: 2105** — "The value type '...' is not expected type '...'" | Dynamic content expression produces data that doesn't match the key's expected JSON type | Fix the dynamic content expression to produce the correct type |
| "the result of the evaluation of 'foreach' expression ... is of type 'String'. The result must be a valid array" | An **Execute Pipeline** activity parameter typed as array is actually passed to the child pipeline as a string | Wrap the value with the `createArray()` expression function before passing it to the child pipeline |
| Common **Error code: 2103/2104/2105** (connector-agnostic) | Missing required property, wrong property type, or malformed JSON in an activity/connection definition | Match the value to the documented type and required-property list for that connector |

**Practice Question 1** *(Easy)*

A pipeline activity fails, and its Output JSON shows `"failureType": "SystemError"` with an `errorCode` referencing a transient download error from Azure Storage. What is the most appropriate first action?

A. Rewrite the copy activity's source dataset definition  
B. Escalate directly to Microsoft Support before attempting a rerun  
C. Delete and recreate the linked service credentials  
D. Retry the activity — `SystemError` failures are typically transient  

> [!success]- Answer
> **D. Retry the activity — SystemError failures are typically transient**
>
> `failureType: SystemError` signals a platform/transient issue rather than a pipeline authoring mistake, and this one (a transient download failure) is typically recoverable without any config change. Rewriting the dataset (A) or credentials (C) targets a `UserError` scenario instead, and jumping straight to support (B) skips the cheapest, usually-successful first step: rerun.

## Other Connector-Specific Error Codes

The pipeline troubleshooting guide documents dozens of connector-specific numeric codes beyond the connection/throttling classes above. The exam is more likely to test the *pattern* (a numeric `errorCode` range belongs to one connector family, with consistent cause/fix pairs) than any single code, but these are representative:

| Connector | Error code | Message pattern | Cause |
| :--- | :--- | :--- | :--- |
| Azure Functions | 3603 | "Response Content is not a valid JObject" | The called function didn't return a JSON payload — Fabric Function activities only support JSON responses |
| Azure Functions | 3608 | "Call to provided Azure function '...' failed with status-'...'" | The function itself returned an error status — check the function's own logs |
| Azure Batch | 2502 | "Cannot access user storage account; please check storage account settings" | Incorrect storage account name or access key in the Batch connection |
| Azure Batch | 2507 | "The folder path does not exist or is empty" | No executable files exist at the specified `folderPath` in the storage account |
| Azure Machine Learning | 4121 | "Request sent to Azure Machine Learning... failed with http status code..." | The credential used to access Azure ML has expired |
| Azure Machine Learning | 4124 | Same pattern, different underlying cause | The published Azure ML pipeline endpoint referenced by the connection doesn't exist |

> [!note] Mental model — numeric error-code ranges
> Fabric pipeline error codes are **zip-coded by connector**: the 3200s belong to Azure Databricks, the 3600s to Functions, the 4100s to Azure Machine Learning, and so on. You don't need to memorize every code, but recognizing *which family* a code belongs to immediately narrows the fix to that connector's documented cause/recommendation pairs instead of a blind guess.

## Recovery Actions: Rerun and Retry

Pipeline monitoring supports **rerun the entire pipeline** or **rerun only from the failed activity** — the latter skips every activity that already succeeded and resumes exactly where the failure occurred. This is covered in depth in [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md#pipeline-run-and-activity-monitoring); the error-resolution angle is knowing *when* it's safe to use: rerun-from-failure assumes upstream activities are idempotent or wrote data that shouldn't be duplicated by a second full pass. For non-idempotent sinks (an append-only Copy activity with no dedup logic, for example), rerunning from failure avoids the duplicate-write risk a full rerun would introduce.

Activities also support built-in **retry** configuration (retry count and interval) set on the activity's **General** tab — this is separate from a manual rerun and fires automatically without leaving the pipeline run. Configure retry for activities calling flaky external systems (a REST API with occasional 5xx responses); it isn't a substitute for fixing a genuinely broken configuration, since a `UserError` will simply fail the same way on every retry attempt.

## Dataflow Gen2 Refresh Diagnostics

For any Dataflow Gen2 failure beyond what the refresh history summary shows, **Download detailed logs** on the run's detail screen returns a zipped bundle of mashup-engine logs — available a few minutes after the refresh completes, retained for 28 days, and the standard artifact to attach to a Microsoft support case. Gateway-based refreshes need **Admin consent for gateway diagnostics** enabled at both the tenant and gateway level before this button works.

Refresh cancellation has different outcomes by destination type: a query loading to **staging** keeps the data from the last successful refresh if cancelled mid-run, while a query loading to a **data destination** (Lakehouse/Warehouse) keeps whatever was written up to the cancellation point.

## Query Folding Failures

**Query folding** pushes Power Query transformation steps back to the source system (SQL pushdown, for example) instead of pulling all rows into the mashup engine and transforming locally. A folding failure isn't usually a hard error — the dataflow still refreshes successfully — but performance degrades sharply because every transformation step now runs client-side against the full unfiltered dataset. Common folding breakers: a custom column using an M function without a source-side equivalent, mixing data from two different connections in one query, or a `Table.Buffer` call that intentionally materializes the table and stops folding from that point forward.

> [!warning] Common Mistake
> Treating a query-folding break as an *error* to resolve here rather than a *performance* problem. Folding failures don't throw `DataFormat.Error` or `DataSource.Error` — the refresh succeeds, just slower. If a Dataflow Gen2 refresh is taking far longer than its historical average (visible on the Monitoring hub dashboard — see [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md#dataflow-gen2-refresh-history-and-diagnostics)) with no error in the run, suspect folding loss and check the query's step-by-step Power Query diagnostics rather than looking for a message in refresh history. See [11-Performance Optimization: Dataflow Gen2 Query Folding](../11-performance-optimization/05-pipeline-query-optimization.md#dataflow-gen2-query-folding-performance-framing) for the prevention-side tuning guidance.

## Power Query Error Patterns

Dataflow Gen2 authoring and refresh failures surface through three recurring Power Query error prefixes:

| Error family | What it means | Typical trigger |
| :--- | :--- | :--- |
| **`DataFormat.Error`** | The data doesn't match the shape/type Power Query expected | An older file type (`.xls`/`.xlsb` instead of `.xlsx`/CSV); a value like `#N/A` that can't convert to the target column type during **"We couldn't convert to Number"**-style failures |
| **`DataSource.Error`** | The connection to the source or destination itself failed | "Unable to read data from the transport connection: An existing connection was forcibly closed by the remote host" (intermittent network drop); a gateway that isn't configured to reach the destination directly |
| **`Expression.Error`** | The M expression/mashup logic itself is invalid | A referenced step or column no longer exists, a type mismatch inside a custom M function, or a syntax error introduced by manual M edits |

For `DataFormat.Error` on a specific row, select all columns in the dataflow editor and use **Keep Rows → Keep Errors** to isolate exactly which rows are malformed before deciding whether to filter, transform, or fix them at the source. For intermittent `DataSource.Error` failures, enable **verbose diagnostics** in the dataflow's settings to capture detailed tracing for the specific failure window.

**Practice Question 2** *(Medium)*

A Dataflow Gen2 configured with an on-premises data gateway refreshes successfully for a query that writes to a Lakehouse, but a second query that references the first query's staged output fails with a "TCP Provider" network error, even though both Lakehouses share the same OneLake instance. What's the most likely root cause?

A. The referencing query needs outbound TCP port 1433 open on the gateway  
B. The gateway's Microsoft Entra credentials expired between the two queries  
C. The staging Lakehouse ran out of OneLake storage capacity mid-refresh  
D. Query folding failed silently on the referencing query  

> [!success]- Answer
> **A. The referencing query needs outbound TCP port 1433 open on the gateway**
>
> Writing to a Lakehouse uses HTTPS (443), but reading staged data back for a referencing query uses the TDS protocol over port 1433, which the firewall is currently blocking — this is exactly why the first query can succeed while a dependent query fails with a TCP-level error. Credential expiry (B) would fail both queries identically, storage capacity (C) would show a capacity error, and folding failures (D) degrade performance rather than throwing a network exception.

**Practice Question 3** *(Easy)*

A Dataflow Gen2 refresh fails with `DataFormat.Error` referencing "We couldn't convert to Number" on a specific column. What is the fastest way to isolate exactly which rows are causing the failure?

A. Download the detailed refresh logs and manually search the zipped mashup files for the row  
B. Delete the offending column from the query entirely  
C. Select all columns in the dataflow editor and apply Keep Rows → Keep Errors to surface only the malformed rows  
D. Switch the query's data source connection to use a gateway  

> [!success]- Answer
> **C. Select all columns in the dataflow editor and apply Keep Rows → Keep Errors to surface only the malformed rows**
>
> "Keep Errors" is the purpose-built Power Query technique for isolating exactly which rows fail a type conversion without guessing — it's faster and more precise than manually searching downloaded logs (A), and neither deleting the column (B) nor changing the connection type (D) addresses a `DataFormat.Error` caused by bad values in the source data itself.

## Symptom → Likely Error Class

| Symptom | Most likely class | Where to look first |
| :--- | :--- | :--- |
| Pipeline that ran fine for months suddenly fails with no pipeline changes | Stale auth token (`LSROBOTokenFailure`, Databricks token expiry) | Activity Output JSON `message`, then update/save the pipeline |
| Same dataflow query succeeds standalone but fails when another query references its staged output | Gateway port 1433 blocked | Gateway server firewall rules |
| Many pipelines start failing around the same time, all with throttling-flavored messages | Error 2003 or `CapacityLimitExceeded` | Capacity Metrics app Compute/Timepoint pages |
| Dataflow refresh duration creeping upward with no error in refresh history | Query folding silently lost | Power Query step-by-step diagnostics, not refresh history |
| A specific row/value breaks refresh every time | `DataFormat.Error` | Keep Rows → Keep Errors in the dataflow editor |

## Use Cases

- Reading a failed activity's Output JSON to distinguish a `SystemError` worth retrying from a `UserError` requiring a pipeline edit
- Diagnosing a gateway-based Dataflow Gen2 refresh failure down to the specific port/protocol requirement instead of guessing at "network issues"
- Choosing rerun-from-failed-activity over a full rerun when a non-idempotent sink is involved
- Isolating malformed source rows behind a `DataFormat.Error` using Keep Errors instead of debugging the whole dataflow
- Recognizing throttling (2003, `CapacityLimitExceeded`, the 300-refreshes/24h cap) as a capacity problem rather than a broken pipeline

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Pipeline fails intermittently with no pipeline changes | `LSROBOTokenFailure` — stored refresh token invalidated by a password change, device removal, or Conditional Access policy update | Update and save the pipeline to refresh its auth context; use the bulk-update script for many affected pipelines |
| Dataflow refresh fails only when a second query references a first query's staged output | Gateway firewall blocking outbound TCP 1433 needed for the TDS read-back | Open port 1433 to the documented staging endpoints, or combine/de-stage the referencing queries |
| Downstream item reading a Dataflow Gen2 via the Dataflows connector intermittently reports "key didn't match any rows" | Internal API timeout, not missing data | Point downstream items at the dataflow's Lakehouse/Warehouse data destination instead of the Dataflows connector |
| Scheduled dataflow refresh silently stops running | 100% failure rate over a 72h/168h window auto-paused the schedule | Fix the underlying failure, then manually re-enable the schedule |
| Activity output shows a generic connector error code with no obvious fix | Numeric `errorCode` maps to a documented connector-specific cause/recommendation pair | Look up the exact code in the [pipeline troubleshooting guide](https://learn.microsoft.com/en-us/fabric/data-factory/pipeline-troubleshoot-guide) rather than guessing from the message alone |

## Best Practices

- Read `failureType` before `errorCode` — it tells you whether a rerun is likely to help before you spend time investigating
- Configure activity-level retry for calls to external systems with known transient failure modes; don't rely on manual reruns for routine flakiness
- Prefer a Lakehouse/Warehouse data destination over the Dataflows connector for any downstream item that reads a Dataflow Gen2's output — it sidesteps the internal API timeout failure mode entirely
- Enable Admin consent for gateway diagnostics proactively, before you need Download detailed logs during an incident
- Treat a Dataflow Gen2 refresh-duration regression with no error as a query-folding investigation, not a "wait and see"

## Exam Tips

> [!tip] Exam Tips
>
> - Pipeline activity output JSON fields to recognize: **`errorCode`, `message`, `failureType`, `target`** — `failureType` is `UserError` or `SystemError`
> - `LSROBOTokenFailure` = stored refresh token invalidated (Conditional Access, password change, device removal) — fix by updating/saving the pipeline
> - Gateway + Dataflow Gen2 staging read-back needs **TCP port 1433**; writing uses HTTPS 443 — this asymmetry explains "first query succeeds, referencing query fails"
> - Dataflow Gen2 refresh limits: **300/24h** (CI/CD), **150/24h** (non-CI/CD), 8h per query evaluation, 24h total refresh, 50 staged/destination queries max
> - Three Power Query error families: **`DataFormat.Error`** (bad data shape), **`DataSource.Error`** (connectivity), **`Expression.Error`** (bad M logic)
> - **Rerun from failed activity** skips already-succeeded work; built-in **retry** (count/interval) is a separate, automatic per-activity setting

## Key Takeaways

- A pipeline activity's Output JSON is the first and fastest diagnostic surface — `failureType` triages whether a rerun is worth trying before digging further
- Most "network error" Dataflow Gen2 failures through a gateway trace back to a specific missing port (1433) rather than a generic connectivity problem
- Throttling and capacity-limit errors (2003, `CapacityLimitExceeded`, HTTP 430) are capacity problems solved via the Capacity Metrics app, not pipeline bugs
- Query folding failures degrade performance without producing an error — don't search refresh history for a message that won't be there
- `DataFormat.Error`, `DataSource.Error`, and `Expression.Error` each point to a different layer of the problem: data, connection, or logic

## Related Topics

- [09-Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md)
- [02-Notebook and T-SQL Errors](./02-notebook-tsql-errors.md)
- [01-Fabric Workspace Settings: OneLake Settings](../01-fabric-workspace-settings/03-onelake-settings.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Official Documentation

- [Troubleshoot pipelines for Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/pipeline-troubleshoot-guide)
- [Fail activity](https://learn.microsoft.com/en-us/fabric/data-factory/fail-activity)
- [Dataflow Gen2 refresh](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-refresh)
- [On-premises and virtual network data gateway considerations for data destinations in Dataflow Gen2](https://learn.microsoft.com/en-us/fabric/data-factory/gateway-considerations-output-destinations)
- [Troubleshooting guide - Diagnose and resolve "capacity limit exceeded" errors](https://learn.microsoft.com/en-us/fabric/enterprise/capacity-planning-troubleshoot-errors)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../09-monitoring-alerting/03-activator-alerts.md) | [↑ Back to Section](./error-resolution.md) | [Next →](./02-notebook-tsql-errors.md)**
