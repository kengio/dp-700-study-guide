---
title: "Lab 08: Warehouse T-SQL"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - warehouse
  - t-sql
  - ctas
  - merge
  - query-insights
  - statistics
status: complete
---

# Lab 08: Warehouse T-SQL

## Overview

This lab builds a small star schema inside `wh_gold` — the same warehouse [Lab 03](./03-security-onelake-ddm.md) secured — using cross-database CTAS to pull from `lh_bronze` and `lh_silver` without ever touching an external storage account, layers a `MERGE` upsert on top, inspects `queryinsights` for the statements you just ran, re-confirms Lab 03's RLS/DDM are still filtering results, and finishes with manual statistics.

> [!abstract]
>
> - Builds `dbo.DimProduct` and `dbo.FactOrderItems` in `wh_gold` via **cross-database CTAS** reading directly from `lh_bronze`'s and `lh_silver`'s SQL analytics endpoints — no external storage account, no `COPY INTO`, no credential
> - Upserts a simulated new batch into `dbo.FactOrderItems` with `MERGE`
> - Inspects `queryinsights.exec_requests_history` and `queryinsights.frequently_run_queries` for the queries this lab just generated
> - Re-runs Lab 03's RLS query against `dbo.Customers` to prove the security policy and masks are still in force, unmodified
> - Creates manual statistics on the new fact table's join/filter columns

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md), [Lab 03](./03-security-onelake-ddm.md) (`wh_gold` with `dbo.Customers`, its RLS policy, CLS grant, and DDM masks — **not recreated here**), [Lab 05](./05-batch-ingestion-shortcuts-mirroring.md), and [Lab 07](./07-pyspark-transformation.md) (`lh_silver.gold_sales_by_region_month`, `lh_silver.silver_order_items`) all completed.
>
> **Estimated time:** 40 minutes

---

## Steps

### Step 1: Confirm `wh_gold`'s Lab 03 security is untouched

Open `wh_gold` → **New SQL query**:

```sql
SELECT CustomerID, CustomerName, Region, Email, SSN
FROM dbo.Customers
ORDER BY CustomerID;
```

> [!success] Expected result
> Rows return for `EAST`-region customers only (RLS from Lab 03 Step 5 still active), and `SSN`/`Email` show their masked forms *unless* you're querying as workspace Admin/Member/Contributor, in which case implicit `CONTROL` still unmasks them — exactly the state Lab 03 left. This lab adds new objects around `dbo.Customers`; it never alters it.

### Step 2: Cross-database CTAS — `DimProduct`, with no external storage account

Fabric Warehouse's `COPY INTO` statement ingests from an **external Azure storage account** — the wrong tool when the source is another Fabric item in the same workspace. Three-part-name cross-database queries need nothing external at all: the current database context is `wh_gold` (where the `CREATE TABLE` writes), and the `SELECT` reads live from `lh_bronze`'s SQL analytics endpoint in the same workspace.

```sql
CREATE TABLE dbo.DimProduct
AS
SELECT
    product_id   AS ProductKey,
    product_name AS ProductName,
    category     AS Category,
    unit_price   AS UnitPrice
FROM lh_bronze.dbo.products;

SELECT COUNT(*) AS n FROM dbo.DimProduct;
```

