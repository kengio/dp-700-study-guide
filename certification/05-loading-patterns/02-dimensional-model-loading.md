---
title: Dimensional Model Loading
type: topic
tags:
  - dp-700
  - fabric
  - loading-patterns
  - dimensional-modeling
  - scd
  - surrogate-keys
  - t-sql
---

# Dimensional Model Loading

## Overview

A star schema's loading order isn't optional: dimensions must be loaded — or at least stubbed — before the facts that reference them, because every fact row needs a valid dimension surrogate key. This topic covers surrogate key generation in Fabric (`ROW_NUMBER`-based, hash-based, and the Preview `IDENTITY` column, plus `monotonically_increasing_id` caveats in Spark), a full worked implementation of SCD Type 1 and Type 2 in both T-SQL `MERGE` and PySpark Delta `MERGE INTO`, the late-arriving dimension (inferred member) pattern, and fact-table loading: dimension key lookups and unknown-member handling.

> [!abstract]
>
> - **Dims before facts** — a fact-table load needs every referenced dimension row (real or inferred) to already have a surrogate key
> - **Surrogate key generation in Fabric Warehouse**: `IDENTITY` columns are **Preview** as of the July 2026 blueprint (verified against Microsoft Learn) — `bigint`-only, no reseed, can't `ALTER TABLE ADD`; `ROW_NUMBER()`-based and hash-based keys remain the reliable exam-relevant fallback
> - **SCD Type 1** overwrites in place (no history); **SCD Type 2** preserves history via new versioned rows — implemented here in both T-SQL `MERGE` and Delta `MERGE INTO`
> - **Late-arriving dimensions** get an inferred-member placeholder row so the fact load isn't blocked; **unknown members** get a reserved surrogate key rather than a `NULL` foreign key

> [!tip] What the Exam Tests
>
> - Recognizing that dims load before facts, and why a fact load needs a surrogate key lookup step
> - Choosing the right surrogate key generation technique for a Warehouse vs. a Lakehouse target, and knowing the current `IDENTITY` Preview limitations
> - Distinguishing SCD1 (overwrite) from SCD2 (versioned history) in a scenario, and correctly sequencing the two-step T-SQL `MERGE` + `INSERT` SCD2 pattern
> - Handling a fact row whose dimension doesn't exist yet: inferred member vs. unknown member vs. reject

---

## Star Schema Recap, Oriented to Loading

A star schema separates **dimensions** (small, descriptive — customer, product, date, region) from **facts** (large, numeric, event-grained — sales, orders, page views). Facts reference dimensions by **surrogate key**, an internally-generated integer that's stable even when the dimension's business/natural key or attributes change.

| | Dimension | Fact |
| :--- | :--- | :--- |
| **Row count** | Small to medium | Large, often the majority of total data volume |
| **Loaded** | ==First== — before any fact that references it | ==Second== — after the dimensions it references have current surrogate keys |
| **Keyed by** | A generated surrogate key (`CustomerKey`) plus a business key (`CustomerBusinessKey`) | Foreign keys to each dimension's surrogate key, plus measures |
| **Change pattern** | Attributes change slowly (SCD1/SCD2) | Append/insert-heavy; rarely updated once loaded |

A fact-table load that runs before its dimensions are current will either fail its foreign key lookups or — worse — silently attach fact rows to stale or missing dimension keys. This ordering dependency is why loading pipelines for a star schema are built as **dimensions, then facts**, not as one flat parallel load.

---

## Surrogate Key Generation in Fabric

### Warehouse: `IDENTITY` (Preview), `ROW_NUMBER()`, and Hash Keys

> [!note]
> Verified against Microsoft Learn, July 2026: Fabric Data Warehouse `IDENTITY` columns are currently **in Preview**. They support only the `bigint` data type, don't support `IDENTITY_INSERT` or a custom seed/increment, and can't be added to an existing table with `ALTER TABLE` (use `CTAS`/`SELECT...INTO` instead). Because this is Preview rather than GA, the exam-safe default for surrogate key generation remains the `ROW_NUMBER()`-based or hash-based pattern below — know both.

