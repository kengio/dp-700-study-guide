---
title: T-SQL Transformations
type: topic
tags:
  - dp-700
  - fabric
  - batch-transformation
  - t-sql
  - warehouse
  - merge
---

# T-SQL Transformations

## Overview

Fabric Warehouse gives SQL-first teams a full T-SQL DML/DDL surface — but it's a **subset** of SQL Server's surface, and the exam likes to probe exactly where that subset ends. This topic covers the core transformation vocabulary (CTAS, `INSERT..SELECT`, `MERGE`, aggregation, window functions, cross-database queries) and the Fabric-specific differences from SQL Server that most often trip people up: `IDENTITY` columns being Preview-only with real limitations, a fixed case-sensitive default collation, a narrower supported data-type list, and `COPY INTO` as the load-then-transform entry point. *(All Fabric Warehouse feature-support facts below verified against learn.microsoft.com as of July 2026 — see Official Documentation.)*

> [!abstract]
>
> - `MERGE` is a ==generally available (GA)== T-SQL feature in Fabric Warehouse — not preview, not unsupported
> - Session-scoped `#temp` tables are supported; **distributed** `#temp` tables (`DISTRIBUTION=ROUND_ROBIN`) are recommended over the default non-distributed kind
> - Fabric Warehouse's `IDENTITY` column support is ==Preview only==, `bigint`-only, with no custom seed/increment and no `ALTER TABLE` add — `ROW_NUMBER()` and hash-based keys remain the GA-safe default for surrogate keys
> - The default warehouse collation is the case-sensitive `Latin1_General_100_BIN2_UTF8`, fixed permanently at warehouse creation

> [!tip] What the Exam Tests
>
> - Writing correct CTAS, `INSERT..SELECT`, `MERGE`, and window-function syntax against a Fabric Warehouse
> - Knowing which SQL Server features are **not** (or only partially) available in Fabric Warehouse (`IDENTITY` is Preview-only, triggers/`nchar`/`nvarchar`/indexed views are unsupported)
> - Using three-part names to query across databases/warehouses inside the same workspace
> - Choosing `COPY INTO` correctly as a load step, and knowing its Fabric-specific syntax differs from the Synapse/dedicated-pool version

---

## CTAS and INSERT..SELECT

`CREATE TABLE AS SELECT` (CTAS) is the primary way to materialize a new table from a query — the table's columns and types are inferred from the `SELECT`.

```sql
-- CTAS: create and populate a new gold table from a silver-layer query
CREATE TABLE gold.customer_summary
AS
SELECT
    c.customer_id,
    c.customer_name,
    SUM(o.amount) AS total_amount,
    COUNT(o.order_id) AS order_count
FROM silver.orders AS o
JOIN silver.customers AS c
    ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.customer_name;

-- INSERT..SELECT: load into an already-existing table
INSERT INTO gold.customer_summary (customer_id, customer_name, total_amount, order_count)
SELECT
    c.customer_id,
    c.customer_name,
    SUM(o.amount),
    COUNT(o.order_id)
FROM silver.orders AS o
JOIN silver.customers AS c
    ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.customer_name;
```

> [!note] Mental model — CTAS vs. INSERT..SELECT
> CTAS is "build me a brand-new room from this blueprint" — the table doesn't exist yet, and its shape is derived entirely from the query. `INSERT..SELECT` is "add furniture to a room that's already built" — the target table's schema is fixed beforehand and the query must match it. Use CTAS for staging/gold-layer rebuilds; use `INSERT..SELECT` for incremental loads into a stable schema.

## UPDATE, DELETE, and MERGE

`MERGE` is a generally available feature in Fabric Warehouse — this was a real limitation on earlier Fabric Warehouse previews, and the exam may still test it as a "was this always true" trap.

```sql
-- Standalone UPDATE and DELETE
UPDATE gold.customer_summary
SET total_amount = total_amount * 1.0
WHERE customer_id = 501;

DELETE FROM gold.customer_summary
WHERE order_count = 0;

-- MERGE: upsert dimension changes from a staging table (SCD Type 1 style)
MERGE INTO gold.dim_customer AS target
USING staging.customer_updates AS source
    ON target.customer_id = source.customer_id
WHEN MATCHED THEN
    UPDATE SET
        target.customer_name = source.customer_name,
        target.email = source.email,
        target.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (customer_id, customer_name, email, updated_at)
    VALUES (source.customer_id, source.customer_name, source.email, SYSUTCDATETIME());
```

