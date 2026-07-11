---
title: "Practice Questions: Ingest and Transform Data"
type: practice-questions
tags:
  - dp-700
  - practice-questions
  - ingest-transform
---

# Practice Questions: Ingest and Transform Data

Domain 2 covers 30–35% of the DP-700 exam and spans four sections: loading patterns, batch ingestion, batch transformation, and streaming data. This is the exam's heaviest scenario domain, so most of these 28 questions describe a situation and ask you to pick the right tool or pattern — several also hand you a PySpark, T-SQL, or KQL snippet and ask what it actually does. None of them repeat the inline practice questions already embedded in the topic files, so treat a miss here as a signal to go re-read the linked section.

---

## Question 1: A Small, Untracked Reference Table

**Question** *(Easy)*:

A `ref.CurrencyRate` table has 300 rows and updates unpredictably a few times a month from a source with no modified-date column and no change tracking. Reloading it in full takes under a second. Which load strategy fits, and why isn't a watermark worth building for it?

A. Full load — the table is small, the source has no reliable change-tracking signal, and the reload cost is negligible  
B. Incremental load — even without change tracking, a watermark can always be inferred from row-count changes  
C. Incremental load using a hash of each row as a pseudo-watermark, since real change tracking is unavailable  
D. Mirroring instead of a pipeline load, since the table changes unpredictably  

> [!success]- Answer
> **A. Full load — the table is small, the source has no reliable change-tracking signal, and the reload cost is negligible**
>
> This is the textbook case for a full load: small volume and no trustworthy change-tracking signal on the source. Engineering a watermark control table for a sub-second reload buys nothing.
>
> Option B invents a mechanism — row-count changes don't tell you *which* rows changed, so they can't drive an incremental extract. Option C invents a "hash pseudo-watermark" that isn't a documented change-detection option (modified-date, CDC-fed, and mirroring-fed are the three real options, and none apply here). Option D reaches for mirroring, a tool for continuously replicating a whole supported operational database, not a general substitute for a small pipeline-loaded reference table.

---

## Question 2: A Watermark Stored in a Pipeline Variable

**Question** *(Medium)*:

A developer implements an incremental load by storing the watermark in a pipeline variable that resets to a default value every time the pipeline starts, instead of in a durable control table. The pipeline runs successfully for a week, then the workspace undergoes a routine redeploy. What happens on the next run?

A. The pipeline variable persists across redeploys since Fabric caches pipeline state indefinitely  
B. The watermark resets to its default value on the next run  
C. The redeploy automatically migrates the pipeline variable into a durable control table  
D. Nothing changes — pipeline variables and control tables are functionally interchangeable for this purpose  

> [!success]- Answer
> **B. The watermark resets to its default value on the next run**
>
> A pipeline variable isn't durable across runs. A watermark has to live somewhere that survives across runs and failures — a control table, not application-local state like a pipeline variable. A redeploy (or any event that reinitializes the variable) silently snaps the watermark back to its default, and the next incremental extract runs against the wrong starting point.
>
> Option A invents indefinite pipeline-state caching that doesn't exist for variables. Option C invents an automatic migration mechanism. Option D denies the entire reason the watermark pattern insists on a durable control table in the first place.

---

## Question 3: Reloading a Single Day's Partition

**Question** *(Medium)*:

A nightly job receives a complete, self-contained extract of one calendar day's sales and needs to safely re-run after a partial failure, without engineering a `MERGE INTO` keyed upsert. A developer writes:

```python
(spark.read.table("staging.daily_sales")
    .write.format("delta")
    .mode("overwrite")
    .option("replaceWhere", "sales_date = '2026-07-10'")
    .saveAsTable("fact.sales"))
```

Is this correct?

A. This is incorrect — `overwrite` always replaces the whole table regardless of `replaceWhere`, wiping out every other day's data  
B. This is incorrect — `replaceWhere` requires a `MERGE INTO` to take effect; plain `overwrite` ignores it  
C. This is correct — `replaceWhere` scopes the overwrite to the day's partition, so a re-run after a failure reproduces the same end state  
D. This is correct, but only because Delta automatically deduplicates append-mode writes underneath `overwrite`  

> [!success]- Answer
> **C. This is correct — `replaceWhere` scopes the overwrite to the day's partition, so a re-run after a failure reproduces the same end state**
>
> `overwrite` with `replaceWhere` scoped to the day's partition is idempotent, because the end state depends only on that partition's source data, not on how many times the write runs. `replaceWhere` scopes the overwrite to matching partitions instead of the whole table, and because the source extract is a complete, self-contained day, re-running the write after a failure produces the same end state every time — no `MERGE INTO` required.
>
> Option A misreads what `replaceWhere` does — it exists precisely to prevent a full-table wipe. Option B has the mechanism backward: `replaceWhere` is a modifier on `overwrite` itself, not something that requires `MERGE INTO`. Option D is a non sequitur — this write uses `mode("overwrite")`, not `append`, so append's dedup behavior (or lack of it) is irrelevant here.

---

## Question 4: Retrofitting IDENTITY onto an Existing Table

**Question** *(Hard)*:

A team has an existing `dim.Store` table with 50,000 rows and tries to retrofit a surrogate key column with:

```sql
ALTER TABLE dim.Store ADD StoreKey BIGINT IDENTITY;
```

What happens, and what's the correct fix?

