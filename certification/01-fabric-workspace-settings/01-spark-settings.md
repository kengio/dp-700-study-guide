---
title: Spark Workspace Settings
type: topic
tags:
  - dp-700
  - fabric
  - spark
  - workspace-settings
  - spark-pools
---

# Spark Workspace Settings

## Overview

Every Fabric workspace ships with a managed Apache Spark compute platform, and the **Spark settings** page in workspace settings is where you tune it — which pool notebooks and Spark job definitions use by default, how libraries and runtime versions are configured through environments, and whether accelerators like high concurrency mode and the native execution engine are switched on.

> [!abstract]
>
> - Starter pools give near-instant, Microsoft-managed sessions; custom pools trade that convenience for full control over node size, autoscale, and dynamic executor allocation
> - Environments are the reusable, versioned way to pin a Spark runtime, install libraries, and set compute properties — and can be promoted to the workspace default
> - Runtime 1.3 (Spark 3.5.5) is GA; Runtime 2.0 (Spark 4.1) is Public Preview
> - High concurrency mode shares one Spark session across up to 5 notebooks by default (raisable to 50); the native execution engine (preview) accelerates supported operators with automatic JVM fallback

> [!tip] What the Exam Tests
>
> - Choosing **starter pool vs custom pool** for a given latency/cost/control scenario, and who is allowed to configure each (workspace Admin role, plus a capacity-level permission for custom pools)
> - Reading autoscale and dynamic executor allocation settings correctly — min/max nodes vs min/max executors
> - Knowing what an **environment** controls (Spark compute + libraries + resources) versus plain **workspace default** settings
> - Recognizing high concurrency mode's session-sharing requirements and billing behavior, and the native execution engine's GA/preview status and fallback mechanism

---

## Starter Pools vs. Custom Pools

Fabric Spark compute comes in two flavors. **Starter pools** are Microsoft-managed clusters that are already running, so sessions typically start in 5–10 seconds with no setup. **Custom pools** are workspace-defined pools where you choose node family, node size, and scaling behavior yourself.

