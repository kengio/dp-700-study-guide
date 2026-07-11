---
title: "Lab 09: Streaming — Eventstream & KQL"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - streaming
  - eventstream
  - eventhouse
  - kql
  - real-time-intelligence
  - activator
status: complete
---

# Lab 09: Streaming — Eventstream & KQL

## Overview

The exam surface furthest from typical batch muscle memory: an Eventhouse and KQL database, an Eventstream fed by Fabric's built-in sample data generator, a transform-on-ingest update policy, a deduplicating materialized view, a tumbling-window aggregation query, an Activator alert wired directly onto the live stream, and query acceleration on a OneLake shortcut into the same eventhouse.

> [!abstract]
>
> - Creates the `eh_dp700` Eventhouse and its default `eh_dp700` KQL database
> - Builds `es_dp700_stream`, an Eventstream with a built-in **Stock Market** sample source landing in `eh_dp700`
> - Writes a KQL **update policy** that parses raw ingested events into a typed target table on every ingest
> - Creates a **materialized view** using `arg_max()` to keep only the latest price per symbol
> - Runs a **tumbling-window** aggregation query over the typed stream
> - Adds a **Fabric Activator** alert directly on the Eventstream, triggered by a price condition
> - Creates a **OneLake shortcut** from `eh_dp700` into `lh_bronze`, with **query acceleration** enabled at creation time

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) completed — `dp700-labs` workspace with `lh_bronze`. This lab's streaming source is Fabric's built-in sample generator, not the Lab 01 `events` table, so no prior lab's data pipeline is required — only the workspace itself.
>
> **Estimated time:** 50 minutes

---

## Steps

### Step 1: Create the `eh_dp700` Eventhouse

1. In `dp700-labs`, select **+ New item → Eventhouse**. Name it `eh_dp700`.
2. Select **Create**.