A. The statement succeeds — `ALTER TABLE ADD` fully supports adding `IDENTITY` columns to existing Fabric Warehouse tables  
B. The statement succeeds, but only populates `StoreKey` for rows inserted after the `ALTER TABLE` runs, leaving existing rows `NULL`  
C. The statement fails because `IDENTITY` requires an explicit custom seed and increment to be specified  
D. The statement fails — Fabric Warehouse's Preview `IDENTITY` can't be retrofitted via `ALTER TABLE`; it must be declared at `CREATE TABLE` time  

> [!success]- Answer
> **D. The statement fails — Fabric Warehouse's Preview `IDENTITY` can't be retrofitted via `ALTER TABLE`; it must be declared at `CREATE TABLE` time**
>
> Fabric Warehouse's Preview `IDENTITY` support can't be added to an existing table via `ALTER TABLE`; rebuild the table with `CTAS`/`SELECT...INTO` including `IDENTITY` at creation, or generate a `ROW_NUMBER()`-based key instead. `IDENTITY` in Fabric Warehouse is documented Preview functionality with real limitations, one of which is that it must be defined at `CREATE TABLE` time — it cannot be retrofitted onto an existing table via `ALTER TABLE`. The fix is a CTAS/`SELECT...INTO` rebuild with `IDENTITY` declared up front, or falling back to the GA-safe `ROW_NUMBER()` + max-key-offset pattern.
>
> Option A describes a capability Fabric Warehouse's `IDENTITY` doesn't have. Option B invents a partial-population behavior that isn't how the failure manifests — the statement doesn't partially succeed. Option C names a real `IDENTITY` limitation (no custom seed/increment) but misapplies it as the cause of *this* specific failure, which is actually the `ALTER TABLE ADD` restriction.

---

## Question 5: A Broken SCD Type 2 mergeKey Pattern

**Question** *(Medium)*:

A PySpark SCD Type 2 implementation is supposed to union two DataFrames — `changed` (rows whose current version changed, tagged with `NULL` as `merge_key`) and every staged row (tagged with its real business key as `merge_key`) — before the `MERGE INTO`. A developer removes the union and merges only `changed` directly:

```python
# changed = rows whose current version actually changed (real business key as merge_key)
(customers.alias("customers")
    .merge(changed.alias("staged"), "customers.customer_business_key = staged.merge_key")
    .whenMatchedUpdate(...)
    .whenNotMatchedInsert(...)
    .execute())
```

What breaks?

A. Brand-new customer keys (rows with no existing dimension row at all) never get inserted  
B. Nothing breaks — the union step was only a performance optimization  
C. The `MERGE INTO` fails outright with a syntax error  
D. Every row is treated as `whenMatchedUpdate`, since `changed` contains no unmatched rows by construction, which is the correct behavior anyway  

> [!success]- Answer
> **A. Brand-new customer keys (rows with no existing dimension row at all) never get inserted**
>
> `changed` only contains rows that already matched an existing current row, and there's no `NULL`-merge-key row left to force a `whenNotMatchedInsert` for a genuinely new key. The `NULL`-merge-key trick exists specifically so a row can never match an existing row and is therefore forced into `whenNotMatchedInsert`. `changed` was derived by joining staged updates against the *existing* current customers — a brand-new business key with no existing row at all was never part of that join, so removing the union that adds every staged row (keyed by its real business key) silently drops new-customer inserts entirely.
>
> Option B mistakes a correctness-critical step for an optional optimization. Option C is wrong — the query runs without error, it just produces the wrong result silently. Option D correctly observes that `changed` contains only rows that matched, but wrongly calls the resulting silent-drop behavior "correct."

---

## Question 6: Sorting Three Late-Arriving Scenarios

**Question** *(Hard)*:

A team faces three situations in the same week: (1) a batch load's watermark-based extract missed a row updated just after the last read, (2) a nightly fact load references a product key with no dimension row yet, and (3) a streaming pipeline receives an event 20 minutes after its window's watermark tolerance expired. Which pattern correctly resolves situation (2)?

A. Advance the watermark past the missing product key and reconcile later  
B. Insert an inferred-member stub dimension row for the missing product key  
C. Widen the streaming watermark tolerance so the product dimension catches up  
D. Reject the fact row until the dimension record arrives, to preserve referential integrity  

> [!success]- Answer
> **B. Insert an inferred-member stub dimension row for the missing product key**
>
> Situation (2) is a late-arriving *dimension*, which is the inferred-member pattern's exact use case: stub a placeholder dimension row, flagged `IsInferred = 1`, so the fact load has a valid surrogate key and isn't blocked, then update that stub in place (SCD1-style, not a new SCD2 version) once the real dimension record shows up.
>
> Option A conflates this with situation (1)'s watermark problem — advancing a watermark has nothing to do with a missing dimension key. Option C conflates it with situation (3)'s streaming-watermark problem, which is unrelated to a batch fact-to-dimension lookup. Option D describes blocking the load, which the inferred-member pattern exists specifically to avoid.

---

## Question 7: A Streaming Bronze Layer That's Already Deduplicating

**Question** *(Medium)*:

A developer, worried about downstream duplicate rows, adds `.dropDuplicates(["event_id"])` directly to a new IoT pipeline's bronze streaming write, before landing in `bronze.raw_events`. The team's requirement is that bronze stay a complete, replayable record of every event exactly as received, so a downstream bug fix can reprocess from raw. What's wrong with deduping at this layer, and where should the fix belong instead?

A. Nothing — dedup at bronze only lowers storage cost and has no effect on replayability  
B. `dropDuplicates` always throws an exception unless it's applied at the bronze layer specifically  
C. It silently drops raw duplicate events before they're ever landed, breaking the replay-from-raw guarantee  
D. Dedup is fine at bronze, but only once `outputMode("complete")` replaces `outputMode("append")`  