> [!warning] Common Mistake
> Assuming `MERGE` is unsupported or preview-only in Fabric Warehouse because it was a known gap in early Fabric Data Warehouse previews. As of this writing, `MERGE` syntax is documented as a ==generally available== feature — always verify current support status against the official [T-SQL surface area](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area) page rather than relying on older material, since Fabric's T-SQL surface has expanded rapidly.

## GROUP BY, HAVING, and Window Functions

```sql
-- GROUP BY / HAVING
SELECT
    customer_id,
    COUNT(order_id) AS order_count,
    SUM(amount) AS total_amount
FROM silver.orders
GROUP BY customer_id
HAVING SUM(amount) > 1000;

-- Window functions: OVER, ROW_NUMBER, SUM OVER
SELECT
    order_id,
    customer_id,
    order_date,
    amount,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS row_num,
    SUM(amount) OVER (PARTITION BY customer_id) AS customer_total,
    RANK() OVER (PARTITION BY customer_id ORDER BY amount DESC) AS amount_rank
FROM silver.orders;
```

**Practice Question 1** *(Easy)*

Which T-SQL construct is the correct way to select only the single most recent order per customer from a `silver.orders` table in a Fabric Warehouse?

A. `SELECT TOP 1 * FROM silver.orders GROUP BY customer_id`  
B. A CTE using `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)`, filtered to `row_num = 1`  
C. `SELECT DISTINCT customer_id, MAX(order_date) FROM silver.orders`  
D. `MERGE` with a `WHEN MATCHED` clause  

