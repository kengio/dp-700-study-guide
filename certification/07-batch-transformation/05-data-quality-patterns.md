---
title: Data Quality Patterns
type: topic
tags:
  - dp-700
  - fabric
  - batch-transformation
  - data-quality
  - deduplication
  - late-arriving-data
  - denormalization
---

# Data Quality Patterns

## Overview

The exam blueprint names four data-quality skills explicitly: **denormalize data**, **group and aggregate data**, and **handle duplicate, missing, and late-arriving data**. None of these are language-specific problems — every one of them has an idiomatic solution in PySpark, T-SQL, and KQL. This topic operationalizes each pattern across all three languages, side by side, so the same problem is visibly solved three different ways. It closes the loop with [02-PySpark Transformations](./02-pyspark-transformations.md), [03-T-SQL Transformations](./03-tsql-transformations.md), and [04-KQL Transformations](./04-kql-transformations.md), and cross-links to the SCD/watermark patterns already covered in [05-Loading Patterns](../05-loading-patterns/loading-patterns.md).

> [!abstract]
>
> - **Deduplication**: `dropDuplicates()` (PySpark) vs. `ROW_NUMBER() = 1` (T-SQL) vs. `arg_max()` (KQL) — three idioms, one goal: keep exactly one row per key
> - **Missing data**: `na.fill()`/`na.drop()` (PySpark) vs. `COALESCE`/`ISNULL` (T-SQL) vs. `coalesce()` (KQL) — same substitution logic, different call syntax
> - **Late-arriving data**: watermarks handle late-arriving *facts*; inferred members handle late-arriving *dimensions* — both patterns are language-portable
> - **Denormalization**: a join-and-flatten operation in every language — the difference is which join primitive each language reaches for (`broadcast()` join, `MERGE`/plain `JOIN`, or `lookup`)

> [!tip] What the Exam Tests
>
> - Picking the correct deduplication idiom for the engine in the scenario, and knowing why `dropDuplicates()` alone doesn't guarantee "keep the latest"
> - Choosing the right null-handling function per language and understanding subtle behavior differences (e.g., `ISNULL` vs. `COALESCE` type-precedence rules)
> - Recognizing a late-arriving-fact scenario (needs a watermark) vs. a late-arriving-dimension scenario (needs an inferred member) vs. a late-arriving-*event* scenario in a streaming context
> - Reading denormalization code in any of the three languages and identifying what shape the output takes

---

## Deduplication: Three Languages, One Goal

The deduplication idiom in every language ultimately answers the same question — "of these duplicate rows, which one survives?" — but only some idioms let you control the answer deterministically.

**PySpark:**

```python
from pyspark.sql import Window
from pyspark.sql.functions import row_number, col

# Non-deterministic survivor: fine when duplicates are truly identical
deduped = df.dropDuplicates(["order_id"])

# Deterministic "keep latest": use when duplicate rows differ (e.g., re-sent updates)
w = Window.partitionBy("order_id").orderBy(col("last_modified").desc())
deduped = (
    df.withColumn("row_num", row_number().over(w))
    .filter(col("row_num") == 1)
    .drop("row_num")
)
```

**T-SQL:**

```sql
-- ROW_NUMBER() = 1 is the T-SQL equivalent of the PySpark window pattern
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY last_modified DESC) AS row_num
    FROM staging.orders
)
SELECT * FROM ranked WHERE row_num = 1;

-- DISTINCT only helps when entire rows are exact duplicates (rarely true in practice)
SELECT DISTINCT * FROM staging.orders;
```

**KQL:**

```kusto
// arg_max() picks the row with the maximum value of a column per group — the KQL "keep latest" idiom
Orders
| summarize arg_max(LastModified, *) by OrderId

// arg_min() is the mirror-image "keep earliest" idiom
Orders
| summarize arg_min(LastModified, *) by OrderId
```