> [!success]- Answer
> **C. It silently drops raw duplicate events before they're ever landed, breaking the replay-from-raw guarantee**
>
> Bronze's entire purpose is to be the raw, replayable record of what arrived. Filtering rows out at the streaming write — even ones that look like duplicates — means they're never landed at all, so a later bug fix (or a reason to reconsider what counts as a "duplicate") has nothing to reprocess from. Dedup belongs at silver instead, paired with a `withWatermark` call, exactly as documented for the medallion streaming pattern.
>
> Option A dismisses a real correctness risk as a mere storage optimization — replayability is the actual thing lost. Option B invents a runtime exception `dropDuplicates` doesn't have; it runs fine at any layer, it just shouldn't run at this one. Option D invents a mode-based exception with no basis — `outputMode("complete")` requires an aggregation and has nothing to do with whether dedup belongs at bronze.

---

## Question 8: An Inventory App Needing Both OLTP and Analytics

**Question** *(Medium)*:

A team is building a new inventory-management application that needs strict foreign-key-enforced transactional writes at high concurrency, plus a requirement that the warehousing team build Power BI reports over the same data within minutes of a change — without standing up a separate ETL pipeline. Which Fabric data store fits?

A. Lakehouse, because its SQL analytics endpoint can serve Power BI reports  
B. Warehouse, because it supports full T-SQL DML  
C. Eventhouse, because it supports near-real-time data availability  
D. Fabric SQL database  

> [!success]- Answer
> **D. Fabric SQL database**
>
> Its OLTP engine supports the transactional workload and it automatically mirrors into OneLake for pipeline-free analytics. Every signal — high-concurrency transactional writes, enforced foreign keys, and analytics on the same data without building a pipeline — points to Fabric SQL database. It's Fabric's OLTP engine, and its distinguishing trait for this scenario is automatic, zero-ETL mirroring into OneLake.
>
> Option A's lakehouse has no OLTP transactional-write model at all. Option B's warehouse supports full DML but isn't built for high-concurrency OLTP application workloads with enforced foreign keys. Option C's eventhouse is a streaming/time-series engine, not a transactional application backend.

---

## Question 9: Following the Decision Spine From Store to Transform Tool

**Question** *(Medium)*:

A team lands raw sensor data in an Eventhouse and needs to decide which language surface to use for both continuous transformation and any downstream reshaping of that same data, without introducing a second data store. Per the Domain 2 decision spine (data store determines native transform surface), which combination is correct?

A. KQL for both continuous transformation (update policy/materialized view) and any downstream reshaping of that same data  
B. PySpark for transformation, T-SQL for streaming ingestion  
C. T-SQL for transformation, since every Fabric data store — including Eventhouse — exposes full DML through its SQL analytics endpoint  
D. Dataflow Gen2 for transformation, since it has the broadest connector library  

> [!success]- Answer
> **A. KQL for both continuous transformation (update policy/materialized view) and any downstream reshaping of that same data**
>
> Eventhouse's native transform surface is KQL and its T-SQL endpoint is read-only. The decision spine's point is that once you've named the data store, the transform tool mostly follows: land data in an Eventhouse and transformation happens natively via KQL update policies and materialized views. Introducing a second store just to get a different transform surface contradicts the stated constraint.
>
> Option B reaches for PySpark and T-SQL, neither of which is Eventhouse's native write/transform surface (Spark isn't a natural fit here, and T-SQL against Eventhouse is read-only). Option C's claim that "every store exposes full DML through its SQL analytics endpoint" is directly false — lakehouse and eventhouse endpoints are both read-only. Option D's Dataflow Gen2 doesn't target Eventhouse-native transform-on-ingest at all.

---

## Question 10: A Partner Feed That Needs Transformation Before It's Useful

**Question** *(Medium)*:

A partner organization exposes a Snowflake data warehouse, and a team needs the partner's `orders` and `customers` tables reshaped (joined, deduplicated, and converted into a star schema) before landing in a gold lakehouse — the source data can't be consumed as-is. Which approach fits, and why do the alternatives fall short?

A. Database mirroring — it replicates continuously and mirroring supports Snowflake  
B. Pipeline copy (Copy activity/Copy job) feeding a transformation step  
C. A shortcut — shortcuts eliminate the need for any pipeline  
D. Metadata mirroring, since Snowflake is a catalog-based system  

> [!success]- Answer
> **B. Pipeline copy (Copy activity/Copy job) feeding a transformation step**
>
> The requirement needs real reshaping (joins, dedup, format conversion) that neither mirroring (a passive replica) nor a shortcut (a live pointer, no transformation) can provide. The decision funnel resolves this by elimination: mirroring produces a passive, whole-database replica with no reshaping; a shortcut is a live pointer that exposes the source as-is. Neither performs the joins, dedup, and star-schema conversion the requirement explicitly demands, so pipeline-based copy feeding a transform step is the only fit.
>
> Option A is a real mirroring-supported source, but mirroring doesn't reshape data — it replicates it unchanged. Option C misreads what shortcuts do; they reference data in place, they never transform it. Option D is wrong on the facts — metadata mirroring applies to catalog-based systems like Unity Catalog and Dremio, not Snowflake, which uses database mirroring when mirrored at all.

---

## Question 11: A Shortcut That Shows Up but Can't Be Queried

**Question** *(Medium)*:

