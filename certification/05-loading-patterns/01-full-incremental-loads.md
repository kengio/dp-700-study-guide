---
title: Full vs. Incremental Loads
type: topic
tags:
  - dp-700
  - fabric
  - loading-patterns
  - watermark
  - delta-lake
  - t-sql
  - idempotency
---

# Full vs. Incremental Loads

## Overview

Every load design starts with one question: reload everything, or reload only what changed? This topic covers the decision factors between full and incremental loads, the **watermark pattern** that makes incremental loads reliable (implemented side by side in T-SQL `MERGE` for Warehouse and PySpark Delta `MERGE INTO` for Lakehouse), Delta's append vs. overwrite write semantics, idempotency, and the three change-detection options the exam expects you to recognize: a modified-date column, CDC-fed change tables, and mirroring-fed replicas.

> [!abstract]
>
> - **Full loads** re-read and replace the entire dataset every run — simple and self-healing, but expensive and slow at scale
> - **Incremental loads** read only rows changed since the last successful run, tracked via a **watermark** — a durable pointer to "the last point already processed," stored in a control table and advanced only after a commit succeeds
> - `MERGE` (T-SQL) and `MERGE INTO` (Delta) key on a business/natural key, making a re-run of the same batch **idempotent** — it upserts instead of duplicating
> - Change detection has three common flavors: a **modified-date column** on the source, a **CDC-fed** change table, or a **mirroring-fed** replica already landing continuously in OneLake

> [!tip] What the Exam Tests
>
> - Picking full vs. incremental for a scenario based on volume, freshness SLA, and source change-tracking capability
> - Correctly sequencing a watermark read → extract → load → watermark update, and recognizing when that sequence is broken (watermark advanced too early, or not inside the same unit of work as the load)
> - Reading and writing T-SQL `MERGE` and PySpark `MERGE INTO` for the same upsert scenario
> - Distinguishing Delta `append`, `overwrite`, and `overwrite` with `replaceWhere` — and knowing which one is *not* idempotent on its own

---

## Choosing Full vs. Incremental: Decision Factors

| Factor | Favors Full Load | Favors Incremental Load |
| :--- | :--- | :--- |
| **Data volume** | Small to medium tables (dimension-sized) where a full re-read is cheap | Large fact-sized tables where re-reading everything is slow and costly |
| **Source change-tracking** | Source can't reliably signal what changed (no modified-date, no CDC) | Source has a trustworthy modified-date, CDC, or mirroring feed |
| **Freshness SLA** | Nightly/weekly batch windows with slack time | Near-real-time or frequent (hourly/sub-hourly) refresh requirements |
| **Data integrity risk** | Any drift or missed update in a prior run is silently self-corrected on the next full reload | Drift in a missed watermark update can compound across runs if not monitored |
| **Delete handling** | Deletes at the source disappear automatically — the reload just doesn't include them | Hard deletes are invisible to a modified-date-only feed; needs CDC or a reconciliation pass |
| **Compute cost** | ==Higher== per run, but simpler to reason about and operate | ==Lower== per run once the watermark plumbing exists, but more moving parts to maintain |

> [!note] Mental model
> A **full load repaints the whole canvas** every time — correct by construction, but you pay the cost of every brushstroke again even for pixels that never changed. An **incremental load only touches up what changed since the last coat** — cheap and fast, but only as correct as your ability to know *exactly* what changed, which is the entire reason the watermark pattern exists.

**Practice Question 1** *(Easy)*

A 40-row `dim.Region` dimension table is refreshed nightly from a source system with no modified-date column and no change tracking. A 900-million-row `fact.Sales` table is refreshed hourly from a source with a reliable `LastModifiedUtc` column. Which load strategy fits each table?

A. Full load for both  
B. Incremental load for both  
C. `dim.Region` = full load (small, no change-tracking signal); `fact.Sales` = incremental load keyed on `LastModifiedUtc`  
D. `dim.Region` = incremental load; `fact.Sales` = full load  

> [!success]- Answer
> **C. `dim.Region` = full load (small, no change-tracking signal); `fact.Sales` = incremental load keyed on `LastModifiedUtc`**
>
> A 40-row table with no way to detect what changed is cheapest and safest to just reload in full every run. A 900-million-row table with an hourly SLA and a trustworthy modified-date column is exactly the incremental-load scenario the watermark pattern is built for — reloading it in full every hour would be prohibitively expensive.