| Language | Non-deterministic dedup | Deterministic "keep latest" dedup |
| :--- | :--- | :--- |
| PySpark | `dropDuplicates(["key"])` | `row_number()` over `Window.partitionBy(key).orderBy(ts.desc())`, filter `== 1` |
| T-SQL | `SELECT DISTINCT` | `ROW_NUMBER() OVER (PARTITION BY key ORDER BY ts DESC)`, filter `row_num = 1` |
| KQL | `summarize take_any(*) by key` | `summarize arg_max(ts, *) by key` |

> [!warning] Common Mistake
> Reaching for the non-deterministic idiom (`dropDuplicates()`, `SELECT DISTINCT`, `take_any()`) when the real requirement is "keep the most recent version of each record." All three non-deterministic idioms are correct when duplicate rows are byte-for-byte identical — but the moment duplicates represent the *same key with different values* (the far more common real-world case), only the deterministic window/`arg_max()` pattern gives a predictable, correct result.

**Practice Question 1** *(Easy)*

A source system occasionally re-sends the same order with an updated `amount` and a newer `last_modified` timestamp. Which approach correctly keeps only the most recently modified version of each order in KQL?

A. `Orders | summarize take_any(*) by OrderId`  
B. `Orders | summarize arg_max(LastModified, *) by OrderId`  
C. `Orders | distinct OrderId`  
D. `Orders | dropDuplicates OrderId`  

> [!success]- Answer
> **B. `Orders | summarize arg_max(LastModified, *) by OrderId`**
>
> `arg_max(LastModified, *)` explicitly picks the row with the maximum `LastModified` value per `OrderId` group — the deterministic "keep latest" behavior the scenario requires. `take_any(*)` and `distinct` both pick an arbitrary/unspecified survivor. `dropDuplicates` isn't a KQL operator at all — that's PySpark syntax.

## Handling Missing Data: Three Languages, One Substitution Logic

**PySpark:**

```python
# Fill specific columns with specific defaults
df_filled = df.na.fill({"amount": 0, "region": "Unknown"})

# Drop rows missing any required field
df_clean = df.na.drop(subset=["order_id", "customer_id"])
```

**T-SQL:**

```sql
-- COALESCE: returns the first non-null argument from a list (ANSI standard, any number of args)
SELECT
    order_id,
    COALESCE(region, 'Unknown') AS region,
    COALESCE(amount, 0) AS amount
FROM staging.orders;

-- ISNULL: T-SQL-specific, exactly two arguments, different type-precedence rules than COALESCE
SELECT
    order_id,
    ISNULL(region, 'Unknown') AS region
FROM staging.orders;
```

**KQL:**

```kusto
// coalesce() returns the first non-null argument, same semantics as T-SQL COALESCE
Orders
| extend Region = coalesce(Region, "Unknown"), Amount = coalesce(Amount, 0.0)
```

> [!note] Mental model — COALESCE vs. ISNULL
> `COALESCE` is an ANSI-standard function that takes any number of arguments and returns the data type with the *highest precedence* among them. `ISNULL` is T-SQL-proprietary, always takes exactly two arguments, and returns the data type of its *first* argument — which can silently truncate a wider replacement value. When in doubt, prefer `COALESCE` for portability and predictable typing; it's also the one with a direct KQL and general-SQL equivalent.

**Practice Question 2** *(Medium)*

A T-SQL query uses `ISNULL(discount_pct, 0)` where `discount_pct` is `DECIMAL(5,4)` and the literal `0` defaults to `INT`. What's the risk, and what's the safer alternative?

A. No risk — `ISNULL` always preserves decimal precision  
B. `ISNULL` returns the data type of its first argument, so this is actually safe here; the risk only appears in the reverse order  
C. If the literal's implied type had higher precedence than the column's, `ISNULL`'s two-argument, first-argument-typed behavior could produce unexpected type coercion or truncation; `COALESCE(discount_pct, 0)` follows ANSI type-precedence rules and is the safer, more portable choice  
D. `ISNULL` and `COALESCE` are functionally and behaviorally identical in T-SQL, so it doesn't matter  

