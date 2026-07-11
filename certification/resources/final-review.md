---
title: "DP-700 Final Review — Exam Morning"
type: study-material
tags:
  - dp-700
  - final-review
  - exam-prep
---

# DP-700 Final Review — Exam Morning

> [!abstract] Read This in 20 Minutes
>
> - Highest-probability testable facts across all three exam domains, mined from the seven cheat sheets and the three mock-exam debriefs' "if you missed…" diagnosis grids
> - One scroll, no deep dives — orient your brain before walking in
> - The single July 21, 2026 blueprint change gets its own section — don't let it get lost in the noise
> - 10 last-minute traps the debriefs flag as repeat misses across all three mocks
> - After reading: skim the [cheat sheets](./cheat-sheets/cheat-sheets.md) "Before the Exam, I Can…" checklists, then stop studying

---

## Domain 1: Implement and Manage an Analytics Solution (30–35%)

### Workspace Roles & Item Permissions

| Fact | Detail |
| :--- | :--- |
| Viewer's blind spot | ==Gets ReadData (TDS/T-SQL) but NOT ReadAll (OneLake APIs/Spark)== — the single most-tested row in the role table |
| Role hierarchy | Admin ⊃ Member ⊃ Contributor ⊃ Viewer for nearly every capability |
| Role change timing | Applies on the user's **next login**, not mid-session |
| Multi-group membership | Highest role wins, no capping; max 1,000 users/groups per workspace |
| Item permission vs. workspace role | Independent grants — removing a share does nothing if the user still holds Contributor+ |
| Gateway permission | A third independent axis — Contributor+ everywhere still can't schedule a gateway refresh without a gateway-level grant |
| Semantic model DAX RLS | Enforced **only for Viewer** — Contributor+'s blanket access supersedes it |

### The Who-Bypasses-What Matrix

| Mechanism | Who is filtered | Who bypasses | Why |
| :--- | :--- | :--- | :--- |
| Warehouse T-SQL RLS | Everyone, incl. `dbo`/`db_owner` | Nobody | Filter predicates apply to every principal — no role exemption |
| Warehouse DDM | Viewer | Admin/Member/Contributor | Implicit `CONTROL` bundles `UNMASK` |
| OneLake security roles | Viewer | Admin/Member/Contributor | Implicit workspace **Write** overrides a Read restriction |
| Semantic model DAX RLS | Viewer | Contributor/Member/Admin | DAX RLS binds only at Viewer |

### Granular Access Controls & DDM