A data engineer creates an internal OneLake shortcut in `SalesLakehouse` pointing at tables in `FinanceWarehouse`. A BI analyst who has access to `SalesLakehouse` but no permissions on `FinanceWarehouse` tries to query the shortcut and gets an authorization error, even though the shortcut itself is visible. What's the correct explanation?

A. The shortcut is broken and needs to be recreated  
B. Shortcuts require the creator's identity to be delegated on every query, and the creator's permissions have expired  
C. Internal shortcut permission checks use the calling user's own identity against the shortcut's target  
D. The analyst needs Reshare permission on the shortcut object itself  

> [!success]- Answer
> **C. Internal shortcut permission checks use the calling user's own identity against the shortcut's target**
>
> The analyst needs their own permission on `FinanceWarehouse`, not just visibility of the shortcut. Creating a shortcut doesn't grant access to its target. Internal shortcuts authorize using the calling user's own identity against the target location, so the analyst — who can see the shortcut but has no permission on `FinanceWarehouse` — correctly hits an authorization error until they're granted access on the target itself.
>
> Option A is wrong — this is expected, documented behavior, not a broken shortcut. Option B describes the delegated-identity exception that applies only to Direct Lake over SQL / Delegated identity mode for semantic models, not to a direct query against a shortcut. Option D confuses item-level Reshare permission (letting someone reshare a specific item) with the separate concept of needing real access on the shortcut's target.

---

## Question 12: Selected-Table Incremental Sync vs. Whole-Database Replication

**Question** *(Hard)*:

A team needs only two tables — `orders` and `order_lines` — synced incrementally (including deletes) from an on-premises SQL Server instance with CDC enabled, into a specific Lakehouse folder structure that also holds several unrelated engineered tables. They don't want the entire source database replicated into OneLake. Which approach fits, and why is database mirroring the wrong choice here even though CDC is involved?

A. Database mirroring — CDC-based sources always imply mirroring is the right tool  
B. Metadata mirroring, since it avoids duplicating data entirely  
C. Open mirroring, since the source already has CDC enabled  
D. Copy job with CDC-based incremental copy, targeting only the two required tables  

> [!success]- Answer
> **D. Copy job with CDC-based incremental copy, targeting only the two required tables**
>
> Mirroring replicates an entire supported database as a dedicated OneLake replica, not a selective subset of tables into an existing item's folder structure. Copy job's CDC-based incremental copy mode is purpose-built for exactly this shape: selected tables, deletes included, synced to a chosen destination on a schedule or trigger — distinct from mirroring, which creates a whole-database, dedicated OneLake replica rather than landing selected tables inside an existing item alongside unrelated engineered tables.
>
> Option A treats "CDC" as automatically implying mirroring, ignoring that mirroring's scope is a whole database, not a two-table subset. Option B misapplies metadata mirroring, which is scoped to catalog-based sources like Unity Catalog and Dremio, not SQL Server. Option C's open mirroring is for a custom application writing its own change data to a landing zone per spec — not the right fit when a purpose-built CDC connector (via Copy job) already exists for SQL Server.

---

## Question 13: Parallel Copy With No Partitioning Configured

**Question** *(Medium)*:

A Copy activity reads a 3 TB Azure SQL Database table with **Degree of copy parallelism** set to 16, but **Partition option** left at its default. The source read still runs single-threaded and throughput doesn't improve. What's the fix?

A. Enable a Partition option on the source  
B. Increase Degree of copy parallelism further, all the way to 32  
C. Switch the sink's Write behavior from Insert mode to Upsert mode  
D. Enable staging so the copy routes through an interim storage location first  

> [!success]- Answer
> **A. Enable a Partition option on the source**
>
> Parallelism only applies once the source read itself is split into partitions — via a Partition option such as Physical partitions of table or Dynamic range. Degree of copy parallelism and Partition option are two separate settings that work together — parallelism has nothing to parallelize until the source read itself is split via a Partition option. Leaving Partition option at `None` means the source is read single-threaded regardless of how high parallelism is set.
>
> Option B doubles down on the setting that isn't the bottleneck. Option C's Write behavior controls sink-side insert/upsert semantics, unrelated to source-read parallelism. Option D's staging is an interim storage hop, not a mechanism for splitting the source read into parallel partitions.

---

## Question 14: Incremental Sync From a Database, Not a Storage Account

**Question** *(Hard)*:

A T-SQL-first team needs to incrementally sync a 40-table Azure SQL Database into a Warehouse, using a `ROWVERSION` column for change tracking, without hand-building a watermark control table per table. The source is a live database, not files sitting in Azure storage. Which tool fits, and why is `COPY INTO` not usable here?

A. `COPY INTO`, since it's the fastest T-SQL-native load path  
B. Copy job, using its native `ROWVERSION`-based watermark tracking  
C. Dataflow Gen2, since it has the broadest connector coverage  
D. Database mirroring, since Azure SQL Database is a supported mirroring source  

> [!success]- Answer
> **B. Copy job, using its native `ROWVERSION`-based watermark tracking**
>
> `COPY INTO` only loads from external Azure storage (ADLS Gen2/Blob) holding files, not directly from a live database source; mirroring would instead create a separate whole-database replica rather than syncing into the team's existing Warehouse tables. Copy job natively tracks incremental state on `ROWVERSION`, datetime, date, integer, or string-interpreted-as-datetime columns, managing the "last successful run" automatically across all 40 tables — exactly what "no hand-built watermark table" calls for. `COPY INTO`'s source must be external Azure storage holding files, which rules it out for a live database source.
>
> Option A misapplies `COPY INTO` to a source type it doesn't support. Option C's Dataflow Gen2 has the broadest connector count but is a transformation-first, Power Query-based tool, not a native CDC/watermark incremental-copy mechanism for a T-SQL-first team. Option D's mirroring is a real option for this source, but it produces its own dedicated OneLake replica rather than syncing directly into the team's existing Warehouse tables the way Copy job does.

