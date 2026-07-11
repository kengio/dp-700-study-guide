---
title: "DP-700 Companion Exams"
type: resource
tags:
  - dp-700
  - companion-exams
  - dp-600
  - pl-300
  - dp-800
  - certification-path
---

# DP-700 Companion Exams

> [!abstract]
>
> - **Microsoft Certified: Fabric Analytics Engineer Associate (DP-600)** — closest sibling exam; shares security/governance, lifecycle management, and star-schema data prep with DP-700, then diverges hard into DAX and semantic-model design
> - **Microsoft Certified: Power BI Data Analyst Associate (PL-300)** — lighter overlap; shares workspace security and Import/DirectQuery/Direct Lake framing, but is otherwise a Power BI Desktop authoring exam, not a data-engineering one
> - **Microsoft Certified: Developing AI-Enabled Database Solutions Associate (DP-800)** — meaningful overlap on security (RLS/DDM), CI/CD, and T-SQL fundamentals; DP-800 adds deep T-SQL (temporal/ledger/graph tables, JSON) and AI/vector content DP-700 never touches
> - Every retirement/active status below was WebFetch-verified against the live Microsoft Learn pages during this page's authoring — including a correction of a stale claim inherited from an older reference guide (see the DP-600 warning)

> [!tip] How to use this guide
>
> - **Deciding what to study next after DP-700?** Read the "What transfers from DP-700" table for each companion exam to see which domains you can skim vs. study deeply
> - **Already hold DP-800 or PL-300?** The reverse-direction notes under each section tell you what DP-700 adds on top of what you already know
> - **Stacking certifications?** The recommended-paths section sequences all four exams by role fit

---

## Companion exams at a glance

| Exam | Cert | Blueprint | Format | Status | DP-700 overlap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[DP-600](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-600)** | Fabric Analytics Engineer Associate | Jul 21, 2026 | ~100 min · scaled 700/1000 | Active | **Medium-high** (~45% of skills overlap, concentrated in security, lifecycle, and data prep) |
| **[PL-300](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/pl-300)** | Power BI Data Analyst Associate | Apr 20, 2026 | ~100 min · scaled 700/1000 | Active | **Low** (~20% overlap, mostly workspace security and storage-mode framing) |
| **[DP-800](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-800)** | Developing AI-Enabled Database Solutions Associate | current blueprint | ~50 q · 120 min · scaled 700/1000 | Active | **Medium** (~35% overlap, concentrated in security and CI/CD) |

