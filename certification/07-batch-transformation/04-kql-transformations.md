---
title: KQL Transformations
type: topic
tags:
  - dp-700
  - fabric
  - batch-transformation
  - kql
  - eventhouse
  - materialized-views
  - update-policy
---

# KQL Transformations

## Overview

Kusto Query Language (KQL) is Eventhouse's native transformation language — built for shaping, enriching, and aggregating large volumes of semi-structured and time-series data. This topic covers the core shaping operators (`summarize`, `extend`, `project`), join kinds and their performance trade-offs, array-expansion and text-parsing operators, time-bucketing with `bin()`, and the two mechanisms KQL offers for standing, automated transformation: **materialized views** and **update policies**. It closes with a T-SQL→KQL translation table for engineers coming from a SQL background.

> [!abstract]
>
> - `summarize`, `extend`, `project`, and `project-away` are the core row/column shaping operators — think `GROUP BY`, computed columns, and `SELECT`/`SELECT ... EXCEPT`
> - KQL offers a dedicated `lookup` operator (broadcast-optimized fact/dimension enrichment) in addition to the general-purpose `join` operator with multiple join kinds
> - **Update policies** implement transform-on-ingest — a query runs automatically whenever new data lands in a source table, writing results to a target table with no external orchestration
> - **Materialized views** always return an up-to-date aggregation over a source table and are a ==generally available== feature, distinct from — and often preferable to — update policies for continuous aggregation

> [!tip] What the Exam Tests
>
> - Writing correct `summarize`/`extend`/`project` pipelines and choosing the right join kind for a fact/dimension enrichment scenario
> - Knowing when to use `lookup` (broadcast, fact/dimension shape) vs. `join` (general-purpose, either side could be larger)
> - Setting up an update policy for transform-on-ingest, and knowing its scoping rules (same database, matching schema)
> - Choosing between a materialized view and an update policy for a continuous-aggregation requirement

---

## Core Shaping Operators: summarize, extend, project, project-away

```kusto
// summarize: aggregate rows into groups (like GROUP BY)
Orders
| summarize TotalAmount = sum(Amount), OrderCount = count() by CustomerId

// extend: add a computed column, keeping all existing columns
Orders
| extend AmountRounded = round(Amount, 2), IsLargeOrder = Amount > 1000

// project: keep only the specified columns (like SELECT)
Orders
| project OrderId, CustomerId, Amount

// project-away: keep everything EXCEPT the specified columns
Orders
| project-away InternalDebugField, RawPayload
```

> [!note] Mental model — project vs. project-away
> `project` is packing a suitcase by listing exactly what goes in. `project-away` is packing the whole room and then pulling out the two things you don't want. Use `project` when the target column set is short and stable; use `project-away` when you're dropping a couple of noisy/internal columns from an otherwise wide table.

## Join Kinds and the lookup Operator

KQL's general-purpose `join` operator supports the same core join flavors as SQL, plus KQL-specific dedup-aware variants:

```kusto
// inner join — only matching rows from both sides
FactOrders
| join kind=inner (DimCustomers) on CustomerId

// leftouter join — all rows from the left, matched or not
FactOrders
| join kind=leftouter (DimCustomers) on CustomerId

// innerunique (the default kind) — inner join with left-side deduplication
FactOrders
| join (DimCustomers) on CustomerId
```

| Join kind | Behavior |
| :--- | :--- |
| `innerunique` *(default)* | Inner join with left-side deduplication — all columns from both tables |
| `inner` | Standard inner join — only matching rows |
| `leftouter` | All rows from the left table; unmatched right-side columns are null |
| `rightouter` / `fullouter` | Right/full outer join equivalents |
| `leftsemi` / `leftanti` | Keep (or exclude) left rows that have a match, without adding right-table columns |

The `lookup` operator performs a similar job to `join kind=leftouter`, but it's purpose-built for the fact/dimension enrichment pattern and behaves differently under the hood:

```kusto
// lookup — enrich a large fact table with columns from a small dimension table
FactOrders
| lookup kind=leftouter DimCustomers on CustomerId
```

