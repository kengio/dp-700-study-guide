---
title: "Streaming & Windowing — Quick Reference"
type: cheat-sheet
tags:
  - dp-700
  - cheat-sheet
  - streaming
  - eventstream
  - spark-structured-streaming
  - kql
  - windowing
---

# Streaming & Windowing — Quick Reference

Engine matrix, Eventstream operators/limits, Spark Structured Streaming output modes/triggers, KQL ingestion, and window-type × surface support. Condensed from [08-streaming-data](../../08-streaming-data/streaming-data.md) and [05-loading-patterns/03-streaming-loading-pattern](../../05-loading-patterns/03-streaming-loading-pattern.md).

> [!abstract] Quick Reference
>
> - Engine matrix: Eventstream / Spark Structured Streaming / KQL-Eventhouse (condensed)
> - Eventstream: 7 operators, 6 destinations, throughput/retention limits
> - Spark Structured Streaming: output modes × sinks, triggers, checkpointing, `foreachBatch`
> - KQL: streaming vs. queued ingestion, native tables vs. shortcuts
> - Window-type × surface support table; watermark rules

---

## Engine Matrix (condensed)

| Factor | Eventstream | Spark Structured Streaming | KQL / Eventhouse |
| :--- | :--- | :--- | :--- |
| Role | No-code ingest + in-flight transform + route | Code-first stream processing | Native real-time query engine + destination |
| Transform | 7 no-code operators, ==no arbitrary code== | ==Unbounded== — PySpark/Scala, UDFs, ML | KQL operator set |
| Query latency | ms–s in transit; destination decides | Micro-batch (seconds); not sub-second interactive | ==Sub-second to seconds== |
| Delivery | ==At-least-once== end to end | Exactly-once **at checkpoint-to-sink** (idempotent sink) | At-least-once at ingestion |

> [!note] Engines compose, not compete: `Source → Eventstream (filter/route) → [Spark: ML/complex joins] → Lakehouse` and `Eventstream → Eventhouse → sub-second dashboard` in the same pipeline.

---

## Eventstream: Operators, Destinations, Limits

### 7 No-Code Operators

| Operator | Does |
| :--- | :--- |
| Filter | Keep/drop by field condition |
| Manage fields | Add/remove/rename/retype; built-in functions |
| Aggregate | `sum`/`min`/`max`/`avg` per new event over a period |
| ==Group by== | Windowed aggregation — tumbling/hopping/sliding/session — the windowing workhorse |
| Union | Combine shared-name/type fields from 2+ streams |
| Expand | One row per array element |
| Join | Stream-to-stream join |

Plus a **SQL operator (preview)** for code-first stream logic. Only **Lakehouse, Eventhouse (event processing before ingestion), Derived stream, Activator** support a pre-ingestion operator directly — everything else (e.g., custom endpoint) needs a **derived stream** hop first.

### 6 Destinations

| Destination | Delivery |
| :--- | :--- |
| Custom endpoint | At-least-once, consumer handles idempotency |
| Eventhouse | Direct ingestion or event-processing-before-ingestion; at-least-once |
| Lakehouse | Delta write, at-least-once; needs downstream dedup for effectively-once |
| Spark Notebook (preview) | Inherits `writeStream` config |
| Derived stream | Pass-through, not a terminal sink |
| Activator | At-least-once; own rule evaluation |

A single eventstream fans out to **multiple destinations simultaneously** — a first-class pattern (content-based routing via derived streams).

### Limits

| Limit | Value |
| :--- | :--- |
| Max message size | ==1 MB== |
| Max retention | ==90 days== |
| Delivery guarantee | At-least-once (never "exactly-once" for Eventstream itself) |
| Combined source+destination cap (Custom endpoint source + Custom endpoint/Direct-ingestion Eventhouse destinations only) | 11 |
| Recommended min capacity | F4 |

9 database CDC connectors exist; **DeltaFlow (preview)** auto-shapes CDC JSON to table columns for Azure SQL DB, Azure SQL MI, SQL Server on VM, PostgreSQL CDC only.

---

## Spark Structured Streaming

### Output Modes × Sinks

| Mode | Requires aggregation? | Behavior |
| :--- | :---: | :--- |
| ==append== (default) | No | Only new rows; universally supported |
| complete | Yes | Full result table rewritten every trigger |
| update | Yes | Only changed rows rewritten |

> [!warning] `complete`/`update` on a non-aggregating query raises an analysis exception. Bronze/raw landing must use `append`.

### Triggers

| Trigger | Behavior |
| :--- | :--- |
| Default | Micro-batch, starts immediately after previous completes |
| `.trigger(processingTime="1 minute")` | Fixed-interval — fewer, larger, better-compacted files |
| `.trigger(availableNow=True)` | Bounded catch-up run, then stops |
| Continuous processing | Experimental — not the primary Fabric pattern |

### Mandatory Facts

- ==`checkpointLocation` is mandatory== for production — tracks offsets + committed batch IDs; one dedicated path per query, never shared across two queries.
- `MERGE` is **not** a native streaming sink write — use **`foreachBatch`** to run a batch `MERGE` per micro-batch.
- `.withWatermark(col, tolerance)` bounds state for dedup/windowed aggregation — without it, state (and `dropDuplicates`) grows unbounded.
- ==Native Execution Engine never supports Structured Streaming== — no per-operator fallback nuance, streaming always runs on standard JVM Spark regardless of NEE being enabled.
- Production streaming → **Spark job definitions** (not interactive notebooks) + a retry policy for resilience after infra failures.