> [!success]- Answer
> **B. A CTE using `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)`, filtered to `row_num = 1`**
>
> `ROW_NUMBER()` partitioned by the key and ordered by recency, then filtered to `1`, is the standard "latest row per group" T-SQL pattern — it returns full rows, unlike option C which only returns the aggregate date. Option A is invalid syntax (`TOP` with `GROUP BY` doesn't express "latest per group"). `MERGE` is for upserting, not selecting.

## Cross-Database Three-Part-Name Queries

Warehouses and lakehouses inside the same Fabric workspace (and across workspaces with the right permissions) can be queried together using three-part names.

```sql
-- Query across a warehouse and a lakehouse's SQL analytics endpoint in the same workspace
SELECT
    w.order_id,
    w.amount,
    l.customer_name
FROM SalesWarehouse.dbo.orders AS w
JOIN SalesLakehouse.dbo.customers AS l
    ON w.customer_id = l.customer_id;
```

> [!note]
> Cross-database queries only work against items in the **same Fabric capacity/region** reachable from the current query session, and any lakehouse side of the join is subject to its SQL analytics endpoint's read-only limitation — you can `SELECT` across the join, but you can't `UPDATE`/`DELETE` the lakehouse side through it.

## #temp Tables vs. CTEs

Fabric Warehouse supports session-scoped `#temp` tables in two flavors, and supports CTEs (standard, sequential, and — as a preview feature — nested).

```sql
-- Non-distributed #temp table (default) — mdf-backed
CREATE TABLE #staging_orders (
    order_id INT,
    customer_id INT,
    amount DECIMAL(10,2)
);

-- Distributed #temp table — recommended; behaves like a normal user table
CREATE TABLE #staging_orders_dist (
    order_id INT,
    customer_id INT,
    amount DECIMAL(10,2)
) WITH (DISTRIBUTION = ROUND_ROBIN);

-- CTE — standard and sequential CTEs are GA; nested CTEs are a preview feature
WITH recent_orders AS (
    SELECT customer_id, amount, order_date
    FROM silver.orders
    WHERE order_date >= DATEADD(day, -30, GETUTCDATE())
),
customer_totals AS (
    SELECT customer_id, SUM(amount) AS total_amount
    FROM recent_orders
    GROUP BY customer_id
)
SELECT * FROM customer_totals WHERE total_amount > 500;
```

> [!note] Mental model — #temp table vs. CTE
> A CTE is a sticky note — it exists only for the duration of the one query it's attached to, and it's gone the moment that statement finishes. A `#temp` table is a whiteboard in a shared session room — it persists across multiple statements in the same session, can be indexed and queried repeatedly, and is cleaned up only when the session ends. Reach for a CTE to make one query more readable; reach for a `#temp` table when you need to stage intermediate results across several statements.

**Practice Question 2** *(Medium)*

Which statement about temporary objects in Fabric Warehouse is correct?

A. Global temp tables (`##table`) are fully supported for cross-session sharing  
B. Distributed `#temp` tables, created with `WITH (DISTRIBUTION = ROUND_ROBIN)`, are recommended over the default non-distributed kind because they behave like normal user tables with unlimited storage and full T-SQL operation support  
C. CTEs are entirely unsupported in Fabric Warehouse — use `#temp` tables instead  
D. `#temp` tables persist across sessions until manually dropped  

> [!success]- Answer
> **B. Distributed `#temp` tables, created with `WITH (DISTRIBUTION = ROUND_ROBIN)`, are recommended over the default non-distributed kind because they behave like normal user tables with unlimited storage and full T-SQL operation support**
>
> Global temp tables (`##table`) are explicitly **not** supported in Fabric Warehouse. CTEs are supported (standard and sequential are GA; nested is preview). `#temp` tables are session-scoped — they're dropped automatically when the session ends, not persisted across sessions.

## Fabric Warehouse Data-Type Differences vs. SQL Server

| SQL Server feature | Fabric Warehouse status | Notes |
| :--- | :--- | :--- |
| `IDENTITY` columns | ==Preview only== | `bigint`-only, no custom seed/increment, no `IDENTITY_INSERT`, and can't be added to an existing table via `ALTER TABLE` (use CTAS/`SELECT...INTO` instead); the GA-safe default remains `ROW_NUMBER()` or a hash-based key — see [05-Dimensional Model Loading](../05-loading-patterns/02-dimensional-model-loading.md) |
| `money`, `smallmoney` | Not supported | Use `decimal`; note it doesn't carry a currency unit |
| `datetime`, `smalldatetime`, `datetimeoffset` | Not supported | Use `datetime2` (precision limited to 6 fractional-second digits) |
| `nchar`, `nvarchar` | Not supported | Use `char`/`varchar` — Fabric's default UTF-8 collation stores Unicode without a separate `n`-prefixed type |
| `text`, `ntext`, `image` | Not supported | Use `varchar`/`varbinary` |
| `tinyint` | Not supported | Use `smallint` |
| `xml`, `geography`, `geometry`, vector | Not supported | No direct equivalent; store as `varchar`/`varbinary` if a workaround is needed |
| `PRIMARY KEY` / `FOREIGN KEY` / `UNIQUE` | Supported, but **`NOT ENFORCED`** only | Constraints exist for the optimizer/documentation but aren't enforced at write time — you can insert violating rows |
| Collation | Fixed at warehouse creation | Default `Latin1_General_100_BIN2_UTF8` (case-sensitive); alternative `Latin1_General_100_CI_AS_KS_WS_SC_UTF8` (case-insensitive) settable only via REST API at creation time |
| Triggers, synonyms, indexed views, computed columns | Not supported | No equivalents currently |

> [!warning] Common Mistake
> Treating Fabric Warehouse's `IDENTITY` column as a drop-in replacement for SQL Server's. It's ==Preview, not GA==, works only on `bigint`, has no custom seed/increment, doesn't support `IDENTITY_INSERT`, and can't be retrofitted onto an existing table with `ALTER TABLE` — you'd need to rebuild the table via CTAS instead. For exam purposes and production-safe designs, the long-standing `ROW_NUMBER()`-based or hash-based pattern is still the default answer for surrogate key generation, with `IDENTITY` as a Preview alternative worth knowing about but not relying on.

```sql
-- Generating a surrogate key with ROW_NUMBER() — the GA-safe pattern
CREATE TABLE gold.dim_customer
AS
SELECT
    ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS customer_key,
    customer_id,
    customer_name
FROM staging.customers;

-- The Preview IDENTITY alternative (bigint only, no ALTER TABLE add, no custom seed/increment)
CREATE TABLE gold.dim_customer_identity (
    customer_key   BIGINT IDENTITY,
    customer_id    INT NOT NULL,
    customer_name  VARCHAR(100)
);
```

## COPY INTO for Load-Then-Transform

`COPY INTO` is the T-SQL entry point for bulk-loading external files directly into a warehouse table — commonly the first step before a transformation query runs against the newly loaded staging data.

```sql
COPY INTO staging.orders_raw
FROM 'https://mystorageaccount.dfs.core.windows.net/landing/orders/2026/06/'
WITH (
    FILE_TYPE = 'PARQUET',
    CREDENTIAL = (IDENTITY = 'Shared Access Signature', SECRET = '<SAS token>'),
    ERRORFILE = 'https://mystorageaccount.dfs.core.windows.net/errors/orders/',
    MAXERRORS = 10
);

-- Transform immediately after load
INSERT INTO silver.orders
SELECT order_id, customer_id, CAST(amount AS DECIMAL(10,2)), order_date
FROM staging.orders_raw
WHERE order_id IS NOT NULL;
```

Fabric's `COPY INTO` supports `FILE_TYPE = 'CSV' | 'JSONL' | 'PARQUET'` (notably narrower than the Synapse dedicated-pool version, which also allows `ORC`), plus `CREDENTIAL`, `ERRORFILE`/`ERRORFILE_CREDENTIAL`, `MAXERRORS`, `COMPRESSION`, `FIELDQUOTE`/`FIELDTERMINATOR`/`ROWTERMINATOR`, `FIRSTROW`, `DATEFORMAT`, `ENCODING`, `PARSER_VERSION`, and `MATCH_COLUMN_COUNT`.

**Practice Question 3** *(Hard)*

A team migrating from Azure Synapse Analytics dedicated SQL pools to Fabric Warehouse has a `COPY INTO` statement that specifies `FILE_TYPE = 'ORC'`. What happens when this is run against a Fabric Warehouse, and what should the team do?

A. It runs unchanged — Fabric Warehouse supports the exact same `COPY INTO` syntax as Synapse dedicated pools  
B. `ORC` isn't a supported `FILE_TYPE` value for Fabric Warehouse's `COPY INTO` (only `CSV`, `JSONL`, and `PARQUET` are) — convert the source files to Parquet or reformat the load  
C. `COPY INTO` doesn't exist in Fabric Warehouse — use `BULK LOAD` instead  
D. `ORC` works, but only inside a `#temp` table target  

> [!success]- Answer
> **B. `ORC` isn't a supported `FILE_TYPE` value for Fabric Warehouse's `COPY INTO` (only `CSV`, `JSONL`, and `PARQUET` are) — convert the source files to Parquet or reformat the load**
>
> Fabric Warehouse's `COPY INTO` syntax is similar to, but not identical to, the Azure Synapse Analytics version — it narrows `FILE_TYPE` to `CSV`, `JSONL`, and `PARQUET` and drops the general `FILE_FORMAT` object parameter. `BULK LOAD` is explicitly listed as unsupported in Fabric Warehouse (only `bcp` is available, as a preview feature).

## Use Cases

- Rebuilding a gold-layer star schema nightly via CTAS from silver-layer staging tables
- Upserting slowly changing dimensions with `MERGE`, replacing hand-rolled `UPDATE`/`INSERT` pairs
- Generating dimension surrogate keys with `ROW_NUMBER()` (GA-safe) or the Preview `IDENTITY` column, depending on how much risk the project accepts
- Loading external Parquet/CSV/JSONL files directly into a staging table with `COPY INTO`, then transforming in a follow-up `INSERT..SELECT`

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `ALTER TABLE ... ADD CustomerKey BIGINT IDENTITY` fails on an existing table | `IDENTITY` can't be added to an existing table via `ALTER TABLE` — it must be defined at `CREATE TABLE` time, and remains a Preview feature | Rebuild the table with CTAS including the `IDENTITY` column, or generate keys with `ROW_NUMBER()` in a CTAS/staging query instead |
| `CREATE TABLE ... IDENTITY(1,1)` fails with a custom seed/increment | Fabric's `IDENTITY` (Preview) doesn't support custom seed/increment values, unlike SQL Server | Use plain `IDENTITY` (default seed/increment) or a `ROW_NUMBER()`/hash-based key if custom seeding is required |
| `COPY INTO ... FILE_TYPE = 'ORC'` fails | `ORC` isn't a supported file type for Fabric's `COPY INTO` | Convert source files to Parquet, CSV, or JSONL |
| A `FOREIGN KEY` constraint doesn't prevent an orphaned row from being inserted | All Fabric Warehouse constraints are created `NOT ENFORCED` | Enforce data integrity in the load/transform logic itself (validation queries, `MERGE` conditions) — don't rely on the constraint |
| Case-sensitive string comparisons fail unexpectedly (`'ABC' <> 'abc'`) | The default warehouse collation `Latin1_General_100_BIN2_UTF8` is case-sensitive | Normalize case explicitly in queries (`UPPER()`/`LOWER()`), or create the warehouse with the case-insensitive collation up front — collation can't be changed after creation |
| `nvarchar` column definition fails | `nchar`/`nvarchar` aren't supported data types in Fabric Warehouse | Use `char`/`varchar` — the UTF-8 collation already stores Unicode data |

## Best Practices

- Verify current T-SQL feature-support status against the [T-SQL surface area](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area) page before assuming a SQL Server feature carries over — Fabric's surface changes frequently
- Prefer distributed `#temp` tables (`DISTRIBUTION = ROUND_ROBIN`) over the non-distributed default for anything beyond trivial staging
- Decide the warehouse collation (case-sensitive vs. case-insensitive) **before** creating the warehouse — it can't be changed afterward
- Use `MERGE` for upsert logic instead of hand-rolled `UPDATE`/`INSERT IF NOT EXISTS` pairs — it's GA and less error-prone

## Exam Tips

> [!tip] Exam Tips
>
> - `MERGE` is GA in Fabric Warehouse — don't mark it as unsupported or preview-only
> - `IDENTITY` in Fabric Warehouse is Preview-only, `bigint`-only, no custom seed/increment, no `ALTER TABLE` add — `ROW_NUMBER()` is still the exam-safe default answer for "how do you generate a surrogate key"
> - `PRIMARY KEY`/`FOREIGN KEY`/`UNIQUE` constraints exist but are always `NOT ENFORCED` — they inform the optimizer, they don't block bad data
> - `COPY INTO`'s `FILE_TYPE` in Fabric is `CSV`/`JSONL`/`PARQUET` only — no `ORC`, unlike the Synapse dedicated-pool version

## Key Takeaways

- Fabric Warehouse's T-SQL surface is a real subset of SQL Server's — verify feature support rather than assuming parity, especially for constraints, data types, and temp objects
- `MERGE`, CTAS, `INSERT..SELECT`, window functions, and three-part-name cross-database queries are all fully supported and exam-relevant
- `IDENTITY` support is Preview-only with real limitations; `ROW_NUMBER()`/hash-based keys remain the GA-safe pattern for surrogate keys
- `COPY INTO` is the standard load-then-transform entry point, with a narrower `FILE_TYPE` list than the Synapse dedicated-pool equivalent

## Related Topics

- [02-PySpark Transformations](./02-pyspark-transformations.md)
- [04-KQL Transformations](./04-kql-transformations.md)
- [05-Data Quality Patterns](./05-data-quality-patterns.md)

## Official Documentation

- [T-SQL surface area in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area)
- [Data types in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-types)
- [Tables in Fabric Data Warehouse (#temp tables, collation)](https://learn.microsoft.com/en-us/fabric/data-warehouse/tables)
- [Primary, foreign, and unique keys — Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-warehouse/table-constraints)
- [MERGE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql?view=fabric&preserve-view=true)
- [COPY INTO (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/copy-into-transact-sql?view=fabric&preserve-view=true)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./02-pyspark-transformations.md) | [↑ Back to Section](./batch-transformation.md) | [Next →](./04-kql-transformations.md)**
