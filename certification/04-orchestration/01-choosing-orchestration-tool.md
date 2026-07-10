---
title: Choosing an Orchestration Tool
type: topic
tags:
  - dp-700
  - fabric
  - orchestration
  - dataflow-gen2
  - pipelines
  - notebooks
  - decision-matrix
---

# Choosing an Orchestration Tool

## Overview

Microsoft Fabric gives you three overlapping ways to move, transform, and orchestrate data: **Dataflow Gen2** (low-code, Power Query-based ETL), **pipelines** (low-code control-flow orchestrator), and **notebooks** (code-first Spark). None of them is "wrong" for a given job — the exam tests whether you can read a scenario's constraints (authoring skill level, source variety, transform complexity, cost sensitivity, orchestration needs) and pick the tool that fits, or combine them correctly in one solution.

> [!abstract]
>
> - **Dataflow Gen2** is the Power Query-based, low-code transform engine with 300+ transformations and 170+ connectors — best for citizen-developer ETL and visual data prep
> - **Pipelines** are the low-code orchestrator: control flow (loops, conditionals, parameters), scheduling, and event triggers — best for coordinating multi-step workflows, not for heavy row-level transform logic itself
> - **Notebooks** are full Spark code (PySpark, Scala, SQL, R) — best for complex transformations, custom logic, and machine learning that a visual tool can't express
> - These tools **compose**: a pipeline commonly orchestrates a Dataflow Gen2 activity and a Notebook activity in the same run, rather than a solution being "either/or"