---

## The Watermark Pattern

A **watermark** is a durable value — usually a timestamp or a monotonically increasing ID — marking the last point in the source already successfully loaded. It lives in a **control table**, not in application memory or a pipeline variable, so it survives across runs and failures.

A minimal watermark control table needs four columns:

| Column | Purpose |
| :--- | :--- |
| `SourceTableName` | Which source/target pair this watermark tracks |
| `WatermarkColumn` | The column being watched (e.g., `LastModifiedUtc`) |
| `LastWatermarkValue` | The highest value successfully loaded so far |
| `LastRunUtc` | Audit timestamp of the last successful update |

The load sequence is always: **read the old watermark → extract rows past it → load them → advance the watermark, only after the load commits.**

> [!warning] Common Mistake
> Advancing the watermark *before* confirming the load succeeded — or storing it somewhere that isn't durable, like a pipeline variable that resets on the next run — means a failed load silently skips the missed rows on the next run instead of retrying them. The watermark update must be the **last** step, and ideally happen in the **same transaction** as the load it's tracking.

### T-SQL: Watermark Table + MERGE (Warehouse)

```sql
-- Control table: one row per tracked source/target pair
CREATE TABLE control.WatermarkTable (
    SourceTableName      VARCHAR(128) NOT NULL,
    WatermarkColumn       VARCHAR(128) NOT NULL,
    LastWatermarkValue    DATETIME2(3) NOT NULL,
    LastRunUtc             DATETIME2(3) NOT NULL
);

INSERT INTO control.WatermarkTable VALUES
    ('fact.Sales', 'LastModifiedUtc', '1900-01-01', SYSUTCDATETIME());

-- Incremental load procedure: extract, upsert, advance watermark — one transaction
CREATE OR ALTER PROCEDURE dbo.Load_FactSales_Incremental
AS
BEGIN
    DECLARE @OldWatermark DATETIME2(3);
    DECLARE @NewWatermark DATETIME2(3);

    SELECT @OldWatermark = LastWatermarkValue
    FROM control.WatermarkTable
    WHERE SourceTableName = 'fact.Sales';

    BEGIN TRAN;

    -- Stage only rows changed since the last watermark
    SELECT *
    INTO #StagingSales
    FROM Source.dbo.Sales
    WHERE LastModifiedUtc > @OldWatermark;

    SELECT @NewWatermark = MAX(LastModifiedUtc) FROM #StagingSales;

    -- MERGE keys on the business key, making a re-run idempotent
    MERGE fact.Sales AS tgt
    USING #StagingSales AS src
        ON tgt.SalesOrderId = src.SalesOrderId
    WHEN MATCHED THEN
        UPDATE SET tgt.Amount = src.Amount, tgt.LastModifiedUtc = src.LastModifiedUtc
    WHEN NOT MATCHED THEN
        INSERT (SalesOrderId, Amount, LastModifiedUtc)
        VALUES (src.SalesOrderId, src.Amount, src.LastModifiedUtc);

    -- Advance the watermark only after the MERGE succeeds, same transaction
    IF @NewWatermark IS NOT NULL
    BEGIN
        UPDATE control.WatermarkTable
        SET LastWatermarkValue = @NewWatermark, LastRunUtc = SYSUTCDATETIME()
        WHERE SourceTableName = 'fact.Sales';
    END

    COMMIT;
END;
```

Fabric Data Warehouse supports grouping schema and data changes into a single **explicit transaction** (`BEGIN TRAN`/`COMMIT`/`ROLLBACK`), and `MERGE` takes an Intent Exclusive lock like other DML — so the staging load, the `MERGE`, and the watermark update above either all land together or all roll back together.

### PySpark: Watermark Table + Delta `MERGE INTO` (Lakehouse)

