---
title: DP-700 Anki Deck
type: resource
tags:
  - dp-700
  - anki
  - spaced-repetition
---

# DP-700 Anki Deck

A starter spaced-repetition deck generated from the seven DP-700 cheat sheets. Use it to drill the highest-leverage facts — decision-matrix picks, PySpark/T-SQL/KQL syntax, the Who-Bypasses-What matrix, monitoring surfaces, V-Order numbers, and streaming/windowing rules — that the exam expects you to recall fast under time pressure.

> [!abstract] Quick Reference
>
> - 146 cards across seven cheat-sheet topics: decision matrices, language syntax map, lifecycle & CI/CD, monitoring & surfaces, optimization levers, security & governance, streaming & windowing
> - Distributed as `dp-700.tsv` (tab-separated Front/Back/Tags) for one-shot import into Anki
> - Every card is tagged `dp-700` plus an exam-domain tag and a cheat-sheet-topic tag for filtered study

> [!tip] What the Exam Tests
>
> - DP-700 questions hinge on recall of decision-matrix verdicts (which tool/store/engine wins a scenario), exact syntax across three languages, and specific numbers (V-Order write cost, retention days, rate limits)
> - Spaced repetition is the most efficient way to lock in this style of factual surface area — especially the "which one wins" bypass and fallback rules that show up as distractors
> - Use the deck in parallel with cheat-sheet review — drill recall, then revisit the cheat sheet for the worked scenario when a card is wrong

---

## Import instructions

1. Open Anki desktop. Switch to the deck you want to import into (or create a new "DP-700" deck).
2. Choose **File → Import…** and select `dp-700.tsv`.
3. Set the import options:
   - **Field separator**: Tab
   - **Allow HTML in fields**: off
   - **Field mapping**: column 1 → Front, column 2 → Back, column 3 → Tags
   - **Type**: Basic note type (or any 2-field type — Anki ignores extra fields)
4. Click **Import** and confirm. Anki reports the number of new cards added.
5. Optional: use the tag filter (e.g., `tag:security-governance`) to drill one cheat sheet at a time, or `tag:d1-implement-manage` to drill by exam domain.

---

## Card breakdown

| Topic | Source | Card count | Tags column |
| :--- | :--- | ---: | :--- |
| Decision Matrices | [decision-matrices-quick-ref.md](../cheat-sheets/decision-matrices-quick-ref.md) | 20 | `dp-700 d1/d2-… decision-matrices …` |
| Language Syntax Map | [language-syntax-map.md](../cheat-sheets/language-syntax-map.md) | 21 | `dp-700 d2-ingest-transform language-syntax-map …` |
| Lifecycle & CI/CD | [lifecycle-cicd-quick-ref.md](../cheat-sheets/lifecycle-cicd-quick-ref.md) | 22 | `dp-700 d1-implement-manage lifecycle-cicd …` |
| Monitoring & Surfaces | [monitoring-surfaces-quick-ref.md](../cheat-sheets/monitoring-surfaces-quick-ref.md) | 19 | `dp-700 d3-monitor-optimize monitoring-surfaces …` |
| Optimization Levers | [optimization-levers-quick-ref.md](../cheat-sheets/optimization-levers-quick-ref.md) | 21 | `dp-700 d3-monitor-optimize optimization-levers …` |
| Security & Governance | [security-governance-quick-ref.md](../cheat-sheets/security-governance-quick-ref.md) | 23 | `dp-700 d1-implement-manage security-governance …` |
| Streaming & Windowing | [streaming-windowing-quick-ref.md](../cheat-sheets/streaming-windowing-quick-ref.md) | 20 | `dp-700 d2-ingest-transform streaming-windowing …` |
| **Total** |  | **146** |  |

Domain tags: `d1-implement-manage` (Domain 1), `d2-ingest-transform` (Domain 2), `d3-monitor-optimize` (Domain 3) — assigned by the card's actual content, not just its source sheet (the decision-matrices sheet spans both D1 orchestration-tool cards and D2 data-store/transform-tool/streaming-engine cards).

Sub-topic tags include `data-store`, `transform-tool`, `orchestration-tool`, `mirroring-shortcuts`, `query-acceleration`, `streaming-engine`, `dedup`, `t-sql`, `pyspark`, `kql`, `windowing`, `git`, `database-projects`, `deployment-pipelines`, `spark-settings`, `domain-settings`, `onelake-settings`, `airflow`, `triage`, `monitor-hub`, `semantic-model-refresh`, `activator`, `capacity-metrics`, `lakehouse`, `warehouse`, `spark`, `real-time`, `pipeline`, `workspace-roles`, `item-permissions`, `who-bypasses-what`, `granular-access`, `onelake-security`, `ddm`, `sensitivity-labels`, `endorsement`, `audit-logs`, `eventstream`, `spark-streaming`, `kql-ingestion`, `window-types`, `watermark`, `medallion`. Filter with `tag:dp-700 tag:who-bypasses-what` to drill a single concept.

---

## Maintenance

The deck mirrors facts already documented in the seven cheat sheets — every card's back is verbatim or near-verbatim from the source. If a cheat sheet is updated (e.g., a threshold number changes, a Preview feature graduates to GA, the July 21 blueprint shifts again), the corresponding rows in `dp-700.tsv` should be reviewed and edited by hand. There is no automation script — the deck is intentionally simple to keep the contribution surface small.

When updating, prefer editing existing rows over inserting new ones, so anyone who has already imported the deck does not get duplicates. If you do add new rows, append them at the end of the file and call out the addition in `CHANGELOG.md`.

---

## Related Topics

- [Decision Matrices](../cheat-sheets/decision-matrices-quick-ref.md)
- [Language Syntax Map](../cheat-sheets/language-syntax-map.md)
- [Lifecycle & CI/CD](../cheat-sheets/lifecycle-cicd-quick-ref.md)
- [Monitoring & Surfaces](../cheat-sheets/monitoring-surfaces-quick-ref.md)
- [Optimization Levers](../cheat-sheets/optimization-levers-quick-ref.md)
- [Security & Governance](../cheat-sheets/security-governance-quick-ref.md)
- [Streaming & Windowing](../cheat-sheets/streaming-windowing-quick-ref.md)
- [Cheat Sheets Index](../cheat-sheets/cheat-sheets.md)

## Official Documentation

- [DP-700 skills measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) — current blueprint with change log

---

**[↑ Back to Overview](../../dp-700-overview.md)**