> [!success] Expected result
> `n = 30` — every row from `lh_bronze.products` lands in a brand-new `wh_gold` table via a single cross-database CTAS, with zero copy activities, zero staging, and zero external credentials involved. This is the [Cross-Database Three-Part-Name Queries](../../07-batch-transformation/03-tsql-transformations.md#cross-database-three-part-name-queries) pattern used as a load mechanism, not just a join.

> [!note]
> The lakehouse side of a cross-database query is always read-only through its SQL analytics endpoint — you can `SELECT` from `lh_bronze.dbo.products`, but you could never `UPDATE` it through this connection. That asymmetry is exactly why this CTAS writes into `wh_gold`, not the other way around.

### Step 3: Cross-database CTAS — `FactOrderItems`, joining two lakehouses

```sql
CREATE TABLE dbo.FactOrderItems
AS
SELECT
    oi.order_item_id AS OrderItemKey,
    oi.order_id       AS OrderKey,
    oi.product_id     AS ProductKey,
    oi.quantity       AS Quantity,
    o.order_date       AS OrderDate,
    o.customer_id      AS CustomerKey
FROM lh_bronze.dbo.order_items AS oi
JOIN lh_bronze.dbo.orders AS o
    ON oi.order_id = o.order_id;

SELECT COUNT(*) AS n FROM dbo.FactOrderItems;
```

> [!success] Expected result
> `n` matches `lh_bronze.order_items`'s row count (~500, exact value depends on the randomized per-order line-item count from Lab 01). The CTAS join spans two tables in the *same* lakehouse database (`lh_bronze`), which is a plain join — the cross-database part is `lh_bronze` vs. `wh_gold`, the write target.

### Step 4: `MERGE` upsert into `FactOrderItems`

Simulate a small batch of new/updated line items landing in `lh_silver.silver_order_items` (from [Lab 07](./07-pyspark-transformation.md)) and upsert them into the gold fact table:

```sql
MERGE dbo.FactOrderItems AS target
USING (
    SELECT
        order_item_id AS OrderItemKey,
        order_id       AS OrderKey,
        product_id     AS ProductKey,
        quantity       AS Quantity
    FROM lh_silver.dbo.silver_order_items
) AS source
ON target.OrderItemKey = source.OrderItemKey
WHEN MATCHED THEN
    UPDATE SET
        target.Quantity = source.Quantity
WHEN NOT MATCHED THEN
    INSERT (OrderItemKey, OrderKey, ProductKey, Quantity)
    VALUES (source.OrderItemKey, source.OrderKey, source.ProductKey, source.Quantity);

SELECT COUNT(*) AS n FROM dbo.FactOrderItems;
```

> [!success] Expected result
> `n` is unchanged from Step 3 — every row in `silver_order_items` already exists in `FactOrderItems` by `OrderItemKey` (same source lineage), so every row takes the `WHEN MATCHED` branch and updates `Quantity` in place (a no-op here since the values already match, but the mechanism is proven). Run it again with a modified `Quantity` in the source to see `WHEN MATCHED` actually change a value, or delete a few rows from `FactOrderItems` first to see `WHEN NOT MATCHED` insert them back.

> [!warning] Common Mistake
> `MERGE`'s `USING` source can be a cross-database `SELECT`, exactly like a CTAS — but the `target` of `MERGE` must always be a table in the *current* database context (`wh_gold` here). Trying to write `MERGE lh_silver.dbo.silver_order_items AS target` fails outright; cross-database writes aren't supported in Fabric Warehouse under any statement, `MERGE` included.

> [!note] Mental model — CTAS vs. `MERGE` as load mechanisms
> A CTAS is a **reset**: drop-and-rebuild, appropriate the first time a table exists or whenever a full reload is cheap enough to tolerate (Steps 2–3, run once against a small dimension and fact). `MERGE` is a **diff apply**: it changes only the rows that actually differ, appropriate for a recurring incremental load where re-deriving the whole table every run would waste compute (Step 4, and the pattern this lab pack already used in PySpark form back in [Lab 06's watermark load](./06-loading-patterns-incremental-scd.md#step-2-incremental-load--orders-from-lh_bronze-into-lh_silver-watermarked-on-order_date)). Reach for CTAS when you'd happily rebuild from scratch every time; reach for `MERGE` the moment "rebuild from scratch" becomes too expensive to run on every schedule tick.

### Step 5: Inspect Query Insights for the statements you just ran

```sql
SELECT TOP 10
    distributed_statement_id,
    command,
    allocated_cpu_time_ms,
    data_scanned_memory_mb,
    data_scanned_remote_storage_mb
FROM queryinsights.exec_requests_history
ORDER BY start_time DESC;
```

> [!success] Expected result
> The most recent rows include Step 2's `CREATE TABLE dbo.DimProduct`, Step 3's `CREATE TABLE dbo.FactOrderItems`, and Step 4's `MERGE` — allow a few minutes for entries to appear, since `queryinsights` completions land up to ~15 minutes after execution. If Step 2/3's rows aren't visible yet, re-run this query in a few minutes rather than assuming something failed.

```sql
SELECT TOP 10 query_hash, COUNT(*) AS run_count, AVG(allocated_cpu_time_ms) AS avg_cpu_ms
FROM queryinsights.exec_requests_history
GROUP BY query_hash
ORDER BY run_count DESC;
```

> [!success] Expected result
> Rows group by **query shape** (`query_hash`), not exact text — useful for spotting a parameterized query pattern that ran many times with different literal values. This lab's small, one-off statements each show `run_count = 1`; a production dashboard's refresh query would show a much higher count here. See [02-Warehouse Optimization § Query Insights](../../11-performance-optimization/02-warehouse-optimization.md#query-insights) for the full `queryinsights` schema.

### Step 6: Re-verify RLS and DDM still filter results — restricted context

`wh_gold`'s RLS predicate has **no role-based exemption at all** — even querying as workspace Admin, the filter still applies (the opposite of DDM's `CONTROL` bypass). Prove it's still enforced after this lab's new objects were added:

```sql
-- Still filtered to EAST-region rows only, regardless of your role
SELECT CustomerID, CustomerName, Region FROM dbo.Customers ORDER BY CustomerID;

-- Confirm the CLS grant on AnalystRole is unchanged (all columns except SSN)
SELECT * FROM sys.fn_my_permissions('dbo.Customers', 'Object')
WHERE permission_name = 'SELECT';
```

> [!success] Expected result
> The first query returns only `EAST`-region rows (customers 1 and 5), exactly as in [Lab 03 Step 5](./03-security-onelake-ddm.md#step-5-row-level-security--filter-by-region) — this **is** the restricted context: T-SQL RLS filters every querying principal identically, with no bypass, so "run this as yourself" already demonstrates the restriction directly. The second query lists your own effective permissions and confirms nothing about `dbo.Customers`'s security configuration drifted while you built the star schema around it.

Re-confirm the DDM masks from [Lab 03 Step 8](./03-security-onelake-ddm.md#step-8-dynamic-data-masking--mask-ssn-and-email) are also untouched:

```sql
SELECT CustomerID, Email, SSN FROM dbo.Customers ORDER BY CustomerID;
```

> [!success] Expected result
> As Admin/Member/Contributor, real `Email`/`SSN` values are still visible (implicit `CONTROL` still bypasses the mask) — the same behavior as Lab 03, proving `ALTER TABLE ... ADD MASKED WITH` wasn't accidentally dropped or altered by anything in Steps 2–5's new-object creation.

### Step 7: Manual statistics on the new fact table

```sql
-- Full-scan statistics on the columns FactOrderItems is joined and filtered on most
CREATE STATISTICS FactOrderItems_OrderKey_FullScan
ON dbo.FactOrderItems (OrderKey) WITH FULLSCAN;

CREATE STATISTICS FactOrderItems_ProductKey_FullScan
ON dbo.FactOrderItems (ProductKey) WITH FULLSCAN;

SELECT name, stats_id, auto_created, user_created
FROM sys.stats
WHERE object_id = OBJECT_ID('dbo.FactOrderItems');
```

> [!success] Expected result
> `sys.stats` lists the two manually created statistics (`user_created = 1`) alongside any automatically created ones from Steps 3–6's queries (`auto_created = 1`, `_WA_Sys_`-prefixed names). Creating these manually, right after the bulk CTAS load, front-loads the `FULLSCAN` cost deliberately instead of letting the first production query pay it synchronously — the [fire-drill vs. smoke-detector mental model](../../11-performance-optimization/02-warehouse-optimization.md#statistics-automatic-and-manual) from the topic file.

After [Lab 10](./10-monitor-optimize.md)'s final `OPTIMIZE` pass runs a fresh batch of activity against `wh_gold`, re-run `UPDATE STATISTICS dbo.FactOrderItems (FactOrderItems_OrderKey_FullScan) WITH FULLSCAN` if the row count changed meaningfully — Fabric's **incremental statistics refresh** only samples rows added since the last refresh for large, mostly-`INSERT` tables, so a manual `FULLSCAN` after a bulk change (like Step 4's `MERGE`) still buys more plan accuracy than waiting for the next automatic trigger.

### Step 8: Worked scenario — choosing the load mechanism

Before moving on, work through this cold, then check your reasoning:

**Scenario**: A team needs three things built against `wh_gold`: (1) a nightly refresh of `DimProduct` from `lh_bronze.products`, which lives in the same workspace and never grows past a few hundred rows, (2) a one-time historical backfill of 200 GB of Parquet files sitting in an external Azure Data Lake Storage Gen2 account nobody has moved into Fabric yet, (3) an hourly upsert of new/changed rows into `FactOrderItems` from `lh_silver.silver_order_items`. Which mechanism fits each, and why not `COPY INTO` for (1) or (3)?

> [!success]- Answer
>
> 1. **Cross-database CTAS** (recreate nightly, or wrap in a scheduled T-SQL script) — same-workspace Fabric items need nothing external; `COPY INTO` would require standing up an external storage account and credential for data that's already reachable via a three-part name.
> 2. **`COPY INTO`** — this is exactly the scenario `COPY INTO` is built for: a one-time (or repeatable) high-throughput load from an **external** Azure storage account, with `FILE_TYPE = 'PARQUET'` and no cross-database read available since the source isn't a Fabric item.
> 3. **`MERGE`** (Step 4's pattern) — an hourly upsert needs match/update/insert logic that neither `COPY INTO` (append-only ingestion) nor a plain CTAS (full rebuild, not incremental) provides.
>
> The general rule this lab pack builds toward: `COPY INTO` for external files, cross-database CTAS/`SELECT` for same-workspace Fabric items, and `MERGE` whenever the target needs row-level upsert semantics rather than a full reload.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Step 2/3's CTAS fails with an object-not-found error on `lh_bronze.dbo.products` | Cross-database queries require both items in the **same workspace and region/capacity** | Confirm `lh_bronze` and `wh_gold` are both in `dp700-labs`; a lakehouse in a different workspace needs a fully qualified name and cross-workspace permissions |
| Step 4's `MERGE` fails with a cross-database write error | You wrote `MERGE lh_silver...` as the target instead of `dbo.FactOrderItems` | `MERGE`'s target must always be in the current database (`wh_gold`); only the `USING` source can be cross-database |
| Step 5 shows no rows for queries you just ran | `queryinsights` completions can take up to ~15 minutes to appear, longer under heavy concurrency | Wait and re-query; this is expected latency, not a failure |
| Step 6's RLS query unexpectedly returns all regions | You're querying as `manager@contoso.com` (the predicate's explicit exemption from [Lab 03](./03-security-onelake-ddm.md#step-5-row-level-security--filter-by-region)), or the policy was dropped | Check `USER_NAME()` and confirm `CustomerRegionFilter`'s `STATE` is still `ON` |

## Cleanup

**Keep**:

- `dbo.DimProduct` and `dbo.FactOrderItems` in `wh_gold`, plus the manual statistics from Step 7 — [Lab 10](./10-monitor-optimize.md)'s final optimization pass reviews query insights and statistics on these tables again
- `dbo.Customers` and its RLS/CLS/DDM configuration, unchanged from Lab 03

Nothing to delete — this lab only added objects to `wh_gold`.

## What the Exam Asks About This

- [03-T-SQL Transformations](../../07-batch-transformation/03-tsql-transformations.md) — CTAS, `MERGE`, cross-database three-part-name queries, `#temp` tables vs. CTEs
- [02-Warehouse Optimization](../../11-performance-optimization/02-warehouse-optimization.md) — automatic vs. manual statistics, Query Insights schema, caching layers
- [02-Granular Access Controls](../../03-security-governance/02-granular-access-controls.md) — the RLS/CLS bypass matrix, revisited under new load

---

**[← Previous: Lab 07](./07-pyspark-transformation.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 09: Streaming](./09-streaming-eventstream-kql.md)**