**`IDENTITY` column (Preview):**

```sql
CREATE TABLE dim.Customer (
    CustomerKey     BIGINT IDENTITY,
    CustomerBusinessKey VARCHAR(20) NOT NULL,
    CustomerName     VARCHAR(100),
    Address           VARCHAR(200),
    IsCurrent          BIT
);
-- CustomerKey is assigned automatically on INSERT; values are unique but
-- gaps can appear and allocation order isn't guaranteed across the
-- warehouse's distributed compute nodes.
```

**`ROW_NUMBER()`-based surrogate key (the long-standing, GA-safe pattern):**

```sql
-- Generate new surrogate keys starting after the current max
DECLARE @MaxKey BIGINT = ISNULL((SELECT MAX(CustomerKey) FROM dim.Customer), 0);

INSERT INTO dim.Customer (CustomerKey, CustomerBusinessKey, CustomerName, Address, IsCurrent)
SELECT
    @MaxKey + ROW_NUMBER() OVER (ORDER BY src.CustomerBusinessKey) AS CustomerKey,
    src.CustomerBusinessKey,
    src.CustomerName,
    src.Address,
    1
FROM #StagingNewCustomers AS src;
```

**Hash-based surrogate key** — deterministic, derived from the business key rather than an incrementing counter:

```sql
SELECT
    CAST(HASHBYTES('SHA2_256', CustomerBusinessKey) AS VARBINARY(32)) AS CustomerKey,
    CustomerBusinessKey, CustomerName, Address
FROM #StagingNewCustomers;
```

Hash keys are idempotent by construction (the same business key always hashes to the same value, even generated independently across environments) and need no key-lookup roundtrip during fact loading if the fact stream can compute the same hash — but they carry no ordering information and a hash collision, while astronomically unlikely with SHA-256, is a real (if negligible) risk that `ROW_NUMBER()`/`IDENTITY` don't have.

### Lakehouse: `monotonically_increasing_id()` Caveats

```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# Naive - do NOT use for a real surrogate key
df.withColumn("customer_key", F.monotonically_increasing_id())
```

> [!warning] Common Mistake
> `monotonically_increasing_id()` produces values that are unique and increasing **within a single DataFrame execution**, but they are **not contiguous**, encode the Spark partition ID in their high-order bits, and are **not stable** across re-runs — re-executing the same transformation (e.g., after a stage retry) can produce different values for the same rows. It is not a substitute for a real surrogate key generator in a dimensional load.

The safer Spark pattern mirrors the T-SQL approach — a single ordered, offset row number:

```python
max_key_row = spark.table("dim.customer").agg(F.max("customer_key")).collect()[0][0]
max_key = max_key_row if max_key_row is not None else 0

window = Window.orderBy("customer_business_key")  # single partition -> a real total order
new_customers = staged_new_customers.withColumn(
    "customer_key",
    max_key + F.row_number().over(window)
)
```

Forcing `Window.orderBy(...)` with no `partitionBy` collapses the computation to a single partition to guarantee a true, stable total order — acceptable for dimension-sized volumes, but a scalability tradeoff to call out for very large key-generation batches (a distributed hash key avoids the single-partition bottleneck entirely).

| Technique | Where | Idempotent/stable? | Notes |
| :--- | :--- | :--- | :--- |
| `IDENTITY` column | Warehouse | Unique, not stable order (gaps, distributed allocation) | **Preview** as of July 2026; `bigint` only, no reseed |
| `ROW_NUMBER()` + max-key offset | Warehouse or Spark | Stable if computed the same way each time | GA-safe long-standing pattern |
| Hash key (`HASHBYTES`/`sha2`) | Warehouse or Spark | ✅ Fully deterministic | No key-lookup needed if fact stream can hash independently |
| `monotonically_increasing_id()` | Spark | ❌ Not stable across re-runs | Don't use for surrogate keys |