```python
from delta.tables import DeltaTable
from pyspark.sql import functions as F

# Watermark lives in a small Delta control table, not a notebook variable
watermark_df = spark.table("control.watermark_table") \
    .filter("source_table_name = 'fact_sales'")
old_watermark = watermark_df.collect()[0]["last_watermark_value"]

# Extract only rows changed since the last watermark
staged = spark.table("source.sales") \
    .filter(F.col("last_modified_utc") > old_watermark)

new_watermark = staged.agg(F.max("last_modified_utc")).collect()[0][0]

if new_watermark is not None:
    target = DeltaTable.forName(spark, "fact.sales")

    # MERGE INTO keys on the business key — idempotent upsert
    (target.alias("tgt")
        .merge(staged.alias("src"), "tgt.sales_order_id = src.sales_order_id")
        .whenMatchedUpdate(set={
            "amount": "src.amount",
            "last_modified_utc": "src.last_modified_utc"
        })
        .whenNotMatchedInsert(values={
            "sales_order_id": "src.sales_order_id",
            "amount": "src.amount",
            "last_modified_utc": "src.last_modified_utc"
        })
        .execute())

    # Advance the watermark only after the MERGE INTO commits
    spark.sql(f"""
        UPDATE control.watermark_table
        SET last_watermark_value = TIMESTAMP'{new_watermark}',
            last_run_utc = current_timestamp()
        WHERE source_table_name = 'fact_sales'
    """)
```

Each Delta `MERGE INTO` is its own ACID transaction against the target table, so the watermark `UPDATE` that follows it is a separate statement — if the notebook fails between the two, the next run's `MERGE INTO` re-processes the same rows harmlessly (it's still keyed on `sales_order_id`), so the pattern stays safe even without wrapping both statements in one transaction.

**Practice Question 2** *(Medium)*

A nightly incremental load procedure extracts changed rows, `MERGE`s them into the target table, and then updates the watermark control table — but the watermark update happens in a **separate, unrelated batch job** scheduled to run 10 minutes later, not inside the same transaction or notebook run as the load. What's the risk?

A. No risk — watermark updates never need to be tied to the load that produced them  
B. If the load succeeds but the separate watermark-update job fails or is skipped, the next run re-reads and re-`MERGE`s the same rows — wasteful but not incorrect, since `MERGE` is idempotent  
C. If the load fails partway through, the watermark still advances on schedule, permanently skipping the unprocessed rows on every future run  
D. Both B and C are risks worth naming, but C is the more dangerous failure mode  

> [!success]- Answer
> **D. Both B and C are risks worth naming, but C is the more dangerous failure mode**
>
> Decoupling the watermark update from the load it's tracking creates two failure modes. If the load fails but the separately-scheduled watermark job still runs (C), the watermark advances past rows that were never actually loaded — those rows are silently and permanently skipped on every subsequent run, a hard-to-detect data-loss bug. If the load succeeds but the watermark update is delayed or skipped (B), the next run redundantly reprocesses the same window — wasteful, but `MERGE`'s idempotency prevents duplication. C is the scenario that actually loses data; the watermark update belongs in the same unit of work as the load.

---

## Append vs. Overwrite Semantics in Delta

| Mode | Behavior | Idempotent on re-run? |
| :--- | :--- | :--- |
| `mode("append")` | Adds new files to the table; existing rows untouched | ❌ No — re-running the same batch duplicates every row |
| `mode("overwrite")` | Replaces the entire table's data (or the matched partitions with `replaceWhere`) | ✅ Yes — re-running produces the same end state |
| `.merge(...).execute()` (`MERGE INTO`) | Upserts row-by-row on a join key; unmatched target rows are untouched unless a `whenNotMatchedBySource` clause is added | ✅ Yes — keyed on the business key |

```python
# Overwrite only the affected partition(s) — safe to re-run for that partition
(spark.read.table("staging.daily_sales")
    .write
    .format("delta")
    .mode("overwrite")
    .option("replaceWhere", "sales_date = '2026-07-10'")
    .saveAsTable("fact.sales"))
```

`replaceWhere` scopes an overwrite to matching partitions instead of the whole table — useful for a "reload today's partition" incremental pattern that's simpler than `MERGE INTO` when the source naturally partitions by load date and a full day's data is always reloaded together.

