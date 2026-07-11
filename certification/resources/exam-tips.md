---
title: DP-700 Exam Tips
type: exam-tips
tags:
  - dp-700
  - exam-tips
  - strategy
---

# DP-700 Exam Tips

> [!abstract]
>
> - Realistic time budget for 100 minutes — question count unpublished by Microsoft; this guide's mocks use 50 as a realistic proxy (45 standalone + a 5-question case study)
> - Strategies by question type: scenario multi-constraint, elimination tactics for this guide's documented distractor patterns, review-flag strategy
> - Case-study playbook: read the whole scenario first, map facts to sub-questions
> - Exam-day logistics verified against current Microsoft policy — proctored, Pearson VUE, online or test center
> - Pointer to the [renewal guide](./renewal-guide.md) for after you pass

> [!tip] What the Exam Tests
>
> - DP-700 leans heavily on "choose between X/Y/Z" decision questions (data store, transform tool, orchestration tool, streaming engine) and multi-constraint scenarios where two options both look plausible until one fact eliminates it
> - Distractors are deliberately built from real but misapplied Fabric behavior — not made-up features — so recognizing the *pattern* of a distractor matters more than memorizing an exhaustive fact list
> - The case study blends 2–3 domains in one scenario, mirroring the real exam's cross-domain design

---

## Exam Format

| Detail | Information |
| :--- | :--- |
| **Passing score** | 700 / 1000 (scaled, not a raw percentage) |
| **Duration** | 100 minutes (associate role-based exam without labs) |
| **Seat duration** | ~120 minutes (includes agreement, instructions, and comment time) |
| **Question count** | Question count unpublished by Microsoft — this guide's mocks use 50 as a realistic proxy (45 standalone + 5-question case study), matching this repo's mock exams |
| **Question types** | Multiple choice, multi-select, drag-and-drop, hot area, build list, active screen, case studies |
| **Proctoring** | This exam is proctored |
| **Languages** | English, Japanese, Chinese (Simplified), German, French, Spanish, Portuguese (Brazil); +30 minutes if taken in a non-English language you're less fluent in |
| **Retake policy** | 24 hours after a first fail; wait time increases for subsequent retakes |
| **Scoring** | No penalty for guessing — every question is worth attempting; some unscored pilot questions are mixed in, indistinguishable from scored ones |

## Time Management

DP-700's 100-minute window is tighter than DP-800's 120 minutes, so pacing discipline matters more here.

| Block | Allocation | Pace |
| :--- | :--- | :--- |
| Standalone questions (~45) | ~75 min | ≈ 1:40 per question |
| Case-study block (5 sub-questions) | ~20 min | Read scenario once (~3 min), then ~3:30 per sub-question |
| Final review of flagged questions | ~5 min | Triage, don't re-derive from scratch |

- **Skip and flag, don't stall.** If a question needs more than ~2 minutes of first-pass thought, mark it for review and move on — a 100-minute exam punishes getting stuck harder than a 120-minute one.
- **Watch for multi-select wording.** "Select all that apply" has no fixed count; "select the best two" caps you at two — misreading this costs points even when you know the material.
- **Case studies eat time fastest when you re-read the scenario per sub-question.** Read it once, end to end, before opening question one.
- **Leave the last 5 minutes for flagged questions only** — don't start a fresh multi-constraint question with 3 minutes left.

## Question-Type Strategies

### Scenario Multi-Constraint Questions

Most DP-700 questions describe a business scenario with 2–4 stated constraints (data volume, latency requirement, skill profile, cost sensitivity, existing tooling) and ask for the "best" option among plausible-looking choices.

- **List the constraints before reading the options.** A scenario naming "150 GB nightly batch, low-code team, 150+ source connectors" is pointing at Dataflow Gen2 before you've even read the answer choices — pattern-match to this guide's decision matrices first, then verify against the options.
- **Eliminate options that fail *any single* stated constraint** before comparing the survivors on nuance. A technically-capable option that violates one named constraint is never the "best" answer, even if it would technically work.
- **When two tools both "work," the scenario is usually describing composition, not a single winner.** A requirement that names both coordination *and* custom transformation logic wants two tools together (e.g., pipeline + notebook), not a single "best" tool — this guide's decision-matrices cheat sheet calls this out explicitly for orchestration and streaming.
- **Watch for the managed/lower-ops option winning ties.** When two answers both satisfy every stated constraint, Microsoft exams consistently reward the more managed, lower-infrastructure option (e.g., mirroring over custom pipeline replication, Activator over a custom polling script).