> [!note] Mental model
> A surrogate key generator is a **ticket dispenser at a deli counter** — every customer needs a number before they can be served (loaded into the fact table), and the numbers must never repeat and never change once handed out. `IDENTITY` and `ROW_NUMBER()` are dispensers that print the next number in a running sequence; a hash key is more like handing everyone a number computed from their name — no dispenser needed, but you'd better trust the hash never collides.

**Practice Question 1** *(Medium)*

A team is generating surrogate keys for a new dimension inside a PySpark notebook and writes `df.withColumn("dim_key", F.monotonically_increasing_id())`. On the next scheduled run, a transient executor failure causes one stage to retry. What's the most likely consequence for the generated keys?

A. No consequence — `monotonically_increasing_id()` always produces the same value for the same row  
B. The retried stage may produce different `dim_key` values for the same rows than the first attempt, since the function's output depends on partition and task execution order, not row identity  
C. The job fails outright because `monotonically_increasing_id()` can't be retried  
D. Spark automatically substitutes `ROW_NUMBER()` semantics on retry to guarantee stability  

> [!success]- Answer
> **B. The retried stage may produce different `dim_key` values for the same rows than the first attempt, since the function's output depends on partition and task execution order, not row identity**
>
> `monotonically_increasing_id()` guarantees uniqueness and monotonicity within one execution, but its actual values are a function of partition ID and per-partition row offset — not a property of the row's data. A retried stage can re-partition or re-order tasks, producing different IDs for the same logical rows. This is exactly why it's unsafe for surrogate keys, which must be stable identifiers.

---

## SCD Type 1 vs. Type 2

| | SCD Type 1 | SCD Type 2 |
| :--- | :--- | :--- |
| **On a changed attribute** | ==Overwrite== the existing row in place | ==Insert a new row== (new surrogate key) and close out the old one |
| **History preserved?** | ❌ No — only the current value survives | ✅ Yes — every historical version is queryable |
| **Extra columns needed** | None | `EffectiveDate`, `EndDate`, `IsCurrent` (or equivalent) |
| **Typical use** | Correcting an error, or an attribute where history genuinely doesn't matter (e.g., a typo fix) | An attribute where "what was true at the time of the fact" matters (e.g., a customer's address at the time of a sale) |

> [!note] Mental model
> SCD1 is a **whiteboard eraser** — the old value is gone the moment the new one is written. SCD2 is a **filing cabinet** — the old version stays in its own folder, correctly dated, while a new folder holds the current one; anyone asking "what was true on this date" can pull the right folder.

### SCD Type 1: T-SQL `MERGE`

```sql
MERGE dim.Product AS tgt
USING #StagingProduct AS src
    ON tgt.ProductBusinessKey = src.ProductBusinessKey
WHEN MATCHED THEN
    UPDATE SET tgt.ProductName = src.ProductName, tgt.Category = src.Category
WHEN NOT MATCHED THEN
    INSERT (ProductKey, ProductBusinessKey, ProductName, Category)
    VALUES (NEXT VALUE FOR seq.ProductKey, src.ProductBusinessKey, src.ProductName, src.Category);
```

### SCD Type 1: PySpark Delta `MERGE INTO`

```python
target = DeltaTable.forName(spark, "dim.product")

(target.alias("tgt")
    .merge(staged_products.alias("src"), "tgt.product_business_key = src.product_business_key")
    .whenMatchedUpdate(set={"product_name": "src.product_name", "category": "src.category"})
    .whenNotMatchedInsert(values={
        "product_key": "src.product_key",
        "product_business_key": "src.product_business_key",
        "product_name": "src.product_name",
        "category": "src.category"
    })
    .execute())
```

### SCD Type 2: T-SQL Two-Step `MERGE` + `INSERT`

