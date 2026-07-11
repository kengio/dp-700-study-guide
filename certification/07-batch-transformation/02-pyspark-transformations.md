---
title: PySpark Transformations
type: topic
tags:
  - dp-700
  - fabric
  - batch-transformation
  - pyspark
  - spark
  - delta
---

# PySpark Transformations

## Overview

PySpark is Fabric's code-first transformation surface, running inside notebooks against Spark pools. This topic covers the transformation vocabulary the exam expects: reading and writing Delta tables, column-level transforms, joins (including the broadcast hint), aggregation, window functions, deduplication, null handling, and conditional logic — the building blocks every notebook-based transformation pipeline is assembled from.

> [!abstract]
>
> - Delta read/write is the default data interchange format — `spark.read.format("delta")` and `saveAsTable`/`write.format("delta")`, with `partitionBy` for physical layout
> - Column-level transforms (`select`, `filter`, `withColumn`, `withColumnRenamed`) and conditional logic (`when`/`otherwise`) are the daily-driver API
> - `broadcast()` hints tell Spark to send a small dimension table to every executor instead of shuffling a large fact table
> - Window functions (`Window.partitionBy().orderBy()`) power `row_number`, `rank`, and `lag` — the backbone of dedup and SCD Type 2 logic

> [!tip] What the Exam Tests
>
> - Recognizing correct PySpark syntax for reading/writing Delta, joining, aggregating, and windowing
> - Knowing when a broadcast join is appropriate (small dimension table) vs. when it will fail (large table forced to broadcast)
> - Choosing `dropDuplicates` vs. `na.fill`/`na.drop` vs. `when`/`otherwise` for the right cleanup task
> - Reading window-function code and predicting its output (especially `row_number()` for dedup or "latest record" patterns)

---

## Reading and Writing Delta Tables

```python
# Read a Delta table by path
df = spark.read.format("delta").load("Tables/sales_bronze")

# Read a managed table registered in the lakehouse metastore
df = spark.read.table("sales_bronze")

# Write as a managed Delta table, overwriting existing data
df.write.format("delta").mode("overwrite").saveAsTable("sales_silver")

# Write partitioned by a low-cardinality column for pruning on read
(
    df.write.format("delta")
    .mode("overwrite")
    .partitionBy("order_year", "order_month")
    .saveAsTable("sales_silver_partitioned")
)

# Append instead of overwrite — for incremental loads
df.write.format("delta").mode("append").saveAsTable("sales_silver")
```

> [!warning] Common Mistake
> Partitioning on a **high-cardinality** column (e.g., `customer_id` or a timestamp with second-level precision) creates thousands of tiny partition folders — this hurts performance instead of helping it. Partition on low-cardinality columns that match common filter predicates, typically date parts (`year`, `month`) or a small category field.

## Select, Filter, and Column Transforms

```python
from pyspark.sql.functions import col, upper, round as spark_round

# select + filter
result = (
    df.select("order_id", "customer_id", "amount", "order_date")
    .filter(col("amount") > 0)
)

# withColumn — add or replace a column
result = result.withColumn("amount_rounded", spark_round(col("amount"), 2))

# withColumnRenamed — rename without changing values
result = result.withColumnRenamed("order_date", "sale_date")

result.show(3)
# +--------+-----------+------+----------+---------------+
# |order_id|customer_id|amount|  sale_date|amount_rounded|
# +--------+-----------+------+----------+---------------+
# |    1001|        501| 29.99|2026-06-01|          29.99|
# |    1002|        502| 14.50|2026-06-01|          14.50|
# +--------+-----------+------+----------+---------------+
```

## Conditional Logic: when / otherwise

```python
from pyspark.sql.functions import when, col

df = df.withColumn(
    "order_tier",
    when(col("amount") >= 1000, "Platinum")
    .when(col("amount") >= 100, "Gold")
    .otherwise("Standard"),
)

df.select("order_id", "amount", "order_tier").show(3)
# +--------+------+----------+
# |order_id|amount|order_tier|
# +--------+------+----------+
# |    1001| 29.99|  Standard|
# |    1050|150.00|      Gold|
# |    1099|2500.0|  Platinum|
# +--------+------+----------+
```

## Joins and the Broadcast Hint

```python
from pyspark.sql.functions import broadcast

# Standard join — Spark decides the join strategy (shuffle by default for large-large joins)
fact_dim = fact_orders.join(dim_customers, on="customer_id", how="left")

# Broadcast join — force the small dimension table to every executor
# use when the right-side table comfortably fits in executor memory (rule of thumb: well under 10 GB)
fact_dim = fact_orders.join(broadcast(dim_customers), on="customer_id", how="left")
```

> [!note] Mental model — broadcast joins
> A shuffle join is two moving trucks meeting in the middle of the country and swapping cargo — expensive, network-heavy. A broadcast join is handing every warehouse a photocopy of a thin reference binder ahead of time — no meeting required. Only broadcast the *binder* (small dimension), never the *warehouse inventory* (large fact table); broadcasting something too large will exhaust executor memory and can crash the job.