---

## Question 15: Caching a Shortcut to Dataverse

**Question** *(Easy)*:

A workspace has an external shortcut pointing at a Dataverse table and enables shortcut caching in Workspace Settings, expecting reduced latency on repeat reads. What happens?

A. Caching works normally — Dataverse is a fully supported caching source  
B. Enabling caching on an unsupported source breaks the shortcut  
C. Caching has no effect  
D. Caching works, but only for files under 1 GB  

> [!success]- Answer
> **C. Caching has no effect**
>
> Dataverse isn't on the supported caching source list (only GCS, S3, S3-compatible, and on-premises gateway shortcuts are cached). Shortcut caching's supported-source list is explicit: GCS, S3, S3-compatible, and on-premises gateway shortcuts. Dataverse isn't on it, alongside ADLS Gen2, Azure Blob Storage, and internal shortcuts. Toggling the workspace-level caching setting doesn't error for an unsupported shortcut — it simply has no effect.
>
> Option A misstates the supported-source list. Option B invents a failure mode that doesn't occur — the toggle is a no-op for unsupported sources, not a breaking change. Option D applies the real 1 GB per-file caching limit to the wrong axis — that limit governs which *files* get cached on a *supported* source, not whether an unsupported source gets cached at all.

---

## Question 16: A Warehouse-Resident MERGE Requirement

**Question** *(Medium)*:

A team's star schema already lives entirely inside a Fabric Warehouse, and the nightly load upserts dimension rows using `MERGE`. The team has no Spark or Power Query experience. Which transform tool is the obvious fit?

A. Dataflow Gen2, since it's the lowest-code option available  
B. Notebook (PySpark), since Spark can technically do anything  
C. KQL, since Eventhouse also supports MERGE-like update policies  
D. T-SQL, since `MERGE` is a first-class GA T-SQL feature here  

> [!success]- Answer
> **D. T-SQL, since `MERGE` is a first-class GA T-SQL feature here**
>
> Every signal — warehouse-resident data, a `MERGE`-based upsert requirement, and zero Spark/Power Query experience — points directly at T-SQL. `MERGE` is generally available in Fabric Warehouse, so there's no capability gap forcing a different tool.
>
> Option A ignores that the team has no low-code preference stated and that Dataflow Gen2 isn't the natural home for warehouse-resident `MERGE` logic. Option B's notebook is technically capable but adds an unfamiliar language for no functional gain. Option C's KQL update policies operate inside Eventhouse on KQL-native tables — they don't apply to Warehouse-resident SQL data at all.

---

## Question 17: Which Row Survives dropDuplicates?

**Question** *(Medium)*:

A bronze table sometimes receives the same `event_id` twice with different `payload` values (a genuine re-send with updated data, not an exact duplicate). A notebook runs:

```python
deduped = df.dropDuplicates(["event_id"])
```

What should the team expect, and what's the fix if they need to keep the most recently ingested version?

A. `dropDuplicates` keeps an arbitrary surviving row when duplicates differ, not the latest  
B. `dropDuplicates` always keeps the first-ingested row, so no fix is needed if "first" is acceptable  
C. `dropDuplicates` throws an exception when duplicate keys have different values  
D. `dropDuplicates` automatically merges the differing `payload` values into one row  

> [!success]- Answer
> **A. `dropDuplicates` keeps an arbitrary surviving row when duplicates differ, not the latest**
>
> `dropDuplicates` on a subset of columns doesn't guarantee which surviving row is kept when the non-key columns differ between duplicates. The deterministic fix — used throughout dedup, SCD Type 2, and "latest record" logic — is a `row_number()` window ordered by recency, filtered to the first row per key.
>
> Option B asserts a "keeps first" guarantee that `dropDuplicates` doesn't document or provide. Option C invents an exception that doesn't occur — differing non-key values don't cause a failure, just non-deterministic survivor selection. Option D invents a merge behavior `dropDuplicates` has no concept of.

---

## Question 18: A Custom-Seeded IDENTITY Column

**Question** *(Medium)*:

A developer tries to create a new Fabric Warehouse table with:

```sql
CREATE TABLE dim.Region (
    RegionKey BIGINT IDENTITY(100, 1),
    RegionName VARCHAR(50)
);
```

What happens?

A. The table is created and `RegionKey` starts at 100, incrementing by 1  
B. This fails — Fabric Warehouse's Preview `IDENTITY` doesn't accept a custom seed or increment  
C. The table is created, but the seed/increment values are silently ignored and default to (1,1)  
D. This fails because `IDENTITY` requires the column to be `INT`, not `BIGINT`  

> [!success]- Answer
> **B. This fails — Fabric Warehouse's Preview `IDENTITY` doesn't accept a custom seed or increment**
>
> Fabric Warehouse's `IDENTITY` is Preview functionality with documented, real limitations — no custom seed or increment among them. `IDENTITY(100, 1)` names an explicit seed and increment, which isn't accepted; only plain `IDENTITY` with the default seed/increment is supported.
>
> Option A describes SQL Server-style behavior that doesn't carry over. Option C invents a silent-fallback behavior that doesn't match how the failure actually manifests. Option D has the type requirement backward — `IDENTITY` in Fabric Warehouse is `bigint`-only, so `BIGINT` is exactly the type it requires, not the problem.

