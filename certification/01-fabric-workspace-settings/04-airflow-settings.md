---
title: Apache Airflow Job Workspace Settings
type: topic
tags:
  - dp-700
  - fabric
  - airflow
  - orchestration
  - workspace-settings
---

# Apache Airflow Job Workspace Settings

## Overview

**Apache Airflow job** is Fabric's managed, hosted Apache Airflow environment — the next generation of Azure Data Factory's Workflow Orchestration Manager. This topic covers the workspace-level settings that control its runtime: starter vs. custom pools, environment/requirements configuration, and where DAG files live.

> [!info]
> This topic is the July 21, 2026 blueprint's one change to Domain 1: **"Configure Dataflows Gen2 workspace settings"** was replaced by **"Configure Apache Airflow workspace settings."** Dataflows Gen2 itself hasn't been removed from Fabric — only the workspace-settings skill bullet changed, swapping which item's workspace configuration is tested. Every other Domain 1 bullet is unchanged from the April 20, 2026 blueprint.

> [!abstract]
>
> - Apache Airflow job runs Python-based DAGs on Fabric-managed Airflow 2.10.5 / Python 3.12 — no cluster setup required
> - Like Spark, it offers **starter pools** (instant, auto-deprovisioned) and **custom pools** (always-on, configurable node size/autoscale/extra nodes)
> - Dependencies are declared in a `requirements.txt`-style **Airflow requirements** list; DAG files and a `plugins` folder live in Fabric-managed storage
> - Free and Premium Per User (PPU) workspaces don't support Apache Airflow jobs; private/virtual networks aren't supported yet

> [!tip] What the Exam Tests
>
> - Choosing starter pool vs. custom pool for a given Airflow workload, and reading the property differences correctly
> - Where DAG files and dependency requirements are stored, and the private-package (`plugins`) exception
> - That this item replaced the *workspace settings* blueprint bullet previously covering Dataflows Gen2 — not that Dataflows Gen2 was removed from the product
> - Licensing/networking constraints: no Free/PPU workspace support, no private network / VNet support yet

---

## Legacy: Dataflows Gen2 Workspace Settings (pre-July 21, 2026)

Before this refresh, the equivalent Domain 1 workspace-settings bullet was **"Configure Dataflows Gen2 workspace settings."** That item covered workspace-level staging and compute behavior for Dataflow Gen2 — specifically the internal staging Lakehouse/Warehouse (`DataflowsStagingLakehouse` / `DataflowsStagingWarehouse`) that Dataflow Gen2's compute engine creates automatically per workspace, plus the staging-related options controlling whether a dataflow's transformations route through that Fabric-managed compute layer before landing in a destination.

> [!tip]
> **Not tested from July 21, 2026** — if your exam date is on or after July 21, 2026, you can skip this section; it was replaced by the Apache Airflow workspace settings covered in the rest of this file. If your exam date is **before** July 21, 2026, this older skill may still be in scope for you.

Dataflow Gen2 itself hasn't been removed from Fabric, and its staging/compute behavior remains documented for readers who still need it — see [Dataflow Gen2 data destinations and managed settings](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-data-destinations-and-managed-settings#using-staging-before-loading-to-a-destination).

---

## What Apache Airflow Job Is

Apache Airflow job is part of Fabric's Data Factory experience. It lets you author Python-based **Directed Acyclic Graphs (DAGs)** — Apache Airflow's native orchestration format — and run them at scale without managing the underlying Airflow infrastructure yourself. It's aimed at teams who already know Airflow or prefer code-first orchestration; teams that want a no-code experience should reach for **pipelines** instead (see [04-Orchestration](../04-orchestration/orchestration.md) for the choose-between-tools decision matrix).

