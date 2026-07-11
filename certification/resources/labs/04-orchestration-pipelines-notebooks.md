---
title: "Lab 04: Orchestration — Pipelines & Notebooks"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - orchestration
  - pipelines
  - notebooks
  - foreach
  - error-handling
status: complete
---

# Lab 04: Orchestration — Pipelines & Notebooks

## Overview

This lab builds one real, metadata-driven pipeline: a `Lookup` activity reads a small control table, a `ForEach` fans out over it with `batchCount`, and a parameterized `Notebook` activity runs a per-table row-count check that genuinely fails when a threshold isn't met — wiring up a real on-failure branch instead of a simulated one. It closes with a schedule and a tour of event-based triggering.

> [!abstract]
>
> - Builds a control table of table names + minimum expected row counts
> - Pipeline: `Lookup` → `ForEach` (`batchCount = 2`) → parameterized `Notebook` activity that reads its parameters and genuinely fails (not just exits) when a check doesn't pass
> - Wires an `Upon Failure` path to a `Fail` activity, with a documented alternative if your tenant has no Teams/Outlook connection configured
> - Adds a fixed schedule, then tours the OneLake storage-event trigger surface
> - Recaps the `@pipeline()`/`@activity()`/`@item()` dynamic expression language in the context of a pipeline you just built
> - A bonus step wires a `Switch` activity inside the `ForEach` to see per-item branching, distinct from per-item parameterization

By the end of this lab you'll have personally exercised every control-flow activity most DP-700 candidates only recognize from screenshots: `Lookup`, `ForEach`, `Switch`, and `Fail`, plus the base-parameters contract between a pipeline and a notebook. That combination — not any single activity in isolation — is what the exam's orchestration scenario questions actually probe.

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) completed — `dp700-labs` workspace with `lh_bronze` and its five Delta tables. Labs 02 and 03 are not required, but Step 4's aside about Teams/Outlook connections going inactive under CI/CD deployment will make more sense if you've already built the deployment pipeline in [Lab 02](./02-lifecycle-git-deployment.md).
>
> **Estimated time:** 45 minutes

---

## Steps

### Step 1: Create the control table

The whole lab is a small, deliberate instance of the **metadata-driven pipeline pattern**: instead of hardcoding five separate row-count checks, one control table describes *what* to check, and one pipeline + one notebook describe *how* — adding a sixth table to check later means adding a row, not touching the pipeline canvas.

1. Open `nb-generate-dataset` (or create a new notebook `nb-orchestration-setup` attached to `lh_bronze`) and run:

```python
from pyspark.sql import Row

control_rows = [
    Row(table_name="customers", min_expected_rows=50),
    Row(table_name="products", min_expected_rows=30),
    Row(table_name="orders", min_expected_rows=200),
    Row(table_name="order_items", min_expected_rows=1000),  # deliberately too high — this row is meant to fail
    Row(table_name="events", min_expected_rows=500),
]
df_control = spark.createDataFrame(control_rows)
df_control.write.format("delta").mode("overwrite").saveAsTable("control_tables")
df_control.show()
```

> [!success] Expected result
> A `control_tables` Delta table appears in `lh_bronze`'s Tables section with 5 rows. Note that `order_items`'s threshold (1000) is set deliberately higher than its actual row count (~500–800) — this is what exercises the on-failure path in Step 4.

### Step 2: Build the pipeline skeleton — Lookup and ForEach

1. In `dp700-labs`, select **+ New item → Data pipeline**. Name: `pl_orchestration_demo`.
2. Drag a **Lookup** activity onto the canvas. Name it `Lookup_ControlTable`.
   - **Connection**: `lh_bronze` (Lakehouse).
   - **Source**: Table → `control_tables`.
   - **First row only**: **off** (you need the full array for `ForEach`, not a single row).
3. Drag a **ForEach** activity onto the canvas, connected from `Lookup_ControlTable` on **Upon Success**. Name it `ForEach_Table`.
   - **Sequential**: off.
   - **Batch count**: `2` (processes at most 2 table checks concurrently).
   - **Items**: `@activity('Lookup_ControlTable').output.value`.

> [!success] Expected result
> The canvas shows `Lookup_ControlTable` connected to `ForEach_Table` via a green (Upon Success) arrow. `ForEach_Table`'s Items field shows the expression above with no red validation error.

> [!note]
> `control_tables` has only 5 rows, well inside `Lookup`'s real limits — 5,000 rows and 4 MB of output, with a 24-hour timeout ceiling. Those numbers matter more for a scenario question ("why did this Lookup activity fail against a 20,000-row control table?") than for this lab, but it's worth knowing they exist before you scale this same pattern to a real control table.