> [!warning] Correcting a stale claim — DP-600 is NOT retired
> An earlier community reference (the [companion guide for DP-800](https://github.com/kengio/dp-800-study-guide)) describes DP-600 as retired. **That is out of date.** WebFetch-verified against the live Microsoft Learn certification page during this page's authoring: DP-600 is **active**, its blueprint refreshed on the **same July 21, 2026 date as DP-700**, and it carries a standard 12-month renewal cycle. If you've seen "DP-600 retired" anywhere, treat it as stale and check [the live cert page](https://learn.microsoft.com/en-us/credentials/certifications/fabric-analytics-engineer-associate/) before making a study-plan decision.

---

## DP-600 — Implementing Analytics Solutions Using Microsoft Fabric

**Audience.** Analytics engineers who design, build, and manage semantic models, warehouses, or lakehouses — the layer above raw data engineering, closer to the business-consumption side of Fabric.

**Skills at a glance.**

- Maintain a data analytics solution (25–30%)
- Prepare data (45–50%)
- Implement and manage semantic models (25–30%)

### What transfers from DP-700

| DP-700 section | DP-600 equivalent | Transfer % |
| :--- | :--- | :---: |
| [03-Security & Governance](../03-security-governance/security-governance.md) — workspace/item access, RLS/CLS/OLS, sensitivity labels, endorsement | "Implement security and governance" | 80% |
| [02-Lifecycle Management](../02-lifecycle-management/lifecycle-management.md) — version control, deployment pipelines | "Maintain the analytics development lifecycle" | 65% (DP-600 adds `.pbip` projects and XMLA-endpoint deployment specifics DP-700 doesn't test) |
| [05-Loading Patterns](../05-loading-patterns/loading-patterns.md) — dimensional model loading, star schema prep | "Implement a star schema for a lakehouse or warehouse" (Prepare data) | 55% |
| [07-Batch Transformation](../07-batch-transformation/batch-transformation.md) — denormalize, aggregate, merge/join, dedupe, filter | "Transform data" (Prepare data) | 50% (DP-600 adds Visual Query Editor and DAX query surfaces DP-700 never uses) |
| [06-Batch Ingestion](../06-batch-ingestion/batch-ingestion.md) — OneLake shortcuts, data store choice | "Discover data by using OneLake catalog and Real-Time hub" + "Choose between different data stores" (Get data) | 45% |
| [09-Monitoring & Alerting](../09-monitoring-alerting/monitoring-alerting.md) — semantic model refresh, Direct Lake framing/fallback | "Configure Direct Lake, including default fallback and refresh behavior" | 40% (DP-700 tests this from the monitoring/troubleshooting angle; DP-600 tests it from the modeling/configuration angle) |

**Net-new in DP-600** (no DP-700 prep coverage):

- DAX language depth — variables, iterators, table filtering, windowing functions, information functions, calculation groups, dynamic format strings, field parameters
- Semantic model design — star schema for a semantic model, bridge tables, many-to-many relationships, composite models, large semantic model storage format
- Choosing storage mode (Import/DirectQuery/Direct Lake) as a *modeling decision*, not a monitoring/troubleshooting one
- Power BI Desktop project files (`.pbip`), template (`.pbit`), and data source (`.pbids`) reusable-asset workflows
- DAX/report-visual performance tuning (Performance Analyzer, DAX query view)
- Impact analysis of downstream dependencies from lakehouses, warehouses, dataflows, and semantic models

**Recommended prep budget if you already have DP-700.** Roughly **35–40% less** than starting from scratch. Skip re-studying security/governance and lifecycle management in depth; concentrate new hours on DAX and semantic-model design, which is the majority of DP-600's "Prepare data" and all of "Implement and manage semantic models."

---

## PL-300 — Microsoft Power BI Data Analyst

**Audience.** Business-facing data analysts who prepare data, build semantic models, and design reports primarily inside Power BI Desktop — largely orthogonal to DP-700's Fabric data-engineering scope.

**Skills at a glance.**

- Prepare the data (25–30%)
- Model the data (25–30%)
- Visualize and analyze the data (25–30%)
- Manage and secure Power BI (15–20%)

### What transfers from DP-700

| DP-700 section | PL-300 equivalent | Transfer % |
| :--- | :--- | :---: |
| [03-Security & Governance](../03-security-governance/security-governance.md) — workspace roles, item access | "Assign workspace roles" + "Configure item-level access" (Manage and secure Power BI) | 45% (PL-300 also tests RLS *group membership* configuration, a Power BI–specific workflow DP-700 doesn't cover) |
| [05-Loading Patterns](../05-loading-patterns/loading-patterns.md) — full/incremental loads, streaming loading pattern | "Choose between DirectLake, DirectQuery, and Import" (Get or connect to data) | 30% (DP-700 tests this as a Fabric-engineering framing decision; PL-300 tests it as a report-authoring tradeoff) |
| [06-Batch Ingestion](../06-batch-ingestion/batch-ingestion.md) — choosing a data store | "Identify and connect to data sources or a shared semantic model" | 20% |
| [09-Monitoring & Alerting](../09-monitoring-alerting/monitoring-alerting.md) — semantic model refresh | "Configure a semantic model scheduled refresh" | 25% |

**Net-new in PL-300** (no DP-700 prep coverage):

- Power Query transformation authoring inside Power BI Desktop (pivot/unpivot/transpose, reference vs. duplicate queries, data profiling)
- DAX measures, calculated columns/tables, time intelligence, quick measures, calculation groups
- Report design — visual selection, formatting, bookmarks, custom tooltips, drillthrough, Copilot-assisted report authoring, accessibility, mobile layout
- Analytics features — grouping/binning/clustering, AI visuals, forecasting, anomaly detection, the Analyze feature
- Row-level security *authoring* (roles + DAX filter expressions), as distinct from DP-700's *enforcement-layer* RLS/CLS/OLS on Warehouse/OneLake

**Recommended prep budget if you already have DP-700.** Only **15–20% less** than starting from scratch — PL-300 is a genuinely different exam (report authoring and DAX-first analytics) rather than a deeper layer on the same stack. Treat DP-700 as light context, not meaningful prep credit.

---

## DP-800 — Developing AI-Enabled Database Solutions

**Audience.** Database engineers extending SQL Server/Azure SQL/Fabric SQL database with AI capabilities (vector search, RAG, embeddings) — see the [companion guide for DP-800](https://github.com/kengio/dp-800-study-guide) for the full study path in the other direction.

**Skills at a glance.**

- Design and develop (35–40%)
- Secure, optimize, deploy (35–40%)
- AI capabilities (25–30%)

### What transfers from DP-700

| DP-700 section | DP-800 equivalent | Transfer % |
| :--- | :--- | :---: |
| [03-Security & Governance](../03-security-governance/security-governance.md) — RLS/CLS/OLS, dynamic data masking | RLS + DDM (Secure, optimize, deploy) | 75% (DP-800's RLS/DDM are SQL Server–flavored — `BLOCK` predicates and `CONTROL`-bypass details differ slightly from Fabric Warehouse's FILTER-only model) |
| [02-Lifecycle Management](../02-lifecycle-management/lifecycle-management.md) — database projects, deployment pipelines, CI/CD | SQL Database Projects, `.dacpac`/SqlPackage, schema drift detection | 60% |
| [07-Batch Transformation](../07-batch-transformation/batch-transformation.md) — T-SQL transformations (MERGE, window functions, CTEs) | T-SQL core commands (Design and develop) | 40% (DP-800 goes much deeper on T-SQL specifics — temporal tables, ledger tables, graph tables, JSON functions — none of which DP-700 tests) |
| [11-Performance Optimization](../11-performance-optimization/performance-optimization.md) — Warehouse statistics, query insights | Query Store, isolation levels, performance tuning | 40% |

**Net-new in DP-800** (no DP-700 prep coverage):

- AI capabilities domain entirely: `VECTOR` data type, `VECTOR_DISTANCE`/`VECTOR_SEARCH`, RAG pattern, embedding/chunking strategy, `sp_invoke_external_rest_endpoint`, hybrid search with RRF
- Deep T-SQL surface: temporal tables, ledger tables, graph tables (`MATCH`), JSON functions (`JSON_VALUE`/`JSON_QUERY`/`OPENJSON`), SEQUENCE vs. IDENTITY
- Always Encrypted (client-side column encryption), Transparent Data Encryption
- Isolation-level depth (SNAPSHOT vs. RCSI vs. SERIALIZABLE), Query Store plan forcing
- Data API Builder (DAB), Change Data Capture vs. Change Tracking on SQL Server/Azure SQL specifically

**Recommended prep budget if you already have DP-700.** Roughly **25–30% less** than starting from scratch. The security and CI/CD overlap is real, but DP-800's T-SQL depth and entire AI-capabilities domain are net-new study time — plan for a substantial fraction of DP-800's ~60-hour cold-start estimate regardless of your DP-700 background.

---

## Recommended paths

### Path A: DP-700 → DP-600 (data engineering to analytics engineering)

- **Best for**: Fabric data engineers who want to move up the stack into semantic modeling and DAX-driven analytics ownership
- **Why**: DP-700's security/governance and lifecycle-management sections are the bridge — DP-600 reuses the same access-control and CI/CD primitives, then adds DAX and semantic-model design on top
- **Sequence**: DP-700 → 2–4 weeks DAX-focused study → DP-600
- **Total time investment**: ~85 hours (~55 for DP-700 cold start, ~30 for DP-600 with overlap credit)

### Path B: DP-700 → DP-800 (data engineering to AI-enabled databases)

- **Best for**: Fabric data engineers who want to extend into SQL-native AI features (RAG, vector search) without leaving the Microsoft data stack
- **Why**: DP-700's T-SQL transformation and security sections give partial credit, but DP-800's AI-capabilities domain is a genuinely new skill area
- **Sequence**: DP-700 → 3 months consolidation → DP-800 (see [DP-800's own companion-exams guide](https://github.com/kengio/dp-800-study-guide/blob/main/certification/resources/companion-exams.md) for the reverse-direction view)
- **Total time investment**: ~100 hours (~55 for DP-700, ~45 for DP-800 with overlap credit)

### Path C: DP-700 standalone, revisit PL-300 only if the role changes

- **Best for**: Engineers whose role is squarely data-engineering-in-Fabric; report authoring is someone else's job
- **Why**: PL-300's overlap with DP-700 is real but shallow — it's a different skill (Power Query/DAX/report design) rather than a deeper layer on the same one
- **Sequence**: Pass DP-700 → renew annually (see [renewal-guide.md](./renewal-guide.md)) → only pursue PL-300 if your role expands into report authoring
- **Total time investment**: ~55 hours initial + ~3 hours per annual renewal

### Path D: DP-700 → DP-600 → DP-800 (full Fabric + AI-database surface)

- **Best for**: Platform leads or architects whose role spans data engineering, analytics engineering, and database-adjacent AI work
- **Why**: Together these three certs cover data ingestion/transformation (DP-700), semantic modeling/analytics (DP-600), and SQL-native AI (DP-800) — the full "data + AI on Microsoft Fabric and SQL" surface
- **Sequence**: DP-700 → DP-600 (close overlap, sequence immediately) → DP-800 (separate consolidation window)
- **Total time investment**: ~140 hours total

---

## Exam-blueprint comparison

| Attribute | DP-700 | DP-600 | PL-300 | DP-800 |
| :--- | :---: | :---: | :---: | :---: |
| **Cert level** | Associate | Associate | Associate | Associate |
| **Validity** | 1 year (annual renewal) | 1 year (annual renewal) | 1 year (annual renewal) | 1 year (annual renewal) |
| **Cost** | $165 USD | $165 USD | $165 USD | $165 USD |
| **Duration** | 100 min | 100 min | 100 min | ~120 min |
| **Domains** | 3 | 3 | 4 | 3 |
| **Case study?** | Yes | Not confirmed in current blueprint text | Not confirmed in current blueprint text | Yes (5-question block) |
| **Practice assessment** | Free on MS Learn | Free on MS Learn | Free on MS Learn | Free on MS Learn |
| **Renewal** | Free, unproctored, open-book | Free, unproctored, open-book | Free, unproctored, open-book | Free, unproctored, open-book |

---

## Use Cases

- **Career-laddering**: pick your next exam based on whether you're moving toward semantic modeling (DP-600), report authoring (PL-300), or SQL-native AI (DP-800)
- **Team planning**: identify which certifications cover which gaps on a data + analytics + AI team
- **Hiring**: understand what a DP-700 holder already knows that transfers to a DP-600, PL-300, or DP-800 role
- **Cert-stacking**: sequence multiple certifications efficiently by exploiting the overlap tables above

## Exam Tips

> [!tip] Exam Tips for stacking
>
> - **DP-600 first if your day job touches semantic models or DAX**, PL-300 first if it's report authoring, DP-800 first if it's SQL-native AI. Sequence by relevance to current work, not blueprint date
> - **Don't pay for the same skill twice.** If you've done DP-700 prep, skip the overlap rows above for the next exam — your time is better spent on net-new content
> - **Verify retirement/active status yourself before committing prep hours.** Blueprints and certification lifecycles change; this page's DP-600 correction is proof that even adjacent community guides can carry stale claims
> - **Renewals stack independently.** Each certification has its own 1-year renewal window. Calendar them.

## Related Topics

- [Renewal Guide](./renewal-guide.md) — DP-700-specific renewal workflow
- [Final Review](./final-review.md) — DP-700 exam-morning scan
- [Exam Tips](./exam-tips.md) — DP-700-specific strategies (some transfer to companion exams)
- [Official Links](./official-links.md) — Microsoft Learn entry points

## Official Documentation

- [DP-700 Skills Measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) — current blueprint with change log
- [DP-600 Skills Measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-600) — current blueprint with change log
- [PL-300 Skills Measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/pl-300) — current blueprint with change log
- [DP-800 Skills Measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-800) — current blueprint with change log
- [Microsoft Certification Path Browser](https://learn.microsoft.com/en-us/credentials/browse/) — full catalogue
- [Fabric Analytics Engineer Associate cert page](https://learn.microsoft.com/en-us/credentials/certifications/fabric-analytics-engineer-associate/)
- [Power BI Data Analyst Associate cert page](https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/)
- [DP-800 Study Guide (companion repository)](https://github.com/kengio/dp-800-study-guide) — the reverse-direction path for DP-800 holders

---

**[↑ Back to Overview](../dp-700-overview.md)**
