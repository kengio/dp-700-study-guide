---
title: Orchestration Patterns
type: topic
tags:
  - dp-700
  - fabric
  - orchestration
  - pipelines
  - notebookutils
  - expressions
  - error-handling
---

# Orchestration Patterns

## Overview

Once you know *which* tool to use ([01](./01-choosing-orchestration-tool.md)) and *when* it runs ([02](./02-schedules-triggers.md)), the last piece is wiring activities together: passing values between them, branching on success or failure, and composing pipelines and notebooks into parent-child hierarchies. This topic covers pipeline parameters and variables, the `@`-prefixed dynamic expression language, `Invoke Pipeline`/`Notebook` activity parameter passing, `notebookutils.notebook.run`/`runMultiple` code-first orchestration, and the on-failure error-handling activities every production pipeline needs.

> [!abstract]
>
> - **Parameters are set once per run and never change**; **variables are mutable** via `Set Variable`/`Append Variable` activities as the run progresses
> - The expression language starts every dynamic value with `@` — `@pipeline().parameters.x` for parameters, `@activity('name').output` for upstream activity results, plus string/date functions like `concat()`, `utcNow()`, `formatDateTime()`
> - `Invoke Pipeline` calls another pipeline (same or cross-workspace); `notebookutils.notebook.run`/`runMultiple` calls other notebooks from *inside* Spark code, with `runMultiple` supporting a full dependency DAG
> - Activities connect via **four outcome paths** — Upon Success, Upon Failure, Upon Completion, Upon Skip — and a **Fail activity** lets you deliberately fail a run with a custom message and error code

> [!tip] What the Exam Tests
>
> - Correctly distinguishing parameter (immutable) vs. variable (mutable) behavior in a scenario
> - Reading and writing expressions: `@pipeline().parameters.x`, `@activity('A').output.field`, `concat()`, `utcNow()`, `formatDateTime()`
> - `notebookutils.notebook.run` vs. `runMultiple` vs. `%run` — parameter types supported, concurrency limits, nesting depth, and how exit values propagate
> - Building a correct on-failure branch: which outcome path to use, and where a Fail/Teams/Outlook activity belongs in it

---

## Pipeline Parameters vs. Variables

Fabric pipelines have two distinct ways to carry values through a run, and mixing them up is one of the most common exam traps.

| Aspect | Parameters | Variables |
| :--- | :--- | :--- |
| **Mutability** | ==Immutable== — set once when the run starts, never change during that run | ==Mutable== — updated mid-run via `Set Variable` / `Append Variable` activities |
| **Defined where** | Pipeline canvas background → **Parameters** tab; requires name, type, default value | Pipeline canvas background → **Variables** tab; types: `String`, `Bool`, `Array` |
| **Set by** | The caller — a schedule, a trigger, a manual run, or a parent pipeline's `Invoke Pipeline` activity | Activities inside the pipeline itself, as it executes |
| **Typical use** | Configuration that's fixed for the whole run (environment name, target table, a region code) | Accumulating or evolving state during the run (a running total, a list built up in a loop, a computed flag that changes which branch runs next) |
| **Referenced as** | `@pipeline().parameters.<name>` | `@variables('<name>')` |

> [!warning] Common Mistake
> A scenario describing "the pipeline needs to update a tracking value partway through its run based on an activity's output, then use that updated value later in the same run" is describing a **variable**, not a parameter — parameters are read-only once the run starts. Conversely, "the same pipeline needs to run against a different target table depending on which schedule triggered it" describes a **parameter**, set once at trigger time.

The `Set Variable` activity can also set a **pipeline return value** — one or more named output values a parent pipeline can read from a child's `Invoke Pipeline` activity result, effectively letting a child pipeline "return" data the way a function does.

**Practice Question 1** *(Easy)*

A pipeline needs a value that's fixed for the entire run (the target environment name, supplied by whoever triggers it) and a separate value that accumulates a running row count as a `ForEach` loop processes batches. Which construct fits each need?

A. Both should be pipeline parameters  
B. Both should be pipeline variables  
C. Environment name = parameter (set once, read-only); running row count = variable (mutated via Set/Append Variable each loop iteration)  
D. Environment name = variable; running row count = parameter  

> [!success]- Answer
> **C. Environment name = parameter (set once, read-only); running row count = variable (mutated via Set/Append Variable each loop iteration)**
>
> Parameters are fixed for the life of a run and are the correct fit for a caller-supplied, unchanging configuration value. A value that needs to change *during* the run — like an accumulating count inside a loop — requires a variable, updated with `Set Variable` or `Append Variable` on each iteration.

