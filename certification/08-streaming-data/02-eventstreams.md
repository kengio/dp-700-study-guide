---
title: Eventstreams
type: topic
tags:
  - dp-700
  - fabric
  - streaming-data
  - eventstream
  - cdc
  - real-time-hub
  - derived-stream
---

# Eventstreams

## Overview

Eventstream is Fabric's no-code hub for bringing real-time events into Fabric, transforming them in flight, and routing them to one or more destinations. This topic covers the current source catalog (including the nine database CDC connectors and the DeltaFlow preview that makes CDC output analytics-ready), the seven event-processor transformation operators, the six supported destinations and their delivery guarantees, derived streams and content-based routing, the platform's throughput/retention limits, and how an eventstream relates to the tenant-wide Real-Time hub.

> [!abstract]
>
> - Eventstream ships with **30+ source connectors** as of this writing, spanning Azure services, database CDC (9 connectors), Kafka-compatible platforms, other clouds, and Fabric/Azure event sources — plus sample and weather data for testing
> - **7 no-code transformation operators** — Filter, Manage fields, Aggregate, Group by, Union, Expand, Join — cover most exam-relevant transform scenarios; a **SQL operator (preview)** exists for code-first stream logic
> - **6 destinations** — Custom endpoint, Eventhouse, Lakehouse, Spark Notebook (preview), Derived stream, Activator — and an eventstream can fan out to multiple destinations simultaneously
> - Fabric guarantees **at-least-once** event delivery, caps messages at **1 MB**, and retains event data for a maximum of **90 days**
> - Every eventstream, and every KQL table, automatically surfaces in the tenant-wide **Real-Time hub** — there's no separate registration step

> [!tip] What the Exam Tests
>
> - Recognizing which source connectors exist for a given scenario (especially the CDC family) and which are GA vs. preview
> - Matching a required transformation to the correct no-code operator, and knowing which operators require **Enhanced capabilities**
> - Choosing between **Direct ingestion** and **Event processing before ingestion** for an Eventhouse destination
> - Understanding derived streams as the mechanism for content-based routing and for exposing a transformed stream to the Real-Time hub

---

## Sources: Bringing Events into Fabric

Eventstream provides source connectors across several categories. **Enhanced capabilities** (enabled by default on new eventstreams) unlock more sources and let transformation operators feed every destination type, not just Lakehouse and Eventhouse.

| Category | Representative sources |
| :--- | :--- |
| **Azure messaging services** | Azure Event Hubs, Azure Event Grid (MQTT and non-MQTT), Azure Service Bus (queue or topic subscription), Azure IoT Hub |
| **Database CDC connectors** | Azure SQL Database CDC, Azure SQL Managed Instance CDC, SQL Server on VM CDC, PostgreSQL CDC, MySQL CDC, Azure Cosmos DB CDC, Oracle CDC *(preview)*, MongoDB CDC *(preview)*, Mirrored Database Change Feed *(preview)* |
| **Kafka-compatible platforms** | Apache Kafka, Confluent Cloud for Apache Kafka, Amazon Managed Streaming for Apache Kafka (MSK), Cribl *(preview)*, Solace PubSub+ *(preview)*, MQTT *(preview)* |
| **Other clouds** | Google Cloud Pub/Sub, Amazon Kinesis Data Streams |
| **Fabric and Azure events** | Fabric workspace item events, Fabric OneLake events, Fabric job events, Fabric capacity overview events *(preview)*, Azure Blob Storage events |
| **Custom / generic** | Custom endpoint (Kafka-protocol or connection-string clients), Azure IoT Operations, HTTP *(preview)* |
| **Test / demo** | Sample data (Bicycles, Yellow Taxi, Stock Market, Buses, S&P 500 companies stocks, Semantic Model Logs), Real-time weather, Azure Data Explorer database *(preview)*, Anomaly Detection events *(preview)* |

==As of this writing, nine database CDC connectors are available==, five of which support **DeltaFlow (preview)** — a capability that transforms raw Debezium-style CDC JSON into an analytics-ready tabular shape matching the source table, with automatic schema registration and destination-table management. DeltaFlow currently covers Azure SQL Database CDC, Azure SQL Managed Instance CDC, SQL Server on VM CDC, and PostgreSQL Database CDC.