| Detail | Value |
| :--- | :--- |
| Supported Apache Airflow version | 2.10.5 (changing versions on an existing job isn't supported — create a new job instead) |
| Supported Python version | 3.12 |
| Workspace requirement | Must have an assigned capacity; **Free** and **Premium Per User (PPU)** workspaces don't support Apache Airflow jobs |
| Networking | Private networks and virtual networks **not currently supported** |

Compared to Azure Data Factory's Workflow Orchestration Manager, Fabric's Apache Airflow job additionally supports autoscale for production spikes, high availability, deferrable operators (suspend idle operators to free workers), and a pause/resume TTL — but it doesn't yet offer diagnostic logs/metrics or Blob Storage integration the way the ADF version does.

---

## Pool Settings: Starter Pool vs. Custom Pool

Apache Airflow job offers the same two-tier pool model as Spark: a **starter pool**, configured by default, and **custom pools** you create per workspace.

| Property | Starter Pool (default) | Custom Pool |
| :--- | :--- | :--- |
| Compute node size | ==Large== (fixed) | Configurable — **Large** for complex/production DAGs, **Small** for simpler DAGs |
| Startup latency | Instantaneous | Starts from a stopped state |
| Resume latency | Up to 5 minutes | Up to 5 minutes |
| Uptime behavior | Shuts down after **20 minutes** of Airflow environment inactivity | **Always on** until manually paused |
| Suggested environment | Developer | Production |

If the capacity-level setting for customizing compute configurations is disabled, the starter pool is used for **all** Airflow environments in the workspace regardless of what you'd otherwise configure.

### Configure a Custom Pool

1. Go to **Workspace settings**.
2. In the **Data Factory** section, select **Apache Airflow Runtime Settings**.
3. The **Default Data Workflow Setting** starts as **Starter Pool** — expand it and select **New Pool** to switch.
4. Configure:
   - **Name** — a label for the pool
   - **Compute node size** — `Large` for complex/production DAGs, `Small` for simpler ones
   - **Enable autoscale** — lets the pool scale nodes up/down based on demand
   - **Extra nodes** — each additional node adds capacity for **3 more concurrent workers**
5. Select **Create**.

> [!note] Mental model — Starter vs. custom Airflow pools
> Same pattern as Spark: the starter pool is a always-idling, right-sized loaner that goes away when you stop using it (20-minute inactivity shutdown); a custom pool is a dedicated machine you size and keep running — parked, not put away, until you explicitly pause it.

> [!warning] Common Mistake
> Don't confuse Airflow's **20-minute starter-pool inactivity shutdown** with Spark's starter-pool behavior — the numbers and mechanics are analogous in spirit (auto-deprovision when idle) but they're separate settings on separate compute platforms. An exam scenario naming "Apache Airflow job" is not asking about Spark pool settings even though the vocabulary (starter/custom, autoscale) rhymes.

**Practice Question 1** *(Medium)*

A team runs simple, low-complexity DAGs during active development, then promotes finished DAGs to a production Airflow job with strict uptime expectations. Which pool strategy fits best?

A. Use the starter pool for both development and production  
B. Use a custom pool with Small node size for development, and a separate custom pool with Large node size and autoscale for production  
C. Use the starter pool for production because it has no startup latency  
D. Development and production must always share the same pool  

> [!success]- Answer
> **B. Use a custom pool with Small node size for development, and a separate custom pool with Large node size and autoscale for production**
>
> Fabric's own guidance suggests **Small** node size for simple DAGs and **Large** for complex or production DAGs, and custom pools are the "suggested environment" for production because they stay always-on rather than deprovisioning after 20 minutes of inactivity like the starter pool. Mixing dev and prod on one pool (D) isn't a constraint — separate pools per environment is the standard pattern, matching how Spark separates dev/prod compute too.

---

## Environment Configuration and requirements.txt

Each Apache Airflow job has Fabric-managed file storage with a `dags` folder and (when needed) a `plugins` folder:

- **DAG files** (`.py`) live in the `dags` folder.
- **Airflow requirements** — the dependency list — are declared via a `requirements.txt`-style entry in the job's **Airflow requirements** configuration, specifying packages the environment needs (for example, `astronomer-cosmos` and `dbt-fabric` for a dbt-orchestration setup).
- **Private packages** (your own custom operators, hooks, sensors, or plugins) must go in the **`plugins`** folder, **not** `dags` — packaged as `.zip`, `.whl`, or `.tar.gz`.

### Adding a Private Package as a Requirement

Two supported paths, depending on whether the job is Git-connected:

**With a connected Git repository:**

1. Put your DAG file in the repo's `dags` folder and your private package in `plugins`.
2. Connect the Git repository to the Apache Airflow job.
3. Add the package under **Airflow requirements** using the path format:

   ```text
   /opt/airflow/git/<repoName>/<pathToPrivatePackage>
   ```

   For example, a package at `/dags/test/private.whl` in the repo becomes `/opt/airflow/git/<repoName>/dags/test/private.whl`.

**Without a connected Git repository:**

1. Upload the `.whl` file directly to the job's **`plugins/libs`** folder.
2. Reference it as a requirement using the relative path:

   ```text
   plugins/libs/<your-wheel-file>.whl
   ```

3. **Restart the Apache Airflow job** for the new requirement to take effect.

> [!warning] Common Mistake
> Putting a private package in the `dags` folder instead of `plugins` is a documented gotcha — Airflow requirements resolution expects private/custom packages specifically in `plugins`, and `dags` is reserved for DAG definition files.

**Practice Question 2** *(Hard)*

A team has no Git repository connected to their Apache Airflow job but needs to install a private wheel package their data engineers built in-house. What's the correct approach?

A. Add the package path as `/opt/airflow/git/<repoName>/plugins/<file>.whl`  
B. Upload the `.whl` file to the `dags` folder and reference it directly by filename  
C. Upload the `.whl` file to `plugins/libs`, reference it as `plugins/libs/<file>.whl` in requirements, then restart the job  
D. Private packages require a Git repository — there is no alternative  

> [!success]- Answer
> **C. Upload the `.whl` file to `plugins/libs`, reference it as `plugins/libs/<file>.whl` in requirements, then restart the job**
>
> Without a connected Git repo, you upload the wheel file directly to the job's `plugins/libs` folder and reference it with the relative path `plugins/libs/<your-wheel-file>.whl` in the requirements. The `/opt/airflow/git/...` path format (A) only applies when a Git repository is connected. The `dags` folder (B) is reserved for DAG files, not packages. A Git repo is not required (D) — the `plugins/libs` upload path is the documented no-Git alternative.

---

## DAG File Storage

DAG files are Python (`.py`) files stored inside the Apache Airflow job's Fabric-managed **`dags`** folder. You create them directly in the Fabric portal (**New DAG file** → name it → Fabric provides boilerplate code you edit) or push them via a connected Git repository or the DataFactory MCP server / REST API for programmatic workflows.

Once saved, DAG files load into the Apache Airflow UI — reachable from the job's **Monitor in Apache Airflow** button — where you trigger runs, watch status, and inspect logs, separate from the Fabric portal's own monitoring surfaces.

**Practice Question 3** *(Easy)*

Where do Apache Airflow job DAG files live in Fabric-managed storage?

A. The `plugins` folder  
B. The `dags` folder  
C. The workspace's default Lakehouse `Files` folder  
D. `plugins/libs`  

> [!success]- Answer
> **B. The `dags` folder**
>
> DAG `.py` files are created and stored in the Airflow job's `dags` folder. The `plugins` folder (and `plugins/libs` specifically) is reserved for private packages and wheel files — a distinct location precisely so custom code doesn't collide with DAG discovery.

---

## Fabric vs. Azure Data Factory: Feature Comparison

Apache Airflow job is described as the "next generation" of ADF's Workflow Orchestration Manager, but the two aren't feature-identical — a useful distinction if a scenario question describes a team migrating from ADF:

| Key feature | Apache Airflow Job (Fabric) | Workflow Orchestration Manager (ADF) |
| :--- | :--- | :--- |
| Git sync | Yes | Yes |
| Azure Key Vault (AKV) as backend | Yes | Yes |
| Install private package as requirement | Yes | Yes |
| Diagnostic logs and metrics | ==No== | Yes |
| Blob Storage integration | ==No== | Yes |
| Autoscale for production spikes | Yes | Partial |
| High availability | Yes | No |
| Deferrable operators (free idle workers) | Yes | No |
| Pause/resume TTL | Yes | No |

> [!warning] Common Mistake
> Don't assume Fabric's Apache Airflow job is a strict superset of ADF's Workflow Orchestration Manager. It gains high availability, deferrable operators, and pause/resume TTL, but currently **lacks** diagnostic logs/metrics and Blob Storage integration that ADF has. A migration scenario question testing "what do you lose" is answerable directly from this table.

## Region Availability

Apache Airflow job is available in most Azure regions where Fabric operates (Australia East, Canada Central, East US, North Europe, UK South, West Europe, and many more), with a handful of regions marked **Coming soon** as of the July 2026 refresh (for example, Indonesia Central, Malaysia West, Qatar Central). Region availability doesn't change any of the workspace settings above — it only determines whether the item can be created in a workspace tied to a capacity in that region at all.

---

## Create and Run a DAG: End-to-End Walkthrough

Beyond workspace-level pool and requirements settings, it's worth knowing the basic authoring loop for the exam's scenario-style questions:

1. **Create the item**: from an existing or new workspace, expand **+ New item** → **Data Factory** section → **Apache Airflow Job** → name the project → **Create**.
2. **Create a DAG file**: select the **New DAG file** card, name it, and select **Create**. Fabric scaffolds boilerplate DAG code you edit to fit your workflow, then **Save**.
3. **Run the DAG**: select **Run DAG**. A notification confirms the run started.
4. **Monitor the run**: select **View Details** in the notification, which opens the native **Apache Airflow UI** — the same web UI you'd get from open-source Airflow — where you track run status and task-level details. Alternatively, use the job's **Monitor in Apache Airflow** button at any time; saved DAG files are always loaded into this UI.

This authoring loop is unaffected by which pool (starter or custom) backs the job — pool choice only changes compute behavior, not the create/save/run/monitor flow.

## Authoring DAGs Outside the Fabric Portal

DAG authoring isn't limited to the in-portal editor. Two verified alternate paths matter for teams standardizing on external tooling:

- **Git-connected workspaces**: connect a repository so `dags` and `plugins` folder contents sync from source control, matching the private-package workflow described above.
- **Visual Studio Code with GitHub Copilot**: the DataFactory MCP server (`Microsoft.DataFactory.MCP`, a .NET tool) exposes Airflow job operations — create, list, update, delete jobs, push/read DAG definitions, and check run status — as Copilot-callable tools from inside VS Code, authenticated against your Fabric account via Microsoft Entra ID. Prerequisites are the same workspace constraints already noted: a Fabric workspace with an assigned capacity (Free and PPU workspaces are unsupported) and permission to create items in that workspace.

Neither path changes the underlying `dags`/`plugins` folder structure or pool settings — they're just alternate ways to push content into the same Fabric-managed storage.

## A Note on Choosing Airflow vs. Pipelines

This file covers Apache Airflow job's *workspace settings*, not the broader "should I use Airflow" decision — that choice belongs to Domain 1's orchestration section. As a quick pointer: reach for Apache Airflow job when the team already knows Airflow, needs Python-first control flow, or depends on the Airflow provider ecosystem (like `astronomer-cosmos` for dbt); reach for a **pipeline** when a no-code, drag-and-drop authoring experience is the priority. See [01-Choosing an Orchestration Tool](../04-orchestration/01-choosing-orchestration-tool.md) for the full decision matrix.

## Terminology Quick Reference

| Term | Definition |
| :--- | :--- |
| **DAG** | Directed Acyclic Graph — Apache Airflow's Python-defined workflow format |
| **Starter pool** | Default, instant Airflow runtime that auto-deprovisions after 20 minutes of inactivity |
| **Custom pool** | Admin-configured, always-on Airflow runtime with tunable node size, autoscale, and extra nodes |
| **Extra node** | A custom-pool add-on providing capacity for 3 additional concurrent workers |
| **Airflow requirements** | The dependency declaration (akin to `requirements.txt`) for an Airflow job's environment |
| **dags folder** | Fabric-managed storage location for DAG `.py` files |
| **plugins folder** | Fabric-managed storage location for private/custom packages, operators, hooks, and sensors |
| **plugins/libs** | Sub-folder for uploading `.whl` files directly when no Git repository is connected |
| **DataFactory MCP server** | VS Code + GitHub Copilot integration exposing Airflow job create/update/monitor operations as callable tools |

## Use Cases

- Teams already fluent in open-source Apache Airflow migrating DAGs into a managed Fabric runtime
- Code-first orchestration where Python control flow, custom operators, or third-party Airflow providers are required beyond what pipelines expose
- Orchestrating dbt transformations via `astronomer-cosmos` + `dbt-fabric` requirements against a Fabric Data Warehouse
- Production workflows needing predictable always-on compute (custom pool) rather than the starter pool's 20-minute idle shutdown

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Apache Airflow Job option missing from +New item | Workspace is Free or Premium Per User (PPU) tier | Move the job to a workspace on a supported Fabric capacity |
| Custom pool option grayed out | Capacity-level setting for customizing compute configurations is disabled | Ask the capacity admin to enable custom compute for the capacity |
| Private package import fails in a DAG | Package uploaded to `dags` instead of `plugins`, or path format doesn't match the Git vs. no-Git convention | Move the package to `plugins` (or `plugins/libs`); fix the requirement path format |
| New requirement doesn't take effect | Job wasn't restarted after adding a `plugins/libs` wheel reference | Restart the Apache Airflow job |
| DAG runs inconsistently on the starter pool | 20-minute inactivity shutdown is redeploying the environment between runs | Move to an always-on custom pool for production schedules |
| Can't connect from a private/VNet-restricted network | Private networks and VNets aren't currently supported for Airflow jobs | Use a network path without Private Link/VNet restrictions until supported |
| No native diagnostic logs/metrics export for a job | Fabric's Apache Airflow job doesn't yet offer diagnostic logs/metrics the way ADF's Workflow Orchestration Manager does | Use the Apache Airflow UI's per-task-instance logs for troubleshooting until native export ships |
| Can't upgrade an existing job to a newer Apache Airflow version | Version changes on an existing job aren't supported | Create a new Apache Airflow job on the desired version and migrate DAGs to it |

## Best Practices

- Use the starter pool during DAG development; move to a Large-node, autoscaled custom pool before production cutover
- Keep `requirements.txt`-declared dependencies minimal and version-pinned to avoid environment drift between restarts
- Always use `plugins` (or `plugins/libs` for no-Git setups) for custom code — never `dags`
- Restart the job explicitly after changing requirements uploaded via `plugins/libs`; a Git-sync change doesn't need a manual restart
- Pin the Airflow version expectation at project kickoff — since an existing job can't be upgraded in place, plan a create-new-job migration path rather than assuming an in-place version bump
- Confirm target region availability before provisioning a capacity for an Airflow-heavy workload, since a subset of regions are still "Coming soon"

## Exam Tips

> [!tip] Exam Tips
>
> - This entire topic is the **only** July 21, 2026 blueprint change — "Configure Dataflows Gen2 workspace settings" became "Configure Apache Airflow workspace settings." Dataflows Gen2 the item still exists; only the tested workspace-settings skill changed
> - Starter pool = Large node, 20-min inactivity shutdown, dev-suggested; custom pool = configurable size + autoscale + extra nodes (3 workers/node), always-on, prod-suggested
> - DAG files → `dags` folder; private/custom packages → `plugins` (or `plugins/libs` without Git)
> - Free and PPU workspaces don't support Apache Airflow jobs; private networks/VNets aren't supported yet

## Key Takeaways

- Apache Airflow job is Fabric's managed, hosted Airflow runtime (2.10.5 / Python 3.12) — the successor to ADF's Workflow Orchestration Manager
- Pool model mirrors Spark's starter-vs-custom pattern but is a fully separate compute platform with its own settings
- `requirements.txt`-style dependencies live in Airflow requirements; DAG files in `dags`; custom/private packages in `plugins`
- No Free/PPU workspace support and no private network/VNet support are hard constraints worth memorizing for scenario questions

## Related Topics

- [01-Spark Settings](./01-spark-settings.md)
- [02-Domain Settings](./02-domain-settings.md)
- [03-OneLake Settings](./03-onelake-settings.md)

## Official Documentation

- [What is an Apache Airflow job?](https://learn.microsoft.com/en-us/fabric/data-factory/apache-airflow-jobs-concepts)
- [Apache Airflow Job workspace settings](https://learn.microsoft.com/en-us/fabric/data-factory/apache-airflow-jobs-workspace-settings)
- [Create an Apache Airflow Job project in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/create-apache-airflow-jobs)
- [Install a private package as a requirement in Apache Airflow Job](https://learn.microsoft.com/en-us/fabric/data-factory/apache-airflow-jobs-install-private-package)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-onelake-settings.md) | [↑ Back to Section](./fabric-workspace-settings.md) | [Next →](../02-lifecycle-management/lifecycle-management.md)**