---

## Question 19: A Migration Team Avoids MERGE

**Question** *(Hard)*:

A team migrating stored procedures from an older Fabric Data Warehouse preview environment believes `MERGE` is still unsupported, so they hand-roll every upsert as a separate `UPDATE` followed by an `INSERT...WHERE NOT EXISTS`. What should they be told, and what's the practical downside of their current approach?

A. They're correct — `MERGE` remains preview-only in Fabric Warehouse, so their approach is the right one  
B. Their approach is required regardless of `MERGE`'s support status, because `UPDATE`/`INSERT` pairs are always faster than `MERGE`  
C. `MERGE` is now generally available in Fabric Warehouse; their two-statement approach still works, just more error-prone  
D. `MERGE` was never unsupported in Fabric Warehouse at any point, so the team's belief has no historical basis  

> [!success]- Answer
> **C. `MERGE` is now generally available in Fabric Warehouse; their two-statement approach still works, just more error-prone**
>
> `MERGE` is documented as generally available in Fabric Warehouse — this was a genuine gap in early Fabric Data Warehouse previews, which is exactly the kind of "was this always true" trap the exam likes to test. The team's belief is outdated, though their hand-rolled approach isn't broken — it's just unnecessarily more error-prone than the GA `MERGE` statement it's standing in for.
>
> Option A repeats the team's outdated belief as if it were still correct. Option B invents a universal performance claim with no basis, and doesn't address the actual question of `MERGE`'s support status. Option D overcorrects — `MERGE`'s unavailability in early previews is real history, not a myth with "no basis"; what's outdated is applying that history to the current, GA state.

---

## Question 20: Consolidating Many Small SaaS Extracts Without a Data Engineer

**Question** *(Medium)*:

A marketing operations team pulls daily extracts from 40 different SaaS ad and CRM platforms, each landing under a few hundred MB, and needs to combine, clean, and reshape them before they reach a lakehouse. The team has no Spark or T-SQL experience and wants every transformation step to stay visually inspectable so a non-engineer can audit exactly what changed. Which transform tool fits, and why do the alternatives fall short?

A. Notebook (PySpark), since Spark's programmatic connectors can reach more SaaS sources than any low-code tool's connector library  
B. T-SQL, since the extracts can be staged into a Warehouse table and reshaped there with `MERGE` once landed  
C. KQL, since Eventhouse's update policies can ingest and reshape data from any external source, including SaaS APIs  
D. Dataflow Gen2, since its 150+ connector library and visual, low-code interface match both the team's skillset and the many-small-source profile  

> [!success]- Answer
> **D. Dataflow Gen2, since its 150+ connector library and visual, low-code interface match both the team's skillset and the many-small-source profile**
>
> No single extract is large enough to justify Spark's scale-out machinery, and the team has neither the Spark nor the T-SQL skills the other two options assume. Dataflow Gen2's 150+ connector library covers the long tail of SaaS sources directly, and its low-code, step-by-step Power Query authoring is exactly what "visually inspectable so a non-engineer can audit" calls for — the same breadth-of-small-sources-plus-self-service signal that makes Dataflow Gen2 the right tool over Spark's raw processing power.
>
> Option A correctly notes Spark's flexibility but ignores that the team has no Spark experience and that no single source is large enough to need Spark's scale-out at all. Option B invents a warehouse-resident data location the scenario never describes — the extracts land as SaaS pulls, not existing warehouse tables, and the team has no T-SQL skills either. Option C misapplies KQL, whose transformation surface is scoped to Eventhouse-resident, time-series-shaped data, not general SaaS batch consolidation into a lakehouse.

---

## Question 21: A Failing Update Policy Reference

**Question** *(Medium)*:

A KQL update policy's function is defined as:

```kusto
.create function ParseOrders() {
    database("SalesDB").RawOrders
    | extend Parsed = parse_json(Payload)
    | project OrderId = tostring(Parsed.orderId), Amount = todouble(Parsed.amount)
}
```

When this function is attached as an update policy's `Query` on a target table, what happens?

A. Validation fails — update-policy queries must reference the `Source` table unqualified, not through a `database()`-qualified path  
B. It works as expected — qualifying the source table with `database()` makes the reference more explicit and reliable  
C. It works, but only for the first ingested batch, since Fabric caches the resolved source-table reference for later update-policy runs  
D. It works, but doubles the ingestion latency because of the extra database lookup  

> [!success]- Answer
> **A. Validation fails — update-policy queries must reference the `Source` table unqualified, not through a `database()`-qualified path**
>
> Update-policy queries must reference the `Source` table unqualified (`RawOrders`, not `database("SalesDB").RawOrders`). Fabric requires update-policy queries (and any function they reference) to use the unqualified table name for the source table — a qualified reference like `database("SalesDB").RawOrders` isn't allowed there, even though it works fine in ad hoc queries.
>
> Option B assumes qualification is not just allowed but preferable, which is backwards for this specific context. Option C invents a "works once" behavior that isn't how the validation failure manifests. Option D invents a latency cost instead of the actual outcome, which is a validation failure, not a slow-but-working query.

---

## Question 22: A Silently Truncated Computed Fallback

**Question** *(Medium)*:

A nightly load computes a fallback ship date with `ISNULL(ship_date, DATEADD(DAY, 3, order_date))`, where `ship_date` is `DATE` but `order_date` is `DATETIME2(3)`, so the `DATEADD` expression itself evaluates to a `DATETIME2(3)` value carrying time-of-day precision. What happens, and what's the safer alternative?