> [!note] Mental model
> Without DeltaFlow, a CDC source hands you a **sealed envelope** — a nested Debezium JSON payload you have to `parse` open before it's queryable. DeltaFlow **opens the envelope for you at the door**, laying the contents out in columns that already match the source table, and it keeps relabeling the columns automatically if the source table's schema changes.

> [!warning] Common Mistake
> Assuming any CDC source connector automatically produces query-ready columns. Without DeltaFlow (or manual `parse`/`extract` transformation downstream), a CDC source's raw output is a nested JSON payload — the exam may describe a scenario where a team is "struggling to query raw CDC JSON," and the fix is enabling DeltaFlow (where supported) or adding a Manage fields/parsing transform, not switching source connectors entirely.

**Practice Question 1** *(Easy)*

A team needs to capture row-level changes from an on-premises SQL Server database running on a virtual machine and route them into Fabric with minimal custom parsing logic, since analysts want to query the changes as normal table-shaped rows. Which source setup fits best?

A. Azure Blob Storage events, since SQL Server can archive its transaction log to blob storage  
B. SQL Server on VM CDC connector with DeltaFlow enabled — DeltaFlow shapes the CDC output to match the source table automatically  
C. Custom endpoint, since SQL Server has no native CDC connector  
D. Fabric OneLake events, since the data will eventually land in OneLake anyway  

> [!success]- Answer
> **B. SQL Server on VM CDC connector with DeltaFlow enabled — DeltaFlow shapes the CDC output to match the source table automatically**
>
> SQL Server on VM has a purpose-built CDC connector, and it's one of the connectors DeltaFlow (preview) supports — enabling it avoids the nested-JSON-parsing step analysts would otherwise need to work through. Blob Storage events and OneLake events aren't CDC mechanisms; a custom endpoint would work but throws away the purpose-built connector's snapshot + change-tracking behavior for no reason.

## Event Processor Transformations

The event processing editor is a drag-and-drop, no-code canvas for building transformation logic between a stream node and a destination.

| Transformation | Description |
| :--- | :--- |
| **Filter** | Keeps or drops events based on a field's value and condition (`is null`, `is not null`, comparison operators, etc.) |
| **Manage fields** | Adds, removes, renames, or changes the data type of fields; supports built-in string/date-time/math functions for computed fields |
| **Aggregate** | Calculates `sum`/`min`/`max`/`avg` every time a new event occurs over a period, with renaming and dimension-based filtering/slicing; supports multiple aggregations per transform |
| **Group by** | Calculates aggregations across all events within a **time window** (tumbling, hopping, sliding, or session), grouped by one or more fields — the windowing workhorse, covered in depth in [05-Windowing Functions](./05-windowing-functions.md) |
| **Union** | Combines two or more streams' shared-name, shared-type fields into one output; non-matching fields are dropped |
| **Expand** | Creates a new row for each value inside an array field |
| **Join** | Combines two streams based on a matching condition — Eventstream's stream-to-stream join |

In addition, a **SQL operator (preview)** supports code-first stream processing with SQL expressions, including windowing, joins, and aggregations, for teams that outgrow the no-code canvas without needing to leave Eventstream entirely.

> [!warning] Common Mistake
> Assuming every transformation operator works with every destination. Only **Lakehouse**, **Eventhouse (event processing before ingestion)**, **Derived stream**, and **Activator** support adding an operator directly before ingestion. For a destination that doesn't support a pre-ingestion operator (e.g., a custom endpoint), the fix is to route the transformed output to a **derived stream** first, then attach the unsupported destination to that derived stream.

**Practice Question 2** *(Medium)*

An eventstream needs to compute a rolling count of failed login attempts per user over 10-minute windows, then send only the users exceeding a threshold to a custom application via a custom endpoint. Which operators, in which order, accomplish this?

A. Filter → Manage fields → Custom endpoint directly  
B. Group by (10-minute window, grouped by user, count aggregation) → Filter (count > threshold) → Derived stream → Custom endpoint  
C. Aggregate → Custom endpoint directly, since Aggregate already supports thresholds  
D. Join → Union → Custom endpoint directly  

> [!success]- Answer
> **B. Group by (10-minute window, grouped by user, count aggregation) → Filter (count > threshold) → Derived stream → Custom endpoint**
>
> Group by is the windowed-aggregation operator (10-minute window, grouped by user, `count()`), Filter then keeps only users over the threshold. Because a custom endpoint doesn't support a pre-ingestion operator directly, the transformed output must be materialized as a derived stream first, and the custom endpoint attaches to that derived stream.

