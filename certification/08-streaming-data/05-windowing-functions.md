---
title: Windowing Functions
type: topic
tags:
  - dp-700
  - fabric
  - streaming-data
  - windowing
  - eventstream
  - kql
  - spark-structured-streaming
  - watermark
---

# Windowing Functions

## Overview

"Create windowing functions" is a blueprint bullet that spans all three streaming surfaces covered in this section — Eventstream's no-code Group by operator, KQL's `bin()`/`summarize`/`row_window_session()`, and Spark Structured Streaming's `window()`/`session_window()`. This topic explains the five conceptual window types (tumbling, hopping, sliding, session, snapshot), builds the single comparison table the exam rewards recognizing, works the *same* 5-minute tumbling aggregate through all three syntaxes side by side, and closes with how late data and watermarks interact with windowed results.

> [!abstract]
>
> - A **tumbling window** is fixed-size and non-overlapping — every event belongs to exactly one window
> - A **hopping window** is fixed-size but can overlap — controlled by a window size and a smaller "hop" advance interval
> - A **sliding window** emits a result only when the window's contents actually change (an event enters or exits), rather than on a fixed schedule
> - A **session window** groups events by activity, closing after a period of inactivity — driven by data, not a clock
> - A **snapshot window** groups events sharing the exact same timestamp — the degenerate case, usually expressed as "group by timestamp" rather than a dedicated window function
> - The same windowing *concept* has three different syntaxes: Eventstream's Group by operator (no-code), KQL's `bin()` inside `summarize` (query-time), and Spark's `window()`/`session_window()` (programmatic, streaming)

> [!tip] What the Exam Tests
>
> - Identifying which window type (tumbling/hopping/sliding/session) a scenario's requirement maps to
> - Writing the equivalent windowed aggregation in whichever surface a scenario names — Eventstream Group by, KQL, or Spark
> - Recognizing that a watermark determines how late-arriving data interacts with an already-computed or in-progress window
> - Not confusing a *window* (a time-bounded grouping mechanism) with a *checkpoint* or a *trigger* (which control execution cadence, not grouping)

---

## The Five Window Types, Conceptually

| Window type | Definition | Overlap? | Driven by |
| :--- | :--- | :--- | :--- |
| **Tumbling** | Fixed-size, contiguous, non-overlapping intervals — every event belongs to exactly one window | No | Clock (fixed interval) |
| **Hopping** | Fixed-size intervals that advance by a "hop" smaller than the window size, so windows overlap | Yes | Clock (window size + hop size) |
| **Sliding** | A conceptual window that only emits a result at points where its content actually changes (an event enters or exits) | Yes, continuously | Data (event arrival/expiry), not a fixed schedule |
| **Session** | Groups events that arrive close together in time; closes after a defined gap of inactivity | No — but window *boundaries* are data-dependent, not fixed | Data (gaps between events) |
| **Snapshot** | Groups events sharing the exact same timestamp — the simplest, degenerate window | No | Data (timestamp equality) |

> [!note] Mental model — the five window types
> **Tumbling** is a **conveyor belt with marked, back-to-back sections** — every item lands in exactly one section, sections never overlap. **Hopping** is the **same belt with overlapping stencils laid on top** — one item can be inside two stencils at once, because each stencil starts before the previous one ends. **Sliding** is a **spotlight that only flashes when something crosses its beam** — no fixed schedule, it reacts to actual entry/exit events. **Session** is a **conversation window** — it stays open as long as people keep talking, and closes only after a period of silence, so its length is entirely data-driven. **Snapshot** is the **group photo** — everyone in the photo shares the exact same instant, nothing more, nothing less.

## The Comparison Table

