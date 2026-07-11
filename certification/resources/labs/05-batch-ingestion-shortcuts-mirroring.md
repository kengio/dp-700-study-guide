---
title: "Lab 05: Batch Ingestion — Shortcuts & Mirroring"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - onelake
  - shortcuts
  - mirroring
  - copy-activity
  - copy-job
status: complete
---

# Lab 05: Batch Ingestion — Shortcuts & Mirroring

## Overview

This lab covers every ingestion path Domain 2 tests: an internal lakehouse-to-lakehouse shortcut (fully hands-on), an external ADLS/S3 shortcut (optional — documented skip path if you have no external cloud account), a Copy activity with staging, a Copy job tour, a mirroring tour, and shortcut cache configuration.

It adds a second lakehouse, `lh_silver`, that later labs extend.

> [!abstract]
>
> - Creates `lh_silver` and an **internal shortcut** into `lh_bronze`'s `customers` table — verified via both Spark and the SQL analytics endpoint
> - Documents the **external shortcut** path (ADLS Gen2/S3) with an explicit skip-if-no-account fallback
> - Builds a **Copy activity** with workspace staging, tabular conversion, moving `Files/raw/events` CSV into a `lh_silver` Delta table
> - Tours the **Copy job** item's incremental/CDC surface against the `orders` table
> - Tours **mirroring** setup (Azure SQL Database, if available) with a read-only walkthrough alternative for readers with no Azure subscription
> - Configures shortcut cache settings
> - Closes with a worked scenario tying all four mechanisms into the [Mirroring vs. Shortcuts vs. Pipeline Copy decision funnel](../../06-batch-ingestion/03-mirroring.md#mirroring-vs-shortcuts-vs-pipeline-copy)

Domain 2's ingestion decision consistently rewards recognizing *when not to copy data* — shortcuts and mirroring exist specifically to avoid the pipeline-copy work this lab also teaches you to build. Building all four mechanisms back to back, against the same dataset, is what makes that "when not to" judgment concrete instead of abstract.

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) completed — `dp700-labs` workspace with `lh_bronze` and its Delta tables plus `Files/raw/` CSVs. An external cloud storage account (ADLS Gen2, S3, or S3-compatible) and an Azure subscription with an Azure SQL Database are both optional — every step that needs one has a documented skip path.
>
> **Estimated time:** 50 minutes

---

## Steps

### Step 1: Create `lh_silver`

1. In `dp700-labs`, select **+ New item → Lakehouse**. Name it `lh_silver`.

> [!success] Expected result
> `lh_silver` appears alongside `lh_bronze` in the workspace item list, with empty **Tables** and **Files** sections.

`lh_bronze` plays the role of a raw/landing zone for the rest of this lab pack; `lh_silver` starts standing in for a lightly-cleaned, ingestion-ready layer — the same bronze/silver naming convention used throughout this guide's loading-pattern and transformation topics, so the naming carries meaning into [Lab 06](./06-loading-patterns-incremental-scd.md) and [Lab 07](./07-pyspark-transformation.md) rather than being arbitrary.

### Step 2: Create an internal shortcut from `lh_silver` into `lh_bronze`

1. Open `lh_silver` → **Tables** section → right-click (or **New shortcut**) → **Microsoft OneLake**.
2. Navigate to `dp700-labs` → `lh_bronze` → `Tables` → select `customers`.
3. Accept the default shortcut name (`customers`) and select **Create**.

> [!success] Expected result
> `lh_silver`'s Tables section now shows a `customers` entry with a shortcut icon overlay. It's automatically recognized as a Delta table (same Delta-formatted data, referenced in place — nothing copied).

1. Verify from Spark — open a new cell in any notebook attached to `lh_silver` (or attach `nb-generate-dataset` to `lh_silver` temporarily via the Lakehouses pane):

```python
df = spark.sql("SELECT COUNT(*) AS n FROM lh_silver.customers")
df.show()
```