`ForEach_Table`'s `batchCount: 2` deliberately doesn't match the 5-row array — with 5 items and a batch count of 2, you should see at most 2 iterations actively running at once, with the remaining 3 queued behind them, rather than all 5 firing simultaneously. Watch this play out in **Monitor** during Step 5.

### Step 3: Build the parameterized notebook and wire it inside the ForEach

1. Create a new notebook `nb-rowcount-check`, attached to `lh_bronze`.
2. In the first cell, select **Toggle parameter cell** and set default parameter values:

```python
table_name = "customers"
min_rows = 0
```

1. In a second cell, paste the check logic:

```python
row_count = spark.table(table_name).count()
print(f"{table_name}: {row_count} rows (minimum expected: {min_rows})")

if row_count < min_rows:
    # Raising, not exit()-ing, is what makes the pipeline Notebook activity
    # actually FAIL — an exit() call alone would complete the activity
    # successfully with this string as its output, never triggering
    # an Upon Failure path.
    raise Exception(f"Row count check FAILED for '{table_name}': {row_count} < {min_rows}")

notebookutils.notebook.exit(f"OK: {table_name} has {row_count} rows")
```

1. Back in `pl_orchestration_demo`, open `ForEach_Table` and drag a **Notebook** activity inside its canvas. Name it `Notebook_RowCountCheck`.
   - **Notebook**: `nb-rowcount-check`.
   - **Base parameters**: add `table_name` = `@item().table_name`, `min_rows` = `@item().min_expected_rows`.
   - Confirm parameter **types** match the notebook's parameter cell: `table_name` as `string`, `min_rows` as `int`.