> [!success] Expected result
> `eh_dp700` appears in the workspace item list. A child KQL database, also named `eh_dp700`, is created automatically alongside it — an eventhouse and its default database always share a name, per [Create an eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/create-eventhouse#create-an-eventhouse). The eventhouse's **System overview** page opens, showing capacity and database health at a glance.

> [!note]
> An eventhouse can host multiple KQL databases that share its capacity and compute allocation, with unified monitoring across all of them from the same **System overview** page — this lab pack only needs the one default database, but a real deployment often groups several related domains (say, `orders`, `clickstream`, `iot-telemetry`) as siblings under a single eventhouse rather than provisioning a separate eventhouse per domain, since siblings share resources more efficiently than fully separate eventhouses would.

### Step 2: Tour the Real-Time hub

1. In the left nav, select **Real-Time** (the Real-Time hub icon).
2. Note the tabs: **Data sources** (connectors you can add as a new Eventstream source), **Fabric events** (system-level events like OneLake item changes), and **My streams** — a cross-workspace catalog of every Eventstream, Eventhouse, and KQL database you have access to, not scoped to `dp700-labs` alone.

> [!success] Expected result
> You can locate `eh_dp700` from the Real-Time hub even before creating `es_dp700_stream` in the next step — confirming the hub is a discovery/catalog surface layered over Real-Time Intelligence items, not a separate item type competing with Eventstream or Eventhouse.

### Step 3: Create the Eventstream with a sample data source

1. In `dp700-labs`, select **+ New item → Eventstream**. Name it `es_dp700_stream`. Select **Create**.
2. On the get-started page, select **Use sample data** (or, in Edit mode, **Add source → Sample data** on the ribbon).
3. In the **Sample data** pane, **Source name**: `src_stock_market`. **Sample data**: select **Stock Market** — a preset schema with `time`, `symbol`, `price`, and `volume` columns. Select **Add**.
4. On the canvas, select the **Transform events or add destination** tile → **Add destination → Eventhouse**.
5. **Destination name**: `dest_eh_dp700`. **Workspace**: `dp700-labs`. **Eventhouse**: `eh_dp700`. **KQL database**: `eh_dp700`. **Destination table**: create new, name it `raw_stock_ticks`. **Input data format**: JSON.
6. Select **Save**, then **Publish**.

> [!success] Expected result
> After publishing, switching to **Live view** shows events flowing from `src_stock_market` through `es_dp700_stream` into `dest_eh_dp700`. Within a minute, `raw_stock_ticks` in `eh_dp700` starts accumulating rows — confirm with a KQL query (Step 4 does this as part of the transform).

> [!note]
> `es_dp700_stream` was created with **enhanced capabilities** — the default for every new Eventstream item since they became GA — which is what makes the **Live view**/**Edit mode** split, derived streams, and the inline **Rules** pane in Step 7 available at all. An Eventstream created under the older "standard capabilities" model still works, but lacks these; if a workspace has older standard eventstreams lying around, the fix is to create a new enhanced one rather than trying to upgrade in place. `es_dp700_stream` is also now discoverable from **Step 2**'s Real-Time hub — per [02-Eventstreams § Real-Time Hub Relationship](../../08-streaming-data/02-eventstreams.md#real-time-hub-relationship).

### Step 4: Update policy — transform-on-ingest into a typed table

Open `eh_dp700`'s KQL database → **New query set** (or the inline query editor) and run:

```kusto
// Target table with the real, typed schema
.create table stock_ticks_typed (
    EventTime: datetime,
    Symbol: string,
    Price: real,
    Volume: long
)

// Function that reshapes a raw ingested row into the typed schema.
// Column names below assume the Stock Market sample's default field names (time, symbol, price, volume) —
// confirm actual field names with `raw_stock_ticks | take 5` first, and adjust if your tenant's sample differs.
.create-or-alter function TransformStockTicks() {
    raw_stock_ticks
    | project
        EventTime = todatetime(time),
        Symbol = tostring(symbol),
        Price = toreal(price),
        Volume = tolong(volume)
}

// Wire the update policy: every ingest into raw_stock_ticks also populates stock_ticks_typed
.alter table stock_ticks_typed policy update
@'[{"IsEnabled": true, "Source": "raw_stock_ticks", "Query": "TransformStockTicks()", "IsTransactional": true, "PropagateIngestionProperties": false}]'
```

```kusto
stock_ticks_typed
| take 10
```

> [!success] Expected result
> `stock_ticks_typed` fills automatically as new events land in `raw_stock_ticks`, with no separate pipeline or notebook driving the transform — the update policy fires synchronously on every ingest batch, per [Update policy overview](https://learn.microsoft.com/en-us/kusto/management/update-policy?view=microsoft-fabric). `IsTransactional: true` guarantees `raw_stock_ticks` isn't updated unless the transform into `stock_ticks_typed` also succeeds, so the two tables never drift out of sync.

> [!warning] Common Mistake
> Update policy queries can't perform cross-eventhouse or cross-database calls, can't reference external tables (with a narrow accelerated-external-table exception), and can't make callouts through a plugin. If `TransformStockTicks()` needs to enrich against a dimension table, that table must live in the *same* KQL database — this is the same "no cross-boundary reference" restriction materialized views carry in Step 5.

### Step 5: Materialized view — latest price per symbol via `arg_max`

```kusto
.create materialized-view mv_latest_price on table stock_ticks_typed
{
    stock_ticks_typed
    | summarize arg_max(EventTime, *) by Symbol
}
```

```kusto
mv_latest_price
| order by Symbol asc
```

> [!success] Expected result
> `mv_latest_price` holds exactly one row per distinct `Symbol` — the row with the maximum `EventTime` — continuously maintained as new data lands, without rescanning the full `stock_ticks_typed` table on every query. This is `arg_max(Timestamp, *)` dedup, the [Create materialized view](https://learn.microsoft.com/en-us/kusto/management/materialized-views/materialized-view-create?view=microsoft-fabric) pattern for "give me the latest state per key," not a `SELECT DISTINCT`-style dedup.

### Step 6: Tumbling-window aggregation query

```kusto
stock_ticks_typed
| where EventTime > ago(30m)
| summarize
    avg_price = avg(Price),
    total_volume = sum(Volume),
    tick_count = count()
    by Symbol, bin(EventTime, 5m)
| order by EventTime asc, Symbol asc
```

> [!success] Expected result
> One row per `Symbol` per non-overlapping 5-minute bucket — a true tumbling window, since `bin(EventTime, 5m)` assigns every row to exactly one bucket edge with no overlap and no gap. Compare this against [Windowing Functions § Worked Example](../../08-streaming-data/05-windowing-functions.md#worked-example-the-same-5-minute-tumbling-aggregate-three-ways), which shows the identical 5-minute tumbling aggregate in Spark Structured Streaming and Eventstream's own windowing operator — three engines, one concept.

> [!note] Mental model — tumbling vs. hopping vs. sliding
> `bin(EventTime, 5m)` is **tumbling**: fixed, non-overlapping buckets — every event belongs to exactly one window. A **hopping** window would advance the bucket boundary by less than its width (overlapping windows, an event can land in more than one), and a **sliding** window recomputes continuously as each new event arrives rather than on a fixed cadence. This lab only builds tumbling because it's the simplest and most commonly tested of the five window types — see the [full comparison table](../../08-streaming-data/05-windowing-functions.md#the-comparison-table) for when hopping or sliding actually earns its extra complexity (typically: overlapping SLA windows, or true event-at-a-time alerting).

### Step 7: Activator alert directly on the Eventstream

1. Return to `es_dp700_stream` → **Edit** mode.
2. On the ribbon, select **Add destination → Activator** (or select the **Transform events or add destination** tile → **Activator**).
3. **Destination name**: `dest_price_alert`. **Workspace**: `dp700-labs`. **Activator**: select **Create new** → name it `act_dp700_price_alert`.
4. Select **Save**, then **Publish**.
5. Switch to **Live view**, select the **Activator** icon on `dest_price_alert`, and in the **Rules** pane select **Add rule**:
   - **Rule name**: `Price spike`
   - **Condition**: `price* > 500` (adjust the threshold to a value that actually fires against the Stock Market sample's price range — check a few live values first if `500` never triggers)
   - **Action**: **Send email** to yourself, or **Teams → Message to individuals**
6. Select **Save**, confirm the rule appears in the **Rules** pane, then select **Send me a test action** to confirm delivery before relying on the live condition.

> [!success] Expected result
> The rule appears in the **Rules** pane with a start/stop toggle, and the test action delivers a notification. This wires the alert straight onto the Eventstream rather than the more roundabout path of building a Data Activator item from scratch and pointing it at a separate object — see [Add a Fabric Activator destination to an eventstream](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-destination-activator) for the underlying mechanics and the full **Rules** pane management options (stop/start, edit, delete, open in Activator UI).

### Step 8: OneLake shortcut into `eh_dp700`, with query acceleration

1. Open `eh_dp700`'s KQL database → **+ → New → OneLake shortcut**.
2. Source type: **Microsoft OneLake**. Navigate to `dp700-labs` → `lh_bronze` → `Tables` → select `customers`.
3. In the shortcut configuration, set **Accelerate** to **On**.
4. Select **Create**.

> [!success] Expected result
> A `customers` entry appears under **Shortcuts** in the KQL database explorer. Query it with:

```kusto
external_table('customers')
| take 10
```

> [!success] Expected result
> Ten rows return from `lh_bronze.customers` through the eventhouse, with no data copied — the same symbolic-link mental model as a lakehouse-to-lakehouse shortcut, now spanning item types. Because **Accelerate** was set to **On** at creation, Fabric caches this external Delta table's data as it lands in OneLake, giving near-native query performance without a separate ingestion pipeline — see [Query acceleration for OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/query-acceleration-overview). Query acceleration works over shortcuts to OneLake, ADLS Gen1, S3, GCS, and Azure Blob — but materialized views and update policies still can't reference an accelerated external table directly except through the narrow `external_table()` exception noted in Step 4's warning.

### Step 9: Worked scenario — three mechanisms, one eventhouse

Before moving on, work through this cold, then check your reasoning:

**Scenario**: A KQL database needs to support three requirements at once: (1) every raw ingested event must be reshaped into a strongly typed table the instant it arrives, with no separate orchestration job, (2) a dashboard needs "current status per device" for 50,000 devices without rescanning the full multi-billion-row history on every query, (3) a dimension table of 2 million product records lives in a lakehouse and must be joined against streaming events with near-native performance, without a nightly copy job keeping it in sync. Which KQL/Eventhouse mechanism fits each?

> [!success]- Answer
>
> 1. **Update policy** — transform-on-ingest is exactly what an update policy automates: it fires synchronously on every ingest into the source table, with no pipeline or notebook needed, the same mechanism Step 4 wired up for `stock_ticks_typed`.
> 2. **Materialized view with `arg_max()`** — "latest state per key" over a huge fact table is the textbook materialized-view use case; it avoids rescanning history by incrementally maintaining the aggregation as new data lands, the same pattern Step 5 built for `mv_latest_price`.
> 3. **OneLake shortcut with query acceleration enabled** — a shortcut avoids the copy entirely, and turning on **Accelerate** at creation (Step 8) closes the performance gap between querying a shortcut and querying native Eventhouse-ingested data, without a sync pipeline to maintain.
>
> All three ran in this lab against the same eventhouse — the exam consistently rewards recognizing which of these three (not a fourth, hand-built alternative) fits a given streaming/dimension-join scenario.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `raw_stock_ticks` stays empty after publishing the Eventstream | The destination table wasn't created before the first events arrived, or the KQL database wasn't fully provisioned yet | Re-check **Live view** for a green connection state on both the source and destination nodes; wait a minute and re-query |
| Step 4's `TransformStockTicks()` errors on an unknown column name | The Stock Market sample's actual field names differ from `time`/`symbol`/`price`/`volume` in your tenant's current sample version | Run `raw_stock_ticks \| take 5` first and adjust the `project` clause's source column names to match |
| Step 5's materialized view shows stale data | `mv_latest_price` was created with a `lookback` shorter than the gap between ingested batches, or a schema mismatch disabled the view | Check `.show materialized-view mv_latest_price` for `IsEnabled`; re-enable with `.enable materialized-view mv_latest_price` if it auto-disabled |
| Step 7's Activator condition never fires | The threshold value doesn't match the sample data's actual price range | Query `stock_ticks_typed \| summarize min(Price), max(Price)` and set the condition inside that range |
| Step 8's shortcut query returns a permission error | The calling identity lacks access to `lh_bronze.customers` directly — a shortcut never grants access on its own, the same rule as [Lab 05's internal shortcut](./05-batch-ingestion-shortcuts-mirroring.md#step-2-create-an-internal-shortcut-from-lh_silver-into-lh_bronze) | Grant access to the target table directly, not just the shortcut object |

## Cleanup

**Keep**:

- `eh_dp700`, `es_dp700_stream`, `stock_ticks_typed`, `mv_latest_price`, `act_dp700_price_alert`, and the `customers` shortcut — [Lab 10](./10-monitor-optimize.md) tours Eventstream and Eventhouse monitoring surfaces against these live objects
- Stop the Activator rule (**Rules** pane → toggle off) if you don't want ongoing notifications while working through the rest of the pack — the rule object itself is safe to leave defined

**Optional cleanup**:

- The Stock Market sample source generates continuous synthetic traffic and consumes a small amount of capacity while running — pause it (Eventstream **Edit** mode → select the source → **Pause**) if capacity conservation matters on a trial SKU, or leave it running for Lab 10's monitoring tour

## What the Exam Asks About This

- [02-Eventstreams](../../08-streaming-data/02-eventstreams.md) — sources, event processor transformations, destinations and delivery guarantees, derived streams
- [04-KQL Real-Time](../../08-streaming-data/04-kql-realtime.md) — update policies and materialized views for streaming transform, query acceleration limitations and billing, OneLake availability
- [05-Windowing Functions](../../08-streaming-data/05-windowing-functions.md) — the five window types, tumbling vs. hopping vs. sliding, late data and watermarks
- [03-Activator & Alerts](../../09-monitoring-alerting/03-activator-alerts.md) — events/objects/conditions/rules, alert sources, actions, limits and licensing

---

**[← Previous: Lab 08](./08-warehouse-tsql.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 10: Monitor & Optimize](./10-monitor-optimize.md)**