> [!success]- Answer
> **C. If the literal's implied type had higher precedence than the column's, `ISNULL`'s two-argument, first-argument-typed behavior could produce unexpected type coercion or truncation; `COALESCE(discount_pct, 0)` follows ANSI type-precedence rules and is the safer, more portable choice**
>
> `ISNULL` and `COALESCE` are not identical — `ISNULL` is limited to two arguments and types its result from the first argument; `COALESCE` is ANSI-standard, accepts any number of arguments, and resolves its result type using standard data-type precedence across all arguments. This distinction is a well-known T-SQL gotcha and a defensible reason to prefer `COALESCE` by default.

## Handling Late-Arriving Data

Late-arriving data comes in two distinct shapes, and the exam expects you to tell them apart:

- **Late-arriving facts** — a transactional/event row arrives after the batch window that should have contained it. This is the watermark problem, already covered in depth in [05-Loading Patterns: The Watermark Pattern](../05-loading-patterns/01-full-incremental-loads.md) — a durable watermark value re-captures anything past the last successful read, regardless of when it actually arrives.
- **Late-arriving dimensions** — a fact row references a dimension key that doesn't exist yet. This is the **inferred member** pattern, covered in [05-Loading Patterns: Late-Arriving Dimensions — Inferred Members](../05-loading-patterns/02-dimensional-model-loading.md) — insert a stub dimension row (`IsInferred = 1`) so the fact load has a valid key, then update that stub in place (SCD1-style) once the real dimension record arrives.

Both patterns are language-portable. The T-SQL inferred-member INSERT/UPDATE pair from 05-Loading Patterns has direct equivalents:

**PySpark (inferred member, Delta MERGE):**

```python
from delta.tables import DeltaTable

dim_customer = DeltaTable.forName(spark, "dim.customer")

(
    dim_customer.alias("target")
    .merge(
        staging_fact_keys.alias("source"),
        "target.customer_business_key = source.customer_business_key",
    )
    .whenNotMatchedInsert(
        values={
            "customer_key": "source.generated_key",
            "customer_business_key": "source.customer_business_key",
            "customer_name": "NULL",
            "is_current": "true",
            "is_inferred": "true",
        }
    )
    .execute()
)
```

**KQL (late-arriving events, ingestion-time tolerant summarize):**

```kusto
// KQL handles late-arriving streamed events by querying with an ingestion-time-tolerant window
// rather than a strict event-time window, so late events are still captured on next materialization
Events
| where ingestion_time() > ago(1h)
| summarize EventCount = count() by bin(EventTimestamp, 5m), DeviceId
```

> [!note] Mental model — watermark vs. inferred member
> A **watermark** is a tide line marking the last-processed *row* — it doesn't care what the row means, only when it was last seen. An **inferred member** is a placeholder *seat* reserved at a table before the guest (the real dimension record) has arrived — the fact load has somewhere valid to sit down, and the seat gets properly labeled once the guest shows up. Late fact rows need the tide line moved back; late dimension rows need a reserved seat.

**Practice Question 3** *(Hard)*

A retail fact table receives a sales row referencing `CustomerBusinessKey = 'CUST-9042'`, but no dimension row with that business key exists yet in `dim.Customer`. Which pattern correctly handles this without blocking the fact load, and what should happen when the real customer record arrives later?

A. Reject the fact row until the dimension record exists — this preserves referential integrity  
B. Insert an inferred-member stub row into `dim.Customer` with the business key and a generated surrogate key, flagged `IsInferred = 1`, so the fact load has a valid key; when the real record arrives, update that same row in place (SCD1-style), not a new SCD2 version  
C. Advance the watermark past this row and skip it entirely  
D. Insert the fact row with a `NULL` foreign key and fix it later with a nightly reconciliation job  

> [!success]- Answer
> **B. Insert an inferred-member stub row into `dim.Customer` with the business key and a generated surrogate key, flagged `IsInferred = 1`, so the fact load has a valid key; when the real record arrives, update that same row in place (SCD1-style), not a new SCD2 version**
>
> This is the textbook inferred-member pattern from dimensional modeling: don't block the fact load (option A) and don't leave a dangling `NULL` key (option D) — insert a minimal stub dimension row so the fact has a valid surrogate key to reference. The inferred row never represented a genuine "known" historical state, so updating it in place (not versioning it as SCD2) is correct once real attributes arrive. A watermark (option C) solves late-arriving *facts*, not missing *dimensions* — the wrong pattern for this scenario.