| Window type | Eventstream (Group by, no-code) | KQL | Spark Structured Streaming |
| :--- | :--- | :--- | :--- |
| **Tumbling** | Select **Tumbling** window type; set window size (e.g., 5 minutes) | `summarize <agg> by bin(Timestamp, 5m)` | `.groupBy(window(col("eventTime"), "5 minutes"))` |
| **Hopping** | Select **Hopping** window type; set window size and hop size | No single built-in operator — approximate with multiple `bin()` buckets at different offsets, or the SQL operator's Stream-Analytics-style hopping syntax | `.groupBy(window(col("eventTime"), "5 minutes", "1 minute"))` — duration + slide interval |
| **Sliding** | Select **Sliding** window type; emits only on content change | Not a native standing construct — approximate at query time with `row_window_session`-style logic or a moving-window `range` query | Not a distinct Spark API — closest equivalent is a hopping window with a very small slide interval, or windowed stateful processing |
| **Session** | Select **Session** window type; set timeout (max gap between events) | `row_window_session(Timestamp, MaxDistanceFromFirst, MaxDistanceBetweenNeighbors [, Restart])` | `.groupBy(session_window(col("eventTime"), "10 minutes"))` — gap duration |
| **Snapshot** | Not a dedicated no-code option — approximate with a Group by using a zero-width/exact-match grouping key | `summarize <agg> by Timestamp` (group by the raw timestamp column, no `bin()`) | `.groupBy("eventTime")` (group by the raw event-time column, no `window()`) |

> [!warning] Common Mistake
> Assuming every window type exists identically, by name, in all three surfaces. **Hopping** and **sliding** windows are first-class no-code options in Eventstream's Group by operator and have direct Spark equivalents (`window()` with a slide interval; no clean sliding equivalent), but KQL has ==no dedicated hopping or sliding window operator== — both are approximated using `bin()` variations or `row_window_session`-style logic at query time. If a scenario asks specifically for a KQL hopping-window construct by name, the trap is inventing a nonexistent operator; the correct read is that KQL achieves the same *result* through composition, not a single named function.

**Practice Question 1** *(Medium)*

A scenario describes a requirement: "events should be grouped by periods of continuous activity, closing the group after 15 minutes with no new events." Which window type is this, and how would you express it in Spark?

A. Tumbling window — `window(col("eventTime"), "15 minutes")`  
B. Session window — `session_window(col("eventTime"), "15 minutes")`  
C. Hopping window — `window(col("eventTime"), "15 minutes", "5 minutes")`  
D. Snapshot window — `groupBy("eventTime")`  

> [!success]- Answer
> **B. Session window — `session_window(col("eventTime"), "15 minutes")`**
>
> "Grouped by periods of continuous activity, closing after a gap of inactivity" is the definition of a session window — data-driven boundaries, not a fixed clock interval. Spark's `session_window()` function takes the event-time column and the inactivity gap duration directly. Tumbling and hopping windows are clock-driven with fixed boundaries, which doesn't match "closing after 15 minutes with no new events."

## Worked Example: The Same 5-Minute Tumbling Aggregate, Three Ways

All three examples compute the same result: average temperature per device, in 5-minute tumbling windows.

**Eventstream (Group by operator, no-code)**

1. Add a **Group by** operator after the source (or after a Filter/Manage fields operator)
2. Set **Window type**: Tumbling, **Window size**: 5 minutes
3. Set **Group by**: `deviceId`
4. Add an aggregation: `avg(temperature)` renamed to `avgTemperature`

No code is written — the operator's configuration pane captures all four settings (window type, size, grouping key, aggregation).

**KQL**

```kusto
Telemetry
| summarize avgTemperature = avg(temperature) by deviceId, bin(eventTime, 5m)
```

`bin(eventTime, 5m)` rounds each event's timestamp down to the nearest 5-minute boundary, and `summarize ... by deviceId, bin(...)` groups and aggregates within each resulting bucket — KQL's tumbling-window idiom.

**Spark Structured Streaming**

```python
from pyspark.sql import functions as F

windowedAvg = (
    parsed
    .withWatermark("eventTime", "10 minutes")
    .groupBy(
        F.window(F.col("eventTime"), "5 minutes"),
        F.col("deviceId")
    )
    .agg(F.avg("temperature").alias("avgTemperature"))
)

(windowedAvg.writeStream
    .format("delta")
    .option("checkpointLocation", "Files/checkpoints/gold_device_avg")
    .outputMode("update")
    .toTable("gold.device_avg_temperature"))
```