A. No risk — `ISNULL` always returns whichever of its two argument types is wider  
B. `ISNULL` types its result from its first argument, silently discarding the fallback's time precision  
C. `ISNULL` and `COALESCE` behave identically here, since both ultimately represent calendar dates  
D. The failure is caused entirely by `DATEADD`'s return type, not by `ISNULL` itself  

> [!success]- Answer
> **B. `ISNULL` types its result from its first argument, silently discarding the fallback's time precision**
>
> `ISNULL` returns the data type of its first argument — here, `ship_date`'s `DATE` — so the computed `DATETIME2(3)` fallback is silently truncated to midnight, discarding whatever time-of-day precision `DATEADD` computed. `COALESCE(ship_date, DATEADD(DAY, 3, order_date))` resolves its result type using ANSI type-precedence across all arguments instead, so it returns the full `DATETIME2(3)` value rather than truncating it.
>
> Option A asserts an auto-widening behavior `ISNULL` doesn't have — it types from its first argument only, not the wider of the two. Option C denies a well-documented, real behavioral difference between the two functions. Option D misattributes the cause: `DATEADD` computes the correct, more-precise value; it's `ISNULL`'s first-argument typing rule that throws the precision away, not `DATEADD` itself.

---

## Question 23: Matching the Dedup Idiom to the Engine

**Question** *(Easy)*:

A source occasionally re-sends the same `ticket_id` with an updated `status` and a newer `last_updated` timestamp. Which T-SQL construct correctly keeps only the most recently updated version of each ticket?

A. `SELECT DISTINCT * FROM staging.tickets`, relying on exact full-row duplicate removal  
B. `SELECT TOP 1 * FROM staging.tickets GROUP BY ticket_id`, one arbitrary row per group  
C. `ROW_NUMBER()` partitioned by `ticket_id`, ordered by `last_updated DESC`, kept at row 1  
D. `MERGE` using only a `WHEN NOT MATCHED THEN INSERT` clause, with no matched-row branch  

> [!success]- Answer
> **C. `ROW_NUMBER()` partitioned by `ticket_id`, ordered by `last_updated DESC`, kept at row 1**
>
> `ROW_NUMBER()` partitioned by the key and ordered by recency, filtered to `1`, is the deterministic "keep latest" T-SQL idiom — it returns the full, most-recent row per key, unlike a non-deterministic or aggregate-only alternative.
>
> Option A's `SELECT DISTINCT` only removes exact full-row duplicates — it does nothing when `status` differs between re-sends. Option B is invalid syntax; `TOP` doesn't express "one row per group" combined with `GROUP BY` this way. Option D's `MERGE` clause only handles brand-new rows (`WHEN NOT MATCHED`) — it has no `WHEN MATCHED` clause to update an existing ticket, so it can't express "keep the latest version" at all.

---

## Question 24: An Ops Team Assumes Aggregation Needs Spark

**Question** *(Medium)*:

A three-person ops team wants to ingest server heartbeat events, count heartbeats per host in a 5-minute tumbling window, and land the result in a lakehouse for a monthly capacity report. There's no sub-second query requirement, and the team assumes the windowed count forces them into a Spark notebook, since they have no Spark experience and were hoping to avoid one. Which engine minimizes engineering effort, and why is the team's assumption wrong?

A. Spark Structured Streaming — the assumption is correct; windowed aggregation always requires custom code  
B. KQL/Eventhouse — wrong, but only because Eventhouse auto-aggregates at ingestion with zero configuration  
C. All three engines equally, since the aggregation step requires evaluating each one on its own merits  
D. Eventstream — the no-code Group by operator supports tumbling-window aggregation with no cluster to manage  

> [!success]- Answer
> **D. Eventstream — the no-code Group by operator supports tumbling-window aggregation with no cluster to manage**
>
> The team's assumption is wrong: Eventstream's Group by operator handles tumbling (and hopping, sliding, session) windows through the drag-and-drop canvas, with no custom code involved, and a Lakehouse destination lands the result with no cluster to size or manage. Every signal in the scenario — small team, no sub-second requirement, a monthly (not real-time) report — points to the lowest-overhead option, and windowed aggregation specifically isn't a reason to reach for Spark.
>
> Option A repeats the team's incorrect assumption as fact. Option B correctly rejects Spark but for an invented reason — Eventhouse doesn't auto-aggregate at ingestion with no configuration; it needs an explicit update policy or materialized view, and it's also the wrong destination here since nothing requires sub-second query latency. Option C avoids committing to an answer even though the scenario's requirements clearly point to one engine.

---

## Question 25: Routing Filtered CDC Output to a Custom Application

**Question** *(Medium)*:

A team ingests PostgreSQL CDC events with DeltaFlow enabled, needs to filter out events for a specific test schema, and route the filtered result to a custom application via a Kafka-compatible client. Since a custom endpoint destination doesn't support a pre-ingestion operator directly, what's the correct pipeline shape?

A. Filter operator → derived stream → custom endpoint destination attached to that derived stream  
B. Filter operator → custom endpoint destination directly  
C. Filter operator → Eventhouse (Direct ingestion) → custom endpoint queries the Eventhouse  
D. DeltaFlow itself performs the filtering, so no Filter operator is needed  