A single T-SQL `MERGE` statement can perform exactly one action — update, delete, or insert — per matched row. It cannot both close out the old version *and* insert a new versioned row for the same key in one `WHEN MATCHED` clause, so SCD2 in T-SQL is a **two-step pattern**: close changed rows with `MERGE`, then insert their new versions.

```sql
-- Step 1: Close out rows whose tracked attributes changed, inside an explicit transaction
BEGIN TRAN;

DECLARE @ClosedKeys TABLE (CustomerBusinessKey VARCHAR(20));

MERGE dim.Customer AS tgt
USING #StagingCustomer AS src
    ON tgt.CustomerBusinessKey = src.CustomerBusinessKey
   AND tgt.IsCurrent = 1
WHEN MATCHED AND (tgt.Address <> src.Address OR tgt.Segment <> src.Segment) THEN
    UPDATE SET tgt.IsCurrent = 0, tgt.EndDate = CAST(SYSUTCDATETIME() AS date)
OUTPUT src.CustomerBusinessKey INTO @ClosedKeys;

-- Step 2: Insert current-version rows for brand-new keys AND for keys just closed above
INSERT INTO dim.Customer (CustomerKey, CustomerBusinessKey, Address, Segment, EffectiveDate, EndDate, IsCurrent)
SELECT
    NEXT VALUE FOR seq.CustomerKey,
    src.CustomerBusinessKey, src.Address, src.Segment,
    CAST(SYSUTCDATETIME() AS date), NULL, 1
FROM #StagingCustomer AS src
WHERE src.CustomerBusinessKey IN (SELECT CustomerBusinessKey FROM @ClosedKeys)
   OR NOT EXISTS (
        SELECT 1 FROM dim.Customer tgt
        WHERE tgt.CustomerBusinessKey = src.CustomerBusinessKey AND tgt.IsCurrent = 1
   );

COMMIT;
```

The `OUTPUT` clause on the closing `MERGE` captures exactly which business keys were changed, so the follow-up `INSERT` only creates new versions for rows that were actually closed (plus any genuinely new keys) — not for every staged row.

### SCD Type 2: PySpark Delta `MERGE INTO` (Single-`MERGE` Pattern)

Delta's `MERGE INTO` supports a documented single-statement SCD2 pattern using a `mergeKey` trick: rows that need a new version are tagged with a `NULL` merge key so they can never match an existing row (forcing an insert), while the same staged batch also carries the real business key so it *can* match and close the old version.

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

customers = DeltaTable.forName(spark, "dim.customer")

# Rows whose current version actually changed
changed = (staged_customers.alias("updates")
    .join(customers.toDF().alias("customers"), "customer_business_key")
    .where("customers.is_current = true AND (updates.address <> customers.address OR updates.segment <> customers.segment)")
    .select("updates.*"))

# NULL mergeKey rows can never match -> they always insert as new current versions
staged_updates = (
    changed.selectExpr("NULL as merge_key", "*")
    .union(staged_customers.selectExpr("customer_business_key as merge_key", "*"))
)

(customers.alias("customers")
    .merge(staged_updates.alias("staged"), "customers.customer_business_key = staged.merge_key")
    .whenMatchedUpdate(
        condition="customers.is_current = true AND (customers.address <> staged.address OR customers.segment <> staged.segment)",
        set={"is_current": "false", "end_date": "staged.effective_date"}
    )
    .whenNotMatchedInsert(values={
        "customer_key": "staged.customer_key",
        "customer_business_key": "staged.customer_business_key",
        "address": "staged.address",
        "segment": "staged.segment",
        "is_current": "true",
        "effective_date": "staged.effective_date",
        "end_date": "expr(null)"
    })
    .execute())