`F.window(col, "5 minutes")` produces a `window` struct column (with `start`/`end` fields) that `groupBy` treats as the tumbling bucket, identical in concept to Eventstream's Group by window and KQL's `bin()`.

> [!note] Mental model
> All three snippets are computing exactly the same thing — the exam wants you to recognize that "5-minute tumbling average" is one requirement wearing three different outfits, not three different requirements. If a question names the engine, the answer is picking the right snippet shape above; if it doesn't name the engine, the answer is usually about picking the right *engine* first (see [01-Choosing a Streaming Engine](./01-choosing-streaming-engine.md)), then the windowing syntax follows from that choice.

**Practice Question 2** *(Medium)*

A KQL query needs to compute a 10-minute tumbling average of CPU usage per server. Which query is correct?

A. `Telemetry | summarize avg(Cpu) by ServerId, window(Timestamp, 10m)`  
B. `Telemetry | summarize avg(Cpu) by ServerId, bin(Timestamp, 10m)`  
C. `Telemetry | groupBy(window(Timestamp, "10 minutes"), ServerId).avg(Cpu)`  
D. `Telemetry | session_window(Timestamp, 10m) | summarize avg(Cpu) by ServerId`  

> [!success]- Answer
> **B. `Telemetry | summarize avg(Cpu) by ServerId, bin(Timestamp, 10m)`**
>
> `bin()` is KQL's time-bucketing function, and `summarize ... by <key>, bin(<timestamp>, <interval>)` is the standard tumbling-window idiom. `window()` and `groupBy(...)` in option A/C are Spark syntax, not KQL. `session_window` in option D is Spark's session-window function name and isn't valid KQL syntax either (KQL's session equivalent is `row_window_session`).

## Choosing a Window Type Per Scenario

| Scenario signal | Window type |
| :--- | :--- |
| "Compute a metric every fixed N minutes, no overlap" | Tumbling |
| "Compute a rolling N-minute average, updated every M minutes, where M < N" | Hopping |
| "Emit a result the instant the window's contents change" | Sliding |
| "Group events by bursts of activity, closing after a period of silence" | Session |
| "Group events that happened at literally the same instant" | Snapshot |

## Windows vs. Triggers vs. Checkpoints — Don't Conflate

Three Spark Structured Streaming concepts sound related and are frequently confused on the exam, but they answer entirely different questions:

| Concept | Question it answers | Configured with |
| :--- | :--- | :--- |
| **Window** | *How should events be grouped by time for aggregation?* | `window()` / `session_window()` inside `groupBy` |
| **Trigger** | *How often should a micro-batch actually execute?* | `.trigger(processingTime=... / availableNow=True)` |
| **Checkpoint** | *How does the query resume correctly after a restart?* | `.option("checkpointLocation", ...)` |

A query can use a 5-minute tumbling window with a 1-minute trigger — the window groups data into 5-minute buckets, while the trigger controls how frequently Spark checks for new data and updates those buckets' partial results. Checkpointing is orthogonal to both — it has nothing to do with grouping or execution cadence, only with safe restart. All three are independently configurable in the same query, and a scenario naming one doesn't imply anything about the others.

> [!warning] Common Mistake
> Assuming a shorter trigger interval changes the *window* size, or that a window definition controls how *often* results are emitted. A 5-minute tumbling window with a `processingTime="30 seconds"` trigger still groups by 5-minute buckets — it just checks for and emits updated (partial, in-progress) results for the current open window every 30 seconds, rather than only once the full 5 minutes have elapsed.

**Practice Question 3** *(Easy)*

A fraud-detection team wants a 5-minute rolling transaction count per account, recalculated every minute so a threshold-based alert can react quickly to a sudden spike, without waiting for a full 5-minute tumbling window to close. Which window type fits?