**Practice Question 1** *(Medium)*

A notebook joins a 500 GB fact table against a 40 MB dimension table and the job is spending most of its time shuffling data across the cluster. What single change is most likely to fix this, and why?

A. Increase the number of Spark executors — more executors always fix shuffle-heavy jobs  
B. Wrap the dimension table in `broadcast()` so Spark sends the small table to every executor instead of shuffling the large fact table  
C. Switch the join to a `crossJoin` — cross joins are faster for small tables  
D. Repartition the fact table to 1 partition before joining  

> [!success]- Answer
> **B. Wrap the dimension table in `broadcast()` so Spark sends the small table to every executor instead of shuffling the large fact table**
>
> A 40 MB table is a textbook broadcast-join candidate — well within safe broadcast size, and forcing the join strategy avoids shuffling the 500 GB fact table entirely. Adding executors treats a symptom, not the cause; a `crossJoin` produces a Cartesian product and is unrelated to this problem; repartitioning the fact table to 1 partition would eliminate parallelism and make the job dramatically slower.

## Grouping and Aggregation

```python
from pyspark.sql.functions import sum as spark_sum, count, avg

summary = (
    df.groupBy("customer_id", "order_tier")
    .agg(
        spark_sum("amount").alias("total_amount"),
        count("order_id").alias("order_count"),
        avg("amount").alias("avg_amount"),
    )
)

summary.orderBy(col("total_amount").desc()).show(3)
# +-----------+----------+------------+-----------+----------+
# |customer_id|order_tier|total_amount|order_count|avg_amount|
# +-----------+----------+------------+-----------+----------+
# |        512|  Platinum|     18500.0|          6|    3083.3|
# |        501|      Gold|      4200.5|         12|     350.0|
# +-----------+----------+------------+-----------+----------+
```

## Window Functions

```python
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number, rank, lag

# Window spec: partition by customer, order by sale_date descending
customer_window = Window.partitionBy("customer_id").orderBy(col("sale_date").desc())

ranked = df.withColumn("row_num", row_number().over(customer_window))
ranked = ranked.withColumn("order_rank", rank().over(customer_window))

# lag — compare each row to the previous row's value within the partition
lag_window = Window.partitionBy("customer_id").orderBy("sale_date")
ranked = ranked.withColumn("prev_amount", lag("amount", 1).over(lag_window))

ranked.select("customer_id", "sale_date", "amount", "row_num", "prev_amount").show(4)
# +-----------+----------+------+-------+-----------+
# |customer_id| sale_date|amount|row_num|prev_amount|
# +-----------+----------+------+-------+-----------+
# |        501|2026-06-05| 150.0|      1|       NULL|
# |        501|2026-06-01|  29.99|      2|      150.0|
# +-----------+----------+------+-------+-----------+
```

> [!note] Mental model — `row_number()` for "latest record"
> `row_number().over(Window.partitionBy(key).orderBy(date.desc()))` followed by `.filter(col("row_num") == 1)` is the single most reused pattern in this whole guide — it's how you get "the latest record per key" in PySpark, T-SQL, and (via `arg_max()`) KQL. Memorize this shape; it reappears in dedup, SCD Type 2, and late-arriving-data logic.

## Deduplication: dropDuplicates

```python
# Drop exact duplicate rows across all columns
deduped = df.dropDuplicates()

# Drop duplicates based on a business key only, keeping an arbitrary matching row
deduped = df.dropDuplicates(["order_id"])

# For deterministic "keep latest" dedup, prefer the window-function pattern above:
# dropDuplicates does not guarantee which row survives when duplicates aren't identical
```

> [!warning] Common Mistake
> `dropDuplicates(["order_id"])` does **not** guarantee it keeps the most recent or highest-priority row when duplicate keys have different values — it keeps an arbitrary surviving row. When "keep the latest" matters (the common case for late-arriving or re-sent records), use the `row_number()` window pattern instead, filtering to `row_num == 1`.

## Handling Missing Data

```python
# Fill nulls with a default value per column
df_filled = df.na.fill({"amount": 0, "order_tier": "Unknown"})

# Fill all numeric-typed nulls with 0 in one call
df_filled = df.na.fill(0)

# Drop rows where any column is null
df_clean = df.na.drop()

# Drop rows only if specific required columns are null
df_clean = df.na.drop(subset=["order_id", "customer_id"])

# Drop rows where at least 2 non-null values are required (threshold)
df_clean = df.na.drop(thresh=2)
```

## Casting and Schema Handling

```python
from pyspark.sql.types import IntegerType, DecimalType, DateType
from pyspark.sql.functions import to_date

# Cast a column to a specific type
df = df.withColumn("customer_id", col("customer_id").cast(IntegerType()))
df = df.withColumn("amount", col("amount").cast(DecimalType(10, 2)))

# Parse a string into a date type
df = df.withColumn("sale_date", to_date(col("sale_date_str"), "yyyy-MM-dd"))

# Inspect the resolved schema
df.printSchema()
# root
#  |-- order_id: integer (nullable = true)
#  |-- customer_id: integer (nullable = true)
#  |-- amount: decimal(10,2) (nullable = true)
#  |-- sale_date: date (nullable = true)
```