> [!success] Expected result
> `Notebook_RowCountCheck` sits inside the `ForEach_Table` loop with two base parameters bound to `@item()` expressions. Running the pipeline now (before Step 4's failure wiring) completes `ForEach_Table` with 4 successful iterations and 1 failed iteration (`order_items`) — the pipeline overall shows **Failed**, since an unhandled activity failure propagates up by default.

### Step 4: Wire the on-failure path

1. Inside `ForEach_Table`, drag a **Fail** activity next to `Notebook_RowCountCheck`. Name it `Fail_RowCountCheck`.
2. Connect `Notebook_RowCountCheck` → `Fail_RowCountCheck` on **Upon Failure** (right-click the activity's output connector, or drag from the small red arrow icon).
3. Configure `Fail_RowCountCheck`:
   - **Message**: `@concat('Row count check failed for table: ', item().table_name)`
   - **Error code**: `ROWCOUNT_BELOW_THRESHOLD`

4. **If your tenant has a Teams or Outlook connection available**: add a **Teams activity** (or **Office 365 Outlook activity**) alongside `Fail_RowCountCheck`, also connected from `Notebook_RowCountCheck` on **Upon Failure**, with a message like `@concat('DP-700 lab: row count check failed for ', item().table_name)`.

   **If no Teams/Outlook connection is available** (common on a personal trial tenant with no Microsoft 365 group/Teams license): skip the notification activity entirely and rely on `Fail_RowCountCheck`'s message + error code, visible in the pipeline's run-history output, as your failure signal. This is a fully valid substitute for the exam's purposes — the graded skill is wiring the **Upon Failure** path correctly, not which specific notification connector you happen to have configured.

> [!success] Expected result
> The canvas shows a red (Upon Failure) arrow from `Notebook_RowCountCheck` to `Fail_RowCountCheck` (and, if configured, to the notification activity). Run the pipeline again: `order_items`'s iteration now shows `Notebook_RowCountCheck` failed *and* `Fail_RowCountCheck` succeeded with your custom message — the intended, deliberate failure is now captured with a clear signal instead of surfacing as a bare "Failed" pipeline run.

> [!warning] Common Mistake
> Two activities feeding the **same** downstream activity on the **same** Upon Failure path must **both** fail before the downstream activity fires. Since each `ForEach` iteration runs its own independent copy of `Notebook_RowCountCheck` → `Fail_RowCountCheck`, this doesn't bite you here — but it's exactly the trap described in [03-Orchestration Patterns § Error Handling](../../04-orchestration/03-orchestration-patterns.md#error-handling) for pipelines where multiple *different* activities share one downstream failure branch.

> [!note] A gotcha worth knowing even if you skipped the notification activity
> If you did wire a Teams or Outlook activity, remember it for [Lab 02](./02-lifecycle-git-deployment.md): both activities are documented as going **inactive under CI/CD deployment** until a new user-authentication connection is created in the target workspace. A pipeline that notifies correctly in Dev but silently stops notifying after a deployment pipeline promotes it to Test/Production isn't a bug in the pipeline logic — it's this exact, documented connection-reset behavior. Worth testing for real if you build both this pipeline and a deployment pipeline stage for it later.

Because this is a `ForEach`-scoped failure branch, it's a good moment to also connect the dots back to Lab 03's DDM inference trap: both scenarios share the same shape — a control that looks like it's protecting something (a mask, a threshold check) but that a sufficiently determined or malformed input can still slip past if the surrounding logic isn't airtight. A `Fail` activity with a clear error code is exactly the kind of airtight signal that prevents "the pipeline said Failed but nobody knows why" from becoming a 2am incident.

### Step 5: Run and inspect

1. Select **Run** on `pl_orchestration_demo`. Watch the **Output** pane.
2. After completion, open the run in **Monitor** (or the Output pane's run link) and expand `ForEach_Table` → look at each of the 5 iterations.

> [!success] Expected result
> 4 iterations show `Notebook_RowCountCheck` succeeded with an `OK: ...` exit value; the `order_items` iteration shows `Notebook_RowCountCheck` failed and `Fail_RowCountCheck` succeeded with the custom error message and code `ROWCOUNT_BELOW_THRESHOLD`. The pipeline's overall status is **Failed** (a `Fail` activity always fails the run — that's its purpose) but with a clear, actionable reason instead of an opaque error.

Run summary, for reference:

| Iteration (`table_name`) | `min_expected_rows` | Actual rows | `Notebook_RowCountCheck` | `Fail_RowCountCheck` |
| :--- | :--- | :--- | :--- | :--- |
| `customers` | 50 | 50 | Succeeded | (not run) |
| `products` | 30 | 30 | Succeeded | (not run) |
| `orders` | 200 | 200 | Succeeded | (not run) |
| `order_items` | 1000 | ~500–800 | **Failed** | **Succeeded** |
| `events` | 500 | 500 | Succeeded | (not run) |

### Step 6: Bonus — branch per table type with `Switch`

This lab's `ForEach` runs the *same* activity once per item — the common case, but not the only one. When different item types genuinely need different handling, `Switch` is the tool, nested inside the `ForEach` alongside (or instead of) the notebook activity. Wire it up to see the pattern, without necessarily keeping it long-term:

1. Inside `ForEach_Table`, drag a **Switch** activity. Name it `Switch_TableCategory`.
2. **On** (the expression to evaluate): `@item().table_name`.
3. Add **Cases**: `"events"` → a placeholder activity (e.g., a `Wait` activity for 1 second, standing in for "route event tables to different handling"); leave **Default** empty (meaning "do nothing" for every other table name).
4. Connect `Lookup_ControlTable`'s output into a parallel path, or simply inspect the `Switch` activity's configuration without wiring it into the main run — the goal here is reading the case-matching UI correctly, not necessarily keeping two competing branches inside `ForEach_Table` for the rest of this lab pack.

> [!success] Expected result
> You can point to the **Cases** list and the **Default** case in the Switch activity's Settings tab, and explain when you'd reach for `Switch` inside a `ForEach` instead of running the same activity for every item: whenever different items in the loop need genuinely different handling, keyed on one of their fields — not just different parameter *values* for the same activity, which `@item()` alone already covers.

> [!note] Mental model
> `ForEach` answers "do this to every item." `Switch` answers "do a different this depending on what the item is." Nested together, they cover the metadata-driven pattern's full range: same activity, varying parameters (plain `ForEach`) vs. genuinely different activities per item category (`ForEach` + `Switch`).

Remove or disable `Switch_TableCategory` before moving on if you don't want it cluttering the canvas for later reference — it isn't required by any later step or lab.

### Step 7: Add a fixed schedule

1. On `pl_orchestration_demo`'s canvas, select **Schedule** (top toolbar).
2. Configure: **Repeat**: Daily, **Time**: `06:00`, **Start date**: today, **End date**: 7 days from today (a fixed schedule requires both — there's no open-ended option).
3. Select **Apply**.

> [!success] Expected result
> The pipeline shows an active schedule in **Manage → Schedules**. Because a real recurring run would burn trial capacity for the rest of this lab pack, **disable the schedule immediately after confirming it saved** (toggle it off in the same panel) — the point of this step is knowing the exact configuration surface, not letting it run unattended.

### Step 8: Tour the OneLake storage-event trigger

A full event-triggered build belongs with Eventstream/Data Activator in [Lab 09](./09-streaming-eventstream-kql.md); here, just tour the surface:

1. On the same **Schedule** panel, look for (or navigate to) **New trigger → Event-based**.
2. Note the source options: **OneLake events** (item created/updated/deleted within a specific lakehouse/workspace) and **Azure Blob Storage events**, both routed through Data Activator and an underlying eventstream.
3. Don't create a trigger — just confirm you can name the two event source categories and state that both are Activator-backed, not a bespoke pipeline-only mechanism.

> [!success] Expected result
> You can explain, from memory, that event-based triggers in Fabric pipelines aren't a separate technology from Data Activator — they're the same alerting/action engine, just configured as a pipeline trigger instead of a Teams/email/Power Automate action.

### Step 9: Recap the dynamic expressions you just used

Without re-opening the pipeline, write down (or say aloud) what each of these returns, based on what you configured above:

| Expression | What it resolved to in this lab |
| :--- | :--- |
| `@activity('Lookup_ControlTable').output.value` | The full 5-row array from `control_tables`, fed into `ForEach_Table`'s Items |
| `@item().table_name` | Each row's `table_name` field, one value per `ForEach` iteration |
| `@item().min_expected_rows` | Each row's `min_expected_rows` field, passed as the `min_rows` base parameter |
| `@concat('Row count check failed for table: ', item().table_name)` | String concatenation used inside the `Fail` activity's message |

> [!success] Expected result
> All four match what you configured in Steps 2–4. If any don't, re-open the relevant activity and compare its **Settings** tab against the step above before moving on — a mismatch here usually means a typo in an `@item()` field name.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `ForEach_Table`'s Items field shows a red validation error | `Lookup_ControlTable`'s **First row only** was left **on**, so `.output.value` doesn't exist (only `.output.firstRow` does) | Set **First row only** to off on the Lookup activity |
| Every iteration of `Notebook_RowCountCheck` "succeeds" even for `order_items` | The notebook cell calls `notebookutils.notebook.exit()` in every branch instead of `raise Exception(...)` for the failing case | `exit()` always completes the activity successfully — only an uncaught exception makes the pipeline Notebook activity itself fail |
| The `Fail` activity never fires despite `order_items` failing | `Notebook_RowCountCheck` → `Fail_RowCountCheck` is wired on **Upon Success** instead of **Upon Failure** | Right-click the connector and confirm it's the red (Upon Failure) path, not the default green one |
| Base parameter values don't reach the notebook | Parameter **name** in the pipeline's Base parameters doesn't exactly match the notebook's parameter-cell variable name, or the **type** doesn't match (`string` vs `int`) | Correct the name/type to match exactly on both sides |
| `ForEach` iterations run one at a time despite `batchCount: 2` | `Sequential` was left **on** — sequential mode ignores `batchCount` entirely | Set **Sequential** to off to let `batchCount` govern concurrency |
| Schedule from Step 7 keeps running in the background after this lab | The toggle-off step was skipped | Open **Manage → Schedules** on the pipeline and disable it explicitly |

## Cleanup

**Keep**:

- `pl_orchestration_demo`, `nb-rowcount-check`, and the `control_tables` table — useful as a working reference for Lab 09's more advanced trigger build, though no later lab strictly requires them

**Must do**:

- Confirm the Step 7 schedule is **disabled** (or delete it) before moving on — an active daily schedule will keep consuming trial capacity in the background for every remaining lab in this pack

**Optional cleanup**:

- `Switch_TableCategory` from Step 6, if you added it purely to see the configuration and don't want it left on the canvas

## What the Exam Asks About This

- [01-Choosing an Orchestration Tool](../../04-orchestration/01-choosing-orchestration-tool.md) — pipeline vs. Dataflow Gen2 vs. notebook decision matrix
- [02-Schedules & Triggers](../../04-orchestration/02-schedules-triggers.md) — fixed vs. interval schedules, event-based triggers via Activator
- [03-Orchestration Patterns](../../04-orchestration/03-orchestration-patterns.md) — parameters vs. variables, `@`-expression language, `ForEach`/`Lookup`/`Switch`, the four outcome paths, `Fail`/Teams/Outlook activities

This lab intentionally builds every control-flow activity Domain 1 tests except `Until` (a do-while loop, less commonly needed in a metadata-driven pattern than `ForEach`) and `Get Metadata` (which reads file/folder properties rather than table rows — the same conceptual slot as `Lookup`, just for a different source shape). Read both in [03-Orchestration Patterns § Control-Flow Activities](../../04-orchestration/03-orchestration-patterns.md#control-flow-activities) to round out the set before the exam; neither needs a dedicated hands-on lab to click once you've built `Lookup`, `ForEach`, and `Switch` for real.

---

**[← Previous: Lab 03](./03-security-onelake-ddm.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 05: Batch Ingestion](./05-batch-ingestion-shortcuts-mirroring.md)**