```

**Practice Question 2** *(Hard)*

A dimension attribute (`CustomerSegment`) needs full history preserved so historical fact rows always report the segment a customer was in *at the time of the sale*. A junior engineer implements this with a single T-SQL `MERGE` statement's `WHEN MATCHED THEN UPDATE` clause, overwriting `CustomerSegment` in place whenever it changes. What's wrong with this implementation?

A. Nothing — `MERGE` always preserves history automatically  
B. This is SCD Type 1 behavior (overwrite in place), which destroys the history the requirement explicitly needs; it should be SCD Type 2 with a new versioned row and `EffectiveDate`/`EndDate`/`IsCurrent` tracking  
C. `MERGE` can't be used for dimension loads at all  
D. The fix is to switch from `MERGE` to `INSERT` only  

> [!success]- Answer
> **B. This is SCD Type 1 behavior (overwrite in place), which destroys the history the requirement explicitly needs; it should be SCD Type 2 with a new versioned row and `EffectiveDate`/`EndDate`/`IsCurrent` tracking**
>
> A single `WHEN MATCHED THEN UPDATE` that overwrites the changed attribute is the definition of SCD Type 1 — the prior value is gone. A requirement to preserve "what was true at the time of the fact" is a Type 2 requirement, which needs the two-step close-then-insert pattern (T-SQL) or the `mergeKey`-based single-`MERGE INTO` pattern (Delta) shown above, plus the `EffectiveDate`/`EndDate`/`IsCurrent` columns to track versions over time.

---

## Late-Arriving Dimensions: Inferred Members

A fact row sometimes arrives before its dimension row exists — a sale for a customer whose profile record hasn't loaded yet. Blocking the fact load until the "real" dimension record shows up isn't acceptable for most SLAs, so the standard pattern is an **inferred member**: insert a placeholder dimension row immediately, with just the business key and a generated surrogate key, flagged `IsInferred = 1`, so the fact load has a valid key to reference.

```sql
-- Insert an inferred stub for any fact business key with no matching current dimension row
INSERT INTO dim.Customer (CustomerKey, CustomerBusinessKey, CustomerName, Address, IsCurrent, IsInferred)
SELECT NEXT VALUE FOR seq.CustomerKey, f.CustomerBusinessKey, NULL, NULL, 1, 1
FROM #StagingFactSales AS f
WHERE NOT EXISTS (
    SELECT 1 FROM dim.Customer d
    WHERE d.CustomerBusinessKey = f.CustomerBusinessKey AND d.IsCurrent = 1
);
```

When the real dimension record later arrives, it **updates the inferred row in place** (SCD1-style) rather than creating a new SCD2 version — the inferred row never represented a genuine "known" prior state to preserve:

```sql
UPDATE dim.Customer
SET CustomerName = src.CustomerName, Address = src.Address, IsInferred = 0
FROM #StagingCustomer AS src
WHERE dim.Customer.CustomerBusinessKey = src.CustomerBusinessKey
  AND dim.Customer.IsInferred = 1;
```

The PySpark equivalent uses the same two-phase idea: a `whenNotMatchedInsert` to stub the dimension during fact load, and a plain `whenMatchedUpdate` (not the SCD2 `mergeKey` pattern) to backfill the inferred row once real attributes arrive.

## Fact-Table Loading

Loading a fact table means resolving every business key in the incoming rows to its dimension's **current** surrogate key, then loading the fact rows with those resolved foreign keys.

```sql
INSERT INTO fact.Sales (CustomerKey, ProductKey, SalesDate, Amount)
SELECT
    ISNULL(c.CustomerKey, -1),   -- fallback to Unknown Member if no match
    ISNULL(p.ProductKey, -1),
    s.SalesDate, s.Amount
FROM #StagingSales AS s
LEFT JOIN dim.Customer AS c
    ON c.CustomerBusinessKey = s.CustomerBusinessKey AND c.IsCurrent = 1
LEFT JOIN dim.Product AS p
    ON p.ProductBusinessKey = s.ProductBusinessKey AND p.IsCurrent = 1;
