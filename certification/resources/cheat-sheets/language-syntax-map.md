---
title: "Language Syntax Map — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - pyspark
  - t-sql
  - kql
  - rosetta
---

# Language Syntax Map — Quick Reference

PySpark ↔ T-SQL ↔ KQL rosetta stone: the same operation, three syntaxes. Condensed from [07-batch-transformation](../../07-batch-transformation/batch-transformation.md) (02–05) and [08-streaming-data/05-windowing-functions](../../08-streaming-data/05-windowing-functions.md).

> [!abstract] Quick Reference
>
> - Core operations (read, filter, select, join, aggregate, window, dedup, null handling, write, upsert) in all three languages side by side
> - Windowing function syntax across Eventstream, KQL, and Spark
> - The recurring "latest record per key" pattern — one shape, three names

---

## The Rosetta Table

| Operation | PySpark | T-SQL | KQL |
| :--- | :--- | :--- | :--- |
| Read | `spark.read.format("delta").load(path)` / `.table(name)` | `SELECT * FROM schema.table` (via CTAS/query) | `TableName` (implicit) |
| Filter | `.filter(col("amount") > 0)` / `.where(...)` | `WHERE amount > 0` | `\| where Amount > 0` |
| Select/project | `.select("a", "b")` | `SELECT a, b` | `\| project a, b` |
| Exclude columns | `.drop("x")` | `SELECT *` (list remaining manually) | `\| project-away x` |
| Join | `.join(dim, on="id", how="left")`; `.join(broadcast(dim), ...)` for small dim | `JOIN dim ON f.id = dim.id` | `\| join kind=leftouter (dim) on id` or `\| lookup kind=leftouter dim on id` (broadcast, fact/dim-shaped) |
| Aggregate | `.groupBy("k").agg(sum("amt"), count("id"), avg("amt"))` | `GROUP BY k` + `SUM`/`COUNT`/`AVG`; `HAVING` for post-agg filter | `\| summarize sum(Amt), count(), avg(Amt) by k` then `\| where` for post-agg filter |
| Window | `Window.partitionBy("k").orderBy(col("ts").desc())` + `row_number()`/`rank()`/`lag()` `.over(w)` | `ROW_NUMBER()/RANK()/LAG() OVER (PARTITION BY k ORDER BY ts DESC)` | `row_window_session(...)` (session only); general windowing via `summarize`/`bin()` |
| Dedup (non-deterministic) | `dropDuplicates(["key"])` | `SELECT DISTINCT` | `summarize take_any(*) by key` |
| ==Dedup (deterministic "keep latest")== | `row_number().over(w)`, filter `row_num == 1` | `ROW_NUMBER() OVER (...ORDER BY ts DESC)`, filter `row_num = 1` | `summarize arg_max(ts, *) by key` |
| Null handling (fill) | `.na.fill({"col": default})` | `COALESCE(col, default)` (ANSI, N-args) or `ISNULL(col, default)` (2-arg, first-arg-typed) | `coalesce(col, default)` |
| Null handling (drop) | `.na.drop(subset=[...])` | `WHERE col IS NOT NULL` | `\| where isnotempty(col)` *(general KQL pattern)* |
| Write/insert | `.write.format("delta").mode("append"/"overwrite").saveAsTable(...)` | `INSERT INTO t SELECT ...`; `CREATE TABLE t AS SELECT ...` (CTAS) | `.set-or-append TableName <\| ...` |
| ==Upsert/merge== | `DeltaTable.merge(source, cond).whenMatchedUpdate(...).whenNotMatchedInsert(...)` | `MERGE INTO target USING source ON ... WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...` (==GA==) | Update policy (transform-on-ingest) or materialized view `arg_max` dedup — no direct row-level `MERGE` statement |

---

## Windowing Functions Across Surfaces

| Window type | Eventstream (Group by, no-code) | KQL | Spark Structured Streaming |
| :--- | :--- | :--- | :--- |
| Tumbling | Select **Tumbling**, set window size | `summarize <agg> by bin(Timestamp, 5m)` | `.groupBy(window(col("eventTime"), "5 minutes"))` |
| Hopping | Select **Hopping**, set size + hop | ==No dedicated operator== — approximate via `bin()` variants | `.groupBy(window(col("eventTime"), "5 minutes", "1 minute"))` |
| Sliding | Select **Sliding** — emits on content change | Not a standing construct — approximate at query time | No distinct API — closest is hopping w/ tiny slide |
| Session | Select **Session**, set timeout | `row_window_session(Timestamp, MaxDist, MaxGap[, Restart])` | `.groupBy(session_window(col("eventTime"), "10 minutes"))` |
| Snapshot | Not a dedicated option — zero-width group | `summarize <agg> by Timestamp` (raw column, no `bin()`) | `.groupBy("eventTime")` (raw column, no `window()`) |