> [!success] Expected result
> Returns `n = 50` — the same row count as `lh_bronze.customers`, proving the shortcut resolves to the live source data, not a stale copy.

1. Verify from the SQL analytics endpoint — open `lh_silver`'s SQL analytics endpoint and run:

```sql
SELECT TOP (5) * FROM [lh_silver].[dbo].[customers];
```

> [!success] Expected result
> Five rows return through T-SQL, identical in shape to querying `lh_bronze.customers` directly — confirming the shortcut behaves consistently across both engines.

> [!note]
> Deleting this shortcut later would delete only the pointer in `lh_silver` — `lh_bronze.customers` is completely unaffected. This is the symbolic-link mental model from [02-OneLake Shortcuts](../../06-batch-ingestion/02-onelake-shortcuts.md#types-of-shortcuts).

> [!warning] Common Mistake
> Internal shortcuts authorize using the **calling user's own identity**, not the shortcut creator's — you had access to `lh_bronze.customers` already (you created it), so this step doesn't surface the gap. In a multi-user scenario, a colleague querying this same shortcut without permission on `lh_bronze.customers` directly gets an authorization error, even though they can see the shortcut in `lh_silver`'s Tables list. Creating a shortcut never grants access to its target on its own.

### Step 3: External shortcut (optional — skip if you have no external cloud account)

If you have access to an ADLS Gen2 storage account, an S3 bucket, or an S3-compatible store with some Parquet/CSV files in it, this step is worth doing hands-on. **If not, skip straight to Step 4** — the exam tests the concept and the shortcut caching implications, not that you personally provisioned cloud storage for this lab.

1. Open `lh_silver` → **Tables** section (or **Files**, if the source isn't Delta-formatted) → **New shortcut → Amazon S3** (or **Azure Data Lake Storage Gen2**).
2. Create a new **cloud connection**: endpoint/account URL + authentication (access key, or a SAS token / Entra credential depending on source). Creating this connection is a *bind* operation — you need permission on the connection itself, separate from your workspace role.
3. Point at a folder or container with sample data, name the shortcut, select **Create**.

> [!success] Expected result
> The external shortcut appears in `lh_silver`, and a query against it (Spark or SQL analytics endpoint, matching Step 2's pattern) returns the external data without any copy step. If creation fails with a connection-permission error, that's the expected "you don't have permission on this cloud connection" behavior described in [02-OneLake Shortcuts § Permissions Delegation Model](../../06-batch-ingestion/02-onelake-shortcuts.md#permissions-delegation-model) — not a bug.

**If you skipped this step**: read [02-OneLake Shortcuts](../../06-batch-ingestion/02-onelake-shortcuts.md#types-of-shortcuts) for the full external target list (ADLS Gen2, Blob, S3, S3-compatible, GCS, Dataverse, Iceberg, OneDrive/SharePoint, on-premises via gateway) and continue to Step 4 — Step 8's cache configuration still makes sense conceptually without a live external shortcut to point it at.

### Step 4: Copy activity — ingest `events` CSV into `lh_silver` with staging

1. In `dp700-labs`, select **+ New item → Data pipeline**. Name: `pl_copy_events`.
2. Drag a **Copy activity** onto the canvas. Name it `Copy_Events_To_Silver`.
3. **Source** tab:
   - **Connection**: `lh_bronze` (Lakehouse).
   - **File path**: `Files/raw/events` (the CSV folder generated in Lab 01).
   - **File format**: DelimitedText, first row as header.
4. **Destination** tab:
   - **Connection**: `lh_silver` (Lakehouse).
   - **Table**: new table `events_staged` (enable **Auto create table**).
5. **Settings** tab → **Enable staging**:
   - **Staging type**: Workspace (built-in).
   - Note the 60-minute timeout on workspace staging — fine for this small dataset, but a reason to switch to external Azure Blob/ADLS staging for anything long-running.
6. Select **Run**.

> [!success] Expected result
> The activity succeeds; `lh_silver.events_staged` now contains 500 rows, schema-converted from CSV text to typed columns (tabular copy, not binary) via the staging path. Confirm with:

```sql
SELECT COUNT(*) AS n, MIN(event_time) AS earliest, MAX(event_time) AS latest
FROM [lh_silver].[dbo].[events_staged];
```

> [!success] Expected result
> `n = 500`, with `earliest`/`latest` timestamps spanning the random window generated in Lab 01.

> [!note] What staging bought you here
> `events` CSV columns arrive as untyped text; `events_staged`'s `event_time` column lands as a proper typed column, not a string, because this was a **tabular** copy (schema-aware conversion through Copy activity's interim type system), not a **binary** copy (byte-for-byte, no type awareness). If you only needed to move files as-is — say, archiving raw CSVs into a different lakehouse's Files section — binary copy would be faster and wouldn't need the staging step at all.

> [!warning] Common Mistake
> Increasing **Degree of copy parallelism** on this activity's Settings tab would do nothing useful here — parallelism only accelerates a source read that's already split via **Partition option** (`Physical partitions of table` or `Dynamic range`). A single small CSV folder with `Partition option: None` reads single-threaded regardless of the parallelism setting; the two settings work together, not independently.

### Step 5: Copy job tour — incremental copy of `orders`

1. In `dp700-labs`, select **+ New item → Copy job**. Name: `cj_orders_incremental`.
2. **Source**: `lh_bronze` (Lakehouse) → table `orders`.
3. **Destination**: `lh_silver` (Lakehouse) → new table `orders_incremental`.
4. On the mapping step, set **Copy mode**: **Incremental copy**, watermark column: `order_date` (a date-typed column works for watermark-based tracking).
5. **Update method**: `Append`.
6. Review, then select **Save** (running it is optional — the point of this step is seeing the wizard, not the run itself).

> [!success] Expected result
> You can point to exactly where Copy job's headline advantage over Copy activity lives: no hand-built watermark control table, no `Set Variable` bookkeeping — Copy job tracks "last successful run" state automatically. If you do run it, `lh_silver.orders_incremental` fills with all 200 rows on the first (full) run.

> [!note] Mental model
> Copy activity is a moving truck you drive yourself; Copy job is hiring movers who already know how to pack incrementally — see [04-Pipeline Ingestion](../../06-batch-ingestion/04-pipeline-ingestion.md#copy-job).

Look at the other three **Update method** options in the same dropdown before moving on — you configured `Append`, but the other three matter just as much for the exam:

| Update method | Behavior |
| :--- | :--- |
| `Append` | Keeps full history — every incremental run adds rows, never overwrites (what you configured) |
| `Merge` | Upsert on a key column (defaults to the primary key) |
| `Overwrite` | Replaces the destination table's contents entirely on each run |
| `SCD Type 2` *(Preview)* | Versioned rows with effective dating — the pattern [Lab 06](./06-loading-patterns-incremental-scd.md) builds by hand in PySpark, here as a low-code alternative |

### Step 6: Mirroring tour

**If you have an Azure subscription and an Azure SQL Database** (even a small/free-tier one):

1. In `dp700-labs`, select **+ New item → Mirrored Azure SQL Database**.
2. Follow the wizard: authenticate to your Azure subscription, select the server and database, choose which tables to mirror (or all).
3. Select **Create**. Wait for the initial snapshot to complete — the mirrored database's SQL analytics endpoint becomes queryable once the first sync finishes.

> [!success] Expected result
> A new mirrored database item appears, its status moves from **Initializing** to **Running**, and a `SELECT TOP (5) * FROM ...` against its SQL analytics endpoint returns live data from the Azure SQL Database — read-only, since mirrors never accept writes back from Fabric.

**If you have no Azure subscription** (the common case for a Fabric-trial-only reader):

1. Read [03-Mirroring](../../06-batch-ingestion/03-mirroring.md) end to end instead of building.
2. Walk through the wizard steps *conceptually*: (a) create the mirrored database item and authenticate to the source, (b) select tables, (c) Fabric provisions a landing zone and a replicator engine starts scanning the source's transaction log, publishing change files roughly every 15 seconds, (d) a SQL analytics endpoint auto-generates over the resulting Delta tables.
3. Note the one mirroring flavor that needs **no setup at all**: a **Fabric SQL database** item (create one via **+ New item → SQL database** if you want to see this hands-on) is automatically mirrored into OneLake the moment you create it — no separate mirroring configuration step, unlike Azure SQL Database mirroring.

> [!success] Expected result
> Either a live mirrored database is running, or you can state from memory: the three mirroring flavors (database/metadata/open), the ~15-second replication cadence, and that Fabric SQL database is the one source that's mirrored automatically with zero configuration.

**Free storage tier worked example** — do the math for your own trial capacity, whichever it is:

| Trial SKU | Capacity units (CU) | Free mirroring storage (1 TB per CU) |
| :--- | :--- | :--- |
| F4 | 4 | 4 TB |
| F64 | 64 | 64 TB |

> [!note]
> Even a small F4 trial gets 4 TB of free OneLake storage dedicated to mirroring — vastly more than this lab's synthetic dataset needs. The exam tests the *rate* (1 TB per CU), not a specific number, since it scales with whatever capacity a scenario names.

### Step 7: Recap — the batch-ingestion decision funnel

You've now hands-on (or conceptually) exercised all four ingestion mechanisms Domain 2 tests. Before moving to caching, work through this worked scenario cold, then check your reasoning:

**Scenario**: A team needs the following three things: (1) a partner org's ADLS Gen2 Parquet files queryable from a Fabric lakehouse without copying them, (2) an on-premises SQL Server database continuously available in OneLake with near-zero ETL effort, (3) a nightly bulk load of 500 GB of CSV files from an S3 bucket into a Warehouse table, converted to a typed schema along the way. Which mechanism fits each?

> [!success]- Answer
>
> 1. **External shortcut** (ADLS Gen2 target) — data already lives somewhere queryable, no transformation needed, and the team wants to avoid a copy entirely.
> 2. **Database mirroring** (SQL Server 2025+ is a supported source, routed through an on-premises data gateway if the source isn't publicly reachable) — an entire operational database needs continuous, pipeline-free sync.
> 3. **Copy activity or Copy job** — the data needs a real copy (into a Warehouse, which shortcuts and mirroring don't target directly for this shape) *and* schema conversion (tabular copy), which shortcuts explicitly don't provide.

This is exactly the [Mirroring vs. Shortcuts vs. Pipeline Copy decision funnel](../../06-batch-ingestion/03-mirroring.md#mirroring-vs-shortcuts-vs-pipeline-copy) from the topic file, now grounded in mechanisms you configured yourself in Steps 2–5 rather than read about cold.

### Step 8: Shortcut cache settings

1. **Workspace settings → OneLake** tab → **Shortcut cache**.
2. Toggle caching **On**. Set **Retention period** to `7` days.
3. If you created an external shortcut in Step 3 (S3, S3-compatible, GCS, or on-premises gateway — **not** ADLS Gen2/Blob), re-query it once, then check the cache is populated by re-querying again and confirming latency drops.
4. If you skipped Step 3, or your external shortcut targets ADLS Gen2/Blob specifically, note that this toggle simply has **no effect** for that shortcut — caching is source-restricted to GCS/S3/S3-compatible/on-premises gateway only.

> [!success] Expected result
> The **Shortcut cache** toggle shows **On** with a 7-day retention period saved. You can state which four source types benefit (GCS, S3, S3-compatible, on-prem gateway) and which two commonly-assumed ones don't (ADLS Gen2, Blob Storage) — a frequent exam distractor.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Internal shortcut created in Step 2 returns an authorization error when queried | The calling user (or, in a real multi-user scenario, whoever queries it) lacks permission on the shortcut's **target**, not just the shortcut object | Grant the caller access to `lh_bronze.customers` directly — a shortcut never grants access to its target on its own |
| External shortcut creation in Step 3 fails despite having Contributor access on `lh_silver` | The creator lacks permission on the **cloud connection** the shortcut binds to | Grant connection permission, or have someone with it create the shortcut |
| Copy activity in Step 4 times out on staging | Workspace (built-in) staging has a hard 60-minute limit | Switch to external Azure Blob/ADLS staging for anything expected to run longer |
| Copy job's incremental copy in Step 5 re-copies all rows every run instead of only new ones | The watermark column isn't monotonically increasing, or the job was recreated (resetting tracked state) rather than reused | Confirm the watermark column (`order_date`) only increases over time, and avoid deleting/recreating the Copy job between runs |
| Mirrored database status stuck on **Initializing** | Fabric capacity is paused, or the source database is unreachable (firewall/gateway misconfiguration) | Confirm the capacity is running, and that the source allows Azure services (or the gateway) to connect |
| Shortcut cache toggle shows **On** but latency doesn't improve on repeat reads | The shortcut targets ADLS Gen2 or Blob Storage, neither of which is cache-eligible | Expected behavior — caching only benefits GCS/S3/S3-compatible/on-prem gateway shortcuts |

## Cleanup

**Keep**:

- `lh_silver`, its internal `customers` shortcut, `events_staged` table, and (if run) `orders_incremental` table — [Lab 06](./06-loading-patterns-incremental-scd.md) and [Lab 07](./07-pyspark-transformation.md) extend `lh_silver` directly
- `pl_copy_events` — useful reference, not required by later labs
- Any external shortcut you created in Step 3 — harmless to keep; delete it if it was pointed at storage you don't want to keep paying for/using

**Optional cleanup**:

- `cj_orders_incremental` (Copy job) — safe to delete if you only toured it without saving/running
- A mirrored database created in Step 6 — if it's pointed at an Azure SQL Database you don't want continuously replicating (and consuming Azure compute on the source side), delete it after this lab; no later lab depends on it

If you skipped the optional Steps 3 and 6 entirely (no external cloud account, no Azure subscription), there's nothing extra to clean up — you never created the resources in the first place, and every later lab in this pack works identically either way.

This lab deliberately steps through the batch-ingestion mechanisms in ascending order of "how much does Fabric do for you": a shortcut does nothing but point (zero data movement, zero setup beyond the pointer itself), mirroring replicates continuously with a config wizard and no pipeline to maintain, Copy job replaces hand-built watermark logic with a wizard, and Copy activity gives you full manual control when nothing else fits the shape of the problem. Knowing that ordering — and which rung of the ladder a given exam scenario is describing — is the single highest-leverage skill this lab builds.

## What the Exam Asks About This

- [01-Choosing a Data Store](../../06-batch-ingestion/01-choosing-data-store.md) — lakehouse vs. warehouse vs. eventhouse vs. Fabric SQL database
- [02-OneLake Shortcuts](../../06-batch-ingestion/02-onelake-shortcuts.md) — internal vs. external types, permissions delegation, caching rules
- [03-Mirroring](../../06-batch-ingestion/03-mirroring.md) — three mirroring flavors, replication mechanics, free storage tier
- [04-Pipeline Ingestion](../../06-batch-ingestion/04-pipeline-ingestion.md) — Copy activity staging/partitioning/fault tolerance, Copy job's incremental/CDC additions

---

**[← Previous: Lab 04](./04-orchestration-pipelines-notebooks.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 06: Loading Patterns](./06-loading-patterns-incremental-scd.md)**