---

## Dynamic Expression Language

Every dynamic value in a Fabric pipeline is an **expression**, starting with `@`. A bare `@expression` returns the expression's native type (number, boolean, object); wrapping it in `@{expression}` inside a string forces **string interpolation** and always returns a string.

```text
@pipeline().parameters.myNumber        → 42            (number)
@{pipeline().parameters.myNumber}      → "42"          (string)
"Answer is: @{pipeline().parameters.myNumber}"  → "Answer is: 42"
```

### Pipeline System Variables

| Expression | Returns |
| :--- | :--- |
| `@pipeline().DataFactory` | Workspace name |
| `@pipeline().Pipeline` | Pipeline name |
| `@pipeline().RunId` | This run's unique ID |
| `@pipeline().TriggerName` | Name of the trigger that started this run |
| `@pipeline().TriggerTime` | UTC, ISO 8601 timestamp the trigger fired |
| `@pipeline()?.TriggeredByPipelineName` | Parent pipeline's name, if started via `Invoke Pipeline` — nullable, hence the `?` |
| `@pipeline()?.TriggeredByPipelineRunId` | Parent pipeline's run ID — also nullable |

### Referencing Activity Output

```text
@activity('Copy1').output
@activity('Lookup1').output.firstRow.CustomerId
@activity('A').output.subfield1.subfield2[pipeline().parameters.subfield3].subfield4
```

Use bracket `[]` syntax (not dot `.`) when a subfield reference itself needs to be parameterized, as in the last example above.

### Key Functions

| Function | Syntax | Example → Result |
| :--- | :--- | :--- |
| `concat` | `concat('<a>', '<b>', ...)` | `concat('Test_', 'run')` → `"Test_run"` |
| `utcNow` | `utcNow('<format>'?)` | `utcNow()` → `"2026-07-10T13:00:00.0000000Z"` |
| `formatDateTime` | `formatDateTime('<ts>', '<format>'?)` | `formatDateTime(utcNow(), 'yyyy-MM-dd')` → `"2026-07-10"` |
| `addDays` | `addDays('<ts>', <days>, '<format>'?)` | `addDays(utcNow(), -1, 'yyyy-MM-dd')` → yesterday's date |
| `if` | `if(<expr>, <true>, <false>)` | `if(equals(1,1), 'yes', 'no')` → `"yes"` |
| `coalesce` | `coalesce(<v1>, <v2>, ...)` | Returns the first non-null value |

**Dynamic file naming pattern** — a very common exam scenario:

```text
@concat('sales_export_', formatDateTime(utcNow(), 'yyyy-MM-dd'), '.parquet')
// → "sales_export_2026-07-10.parquet"
```

> [!note] Mental model — `@` is "compute this," bare text is "use this literally"
> Anything inside quotes without a leading `@` is a literal string, byte-for-byte. The moment you prefix it with `@`, you've told Fabric "don't just store this text — evaluate it as code." `@{ }` inside a larger string is a small window that says "compute *this part*, then paste the result back into the surrounding literal text." If a scenario shows a value coming out as the literal text `@pipeline().parameters.env` instead of the resolved parameter value, the `@` was almost certainly missing or escaped (`@@`).

**Practice Question 2** *(Medium)*

A Copy activity needs its output file named with today's date in `yyyy-MM-dd` format, prefixed with `"orders_"`. Which expression correctly produces `orders_2026-07-10.csv`?

A. `concat('orders_', utcNow(), '.csv')`  
B. `@concat('orders_', formatDateTime(utcNow(), 'yyyy-MM-dd'), '.csv')`  
C. `formatDateTime('orders_', 'yyyy-MM-dd', '.csv')`  
D. `@{orders_}formatDateTime(utcNow(),'yyyy-MM-dd').csv`  

> [!success]- Answer
> **B. `@concat('orders_', formatDateTime(utcNow(), 'yyyy-MM-dd'), '.csv')`**
>
> The expression must start with `@` to be evaluated at all (ruling out A, which is a literal string). `formatDateTime` needs a timestamp and a format string as separate arguments — `utcNow()` supplies the timestamp, `'yyyy-MM-dd'` the format — and `concat` stitches the literal prefix, formatted date, and extension together. C reverses the arguments; D isn't valid expression syntax.

---

## Control-Flow Activities