> [!warning] Common Mistake
> Using plain `append` as the *only* write step in an incremental load pipeline. Append has no concept of "this row already exists" — if the pipeline is retried after a partial failure, or the same extract window runs twice, every row lands twice. Append is safe only as the raw bronze-layer ingestion step (see [03-Streaming Loading Pattern](./03-streaming-loading-pattern.md)); anything meant to be queried as a clean, deduplicated table needs `MERGE INTO`, `overwrite`, or a downstream dedup step.

---

## Idempotency

A load is **idempotent** if running it twice with the same inputs produces the same end state as running it once. This is the property that makes retries safe, and it's why `MERGE`/`MERGE INTO` — not blind `INSERT`/`append` — is the default recommendation for any incremental load keyed on a business key.

| Technique | Idempotent? | Why |
| :--- | :--- | :--- |
| `INSERT` / `append` on every run | ❌ No | No matching logic — every re-run adds duplicate rows |
| `MERGE` / `MERGE INTO` keyed on business key | ✅ Yes | Matched rows update in place; only genuinely new keys insert |
| `overwrite` of an entire table or partition | ✅ Yes | The end state depends only on the source data for that scope, not on how many times the write ran |
| Watermark boundary using `>` on the last value | ✅ Yes, **if** paired with `MERGE`/overwrite | Re-extracting the same window and re-`MERGE`-ing it changes nothing; re-extracting with plain append duplicates it |

**Practice Question 3** *(Hard)*

A pipeline retry policy re-runs a failed activity automatically up to 3 times. The activity in question stages changed rows from a source and appends them directly into a Lakehouse fact table with `mode("append")` — no `MERGE INTO` step. The first attempt fails after writing half its rows; the retry succeeds and writes all rows. What's the most likely outcome?

A. No issue — Delta automatically deduplicates append writes  
B. The rows written by the failed first attempt are duplicated by the successful retry, since append has no matching logic and both attempts wrote the same source window  
C. The retry overwrites the first attempt's partial write automatically  
D. The pipeline retry policy prevents this scenario by design  

> [!success]- Answer
> **B. The rows written by the failed first attempt are duplicated by the successful retry, since append has no matching logic and both attempts wrote the same source window**
>
> `append` has no concept of "already written" — it's pure addition. The partially-written rows from the failed attempt remain in the table, and the retry's full write adds its own copy of the same rows on top, producing duplicates. This is the textbook argument for using `MERGE INTO` (or a partition `overwrite`) instead of `append` for anything that needs to tolerate retries, which almost every production incremental load does.

---

## Change Detection Options