A. Tumbling — 5-minute windows  
B. Hopping — 5-minute window size, 1-minute hop  
C. Session — 5-minute inactivity gap  
D. Snapshot — group by exact timestamp  

> [!success]- Answer
> **B. Hopping — 5-minute window size, 1-minute hop**
>
> "Rolling N-minute window, recalculated every M minutes" (M smaller than N) is the textbook hopping-window definition — the window size (5 minutes) stays fixed, but a new, overlapping window result is emitted every hop interval (1 minute), giving faster reaction time than waiting for a tumbling window to fully close.

## Late Data and Watermarks

Every windowing mechanism has to answer the same question: **how late can an event arrive and still be counted in the correct window?**

| Surface | Late-data mechanism |
| :--- | :--- |
| **Eventstream** | Group by operator supports a configurable late-arrival tolerance, allowing events within the tolerance to still be included in an already-open window before it's finalized |
| **KQL** | No standing watermark concept — a `bin()`-based query re-evaluates against whatever data exists in the table at query time, so "late" data simply gets included the next time the query runs, as long as it landed before that run (ingestion-time/update-policy timing determines whether it made an earlier materialized-view refresh) |
| **Spark Structured Streaming** | `.withWatermark(<event-time column>, <tolerance>)` explicitly bounds how long window state is retained; data arriving later than the tolerance relative to the max seen event-time is not guaranteed to be reflected in its window's result |

> [!warning] Common Mistake
> Assuming a watermark **rejects** late data outright. A watermark doesn't cause an error or drop the event from the stream entirely — it simply means the *window's state* may already have been finalized and cleared by the time the late event arrives, so that specific window's aggregate silently won't reflect it. The event itself isn't lost from the source; it's just excluded from an already-closed aggregation window. This is the same mechanic covered for dedup in [05-Loading Patterns: Streaming Loading Pattern](../05-loading-patterns/03-streaming-loading-pattern.md), applied here to windowed aggregation instead of `dropDuplicates`.

**Practice Question 4** *(Hard)*

A Spark job computes 5-minute tumbling window counts with `.withWatermark("eventTime", "5 minutes")`. A batch of events arrives with `eventTime` values 6 minutes behind the latest `eventTime` seen so far. What's the most accurate description of what happens to them?

A. The job throws an exception and stops processing  
B. The events are processed normally with no impact, since watermarks only affect deduplication, not windowed aggregation  
C. Those events' target window has very likely already had its state finalized and cleared (6 minutes exceeds the 5-minute tolerance), so they are excluded from that window's result, though they aren't rejected from the stream itself  
D. The events are automatically placed into a new window starting at their own arrival time  

> [!success]- Answer
> **C. Those events' target window has very likely already had its state finalized and cleared (6 minutes exceeds the 5-minute tolerance), so they are excluded from that window's result, though they aren't rejected from the stream itself**
>
> A 5-minute watermark tolerance means window state can be dropped once 5 minutes have passed since the latest seen event-time. Events arriving 6 minutes late exceed that tolerance, so their target window's state is very likely already gone — they're silently excluded from that window's aggregate rather than causing a failure, being rerouted, or (incorrectly, per option B) being unaffected by the watermark at all, since watermarks bound state for *both* dedup and windowed aggregation.

## Use Cases