### Case-Study Playbook

DP-700 mirrors DP-800's interactive case-study format — one multi-paragraph scenario, several linked sub-questions.

- **Read the full scenario once, end to end, before opening the first sub-question.** Requirements stated near the end of the scenario often reframe details from the opening paragraphs.
- **Map facts to sub-questions as you read**, not after — jot a one-line note per stated requirement (workspace layout, security constraint, performance target, existing tooling) so you're not re-scanning the full scenario for each sub-question.
- **You can move between sub-questions inside a case study, but once you submit the case study block you can't return to it** — use the in-exam Review/flag mechanism inside the case before moving on.
- **Case studies are cross-domain by design.** This guide's three mock-exam case studies (Fabrikam Freight, and two more) each blend orchestration, security, and performance in one scenario — expect the real exam to do the same. Don't assume a case study only tests the domain its opening paragraph seems to be about.
- **The "best" answer satisfies every stated constraint** — eliminate any option that fails one requirement before comparing the rest on cost or elegance.

> **Practice with the case studies in this guide:** [Mock Exam 1](./mock-exam/questions.md), [Mock Exam 2](./mock-exam-2/questions.md), [Mock Exam 3](./mock-exam-3/questions.md) — each ends with a 5-question case-study block (Qs 46–50) matching the real DP-700 format.

## Elimination Tactics for This Guide's Distractor Patterns

The cheat sheets and topic files document specific, repeatable distractor patterns Microsoft-style questions use. Recognizing the *shape* of these eliminates wrong answers fast, even under time pressure.

| Distractor pattern | Why it's wrong | Where it's documented |
| :--- | :--- | :--- |
| "Full T-SQL DML on curated lakehouse/eventhouse data" | SQL analytics endpoints on lakehouse/eventhouse/mirrored-DB are always read-only | [decision-matrices cheat sheet](./cheat-sheets/decision-matrices-quick-ref.md) |
| "Enable AQE to fix this Spark performance issue" | AQE is already on by default in every runtime | [optimization-levers cheat sheet](./cheat-sheets/optimization-levers-quick-ref.md) |
| "Use a BLOCK predicate for Fabric Warehouse RLS" | Fabric Warehouse RLS supports FILTER predicates only; BLOCK is SQL Server/Azure SQL | [security-governance cheat sheet](./cheat-sheets/security-governance-quick-ref.md) |
| "Alert directly from the Capacity Metrics app" | Capacity Metrics app cannot fire alerts under any circumstance | [monitoring-surfaces cheat sheet](./cheat-sheets/monitoring-surfaces-quick-ref.md) |
| "A named KQL hopping/sliding window function" | KQL has no dedicated hopping or sliding operator — only `bin()` composition | [language-syntax-map cheat sheet](./cheat-sheets/language-syntax-map.md) |
| "The watermark rejected/dropped the late-arriving row" | A watermark only bounds state retention — it never rejects data from the source stream | [streaming-windowing cheat sheet](./cheat-sheets/streaming-windowing-quick-ref.md) |
| "Shorten Eventhouse retention to speed up queries" | Retention controls what exists; caching policy is the query-speed lever | [optimization-levers cheat sheet](./cheat-sheets/optimization-levers-quick-ref.md) |
| "Direct Lake on OneLake falls back to DirectQuery on a guardrail breach" | Only the SQL variant falls back; OneLake variant fails outright | [monitoring-surfaces](./cheat-sheets/monitoring-surfaces-quick-ref.md) / [optimization-levers](./cheat-sheets/optimization-levers-quick-ref.md) cheat sheets |
| "Query acceleration unlocks materialized views on a shortcut" | Acceleration is a query-speed fix only — MV/update-policy support stays native-table-only | [decision-matrices](./cheat-sheets/decision-matrices-quick-ref.md) / [streaming-windowing](./cheat-sheets/streaming-windowing-quick-ref.md) cheat sheets |
| "A Contributor role alone is enough to configure a gateway refresh" | Gateway permission is a third independent axis, separate from workspace role | [security-governance cheat sheet](./cheat-sheets/security-governance-quick-ref.md) |

General elimination heuristics beyond this guide's specific patterns:

- **"Always"/"never" in an option is often correct when it matches a documented hard rule** (e.g., "Warehouse RLS always filters `db_owner`") but is a trap when it overclaims outside that rule's actual scope.
- **An option requiring a Preview feature to be "the" production answer is suspicious** unless the scenario explicitly says Preview features are acceptable — most questions target GA behavior.
- **The most code-heavy option is rarely "best" for a scenario emphasizing low-code/managed/citizen-developer needs** — match skillset before expressiveness, per the decision-matrices heuristic.

## Review-Flag Strategy

- **Flag on first pass, don't second-guess yet.** If you're not confident within ~90 seconds, flag and move — re-litigating a hard question early burns time you'll need later.
- **Answer something before flagging.** Never leave a flagged question blank; there's no penalty for a wrong guess, but a blank answer guarantees zero points.
- **Triage flagged questions by confidence, not by order.** In your final review pass, resolve the ones where you remember the relevant fact but need 10 seconds to confirm, before spending time on the ones you're genuinely unsure about.
- **Don't change an answer without a specific reason.** If nothing new comes to mind on review, your first read of the scenario is usually more reliable than a re-guess under time pressure.
- **Case-study sub-questions can't be revisited after the block is submitted** — do your flagging and review *inside* the case study, not after moving on.

## Exam-Day Logistics

| Detail | Information |
| :--- | :--- |
| **Scheduling** | Through Pearson VUE, linked from your Microsoft Learn certification profile |
| **Delivery options** | Pearson VUE offers both a **test center** appointment and **online proctoring (OnVUE)** for this exam — choose during scheduling based on availability and personal preference |
| **Online proctoring basics** | A live remote proctor monitors via webcam; requires a private room, valid photo ID, and a compatible system check beforehand (run Pearson VUE's system test in advance, not the morning of) |
| **Unscheduled breaks** | Allowed at any point except mid-lab or mid-problem/solution set; the exam clock keeps running during a break, and you cannot return to questions viewed before the break |
| **Microsoft Learn access during the exam** | Available on this exam (role-based, not fundamentals) — a split-screen browser to learn.microsoft.com, excluding Q&A, Practice Assessments, and your profile; the timer keeps running while you use it |
| **Accommodations** | Available for assistive devices, extra time, or format changes — must be requested before scheduling, not on exam day |
| **Personal account recommended** | Register with a personal Microsoft account (MSA), not an organizational one — org-account exam records are lost if you leave the organization |

- **Test the online-proctoring setup the day before, not the morning of.** A failed system check on exam morning eats into your appointment window.
- **Have your ID ready and your space cleared** if going the online-proctored route — extra papers, second monitors, or phones in view can trigger a proctor intervention.
- **If you'd rather not deal with home-environment scrutiny, a test center removes that variable entirely** — same exam, same duration, different environment tradeoffs.

## After You Pass

Certifications expire annually. See the [Renewal Guide](./renewal-guide.md) for the free, unproctored, open-book renewal workflow and what to re-study when your window opens.

---

## Use Cases

- **First-time DP-700 candidates** planning study time against a hard 100-minute exam window
- **Repeat test-takers** diagnosing whether their previous miss pattern was a knowledge gap or a pacing/strategy gap
- **Anyone deciding between online and test-center proctoring** for exam day

## Related Topics

- [Final Review](./final-review.md) — the 20-minute exam-morning scan
- [Official Links](./official-links.md) — Microsoft Learn entry points, sandbox, and scheduling
- [Companion Exams](./companion-exams.md) — how DP-700 relates to DP-600, PL-300, and DP-800
- [Renewal Guide](./renewal-guide.md) — what happens after you pass

## Official Documentation

- [DP-700 skills measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) — current blueprint with change log
- [Exam duration and exam experience](https://learn.microsoft.com/en-us/credentials/support/exam-duration-exam-experience) — breaks, Microsoft Learn access, question types
- [Exam scoring and score reports](https://learn.microsoft.com/en-us/credentials/certifications/exam-scoring-reports) — scaled scoring, guessing policy, retake rules
- [Fabric Data Engineer Associate certification page](https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/) — scheduling, languages, accommodations
- [Exam sandbox](https://aka.ms/examdemo) — try the exam interface before test day

---

**[↑ Back to Overview](../dp-700-overview.md)**