| Fact | Detail |
| :--- | :--- |
| Fabric Warehouse RLS | FILTER predicates only — ==no BLOCK predicate== (that's SQL Server/Azure SQL) |
| Edit an RLS predicate function | drop policy → alter function → recreate policy (schema-bound blocks direct `ALTER FUNCTION`) |
| CLS on a missing column | Hard permission error, not a silently dropped column |
| OLS | Blocks whole tables/schemas; `DENY` always overrides `GRANT` |
| Reach of RLS/CLS/OLS | SQL endpoint/Warehouse only — never Spark or OneLake API callers (need a OneLake security role) |
| DDM function set | Exactly 4: `default()`, `email()`, `random(m,n)`, `partial(...)` — no `datetime()` |
| DDM ≠ encryption | Masks are display-only; `WHERE` clauses see real values — range/equality queries leak data row-by-row |

### OneLake Security

| Fact | Detail |
| :--- | :--- |
| Supported items | Lakehouse (Read, ReadWrite), Azure Databricks Mirrored Catalog (Read), Mirrored Database (Read) — ==Warehouse not supported== |
| `DefaultReader` | Auto-created virtual role = anyone with item `ReadAll` — must be deleted/restricted to actually narrow access |
| Table access across roles | Unions (any granting role = access); RLS/CLS intersect within a role |
| `ReadWrite` role | Can never carry RLS/CLS — write access is incompatible with hiding rows/columns |
| Shortcut identity delegation | Direct Lake over SQL / T-SQL Delegated mode uses the **item owner's** identity, silently bypassing per-user OneLake security |

### Governance

| Fact | Detail |
| :--- | :--- |
| Sensitivity label flow | Fabric → Fabric ✅, Fabric → Power BI ✅, ==Power BI → Fabric ❌== |
| Label-carrying exports | Excel/PDF/PowerPoint, Analyze in Excel, PivotTable in Excel (E3+), `.pbix` — **not** `.csv`/`.txt` |
| Endorsement tiers | Promoted = any write-permission holder; Certified & Master data = tenant-admin authorization **required**, write permission alone is never enough |
| Audit log retention | 180 days (non-E5) / 1 year (E5) / up to 10 years (add-on) — not the stale "90-day" figure |

### Lifecycle & CI/CD

| Fact | Detail |
| :--- | :--- |
| Git scope | One workspace ↔ one branch ↔ one folder |
| Sync direction | Commit **or** Update per action, never both — pending Git updates disable Commit |
| Real PR-based review path | "Resolve in Git": checkout branch → PR/merge → switch workspace back |
| Database projects track | Schema only — no data, no SQL security (roles/RLS/permissions) |
| Known data-loss gotcha | `ALTER TABLE ... ADD` drops and recreates the table |
| Deployment pipeline stages | 2–10, ==count and names permanent after creation== |
| Backward deployment | Only into an **empty** target stage, full deploy only |
| Never copied by a pipeline | Data, permissions, workspace settings, app content |

### Orchestration

| Fact | Detail |
| :--- | :--- |
| Dataflow Gen2 orchestration | ==Cannot schedule or orchestrate other items== — only a pipeline does |
| Dataflow Gen2 scheduling trap | A required public parameter (Preview) blocks unattended scheduling entirely |
| Trigger filtering | Event-based triggers carry a `Subject` field for filtering |
| Expression safety | Dynamic expressions against optional parameters need null-safe guards — unguarded access is a runtime-failure design |

---

## Domain 2: Ingest and Transform Data (30–35%)

### Data Store & Decision Spine

| Fact | Detail |
| :--- | :--- |
| SQL endpoint DML rule | ==Every lakehouse/eventhouse/mirrored-DB endpoint is read-only== — only Warehouse and Fabric SQL database's primary surface accept DML |
| Lakehouse | PySpark/Spark SQL native, Spark Structured Streaming sink |
| Warehouse | T-SQL native, full DML, not a streaming target |
| Eventhouse | KQL native, Eventstream destination, read-only endpoint |
| Fabric SQL database | T-SQL (OLTP), auto-mirrors out, not a stream target |

### Shortcuts, Mirroring & Copy

| Fact | Detail |
| :--- | :--- |
| Decision funnel | Continuous sync needed → mirroring; already query-compatible → shortcut; needs reshaping → pipeline copy |
| Metadata mirroring | Moves **zero data** — catalog + shortcuts only, don't confuse with database mirroring's ~15s replication |
| Shortcut caching sources | GCS/S3/S3-compatible/on-prem gateway only — ==never ADLS/Blob==; files >1 GB never cached |
| Query acceleration | Query-speed fix only — never unlocks materialized views/update policies (native-table-only) |
| Copy activity vs. Copy job (CDC, Preview) | Activity = one-time/scheduled batch; Copy job = incremental, CDC-based, includes deletes |

### PySpark / T-SQL / KQL Rosetta

| Pattern | PySpark | T-SQL | KQL |
| :--- | :--- | :--- | :--- |
| Latest-record-per-key | `Window.partitionBy(key).orderBy(ts.desc())` → `row_number()` filter | `ROW_NUMBER() OVER (...)` filter | `summarize arg_max(ts, *) by key` |
| Upsert | `DeltaTable.merge(...)` | `MERGE` (==GA==) | No row-level MERGE — update policy or MV dedup |
| Null coalesce | `.na.fill(...)` | `COALESCE` (ANSI, N-arg) over `ISNULL` (2-arg, first-arg-typed, truncation risk) | `coalesce(...)` |
| Fact/dim enrichment | `.join(broadcast(dim), ...)` | `JOIN` | `lookup kind=leftouter (dim) on key` — broadcasts the **right** side |

| Fabric Warehouse T-SQL fact | Detail |
| :--- | :--- |
| `MERGE` status | ==GA== |
| `IDENTITY` columns | Preview-only, `bigint`-only — `ROW_NUMBER()` is the GA-safe surrogate key |
| Global temp tables | `##table` **not supported** |

### Streaming & Windowing

| Fact | Detail |
| :--- | :--- |
| Eventstream role | Transform-and-route hub, **not** a query engine — always trace to the real query destination |
| Fan-out | One eventstream can route to multiple destinations simultaneously |
| KQL windowing gap | ==No dedicated hopping or sliding operator== — approximate via `bin()` variants |
| Watermark truth | Never rejects late data from the source — only bounds how long window/dedup **state** is retained (repeat miss across all 3 mocks) |
| `checkpointLocation` | Mandatory for production Structured Streaming; one dedicated path per query |
| Streaming `MERGE` | Fails directly on a streaming DataFrame — route through `foreachBatch` |
| NEE + streaming | ==Never accelerates Structured Streaming== — regardless of NEE being enabled |

---

## Domain 3: Monitor and Optimize an Analytics Solution (30–35%)

### Triage Spine

| Symptom | Open first |
| :--- | :--- |
| Did my job succeed? | Monitor hub |
| Pipeline failed partway | Rerun from failed activity — resumes only the failure + downstream |
| Spark slow/failing | Application detail page → Logs tab |
| Everything feels slow (capacity-wide) | Capacity Metrics app |
| Page me the moment X happens | Activator |

| Fact | Detail |
| :--- | :--- |
| Monitor hub coverage | 17 item types — ==NOT Dataflow Gen1== |
| Monitor hub retention | 100 rows / 30 days main view — not a durable audit log |

### Semantic Model Refresh

| Fact | Detail |
| :--- | :--- |
| Import refresh | Entire data volume into VertiPaq — minutes to hours |
| Direct Lake framing | Metadata (Parquet references) only — seconds; fixed snapshot between framings |
| DirectQuery fallback | ==Direct Lake on OneLake never falls back== · Direct Lake on SQL **can**, governed by `DirectLakeBehavior` — most-repeated Domain 3 miss |
| Fallback diagnosis | `EVALUATE TABLETRAITS()` → `DirectLakeFallbackInfo` |
| "Successful run" trap | Says nothing about whether the Direct Lake model reframed — check refresh history separately |
| Auto-deactivation | 4 consecutive credential failures |
| Refresh caps | Pro 8/day · PPU/Premium/Fabric capacity 48/day |
| Enhanced-API cancel | `DELETE /refreshes/{id}` only cancels enhanced-triggered refreshes — never portal-button/scheduled |

### Activator & Capacity Metrics

| Fact | Detail |
| :--- | :--- |
| Unsupported alert sources | ==Capacity Metrics app and SQL analytics endpoint directly== — route via Real-Time hub capacity events / SQL query preview |
| Stateless vs. stateful | Stateless fires every event (noisy); stateful (`BECOMES`/`DECREASES`/`INCREASES`/`EXIT RANGE`/heartbeat) fires only on transition |
| Capacity Metrics alerts | ==Cannot fire alerts under any circumstance== — capacity-admin-only viewer |
| Capacity Metrics retention | 14 days Compute / 30 days Storage |

### Optimization Levers

| Fact | Detail |
| :--- | :--- |
| `OPTIMIZE` combined order | bin compaction → Z-Order → V-Order |
| V-Order default | ==OFF on new workspaces== — don't assume it's on |
| V-Order tradeoff | ~15% slower writes; up to 50% more compression, 40–60% faster cold-cache Direct Lake |
| Result-set caching | ==Tenant-disabled right now== (known issue since 2026-02-16) — a live `result_cache_hit=0` may just mean the feature is off |
| AQE | Always on by default — "enable AQE" as a fix is a distractor |
| Autotune | Off by default, Preview, needs ~20–25 iterations of a *repeated* shape; incompatible with high concurrency/private endpoints/Runtime >1.2 |
| Eventhouse caching vs. retention | Caching = query speed; retention = what exists at all — shortening retention never speeds up queries |
| Direct Lake guardrail breach | OneLake variant fails outright; SQL variant falls back to DirectQuery (slower) |
| Staging timeout | Workspace-managed staging times out at **60 minutes** — use external storage for longer jobs |
| `ForEach` anti-pattern | Needs a set-based redesign, not `batchCount` tuning — same lesson as Warehouse's row-by-row `INSERT` |
| Snapshot Isolation conflict | Update-conflict error means retry the transaction — SI ≠ RCSI |

---

## The One July 21, 2026 Blueprint Change

> [!warning] Know this cold — it is the *only* diff versus April 20, 2026
>
> ==**"Configure Dataflows Gen2 workspace settings" → "Configure Apache Airflow workspace settings"**== (within *Configure Microsoft Fabric workspace settings*, Domain 1).
>
> Every other bullet across all three domains is unchanged. Dataflows Gen2 the **product feature** is not removed — only the workspace-settings skill wording moved to Airflow. Don't present any other topic as "new in July."

| Airflow fact | Detail |
| :--- | :--- |
| Starter pool | Large node (fixed), shuts down after 20 min inactivity |
| Custom pool | Small (simple DAGs) or Large (complex/prod), always-on until paused |
| DAG files | `.py` files go in the **dags** folder |
| Private packages/wheels | **plugins** folder (or `plugins/libs` if no Git connected), then restart the job |
| Version | Airflow 2.10.5 / Python 3.12 — fixed per job, create a new job to change it |
| Licensing gap | ==Free and PPU workspaces don't support Apache Airflow jobs== |
| Networking | Private networks/VNets not yet supported |

---

## 10 Last-Minute Traps

The sharpest, most-repeated traps pulled from the seven cheat sheets' Gotchas & Traps sections and the mock-exam debriefs' diagnosis grids.

1. **"SQL analytics endpoint" never implies write access** except for Warehouse and Fabric SQL database's primary surface — lakehouse/eventhouse/mirrored-DB endpoints are always read-only, regardless of scenario phrasing.
2. **Direct Lake on OneLake vs. Direct Lake on SQL behave oppositely on guardrail breach** — OneLake fails outright, SQL falls back to DirectQuery. The single most repeated Domain 3 miss across all three mocks.
3. **`DefaultReader`'s virtual membership silently defeats a new restrictive OneLake security role** unless it's deleted or the user's `ReadAll` is removed — "I added a narrow role but the user still sees everything" is describing this.
4. **A watermark never rejects late data** — it only bounds how long state is retained for dedup/windowed aggregation. Late data isn't dropped, just excluded from an already-finalized window's result.
5. **Result-set caching is tenant-disabled right now in Fabric Warehouse** — a `result_cache_hit = 0` today may simply mean the feature is off, not that a query tripped a disqualifier.
6. **Activator cannot alert directly from the Capacity Metrics app or the SQL analytics endpoint** — route those through Real-Time hub capacity events / the Warehouse SQL query preview mechanism instead.
7. **V-Order defaults to OFF on new workspaces** — don't assume older material or intuition that says "V-Order is on" still applies.
8. **AQE is already on by default everywhere** — "enable AQE" as a proposed fix is always a distractor; the real question is why it isn't fully absorbing the problem.
9. **RLS ignores `CONTROL`; DDM and OneLake security both honor it.** Don't apply one control's bypass rule to another — Warehouse T-SQL RLS filters even `db_owner`, but DDM and OneLake security are both bypassed by implicit Admin/Member/Contributor permissions.
10. **A `ForEach`-wrapped per-row pattern is never fixed by tuning `batchCount`** — same for Warehouse's row-by-row `INSERT` anti-pattern. Both need a set-based redesign, not parameter tuning.

---

## Stop Reading, Go Pass It

If you've worked through the 11 domain sections, all seven cheat sheets, the 82 practice questions, and at least one full mock exam scoring 70%+ per domain — you know this material better than this page can summarize. The facts above are the ones that repeatedly separate a pass from a near-miss; everything else you already have.

Close this file. Walk in. You've got this.

---

**[↑ Back to Overview](../dp-700-overview.md)**