---

## KQL / Eventhouse

### Ingestion Methods

| Factor | Streaming | Queued (default) |
| :--- | :--- | :--- |
| Path | Direct to Kusto via HTTP body | Blob-staged, then batched |
| Latency | ==Near-real-time== — sub-second to a few seconds | Seconds to low minutes |
| Best for | Small/frequent writes, many tables | High-volume, throughput/reliability-first |

### Native Tables vs. Shortcuts

| Option | Query speed | MV/update-policy support |
| :--- | :--- | :---: |
| Native table | Fastest, fully indexed | ✅ |
| Unaccelerated shortcut | Slowest — network round-trip | ❌ |
| Query-accelerated shortcut (GA) | Near-native | ==❌ still== |

Materialized views and update policies require **native tables only** — acceleration closes query-speed gap, never unlocks MV/update-policy support. Dedup on an accelerated shortcut must happen at query time (`arg_max`).

### Materialized View Dedup (Eventhouse's equivalent of watermark+dropDuplicates)

```kql
.create materialized-view DedupedEvents on table RawEvents
{
    RawEvents
    | summarize arg_max(ingestion_time(), *) by event_id
}
```

---

## Window-Type × Surface Support

| Window type | Eventstream (Group by) | KQL | Spark Structured Streaming |
| :--- | :--- | :--- | :--- |
| Tumbling | Native, no-code | `summarize <agg> by bin(ts, 5m)` | `window(col, "5 minutes")` |
| Hopping | Native, no-code | ==No dedicated operator== — approximate via `bin()` | `window(col, "5 minutes", "1 minute")` |
| Sliding | Native — emits on content change | Not a standing construct | No distinct API |
| Session | Native, set timeout | `row_window_session(...)` | `session_window(col, "10 minutes")` |
| Snapshot | Not a dedicated option | `summarize <agg> by Timestamp` (raw column) | `.groupBy("eventTime")` (raw column) |

## Watermark Rules

| Surface | Mechanism |
| :--- | :--- |
| Eventstream | Configurable late-arrival tolerance on Group by — events within tolerance still join an open window |
| Spark | `.withWatermark(col, tolerance)` — state dropped once tolerance elapses relative to max seen event-time |
| KQL | ==No standing watermark== — `bin()` re-evaluates against current table contents at query time |

> [!warning] Common Mistake — a watermark never rejects late data from the source stream. It only bounds how long window/dedup **state** is retained; a late event just misses an already-finalized window's result, it isn't dropped from the underlying data.

## Medallion Applied to Streams

| Layer | Role | Technology |
| :--- | :--- | :--- |
| Bronze | Raw, append-only | Eventstream → Lakehouse Delta or raw Eventhouse table |
| Silver | Cleansed, ==deduplicated== | Spark watermark+`dropDuplicates`, or Eventhouse update policy |
| Gold | Aggregated, business-level | Scheduled `MERGE` (`foreachBatch`), or KQL materialized view |

Streaming writes to Delta default to `append`; upsert/aggregation always happens **downstream**, never in the streaming write itself.

---

## Gotchas & Traps

- Eventstream is at-least-once everywhere — "exactly-once" only ever describes a downstream sink's idempotent-write behavior (Delta checkpoint-to-sink, or KQL dedup), never Eventstream's own delivery contract.
- A pre-ingestion operator can't attach to every destination — custom endpoint (and similar) needs a derived stream as an intermediate hop.
- `outputMode("complete"/"update")` requires an aggregation; attaching either to a non-aggregating query throws an analysis exception.
- `MERGE` fails when called directly on a streaming DataFrame — always route upserts through `foreachBatch`.
- The Native Execution Engine has zero involvement in Structured Streaming — enabling it at the environment level does nothing for a streaming job's throughput.
- Query-accelerated Eventhouse shortcuts still can't host materialized views or update policies — acceleration is a query-speed fix only.
- KQL has no dedicated hopping or sliding window operator — don't invent one; the real answer composes `bin()` variants.
- Checkpointing guarantees exactly-once at the Delta sink, not end-to-end — duplicate rows despite checkpointing point to a missing dedup step, not a checkpoint failure.

## Before the Exam, I Can…

- [ ] Match a streaming scenario to Eventstream / Spark Structured Streaming / KQL-Eventhouse and justify the choice
- [ ] Name the 7 Eventstream operators and which 4 destinations support pre-ingestion operators directly
- [ ] Choose the correct Spark output mode for a given aggregation/sink combination
- [ ] Explain why `checkpointLocation` is mandatory and what it tracks
- [ ] Explain why NEE never accelerates Structured Streaming
- [ ] Compare streaming vs. queued KQL ingestion and native tables vs. accelerated shortcuts
- [ ] Fill in the window-type × surface table from memory, including KQL's missing hopping/sliding operators
- [ ] Explain the watermark mechanism per surface and why late data isn't "rejected," just excluded from a finalized window

---

**[← Back to Cheat Sheets](./cheat-sheets.md)**