> [!tip] What the Exam Tests
>
> - Matching a scenario's authoring-skill level, source complexity, and transform requirements to the right tool (or combination)
> - Recognizing when Dataflow Gen2's low-code ceiling is too low for the described transform, forcing a notebook
> - Knowing which capabilities are pipeline-only (scheduling, event triggers, control-flow activities) versus Dataflow Gen2-only (Power Query's 300+ transform library)
> - The GA/Preview status of Dataflow Gen2 public parameters, and how it constrains scheduling/triggering a parameterized dataflow

---

## The Three Orchestration Surfaces

Fabric's Data Factory experience frames the choice as **ETL vs. ELT**: Dataflow Gen2 transforms data *before* loading it (classic ETL, Power Query-based), while pipelines and notebooks favor **ELT** — load raw data first, then transform it with the power of Spark or SQL-based compute once it's in OneLake. A real solution almost always blends both approaches, and a pipeline is usually the thing tying them together.

| Tool | What it is | Primary strength |
| :--- | :--- | :--- |
| **Dataflow Gen2** | Power Query editor: connect, clean, transform, load to a destination | Low-code, visual, 300+ built-in transformations, no cluster to manage |
| **Pipeline** | Drag-and-drop canvas of activities with control flow, scheduling, and triggers | Orchestration: sequencing, branching, looping, and coordinating other items |
| **Notebook** | Code cells running on a Spark pool (PySpark, Scala, Spark SQL, R) | Full programmability — anything Power Query can't express, at Spark scale |

## Decision Matrix

| Dimension | Dataflow Gen2 | Pipeline | Notebook |
| :--- | :--- | :--- | :--- |
| **Authoring skill level** | Low-code — Power Query, familiar from Excel/Power BI | Low-code — drag-and-drop canvas, minimal scripting | Code-first — Python/Scala/SQL/R required |
| **Sources / connectors** | ==170+ connectors== via Get Data (databases, files, web services, Fabric items) | ==170+ connectors== via Copy activity/Copy job — the same connector library, movement-focused | Whatever the Spark runtime and installed libraries can reach; typically OneLake, JDBC, APIs via code |
| **Transform power** | ==300+ built-in transformations== (joins, aggregations, pivots, cleansing) via visual Applied Steps | None natively — pipeline activities call *other* tools (Copy, Notebook, Stored Procedure) to transform | Unlimited — arbitrary PySpark/Scala/SQL/R logic, custom libraries, ML models |
| **Compute / cost model** | Fabric-managed compute; creates internal `DataflowsStagingLakehouse`/`DataflowsStagingWarehouse` items; consumes CU per refresh | Consumption-based CU per activity run + data movement; orchestration-only activities are cheap, compute-heavy activities (Notebook, Dataflow) cost what *they* cost | Spark pool consumption — CU based on node size/count and session duration; can be the most expensive per-run if oversized |
| **Orchestration capabilities** | ==None== — no native scheduling of *other* items, no control flow; can be scheduled itself or invoked from a pipeline | ==Full== — schedules, event triggers, ForEach/If/Switch/Until, Invoke Pipeline, Fail activity, retries | Can call other notebooks via `notebookutils.notebook.run`/`runMultiple`, but no schedule/event-trigger UI of its own beyond a direct notebook schedule |
| **Git support** | GA with CI/CD (all new Dataflow Gen2 items since April 2026 default to CI/CD-enabled; classic non-CI/CD dataflows still work but are no longer creatable) | GA | GA (`.ipynb` source-controlled) |
| **Parameterization** | **Public parameters is Preview** — required/optional typed parameters settable via REST API or a pipeline's Dataflow activity, but a dataflow with *required* public parameters can't be scheduled or manually triggered | Full — pipeline parameters (immutable per run) + variables (mutable via Set/Append Variable) + full expression language | Parameter cell + base parameters passed from a pipeline Notebook activity, or `args` dict via `notebookutils.notebook.run`/`runMultiple` |
| **When NOT to use** | Row-by-row custom logic, ML, anything outside the 300+ transform catalog, or any scenario needing a required parameter *and* a schedule/trigger (Preview limitation) | Heavy in-activity transformation — a pipeline should call a notebook/dataflow for that, not try to do it with Copy/Lookup gymnastics | Business-user self-service — a notebook requires code literacy; also overkill for a simple single-source copy-and-load |

> [!note] Mental model — Power-user appliance, conductor, and workshop
> Think of **Dataflow Gen2** as a power-user kitchen appliance: point it at ingredients (sources), pick from a large menu of pre-built techniques (300+ transforms), and it does the prep work — no need to know how a knife is forged. A **pipeline** is the *conductor* standing in front of an orchestra: it doesn't play any instrument itself, it decides *when* each player (activity) starts, in what order, and what happens if one misses a note (retry/failure branch). A **notebook** is the *workshop* — full tools, full freedom, but you're the one operating the equipment; nothing happens unless you write the code that does it.

---

## Worked Scenario 1: Business Analyst, Multiple Cloud Sources, No Cluster Management

**Scenario:** A business analyst with strong Excel/Power Query experience but no coding background needs to combine data from a SharePoint list, a Snowflake table, and an Azure SQL database, apply about a dozen cleansing and join steps, and land the result in a Lakehouse table refreshed nightly. There's no requirement to coordinate this with any other workflow.

**Choose:** **Dataflow Gen2**, scheduled to refresh nightly on its own (no pipeline needed).

**Why:** The authoring skill level (Power Query-familiar, non-coder) and the transform complexity (a dozen cleansing/join steps, well within the 300+ transform library) both point straight at Dataflow Gen2. All three sources (SharePoint, Snowflake, Azure SQL) are supported connectors, and Lakehouse Tables is a supported output destination. Because there's no other item to coordinate with and no required parameter, Dataflow Gen2 can be scheduled directly — a pipeline would add orchestration machinery this scenario doesn't need.

**Practice Question 1** *(Easy)*

A citizen developer wants to combine three connector-supported sources with only built-in visual transformations, with no downstream coordination required. Which tool minimizes both authoring effort and unnecessary orchestration overhead?

A. A notebook using PySpark DataFrame joins
B. A pipeline with three Copy activities feeding a Stored Procedure activity
C. Dataflow Gen2, scheduled directly
D. A pipeline invoking a Dataflow Gen2 activity

> [!success]- Answer
> **C. Dataflow Gen2, scheduled directly**
> The scenario has no need for pipeline-level control flow or coordination with other items — adding a pipeline (option D) only makes sense once there's something else to orchestrate around the dataflow. A notebook (A) requires code the analyst doesn't have, and Copy + Stored Procedure (B) can't reproduce a dozen Power Query cleansing/join steps without significant custom SQL.

---

## Worked Scenario 2: Complex Deduplication Logic Feeding a Warehouse, on a Multi-Step Nightly Run

**Scenario:** An engineering team needs to: (1) ingest daily files landing in a storage account, (2) apply a custom fuzzy-deduplication algorithm too complex for Power Query's built-in transforms (a multi-pass matching routine with configurable thresholds), (3) write the deduplicated result to a Warehouse table, and (4) send a Teams notification if any step fails. The whole sequence must run automatically every night and be able to re-run only the failed step without repeating successful ones already stored in the Lakehouse (Best regarded as: coordinate several distinct steps with custom logic and failure handling).

**Choose:** A **pipeline** as the orchestrator, invoking a **notebook** (PySpark) for the fuzzy-deduplication step, with a **Fail activity** and **Teams activity** wired to the failure path; scheduled nightly on the pipeline.

**Why:** The dedup logic (multi-pass fuzzy matching with configurable thresholds) exceeds what Power Query's transform catalog can express — that's a hard signal for a notebook, not Dataflow Gen2. But the scenario also needs *coordination*: sequencing ingest → transform → load, retry/failure handling, and a Teams notification — capabilities that live only in a pipeline (Dataflow Gen2 and notebooks don't have control-flow or native failure-branch orchestration). The correct architecture composes both: pipeline as conductor, notebook as the workshop doing the heavy transform.

**Practice Question 2** *(Hard)*

A pipeline needs to run a custom multi-pass matching algorithm that can't be expressed in Power Query's transform library, then notify a Teams channel only if that step fails. Which combination correctly assigns responsibility to each tool?

A. Dataflow Gen2 for the matching algorithm; Dataflow Gen2's own failure setting for the Teams notification
B. A Notebook activity for the matching algorithm; a Teams activity connected to the notebook activity's failure path
C. A Notebook activity for the matching algorithm; the notebook's own `try/except` block sends the Teams message directly via REST
D. A Copy activity with a complex column mapping expression for the matching algorithm; a Web activity for the Teams notification

> [!success]- Answer
> **B. A Notebook activity for the matching algorithm; a Teams activity connected to the notebook activity's failure path**
> Custom, code-level logic like multi-pass fuzzy matching is exactly what a notebook is for — Dataflow Gen2's transform catalog and a Copy activity's column mappings both cap out well short of this. Conditional Teams notification on failure is a pipeline-level concern (the `UponFailure` path wired to a Teams activity), not something the notebook itself should own — keeping notification logic in the pipeline keeps it visible, reusable, and independent of the notebook's own code.

---

## Worked Scenario 3: Team Migrating from Azure Data Factory, Python-First Culture

**Scenario:** A team currently running dozens of Azure Data Factory pipelines is moving their workloads into Fabric. Most of their existing orchestration logic is straightforward copy-and-transform work that maps cleanly onto pipeline activities, but a subset of their workflows are Python-authored Apache Airflow DAGs (built by data engineers who prefer code-first, provider-ecosystem-driven orchestration over a drag-and-drop canvas) that call third-party Airflow operators unavailable in Fabric's activity catalog.

**Choose:** **Pipelines** for the ADF-equivalent copy/transform workloads; **Apache Airflow job** (see [04-Airflow Settings](../01-fabric-workspace-settings/04-airflow-settings.md)) for the Python-DAG-based subset — not a forced migration of everything into one tool.

**Why:** This scenario is a reminder that Fabric's orchestration surface isn't limited to the three tools compared in this file's decision matrix — pipelines, Dataflow Gen2, and notebooks. **Apache Airflow job** is a fourth, code-first orchestration surface purpose-built for teams with existing Airflow DAGs or a dependency on the Airflow provider ecosystem (for example, `astronomer-cosmos` for dbt orchestration). Forcing every ADF workload into a Fabric pipeline just for consistency ignores that the *code-first, DAG-based, provider-ecosystem* requirement is a real constraint pipelines don't solve — Apache Airflow job does, without requiring the team to hand-translate provider-specific DAG logic into pipeline activities that might not exist.

> [!note] Mental model — a fourth appliance in the kitchen
> Extend the earlier appliance/conductor/workshop mental model with a **fourth tool**: Apache Airflow job is a specialized appliance built specifically for one job — running Python DAGs with the Airflow provider ecosystem — the way a bread machine only makes bread but does it exactly the way an experienced baker expects. It's not competing with the pipeline "conductor" for general orchestration; it's the right pick specifically when the team's existing investment and skill set is already Airflow-shaped.

## Common Exam Distractor Patterns

> [!warning] Common Mistake
> Watch for these recurring distractor shapes in scenario questions:
>
> - **"Dataflow Gen2 can schedule other pipelines/notebooks."** It can't — Dataflow Gen2 has no control-flow or scheduling-of-other-items capability. Only a pipeline orchestrates other items.
> - **"A notebook has a built-in visual drag-and-drop transform canvas like Power Query."** It doesn't — a notebook is code cells; a pipeline canvas is drag-and-drop but for *activities*, not row-level transforms.
> - **"Dataflow Gen2 public parameters let you fully parameterize a scheduled, triggered dataflow today."** Public parameters is **Preview**, and a dataflow with *required* public parameters explicitly **can't** be scheduled or manually triggered — a scenario combining "must run on a schedule" with "must accept a required runtime parameter" describes an unsupported configuration for Dataflow Gen2 as of this writing.
> - **"Pick the cheapest tool" without checking the transform requirement first.** Dataflow Gen2 or a lightweight pipeline may look cheaper on paper, but if the described transform logic exceeds the low-code ceiling, the "cheap" choice simply doesn't work — cost is a tiebreaker among viable options, not the first filter.
> - **"Notebooks can't be scheduled without a pipeline."** They can — a notebook has its own native schedule option, distinct from a pipeline's Notebook activity. The exam-relevant nuance is the **identity** each run executes as (see [02-Schedules & Triggers](./02-schedules-triggers.md)), not whether native scheduling exists.

**Practice Question 3** *(Medium)*

A requirements document states: "The dataflow must expose a required `region` parameter that callers set at run time, and must also run automatically every morning at 6 AM with no external trigger." What's the issue with implementing this directly as a scheduled Dataflow Gen2 with a required public parameter?

A. There's no issue — Dataflow Gen2 supports both simultaneously today
B. Public parameters is Preview, and a dataflow with a required public parameter can't be scheduled or manually triggered — the two requirements conflict as described
C. Dataflow Gen2 doesn't support parameters at all
D. The parameter must be optional, but optional parameters can't be passed from a pipeline

> [!success]- Answer
> **B. Public parameters is Preview, and a dataflow with a required public parameter can't be scheduled or manually triggered — the two requirements conflict as described**
> Per Microsoft's documented limitation, dataflows using public parameter mode "can't be scheduled or manually triggered via Fabric, unless no required parameters are set." A design needing both a required runtime parameter *and* an unattended daily schedule needs a workaround — for example, a pipeline that supplies the parameter value via a Dataflow activity on its own schedule, rather than scheduling the dataflow directly.

---

## Use Cases

- A self-service analyst combining SharePoint, SQL, and SaaS-connector sources with only visual transformations, refreshed on a simple schedule — Dataflow Gen2 alone
- A nightly medallion-architecture run: Copy activity lands raw files, a Notebook activity applies bronze→silver→gold Spark transformations, a Refresh SQL Endpoint activity exposes the result — pipeline orchestrating a notebook
- A pipeline that calls a Dataflow Gen2 activity for a well-understood cleansing step, then hands off to a notebook for a custom scoring model — all three tools in one run
- A data science team iterating on feature engineering logic that changes weekly and needs unit-testable, source-controlled code — notebook, invoked ad hoc or via pipeline schedule

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| A parameterized Dataflow Gen2 won't accept a schedule or manual trigger | Required public parameters are set, and public parameter mode blocks scheduling/manual triggering while any required parameter exists | Make the parameter optional with a sensible default, or move the run-with-parameter logic into a pipeline's Dataflow activity instead |
| A "simple" Dataflow Gen2 transform silently caps out on complex logic | The needed transform (e.g., multi-condition fuzzy matching, iterative algorithms) isn't in the 300+ built-in catalog | Move that step to a Notebook activity called from a pipeline; keep the rest of the flow in Dataflow Gen2 if it still fits |
| A pipeline's Copy/Lookup activities are being stretched to do row-level transformation | Team defaulted to "pipeline for everything" without evaluating transform complexity | Insert a Notebook or Dataflow Gen2 activity for the transform step; keep the pipeline focused on orchestration |
| Unexpected internal `DataflowsStagingLakehouse`/`DataflowsStagingWarehouse` items appear in the workspace | Dataflow Gen2's high-performance compute engine creates these automatically for staging | Expected behavior — don't delete or modify them directly; they're internal to Dataflow Gen2 execution |
| A notebook scheduled independently runs with unexpected permissions | Notebook scheduler runs as whoever created/last updated the *schedule*, not the pipeline caller or notebook owner | Confirm the schedule owner has the correct data-access permissions before relying on a native notebook schedule |

## Best Practices

- Default to the lowest-code tool that can express the required transform — Dataflow Gen2 before notebook — but don't force a transform into Dataflow Gen2 past its 300+ transform ceiling just to avoid writing code
- Use a pipeline as the coordination layer whenever more than one item (dataflow, notebook, copy) needs to run in sequence, share parameters, or share a failure-handling path
- Keep custom, testable, source-controllable logic in notebooks rather than deeply nested pipeline expressions — expressions are for wiring, not business logic
- Treat Dataflow Gen2 public parameters as not-yet-production-ready for scenarios requiring both required parameters and unattended scheduling, given its current Preview status and documented scheduling restriction

## Exam Tips

> [!tip] Exam Tips
>
> - If a scenario says "no-code" or "citizen developer," lean Dataflow Gen2; if it says "custom algorithm," "machine learning," or "logic beyond built-in transforms," lean notebook
> - Only a **pipeline** schedules/triggers *other items* and provides control-flow (loops, conditionals) and failure-branch orchestration — Dataflow Gen2 and notebooks can each be scheduled on their own, but neither orchestrates other items
> - Dataflow Gen2 **public parameters = Preview**, and required public parameters block scheduling/manual triggering — a frequently tested conflict
> - A composed solution (pipeline + dataflow + notebook in one run) is often the *correct* answer over any single tool when a scenario has both orchestration needs and transform-complexity needs
> - Notebook execution identity differs by trigger type — interactive (current user), pipeline-invoked (pipeline's last-modified user), scheduled (schedule's creator/last-updater)

## Key Takeaways

- Dataflow Gen2 = low-code Power Query ETL with 300+ transforms and no orchestration of other items; best for citizen-developer, connector-supported, visually-expressible transforms
- Pipeline = the only tool with scheduling, event triggers, control flow, and failure-branch orchestration across items; it coordinates, it doesn't itself do heavy row-level transformation
- Notebook = unrestricted Spark code; the answer whenever transform complexity or custom logic exceeds Power Query's catalog
- Real solutions frequently compose all three — the exam rewards recognizing *when to combine* tools, not just picking one in isolation
- Dataflow Gen2 public parameters is a Preview feature with a documented scheduling/triggering restriction on required parameters — a common exam trap

## Related Topics

- [02-Schedules & Triggers](./02-schedules-triggers.md)
- [03-Orchestration Patterns](./03-orchestration-patterns.md)
- [04-Airflow Settings](../01-fabric-workspace-settings/04-airflow-settings.md)

## Official Documentation

- [What is Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/data-factory-overview)
- [Differences between Dataflow Gen1 and Dataflow Gen2](https://learn.microsoft.com/en-us/fabric/data-factory/dataflows-gen2-overview)
- [Use public parameters in Dataflow Gen2 (Preview)](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-parameters)
- [Activity overview](https://learn.microsoft.com/en-us/fabric/data-factory/activity-overview)
- [How to use Fabric notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/how-to-use-notebook)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../03-security-governance/05-governance.md) | [↑ Back to Section](./orchestration.md) | [Next →](./02-schedules-triggers.md)**