| Option | How it works | Strengths | Weaknesses |
| :--- | :--- | :--- | :--- |
| **Modified-date column** | Source table maintains a `LastModifiedUtc`-style column; incremental extract filters `> watermark` | Simplest to implement; works with almost any source | Misses hard deletes entirely; vulnerable to clock skew and to source updates that don't touch the modified-date column |
| **CDC-fed** | Source database's change data capture feed (or a Fabric mirrored database's change feed) supplies inserts/updates/**deletes** explicitly | Captures deletes and every change, including columns not covered by a modified-date | Requires CDC enabled on the source; more moving parts than a simple column filter — see [06-Batch Ingestion](../06-batch-ingestion/batch-ingestion.md) for pipeline-side CDC ingestion patterns |
| **Mirroring-fed** | Fabric Database Mirroring continuously replicates the entire source database into OneLake as Delta tables, near-real-time | No extraction pipeline to build at all for the mirrored source; the replica *is* the incremental feed | Only available for the mirroring-supported source types; full coverage of mirroring flavors and setup lives in [06-Batch Ingestion](../06-batch-ingestion/03-mirroring.md) |

> [!note] Mental model
> A modified-date column is a **sticky note the source leaves on each row** saying "I was touched at this time" — reliable only if every write actually updates the note. CDC is a **security camera on the whole table** — it records every change, including the ones that would otherwise leave the room unnoticed (deletes). Mirroring skips the extraction question entirely: the "incremental feed" is just the continuously-replicated table itself, already sitting in OneLake.

## Use Cases

- A nightly incremental load of a large fact table from a source with a reliable `LastModifiedUtc` column, using the watermark + `MERGE` pattern to keep the load both fast and idempotent
- A small reference/dimension table with no change-tracking capability, reloaded in full every run rather than engineering a watermark for a table where the cost difference is negligible
- Reloading a single day's partition with `overwrite` + `replaceWhere` when the source naturally delivers a full day's data as one batch
- Detecting source-side deletes that a modified-date column would miss, by switching to a CDC-fed or mirroring-fed change detection option

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Rows loaded twice after a pipeline retry | The load step used `append` instead of `MERGE`/`MERGE INTO`, so a retried attempt duplicates rows already written | Switch the load step to `MERGE INTO` (Delta) or `MERGE` (T-SQL) keyed on the business key, or use partition `overwrite` |
| Rows silently missing after a failed run | The watermark was advanced before (or independent of) confirming the load committed | Move the watermark update to the last step of the same transaction/unit of work as the load |
| Deleted source rows still appear in the target | Change detection relies solely on a modified-date column, which has no signal for deletes | Switch to a CDC-fed or mirroring-fed change detection option, or add a periodic full reconciliation pass |
| `overwrite` unexpectedly wipes more data than intended | `replaceWhere` was omitted, so `overwrite` replaced the entire table instead of one partition | Add a `replaceWhere` predicate scoped to the exact partition(s) being reloaded |
| Incremental extract silently returns zero new rows every run | The watermark column isn't being updated by the source on every relevant write, so `> watermark` never matches new changes | Confirm the source reliably stamps the watermark column on every insert/update, or switch to a CDC-fed feed |

## Best Practices

- Store watermarks in a durable control table, never in a pipeline variable or notebook-local variable that resets between runs
- Advance the watermark as the last step of the same transaction (T-SQL) or immediately after a successful `MERGE INTO` commit (Delta) — never before
- Default to `MERGE`/`MERGE INTO` for any load that needs to tolerate retries; reserve plain `append` for raw, never-reprocessed bronze-layer ingestion
- Use `overwrite` + `replaceWhere` instead of `MERGE INTO` when the source delivers a full, self-contained partition per run — it's simpler and just as idempotent
- Pick a change-detection option based on whether deletes matter: modified-date columns for insert/update-only sources, CDC or mirroring when deletes must be captured

## Exam Tips

> [!tip] Exam Tips
>
> - Full load = simple, self-correcting, expensive at scale; incremental load = cheap per run, but only as correct as its change-detection signal
> - The watermark sequence is always: read old value → extract past it → load → advance the watermark **last**, in the same unit of work as the load
> - `MERGE`/`MERGE INTO` are the idempotency mechanism; `append`/`INSERT` alone are not — a scenario describing "duplicated rows after a retry" almost always points to a missing `MERGE`
> - `overwrite` + `replaceWhere` scopes a Delta overwrite to matching partitions — don't confuse it with a full-table `overwrite`
> - Modified-date columns miss hard deletes; CDC and mirroring-fed feeds capture them

## Key Takeaways

- Choose full loads for small, low-change, hard-to-track sources; choose incremental loads for large, high-freshness sources with a reliable change signal
- A watermark is a durable control-table value, advanced only after a successful commit, in the same transaction/unit of work as the load
- T-SQL `MERGE` and PySpark Delta `MERGE INTO` both provide idempotent, business-key-based upserts — the correct default for retry-safe incremental loads
- Delta's `append` is not idempotent; `overwrite` (optionally scoped with `replaceWhere`) and `MERGE INTO` are
- Change detection options trade off simplicity against delete-capture: modified-date columns are simplest but miss deletes; CDC and mirroring capture deletes at the cost of more setup

## Related Topics

- [02-Dimensional Model Loading](./02-dimensional-model-loading.md)
- [03-Streaming Loading Pattern](./03-streaming-loading-pattern.md)

## Official Documentation

- [Ingest data into the Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/ingest-data)
- [Transactions in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/transactions)
- [MERGE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql?view=fabric&preserve-view=true)
- [Lakehouse and Delta tables](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-and-delta-tables)
- [Upsert into a Delta Lake table using merge](https://learn.microsoft.com/en-us/azure/databricks/delta/merge)
- [Delta Lake table format interoperability in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/delta-lake-interoperability)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../04-orchestration/03-orchestration-patterns.md) | [↑ Back to Section](./loading-patterns.md) | [Next →](./02-dimensional-model-loading.md)**