> [!warning] Common Mistake — KQL has ==no dedicated hopping or sliding window operator==. A scenario asking for a named KQL hopping-window function is inventing one; the real answer composes `bin()` variations instead.

**Late data:** Eventstream Group by has a configurable late-arrival tolerance; Spark uses `.withWatermark(col, tolerance)` (state dropped once elapsed — late events aren't rejected from the stream, just excluded from an already-finalized window); KQL has no standing watermark — a `bin()` query just re-evaluates against current table contents.

---

## The "Latest Record Per Key" Pattern (memorize this shape)

One pattern, three names — reused for dedup, SCD Type 2, and late-arriving-data logic:

```text
PySpark: Window.partitionBy(key).orderBy(ts.desc()) → row_number() → filter(row_num == 1)
T-SQL:   ROW_NUMBER() OVER (PARTITION BY key ORDER BY ts DESC) → WHERE row_num = 1
KQL:     summarize arg_max(ts, *) by key
```

---

## Denormalization (join-and-flatten) Primitives

| Language | Primitive | Notes |
| :--- | :--- | :--- |
| PySpark | `.join(broadcast(dim), ...)` | `broadcast()` for small dim tables — avoids shuffling the large fact table |
| T-SQL | `CTAS ... JOIN ... JOIN ...` | Materializes flattened result as a new gold table in one statement |
| KQL | `\| lookup kind=leftouter (dim) on key` | Purpose-built fact/dim enrichment, chainable across multiple dimensions |

> [!warning] `lookup` assumes the **left** side is the large fact table and broadcasts the **right** (small dimension) — the opposite size assumption from `join`'s default (which assumes the left side is smaller). Only `leftouter`/`inner` supported for `lookup`.

## T-SQL-Specific Notes

- `MERGE` is ==GA== in Fabric Warehouse — not preview, despite being a known gap in early previews.
- `IDENTITY` columns are ==Preview only==, `bigint`-only, no custom seed/increment, can't `ALTER TABLE ADD` — `ROW_NUMBER()` remains the GA-safe surrogate-key default.
- `#temp` tables: distributed (`WITH (DISTRIBUTION = ROUND_ROBIN)`) recommended over default non-distributed; global temp tables (`##table`) **not supported**.
- `COPY INTO` supports `FILE_TYPE = 'CSV'|'JSONL'|'PARQUET'` only — no `ORC` (unlike Synapse dedicated pools).
- `PRIMARY KEY`/`FOREIGN KEY`/`UNIQUE` are `NOT ENFORCED` — optimizer hints only, don't block bad data.

## PySpark-Specific Notes

- `broadcast()` only for the *small* side — broadcasting a large table causes `OutOfMemoryError`, not speedup.
- `dropDuplicates()` never guarantees which duplicate survives — use the window pattern when "which one wins" matters.
- `partitionBy()` on write is physical folder layout (pruning), not an in-memory partition count control; partition on low-cardinality columns only.

## KQL-Specific Notes

- Update policies = transform-on-ingest (any reshaping, triggered per-ingest); materialized views = continuous **aggregation** only, always GA-fresh. They solve different problems.
- Update policy queries must reference the source table **unqualified** — no `database()`/`cluster()` prefix.
- `IsTransactional: true` on an update policy rolls back source ingestion if the transform query fails.

---

## Gotchas & Traps

- `ISNULL` (T-SQL) is 2-arg and types its result from the **first** argument — can silently truncate; `COALESCE` is ANSI, N-args, standard type precedence. Prefer `COALESCE`.
- `dropDuplicates`/`DISTINCT`/`take_any` are all non-deterministic — safe only for byte-for-byte identical duplicates, never for "keep the latest version."
- Filtering before vs. after aggregation is not interchangeable in any language: `WHERE`/pre-`agg().filter()`/pre-`summarize where` narrows raw rows; `HAVING`/post-`agg().filter()`/post-`summarize where` narrows aggregated groups.
- `lookup`'s broadcast assumption is the mirror image of `join`'s — mixing them up on a huge dimension table crashes the query.
- KQL has no native `MERGE` statement — upsert-shaped requirements route through update policies or materialized-view dedup instead.
- A watermark never rejects late data from the source stream — it only bounds how long window/dedup *state* is retained before that specific window's result stops reflecting late arrivals.

## Before the Exam, I Can…

- [ ] Write the "latest record per key" pattern from memory in all three languages
- [ ] Explain why `ISNULL` is riskier than `COALESCE` and name the type-precedence difference
- [ ] State which windowing constructs KQL lacks natively and how to approximate them
- [ ] Explain the opposite broadcast-size assumption between KQL `join` and `lookup`
- [ ] Recite the `MERGE` GA status and the `IDENTITY` preview limitations in Fabric Warehouse
- [ ] Distinguish update policy vs. materialized view by the problem each solves
- [ ] Explain why filtering before vs. after aggregation gives different results in every language

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