## Apache Kafka Endpoint

Every eventstream exposes an **Apache Kafka-compatible endpoint**, backed by an Azure Event Hubs namespace that Fabric provisions automatically when the eventstream is created — no separate provisioning step. Any application or client already speaking the Kafka protocol can connect using the eventstream's Kafka endpoint connection details, both to **produce** events into the stream (as a custom endpoint source) and to **consume** events from it (as a custom endpoint destination).

> [!note] Mental model
> The Kafka endpoint is a **universal adapter plug** — any Kafka-speaking application plugs straight in without needing to know it's actually talking to Fabric underneath.

## Schema Management

Eventstreams provide several schema-governance capabilities, all currently **preview**:

- **Schema Registry (preview)** — register and version schemas centrally, managing schema evolution across eventstreams
- **Multiple schema inferencing (preview)** — infer and work with multiple schemas within a single eventstream, enabling different transformation paths per inferred schema
- **Confluent Schema Registry–based deserialization (preview)** — when ingesting from Confluent Cloud for Apache Kafka, deserialize schema-encoded messages using Confluent's own registry for better interoperability

## Operational and Security Capabilities

- **Pause and resume** — derived streams support pause/resume controls, letting you temporarily halt processing on one output without affecting other inputs/outputs on the same eventstream; useful when reprocessing history with a **Custom time** starting point (see the CDC initial-snapshot issue below)
- **Workspace Private Link (preview)** — select sources and destinations support Private Link for private network access, securing inbound connections to an eventstream

## Destinations and Delivery Guarantees

| Destination | Description | Delivery notes |
| :--- | :--- | :--- |
| **Custom endpoint** | Routes events to an external application or Kafka client via a connection string | At-least-once — the consuming application is responsible for idempotent handling |
| **Eventhouse** | Ingests into a KQL database; choose **Direct ingestion** (no processing) or **Event processing before ingestion** (operators applied first) | At-least-once at ingestion; downstream dedup (materialized view `arg_max`, or query-time `arg_max`) is the standard way to reach effectively-once |
| **Lakehouse** | Converts events to Delta Lake format and writes to lakehouse tables | At-least-once; downstream dedup (`dropDuplicates` + watermark, or a `MERGE`) is required for effectively-once, same as any streaming write into Delta |
| **Spark Notebook** *(preview)* | Loads a pre-existing notebook to process the stream via a Spark Structured Streaming job | Delivery semantics inherit from the notebook's own `writeStream` configuration (checkpointing, sink idempotency) |
| **Derived stream** | A specialized destination representing the transformed default stream after operators are applied; routable to multiple further destinations and visible in Real-Time hub | Not a terminal sink by itself — a pass-through, transformed view of the stream |
| **Activator** | Connects event data directly to Fabric Activator for condition monitoring and automated action (alerts, Power Automate workflows) | At-least-once; Activator's own rule evaluation handles repeated/duplicate triggers per its own latency/accuracy model |

An eventstream can attach **multiple destinations simultaneously** without interference — for example, one Eventhouse destination for raw data, a second Eventhouse destination (fed by a Filter operator) for a curated subset, and a Lakehouse destination for aggregated values, all from the same source.

> [!warning] Common Mistake
> Describing Fabric eventstream delivery as "exactly-once." Fabric eventstreams guarantee **at-least-once** delivery end to end — a redelivered or retried event can reach a destination twice. Any "exactly-once" claim in a scenario refers to a downstream sink's own idempotent-write behavior (Delta's checkpoint-to-sink guarantee, or a KQL materialized view's dedup), never to Eventstream's delivery contract itself. This mirrors the same distinction covered for the medallion streaming pattern in [05-Loading Patterns: Streaming Loading Pattern](../05-loading-patterns/03-streaming-loading-pattern.md).

## Derived Streams and Content-Based Routing

A **derived stream** is the transformed version of the default stream, created the moment you attach one or more operators (Filter, Manage fields, etc.) to the default stream's output. It behaves like a first-class stream: it can be routed to multiple destinations, it's visible and independently addressable in the **Real-Time hub**, and it supports its own pause/resume controls without affecting other inputs or outputs on the same eventstream.

**Content-based routing** is the pattern of sending different subsets of one incoming stream to different destinations based on the event's own content — typically built with a Filter (or a chain of Filter + other operators) feeding into separate derived streams, each routed to its own destination. A common example: route raw events into one Eventhouse for archival, route a `Filter`-narrowed derived stream into a second Eventhouse for a curated near-real-time view, and route an `Aggregate` derived stream into a Lakehouse for downstream BI — all three destinations fed from a single ingested source, without triplicating ingestion.