```

```python
# PySpark equivalent — broadcast join against the (small) current-version dimension
from pyspark.sql import functions as F

current_customers = spark.table("dim.customer").filter("is_current = true")

fact_with_keys = (staged_sales.alias("s")
    .join(F.broadcast(current_customers).alias("c"),
          on="customer_business_key", how="left")
    .withColumn("customer_key", F.coalesce(F.col("c.customer_key"), F.lit(-1)))
    .select("s.*", "customer_key"))
```

| Fallback pattern | When to use | Tradeoff |
| :--- | :--- | :--- |
| **Unknown Member row** (reserved key, e.g. `-1`) | A dimension lookup misses and the late-arriving-dimension pattern isn't implemented for this source | Fact row loads immediately with a stable, joinable key, but the true dimension attributes are permanently unresolved unless reprocessed |
| **Inferred Member row** | The dimension is expected to catch up soon (late-arriving pattern implemented) | Fact row's key later resolves to full attributes once the real dimension record backfills the stub |
| **Reject/quarantine row** | The business rule requires flagging unresolvable references rather than loading them | No orphaned fact row, but requires a separate remediation/replay process |

> [!warning] Common Mistake
> Loading a fact row's foreign key as `NULL` when a dimension lookup misses, instead of a reserved **Unknown Member** key. `INNER JOIN`-based reports silently drop `NULL`-keyed fact rows from every dimension-joined query — the row still exists in the fact table but effectively disappears from any analysis, with no error raised anywhere. A reserved key (commonly `-1` or `0`, with a corresponding `dim.Customer` row named `'Unknown'`) keeps the fact row joinable and visible.

**Practice Question 3** *(Medium)*

A fact-table load resolves a `CustomerBusinessKey` against `dim.Customer` with a `LEFT JOIN`, and for unmatched rows leaves the resulting `CustomerKey` as `NULL` rather than substituting a reserved key. A downstream Power BI report built on an `INNER JOIN`-style relationship between `fact.Sales` and `dim.Customer` is reviewed, and total sales appear lower than the source system reports. What's the most likely cause?

A. The `LEFT JOIN` itself is the bug and should be an `INNER JOIN`  
B. Fact rows with a `NULL` `CustomerKey` are silently excluded by the report's join to `dim.Customer`, undercounting total sales  
C. Power BI always includes `NULL`-keyed rows in totals, so this isn't the cause  
D. The dimension table needs an SCD Type 2 implementation to fix this  

> [!success]- Answer
> **B. Fact rows with a `NULL` `CustomerKey` are silently excluded by the report's join to `dim.Customer`, undercounting total sales**
>
> A `NULL` foreign key never satisfies an equality join condition, so any join-based report (effectively an inner join in behavior, even if modeled as a relationship in Power BI) drops those fact rows from the result — with no error, just a quietly lower total. The fix is upstream: substitute a reserved Unknown Member surrogate key instead of `NULL` when a dimension lookup misses, so every fact row stays joinable.

## Use Cases

- Generating stable, GA-safe surrogate keys for a new Warehouse dimension using `ROW_NUMBER()` plus a max-key offset, while `IDENTITY` remains Preview
- Implementing SCD Type 2 on a `Customer` dimension so historical fact rows correctly report the customer's segment/address at the time of the sale
- Stubbing an inferred-member dimension row so a same-day fact load isn't blocked waiting on a slower-arriving dimension feed
- Substituting an Unknown Member key for fact rows whose dimension lookup genuinely can't be resolved, keeping them visible in downstream reports

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Duplicate or unstable surrogate keys after a Spark job retry | `monotonically_increasing_id()` used as the key generator | Switch to a `row_number()` + max-key-offset pattern, or a deterministic hash key |
| An `ALTER TABLE ADD` for an `IDENTITY` column fails in Warehouse | `IDENTITY` can't be added to an existing table via `ALTER TABLE` | Use `CREATE TABLE AS SELECT (CTAS)` or `SELECT...INTO` to rebuild the table with the `IDENTITY` column defined at creation |
| A dimension attribute change silently loses history | The load uses SCD Type 1 (`MERGE ... WHEN MATCHED THEN UPDATE`) overwrite semantics where SCD Type 2 was required | Implement the two-step T-SQL `MERGE` + `INSERT` pattern, or the Delta `mergeKey` single-`MERGE INTO` pattern |
| Fact rows vanish from dimension-joined reports | `NULL` foreign keys from unresolved dimension lookups | Substitute a reserved Unknown Member surrogate key instead of `NULL` |
| A late-arriving dimension's real attributes never appear | The inferred-member backfill update step was never implemented, or matches on the wrong flag/key | Add a backfill `UPDATE`/`MERGE` keyed on `IsInferred = 1` that updates in place when the real record arrives |

## Best Practices

- Sequence loads as dimensions first, then facts — never load a fact batch before its referenced dimensions are current
- Prefer `ROW_NUMBER()`-based or hash-based surrogate keys over Preview `IDENTITY` columns until `IDENTITY` reaches GA, unless the workload can tolerate Preview SLAs
- Always filter dimension lookups on `IsCurrent = 1` (or the equivalent) so fact loads resolve against the current version of an SCD2 dimension, not a historical one
- Reserve a reject/quarantine path only for business-mandated cases; default to Unknown Member for anything that should stay visible in reports
- Backfill inferred-member rows with a simple in-place update, not a new SCD2 version — the stub never represented a real historical state

## Exam Tips

> [!tip] Exam Tips
>
> - Fabric Warehouse `IDENTITY` columns are Preview (bigint-only, no reseed, can't `ALTER TABLE ADD`) — know the `ROW_NUMBER()` and hash-key fallbacks cold
> - `monotonically_increasing_id()` is not stable across retries/re-execution — never use it as a real surrogate key generator
> - SCD1 overwrites in place; SCD2 preserves history via new versioned rows — a single `MERGE ... WHEN MATCHED THEN UPDATE` clause can only do SCD1
> - T-SQL SCD2 requires two steps (`MERGE` to close, `INSERT` to add new versions); Delta `MERGE INTO` can do SCD2 in one statement using the `mergeKey`-is-`NULL` trick
> - `NULL` foreign keys silently drop fact rows from join-based reports; use a reserved Unknown Member key instead

## Key Takeaways

- Star schema loads run dimensions first, then facts, because fact rows need dimension surrogate keys to exist
- `IDENTITY` columns in Fabric Warehouse are Preview (as of the July 2026 blueprint); `ROW_NUMBER()`-based and hash-based keys remain the GA-safe patterns, and `monotonically_increasing_id()` is unsafe for real surrogate keys in Spark
- SCD Type 1 overwrites; SCD Type 2 versions — T-SQL needs a two-step `MERGE` + `INSERT`, Delta can do it in one `MERGE INTO` with a `mergeKey` trick
- Late-arriving dimensions get an inferred-member stub row so fact loads aren't blocked, backfilled in place (not as a new SCD2 version) when the real record arrives
- Fact loads should substitute a reserved Unknown Member key for unresolved dimension lookups, never leave the foreign key `NULL`

## Related Topics

- [01-Full vs. Incremental Loads](./01-full-incremental-loads.md)
- [03-Streaming Loading Pattern](./03-streaming-loading-pattern.md)

## Official Documentation

- [IDENTITY columns in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/identity)
- [MERGE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql?view=fabric&preserve-view=true)
- [Upsert into a Delta Lake table using merge](https://learn.microsoft.com/en-us/azure/databricks/delta/merge)
- [Lakehouse and Delta tables](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-and-delta-tables)
- [Transactions in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/transactions)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-full-incremental-loads.md) | [↑ Back to Section](./loading-patterns.md) | [Next →](./03-streaming-loading-pattern.md)**
