---
title: "Lab 10: Monitor & Optimize"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - monitoring
  - monitor-hub
  - direct-lake
  - capacity-metrics
  - optimization
status: complete
---

# Lab 10: Monitor & Optimize

## Overview

The capstone lab: tour the Monitor hub against everything the previous nine labs actually ran, force a pipeline to fail and rerun it from the failed activity, drill into a Spark application's Jobs/Stages/Executors detail, build a small Direct Lake semantic model on `wh_gold` and watch framing happen, install and understand the Capacity Metrics app, run one final `OPTIMIZE` pass across every lab table, and close with a teardown decision.

> [!abstract]
>
> - Tours the **Monitor hub** across every item type this lab pack produced: pipelines, notebooks, Spark applications, Eventstream, Copy job
> - Forces `pl_orchestration_demo` ([Lab 04](./04-orchestration-pipelines-notebooks.md)) to fail, then uses **Rerun from failed activity**
> - Opens a Spark application's **Jobs/Stages/Executors** detail for a [Lab 07](./07-pyspark-transformation.md) notebook run
> - Builds a **Direct Lake** semantic model on `wh_gold` ([Lab 08](./08-warehouse-tsql.md)) and demonstrates metadata-only **framing** on refresh
> - Installs the **Capacity Metrics app** (documents the admin-only install requirement) and reads capacity utilization
> - Runs a final `OPTIMIZE` pass across every lab table, reviews `queryinsights` once more, and closes with a teardown decision

> [!info] Prerequisites
> All of [Labs 01–09](./labs.md) completed — this lab is a tour of what they produced, not a new build. If you skipped an optional step somewhere along the way (an external shortcut, a mirrored database), the corresponding monitoring surface simply has less to show; nothing in this lab blocks on that.
>
> **Estimated time:** 35 minutes

---

## Steps

### Step 1: Tour the Monitor hub across every item type