> [!note] Mental model — derived stream
> The default stream is the **unopened mail truck**. Each derived stream is a **sorted mailbag** pulled off that truck after applying a rule (filter, reshape, aggregate) — and once a mailbag exists, it can be delivered to more than one address, and anyone in the building (Real-Time hub) can see that the mailbag exists and inspect its contents.

**Practice Question 3** *(Medium)*

A team wants raw IoT events archived untouched in one Eventhouse, while a second Eventhouse receives only events where `temperature > 90`, for a live overheating-alert dashboard. What's the correct pattern?

A. Two separate eventstreams, each independently ingesting from the IoT source  
B. One eventstream: the default stream routes directly to the archival Eventhouse (Direct ingestion), and a Filter operator produces a derived stream routed to the second Eventhouse  
C. A single Group by operator with two output destinations  
D. Eventhouse update policies alone, with no Eventstream involvement  

> [!success]- Answer
> **B. One eventstream: the default stream routes directly to the archival Eventhouse (Direct ingestion), and a Filter operator produces a derived stream routed to the second Eventhouse**
>
> This is the canonical content-based-routing pattern: one ingestion point, multiple destinations fed by different processing paths. Option A works technically but doubles ingestion cost and complexity for no benefit. Group by is an aggregation operator, not a routing filter. Update policies operate entirely inside Eventhouse, after ingestion — they can't select which Eventhouse a raw event lands in.

## Throughput and Retention Limits

| Limit | Value |
| :--- | :--- |
| Maximum message size | 1 MB |
| Maximum retention period of event data | 90 days |
| Event delivery guarantee | At least once |
| Combined sources + destinations (specific types only*) | Up to 11 |

\* The 11-item combined limit applies only when using **Custom endpoint** as a source together with **Custom endpoint** and **Eventhouse with Direct ingestion** as destinations; other source/destination combinations, and destinations not appended to the default stream, don't count toward it.

Microsoft recommends running eventstreams on **at least an F4 capacity** for production workloads.

## Real-Time Hub Relationship

**Real-Time hub** is a single, tenant-wide, logical place for discovering, ingesting, managing, and consuming all streaming data across an organization — every Fabric tenant is automatically provisioned with it, with no setup step required. Every running eventstream's outputs (default stream and any derived streams) and every KQL database table that a user has access to automatically appear in Real-Time hub. From Real-Time hub, a user can open the parent eventstream of any listed stream directly in the event-processing editor to add or inspect transformations, or open a KQL database to query its tables — without needing to separately track down which eventstream or database produced a given stream.

Real-Time hub also exposes its own catalog of connectors for **Microsoft sources** (Event Hubs, Service Bus, IoT Hub), **CDC feeds**, **other-cloud streaming** (Google Pub/Sub, Amazon Kinesis), **Kafka clusters**, and **Fabric/Azure events** — creating a stream through Real-Time hub automatically creates the backing eventstream for you.

> [!note] Mental model — Real-Time hub
> If every eventstream and KQL table is a **shop on a street**, Real-Time hub is the **city's public directory** — it doesn't run the shops itself, but every shop that opens automatically gets listed, and anyone browsing the directory can walk straight into any shop they have permission to enter.

## Use Cases

