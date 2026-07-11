---
title: Error Resolution
type: category
tags:
  - dp-700
  - fabric
  - error-resolution
  - troubleshooting
  - pipelines
  - dataflow-gen2
  - spark
  - tsql
  - eventhouse
  - eventstream
  - onelake-shortcuts
status: complete
---

# Error Resolution (Domain 3 · 30–35%)

Error Resolution covers the exam blueprint's **"Identify and resolve errors"** bullet, which names seven distinct error surfaces: pipeline, Dataflow Gen2, notebook, Eventhouse, Eventstream, T-SQL (Warehouse), and OneLake shortcut. This section walks each surface the same way — the symptom you'd see, where to go to diagnose it, and a resolution table mapping cause to fix — building directly on [09-Monitoring & Alerting](../09-monitoring-alerting/monitoring-alerting.md)'s coverage of *where to look*. This section instead answers *what you're looking at once you get there*; it assumes you already know which monitoring surface to open for a given item type, so if a symptom description doesn't immediately map to a surface, revisit [09-Monitoring & Alerting: Monitoring Surfaces](../09-monitoring-alerting/01-monitoring-surfaces.md) first — its Decision Guidance table is the fastest way in.

---

## Quick Recall

```mermaid
mindmap
  root((Error Resolution))
    Pipeline and Dataflow Gen2
      Activity output JSON - errorCode, message, failureType, target
      OAuth token expiry, LSROBOTokenFailure, gateway 1433
      Throttling 2003, capacity limit exceeded, HTTP 430
      Rerun from failed activity vs full rerun
      Power Query errors - DataFormat, DataSource, Expression
      Query folding failure - silent performance not error
    Notebook and T-SQL
      Exit codes - 137 OOM, 143 SIGTERM, 134 SIGABRT, 1 user code
      Driver OOM from collect vs executor OOM from skew
      AnalysisException - table, column, ambiguous, schema mismatch
      TooManyRequestsForCapacity - HTTP 430 queueing
      Snapshot isolation only - error 24556, 24706 update conflict
      COPY INTO ERRORFILE - error dot Json plus row dot csv
    Eventhouse and Eventstream
      show ingestion failures - FailureKind Permanent vs Transient
      Streaming versus queued ingestion latency tradeoff
      Update policy failure - transactional blocks vs non-transactional partial
      AADSTS65002 - Eventstream not preauthorized to Event Hubs
      Runtime logs three severities - warning error information
    OneLake Shortcuts
      Delegated vs passthrough authentication
      401 versus 403 versus 404 semantics
      Cached storage token staleness - 30 to 60 minutes
      Transitive shortcuts - max 5 direct shortcut-to-shortcut links
      OneLake security interplay - delegated mode blocks RLS CLS OLS sources
```

---

## Topics Overview

```mermaid
flowchart TD
    Err[Error Resolution] --> PD[Pipeline and Dataflow Gen2]
    Err --> NT[Notebook and T-SQL]
    Err --> RT[Eventhouse and Eventstream]
    Err --> SC[OneLake Shortcuts]
    PD --> Activity[Activity Output JSON and Error Classes]
    PD --> PQ[Power Query Error Patterns]
    NT --> Spark[Spark Exit Codes and Memory]
    NT --> Warehouse[Warehouse Locking and COPY INTO]
    RT --> Ingest[Ingestion Failure Categories]
    RT --> Stream[Eventstream Connection and Processor Errors]
    SC --> Auth[Delegated Credential Failures]
    SC --> Cache[Cache Staleness and Transitive Shortcuts]
```

## Section Contents

| File | Topic | Priority |
| :--- | :--- | :--- |
| [01-pipeline-dataflow-errors.md](01-pipeline-dataflow-errors.md) | Pipeline activity failure output JSON, connection/auth/OAuth/gateway errors, staging errors, timeout, throttling and 429/430 capacity errors, parameter/expression errors, rerun from failed activity, retry configuration; Dataflow Gen2 refresh errors, diagnostics download, staging Lakehouse and gateway issues, query folding failures, common Power Query error patterns | High |
| [02-notebook-tsql-errors.md](02-notebook-tsql-errors.md) | Notebook/Spark session and capacity errors, OOM (driver vs. executor), AnalysisException, session startup failures, library/environment errors, Spark UI/log diagnosis; T-SQL Warehouse unsupported syntax, data-type errors, transaction/locking conflicts and snapshot isolation, COPY INTO rejected-row diagnostics, query insights | High |
| [03-realtime-errors.md](03-realtime-errors.md) | Eventhouse ingestion failures (`.show ingestion failures`, permanent vs. transient), streaming vs. queued ingestion error surfaces, update-policy failure behavior; Eventstream source connection errors, throughput/throttling, destination delivery issues, runtime logs and data insights, processor errors | High |
| [04-shortcut-errors.md](04-shortcut-errors.md) | OneLake shortcut auth failures (delegated credential expiry, permission revocation), 401/403/404 semantics, deleted/moved targets, S3/ADLS-specific issues, cache staleness, transitive shortcuts, OneLake security interplay errors, diagnosing across Spark/SQL endpoint/semantic model | High |

## Key Concepts

- **Every surface fails differently, but the diagnostic pattern repeats** — find the exact error code or message first, classify it (permanent vs. transient, user vs. system, auth vs. data), then apply the documented fix rather than guessing from the symptom alone
- **Retry is a valid fix for exactly one class of error** — transient/infrastructure failures (bad node, throttling, transient download errors) resolve on retry; permanent failures (bad format, missing permission, schema mismatch) don't, and retrying them wastes capacity
- **Auth failures cluster around token lifetime, not just wrong credentials** — OAuth token expiry, Conditional Access policy changes, delegated shortcut credential cache staleness (30–60 minutes), and stale device/refresh tokens all present as generic "unauthorized" errors with very different fixes
- **Snapshot isolation is the only isolation level in Fabric Warehouse** — `SET TRANSACTION ISOLATION LEVEL` is silently ignored, and update conflicts (errors 24556/24706) are expected under concurrent writes to the same table, not a bug — the fix is retry logic, not a different isolation level
- **"It failed" and "it's slow" point to different surfaces** — a hard failure has an error code to look up in this section; degraded-but-succeeding behavior (query folding silently disabled, ingestion batching latency) is a performance question covered in [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Related Resources

- [09-Monitoring & Alerting](../09-monitoring-alerting/monitoring-alerting.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)
- [Official: Troubleshoot pipelines for Data Factory in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-factory/pipeline-troubleshoot-guide)
- [Official: Troubleshooting guide for Spark jobs in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/troubleshoot-spark)
- [Official: Troubleshoot the Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/troubleshoot-fabric-data-warehouse)
- [Official: Secure and manage OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcut-security)
- [Official: DP-700 skills measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](../09-monitoring-alerting/monitoring-alerting.md) | [↑ Back to Certification](../dp-700-overview.md) | [Next →](../11-performance-optimization/performance-optimization.md)**