Beyond parameters, variables, and expressions, five activities on the pipeline canvas provide the actual looping, branching, and metadata-probing logic that expressions alone can't: **ForEach**, **Until**, **Switch**, **Lookup**, and **Get Metadata**. These are the building blocks of the metadata-driven pipeline pattern — discover *what* to process at runtime, then loop over it.

### ForEach

`ForEach` iterates over a JSON array bound to its **Items** property, running one or more child activities once per item. The array most commonly comes from a `Lookup` activity's output:

```text
Items: @activity('Lookup_TableList').output.value
```

Inside the loop, `@item()` refers to the current element being processed, and `@item().<field>` accesses one of its properties when each element is an object rather than a scalar.

| Property | Description | Values |
| :--- | :--- | :--- |
| `isSequential` | Whether items process one at a time or concurrently | `true` (default: `false`) |
| `batchCount` | Upper concurrency limit when `isSequential = false` — an actual ceiling on parallelism, not a guarantee that every run hits it | Integer, default **20**, maximum **50** |
| `items` | The array to iterate over | Expression returning a JSON array |

> [!warning] Common Mistake
> `ForEach` can't be nested directly inside another `ForEach` (or an `Until`), and a single `ForEach` tops out at **100,000 items** regardless of `batchCount`. A scenario needing nested iteration needs the outer `ForEach` to call a **child pipeline** via `Invoke Pipeline`, with the inner loop living in that child — the same two-level pattern used to work around the nesting restriction and the item ceiling together.

### Until

`Until` is a do-while loop: it repeats its child activities until an **expression** evaluates to `true`, checking the condition *after* each iteration rather than before. An inner activity failing doesn't stop the loop on its own — only the exit expression or the optional **timeout** ends it.

```text
Expression: @equals(variables('RetryCount'), 3)
Timeout: 0.12:00:00   // 12 hours, in dd.hh:mm:ss format
```

A `Set Variable` activity inside the loop body is what actually moves the exit condition toward `true` — an `Until` with no variable mutation inside it never terminates on its own and depends entirely on the timeout.

### Switch

`Switch` evaluates one expression once, then runs the child activities in whichever **case** matches the result — the low-code equivalent of a `switch`/`case` statement. An unmatched result falls through to the **Default** case (which can be left empty to mean "do nothing").

```text
Expression: @pipeline().parameters.region
Cases: "EU" → Load_EU_Activities | "US" → Load_US_Activities | Default → Fail activity ("Unrecognized region")
```

`Switch` is the natural fit whenever a `ForEach`-driven scenario needs *different* handling per item rather than the same activity run once per item — pair the two by putting a `Switch` inside a `ForEach`'s child activities, keyed on `@item().sourceType` or similar.

### Lookup and Get Metadata: Feeding the Loop

`Lookup` and `Get Metadata` don't move or transform data — they **read** it, producing output that downstream control-flow activities consume.

| Activity | Returns | Key setting |
| :--- | :--- | :--- |
| `Lookup` | The result of a query, stored procedure, or file read — a single row/value or an array of rows | **First row only** toggles the output shape: on → a single object at `.output.firstRow`; off (default) → an array at `.output.value`, consumed directly by `ForEach`'s **Items** |
| `Get Metadata` | Requested metadata fields about a file, folder, or table — e.g., `itemName`, `itemType`, `columnCount`, `structure`, `size`, `exists`, `lastModified` | The specific fields to retrieve are chosen explicitly in the activity's settings, not returned in bulk |

> [!note]
> `Lookup` caps out at **5,000 rows** (a larger result set is silently truncated to the first 5,000) and **4 MB** of output — exceeding the size cap fails the activity outright rather than truncating. The longest a `Lookup` activity can run before timing out is **24 hours**. A query or stored procedure used in a `Lookup` must return exactly one result set, or the activity fails.

### Worked Example: Metadata-Driven Copy Pattern

The canonical metadata-driven pipeline: a `Lookup` activity reads a control table listing which source tables to copy, then a `ForEach` fans out a parameterized `Copy` activity once per table — adding a new table to the control table extends the pipeline without touching its activities.