> [!warning] Common Mistake
> Assuming `lookup` and `join` share the same performance assumptions. The `join` operator assumes the **left** table is the *smaller* one for its default execution plan; `lookup` assumes the exact opposite — the **left** (`$left`) table is the large fact table, and the **right** (`$right`) table is the small dimension table, which is automatically broadcast. If the right side of a `lookup` is larger than a few tens of MB, the query fails outright. Only `leftouter` (default) and `inner` are supported `lookup` kinds — no `rightouter`/`fullouter`/semi variants.

**Practice Question 1** *(Medium)*

A KQL query enriches a 50-billion-row fact table with columns from a 2 MB dimension table using `join kind=leftouter`. A colleague suggests switching to `lookup kind=leftouter` instead. Is this a good suggestion, and why?

A. No — `lookup` and `join` are functionally identical, so it makes no difference  
B. Yes — `lookup` automatically broadcasts the small right-side table to the large left-side table, which is the correct performance behavior for a fact/dimension enrichment at this scale, and it also avoids repeating the join-key columns in the output  
C. No — `lookup` only works when both tables are large  
D. Yes, but only because `lookup` supports more join kinds than `join`  

> [!success]- Answer
> **B. Yes — `lookup` automatically broadcasts the small right-side table to the large left-side table, which is the correct performance behavior for a fact/dimension enrichment at this scale, and it also avoids repeating the join-key columns in the output**
>
> This is exactly the shape `lookup` is optimized for: a large fact table (left) enriched by a small dimension table (right, automatically broadcast). `lookup` supports *fewer* kinds than `join` (only `leftouter` and `inner`), not more — option D is backwards.

## mv-expand: Expanding Arrays and Dynamic Columns

```kusto
// mv-expand turns each element of a dynamic array/property-bag column into its own row
RawEvents
| mv-expand Items

// mv-expand with a bagexpansion to also break out property-bag keys
RawEvents
| mv-expand kind=array Items
```

## parse and extract: Pulling Structure from Text

```kusto
// parse — extract multiple named fields from a semi-structured string in one step
RawLogs
| parse RawText with "[" Timestamp "] [" Level "] " Message

// extract — pull a single value using a regular expression
RawLogs
| extend UserId = extract(@"userId=(\d+)", 1, RawText)
```

## bin(): Time Bucketing

```kusto
// bin() rounds a datetime down to the nearest bucket boundary — the basis for time-series summarize
Telemetry
| summarize AvgCpu = avg(CpuPercent) by bin(Timestamp, 5m), DeviceId
```

## let Statements

```kusto
// let defines a reusable scalar, tabular, or function-like expression for the rest of the query
let lookbackWindow = 7d;
let highValueThreshold = 1000;
Orders
| where Timestamp > ago(lookbackWindow) and Amount > highValueThreshold
| summarize TotalAmount = sum(Amount) by CustomerId
```

## Materialized Views

A materialized view exposes an **aggregation query** over a source table, always returning up-to-date results by combining a pre-computed materialized part with a small "delta" of not-yet-materialized new rows.

```kusto
// Create a materialized view that keeps only the latest row per OrderId (arg_max dedup pattern)
.create materialized-view LatestOrders on table Orders
{
    Orders
    | summarize arg_max(IngestionTime, *) by OrderId
}

// Query the entire view (always fresh, combines materialized + delta)
LatestOrders

// Query only the materialized part for maximum performance (may lag slightly)
materialized_view("LatestOrders")
```

**Backfill:** materialized views can be created with a `backfill=true` option (or via `.create-or-alter` after ingestion) to populate the view retroactively from existing source-table data, rather than starting empty and only capturing new rows going forward.

> [!note] Mental model — materialized views vs. update policies
> A **materialized view** is a standing aggregation that Kusto keeps fresh for you automatically — you define the aggregation once, and querying the view is always fast and always current, no matter when you last "refreshed" it. An **update policy** is a transformation pipeline triggered on every ingest — it doesn't have to aggregate at all, and it writes into whatever target-table shape you define, once, per triggering ingest. Reach for a materialized view when the goal is "keep a rolled-up aggregate always current and fast to query." Reach for an update policy when the goal is "reshape/enrich every incoming record automatically as it lands."

## Update Policies: Transform-on-Ingest

An update policy triggers a query automatically whenever new data is ingested into a source table, writing the transformed result into a target table — no external orchestration required.