- Landing raw operational-database changes into Fabric with minimal parsing effort using a CDC connector plus DeltaFlow
- Building a single eventstream that fans out to an archival Eventhouse, a filtered Eventhouse for a live dashboard, and a Lakehouse for nightly BI — content-based routing from one ingestion point
- Using the Group by operator's windowed aggregation to compute rolling metrics with zero custom code
- Discovering an existing team's eventstream outputs and KQL tables through Real-Time hub without needing direct pointers to the source items

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| A pre-ingestion operator can't be attached to a custom-endpoint destination | Custom endpoint doesn't support operators directly before ingestion | Route the operator's output to a derived stream first, then attach the custom endpoint to that derived stream |
| CDC source produces unreadable nested JSON | DeltaFlow isn't enabled (or isn't supported for that connector) and no manual `parse` step exists | Enable DeltaFlow for supported connectors, or add a Manage fields/parsing transform downstream |
| Events silently missing from a destination right after publishing a new source | Data ingestion can start before data routing is fully initialized, especially with CDC initial-snapshot data | Uncheck **Activate ingestion** when adding the source, publish, then manually activate ingestion using a **Custom time** to catch the earlier data |
| Team assumes Eventstream guarantees exactly-once delivery | Fabric eventstreams are at-least-once by design | Add an explicit downstream dedup step (materialized view, `dropDuplicates` + watermark, or `MERGE`) at the destination |
| An eventstream unexpectedly hits the 11-item combined source/destination limit | Using Custom endpoint sources with Custom endpoint and Direct-ingestion Eventhouse destinations together | Reduce combined items, or use destination types/patterns outside the limited set (e.g., Event processing before ingestion) |
| A message is silently dropped or an ingestion error appears for a large payload | The event exceeds Eventstream's 1 MB maximum message size | Split the payload upstream, or restructure the source to emit smaller events (e.g., per-record instead of per-batch) |
| A team can't find an older event that "should still be there" | Event retention exceeds the eventstream's configured or maximum 90-day retention window | Persist anything needed beyond 90 days to a durable destination (Lakehouse, Eventhouse) rather than relying on Eventstream's own retention |

## Best Practices

- Prefer a CDC connector with DeltaFlow over hand-rolled JSON parsing whenever the source database is one of the supported connectors
- Use derived streams for content-based routing instead of standing up duplicate eventstreams per destination
- Choose **Event processing before ingestion** whenever an Eventhouse destination needs filtering/aggregation applied first; use **Direct ingestion** for a raw/archival copy
- Design for at-least-once delivery from the start — build dedup into the destination layer rather than assuming Eventstream will deduplicate for you
- Check Real-Time hub before building a new eventstream from scratch — the source or a similar transformed stream may already exist

## Exam Tips

> [!tip] Exam Tips
>
> - Nine database CDC connectors exist; DeltaFlow (preview) currently covers Azure SQL DB, Azure SQL MI, SQL Server on VM, and PostgreSQL CDC
> - The seven no-code operators are Filter, Manage fields, Aggregate, Group by, Union, Expand, Join — Group by is the windowed one
> - Only Lakehouse, Eventhouse (event processing before ingestion), Derived stream, and Activator support a pre-ingestion operator — everything else needs a derived stream as an intermediate hop
> - Delivery is **at-least-once** everywhere in Eventstream — "exactly-once" only ever describes a downstream sink's idempotent-write behavior
> - Every eventstream output and every accessible KQL table shows up in Real-Time hub automatically — no manual registration

## Key Takeaways

- Eventstream's source catalog spans Azure services, 9 CDC connectors, Kafka-compatible platforms, other clouds, and Fabric/Azure events, with DeltaFlow easing CDC's JSON-to-table gap for supported connectors
- The 7 event-processor operators (Filter, Manage fields, Aggregate, Group by, Union, Expand, Join) cover most no-code transform needs; a SQL operator (preview) exists for code-first logic within Eventstream
- 6 destinations exist, all at-least-once by delivery guarantee; only 4 support pre-ingestion operators directly, and derived streams bridge the gap for the rest
- Derived streams are the mechanism behind content-based routing, and they — like every eventstream output and KQL table — automatically surface in the tenant-wide Real-Time hub

## Related Topics

- [01-Choosing a Streaming Engine](./01-choosing-streaming-engine.md)
- [04-KQL Real-Time](./04-kql-realtime.md)
- [05-Windowing Functions](./05-windowing-functions.md)
- [05-Loading Patterns: Streaming Loading Pattern](../05-loading-patterns/03-streaming-loading-pattern.md)

## Official Documentation

- [Microsoft Fabric Eventstreams overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/overview)
- [Add and manage Eventstream destinations](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-manage-eventstream-destinations)
- [Process event data using the event processing editor](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/process-events-using-event-processor-editor)
- [Route events based on content in Fabric eventstreams](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/route-events-based-on-content)
- [Add an Eventhouse destination to an eventstream](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-destination-kql-database)
- [Introduction to Microsoft Fabric Real-Time hub](https://learn.microsoft.com/en-us/fabric/real-time-hub/real-time-hub-overview)
- [Process data streams in Real-Time hub](https://learn.microsoft.com/en-us/fabric/real-time-hub/process-data-streams-using-transformations)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-choosing-streaming-engine.md) | [↑ Back to Section](./streaming-data.md) | [Next →](./03-spark-structured-streaming.md)**
