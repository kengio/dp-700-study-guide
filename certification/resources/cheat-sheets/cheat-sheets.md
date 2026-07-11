---
title: DP-700 Cheat Sheets
type: resources
tags:
  - dp-700
  - cheat-sheets
  - quick-reference
aliases:
  - Cheat Sheets Index
---

# DP-700 — Cheat Sheets

Quick-reference guides for high-frequency exam topics. Each sheet is designed for fast lookup during study sessions — not a substitute for the full topic files, but a compact refresher condensed and verified against them.

## Available Cheat Sheets

| Cheat Sheet | Purpose | Use after |
| :--- | :--- | :--- |
| [Decision Matrices](./decision-matrices-quick-ref.md) | THE picker sheet — store, transform tool, orchestration tool, streaming engine, shortcuts vs. mirroring vs. copy, native tables vs. shortcuts, all on one page | Sections 04, 06, 07, 08 |
| [Language Syntax Map](./language-syntax-map.md) | PySpark ↔ T-SQL ↔ KQL rosetta — read/filter/select/join/aggregate/window/dedup/null-handling/write/upsert side by side | Section 07 (all subtopics), 08/05 |
| [Security & Governance](./security-governance-quick-ref.md) | Workspace roles, item permissions, the Who-Bypasses-What bypass matrix, OneLake security, DDM, labels/endorsement, audit logs | Section 03 (all subtopics) |
| [Streaming & Windowing](./streaming-windowing-quick-ref.md) | Engine matrix, Eventstream operators/limits, Spark output modes/triggers, KQL ingestion, window-type × surface support, watermark rules | Section 08 (all subtopics), 05/03 |
| [Monitoring & Surfaces](./monitoring-surfaces-quick-ref.md) | The symptom→surface Domain 3 Triage Spine, semantic model refresh/framing, Activator sources/actions/limits, Capacity Metrics app | Section 09 (all subtopics) |
| [Optimization Levers](./optimization-levers-quick-ref.md) | Symptom→lever master table across Lakehouse/Warehouse/Spark/Real-Time/Pipeline, V-Order/OPTIMIZE/VACUUM numbers | Section 11 (all subtopics), Section 10 |
| [Lifecycle & CI/CD](./lifecycle-cicd-quick-ref.md) | Git integration, database projects, deployment pipelines, workspace settings (Spark/domains/OneLake/Airflow) | Sections 01, 02 |

## How to Use Cheat Sheets

- **Before a study session** — skim the relevant sheet to activate prior knowledge before reading the full topic files.
- **After completing a section** — use the matching sheet to self-test recall; every sheet ends with a **Gotchas & Traps** list and a **Before the Exam, I Can…** checklist.
- **During practice questions** — keep the relevant sheet open on a second screen; attempt the answer first, then check the sheet — active recall beats passive re-reading.
- **Final review** — read all seven sheets end-to-end as a last pass before the exam; each `==highlight==` marks the single most testable fact in its table.
- These sheets are deliberately dense and table-heavy — they condense the full topic files, they don't replace them. When a fact needs more context (a worked scenario, a full code example, the "why"), follow the link back into the section it was drawn from.

> [!tip] Study Tip
> Print these cheat sheets or keep them open on a second screen during practice questions. Active recall works best when you attempt the answer first, then check the cheat sheet — avoid reading passively.

---

**[← Back to Overview](../../dp-700-overview.md)**