1. In `dp700-labs`, select **Monitor** in the left nav.
2. Note the **Item type** filter — select it and observe the full list of types this lab pack has produced runs for: **Data pipeline**, **Notebook**, **Spark application**, **Eventstream**, **Copy job**.
3. Clear the filter, then sort by **Start time** descending to see the full chronological run history across the whole pack.
4. Select **Status: Failed** in the filter to see if anything unexpectedly failed along the way (aside from the deliberate failure you're about to trigger in Step 2).

> [!success] Expected result
> The unfiltered list shows entries from `nb-generate-dataset` (Lab 01), `pl_orchestration_demo` (Lab 04), `pl_copy_events` and `cj_orders_incremental` if run (Lab 05), `nb-loading-patterns` (Labs 06–07), and `es_dp700_stream`'s ingestion activity (Lab 09) — one hub, every workload type, confirming the [Monitor hub's role as Fabric's central activity view](../../09-monitoring-alerting/01-monitoring-surfaces.md#the-monitor-hub-fabrics-central-activity-view) rather than each item type needing its own separate monitoring page.

**Quick check**: work through this symptom cold, then check your reasoning: *"A dashboard built on `sm_dp700_gold` (Step 4, later in this lab) is showing stale numbers this morning — where do you look first?"*

> [!success]- Answer
> Not the Monitor hub's pipeline view — a stale Direct Lake dashboard is a **semantic model refresh/framing** symptom, so the first stop is the semantic model's own **Refresh history** (Step 4 covers this directly), not a pipeline run log. Only if refresh history shows a clean, recent success would you widen the search to whether the *upstream* warehouse tables themselves are stale, at which point the Monitor hub's pipeline/notebook views become relevant again. This symptom → surface routing judgment — not memorizing every button — is what [01-Monitoring Surfaces § Decision Guidance](../../09-monitoring-alerting/01-monitoring-surfaces.md#decision-guidance-symptom--which-surface-to-open-first) is built to test.

### Step 2: Force a pipeline failure, then rerun from the failed activity

1. Open `pl_orchestration_demo` ([Lab 04](./04-orchestration-pipelines-notebooks.md)). Select **Run**.
2. Let it run to completion — recall from Lab 04 that the `order_items` row in `control_tables` deliberately fails `Notebook_RowCountCheck`'s row-count assertion, tripping `Fail_RowCountCheck` on the **Upon Failure** path.
3. In **Monitor**, find this run (Status: **Failed**) and select it to open **run details**.
4. Select **Rerun** → **Rerun from failed activity**.

> [!success] Expected result
> The rerun skips every `ForEach_Table` iteration that already succeeded and starts again only from the failed iteration's failed activity — visibly faster than a full **Rerun** (entire pipeline), and the reason it still ends **Failed** (the underlying `order_items` assertion is deliberately wrong, per Lab 04's design) rather than succeeding this time. This is the mechanic from [Monitor pipeline runs § Rerun](https://learn.microsoft.com/en-us/fabric/data-factory/monitor-pipeline-runs): choosing **Rerun from failed activity** instead of a full **Rerun** is what saves redundant work on a long, mostly-successful pipeline.

> [!note] Mental model
> A full **Rerun** re-executes the entire pipeline from `Lookup_ControlTable` onward — every `ForEach` iteration, including the ones that already succeeded. **Rerun from failed activity** resumes only the failed branch. On a 5-row `ForEach` like this lab's, the difference is cosmetic; on a production pipeline with hundreds of iterations and a transient failure on iteration 240, it's the difference between minutes and hours.

### Step 3: Spark application detail — Jobs, Stages, Executors

1. In **Monitor**, filter **Item type: Notebook**, find the most recent `nb-loading-patterns` run (from [Lab 07](./07-pyspark-transformation.md)).
2. Select the run → **Spark application details** to open the full Spark UI.
3. **Jobs** tab: note total job count, and select the job that corresponds to Step 4's `OPTIMIZE` call from Lab 07.
4. **Stages** tab: for that job, read **Shuffle Read**/**Shuffle Write** and **Input**/**Output** columns.
5. **Executors** tab: note how many executors were allocated, and their peak memory usage — this reflects whichever Spark pool the notebook was attached to (the workspace's default **Starter pool**, per [Lab 01 Step 3](./01-workspace-capacity-setup.md#step-3-inspect-the-spark-starter-pool-then-create-a-custom-pool)).
6. **Environment** tab: confirm the Spark properties in effect, including whether `spark.databricks.delta.retentionDurationCheck.enabled` shows `true` (it should, per [Lab 07 Step 5](./07-pyspark-transformation.md#step-5-vacuum--trigger-the-retention-rejection-then-run-it-correctly)'s final re-enable).

> [!success] Expected result
> You can name, without notes, what each of the four tabs shows: Jobs = one entry per Spark action, Stages = shuffle/IO detail within a job, Executors = compute allocation and memory pressure, Environment = the actual runtime config a job executed under — the full drill-down path described in [01-Monitoring Surfaces § Spark Application Monitoring](../../09-monitoring-alerting/01-monitoring-surfaces.md#spark-application-monitoring).

**One more tab worth checking**: on the **SQL / DataFrame** tab, open the query plan for the job behind [Lab 07 Step 2](./07-pyspark-transformation.md#step-2-join-with-a-broadcast-hint)'s join and look for an `AdaptiveSparkPlan` node wrapping the physical plan.

> [!success] Expected result
> The presence of `AdaptiveSparkPlan` confirms Adaptive Query Execution (AQE) is active for this session — Fabric enables it by default. AQE is what lets Spark change its join strategy or shuffle partition count *mid-query*, based on actual runtime statistics rather than the pre-execution estimate alone; it's a large part of why the broadcast join from Lab 07 behaved predictably even though this lab pack's table sizes were only estimated, not measured, going in. See [03-Spark Optimization § Adaptive Query Execution (AQE)](../../11-performance-optimization/03-spark-optimization.md#adaptive-query-execution-aqe).

### Step 4: Build a Direct Lake semantic model on `wh_gold`

1. Open `wh_gold` ([Lab 08](./08-warehouse-tsql.md)). Select **New semantic model** from the ribbon (or, if a default semantic model already exists for the warehouse, select **Manage default semantic model**).
2. Name it `sm_dp700_gold`. Select tables to include: `DimProduct`, `FactOrderItems`, `Customers`.
3. Select **Confirm**. The model opens in the web modeling view — create a relationship: `FactOrderItems.ProductKey` → `DimProduct.ProductKey`, and `FactOrderItems.CustomerKey` → `Customers.CustomerID`.
4. Save the model.

> [!success] Expected result
> `sm_dp700_gold` appears as a new item in `dp700-labs`. Because its tables come from a Fabric Warehouse's Delta-backed tables, the model uses **Direct Lake on SQL** storage mode automatically — no explicit "choose storage mode" step exists for a warehouse-sourced model, unlike Power BI Desktop's Import/DirectQuery choice. Confirm this from **Model settings → Direct Lake behavior**. `dbo.Customers` intentionally holds only the 5 demo rows seeded in [Lab 03](./03-security-onelake-ddm.md), so most `FactOrderItems` rows will show blank customer attributes when you browse the model — that's expected, not a bug: Direct Lake tolerates orphaned fact keys with no matching dimension row rather than failing the relationship.

Next, add a new row to `dbo.DimProduct` via a **New SQL query** in `wh_gold`:

```sql
INSERT INTO dbo.DimProduct (ProductKey, ProductName, Category, UnitPrice)
VALUES (9999, 'Lab Test Product', 'Electronics', 42.00);
```

1. Open `sm_dp700_gold` → **...** → **Refresh now** (or trigger from the semantic model's item context menu).
2. Check **Refresh history**.

> [!success] Expected result
> The refresh completes in a few seconds, not minutes — because a Direct Lake refresh only reframes metadata (updates which OneLake file versions the model points at), it never re-copies the underlying data the way an Import-mode refresh would. This is the core distinction from [09-Semantic Model Refresh § Refresh Types: Import vs. Direct Lake Framing](../../09-monitoring-alerting/02-semantic-model-refresh.md#refresh-types-import-vs-direct-lake-framing) — query `sm_dp700_gold`'s `DimProduct` table afterward (via a report visual or **DAX query view**) and confirm `Lab Test Product` (`ProductKey 9999`) is visible, proving the reframe picked up the new row without a data copy.

> [!warning] Common Mistake
> Because `sm_dp700_gold` is sourced from `wh_gold`'s SQL analytics endpoint, it uses **Direct Lake on SQL**, not **Direct Lake on OneLake** — and Direct Lake on SQL silently **falls back to DirectQuery** whenever it can't load a table directly from a Delta table (a table built on a non-materialized SQL view, or one where SQL-based granular access control like `dbo.Customers`'s RLS/CLS applies). Because `Customers` carries an active RLS policy from Lab 03, queries against that table in `sm_dp700_gold` fall back to DirectQuery rather than failing outright — slower, but still correct, and exactly why the [Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview#considerations-and-limitations) calls this out as a named consideration, not an edge-case bug. Check the **Direct Lake** tab in **Refresh history** to see any fallback events called out explicitly.

### Step 5: Capacity Metrics app — install requirement and tour

1. As the **capacity administrator** of your trial capacity (you, since you activated the trial in [Lab 01](./01-workspace-capacity-setup.md#step-1-activate-the-fabric-trial)), go to [AppSource → Microsoft Fabric Capacity Metrics](https://go.microsoft.com/fwlink/?linkid=2219875) and select **Get it now** (or, in the Power BI experience, **Apps → Get apps → Microsoft Fabric Capacity Metrics → Get it now**).
2. Complete the install prompts, select **Install**, and wait for provisioning.
3. On first run, connect the app: set **UTC_offset** to your timezone, **RegionName** to `Default` (typical for a single-region trial tenant), authenticate with **OAuth2**, and select your trial capacity from the **Capacity Name** dropdown.
4. Explore the **Capacity Utilization** page — filter to today's date and look for the CU consumption spikes from this lab pack's heaviest operations (Lab 07's `OPTIMIZE`/`VACUUM` calls, Lab 09's continuous Eventstream sample traffic).

> [!success] Expected result
> Installing the app requires being a **capacity admin** — you qualify because activating the trial in Lab 01 made you the Capacity administrator of that trial capacity by definition, per [Install the Microsoft Fabric capacity metrics app](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app-install#prerequisites). In a real organization, a data engineer without capacity-admin rights **cannot** self-install this app — it has to come from whoever administers the capacity, a frequently-tested distinction from item-level Contributor/Admin roles. The **Capacity Utilization** page shows a timeline of CU consumption you can correlate against this lab pack's history in the Monitor hub from Step 1.

> [!note]
> The metrics app's **Utilization** page reports capacity consumption at 30-second granularity, broken down by workspace and by item — drill into a spike and it names the exact operation (a notebook run, a warehouse query, an Eventstream ingestion burst) that caused it. The **Compute (Preview)** page shows **future** and **carry-forward** smoothing: Fabric spreads background-job CU spikes across a rolling 24-hour window rather than charging them instantly, which is why a heavy operation (like Lab 07's `OPTIMIZE`/`VACUUM` pass) doesn't necessarily show as one sharp spike here even though the Monitor hub shows it as a single fast-running job.

### Step 6: Final optimization pass across every lab table

Open a new notebook (or reuse an existing one) and attach it to `lh_bronze` as its default lakehouse before running the cell below — the `spark.catalog.currentDatabase()` check needs a default lakehouse context to resolve unqualified table names against `lh_bronze` correctly.

```python
tables_to_optimize = {
    "lh_bronze": ["customers", "products", "orders", "order_items", "events"],
    "lh_silver": ["orders_incremental", "dim_customers", "silver_order_items", "gold_sales_by_region_month"],
}

for lakehouse, tables in tables_to_optimize.items():
    for t in tables:
        full_name = t if lakehouse == spark.catalog.currentDatabase() else f"{lakehouse}.{t}"
        try:
            spark.sql(f"OPTIMIZE {full_name}")
            print(f"OPTIMIZE succeeded: {full_name}")
        except Exception as e:
            print(f"Skipped {full_name}: {type(e).__name__}")
```

> [!success] Expected result
> Every table reports `OPTIMIZE succeeded` — this lab pack's synthetic dataset is small enough that no table accumulated a serious small-file problem on its own, but running the pass explicitly closes out the lab pack the way a real project would before a review: compact, then move on. Re-run the [queryinsights.exec_requests_history query from Lab 08](./08-warehouse-tsql.md#step-5-inspect-query-insights-for-the-statements-you-just-ran) once more against `wh_gold` — the statement history you review there now spans the entire lab pack's warehouse activity, not just Lab 08's.

### Step 7: Teardown decision

Two supported paths, neither wrong:

**Keep the workspace** (recommended if you're still studying): do nothing. The trial capacity runs for 60 days from activation regardless of whether you keep working in it — check remaining days via **Account manager → Trial status**. Everything built across all ten labs stays queryable for continued review and spaced-repetition practice against the topic files. If you want to stop background activity without tearing anything down, pause `es_dp700_stream`'s still-running Stock Market sample source per [Lab 09 Cleanup](./09-streaming-eventstream-kql.md#cleanup) — everything else in the pack is idle by default and doesn't need a similar pause.

**Delete the workspace** (if you're done and want to reclaim OneLake storage / stop the Eventstream's background sample traffic immediately):

1. Before deleting, confirm nothing here is referenced from outside `dp700-labs` — this lab pack never shared an item or built a cross-workspace shortcut *into* `dp700-labs`, so a full-workspace delete is safe without a separate per-item audit.
2. If you kept them from [Lab 02](./02-lifecycle-git-deployment.md#cleanup), also delete `dp700-labs-dev`, the `dp700-pipeline [Test]` workspace, and the `dp700-pipeline` deployment pipeline itself for a fully clean slate. Unassign the Test stage from the pipeline first (workspace page → **View Deployment Pipeline** → unassign) — deleting the Test-stage workspace while it's still assigned fails outright.
3. **Workspace settings → General → Remove this workspace**.
4. Confirm the deletion — this is irreversible and removes every item built across all ten labs at once, including `es_dp700_stream`'s still-running Stock Market sample source (see [Lab 09 Cleanup](./09-streaming-eventstream-kql.md#cleanup)) if you didn't already pause it.

> [!success] Expected result
> Either the workspace remains active with 60-day trial status visible, or it's fully removed and no longer appears in your workspace list. There's no partial-teardown requirement — Fabric doesn't charge anything additional for an idle trial-capacity workspace beyond the trial's own 60-day clock, so "keep everything until the trial expires naturally" is a perfectly reasonable default if undecided.

### Step 8: Recap — the whole lab pack, end to end

Ten labs, one workspace, one dataset. Before closing out, trace the full chain from memory:

| Lab | Domain | Built | Feeds into |
| :--- | :--- | :--- | :--- |
| 01 | 1 | `dp700-labs`, `lh_bronze` (5 Delta tables + CSVs), Spark pool/environment tour, domain, Airflow settings tour | Every later lab |
| 02 | 1 | Git integration, deployment pipeline stages | Lifecycle practice, not a data dependency |
| 03 | 1 | `wh_gold`, `dbo.Customers` with RLS/CLS/DDM, OneLake data access role | Lab 08 |
| 04 | 1 | `pl_orchestration_demo` (Lookup → ForEach → Notebook, on-failure branch) | Lab 10's rerun-from-failed demo |
| 05 | 2 | `lh_silver`, internal shortcut, `events_staged`, `orders_incremental`, Copy job/mirroring tour | Labs 06–08 |
| 06 | 2 | Watermark incremental load, `dim_customers` (SCD2), inferred member, idempotency proof | Lab 07 |
| 07 | 2 | `silver_order_items`, `gold_sales_by_region_month`, `OPTIMIZE`/V-Order/`VACUUM` | Lab 08 |
| 08 | 2 | `DimProduct`, `FactOrderItems` in `wh_gold` via cross-database CTAS, `MERGE` upsert | Lab 10's Direct Lake model |
| 09 | 2 | `eh_dp700`, `es_dp700_stream`, update policy, materialized view, Activator alert, accelerated shortcut | Lab 10's monitoring tour |
| 10 | 3 | Monitor hub tour, rerun-from-failed, Spark UI detail, Direct Lake model, Capacity Metrics app, final `OPTIMIZE` pass | Nothing — this is the capstone |

> [!success] Expected result
> You can trace, without opening this table again, why `lh_bronze` from Lab 01 is the only object every single later lab ultimately depends on, and why Labs 06–08 form a tight chain (incremental/SCD load → PySpark gold aggregate → warehouse star schema) while Lab 09's streaming track runs almost entirely independently off Fabric's built-in sample data. That dependency shape — one shared foundation, one long batch chain, one short independent streaming branch — mirrors how a real Fabric data engineering project is usually structured, and is worth being able to reconstruct from memory going into the exam.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Step 2's rerun shows **Rerun** but no **Rerun from failed activity** option | The pipeline run succeeded outright (the `order_items` assertion didn't fail this time) | Confirm `control_tables`' `order_items` row still has a `min_expected_rows` value higher than the actual row count, per Lab 04's design |
| Step 3's Spark UI shows no jobs at all | The notebook run aged out of the Spark history server's retention window | Re-run a cell in `nb-loading-patterns` and open Monitor immediately afterward |
| Step 4's semantic model refresh takes much longer than expected | The model silently fell back to **Direct Lake on SQL**'s DirectQuery fallback (e.g., because a table selection included a non-materialized SQL view) | Check **Refresh history**'s **Direct Lake** tab for fallback warnings; rebuild the model selecting only base tables, not views |
| Step 5's Capacity Metrics app shows no data after connecting | First-run data population can take a few minutes | Wait and refresh the app; if still empty after several minutes, re-check the **RegionName** parameter against your capacity's actual region |
| Step 6's loop reports `Skipped` for a table | The table doesn't exist under that exact name — likely an optional step (Copy job, mirrored database) from an earlier lab wasn't run | Expected if you skipped that optional step; not a failure |
| Step 7's workspace deletion is greyed out | You're not the workspace Admin, or another user still has an active session against an item in the workspace | Confirm your role via **Manage access**, and confirm no one else is actively editing an item |

## Cleanup

This is the final lab in the pack — see **Step 7: Teardown decision** above rather than a per-item keep/delete list. If you're keeping the workspace, no further action is needed; the 60-day trial clock runs down on its own regardless of activity.

Whichever teardown path you chose, the study workflow from here is the same: use this lab pack's per-lab **What the Exam Asks About This** sections as your index back into the corresponding topic files, and use the [Step 8 recap table](#step-8-recap--the-whole-lab-pack-end-to-end) above as a one-page map of the entire pack the next time you need to jog your memory on how any two labs connect.

## What the Exam Asks About This

- [01-Monitoring Surfaces](../../09-monitoring-alerting/01-monitoring-surfaces.md) — the Monitor hub, pipeline/Spark/Eventstream/Eventhouse/Copy job monitoring, the Capacity Metrics app's admin-side view, symptom → surface decision guidance
- [02-Semantic Model Refresh](../../09-monitoring-alerting/02-semantic-model-refresh.md) — Import vs. Direct Lake framing, DirectQuery fallback, refresh history and failure diagnosis
- [03-Activator & Alerts](../../09-monitoring-alerting/03-activator-alerts.md) — revisited from [Lab 09](./09-streaming-eventstream-kql.md)'s live rule against this lab's monitoring surfaces
- [01-Lakehouse Optimization](../../11-performance-optimization/01-lakehouse-optimization.md) and [02-Warehouse Optimization](../../11-performance-optimization/02-warehouse-optimization.md) — the final `OPTIMIZE` pass and `queryinsights` review, tying every optimization concept from Labs 06–09 into one closing pass

---

**[← Previous: Lab 09](./09-streaming-eventstream-kql.md) | [↑ Back to Labs Index](./labs.md)**
