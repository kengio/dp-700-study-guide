---
title: Streaming Data
type: category
tags:
  - dp-700
  - fabric
  - streaming-data
  - eventstream
  - spark-structured-streaming
  - kql
  - eventhouse
  - windowing
status: complete
---

# Streaming Data (Domain 2 · 30–35%)

Streaming data closes out Domain 2 with the exam blueprint's "implement streaming" family: choosing the right streaming engine, building event pipelines in Eventstream, streaming into a lakehouse with Spark Structured Streaming, landing and transforming events in real time with KQL/Eventhouse, and — the one topic that spans all three surfaces — windowing functions. This section leans hard into the guide's decision-matrix and side-by-side-language differentiators: every "choose the streaming engine/table type" bullet gets a matrix and a mental model, and windowing gets a single comparison table spanning Eventstream's no-code Group by, KQL's `bin()`/`summarize`/`row_window_session()`, and Spark's `window()`/`session_window()`.

---

## Quick Recall

```mermaid
mindmap
  root((Streaming Data))
    Choosing a Streaming Engine
      Eventstream = no-code ingestion, transform, routing
      Spark Structured Streaming = code-first, complex logic, Delta sink
      KQL/Eventhouse = telemetry, sub-second query, native time-series
      Matrix by source, latency, transform complexity, skill profile
    Eventstreams
      30+ sources incl. 9 CDC connectors, DeltaFlow for analytics-ready CDC
      7 no-code transforms: filter, manage fields, aggregate, group by, union, expand, join
      6 destinations: lakehouse, eventhouse, activator, derived stream, custom endpoint, Spark notebook
      At-least-once delivery, 1 MB max message, 90-day max retention
    Spark Structured Streaming
      readStream/writeStream, checkpointLocation required
      outputMode append/complete/update - sink support varies
      Triggers: default micro-batch, processingTime, availableNow, continuous - limited support
      Native Execution Engine does NOT support structured streaming - falls back to JVM
    KQL Real-Time
      Streaming ingestion = near-real-time vs queued ingestion = default, higher throughput
      Native tables vs OneLake shortcuts + query acceleration policy
      Update policies + materialized views = transform-on-ingest and continuous aggregation
      OneLake availability exposes Eventhouse data as Delta
    Windowing Functions
      Tumbling, hopping, sliding, session windows - same concepts, 3 syntaxes
      Eventstream Group by no-code / KQL bin plus summarize / Spark window function
      Session: KQL row_window_session / Spark session_window
      Watermarks bound late-data handling in Spark; Eventstream has late-arrival tolerance
```

---

## Topics Overview

```mermaid
flowchart TD
    Stream[Streaming Data] --> Engine[Choosing a Streaming Engine]
    Stream --> ES[Eventstreams]
    Stream --> Spark[Spark Structured Streaming]
    Stream --> KQLRT[KQL Real-Time]
    Stream --> Win[Windowing Functions]
    Engine --> Matrix[Eventstream vs Spark vs KQL/Eventhouse]
    ES --> Sources[Sources, Transforms, Destinations, Derived Streams]
    Spark --> RW[readStream/writeStream, Checkpointing, Triggers, Watermarks]
    KQLRT --> Tables[Native Tables vs Shortcuts, Query Acceleration, Update Policies]
    Win --> Compare[One Comparison Table: Eventstream + KQL + Spark]
```

## Section Contents

| File | Topic | Priority |
| :--- | :--- | :--- |
| [01-choosing-streaming-engine.md](01-choosing-streaming-engine.md) | The streaming-engine decision matrix — Eventstream vs. Spark Structured Streaming vs. KQL/Eventhouse by source type, transform complexity, latency, skill profile, destinations, windowing support, and scale model; distractor patterns | High |
| [02-eventstreams.md](02-eventstreams.md) | Eventstream sources (incl. CDC + DeltaFlow), the 7 event-processor transformations, 6 destinations and their delivery guarantees, derived streams, content-based routing, throughput/retention limits, Real-Time hub relationship | High |
| [03-spark-structured-streaming.md](03-spark-structured-streaming.md) | `readStream`/`writeStream` with Delta and Kafka/Event Hubs sources, output modes, triggers, checkpointing, watermarks and late data, `foreachBatch` upserts, streaming into lakehouse tables, Native Execution Engine limitation | High |
| [04-kql-realtime.md](04-kql-realtime.md) | Eventhouse ingestion (streaming vs. queued), native tables vs. OneLake shortcuts, query acceleration policy for shortcuts, update policies + materialized views for streaming transform, OneLake availability of Eventhouse data | High |
| [05-windowing-functions.md](05-windowing-functions.md) | Tumbling/hopping/sliding/session/snapshot windows conceptually, one comparison table across Eventstream/KQL/Spark, a worked 5-minute tumbling aggregate in all three syntaxes, choosing a window type per scenario, watermarks and late data | High |

## Key Concepts

- **The engine-choice bullet is about the whole pipeline, not just ingestion** — Eventstream, Spark Structured Streaming, and KQL/Eventhouse overlap in what they can ingest, but differ sharply in transform expressiveness, code requirement, and query latency at the destination
- **Eventstream's 7 no-code transforms cover most exam scenarios** — filter, manage fields, aggregate, group by (windowed), union, expand, join — with a SQL operator (preview) for anything that needs code-level control
- **The Native Execution Engine does not accelerate Structured Streaming** — a query that streams into a lakehouse always runs on the standard JVM Spark engine, regardless of whether NEE is enabled for the workspace
- **Query acceleration on a OneLake shortcut behaves like an external table** — no materialized views, no update policies; native Eventhouse tables are required for those transform-on-ingest mechanisms
- **Windowing is one concept with three syntaxes** — the exam rewards recognizing that a "5-minute tumbling aggregate" requirement maps to Eventstream's Group by operator, KQL's `summarize ... by bin(Timestamp, 5m)`, or Spark's `window("timestamp", "5 minutes")` depending on which engine the scenario names

## Related Resources

- [05-Loading Patterns](../05-loading-patterns/loading-patterns.md)
- [07-Batch Transformation](../07-batch-transformation/batch-transformation.md)
- [09-Monitoring & Alerting](../09-monitoring-alerting/monitoring-alerting.md)
- [Official: Microsoft Fabric Eventstreams overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/overview)
- [Official: Data streaming into a lakehouse with Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-streaming-data)
- [Official: Eventhouse overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [Official: DP-700 skills measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../07-batch-transformation/batch-transformation.md) | [↑ Back to Certification](../dp-700-overview.md) | [Next →](../09-monitoring-alerting/monitoring-alerting.md)**