```json
{
  "name": "MetadataDriven_CopyAllTables",
  "properties": {
    "activities": [
      {
        "name": "Lookup_TableList",
        "type": "Lookup",
        "typeProperties": {
          "source": { "type": "LakehouseTableSource" },
          "table": "control.TablesToCopy",
          "firstRowOnly": false
        }
      },
      {
        "name": "ForEach_Table",
        "type": "ForEach",
        "dependsOn": [
          { "activity": "Lookup_TableList", "dependencyConditions": ["Succeeded"] }
        ],
        "typeProperties": {
          "isSequential": false,
          "batchCount": 10,
          "items": {
            "value": "@activity('Lookup_TableList').output.value",
            "type": "Expression"
          },
          "activities": [
            {
              "name": "Copy_Table",
              "type": "Copy",
              "typeProperties": {
                "source": {
                  "type": "LakehouseTableSource",
                  "tableName": "@item().SourceTableName"
                },
                "sink": {
                  "type": "LakehouseTableSink",
                  "tableName": "@item().SinkTableName"
                }
              }
            }
          ]
        }
      }
    ]
  }
}
```

Swapping the `Copy` activity for a `Notebook` activity turns the same pattern into a metadata-driven Spark run — each iteration passes `@item()`'s fields as **Base parameters**, so one notebook handles every table without hardcoding a table name:

```text
Notebook activity Base parameters:
  source_table = @item().SourceTableName
  sink_table   = @item().SinkTableName
```

## Invoke Pipeline Activity: Parent-Child Parameter Passing

The **Invoke Pipeline activity** runs another pipeline from within a parent pipeline — the standard way to build modular, reusable pipeline patterns. Fabric has two versions:

| Version | Scope | Monitoring |
| :--- | :--- | :--- |
| **Invoke pipeline (Legacy)** | Same workspace only; can't invoke ADF/Synapse pipelines | Parent pipeline only |
| **Invoke pipeline** (current) | Cross-workspace, and can invoke ADF or Synapse pipelines too | Both parent **and** child pipeline runs are monitorable |

Configuring the activity:

1. **Settings** tab → choose **Type** (Fabric, ADF, or Synapse), a **Connection**, the target **Workspace**, and the **Pipeline** to invoke.
2. Pass values into the child pipeline's parameters using the same `@`-expression language — a parent expression like `@pipeline().parameters.region` can feed the child's `region` parameter directly.
3. Choose **wait on completion** (synchronous — parent blocks until the child finishes, and can read the child's `Set Variable` pipeline return values afterward) or **don't wait** (child runs in parallel with whatever comes next in the parent).

> [!warning] Common Mistake
> Don't assume the legacy Invoke Pipeline activity can call a pipeline in another workspace — it explicitly can't. A scenario describing cross-workspace pipeline composition needs the *current* Invoke Pipeline activity, not the Legacy one, and if it also needs to call an ADF or Synapse pipeline, Legacy is disqualified outright.

## Notebook Activity: Parameter Passing from a Pipeline

A pipeline's **Notebook activity** passes values into a notebook's designated **parameters cell** (toggled via **Toggle parameter cell** in the notebook editor) through the activity's **Base parameters** section on the **Settings** tab.

- Supported parameter types: `int`, `float`, `bool`, `string` only — **not** `list` or `dict`.
- To pass a complex structure, serialize it to a JSON string on the pipeline side and `json.loads()` it inside the notebook.
- The **parameter name in the pipeline's Base parameters must exactly match the variable name** in the notebook's parameters cell — Fabric's execution engine inserts a new cell beneath the parameters cell that overwrites the defaults with the pipeline-supplied values.

```python
# Inside the notebook — deserializing a JSON string parameter passed from a pipeline
import json
params = json.loads(json_string_param)
region = params.get("region")
threshold = params.get("threshold")
```

---

## `notebookutils.notebook.run` and `runMultiple`

Where `Invoke Pipeline` and the pipeline's `Notebook activity` are the *pipeline-level* way to compose items, `notebookutils.notebook` is the **code-first** equivalent, called from inside a running notebook.

### Single Notebook: `run()`

```python
notebookutils.notebook.run("Sample1", 90, {"input": 20})
# args: notebook name, timeoutSeconds, parameter map, optional workspaceId for cross-workspace
```

- Runs on the **same Spark pool session** as the calling notebook.
- Returns the referenced notebook's **exit value** as a string.
- Cross-workspace reference (4th argument, a workspace ID) is supported on runtime v1.2+.

### Multiple Notebooks as a DAG: `runMultiple()` *(Preview)*

`runMultiple()` submits several notebooks to run **in parallel or with dependencies**, each on its own isolated REPL instance sharing the session's Spark compute:

```python
DAG = {
    "activities": [
        {
            "name": "Bronze_Ingest",          # unique activity name
            "path": "Bronze_Ingest",          # notebook path
            "timeoutPerCellInSeconds": 90,    # default 90s per cell
            "args": {"source": "sales"}
        },
        {
            "name": "Bronze_Ingest_Inventory",
            "path": "Bronze_Ingest",
            "timeoutPerCellInSeconds": 90,
            "args": {"source": "inventory"}
        },
        {
            "name": "Silver_Transform",
            "path": "Silver_Transform",
            "timeoutPerCellInSeconds": 120,
            "retry": 1,
            "retryIntervalInSeconds": 10,
            "dependencies": ["Bronze_Ingest", "Bronze_Ingest_Inventory"]  # runs after both
        }
    ],
    "timeoutInSeconds": 43200,   # 12-hour default for the entire DAG
    "concurrency": 50            # default; capped by the driver's core count in practice
}

notebookutils.notebook.runMultiple(DAG, {"displayDAGViaGraphviz": False})
```

> [!warning] Common Mistake
> The **`concurrency` field defaults to 50**, but the *actual* number of notebooks that run simultaneously is capped by the Spark pool's **driver core count** — each concurrently running notebook consumes one driver core for its own REPL instance. A Medium node (8 driver cores) tops out at 8 truly concurrent notebooks no matter what `concurrency` says. A scenario asking "why didn't all 20 notebooks run at once despite `concurrency: 50`" is testing this exact distinction.

### Exiting a Notebook: `exit()`

```python
notebookutils.notebook.exit("value string")
```

Behavior depends on **how** the notebook was invoked:

| Invocation context | What happens on `exit()` |
| :--- | :--- |
| Interactive run | Raises a `NotebookExit` exception in the UI, skips remaining cells, **keeps the Spark session alive** |
| Pipeline Notebook activity | Notebook activity completes with the exit value; **do not** wrap `exit()` in `try/except` — the exception must propagate for the pipeline to capture the return value |
| Referenced via `notebookutils.notebook.run()` | Only the **referenced** notebook stops; the **calling** notebook continues executing its own remaining cells |

```python
exitVal = notebookutils.notebook.run("Sample1", 90, {"input": 20})
print(exitVal)
# → "Notebook executed successfully with exit value 20"
```

## `%run` vs. `notebookutils.notebook.run`/`runMultiple`

Both reference another notebook's code, but they solve different problems:

| Aspect | `%run` magic command | `notebookutils.notebook.run` / `runMultiple` |
| :--- | :--- | :--- |
| **Effect** | Inlines the referenced notebook — all its variables become directly available in the **calling notebook's** namespace | Runs the referenced notebook as an **isolated child**, returning only its exit value; variables stay encapsulated |
| **Parallelism** | None — always sequential, one reference at a time | `runMultiple()` runs several notebooks concurrently with a dependency DAG |
| **Nesting limit** | ==Max nesting depth of 5== — throws an exception beyond that; recursive (self-referencing) calls aren't supported | No documented depth limit comparable to `%run`; concurrency is bounded by driver cores instead |
| **Parameter types** | Only `int`, `float`, `bool`, `string`; no variable substitution | `run()`/`runMultiple()` accept the same scalar types via a parameter dict/`args` map |
| **Cross-workspace** | Not supported — same workspace only | `run()` supports a 4th `workspaceId` argument on runtime v1.2+ |
| **Typical use** | Sharing helper functions/config across notebooks as if they were one file (a "module" pattern) | Orchestrating separate, independently-scoped notebook jobs — especially in parallel or with explicit dependencies |

> [!note] Mental model — copy-paste vs. subcontracting
> `%run` is like copy-pasting the referenced notebook's code directly into your own — you inherit its variables and its mess, and you can only do this five layers deep before Fabric refuses. `notebookutils.notebook.run`/`runMultiple` is subcontracting: you hand off a self-contained job with its own parameters, it runs in its own isolated space, and you only get back what it deliberately hands you through `exit()` — nothing else leaks across.

**Practice Question 3** *(Hard)*

A data engineering team wants to build a shared library of Python helper functions used identically across a dozen notebooks, edited in one place, with changes reflected everywhere without copying code. Separately, they also need to run four independent ingestion notebooks in parallel every night, three of which must finish before a fourth aggregation notebook starts. Which two mechanisms fit these two needs?

A. `notebookutils.notebook.runMultiple` for both needs  
B. `%run` for the shared helper library; `notebookutils.notebook.runMultiple` with a `dependencies` DAG for the nightly ingestion  
C. `%run` for both needs  
D. `notebookutils.notebook.run` for the shared helper library; `%run` for the nightly ingestion  

> [!success]- Answer
> **B. `%run` for the shared helper library; `notebookutils.notebook.runMultiple` with a `dependencies` DAG for the nightly ingestion**
>
> `%run` inlines a referenced notebook's variables and functions into the caller's namespace — exactly what a shared-helper-module pattern needs. The nightly ingestion scenario needs isolated parallel execution with a dependency ordering (three notebooks before a fourth), which is precisely what `runMultiple`'s `dependencies` field in the DAG configuration provides — `%run` has no parallelism or dependency concept at all.

---

## Parent-Child Pipeline Patterns

Composing pipelines hierarchically keeps individual pipelines small, testable, and reusable:

- **Fan-out**: a parent `Invoke Pipeline`s several children in parallel (don't wait on completion) for independent workloads — e.g., one child per source system — then a downstream activity waits on all of them via dependency conditions before proceeding.
- **Fan-in via return values**: children each set a `Set Variable` **pipeline return value**; the parent reads each child's return value after `Invoke Pipeline` (wait on completion) to decide its next branch.
- **Reusable utility pipeline**: a small pipeline that does one thing well (e.g., "send a notification email via Outlook activity") gets called by many parent pipelines via `Invoke Pipeline`, parameterized with subject/body/recipients — avoiding duplicated notification logic across a dozen pipelines (this is the documented pattern for sharing Outlook/Teams connections across authors, since those connections are scoped per-user and can't be shared directly).
- **Notebook-level parent-child**: inside a single notebook, `notebookutils.notebook.runMultiple`'s DAG plays the same fan-out/fan-in role that `Invoke Pipeline` plays at the pipeline level, but entirely in code and without leaving the Spark session.

## Error Handling

### The Four Outcome Paths

Every activity-to-activity connector on the pipeline canvas represents one of four outcome conditions, and an activity can have multiple outgoing paths of different types simultaneously:

| Path | Fires when the upstream activity... |
| :--- | :--- |
| **Upon Success** | Succeeded |
| **Upon Failure** | Failed |
| **Upon Completion** | Finished regardless of outcome (success or failure) |
| **Upon Skip** | Was skipped (e.g., an upstream branch never executed it) |

Multiple activities feeding into one downstream activity on the **same** path type must **all** satisfy that condition before the downstream activity fires — e.g., two Copy activities both connected to a Teams activity on Upon Failure only trigger the Teams message if **both** Copy activities fail; if only one fails, the Teams activity doesn't run.

### Fail Activity

The **Fail activity** deliberately throws a custom error, with a configurable **error message** and **error code**, recorded in the pipeline's run history and logs. It's typically wired behind an **If Condition** activity's `True` branch to fail the pipeline explicitly when a validation, business-rule, or dependency check doesn't pass — rather than letting the pipeline "succeed" despite bad data.

```text
If Condition: @less(activity('RowCountCheck').output.firstRow.rowCount, 1)
  True branch  → Fail activity
                   Message: "Source returned zero rows — refusing to proceed"
                   Error code: "EMPTY_SOURCE"
  False branch → (continue normal pipeline flow)
```

### Notification Activities: Teams and Outlook

Both post/send from the **Upon Failure** path of the activities they're monitoring, using dynamic expressions to include run details in the message:

| Activity | Sends | Key config |
| :--- | :--- | :--- |
| **Teams activity** | A message to a Teams channel or group chat | Connection, **Post in** (channel vs. group chat), **Message** (supports expressions), optional **Subject** (channel posts only) |
| **Office 365 Outlook activity** | An email from the authoring user's own Office 365 account | Connection, recipients, subject, body (all expression-capable); advanced: CC/BCC, custom from/reply-to |

> [!warning] Common Mistake
> Both Teams and Outlook activities are documented as **inactive under CI/CD deployment** until a new user-authentication connection is created in the target workspace — a scenario where a failure-notification pipeline "worked in Dev but silently stopped notifying after deployment to Prod via CI/CD" is this exact, documented gotcha, not a bug in the pipeline logic itself. Also note the Outlook activity **doesn't support Workspace Identity or Service Principal** authentication — a fully unattended service-principal-driven CI/CD pipeline can't use it as-is.

---

## Complete Runnable Example: Parameterized Parent-Child Pipeline

A minimal but complete illustration tying parameters, expressions, `Invoke Pipeline`, and error handling together — a parent pipeline that invokes a child load pipeline per region, with failure notification:

```json
{
  "name": "Parent_LoadAllRegions",
  "properties": {
    "parameters": {
      "runDate": { "type": "string", "defaultValue": "@utcNow()" }
    },
    "variables": {
      "failedRegions": { "type": "Array" }
    },
    "activities": [
      {
        "name": "Invoke_LoadRegion_EU",
        "type": "InvokePipeline",
        "typeProperties": {
          "pipelineId": "<child-pipeline-guid>",
          "waitOnCompletion": true,
          "parameters": {
            "region": "EU",
            "runDate": "@pipeline().parameters.runDate"
          }
        }
      },
      {
        "name": "AppendFailure_EU",
        "type": "AppendVariable",
        "dependsOn": [
          { "activity": "Invoke_LoadRegion_EU", "dependencyConditions": ["Failed"] }
        ],
        "typeProperties": {
          "variableName": "failedRegions",
          "value": "EU"
        }
      },
      {
        "name": "Fail_IfAnyRegionFailed",
        "type": "IfCondition",
        "dependsOn": [
          { "activity": "AppendFailure_EU", "dependencyConditions": ["Completed"] }
        ],
        "typeProperties": {
          "expression": {
            "value": "@greater(length(variables('failedRegions')), 0)",
            "type": "Expression"
          },
          "ifTrueActivities": [
            {
              "name": "Fail_Run",
              "type": "Fail",
              "typeProperties": {
                "message": "@concat('Regions failed to load: ', string(variables('failedRegions')))",
                "errorCode": "REGION_LOAD_FAILURE"
              }
            },
            {
              "name": "NotifyTeams",
              "type": "TeamsNotification",
              "typeProperties": {
                "message": "@concat('Load failed for: ', string(variables('failedRegions')), ' — run: ', pipeline().RunId)"
              }
            }
          ]
        }
      }
    ]
  }
}
```

The equivalent notebook-side DAG for the same fan-out, run entirely in Spark rather than via pipeline activities:

```python
DAG = {
    "activities": [
        {"name": "Load_EU", "path": "Load_Region", "args": {"region": "EU"}},
        {"name": "Load_US", "path": "Load_Region", "args": {"region": "US"}},
        {"name": "Load_APAC", "path": "Load_Region", "args": {"region": "APAC"}},
        {
            "name": "Reconcile",
            "path": "Reconcile_All_Regions",
            "dependencies": ["Load_EU", "Load_US", "Load_APAC"]
        }
    ],
    "timeoutInSeconds": 7200,
    "concurrency": 3
}
results = notebookutils.notebook.runMultiple(DAG)
```

## Use Cases

- A dynamic file-naming pattern (`concat` + `formatDateTime` + `utcNow`) for date-partitioned exports, so every run's output is uniquely and predictably named
- A parent pipeline that fans out to one child pipeline per source system via `Invoke Pipeline` (don't wait), then a downstream activity aggregates once all children reach `Upon Completion`
- A notebook-side nightly ingestion DAG via `runMultiple`, running independent source notebooks in parallel and gating a shared "reconcile" notebook on all of them finishing
- A validation gate: `If Condition` checks a row count or data-quality expression, routing to a `Fail` activity plus a Teams notification only when the check fails

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| A value mutated mid-pipeline doesn't reflect in a later parameter reference | Parameters are immutable per run; the value was actually meant to be a variable | Switch the mutable value to a pipeline variable, updated via `Set Variable`/`Append Variable` |
| `runMultiple` doesn't run all configured notebooks simultaneously despite `concurrency: 50` | Actual concurrency is capped by the Spark pool's driver core count, not the `concurrency` field alone | Size the driver node for the desired concurrency, or reduce the DAG's parallel branch count |
| A pipeline invoking `Invoke Pipeline (Legacy)` fails when targeting another workspace | Legacy Invoke Pipeline only supports same-workspace pipelines | Switch to the current (non-legacy) Invoke Pipeline activity for cross-workspace or ADF/Synapse targets |
| `%run`-chained notebooks throw an exception at a certain depth | `%run` supports nested calls only up to a depth of 5; recursive self-reference isn't supported at all | Flatten the reference chain, or switch part of the chain to `notebookutils.notebook.run`, which doesn't share `%run`'s depth ceiling |
| A pipeline Notebook activity's parameter never overrides the notebook's default | Parameter name in the pipeline's Base parameters doesn't exactly match the notebook parameters-cell variable name | Correct the name to match exactly on both sides |
| `exit()` inside a pipeline-invoked notebook doesn't return a value to the pipeline | The `exit()` call was wrapped in a `try/except` block, swallowing the required `NotebookExit` exception | Remove the try/except around `exit()` so the exception propagates and the activity captures the exit value |
| A Teams/Outlook failure notification silently stops firing after CI/CD deployment | User-authentication connections are scoped per-workspace; the activity goes inactive in the target workspace until reconnected | Create a new user-authentication connection for the Teams/Outlook activity in the deployed-to workspace |
| Two upstream activities on one Upon-Failure-connected downstream activity don't trigger it when only one fails | All activities sharing one outcome-path connection into a downstream activity must satisfy that condition together | Use separate Upon Failure connectors (or separate downstream activities) if "any one fails" should trigger notification |

## Best Practices

- Default to variables only when a value genuinely needs to change mid-run; otherwise a parameter keeps the pipeline's inputs auditable and predictable
- Keep dynamic expressions readable — extract deeply nested `concat`/`if` chains into a `Set Variable` step with a clear name rather than one unreadable inline expression
- Use `notebookutils.notebook.runMultiple`'s DAG for anything with real parallelism or dependency ordering; reserve `%run` for genuinely shared, small helper code
- Always give a `Fail` activity a specific, greppable `errorCode` — it's what makes triage from run history fast instead of re-reading logs
- Route failure notifications (Teams/Outlook) off dedicated Upon Failure paths per critical activity, not one shared path across many activities, unless "all must fail" is the intended semantics

## Exam Tips

> [!tip] Exam Tips
>
> - Parameters = immutable per run; variables = mutable via Set/Append Variable — this distinction alone resolves a large share of orchestration-pattern questions
> - `@activity('name').output` and `@pipeline().parameters.x` are the two expression roots to know cold; bracket `[]` syntax handles parameterized subfield access
> - `runMultiple`'s `concurrency` field is a ceiling, not a guarantee — actual parallelism is capped by Spark driver core count
> - `%run` = shared namespace, max nesting depth 5, no recursion, same-workspace only; `notebookutils.notebook.run`/`runMultiple` = isolated child execution, cross-workspace capable, DAG-aware
> - `exit()` behavior differs by caller: interactive keeps the session alive; pipeline-invoked completes the activity with the exit value (never wrap in try/except); referenced via `run()` only stops the *referenced* notebook
> - Four outcome paths — Upon Success/Failure/Completion/Skip — and multiple activities on one path must **all** satisfy that condition to fire the downstream activity

## Key Takeaways

- Parameters are set once at trigger time and stay fixed; variables mutate during the run via Set/Append Variable activities
- The `@` expression language covers system variables, activity output references, and functions like `concat`, `utcNow`, and `formatDateTime` for dynamic values
- `Invoke Pipeline` composes pipelines; `notebookutils.notebook.run`/`runMultiple` composes notebooks in code, with `runMultiple` supporting a full dependency DAG and driver-core-bounded concurrency
- `%run` inlines a notebook's namespace with a max depth of 5 and no recursion; `notebookutils.notebook.run` isolates the child and returns only its `exit()` value
- Robust error handling combines the four outcome paths, a `Fail` activity for deliberate custom failures, and Teams/Outlook activities for notification — watch for the CI/CD connection-reset gotcha on both

## Related Topics

- [01-Choosing an Orchestration Tool](./01-choosing-orchestration-tool.md)
- [02-Schedules & Triggers](./02-schedules-triggers.md)

## Official Documentation

- [Fabric Data Factory expression language](https://learn.microsoft.com/en-us/fabric/data-factory/expression-language)
- [Parameters — Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/parameters)
- [Invoke pipeline activity](https://learn.microsoft.com/en-us/fabric/data-factory/invoke-pipeline-activity)
- [Set Variable activity](https://learn.microsoft.com/en-us/fabric/data-factory/set-variable-activity)
- [Fail activity](https://learn.microsoft.com/en-us/fabric/data-factory/fail-activity)
- [Teams activity](https://learn.microsoft.com/en-us/fabric/data-factory/teams-activity)
- [Office 365 Outlook activity](https://learn.microsoft.com/en-us/fabric/data-factory/outlook-activity)
- [Activity overview](https://learn.microsoft.com/en-us/fabric/data-factory/activity-overview)
- [Microsoft Spark Utilities (MSSparkUtils) for Fabric — notebook run/runMultiple/exit](https://learn.microsoft.com/en-us/fabric/data-engineering/microsoft-spark-utilities)
- [Develop, execute, and manage notebooks — %run magic command](https://learn.microsoft.com/en-us/fabric/data-engineering/author-execute-notebook)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-schedules-triggers.md) | [↑ Back to Section](./orchestration.md) | [Next →](../05-loading-patterns/loading-patterns.md)**