```kusto
// 1. Source table: raw, loosely typed
.create table RawOrderEvents (OriginalRecord: string)

// 2. Target table: the well-typed, transformed shape
.create table Orders (
    OrderId: string,
    CustomerId: string,
    Amount: real,
    OrderTimestamp: datetime
)

// 3. A function that performs the transformation
.create function ParseOrderEvents() {
    RawOrderEvents
    | parse OriginalRecord with
        "{orderId:" OrderId "," "customerId:" CustomerId "," "amount:" Amount:real "," "ts:" OrderTimestamp:datetime "}"
    | project OrderId, CustomerId, Amount, OrderTimestamp
}

// 4. Attach the update policy to the target table
.alter table Orders policy update
@'[{ "IsEnabled": true, "Source": "RawOrderEvents", "Query": "ParseOrderEvents()", "IsTransactional": true, "PropagateIngestionProperties": false }]'

// 5. Ingest into the source — the update policy fires automatically, populating Orders
.set-or-append RawOrderEvents <|
    datatable(OriginalRecord: string)
    ["{orderId:1001,customerId:501,amount:29.99,ts:2026-06-01T10:00:00Z}"]
```

Setting `IsTransactional: true` ensures that if the transformation query fails, the source ingestion is rolled back too — data isn't silently lost in the target table's absence. Multiple update policies can be attached to one table, and update policies can cascade (table A updates B, B updates C), though circular chains are detected and cut at runtime.

> [!warning] Common Mistake
> Referencing the source table by its qualified name (`database("Db").RawOrderEvents`) inside an update policy's query or its referenced function. Fabric requires the **unqualified table name** (`RawOrderEvents`) inside update-policy queries — qualified references aren't allowed there, even though they work fine in ad hoc queries.

**Practice Question 2** *(Hard)*

A team wants raw JSON telemetry landed into a staging table to be automatically parsed into a well-typed target table the moment it's ingested, with no external pipeline or schedule involved. Which KQL mechanism fits, and what setting should they enable to guarantee the source and target stay consistent if the transform query fails?

A. A materialized view with `backfill=true`  
B. An update policy on the target table, referencing the staging table as `Source`, with `IsTransactional: true`  
C. A `let` statement wrapping the parse logic  
D. A `lookup` operator joining the staging table to a dimension table  

> [!success]- Answer
> **B. An update policy on the target table, referencing the staging table as `Source`, with `IsTransactional: true`**
>
> This is the canonical transform-on-ingest scenario an update policy solves: automatic, ingest-triggered transformation with no external orchestration. `IsTransactional: true` is exactly the setting that guarantees the source table's ingestion is rolled back if the update policy's query fails, keeping source and target consistent. A materialized view solves continuous *aggregation*, not general reshaping/parsing; `let` is query-scoped, not a standing automation; `lookup` is a join operator, not a transformation-trigger mechanism.

**Practice Question 3** *(Medium)*

Which combination correctly matches each transform-on-ingest requirement to the right KQL mechanism?

A. "Always-current rolling aggregate for a dashboard" → update policy; "Parse raw text into typed columns on every ingest" → materialized view  
B. "Always-current rolling aggregate for a dashboard" → materialized view; "Parse raw text into typed columns on every ingest" → update policy  
C. Both requirements are solved identically by `bin()`  
D. Both requirements require an external pipeline; KQL has no native transform-on-ingest mechanism  

> [!success]- Answer
> **B. "Always-current rolling aggregate for a dashboard" → materialized view; "Parse raw text into typed columns on every ingest" → update policy**
>
> Materialized views are purpose-built for standing aggregations (their query must contain a supported aggregation function). Update policies are the general-purpose transform-on-ingest mechanism — parsing, enriching, or reshaping every incoming row, aggregation or not. Option D is wrong: both are native, orchestration-free KQL mechanisms.

## T-SQL → KQL Translation Table

| T-SQL | KQL equivalent |
| :--- | :--- |
| `SELECT col1, col2` | `\| project col1, col2` |
| `SELECT * EXCEPT (col1)` *(not native T-SQL, but the intent)* | `\| project-away col1` |
| `WHERE condition` | `\| where condition` |
| `GROUP BY ... SUM()/COUNT()` | `\| summarize sum(...), count() by ...` |
| Computed column in `SELECT` | `\| extend NewCol = expression` |
| `JOIN ... ON` | `\| join kind=inner (...) on ...` |
| `ROW_NUMBER() OVER (PARTITION BY k ORDER BY t DESC) = 1` (latest per key) | `\| summarize arg_max(t, *) by k` |
| `DATEPART`/`DATETRUNC`-style bucketing | `\| summarize ... by bin(Timestamp, 1h)` |
| `CTE` (`WITH x AS (...)`) | `let x = (...);` |
| Trigger / `MERGE`-driven ETL on write | Update policy |
| Indexed view / materialized aggregate | Materialized view |