> [!success]- Answer
> **A. Filter operator → derived stream → custom endpoint destination attached to that derived stream**
>
> Only Lakehouse, Eventhouse (event processing before ingestion), Derived stream, and Activator support a pre-ingestion operator directly. A custom endpoint isn't on that list, so the Filter operator's output must first be materialized as a derived stream, and the custom endpoint attaches to that derived stream.
>
> Option B attaches the Filter operator directly to an unsupported destination, which isn't a valid configuration. Option C introduces an unnecessary Eventhouse hop and inverts the data-access pattern — the custom application would have to query Eventhouse instead of receiving a Kafka-protocol stream directly. Option D confuses DeltaFlow's role (shaping raw CDC JSON into analytics-ready columns) with filtering, which is an entirely separate, unrelated transformation.

---

## Question 26: An Upsert Attempted Directly on a Streaming Write

**Question** *(Medium)*:

A developer writes:

```python
(parsed.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/silver_customers")
    .outputMode("append")
    .toTable("silver.customers"))
```

...and expects new customer records to update existing rows by `customer_id`. What actually happens, and what's the fix?

A. It works as written — `outputMode("append")` automatically upserts on the target table's primary key  
B. Delta's native streaming sink only supports append (and, with restrictions, update/complete for aggregates)  
C. It fails immediately with a syntax error, since `append` mode is incompatible with `checkpointLocation`  
D. Switching `outputMode` to `"complete"` would fix it without needing `foreachBatch`  

> [!success]- Answer
> **B. Delta's native streaming sink only supports append (and, with restrictions, update/complete for aggregates)**
>
> It doesn't upsert on write; the fix is to use `foreachBatch` to run a Delta `MERGE` against each micro-batch instead. `MERGE INTO` isn't a native streaming sink write mode — writing directly with `.writeStream.format("delta")` never performs an upsert, regardless of output mode. The standard fix is `foreachBatch`, which hands each micro-batch to a regular batch DataFrame where a Delta `MERGE` (or any batch API) can run.
>
> Option A describes upsert behavior append mode has never had. Option C is wrong — `append` and `checkpointLocation` are entirely compatible; in fact `checkpointLocation` is mandatory for any production streaming write. Option D's `complete` mode requires an aggregation and rewrites the entire result table every trigger — it doesn't perform a keyed upsert either, and this query has no aggregation to begin with.

---

## Question 27: Auto-Enriching Accelerated ERP Reference Data

**Question** *(Medium)*:

A native Eventhouse table streams high-volume equipment-sensor readings, and the team wants every incoming reading enriched with a "maintenance zone" lookup from a small reference table mirrored from an ERP system into OneLake. To avoid duplicating the mirror's storage while still getting native-table-class join speed, they enable query acceleration on a OneLake shortcut to the reference table, then try attaching an update policy to the shortcut so every new reading is enriched automatically at ingestion. What happens, and what's the fix?

A. The update policy succeeds — acceleration converts the shortcut into a fully native table for every purpose  
B. The update policy succeeds, but only re-runs once per day on the accelerated shortcut's sync schedule  
C. Creating the update policy fails — it still behaves like an external table; enrich at query time instead  
D. Query acceleration only applies to materialized views, so this combination was never a valid attempt  

> [!success]- Answer
> **C. Creating the update policy fails — it still behaves like an external table; enrich at query time instead**
>
> Query acceleration closes the query-*performance* gap between a shortcut and a native table, but the accelerated shortcut still behaves like an external table for every other purpose — and update policies, like materialized views, only run against native tables. Creating one against the accelerated shortcut fails outright. The enrichment has to happen at query time instead — a `lookup` operator joining the fact stream against the shortcut directly — or the reference data has to be ingested natively into Eventhouse, which reintroduces the storage duplication the team was trying to avoid.
>
> Option A invents a "converts to native table" behavior acceleration doesn't have; the external-table limitations persist even after acceleration. Option B invents a daily sync schedule that isn't how accelerated shortcuts or update policies work. Option D is wrong on the specific limitation — materialized views and update policies are both unsupported on accelerated shortcuts, not just update policies being the exception.

---

## Question 28: Expressing a Hopping Window in KQL

**Question** *(Hard)*:

A team needs a rolling 10-minute average updated every 2 minutes (a hopping window) and initially writes this KQL, expecting it to work like the Spark equivalent `window(col("eventTime"), "10 minutes", "2 minutes")`:

```kusto
Telemetry
| summarize avg(Value) by DeviceId, hopping(Timestamp, 10m, 2m)
```

What's wrong with this query, and what's the correct approach?

A. Nothing is wrong — `hopping()` is KQL's direct equivalent of Spark's hopping window function  
B. The syntax is correct, but `hopping()` only works inside a materialized view, not an ad hoc query  
C. `hopping()` is valid KQL syntax but only for session-based data, not time-series telemetry  
D. KQL has no dedicated `hopping()` operator  

> [!success]- Answer
> **D. KQL has no dedicated `hopping()` operator**
>
> Hopping windows must be approximated using multiple `bin()` buckets at different offsets, or the preview SQL operator's Stream-Analytics-style hopping syntax. Unlike tumbling windows (`bin()`) and session windows (`row_window_session()`), KQL has no dedicated hopping-window function — `hopping()` isn't valid KQL syntax at all. The result is achieved by composing `bin()` at multiple offsets, or via the preview SQL operator's Stream-Analytics-style hopping construct, not a single named operator.
>
> Option A asserts a direct equivalent that doesn't exist in KQL's operator set. Option B and C both invent scoping restrictions (materialized-view-only, session-only) for a function that isn't valid KQL syntax in the first place — there's no context in which `hopping()` works as written.

---

**[← Back to Practice Questions](./practice-questions.md)**