## Denormalization: Join-and-Flatten in Every Language

Denormalization means joining normalized tables back together into a single flat, query-friendly shape — typically for a gold-layer consumption table.

**PySpark:**

```python
from pyspark.sql.functions import broadcast

flat = (
    fact_orders
    .join(broadcast(dim_customers), on="customer_id", how="left")
    .join(broadcast(dim_products), on="product_id", how="left")
    .select(
        "order_id", "order_date", "amount",
        "customers.customer_name", "products.product_name", "products.category",
    )
)
```

**T-SQL:**

```sql
-- CTAS a flattened gold table from a multi-way join
CREATE TABLE gold.orders_flat
AS
SELECT
    f.order_id, f.order_date, f.amount,
    c.customer_name,
    p.product_name, p.category
FROM fact.orders AS f
JOIN dim.customers AS c ON f.customer_id = c.customer_id
JOIN dim.products AS p ON f.product_id = p.product_id;
```

**KQL:**

```kusto
// lookup is the natural fit for fact-table denormalization — broadcast-optimized, fact/dimension shaped
FactOrders
| lookup kind=leftouter DimCustomers on CustomerId
| lookup kind=leftouter DimProducts on ProductId
| project OrderId, OrderDate, Amount, CustomerName, ProductName, Category
```

| Language | Denormalization primitive | Notes |
| :--- | :--- | :--- |
| PySpark | `.join(broadcast(dim), ...)` | Use `broadcast()` for small dimension tables to avoid shuffling the large fact table |
| T-SQL | `CTAS ... JOIN ... JOIN` | Materializes the flattened result as a new gold table in one statement |
| KQL | `\| lookup kind=leftouter (...) on ...` | Purpose-built fact/dimension enrichment operator, chainable across multiple dimensions |

## Grouping and Aggregation: Side by Side

**PySpark:**

```python
from pyspark.sql.functions import sum as spark_sum, count, avg

summary = (
    df.groupBy("region", "product_category")
    .agg(
        spark_sum("amount").alias("total_amount"),
        count("order_id").alias("order_count"),
        avg("amount").alias("avg_order_value"),
    )
)
```

**T-SQL:**

```sql
SELECT
    region,
    product_category,
    SUM(amount) AS total_amount,
    COUNT(order_id) AS order_count,
    AVG(amount) AS avg_order_value
FROM silver.orders
GROUP BY region, product_category
HAVING SUM(amount) > 10000;
```

**KQL:**

```kusto
Orders
| summarize
    TotalAmount = sum(Amount),
    OrderCount = count(),
    AvgOrderValue = avg(Amount)
    by Region, ProductCategory
| where TotalAmount > 10000
```

> [!warning] Common Mistake
> Trying to filter an aggregate result using `WHERE` (T-SQL) or `filter()` on the pre-aggregated DataFrame in PySpark, instead of the post-aggregation filter each language provides — `HAVING` in T-SQL, a `.filter()`/`.where()` chained *after* `.agg()` in PySpark, or a `| where` clause placed *after* `| summarize` in KQL. Filtering before aggregation restricts which raw rows are aggregated; filtering after restricts which aggregated groups are kept — these are not interchangeable.

## Use Cases

