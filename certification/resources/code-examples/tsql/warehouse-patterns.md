---
title: T-SQL Warehouse Patterns
type: code-examples
tags:
  - dp-700
  - fabric
  - code-examples
  - t-sql
  - warehouse
  - merge
  - scd
---

# T-SQL Warehouse Patterns

Complete, runnable T-SQL patterns for a Fabric Warehouse — each one is a full script. Syntax-level teaching (CTAS vs. `INSERT..SELECT`, `#temp` tables, Fabric's data-type subset) lives in [07-Batch Transformation: T-SQL Transformations](../../../07-batch-transformation/03-tsql-transformations.md); these patterns assemble that vocabulary into complete jobs.

> [!info] Fabric Warehouse status used throughout this file
> `MERGE` is ==generally available (GA)== in Fabric Warehouse — not preview, not unsupported (verified against the [T-SQL surface area](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area) page). `IDENTITY` columns remain ==Preview only== (`bigint`-only, no custom seed/increment, no `ALTER TABLE ADD`), so every surrogate-key pattern here uses the GA-safe `ROW_NUMBER()`/hash alternative instead.

## Table of Contents

- [[#1. COPY INTO with Error Handling]]
- [[#2. CTAS Medallion Chain]]
- [[#3. Watermark MERGE Upsert]]
- [[#4. SCD Type 2 via UPDATE + INSERT]]
- [[#5. Surrogate Keys Without IDENTITY]]
- [[#6. Cross-Database Gold View]]
- [[#7. Dedup with ROW_NUMBER]]

---

## 1. COPY INTO with Error Handling

**Scenario:** Load daily Parquet order files into a staging table, routing malformed rows to an error file instead of failing the whole load, then verify nothing silently landed short.

```sql
-- Staging table, rebuilt fresh each run
DROP TABLE IF EXISTS staging.orders_raw;
CREATE TABLE staging.orders_raw (
    order_id      VARCHAR(20),
    customer_id   VARCHAR(20),
    amount        VARCHAR(20),
    order_date    VARCHAR(20)
);

COPY INTO staging.orders_raw
FROM 'https://mystorageaccount.dfs.core.windows.net/landing/orders/2026/07/11/'
WITH (
    FILE_TYPE = 'PARQUET',
    CREDENTIAL = (IDENTITY = 'Shared Access Signature', SECRET = '<SAS token>'),
    ERRORFILE = 'https://mystorageaccount.dfs.core.windows.net/errors/orders/2026-07-11/',
    ERRORFILE_CREDENTIAL = (IDENTITY = 'Shared Access Signature', SECRET = '<SAS token>'),
    MAXERRORS = 50
);

-- Verify the load didn't silently short-land: compare loaded rows against
-- a source file-count expectation captured by the orchestrating pipeline
DECLARE @LoadedRowCount INT = (SELECT COUNT(*) FROM staging.orders_raw);
DECLARE @ExpectedMinRowCount INT = 1000;  -- supplied by the pipeline run

IF @LoadedRowCount < @ExpectedMinRowCount
BEGIN
    THROW 50001, 'COPY INTO landed fewer rows than expected — check ERRORFILE for rejected rows.', 1;
END

-- Cast/validate immediately after load so type errors surface here, not downstream
INSERT INTO silver.orders (order_id, customer_id, amount, order_date)
SELECT
    TRY_CAST(order_id AS INT),
    TRY_CAST(customer_id AS INT),
    TRY_CAST(amount AS DECIMAL(10,2)),
    TRY_CAST(order_date AS DATE)
FROM staging.orders_raw
WHERE TRY_CAST(order_id AS INT) IS NOT NULL;

-- Expected result: staging.orders_raw row count >= @ExpectedMinRowCount;
-- rows that failed FILE_TYPE parsing landed in ERRORFILE instead of
-- aborting the whole COPY INTO; rows that fail the TRY_CAST step here are
-- excluded from silver.orders rather than the load failing outright.
```

> [!warning] Common Mistake
> Setting `MAXERRORS` too high (or omitting it) hides a systemic problem — e.g., an upstream schema change — behind a load that "succeeds" while silently dropping most rows into the error file. Pair `MAXERRORS` with a row-count sanity check like the one above; a load that technically completes without hitting the error threshold can still be a failure in substance.

---

## 2. CTAS Medallion Chain

**Scenario:** Rebuild a gold-layer customer summary nightly from bronze staging, through a silver cleanse step, to a gold aggregate — three CTAS statements chained in one script.

```sql
-- Bronze -> Silver: cast types, drop rows with no business key
DROP TABLE IF EXISTS silver.orders_clean;
CREATE TABLE silver.orders_clean
AS
SELECT
    TRY_CAST(order_id AS INT)      AS order_id,
    TRY_CAST(customer_id AS INT)   AS customer_id,
    TRY_CAST(amount AS DECIMAL(10,2)) AS amount,
    TRY_CAST(order_date AS DATE)   AS order_date
FROM staging.orders_raw
WHERE TRY_CAST(order_id AS INT) IS NOT NULL
  AND TRY_CAST(customer_id AS INT) IS NOT NULL;

-- Silver -> Silver (dimension join): attach the current customer segment
DROP TABLE IF EXISTS silver.orders_enriched;
CREATE TABLE silver.orders_enriched
AS
SELECT
    o.order_id, o.customer_id, o.amount, o.order_date,
    c.segment, c.customer_business_key
FROM silver.orders_clean AS o
JOIN dim.customer AS c
    ON c.customer_id = o.customer_id AND c.is_current = 1;

-- Silver -> Gold: aggregate to the grain the report actually consumes
DROP TABLE IF EXISTS gold.customer_segment_summary;
CREATE TABLE gold.customer_segment_summary
AS
SELECT
    segment,
    COUNT(DISTINCT customer_business_key) AS customer_count,
    COUNT(order_id)                       AS order_count,
    SUM(amount)                           AS total_amount,
    AVG(amount)                           AS avg_order_amount
FROM silver.orders_enriched
GROUP BY segment;

-- Expected result: gold.customer_segment_summary has one row per segment,
-- with total_amount equal to the sum of every enriched order in that segment.
SELECT * FROM gold.customer_segment_summary ORDER BY total_amount DESC;
```

> [!note]
> Each `DROP TABLE IF EXISTS` + `CREATE TABLE AS SELECT` pair is a full-table rebuild — idempotent by construction, since re-running the script produces the same end state regardless of how many times it's run. This is the CTAS-chain equivalent of Delta's `mode("overwrite")` in the PySpark medallion pattern.

---

## 3. Watermark MERGE Upsert

**Scenario:** Refresh `fact.sales` hourly from `Source.dbo.Sales`, extracting only rows past the last successful watermark and upserting them idempotently. `MERGE` is GA in Fabric Warehouse, so this runs as a single statement inside an explicit transaction.

```sql
CREATE OR ALTER PROCEDURE dbo.Load_FactSales_Incremental
AS
BEGIN
    DECLARE @OldWatermark DATETIME2(3), @NewWatermark DATETIME2(3);

    SELECT @OldWatermark = LastWatermarkValue
    FROM control.WatermarkTable
    WHERE SourceTableName = 'fact.Sales';

    BEGIN TRAN;

    SELECT *
    INTO #StagingSales
    FROM Source.dbo.Sales
    WHERE LastModifiedUtc > @OldWatermark;

    SELECT @NewWatermark = MAX(LastModifiedUtc) FROM #StagingSales;

    MERGE fact.Sales AS tgt
    USING #StagingSales AS src
        ON tgt.SalesOrderId = src.SalesOrderId
    WHEN MATCHED THEN
        UPDATE SET tgt.Amount = src.Amount, tgt.LastModifiedUtc = src.LastModifiedUtc
    WHEN NOT MATCHED THEN
        INSERT (SalesOrderId, Amount, LastModifiedUtc)
        VALUES (src.SalesOrderId, src.Amount, src.LastModifiedUtc);

    IF @NewWatermark IS NOT NULL
    BEGIN
        UPDATE control.WatermarkTable
        SET LastWatermarkValue = @NewWatermark, LastRunUtc = SYSUTCDATETIME()
        WHERE SourceTableName = 'fact.Sales';
    END

    COMMIT;
END;
GO

EXEC dbo.Load_FactSales_Incremental;

-- Expected result: fact.Sales contains an upserted row for every source
-- row with LastModifiedUtc > the prior watermark; control.WatermarkTable's
-- LastWatermarkValue equals the max LastModifiedUtc just committed, updated
-- inside the same transaction as the MERGE.
SELECT * FROM control.WatermarkTable WHERE SourceTableName = 'fact.Sales';
```

> [!note]
> The full explanation of why the watermark update must be the **last** step of the **same** transaction as the `MERGE` — and what breaks if it isn't — is in [05-Loading Patterns: Full vs. Incremental Loads](../../../05-loading-patterns/01-full-incremental-loads.md).

---

## 4. SCD Type 2 via UPDATE + INSERT

**Scenario:** Same SCD2 requirement as the `MERGE`-based close in the topic file, implemented here without a `MERGE` clause at all — a plain `UPDATE` closes changed current rows, then a separate `INSERT..SELECT` adds their new versions. Useful when a team prefers explicit statements over `MERGE`'s combined semantics, or is auditing exactly which rows changed before writing anything.

```sql
BEGIN TRAN;

-- Step 1: close out current rows whose tracked attributes changed
CREATE TABLE #ClosedKeys (CustomerBusinessKey VARCHAR(20));

UPDATE dim.Customer
SET IsCurrent = 0, EndDate = CAST(SYSUTCDATETIME() AS date)
OUTPUT deleted.CustomerBusinessKey INTO #ClosedKeys
FROM dim.Customer AS tgt
JOIN #StagingCustomer AS src
    ON tgt.CustomerBusinessKey = src.CustomerBusinessKey
   AND tgt.IsCurrent = 1
WHERE tgt.Address <> src.Address OR tgt.Segment <> src.Segment;

-- Step 2: insert new current-version rows for closed keys AND brand-new keys,
-- using a ROW_NUMBER()-based surrogate key offset from the current max
-- (SEQUENCE objects aren't supported in Fabric Warehouse)
DECLARE @MaxCustomerKey BIGINT = ISNULL((SELECT MAX(CustomerKey) FROM dim.Customer), 0);

INSERT INTO dim.Customer (CustomerKey, CustomerBusinessKey, Address, Segment, EffectiveDate, EndDate, IsCurrent)
SELECT
    @MaxCustomerKey + ROW_NUMBER() OVER (ORDER BY src.CustomerBusinessKey) AS CustomerKey,
    src.CustomerBusinessKey, src.Address, src.Segment,
    CAST(SYSUTCDATETIME() AS date), NULL, 1
FROM #StagingCustomer AS src
WHERE src.CustomerBusinessKey IN (SELECT CustomerBusinessKey FROM #ClosedKeys)
   OR NOT EXISTS (
        SELECT 1 FROM dim.Customer AS tgt
        WHERE tgt.CustomerBusinessKey = src.CustomerBusinessKey AND tgt.IsCurrent = 1
   );

DROP TABLE #ClosedKeys;

COMMIT;

-- Expected result: every CustomerBusinessKey has exactly one IsCurrent = 1
-- row; a changed key now has 2+ rows total (old with EndDate set, new with
-- EndDate NULL); an unchanged key still has exactly 1 row overall.
SELECT CustomerBusinessKey, COUNT(*) AS CurrentVersions
FROM dim.Customer
WHERE IsCurrent = 1
GROUP BY CustomerBusinessKey
HAVING COUNT(*) > 1;  -- must return 0 rows
```

> [!note]
> This is functionally identical to the `MERGE`-then-`INSERT` two-step pattern in [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md) — the difference is a plain `UPDATE...FROM` for the close step instead of a `MERGE` with a `WHEN MATCHED AND (...)` condition. Both are valid; pick whichever your team's SQL style prefers. A `#temp` table is used for the `OUTPUT INTO` target instead of a table variable (`DECLARE @x TABLE`) — table variables carry unverified support risk in Fabric Warehouse, while session-scoped `#temp` tables are docs-confirmed supported.

> [!warning] Common Mistake
> Reaching for `NEXT VALUE FOR` against a `SEQUENCE` object to generate a surrogate key. **`SEQUENCE` objects are not supported in Fabric Warehouse** — they're explicitly listed as an unsupported table feature (verified against [Tables in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/tables), Limitations section). Use the `ROW_NUMBER()` + max-key-offset pattern shown above instead.

---

## 5. Surrogate Keys Without IDENTITY

**Scenario:** Generate surrogate keys for a new `dim.Product` dimension two ways in the same script — `ROW_NUMBER()`-based (ordered, offset from the current max) and hash-based (deterministic, no lookup needed) — so the tradeoffs are visible side by side.

```sql
-- ROW_NUMBER()-based: ordered, offset from the current max key
DECLARE @MaxKey BIGINT = ISNULL((SELECT MAX(ProductKey) FROM dim.Product), 0);

INSERT INTO dim.Product (ProductKey, ProductBusinessKey, ProductName, Category)
SELECT
    @MaxKey + ROW_NUMBER() OVER (ORDER BY src.ProductBusinessKey) AS ProductKey,
    src.ProductBusinessKey, src.ProductName, src.Category
FROM #StagingNewProducts AS src;

-- Hash-based: deterministic — the same business key always hashes the same
-- way, so a fact-load process that can compute the same hash independently
-- needs no dimension lookup round-trip at all
CREATE TABLE dim.Product_Hashed (
    ProductKey    VARBINARY(32) NOT NULL,
    ProductBusinessKey VARCHAR(20) NOT NULL,
    ProductName   VARCHAR(100),
    Category      VARCHAR(50)
);

INSERT INTO dim.Product_Hashed (ProductKey, ProductBusinessKey, ProductName, Category)
SELECT
    CAST(HASHBYTES('SHA2_256', ProductBusinessKey) AS VARBINARY(32)) AS ProductKey,
    ProductBusinessKey, ProductName, Category
FROM #StagingNewProducts;

-- A fact row can independently compute the same hash key with no dim lookup:
SELECT
    CAST(HASHBYTES('SHA2_256', 'PROD-9001') AS VARBINARY(32)) AS ProductKey;

-- Expected result: both tables have one row per staged product; ROW_NUMBER
-- keys are sequential bigints starting after @MaxKey; hash keys are
-- deterministic 32-byte values reproducible from the business key alone.
```

> [!warning] Common Mistake
> Reaching for Fabric Warehouse's `IDENTITY` column as the default answer here. It's ==Preview==, `bigint`-only, has no custom seed/increment, and can't be added to an existing table via `ALTER TABLE` — full limitations in [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md). `ROW_NUMBER()` and hash keys remain the GA-safe exam answer.

---

## 6. Cross-Database Gold View

**Scenario:** A gold-layer reporting view joins a Warehouse fact table against a Lakehouse dimension's SQL analytics endpoint, both in the same workspace, using three-part names — so Power BI can query one view instead of two sources.

```sql
CREATE VIEW gold.vw_SalesByCustomer
AS
SELECT
    w.order_id,
    w.order_date,
    w.amount,
    l.customer_name,
    l.segment
FROM SalesWarehouse.dbo.orders AS w
JOIN SalesLakehouse.dbo.customers AS l
    ON w.customer_id = l.customer_id;

-- Query the view like any other object — the cross-database join is
-- transparent to the consumer
SELECT segment, SUM(amount) AS total_amount
FROM gold.vw_SalesByCustomer
GROUP BY segment
ORDER BY total_amount DESC;

-- Expected result: the view resolves both sources at query time; a SELECT
-- against it returns joined rows with no error, but an UPDATE/DELETE
-- targeting the lakehouse side of the join fails — SQL analytics endpoints
-- are read-only.
```

> [!warning] Common Mistake
> Cross-database three-part-name queries only work when every referenced item is in the **same Fabric capacity/region** reachable from the current session. A view that works in development but fails in another workspace is almost always a capacity/region reachability issue, not a syntax problem — see [07-Batch Transformation: T-SQL Transformations](../../../07-batch-transformation/03-tsql-transformations.md).

---

## 7. Dedup with ROW_NUMBER

**Scenario:** `Customers` has duplicate rows per `Email` from a source system that occasionally re-sends full extracts. Preview the duplicates, then deduplicate into a clean table, keeping the most recently created row per email.

```sql
-- Step 1: preview which rows are duplicates (nothing is modified yet)
WITH DeduplicatedCustomers AS (
    SELECT
        CustomerID, Email, FullName, CreatedDate,
        ROW_NUMBER() OVER (
            PARTITION BY Email
            ORDER BY CreatedDate DESC
        ) AS rn
    FROM Customers
)
SELECT * FROM DeduplicatedCustomers WHERE rn > 1;

-- Step 2: materialize a deduplicated table (safer than DELETE for large tables —
-- Fabric Warehouse constraints are NOT ENFORCED, so an in-place DELETE against
-- a huge table is riskier to audit than a fresh CTAS)
DROP TABLE IF EXISTS Customers_Clean;
CREATE TABLE Customers_Clean
AS
SELECT CustomerID, Email, FullName, CreatedDate
FROM (
    SELECT
        CustomerID, Email, FullName, CreatedDate,
        ROW_NUMBER() OVER (
            PARTITION BY Email
            ORDER BY CreatedDate DESC
        ) AS rn
    FROM Customers
) AS Ranked
WHERE rn = 1;

-- Expected result: Customers_Clean has exactly one row per distinct Email,
-- and it's the row with the most recent CreatedDate for that email.
SELECT Email, COUNT(*) AS RowCount
FROM Customers_Clean
GROUP BY Email
HAVING COUNT(*) > 1;  -- must return 0 rows
```

## Related Topics

- [07-Batch Transformation: T-SQL Transformations](../../../07-batch-transformation/03-tsql-transformations.md)
- [05-Loading Patterns: Full vs. Incremental Loads](../../../05-loading-patterns/01-full-incremental-loads.md)
- [05-Loading Patterns: Dimensional Model Loading](../../../05-loading-patterns/02-dimensional-model-loading.md)
- [06-Batch Ingestion](../../../06-batch-ingestion/batch-ingestion.md)

---

**[↑ Back to Code Examples](../code-examples.md)**