## Use Cases

- Parsing free-text log or telemetry data into a well-typed target table automatically as it's ingested (update policy)
- Maintaining an always-fresh rolling aggregate (e.g., hourly device health summary) for a live dashboard (materialized view)
- Enriching a high-volume fact table (billions of rows) with a small reference/dimension table (`lookup`)
- Deduplicating a source table to "latest record per key" using `arg_max()` inside a materialized view

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `lookup` query fails with a size-related error | The right-side (dimension) table exceeds the broadcast size limit (a few tens of MB) | Switch to a regular `join`, or pre-filter/aggregate the dimension table down to a smaller size |
| Update policy query fails and source data still appears queryable | `IsTransactional` was left at its default `false` | Set `IsTransactional: true` if source/target consistency is required |
| Materialized view creation fails with an aggregation error | The view's query doesn't contain a supported aggregation function, or is defined over a non-deduplication materialized view | Ensure the query uses a supported aggregation (`summarize` with `sum`/`count`/`arg_max`, etc.); materialized-view-over-materialized-view requires the source view to be a `take_any(*)` dedup view |
| Update policy references a table with a qualified name and fails validation | Update-policy queries must reference the `Source` table unqualified | Use the bare table name inside the update policy's function/query, not `database("Db").TableName` |

## Best Practices

- Use `lookup` instead of `join` whenever the enrichment shape is genuinely fact (large) + dimension (small) — it's both faster and produces a cleaner output schema
- Always set `IsTransactional: true` on production update policies to avoid silent source/target drift on failure
- Prefer `materialized_view("Name")` over querying the view by name when a small amount of staleness is acceptable — it's faster because it skips the delta-merge step
- Use `let` statements to centralize thresholds and time windows at the top of a query for readability and reuse

## Exam Tips

> [!tip] Exam Tips
>
> - `lookup` broadcasts the **right** (small) table onto the **left** (large fact) table — the opposite assumption from `join`'s default
> - Materialized views solve continuous *aggregation*; update policies solve general transform-on-ingest (aggregation or not)
> - Update policy queries must reference the source table **unqualified** — no `database()`/`cluster()` prefixes
> - `arg_max(Timestamp, *)` inside `summarize` is KQL's "latest record per key" idiom — functionally parallel to `ROW_NUMBER() = 1` in T-SQL and the window-function pattern in PySpark

## Key Takeaways

- `summarize`/`extend`/`project`/`project-away` are KQL's core shaping operators, directly parallel to `GROUP BY`, computed columns, and `SELECT`
- `lookup` is a broadcast-optimized fact/dimension join; regular `join` supports more kinds but assumes the opposite size relationship
- Update policies implement transform-on-ingest with no external orchestration; materialized views implement always-fresh continuous aggregation — they solve different problems and can coexist
- The T-SQL→KQL translation table maps familiar SQL concepts onto their KQL operator equivalents for faster ramp-up

## Related Topics

- [03-T-SQL Transformations](./03-tsql-transformations.md)
- [05-Data Quality Patterns](./05-data-quality-patterns.md)
- [01-Choosing a Transform Tool](./01-choosing-transform-tool.md)

## Official Documentation

- [Kusto Query Language overview](https://learn.microsoft.com/en-us/kusto/query/?view=microsoft-fabric)
- [join operator](https://learn.microsoft.com/en-us/kusto/query/join-operator?view=microsoft-fabric)
- [lookup operator](https://learn.microsoft.com/en-us/kusto/query/lookup-operator?view=microsoft-fabric)
- [Materialized views](https://learn.microsoft.com/en-us/kusto/management/materialized-views/materialized-view-overview?view=microsoft-fabric)
- [Update policy overview](https://learn.microsoft.com/en-us/kusto/management/update-policy?view=microsoft-fabric)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-tsql-transformations.md) | [↑ Back to Section](./batch-transformation.md) | [Next →](./05-data-quality-patterns.md)**