| Aspect | Starter Pool | Custom Pool |
| :--- | :--- | :--- |
| Who configures it | Nobody — Microsoft-managed by default | Workspace **Admin**; capacity admin must also enable ==Customized workspace pools== for the capacity |
| Node size | Medium only (8 vCore / 64 GB) | Small through XX-Large (Small–XX-Large; X-Large/XX-Large require a non-trial SKU) |
| Startup latency | 5–10s typical, **best-effort** (prewarmed capacity isn't guaranteed) | ~3 minutes on-demand, or ~5s if configured as a [custom live pool](https://learn.microsoft.com/en-us/fabric/data-engineering/custom-live-pools-overview) *(keeps dedicated clusters warm on a schedule)* with a Full-mode environment |
| Autoscale / dynamic allocation | Sliders only, both on by default | Full control: min/max nodes, min/max executors |
| Networking | **Not supported** with Tenant Private Links or Managed VNets — falls back to on-demand (2–5 min) | Supported |
| Autopause | 20 minutes of Spark pool inactivity | 2 minutes of inactivity (default), or always-on as a custom live pool |
| Best for | Ad hoc development, quick iteration | Production workloads, predictable/tuned compute, workloads needing Private Link or Managed VNet |

> [!note] Mental model — Starter vs custom pools
> A **starter pool** is a taxi idling at the curb: grab it and go, but on a busy day none may be free and you wait for the next one (on-demand fallback). A **custom pool** is a car you configure and keep in your own garage: setup cost up front, but it's exactly the size you specified and always where you left it.

> [!warning] Common Mistake
> Don't assume starter pools always start in 5–10 seconds. That figure only holds when there are no extra library dependencies or custom Spark properties, prewarmed capacity is available in the region, and the workspace has no Private Link or Managed VNet. Any of those conditions pushes startup to 2–5 minutes (plus 30s–5min more for library personalization).

### Node Sizes

Both pool types use the same node size table; a Spark instance always has one head node (running the driver, Livy, YARN Resource Manager) and one or more worker nodes running the Spark Executor service, in a strict 1:1 node-to-executor ratio (the exception is single-node pools, where driver and executor resources are split on the one node).

| Size | vCore | Memory |
| :--- | :--- | :--- |
| Small | 4 | 32 GB |
| Medium | 8 | 64 GB |
| Large | 16 | 128 GB |
| X-Large | 32 | 256 GB |
| XX-Large | 64 | 512 GB |

Capacity constrains how many nodes you can run: **one capacity unit (CU) = two Spark vCores** (before any burst multiplier). For example, an F64 SKU has 64 CUs → 128 base Spark vCores, and a 3x burst multiplier raises that ceiling to 384 Spark vCores available for custom pool nodes.

### Autoscale and Dynamic Allocation

These are two independent, complementary settings exposed on both starter and custom pools:

- **Autoscale** — when enabled, the pool automatically scales node count up or down between the configured minimum and maximum based on activity. When disabled, the node count stays fixed. `spark.yarn.executor.decommission.enabled` defaults to `true`, letting underutilized nodes shut down automatically; set it to `false` for less aggressive scale-down.
- **Dynamically allocate executors** — when enabled, Spark requests more executors as tasks exceed what current executors can handle, and releases them as jobs finish or the application goes idle. You configure minimum and maximum executor bounds; the system reserves executors at submission time based on the minimum.

Both settings are enabled by default on starter pools and are configured with sliders in workspace Spark settings.

---

## Environments

An **environment** is a Fabric workspace item that packages Spark session configuration — **Spark compute** (including runtime version and session-level properties), **libraries**, and **resources** (small shared files) — into a single, reusable, versioned artifact for notebooks and Spark job definitions.

Without an attached environment, a notebook or Spark job definition runs on **Workspace default**, which uses plain workspace-level Spark settings. Attaching an environment — or setting one as the workspace default — gives teams governed, reusable defaults instead of per-notebook configuration drift.

### Set an Environment as Workspace Default

In **Workspace settings → Data Engineering/Science → Spark settings → Environment tab**, toggle **Set default environment** to On and pick the environment item. Once toggled on:

- Notebooks and Spark job definitions using **Workspace default** inherit that environment's Spark compute and library configuration.
- Only **workspace admins** can subsequently edit the contents of that default environment.

### Libraries and Publishing Mode

Environments manage two kinds of libraries: built-in runtime packages and ones you add (public sources or custom uploads). Every library addition uses a **publishing mode**:

| Mode | Publish time | Session start impact | Use for |
| :--- | :--- | :--- | :--- |
| **Quick mode** | ~5 seconds | Libraries install at session start (adds 30s–5min) | Rapid iteration during development |
| **Full mode** | 3–6 minutes | Stable snapshot deploys at session start (adds 1–3 min), or ~5s if paired with a custom live pool | Pipelines, scheduled runs, shared/production workloads |

Changes to **Libraries** or **Spark compute** are staged on **Save** and only take effect after **Publish**; changes under **Resources** are real-time and need no publish step. An environment accepts only one publish operation at a time.

> [!warning] Common Mistake
> Attaching an environment from a **different workspace** silently drops that environment's compute configuration — the session instead uses the current workspace's pool and compute settings. Only the libraries and resources carry over. Also, both workspaces must share the same capacity and network security settings, or the session fails to start.

---

## Runtime Versions

Fabric Runtime bundles Apache Spark, Delta Lake, the native execution engine, and default-level Java/Scala, Python, and R packages.

| Component | Runtime 1.3 | Runtime 2.0 |
| :--- | :--- | :--- |
| Release stage | ==GA== | ==Public Preview== |
| Apache Spark | 3.5.5 | 4.1 |
| Operating system | Mariner 2.0 | Mariner 3.0 |
| Java | 11 | 21 |
| Scala | 2.12.17 | 2.13.16 |
| Python | 3.11 | 3.13 |
| Delta Lake | 3.2 | 4.1 |

All new workspaces default to the latest GA runtime, currently **Runtime 1.3**. Change the runtime at two levels:

- **Workspace level**: Workspace settings → Data Engineering/Science → Spark settings → Environment tab → select runtime version → Save. This applies to all system-created items (lakehouses, Spark job definitions, notebooks) starting from their *next* Spark session — a session already running keeps its current runtime until it restarts.
- **Environment item level**: open the environment, pick a runtime under the Runtime dropdown, Save, then Publish.

When you change runtimes, Fabric attempts to migrate compatible Spark settings and libraries automatically; incompatible settings are dropped with a warning, and JAR-based libraries are the most likely to break due to Scala/Java/OS version shifts.

---

## High Concurrency Mode

**High concurrency mode** lets compatible workloads share a single running Spark session instead of each notebook or pipeline activity starting its own. This applies to both **notebooks** and **pipeline-triggered notebook activities**.

Session sharing requires all of the following to match:

- Single-user boundary (same user)
- Same default Lakehouse configuration
- Same Spark compute settings

Each workload gets its own REPL core inside the shared session, isolating local variables from other workloads; new workloads are scheduled across REPL cores using FAIR scheduling. Because the session is already warm, subsequent workloads start dramatically faster — up to **36x** faster than a standalone session on custom pools.

**Billing**: only the notebook or pipeline activity that *initiates* the shared Spark session is billed. Sessions that join and share it aren't billed separately, and Capacity Metrics attributes usage to the initiating notebook only — this applies identically to pipeline activities.

**Session limit**: by default, up to **5 notebooks** can share one high concurrency session. Raise this to as many as **50** by setting `spark.highConcurrency.max` as a Spark property inside the **Environment** item attached to the notebooks or pipeline — Save and Publish, and all consumers of that environment inherit the new limit.

> [!note] Mental model — High concurrency mode
> Think of it as a shared conference room instead of a private office per meeting. Everyone gets their own table (REPL core) so nobody's notes get mixed up, but only whoever booked the room first pays the rental fee.

---

**Practice Question 1** *(Medium)*

A data engineering team runs five scheduled Spark job definitions every night on a tight SLA. Session start time has been inconsistent — sometimes seconds, sometimes several minutes — because the workspace relies on starter pools. Which change gives the most predictable startup time?

A. Increase the starter pool's autoscale maximum nodes  
B. Switch to a custom pool configured as a custom live pool with a Full-mode environment  
C. Enable dynamic executor allocation on the starter pool  
D. Enable high concurrency mode for the pipeline  

> [!success]- Answer
> **B. Switch to a custom pool configured as a custom live pool with a Full-mode environment**
>
> Starter pools are a best-effort, Microsoft-managed optimization — prewarmed capacity isn't guaranteed, so startup can swing from 5–10 seconds to 2–5 minutes. A custom live pool keeps dedicated clusters warm on a schedule you control, giving consistent ~5-second starts, and pairing it with a Full-mode environment means libraries are already preinstalled on the hydrated cluster. Autoscale (A) and dynamic allocation (C) affect running-job scaling, not session start latency. High concurrency (D) shares an already-started session but doesn't guarantee the first session starts quickly.

---

## Native Execution Engine

The **native execution engine (NEE)** is a vectorized C++ execution path (built on Meta's Velox and Apache Gluten) that offloads supported Spark operators from the JVM to native code for faster, cheaper execution — no code changes required. It works with Parquet, Delta, and CSV, and supports both Runtime 1.3 (Spark 3.5) and Runtime 2.0 (Spark 4.1).

> [!warning]
> NEE's tenant/workspace/environment-level enablement mechanisms are still under active development — treat the whole feature as **preview** on the exam even though individual runtime versions it runs on may be GA.

**Enable it at the environment level** (applies to all jobs/notebooks using that environment): open the environment → **Spark compute → Acceleration** tab → check **Enable native execution engine** → Save and Publish.

**Enable it per notebook or Spark job definition** by setting the Spark property at the top of the session:

```python
%%configure
{
   "conf": {
       "spark.native.enabled": "true"
   }
}
```

**Disable it for a single cell** (e.g., a query using an unsupported operator) with `spark.conf.set('spark.native.enabled', 'false')`, then re-enable it for later cells — Spark executes cells sequentially, so the setting persists until changed again.

### Automatic Fallback and Limitations

If NEE can't execute part of a query — an unsupported operator, format, or configuration — execution **automatically falls back** to the standard JVM Spark engine for that portion, with no interruption to the job. Key limitations:

- **No structured streaming support**
- **JSON and XML aren't accelerated** (CSV *is* supported via a vectorized parser)
- **ANSI SQL mode isn't supported** — enabling it forces a full fallback
- Date comparisons need matching types on both sides (cast explicitly, e.g. `CAST(order_date AS DATE) = '2026-05-20'`)

You can confirm whether an operation ran natively by checking the Spark UI / Spark History Server for node names ending in `Transformer`, `NativeFileScan`, or `VeloxColumnarToRowExec`, by running `df.explain()` and looking for the same suffixes, or via real-time Fabric Spark Advisor alerts surfaced directly in notebook cell output.

**Practice Question 2** *(Hard)*

A notebook enables the native execution engine at the environment level. One cell runs a query with `spark.sql.ansi.enabled` set to true against a Delta table. What happens?

A. The job fails immediately with an unsupported-configuration error  
B. The entire query silently falls back to the standard JVM Spark engine  
C. Only the ANSI-specific expressions fall back; the rest runs natively  
D. The native execution engine ignores the ANSI setting and runs anyway  

> [!success]- Answer
> **B. The entire query silently falls back to the standard JVM Spark engine**
>
> ANSI SQL mode isn't supported by the native execution engine at all — if it's enabled, execution falls back to the vanilla Spark engine automatically, without failing the job. This is different from an unsupported *operator* inside an otherwise-native query, where only the unsupported operator segment falls back while the rest can still run natively.

---

## Admin vs. Workspace-Level Settings

| Setting | Who can change it |
| :--- | :--- |
| Attach/change an environment on a notebook or SJD | Any user with edit access to that item |
| Configure starter pool autoscale / dynamic allocation | Workspace **Admin** |
| Create or resize a **custom** Spark pool | Workspace **Admin** — and the **capacity admin** must first enable ==Customized workspace pools== for that capacity |
| Set an environment as the workspace default | Workspace **Admin** (only admins can edit the environment's contents afterward) |
| Change the workspace-level default runtime | Workspace **Admin**, via Spark settings → Environment tab |

**Practice Question 3** *(Easy)*

A workspace member with the Contributor role tries to create a custom Spark pool but doesn't see the option. What's the most likely cause?

A. Custom pools require the workspace Admin role, and possibly a capacity-level setting the capacity admin hasn't enabled  
B. Custom pools can only be created by Fabric tenant admins  
C. The workspace has reached its maximum of one Spark pool  
D. Custom pools require a Premium Per User license  

> [!success]- Answer
> **A. Custom pools require the workspace Admin role, and possibly a capacity-level setting the capacity admin hasn't enabled**
>
> Creating a custom Spark pool needs the **Admin** role in the workspace. Separately, the Fabric **capacity admin** must enable **Customized workspace pools** in the capacity's Spark Compute settings before workspace admins can size custom pools at all. A Contributor role is insufficient regardless of the capacity setting.

---

## Use Cases

- **Starter pools**: interactive exploration, notebook development, ad hoc analysis where session-start variability is acceptable
- **Custom pools**: production Spark job definitions, workloads needing Private Link/Managed VNet, or workloads needing node sizes other than Medium
- **Custom live pools**: scheduled jobs with strict SLA start-time requirements
- **Workspace-default environments**: standardizing library and runtime versions across a whole team without per-notebook setup
- **High concurrency mode**: pipelines that fan out to many small notebook activities, or interactive teams switching between multiple notebooks
- **Native execution engine**: large Parquet/Delta scans, complex aggregations and joins, cost-sensitive batch and ETL workloads

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Session start much slower than expected | Starter pool with library dependencies, regional capacity exhaustion, or Private Link/Managed VNet enabled | Use a custom live pool for predictable starts, or a Full-mode environment on a hydrated pool |
| Can't create/resize custom pool | Missing workspace Admin role, or capacity admin hasn't enabled Customized workspace pools | Request Admin role; ask capacity admin to enable the capacity setting |
| Environment change didn't take effect | Forgot to **Publish** after **Save**, or an active session hasn't restarted | Publish the environment; start a new session |
| Query silently reverts to JVM performance | Native execution engine hit an unsupported operator/format/ANSI mode | Check Spark UI for fallback nodes; rewrite the query or disable NEE for that cell |
| High concurrency session not shared as expected | Sessions differ in default Lakehouse or Spark compute settings, or exceed the 5-notebook default limit | Align compute/Lakehouse settings; raise `spark.highConcurrency.max` in the environment |
| Library conflict after a runtime change | JAR dependencies incompatible with the new runtime's Scala/Java/OS versions | Review the library management conflict log; update or replace affected JARs |

## Best Practices

- Default new development to starter pools; move production and SLA-sensitive jobs to custom (ideally custom live) pools
- Standardize teams on a workspace-default environment rather than letting each notebook configure its own libraries and runtime
- Use Quick-mode libraries while iterating, Full-mode for anything scheduled or shared
- Pilot the native execution engine on non-streaming, Parquet/Delta-heavy workloads before enabling it broadly
- Raise `spark.highConcurrency.max` deliberately — higher notebook density improves cost efficiency but weakens isolation between workloads

## Exam Tips

> [!tip] Exam Tips
>
> - Starter pools = Medium node only, best-effort fast start; custom pools = full control, need Admin role + a capacity-level toggle
> - An **environment** bundles Spark compute (incl. runtime) + libraries + resources; **Save** stages changes, **Publish** applies them (Resources are always live)
> - Runtime 1.3 (Spark 3.5.5) is GA and the default; Runtime 2.0 (Spark 4.1) is Public Preview
> - High concurrency mode's default session-sharing limit is **5** notebooks, raisable to **50** via `spark.highConcurrency.max`; only the initiating notebook/activity is billed
> - Native execution engine is preview-labeled overall; it doesn't support structured streaming, JSON/XML, or ANSI mode, and falls back to JVM Spark automatically and silently

## Key Takeaways

- Starter pools trade guaranteed startup latency for zero setup; custom pools trade setup effort for predictable, tunable compute
- Environments are the unit of reusable Spark configuration — attach one, or promote it to the workspace default
- Runtime version can be set at the workspace level (applies to system items) or the environment level (applies where that environment is attached)
- High concurrency mode reduces both cost and session-start latency for compatible workloads sharing a user, Lakehouse, and compute config
- The native execution engine accelerates supported operators transparently and falls back automatically — it never blocks a job outright

## Related Topics

- [02-Domain Settings](./02-domain-settings.md)
- [03-OneLake Settings](./03-onelake-settings.md)
- [04-Airflow Settings](./04-airflow-settings.md)

## Official Documentation

- [Apache Spark compute for Data Engineering and Data Science](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-compute)
- [Configure and manage starter pools in Fabric Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-starter-pools)
- [Create custom Apache Spark pools in Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/create-custom-spark-pools)
- [Create, configure, and use an environment in Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/create-and-use-environment)
- [Apache Spark runtime in Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/runtime)
- [High concurrency mode in Apache Spark compute for Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/high-concurrency-overview)
- [Native execution engine for Fabric Data Engineering](https://learn.microsoft.com/en-us/fabric/data-engineering/native-execution-engine-overview)

---

**[← Previous](../dp-700-overview.md) | [↑ Back to Section](./fabric-workspace-settings.md) | [Next →](./02-domain-settings.md)**
