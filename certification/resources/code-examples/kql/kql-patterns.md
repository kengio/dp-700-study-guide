---
title: KQL Patterns
type: code-examples
tags:
  - dp-700
  - fabric
  - code-examples
  - kql
  - eventhouse
  - materialized-views
  - update-policy
---

# KQL Patterns

Complete, runnable KQL patterns for a Fabric Eventhouse — each one is a full command sequence (create → configure → ingest → query), not an isolated snippet. Syntax-level teaching (`summarize`/`extend`/`project`, join kinds, `lookup`) lives in [07-Batch Transformation: KQL Transformations](../../../07-batch-transformation/04-kql-transformations.md); these patterns assemble that vocabulary into complete jobs.

## Table of Contents

- [[#1. Update Policy: Transform-on-Ingest]]
- [[#2. Materialized View Dedup with arg_max]]
- [[#3. Tumbling-Window Aggregation]]
- [[#4. Sessionization with row_window_session]]
- [[#5. T-SQL to KQL Rosetta Table]]
- [[#6. Late and Duplicate Handling with ingestion_time()]]
- [[#7. Alert-Feeding Aggregation Query]]

---

## 1. Update Policy: Transform-on-Ingest

**Scenario:** Raw web clickstream events land as loosely-typed JSON strings in `RawClickstream`. Parse them into a well-typed `Clicks` table automatically, the moment they're ingested — no external pipeline.

```kusto
// 1. Source table: raw, loosely typed
.create table RawClickstream (Payload: string)

// 2. Target table: the well-typed, transformed shape
.create table Clicks (
    SessionId: string,
    UserId: string,
    PageUrl: string,
    ClickTimestamp: datetime
)

// 3. A function that performs the transformation
.create function ParseClickstream() {
    RawClickstream
    | extend Parsed = parse_json(Payload)
    | project
        SessionId = tostring(Parsed.sessionId),
        UserId = tostring(Parsed.userId),
        PageUrl = tostring(Parsed.pageUrl),
        ClickTimestamp = todatetime(Parsed.ts)
}

// 4. Attach the update policy — IsTransactional guarantees the source
// ingestion rolls back too if the transform query fails
.alter table Clicks policy update
@'[{ "IsEnabled": true, "Source": "RawClickstream", "Query": "ParseClickstream()", "IsTransactional": true, "PropagateIngestionProperties": false }]'

// 5. Ingest into the source — the update policy fires automatically
.set-or-append RawClickstream <|
    datatable(Payload: string)
    [
        '{"sessionId":"s-001","userId":"u-501","pageUrl":"/home","ts":"2026-07-11T09:00:00Z"}',
        '{"sessionId":"s-001","userId":"u-501","pageUrl":"/pricing","ts":"2026-07-11T09:01:30Z"}'
    ]

// Expected result: Clicks now has 2 typed rows with no manual transform
// step run — the update policy did it on ingest.
Clicks
| where SessionId == "s-001"
| order by ClickTimestamp asc
```

> [!warning] Common Mistake
> Referencing `RawClickstream` with a qualified name (`database("Db").RawClickstream`) inside `ParseClickstream()`. Update-policy queries must reference the source table **unqualified** — see [07-Batch Transformation: KQL Transformations](../../../07-batch-transformation/04-kql-transformations.md).

---

## 2. Materialized View Dedup with arg_max

**Scenario:** `RawOrders` receives re-sent duplicate order events from an at-least-once source. Maintain a continuously deduplicated `LatestOrders` view, backfilled from existing data, and compare the always-fresh view against the faster (slightly stale) materialized-only read.

```kusto
.create table RawOrders (OrderId: string, Amount: real, Status: string, IngestionTime: datetime)

// backfill=true populates the view from existing RawOrders data immediately,
// instead of starting empty and only capturing rows ingested from now on
.create materialized-view with (backfill=true) LatestOrders on table RawOrders
{
    RawOrders
    | summarize arg_max(IngestionTime, *) by OrderId
}

.set-or-append RawOrders <|
    datatable(OrderId: string, Amount: real, Status: string, IngestionTime: datetime)
    [
        "ORD-1001", 250.00, "Pending",  datetime(2026-07-11T09:00:00Z),
        "ORD-1001", 250.00, "Shipped",  datetime(2026-07-11T09:15:00Z),  // re-sent with updated status
        "ORD-1002", 89.50,  "Pending",  datetime(2026-07-11T09:02:00Z)
    ]

// Always-fresh: combines the materialized part with the not-yet-materialized delta
LatestOrders
| where OrderId == "ORD-1001"

// Faster, may lag slightly: reads only the pre-computed materialized part
materialized_view("LatestOrders")
| where OrderId == "ORD-1001"

// Expected result: both queries return exactly 1 row for ORD-1001 with
// Status = "Shipped" (the later IngestionTime), not 2 rows — arg_max kept
// only the latest-ingested version per OrderId.
```

> [!note]
> `materialized_view("LatestOrders")` skips the delta-merge step and is faster, at the cost of a small amount of staleness — see [07-Batch Transformation: KQL Transformations](../../../07-batch-transformation/04-kql-transformations.md) for when to prefer each query form.

---

## 3. Tumbling-Window Aggregation

**Scenario:** Serve a live dashboard with an always-current 5-minute average device temperature, without re-computing the full aggregation from raw data on every dashboard refresh.

```kusto
.create table Telemetry (DeviceId: string, Temperature: real, EventTime: datetime)

// Materialized views require a supported aggregation in their query —
// bin() inside summarize is the tumbling-window aggregation itself
.create materialized-view with (backfill=true) DeviceTempByWindow on table Telemetry
{
    Telemetry
    | summarize AvgTemperature = avg(Temperature), ReadingCount = count()
        by DeviceId, bin(EventTime, 5m)
}

.set-or-append Telemetry <|
    datatable(DeviceId: string, Temperature: real, EventTime: datetime)
    [
        "dev-01", 21.5, datetime(2026-07-11T09:00:10Z),
        "dev-01", 22.0, datetime(2026-07-11T09:02:45Z),
        "dev-01", 30.0, datetime(2026-07-11T09:06:00Z)   // falls in the NEXT 5-minute bucket
    ]

// The dashboard queries the always-fresh materialized view directly —
// no re-aggregation of raw Telemetry needed on every refresh
DeviceTempByWindow
| where DeviceId == "dev-01"
| order by EventTime asc

// Expected result: 2 rows for dev-01 — one 09:00 bucket averaging the
// first two readings (21.75), one 09:05 bucket with just the third (30.0).
```

> [!note] Mental model
> A tumbling-window materialized view is the standing, always-current version of the one-shot `bin()` query from [08-Streaming Data: Windowing Functions](../../../08-streaming-data/05-windowing-functions.md) — same `bin()` bucketing, but Kusto keeps it continuously up to date instead of re-scanning raw data per query.

---

## 4. Sessionization with row_window_session

**Scenario:** Group web events into user sessions that close after 30 minutes of inactivity, then compute session duration and event count per session — the KQL equivalent of a Spark `session_window()` aggregation.

```kusto
.create table WebEvents (UserId: string, EventTime: datetime, PageUrl: string)

.set-or-append WebEvents <|
    datatable(UserId: string, EventTime: datetime, PageUrl: string)
    [
        "u-501", datetime(2026-07-11T09:00:00Z), "/home",
        "u-501", datetime(2026-07-11T09:05:00Z), "/pricing",
        "u-501", datetime(2026-07-11T09:45:00Z), "/home",     // > 30 min gap -> new session
        "u-502", datetime(2026-07-11T09:10:00Z), "/home"
    ]

// row_window_session requires the input serialized (sorted) by the
// partition key and timestamp before it can compute session boundaries
WebEvents
| sort by UserId, EventTime asc
| extend SessionId = row_window_session(EventTime, 30m, 30m, UserId != prev(UserId))
| summarize
    SessionStart = min(EventTime),
    SessionEnd = max(EventTime),
    EventCount = count()
    by UserId, SessionId
| extend SessionDurationMinutes = datetime_diff('minute', SessionEnd, SessionStart)

// Expected result: u-501 has 2 sessions (09:00-09:05, and a single-event
// session at 09:45); u-502 has 1 session. EventCount sums to 4 across all
// rows, matching the 4 ingested events.
```

> [!note]
> `row_window_session(TimeCol, MaxDistanceFromFirst, MaxDistanceBetweenNeighbors, RestartCol)` needs pre-sorted input — an unsorted call silently produces wrong session boundaries. This full worked example is the code the comparison table in [08-Streaming Data: Windowing Functions](../../../08-streaming-data/05-windowing-functions.md) only names, not runs.

---

## 5. T-SQL to KQL Rosetta Table

**Scenario:** A T-SQL-background engineer needs the KQL equivalent for ten common operations, with a runnable snippet for each — not just a mapping table.

| # | T-SQL | KQL | Runnable KQL example |
| :-- | :--- | :--- | :--- |
| 1 | `SELECT col1, col2` | `\| project` | `Orders \| project OrderId, Amount` |
| 2 | `SELECT * EXCEPT (col1)` | `\| project-away` | `Orders \| project-away InternalNotes` |
| 3 | `WHERE condition` | `\| where` | `Orders \| where Amount > 100` |
| 4 | `GROUP BY ... SUM()` | `\| summarize ... by` | `Orders \| summarize sum(Amount) by CustomerId` |
| 5 | Computed column in `SELECT` | `\| extend` | `Orders \| extend IsLarge = Amount > 1000` |
| 6 | `INNER JOIN ... ON` | `\| join kind=inner` | `Orders \| join kind=inner (Customers) on CustomerId` |
| 7 | `ROW_NUMBER() OVER (...) = 1` | `\| summarize arg_max(...)` | `Orders \| summarize arg_max(OrderDate, *) by CustomerId` |
| 8 | `DATEPART`/`DATETRUNC` bucketing | `bin()` | `Orders \| summarize count() by bin(OrderDate, 1d)` |
| 9 | `WITH x AS (...)` (CTE) | `let x = (...);` | `let recent = Orders \| where OrderDate > ago(7d); recent \| count` |
| 10 | `MERGE`-driven ETL on write | Update policy | see [Pattern 1](#1-update-policy-transform-on-ingest) above |

```kusto
// A single query chaining several rosetta-table rows together:
// WHERE -> computed column -> GROUP BY -> tumbling bucket, in one pipeline
Orders
| where Amount > 0                                    // #3
| extend AmountRounded = round(Amount, 2)              // #5
| summarize
    TotalAmount = sum(AmountRounded),
    OrderCount = count()
    by CustomerId, bin(OrderDate, 1d)                  // #4 + #8
| project CustomerId, OrderDate = OrderDate, TotalAmount, OrderCount  // #1
```

---

## 6. Late and Duplicate Handling with ingestion_time()

**Scenario:** Estimate source-to-Eventhouse ingestion latency, and run a "process only what's arrived since last check" query using `ingestion_time()` instead of a business event timestamp — useful when the source's own timestamp is unreliable but ingestion order is trustworthy.

```kusto
// ingestion_time() only returns values if the IngestionTime policy was
// enabled BEFORE the data was ingested — enable it first
.alter table RawOrders policy ingestiontime true

.set-or-append RawOrders <|
    datatable(OrderId: string, Amount: real, Status: string, IngestionTime: datetime)
    [ "ORD-2001", 42.00, "Pending", datetime(2026-07-11T10:00:00Z) ]

// Estimate ingestion latency: compare the source-stamped time to the
// actual Kusto ingestion time (only an estimate — clocks aren't synchronized)
RawOrders
| extend ActualIngestionTime = ingestion_time()
| extend LatencySeconds = datetime_diff('second', ActualIngestionTime, IngestionTime)
| project OrderId, IngestionTime, ActualIngestionTime, LatencySeconds

// "Since last check" pattern: a control table tracks the last-seen
// ingestion_time() high-water mark, analogous to the watermark pattern in
// T-SQL/PySpark — but based on ingestion order, not a business event time
let LastCheckpoint = datetime(2026-07-11T09:30:00Z);  // read from a control table in practice
RawOrders
| extend ActualIngestionTime = ingestion_time()
| where ActualIngestionTime > LastCheckpoint

// Expected result: the latency query returns a small positive
// LatencySeconds per row (ingestion always happens after the source
// timestamp); the checkpoint query returns only rows ingested after
// 09:30 UTC, regardless of what their business OrderDate/IngestionTime says.
```

> [!warning] Common Mistake
> `ingestion_time()` returns `null` for every row ingested **before** the IngestionTime policy was enabled — enabling the policy doesn't retroactively backfill hidden timestamps for already-ingested data. For guaranteed exactly-once *processing* (not just late-data detection), prefer [database cursors](https://learn.microsoft.com/en-us/kusto/management/database-cursor?view=microsoft-fabric) over `ingestion_time()` comparisons — `ingestion_time()` values can't be used to strictly order concurrent ingestion operations.

---

## 7. Alert-Feeding Aggregation Query

**Scenario:** Feed a Fabric Data Activator alert with a query that flags any store whose order rate in the last 5 minutes exceeds 3x its trailing 1-hour average — a threshold-based anomaly signal, not a raw event stream.

```kusto
let RecentWindow = 5m;
let BaselineWindow = 1h;
let SpikeMultiplier = 3.0;
//
let RecentRate = Orders
    | where OrderTime > ago(RecentWindow)
    | summarize RecentOrderCount = count() by StoreId;
//
let BaselineRate = Orders
    | where OrderTime between (ago(BaselineWindow) .. ago(RecentWindow))
    | summarize BaselineOrderCount = count() by StoreId
    | extend BaselineAvgPer5Min = BaselineOrderCount / ((BaselineWindow - RecentWindow) / RecentWindow);
//
RecentRate
| join kind=inner BaselineRate on StoreId
| extend IsSpike = RecentOrderCount > (BaselineAvgPer5Min * SpikeMultiplier)
| where IsSpike == true
| project StoreId, RecentOrderCount, BaselineAvgPer5Min, SpikeMultiplier

// Expected result: zero rows in steady state; a row appears for a StoreId
// only when its trailing-5-minute order count exceeds 3x its own trailing-
// hour baseline rate — this shape (a query returning 0-or-more "triggered"
// rows) is exactly what a Data Activator rule polls and reacts to.
```

> [!note]
> Data Activator (Reflex) alert rules can trigger directly off a KQL queryset query like this one, watching for the result set to be non-empty (or a specific column to cross a threshold) — the query itself does the anomaly math, and the alerting layer just polls it.

## Related Topics

- [07-Batch Transformation: KQL Transformations](../../../07-batch-transformation/04-kql-transformations.md)
- [08-Streaming Data: KQL Real-Time](../../../08-streaming-data/04-kql-realtime.md)
- [08-Streaming Data: Windowing Functions](../../../08-streaming-data/05-windowing-functions.md)
- [05-Loading Patterns: Streaming Loading Pattern](../../../05-loading-patterns/03-streaming-loading-pattern.md)

---

**[↑ Back to Code Examples](../code-examples.md)**
