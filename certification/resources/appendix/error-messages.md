---
title: DP-700 Error Messages
type: resources
tags:
  - dp-700
  - errors
  - troubleshooting
  - reference
---

# Error Messages

A consolidated error reference across every surface [10-error-resolution](../../10-error-resolution/error-resolution.md) covers: pipelines, Dataflow Gen2, notebook/Spark, T-SQL Warehouse, Eventhouse, Eventstream, and OneLake shortcuts. Every code and message below is already documented in the linked section files — this page only re-groups them by surface for fast lookup; it does not introduce new codes.

> [!abstract] TL;DR
>
> - One table per surface: pipeline, Dataflow Gen2, notebook/Spark, T-SQL, Eventhouse, Eventstream, shortcuts
> - Each row maps an error string/code to its cause and fix — the full worked explanation lives in the linked topic file
> - Focus on `failureType` (pipeline), Spark exit codes, snapshot-isolation conflicts (24556/24706), `FailureKind` (Eventhouse), and 401/403/404 (shortcuts) — these are the highest-yield facts in this domain

## Table of Contents

- [[#Pipeline]]
- [[#Dataflow Gen2]]
- [[#Notebook / Spark]]
- [[#T-SQL (Warehouse)]]
- [[#Eventhouse]]
- [[#Eventstream]]
- [[#Shortcuts]]

---

## Pipeline

Every failed pipeline activity writes an **Output** JSON with `errorCode`, `message`, `failureType` (`UserError` or `SystemError`), and `target` — check `failureType` before `errorCode`.

| Error / Code | Cause | Fix |
| :--- | :--- | :--- |
| `LSROBOTokenFailure` | Stored refresh token invalidated by Conditional Access, a password change, or device removal | Update and save the pipeline to refresh its auth context; bulk-update script for many pipelines |
| Databricks **3200** — "access token has expired" | Azure Databricks tokens default to 90-day validity | Generate a new Databricks token and update the connection |
| Databricks **3208** | Network connection to Databricks was interrupted | Verify network reliability; usually resolves on retry |
| Web activity **2403** — "Get access token from MSI failed" | Wrong or unreachable resource URL for a managed-identity token request | Verify the resource URL matches the managed identity's scope |
| Web activity **2003** — throttling | Too many pipelines triggered concurrently against the same subscription/region limit | Reduce concurrency; stagger trigger times |
| `CapacityLimitExceeded` | Capacity moved past throttling into rejection — no resources to admit the operation | Use Capacity Metrics app to find the consuming item; scale up, autoscale, or reschedule |
| Web activity **2001/2002** | Activity output exceeds ~4 MB, or combined payload exceeds 896 KB | Reduce parameter value size; avoid passing large data through control-flow parameters |
| Web activity **2105** | Dynamic content expression produces the wrong JSON type | Fix the expression to produce the expected type |
| "the result of 'foreach' ... is of type 'String'. The result must be a valid array" | An Execute Pipeline array parameter is passed as a string | Wrap the value with `createArray()` before passing it |
| **2103/2104/2105** (connector-agnostic) | Missing required property, wrong type, or malformed JSON in an activity/connection definition | Match the documented type/required-property list for that connector |
| Azure Functions **3603** | Function didn't return a JSON payload | Fabric Function activities only support JSON responses |
| Azure Functions **3608** | The function itself returned an error status | Check the function's own logs |
| Azure Batch **2502** | Incorrect storage account name/access key in the Batch connection | Fix the storage account settings |
| Azure Batch **2507** | No executable files at the specified `folderPath` | Verify the folder path in the storage account |
| Azure ML **4121** | Credential used to access Azure ML has expired | Refresh the credential |
| Azure ML **4124** | Published Azure ML pipeline endpoint doesn't exist | Verify the endpoint reference |

**Source:** [10-Error Resolution: Pipeline and Dataflow Gen2 Errors](../../10-error-resolution/01-pipeline-dataflow-errors.md)

---

## Dataflow Gen2

| Error / Message | Cause | Fix |
| :--- | :--- | :--- |
| "A network-related or instance-specific error occurred... TCP Provider, error: 0" | Gateway can't reach the staging Lakehouse over TDS **port 1433** | Open outbound TCP 1433 to the documented staging endpoints; or combine referencing queries / disable staging |
| "The dataflow refresh failed due to insufficient permissions for accessing staging artifacts" | The creator of the workspace's first dataflow hasn't signed in for 90+ days, or has left the org | That user signs back in; if they've left, open a support ticket |
| "The key didn't match any rows in the table" (via the Dataflows connector) | Intermittent internal-API timeout reading a Dataflow Gen2's results — a misleading message, not missing data | Configure a Lakehouse/Warehouse data destination and read directly from OneLake instead of the Dataflows connector |
| `DataFormat.Error` | Data doesn't match the shape/type Power Query expected | Use **Keep Rows → Keep Errors** to isolate the malformed rows |
| `DataSource.Error` | Connection to the source or destination failed | Check gateway configuration; enable verbose diagnostics for intermittent failures |
| `Expression.Error` | The M expression/mashup logic itself is invalid | Check for a missing referenced step/column, a type mismatch, or a manual-edit syntax error |

Refresh limits worth memorizing: **300/24h** (CI/CD dataflows), **150/24h** (non-CI/CD), 8h per query evaluation, 24h total refresh, 50 staged/destination queries max.

**Source:** [10-Error Resolution: Pipeline and Dataflow Gen2 Errors](../../10-error-resolution/01-pipeline-dataflow-errors.md)

---

## Notebook / Spark

| Error / Code | Cause | Fix |
| :--- | :--- | :--- |
| `TooManyRequestsForCapacity` (**HTTP 430**) | Capacity's available Spark VCores are fully consumed | Cancel a job via Monitor hub, wait for the queue, choose a larger SKU, or enable Autoscale Billing |
| **403 Forbidden** — "requires ReadAll permission" | Missing workspace role or item-level `ReadData`/`ReadAll` permission | Grant Contributor+ role and **ReadAll** (not just ReadData) for Spark |
| `SparkContextInitializationTimedOut` | Driver failed to initialize in time — large custom libraries or resource contention | Reduce custom library count/size; verify free capacity; check VNet/private-endpoint delays |
| `SparkSubmitProcessTimedOut` / `PersonalizationFailed` | `spark-submit` took too long, or custom environment setup failed | Reduce large custom libraries; remove recently added packages one at a time |
| `Spark_System_YARNApplication_KilledByTrustedServiceUser` (exit code **13**) | Invalid Spark configuration killed the session on startup | Review `%%configure` values (e.g. `spark.rpc.message.maxSize` must be a plain integer, capped at 2047 MB) |
| Exit code **137** | `SIGKILL` — out of memory | Diagnose driver vs. executor OOM (collect/toPandas vs. skew/partitioning) before adding memory |
| Exit code **143** | `SIGTERM` — timeout, preemption, or benign dynamic-allocation scale-down | Usually not an error to fix |
| Exit code **134** | `SIGABRT` — JVM crash or native memory corruption | Investigate native library / memory corruption |
| Exit code **1** | General error — user code exception, misconfiguration, missing dependency | Read the stack trace in Driver/Livy logs |
| Exit code **-100** | Container preempted/lost | Node preemption or platform-side container loss |
| `AnalysisException` — "Table or view not found" | Typo, missing table, or expired temp view | Check spelling/case; use fully-qualified `catalog.schema.table` |
| `AnalysisException` — `[UNRESOLVED_COLUMN.WITH_SUGGESTION]` | Column not found | Compare against `df.printSchema()`; check for an upstream rename/drop |
| `AnalysisException` — `[AMBIGUOUS_REFERENCE]` | Same column name from two joined tables | Qualify the column with its table alias |
| `AnalysisException` — data type mismatch | Comparing/joining incompatible types | Explicitly `.cast()` to a common type |
| `AnalysisException` — schema mismatch on write | DataFrame schema doesn't match the target Delta table | Compare `df.printSchema()` vs. `DESCRIBE`; align, or use `.option("mergeSchema", "true")` |
| `Spark_User_Conda_PipFailed` | Library install failed during environment setup | Verify the package on PyPI; remove version pins; check pre-installed package list |
| `Spark_System_MetaStore_HiveException` — "lock acquisition timed out" | Concurrent DDL from multiple sessions against the same table | Avoid concurrent DDL on one table; retry after the other session completes |
| `Spark_Ambiguous_UserApp_NullPointer` | Null values reaching a UDF, missing dict key, or wrong-object API call | Filter nulls before UDF calls; use `.get(key, default)` |
| `INCONSISTENT_BEHAVIOR_CROSS_VERSION` | Spark 3.0+ Proleptic Gregorian calendar shift on historical dates | Set `datetimeRebaseModeInRead/Write` to `CORRECTED`, but validate on a sample first |

**Source:** [10-Error Resolution: Notebook and T-SQL Errors](../../10-error-resolution/02-notebook-tsql-errors.md)

---

## T-SQL (Warehouse)

Fabric Warehouse uses **snapshot isolation exclusively**; unsupported syntax includes `BULK LOAD`, `CREATE USER`, materialized views, `PREDICT`, recursive queries, `SELECT...FOR XML`, `SET ROWCOUNT`, `SET TRANSACTION ISOLATION LEVEL`, `sp_showspaceused`, synonyms, triggers, and the vector data type/search functions.

| Error / Code | Cause | Fix |
| :--- | :--- | :--- |
| `SET TRANSACTION ISOLATION LEVEL` runs but has no effect | Fabric Warehouse enforces snapshot isolation on every transaction; isolation-level changes are silently ignored | Don't attempt to change isolation level — design around snapshot isolation |
| `tempdb` space exhaustion | Missing/stale column statistics, or heavy `GROUP BY`/`ORDER BY`/`JOIN` returning a huge result set | Refresh statistics; reduce grouping/ordering columns; avoid concurrent heavy workloads |
| `SELECT` completes on backend but client never receives results | Front-end/client-side delivery issue, not a query failure | Retry from a different client; use `CTAS` to isolate backend vs. client |
| **Error 24556** — snapshot isolation update conflict | Two transactions both `UPDATE`/`DELETE`/`MERGE`/`TRUNCATE` the same table | Retry the transaction (ideally with exponential backoff) |
| **Error 24706** — snapshot isolation update conflict | Insert/update/delete against a row another transaction already touched | Retry the transaction — no isolation-level workaround exists |
| `COPY INTO` fails outright despite `MAXERRORS` set | `ERRORFILE`/`MAXERRORS` don't apply to **Parquet** data-type conversion errors — only CSV/JSONL | Pre-clean the Parquet source, or switch to CSV/JSONL where `ERRORFILE`/`MAXERRORS` are honored |

**Source:** [10-Error Resolution: Notebook and T-SQL Errors](../../10-error-resolution/02-notebook-tsql-errors.md)

---

## Eventhouse

`.show ingestion failures` returns a `FailureKind` of **Permanent** (won't succeed on retry) or **Transient** (may succeed on retry), with 14-day retention.

| Category | Representative error codes | FailureKind | Fix |
| :--- | :--- | :--- | :--- |
| **BadFormat** | `Stream_WrongNumberOfFields`, `Stream_ClosingQuoteMissing`, `BadRequest_InvalidMapping`, `BadRequest_FormatNotSupported` | Permanent | Fix the source file's structure or the ingestion mapping |
| **BadRequest** | `BadRequest_EmptyBlob`, `BadRequest_InvalidOrEmptyTableName`, `BadRequest_DuplicateMapping`, `Stream_DynamicPropertyBagTooLarge` | Permanent | Fix the request/ingestion-properties definition |
| **DataAccessNotAuthorized** | `Download_Forbidden`, `BadRequest_TableAccessDenied`, `BadRequest_InvalidAuthentication` | Permanent | Grant the missing role/permission on the source storage or target table |
| **DownloadFailed** | `Download_NotTransient` (Permanent); `Download_UnknownError`, `Download_TransientNameResolutionFailure` (Transient) | Mixed | Retry transient variants; investigate storage connectivity for `NotTransient` |
| **EntityNotFound** | `BadRequest_DatabaseNotExist`, `BadRequest_TableNotExist`, `BadRequest_MappingReferenceWasNotFound` | Permanent | Create the missing entity or fix the reference name |
| **FileTooLarge** | `Stream_InputStreamTooLarge`, `BadRequest_FileTooLarge` | Permanent | Split the source file/field below the size limit |
| **InternalServiceError** | `General_InternalServerError`, `Timeout`, `OutOfMemory` (Transient); `Schema_PermanentUpdateFailure` (Permanent) | Mixed | Retry transient variants; correct schema failures manually |
| **UpdatePolicyFailure** | `UpdatePolicy_QuerySchemaDoesNotMatchTableSchema` (Permanent); `UpdatePolicy_IngestionError` (Transient) | Mixed | Fix the update-policy query/target schema, or retry |
| **ThrottledOnEngine** | `General_ThrottledIngestion` | Transient | Retry, or reduce ingestion rate/batch size |
| **RetryAttemptsExceeded** | `General_RetryAttemptsExceeded` | Permanent | Platform already retried and gave up — investigate the underlying transient cause directly |

**Source:** [10-Error Resolution: Real-Time Errors](../../10-error-resolution/03-realtime-errors.md)

---

## Eventstream

| Error / Message | Cause | Fix |
| :--- | :--- | :--- |
| **AADSTS65002** — "Fabric Eventstream isn't preauthorized to access Azure Event Hub" | The Eventstream service principal isn't preauthorized against that Event Hubs namespace at the tenant level | Cannot be self-resolved — escalate to a tenant admin |
| `EventHubNotFound` | The feeding eventstream was deleted, or the Activator connection was removed | Recreate the eventstream or reconnect the Activator object |
| `EventHubException` | Exception importing data from the source Event Hub | Inspect the source connection configuration and recent errors |
| `UnauthorizedAccess` | Permissions on the source eventstream item changed after the downstream connection was configured | Restore the required permission on the eventstream item |
| `IncorrectDataFormat` | Source data isn't in the expected JSON dictionary format | Reshape the source payload to valid JSON before it reaches the eventstream |
| Connection timeout to Azure Event Hubs | Network latency/connectivity — firewall, VPN, or NSG interference | Verify no firewall/VPN/NSG is blocking the path; check Event Hubs-side throttling |

**Source:** [10-Error Resolution: Real-Time Errors](../../10-error-resolution/03-realtime-errors.md)

---

## Shortcuts

| Status / Message | Cause | Fix |
| :--- | :--- | :--- |
| **401 Unauthorized** | Authentication failed — no valid identity established (expired/missing token, malformed header, expired SAS) | Provide a valid credential |
| **403 Forbidden** — `AuthorizationPermissionMismatch` | Authenticated but not authorized — missing Fabric Read, missing OneLake security Read, revoked storage role, delegated identity lost access | Grant the missing permission at the correct layer |
| **404 Not Found** | Target file/folder/table deleted, renamed, or moved without updating the shortcut | Recreate the shortcut against the correct path |
| Shortcut to ADLS Gen2 fails with **403** despite correct-looking credentials | Missing **Storage Blob Data Reader/Contributor** role on the target storage account for the delegated identity | Assign the correct role in Azure IAM, not just at the Fabric connection level |
| Creating a new S3/ADLS shortcut fails with "no permission on connection" | Creating user lacks permission on the underlying **cloud connection** object | Grant connection-level permission, or have a connection-permitted user create the shortcut |
| Shortcut query fails outright in delegated mode with no connectivity issue | Source table has RLS/CLS/OLS defined in OneLake security — delegated mode blocks this by design | Switch to user identity mode, or reimplement filtering in SQL at the consumer |
| Revoked producer access "still works" for a while | Delegated-mode cached storage access token hasn't expired — up to **30–60 minutes** | Wait out the window, or force refresh via capacity pause/resume or a mode toggle |

**Source:** [10-Error Resolution: OneLake Shortcut Errors](../../10-error-resolution/04-shortcut-errors.md)

---

**[← Back to Appendix](./appendix.md)**