- Deduplicating re-sent or replayed source records before writing to a curated Delta/warehouse/Eventhouse table
- Filling default values for optional business fields (region, discount code) before downstream aggregation
- Building an inferred-member stub for a fact row whose dimension hasn't arrived yet, in a nightly star-schema load
- Flattening a normalized OLTP-style schema into a wide, query-friendly gold table for BI consumption

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Deduplication keeps an outdated version of a record | Used a non-deterministic dedup idiom (`dropDuplicates`, `DISTINCT`, `take_any`) instead of the deterministic "keep latest" pattern | Switch to `row_number()`/`ROW_NUMBER()`/`arg_max()` with an explicit recency ordering |
| A `COALESCE`/`ISNULL` result has unexpected precision loss | `ISNULL` types its result from the first argument only | Use `COALESCE`, which resolves the result type via standard type precedence across all arguments |
| Fact load fails or blocks entirely when a dimension key is missing | No inferred-member handling in place | Insert an inferred stub dimension row so the fact load always has a valid surrogate key |
| A denormalized gold table join runs extremely slowly | A large table was joined without a broadcast hint (PySpark) or the `lookup` operator wasn't used for a fact/dimension shape (KQL) | Add `broadcast()` around the small dimension table in PySpark, or switch to `lookup` in KQL |
| An aggregation filter removes the wrong rows | Filter was applied before aggregation instead of after (or vice versa) | Use `HAVING`/post-`agg()` `.filter()`/post-`summarize` `\| where` for group-level filters; use `WHERE`/pre-`agg()` `.filter()`/pre-`summarize` `\| where` for row-level filters |

## Best Practices

- Standardize on the deterministic "keep latest" dedup pattern (window function or `arg_max()`) as the default — treat non-deterministic dedup as an explicit, justified exception
- Prefer `COALESCE` over `ISNULL` in T-SQL for portability and predictable type resolution
- Always distinguish late-arriving *facts* (watermark) from late-arriving *dimensions* (inferred member) before choosing a pattern
- Use `broadcast()`/`lookup` deliberately for denormalization joins involving a small dimension table — the performance difference is often an order of magnitude

## Exam Tips

> [!tip] Exam Tips
>
> - Every data-quality pattern in this file has three names, one per language — memorize the mapping: `dropDuplicates`/`ROW_NUMBER()=1`/`arg_max()`; `na.fill`/`COALESCE`/`coalesce()`
> - "Fact row missing its dimension" = inferred member; "batch missed a late-updated row" = watermark — don't conflate the two late-arriving patterns
> - `COALESCE` > `ISNULL` for exam-safe answers — ANSI standard, any argument count, predictable typing
> - Denormalization is always a join — the exam wants you to name the *performance-correct* join primitive per engine (`broadcast()`, plain `JOIN`/CTAS, or `lookup`)

## Key Takeaways

- Deduplication, missing-data handling, late-arriving-data handling, denormalization, and grouping/aggregation each have a direct idiom in PySpark, T-SQL, and KQL
- Non-deterministic dedup (`dropDuplicates`, `DISTINCT`, `take_any`) is only safe for truly identical duplicates; deterministic "keep latest" dedup requires a window function or `arg_max()`
- Late-arriving facts are a watermark problem; late-arriving dimensions are an inferred-member problem — they require different fixes
- Denormalization is a join-and-flatten operation everywhere, with each language offering a performance-optimized primitive for the small-dimension case

## Related Topics

- [01-Choosing a Transform Tool](./01-choosing-transform-tool.md)
- [02-PySpark Transformations](./02-pyspark-transformations.md)
- [03-T-SQL Transformations](./03-tsql-transformations.md)
- [04-KQL Transformations](./04-kql-transformations.md)
- [05-Loading Patterns: The Watermark Pattern](../05-loading-patterns/01-full-incremental-loads.md)
- [05-Loading Patterns: Late-Arriving Dimensions](../05-loading-patterns/02-dimensional-model-loading.md)

## Official Documentation

- [PySpark DataFrame null handling (`na.fill`/`na.drop`)](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrameNaFunctions.html)
- [COALESCE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/coalesce-transact-sql?view=fabric&preserve-view=true)
- [arg_max() (aggregation function) — Kusto](https://learn.microsoft.com/en-us/kusto/query/arg-max-aggregation-function?view=microsoft-fabric)
- [lookup operator — Kusto](https://learn.microsoft.com/en-us/kusto/query/lookup-operator?view=microsoft-fabric)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./04-kql-transformations.md) | [↑ Back to Section](./batch-transformation.md) | [Next →](../08-streaming-data/streaming-data.md)**
