---
title: "Lab 01: Workspace & Capacity Setup"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - workspace-settings
  - spark
  - domains
  - onelake
  - airflow
status: complete
---

# Lab 01: Workspace & Capacity Setup

## Overview

This lab stands up everything the rest of the lab pack depends on: an activated Fabric trial, the shared `dp700-labs` workspace, a Spark environment and pool tour, a domain, an OneLake settings tour, and — most importantly — the synthetic retail dataset every later lab reads from. Budget the most time here; every other lab in this pack assumes it's done.

> [!abstract]
>
> - Activates the 60-day Fabric trial and creates the `dp700-labs` workspace on trial capacity
> - Tours Spark starter vs. custom pools, creates an Environment item, and pins a runtime version
> - Creates a domain and assigns `dp700-labs` to it
> - Tours OneLake workspace settings (external access, shortcut cache, diagnostics)
> - Generates the full shared dataset — customers, products, orders, order_items, events — as Delta tables in a new lakehouse `lh_bronze`
> - Tours the Apache Airflow job workspace settings — the July 2026 blueprint's one wording change in Domain 1

> [!info] Prerequisites
> None — this is the first lab. You need a **work/school (Microsoft Entra ID) account** capable of starting a Fabric trial — a personal Microsoft account (outlook.com, hotmail.com, or a personal Gmail-linked MSA) is **not eligible**. If you don't have a work or school account, see [labs.md § Setting Up Your Fabric Trial](./labs.md#setting-up-your-fabric-trial) for how to get a free developer tenant via the Microsoft 365 Developer Program.
>
> **Estimated time:** 45 minutes

---

## Steps

### Step 1: Activate the Fabric trial