**Practice Question 2** *(Medium)*

A bronze-layer table has a `customer_id` column stored as `string` due to an inconsistent source system, and downstream joins against a properly typed `int` dimension table are silently returning zero matches. What is the most likely root cause and fix?

A. The join column names don't match — rename one of them  
B. The `string` and `int` types don't auto-coerce for equality in a join predicate the way the author expects; cast `customer_id` to `IntegerType()` (or the dimension's `string`) before joining so both sides compare consistently  
C. Spark doesn't support joins across differently named DataFrames  
D. The dimension table needs `broadcast()` applied for the types to match  

> [!success]- Answer
> **B. The `string` and `int` types don't auto-coerce for equality in a join predicate the way the author expects; cast `customer_id` to `IntegerType()` (or the dimension's `string`) before joining so both sides compare consistently**
>
> Type mismatches on join keys are a classic silent-failure pattern — the join runs without error but matches nothing because `"501"` (string) and `501` (int) don't compare equal under Spark's default join semantics in every code path. `broadcast()` only changes join *strategy*, not type compatibility, and renaming columns doesn't address a type mismatch.

## Use Cases

- Bronze-to-silver cleanup: casting raw string columns to proper types, filling or dropping nulls, standardizing column names
- Silver-to-gold star-schema prep: joining fact and dimension tables (with `broadcast()` for small dimensions), aggregating with `groupBy`/`agg`
- SCD Type 2 and "latest record" logic using `Window.partitionBy().orderBy()` with `row_number()`
- Deduplicating re-sent or replayed source records before writing to a curated Delta table

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `AnalysisException: cannot resolve column` | Column name typo, or the DataFrame's schema changed upstream (e.g., after a `withColumnRenamed`) | `printSchema()` to confirm actual column names before referencing them |
| Join returns far fewer rows than expected | Join-key type mismatch (e.g., `string` vs. `int`), or an inner join dropping unmatched rows silently | Cast both join keys to the same type; switch to `how="left"` if unmatched rows should be preserved |
| `OutOfMemoryError` during a join | A large table was wrapped in `broadcast()` and exceeded executor memory | Remove the broadcast hint for large tables and let Spark choose a shuffle join, or use `spark.sql.autoBroadcastJoinThreshold` to tune automatic broadcast behavior |
| `dropDuplicates` keeps the "wrong" version of a duplicate row | `dropDuplicates` doesn't guarantee which duplicate survives | Use the `row_number()`-over-window pattern with an explicit `orderBy` to control which row is kept |
| Partitioned write creates thousands of small files | Partitioned on a high-cardinality column | Partition on a low-cardinality column (date parts, category), or skip partitioning for smaller tables |

## Best Practices

- Prefer Delta-native reads/writes (`spark.read.format("delta")`, `saveAsTable`) over raw file-format APIs to get transaction log benefits (time travel, `MERGE`, schema enforcement)
- Use `broadcast()` deliberately for known-small dimension tables; let Spark's cost-based optimizer decide otherwise
- Reach for the `row_number()`-over-window pattern any time "keep the latest/best row per key" is the actual requirement — don't rely on `dropDuplicates` for that
- Cast types explicitly right after ingest (bronze-to-silver) rather than letting implicit type mismatches propagate downstream

## Exam Tips

> [!tip] Exam Tips
>
> - `broadcast()` is for the *small* side of a join — broadcasting a large table causes memory errors, not speedups
> - `dropDuplicates()` ≠ deterministic "keep latest" — that requires `row_number()` over an ordered window filtered to `1`
> - `na.fill()`/`na.drop()` operate at the DataFrame level; know the difference between `thresh=` (minimum non-null count) and `subset=` (which columns to check)
> - `partitionBy()` in `saveAsTable`/`write` is a physical storage optimization (folder pruning), not a Spark in-memory partition count control

## Key Takeaways

- `spark.read.format("delta")` / `saveAsTable` / `partitionBy` are the standard Delta read-write-partition vocabulary in Fabric notebooks
- `broadcast()` avoids shuffling a large fact table by sending a small dimension table to every executor — use it only for genuinely small tables
- `Window.partitionBy().orderBy()` with `row_number()` is the reusable pattern behind dedup, "latest record," and SCD Type 2 logic
- `dropDuplicates` removes duplicates without guaranteeing which row survives; use a window function when the "which one wins" question matters

## Related Topics

- [01-Choosing a Transform Tool](./01-choosing-transform-tool.md)
- [03-T-SQL Transformations](./03-tsql-transformations.md)
- [05-Data Quality Patterns](./05-data-quality-patterns.md)

## Official Documentation

- [Spark DataFrame API reference](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/dataframe.html)
- [Delta Lake in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-and-delta-tables)
- [How to use notebooks in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/how-to-use-notebook)
- [PySpark window functions](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.Window.html)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-choosing-transform-tool.md) | [↑ Back to Section](./batch-transformation.md) | [Next →](./03-tsql-transformations.md)**