- Tumbling windows for fixed-interval reporting metrics (e.g., "average temperature every 5 minutes")
- Hopping windows for fast-reacting rolling metrics that need more frequent updates than a tumbling window's close interval (fraud/anomaly detection)
- Session windows for user-activity or device-activity grouping where the natural boundary is a gap in activity, not a clock (web session analysis, equipment duty cycles)
- Snapshot windows/grouping for deduplicating or aggregating events that share an exact source timestamp
- Watermarks (Spark) or late-arrival tolerance (Eventstream) to bound how long a pipeline waits for stragglers before finalizing a window

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Expecting a KQL `hopping()` or `sliding()` function that doesn't exist | KQL has no dedicated hopping/sliding window operators | Compose the equivalent behavior with `bin()` variations or `row_window_session`-style logic at query time |
| A Spark windowed aggregate silently omits a batch of legitimately late data | The watermark tolerance was shorter than the actual lateness of the data | Widen `.withWatermark(...)`'s tolerance if the business requirement demands catching later stragglers, accepting the tradeoff of larger retained state |
| Eventstream Group by output looks wrong for a "rolling, frequently updated" metric | Tumbling window type was selected when Hopping was the actual requirement | Switch the Group by operator's window type to Hopping and set an appropriate hop size |
| A `session_window`/`row_window_session` result looks wrong because rows weren't ordered first | Session-window functions require a serialized (sorted) row set to compute correctly | Sort or `serialize` the input by the grouping key and timestamp before applying the session function |

## Best Practices

- Match the window type to whether the requirement is clock-driven (tumbling/hopping) or activity-driven (session) before picking syntax
- When a scenario names a specific engine, translate the window type directly using the comparison table above rather than reasoning from scratch
- Always pair a Spark windowed aggregation with an explicit `.withWatermark(...)` call sized to the business's real tolerance for late data
- Recognize KQL's `bin()` as query-time bucketing, not a standing pipeline stage — it re-evaluates against current table contents on every run, unlike Spark's stateful streaming windows

## Exam Tips

> [!tip] Exam Tips
>
> - Tumbling = fixed, no overlap; hopping = fixed, overlapping (window size + smaller hop); sliding = emits on content change; session = activity-gap-driven; snapshot = same-timestamp grouping
> - Eventstream Group by supports tumbling/hopping/sliding/session natively as UI options; KQL's dedicated constructs are `bin()` (tumbling) and `row_window_session()` (session) — no native hopping/sliding function
> - Spark: `window(col, size)` = tumbling; `window(col, size, slide)` = hopping; `session_window(col, gap)` = session
> - A watermark doesn't reject late data from the stream — it bounds how long window/dedup *state* is retained, so very late data is silently excluded from an already-finalized window
> - "5-minute tumbling aggregate" is one requirement with three syntaxes — identify the engine first, then apply the matching snippet shape

## Key Takeaways

- Five conceptual window types exist — tumbling, hopping, sliding, session, snapshot — differentiated by whether boundaries are clock-driven or data-driven, and whether windows overlap
- Eventstream's Group by operator, KQL's `bin()`/`summarize`/`row_window_session()`, and Spark's `window()`/`session_window()` are three syntaxes for the same underlying concepts, with KQL lacking dedicated hopping/sliding operators
- The same 5-minute tumbling aggregate is expressible with equivalent effort in all three surfaces once the engine is chosen
- Watermarks (Spark) and late-arrival tolerance (Eventstream) bound state retention for windows, trading completeness for bounded memory/state — late data isn't rejected from the source, just excluded from an already-finalized window

## Related Topics

- [01-Choosing a Streaming Engine](./01-choosing-streaming-engine.md)
- [02-Eventstreams](./02-eventstreams.md)
- [03-Spark Structured Streaming](./03-spark-structured-streaming.md)
- [04-KQL Real-Time](./04-kql-realtime.md)

## Official Documentation

- [Microsoft Fabric Eventstreams overview](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/overview)
- [Route events based on content in Fabric eventstreams](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/route-events-based-on-content)
- [Window functions - Kusto](https://learn.microsoft.com/en-us/kusto/query/window-functions?view=microsoft-fabric)
- [row_window_session() - Kusto](https://learn.microsoft.com/en-us/kusto/query/row-window-session-function?view=microsoft-fabric)
- [Introduction to Azure Stream Analytics windowing functions](https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-window-functions)
- [Data streaming into a lakehouse with Spark](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-streaming-data)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./04-kql-realtime.md) | [↑ Back to Section](./streaming-data.md) | [Next →](../09-monitoring-alerting/monitoring-alerting.md)**