1. Sign in at [https://app.fabric.microsoft.com](https://app.fabric.microsoft.com) with your work/school (Entra ID) account — see **Prerequisites** above if you only have a personal Microsoft account.
2. Select your account photo (top-right) → **Account manager** → **Start trial**.
3. Review the **Trial capacity region**, agree to the terms, select **Activate**.

> [!success] Expected result
> A confirmation screen appears and you're now the **Capacity administrator** of a trial capacity (F4 or F64). **Account manager → Trial status** shows 60 days remaining.

If you already have an active trial capacity from a previous session, skip straight to Step 2.

### Step 2: Create the `dp700-labs` workspace and assign the trial capacity

1. Nav pane → **Workspaces** → **New workspace**.
2. Name: `dp700-labs`. Description: optional (e.g., "DP-700 hands-on lab pack — shared workspace").
3. Expand **Advanced** → set the workspace's license/capacity to your trial capacity (**Trial** or **Fabric Trial** workspace type).
4. Select **Apply**.

> [!success] Expected result
> An empty workspace named `dp700-labs` opens, with the trial capacity's name shown under the workspace title. **Workspace settings → License info** confirms the trial capacity assignment.

### Step 3: Inspect the Spark starter pool, then create a custom pool

1. In `dp700-labs`, go to **Workspace settings → Data Engineering/Science → Spark settings → Pools**.
2. Under **Starter pool**, note the read-only configuration: node size **Medium** only, autoscale and dynamic executor allocation both enabled by default, 20-minute autopause. You can't edit a starter pool — it's Microsoft-managed.
3. Select **+ New pool** to create a custom pool named `pool-dp700-custom`:
   - **Node family**: default (Memory optimized)
   - **Node size**: Small
   - **Autoscale**: on, min 1 / max 3 nodes
   - **Dynamically allocate executors**: on
4. Select **Create**.

> [!success] Expected result
> `pool-dp700-custom` appears in the pool list with status **Ready**. If the **+ New pool** button is greyed out, the capacity admin toggle **Customized workspace pools** isn't enabled for this capacity — as the trial's own Capacity administrator, enable it from **Admin portal → Capacity settings → (your trial capacity) → Spark Compute → Customized workspace pools**, then retry.

> [!note]
> You don't need to make `pool-dp700-custom` the workspace default — leave the workspace on **Starter pool** so notebooks in later labs start quickly. This step is about seeing the custom-pool configuration surface, which the exam tests directly.

### Step 4: Create an Environment and pin a runtime version

1. In `dp700-labs`, select **+ New item → Environment**. Name it `env-dp700`.
2. Open `env-dp700` → **Home** tab → **Runtime** dropdown → confirm **Runtime 1.3 (Spark 3.5, Delta Lake 3.2)** is selected — this is the GA default; leave Runtime 2.0 (preview) alone for these labs.
3. Select **Spark compute** tab → note where custom Spark properties and the **Acceleration** tab (native execution engine toggle) live — no changes needed here for this lab.
4. Select **Save**, then **Publish**. Publishing takes a few minutes.

> [!success] Expected result
> `env-dp700`'s status changes from **Unpublished changes** to **Published**, with Runtime 1.3 shown on the item card.

> [!note]
> You are not setting `env-dp700` as the workspace default environment in this lab — that would slow every subsequent notebook's session start while you're actively iterating through the lab pack. The exam tests that you *know how* (**Workspace settings → Spark settings → Environment tab → Set default environment**), not that every lab workspace uses one.

### Step 5: Create the `lh_bronze` lakehouse

1. In `dp700-labs`, select **+ New item → Lakehouse**. Name it `lh_bronze`.
2. Wait for provisioning — you land in the Lakehouse explorer with empty **Tables** and **Files** sections.

> [!success] Expected result
> `lh_bronze` appears in the workspace item list as type **Lakehouse**, with an auto-created SQL analytics endpoint and default semantic model alongside it.

### Step 6: Create a domain and assign the workspace

1. Gear icon (top-right) → **Admin portal → Domains** tab.
2. Select **Create new domain**. Name: `dp700-domain`. Select **Create**.
3. Open `dp700-domain` → **Assign workspaces** → **By workspace name** → search and select `dp700-labs` → confirm.

> [!success] Expected result
> `dp700-labs` now shows `dp700-domain` as its associated domain in the workspace list and in **Workspace settings → General**. Item visibility and access are unaffected by this — domains only change discovery and delegated governance (see [02-Domain Settings](../../01-fabric-workspace-settings/02-domain-settings.md)).

> [!warning] Common Mistake
> Only a **Fabric admin** can create the domain itself (Step 6.2). If you aren't a Fabric admin in your tenant, ask one to create `dp700-domain`, or skip this step and read [02-Domain Settings](../../01-fabric-workspace-settings/02-domain-settings.md) instead — it doesn't block any later lab.

### Step 7: Generate the shared retail dataset

1. In `dp700-labs`, select **+ New item → Notebook**. Name it `nb-generate-dataset`.
2. Attach it to `lh_bronze` (default lakehouse) via the **Lakehouses** pane on the left.
3. Paste the following into the first cell and run it:

```python
from pyspark.sql import Row
import random
from datetime import datetime, timedelta

random.seed(700)

# --- customers (includes a synthetic PII column for Lab 03's DDM/CLS exercises) ---
customers = [
    Row(
        customer_id=i,
        customer_name=f"Customer {i}",
        region=random.choice(["EAST", "WEST", "NORTH", "SOUTH"]),
        signup_date=(datetime(2025, 1, 1) + timedelta(days=random.randint(0, 500))).strftime("%Y-%m-%d"),
        email=f"customer{i}@example.com",
        ssn=f"{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(1000,9999)}",
    )
    for i in range(1, 51)
]
df_customers = spark.createDataFrame(customers)

# --- products ---
products = [
    Row(
        product_id=i,
        product_name=f"Product {i}",
        category=random.choice(["Electronics", "Home", "Apparel", "Grocery", "Toys"]),
        unit_price=round(random.uniform(5, 500), 2),
    )
    for i in range(1, 31)
]
df_products = spark.createDataFrame(products)

# --- orders ---
orders = []
for i in range(1, 201):
    order_date = datetime(2026, 1, 1) + timedelta(days=random.randint(0, 190))
    orders.append(Row(
        order_id=i,
        customer_id=random.randint(1, 50),
        order_date=order_date.strftime("%Y-%m-%d"),
        status=random.choice(["Completed", "Pending", "Cancelled"]),
    ))
df_orders = spark.createDataFrame(orders)

# --- order_items (line items, FK to orders + products) ---
order_items = []
item_id = 1
for o in orders:
    for _ in range(random.randint(1, 4)):
        order_items.append(Row(
            order_item_id=item_id,
            order_id=o.order_id,
            product_id=random.randint(1, 30),
            quantity=random.randint(1, 5),
        ))
        item_id += 1
df_order_items = spark.createDataFrame(order_items)

# --- events (clickstream-style; feeds Lab 09's Eventstream/KQL lab) ---
event_types = ["page_view", "add_to_cart", "purchase", "search"]
events = [
    Row(
        event_id=i,
        customer_id=random.randint(1, 50),
        event_type=random.choice(event_types),
        event_time=(datetime(2026, 7, 1) + timedelta(minutes=random.randint(0, 10000))).strftime("%Y-%m-%d %H:%M:%S"),
    )
    for i in range(1, 501)
]
df_events = spark.createDataFrame(events)

# --- write as managed Delta tables (Tables/) ---
for name, df in [
    ("customers", df_customers),
    ("products", df_products),
    ("orders", df_orders),
    ("order_items", df_order_items),
    ("events", df_events),
]:
    df.write.format("delta").mode("overwrite").saveAsTable(name)

# --- also drop CSV copies under Files/raw/ so later labs have a file-based source ---
for name, df in [
    ("customers", df_customers),
    ("products", df_products),
    ("orders", df_orders),
    ("order_items", df_order_items),
    ("events", df_events),
]:
    df.write.mode("overwrite").option("header", "true").csv(f"Files/raw/{name}")

print(
    f"Bronze dataset generated: {df_customers.count()} customers, "
    f"{df_products.count()} products, {df_orders.count()} orders, "
    f"{df_order_items.count()} order_items, {df_events.count()} events"
)
```

> [!success] Expected result
> Cell output: `Bronze dataset generated: 50 customers, 30 products, 200 orders, ~500 order_items, 500 events` (the exact `order_items` count varies slightly since it's randomized per order). `lh_bronze`'s **Tables** section shows five Delta tables; **Files/raw/** shows five CSV folders.

1. Verify with a quick SQL check in a second cell:

```python
spark.sql("SELECT COUNT(*) AS order_item_rows FROM order_items").show()
spark.sql("SELECT region, COUNT(*) AS n FROM customers GROUP BY region ORDER BY region").show()
```

> [!success] Expected result
> Two small result tables print — a single `order_item_rows` count, and a four-row region breakdown (EAST/NORTH/SOUTH/WEST) that sums to 50.

### Step 8: Tour OneLake workspace settings

1. **Workspace settings → OneLake** tab.
2. Note **Users can access data stored in OneLake with apps external to Fabric** — leave this **off** for the lab pack; no external ADLS-API tooling is required.
3. Note the **Shortcut cache** section — retention slider (1–28 days) and **Reset cache** button. Leave caching off for now; Lab 05 revisits this when an external shortcut exists to cache.
4. Note **OneLake diagnostics** — where you'd pick a destination lakehouse for access-event logs. Leave off.

> [!success] Expected result
> You can point to where each of the three settings — external app access, shortcut cache, diagnostics — lives, and state in one sentence what each solves (see [03-OneLake Settings](../../01-fabric-workspace-settings/03-onelake-settings.md#workspace-onelake-settings-at-a-glance) if you get stuck).

### Step 9: Tour Apache Airflow job workspace settings

1. **Workspace settings → Data Factory → Apache Airflow Runtime Settings**.
2. Note the **Default Data Workflow Setting** dropdown — currently **Starter Pool**.
3. Change the dropdown to **New Pool** to see the custom-pool fields: **Name**, **Compute node size** (Small/Large), **Enable autoscale**, **Extra nodes**. Don't select **Create** — this is a tour, not a lab requirement (Apache Airflow job creation itself is out of scope for this pack).
4. Navigate away without saving.

> [!success] Expected result
> You've seen both Airflow pool types and can state the starter-vs-custom tradeoff from memory: starter = instant, auto-deprovisions after 20 minutes idle; custom = always-on until manually paused, better for production DAGs. This is the July 2026 blueprint's sole Domain 1 wording change (it replaced the Dataflows Gen2 workspace-settings bullet) — see [04-Airflow Settings](../../01-fabric-workspace-settings/04-airflow-settings.md).

---

## Cleanup

**Keep everything** — every later lab in this pack depends on:

- The `dp700-labs` workspace, on trial capacity
- The `lh_bronze` lakehouse with its five Delta tables and five `Files/raw/` CSV folders
- The `dp700-domain` assignment (cosmetic; nothing breaks if you skipped Step 6)

Nothing to delete. If you created `pool-dp700-custom` (Step 3) and don't want it consuming a slot in your pool list, it's safe to delete — no later lab references it by name.

## What the Exam Asks About This

- [01-Spark Settings](../../01-fabric-workspace-settings/01-spark-settings.md) — starter vs. custom pool tradeoffs, environments, runtime versions, high concurrency, native execution engine
- [02-Domain Settings](../../01-fabric-workspace-settings/02-domain-settings.md) — domain roles, workspace assignment methods, default domain
- [03-OneLake Settings](../../01-fabric-workspace-settings/03-onelake-settings.md) — external app access vs. shortcut cache vs. diagnostics, three independent levers
- [04-Airflow Settings](../../01-fabric-workspace-settings/04-airflow-settings.md) — starter vs. custom pool for Apache Airflow job, the July 2026 blueprint change

---

**[↑ Back to Labs Index](./labs.md) | [Next → Lab 02: Lifecycle, Git & Deployment](./02-lifecycle-git-deployment.md)**
