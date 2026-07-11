---
title: "DP-700 Renewal Guide"
type: resource
tags:
  - dp-700
  - renewal
  - certification
---

# DP-700 Renewal Guide

> [!abstract]
>
> - Microsoft Certified: Fabric Data Engineer Associate **expires annually** — you renew with a **free, unproctored, open-book online assessment** on Microsoft Learn during your six-month renewal window
> - The renewal assessment is **shorter than the original exam** and focuses on **what's changed in the blueprint since you passed** — not the full skills-measured list
> - You can **retake as many times as you need** until you pass, as long as you finish before the certification expires
> - **Fundamentals certifications never expire** — only associate, expert, and specialty (DP-700 is associate, so it does expire)

> [!tip] What the renewal tests
>
> Microsoft says renewal assessments focus on **"recent technological and industry updates"** — i.e., the diff between the blueprint version current at your original exam and the blueprint as of your renewal attempt. Translating that to DP-700: if Microsoft promotes Dataflow Gen2 public parameters, Warehouse `IDENTITY` columns, or Spark Runtime 2.0 from preview to GA, reshuffles a workspace-settings skill (as it did with Apache Airflow on July 21, 2026), or changes a documented threshold number, **that's what you study**.

---

## How renewal works

| What | Detail |
| :--- | :--- |
| **Validity** | 1 year from the date you earn (or last renew) the certification. Fundamentals (DP-900, AZ-900, etc.) are exempt and never expire. |
| **Renewal window** | The six-month period **before** your certification's expiration date. Microsoft emails you when you become eligible. |
| **Cost** | Free. |
| **Where** | Microsoft Learn, via your [certification profile](https://learn.microsoft.com/en-us/users/) → the "Renew" button next to your DP-700 credential. |
| **Format** | Online, **unproctored**, **open-book**. No camera, no proctor lockdown — Microsoft trusts the open-book format. |
| **Length** | Shorter than the original 100-minute exam. Expect a focused subset of questions aligned to the most recent blueprint changes. |
| **Retake policy** | Take it **as many times as you need** until you pass, as long as the final passing attempt lands before your expiration date. No 24-hour cooldown like the original exam. |
| **Pass mark** | Same 700/1000 scaled score as the original. |
| **Outcome** | Passing extends your certification **1 year from the current expiration date** (not from the day you pass), so you don't lose time by renewing early in the window. |
| **What if you don't renew** | The certification expires. You can no longer claim it on your transcript, and the only path back is **retaking the full DP-700 exam** at the current ($165 USD as of 2026) price. |

Source: [Microsoft Certification Renewal](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification) and [renewal FAQ](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification-faq).

---

## How to prepare

Because the renewal assessment focuses on **what's new**, the prep cycle is the inverse of the original exam:

1. **Note the blueprint date your original exam covered.** The official skills-measured page shows the current "Skills measured as of …" date at the top. Compare it to the version that was current when you sat the exam. (If you don't remember, your Microsoft Learn certificate PDF lists the exam date.)
2. **Read the "Change log" section** on the current [DP-700 skills-measured page](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700). Microsoft is generally good about flagging what changed and how minor/major each change is.
3. **Cross-reference with this study guide's [`CHANGELOG.md`](../../CHANGELOG.md)** — the maintainer tracks blueprint refreshes, currency-policy updates, and the highest-leverage facts that moved. The most-recent entries are usually the most-likely renewal-assessment material.
4. **Re-read the [final-review file](./final-review.md)** for the current blueprint date, especially the "The One July 21, 2026 Blueprint Change" section — a future renewal will likely add its own equivalent callout when the next refresh lands.
5. **Skim only the domain(s) where the blueprint moved** — don't re-read everything. If only Domain 1's workspace-settings wording changed since you sat the exam, skip Domains 2 and 3 entirely.

### Specific things to watch between blueprint refreshes (DP-700)

The features below are documented as **Preview** as of the July 21, 2026 blueprint this guide tracks. When Microsoft promotes any of these to GA, expect them to appear on the renewal:

- **Dataflow Gen2 public parameters** — currently Preview; a required public parameter blocks unattended scheduling today. GA would likely resolve that scheduling limitation, changing a documented gotcha in this guide's [lifecycle-cicd cheat sheet](./cheat-sheets/lifecycle-cicd-quick-ref.md)
- **Fabric Warehouse `IDENTITY` columns** — currently Preview, `bigint`-only, no custom seed/increment. GA would likely lift these constraints and could shift `ROW_NUMBER()` from "the GA-safe default" to "one option among several"
- **Spark Runtime 2.0 (Spark 4.1)** — currently Public Preview; Runtime 1.3 (Spark 3.5.5) is GA and default. Watch for Runtime 2.0 becoming the new default
- **Native execution engine (NEE)** — currently Preview overall, with documented gaps (no structured streaming, no JSON/XML, no ANSI mode). GA would likely close some of these gaps
- **Spark autotune** — currently Preview, off by default, incompatible with high concurrency/private endpoints/Runtime >1.2. GA would likely relax at least one of these incompatibilities
- **Apache Airflow jobs** — newly promoted from a Dataflow Gen2 wording to its own skill on July 21, 2026. Watch for Airflow-specific Preview features (e.g., private-networking/VNet support, currently unsupported) reaching GA next
- **Eventstream SQL operator and Spark Notebook destination** — both currently Preview. GA would add code-first stream processing as a fully supported alternative to the no-code operators

### What renewal does *not* re-test (typically)

- Core Fabric architecture (OneLake, workspaces, domains, capacity model). Stable since Fabric's GA.
- The PySpark/T-SQL/KQL rosetta patterns (latest-record-per-key, dedup, upsert syntax). Once documented, these stay stable.
- The Who-Bypasses-What matrix logic (RLS/DDM/OneLake security bypass rules). Stable access-control design, not a moving target.
- Query acceleration's query-speed-only scope (never unlocking materialized views on a shortcut). A settled architectural boundary, not a Preview feature.

If you nailed these on the original exam, don't burn time re-drilling them for the renewal.

---

## Renewal cadence + workflow

The optimal cadence:

```text
Original exam pass             →  certification valid 1 year
+10 to +12 months              →  renewal window opens (Microsoft emails you)
+11 months                     →  read the current skills-measured "Change log"
+11 months + 1 day             →  re-skim the corresponding final-review section
+11 months + 2 days            →  take the renewal assessment
+11 months + 2 days (if pass)  →  certification extended +1 year from original expiration
```

If you renew at the very start of the window (month 10), you only "gain" 2 months — but you also leave 4 months of buffer to retake if you fail. **Renew earlier in the window unless you have a strong reason to delay.**

---

## If you fail or miss the window

- **Fail attempts** don't have a cooldown — re-prep and try again within the same window.
- **Missing the window** means the certification expires; the only path back is **retaking the full DP-700 exam** at the current price. There is no extended grace period and no "lapsed but recoverable" status — once it's expired, your transcript no longer shows the cert as active.
- If you've moved to a related role, consider whether **another active certification** (see [companion-exams.md](./companion-exams.md) for DP-600, PL-300, and DP-800) better represents your current work before reactivating DP-700.

---

## Quick checklist — the morning of your renewal

- [ ] Open [`final-review.md`](./final-review.md) and re-read "The One July 21, 2026 Blueprint Change" section (or its future-refresh equivalent, once this guide is updated)
- [ ] Open the current [DP-700 skills-measured page](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) and scan its **Change log** table at the bottom
- [ ] Have the [cheat sheets](./cheat-sheets/cheat-sheets.md) open in another tab — it's open book, use them
- [ ] Note the time; the assessment is shorter than the original exam but still time-bounded
- [ ] Sign in to [your Microsoft Learn profile](https://aka.ms/ManageCerts) and click **Renew** next to DP-700
- [ ] Pass. Your certification is extended +1 year from the existing expiration date

---

## Use Cases

- **DP-700 holders renewing for the first time** — most readers
- **Hiring managers** verifying that a candidate's DP-700 credential is current (renewals show on the Microsoft Learn transcript)
- **Forks of this study guide** maintained for a different blueprint year — the workflow generalises; only the "specific things to watch" section is DP-700-specific

## Exam Tips

> [!tip] Exam Tips for renewal
>
> - **Treat it as open-book, not no-effort.** You can use Microsoft Learn while taking it, but every minute you spend searching is a minute lost. Pre-read the change log first.
> - **Don't binge the whole study guide** the night before — the renewal is a diff, not a re-cert. Time spent re-reading Domain 1 fundamentals is time wasted.
> - **Renew early in your window.** If you fail in month 11 with 30 days left, you have a stress sprint. If you fail in month 7 with 5 months left, you have plenty of time.
> - **If the blueprint moved a feature from preview → GA**, expect at least one question on the GA-specific behavior (new syntax, lifted constraint, changed default).

## Related Topics

- [Final Review](./final-review.md) — 20-minute exam-morning scan, updated when the blueprint changes
- [Exam Tips](./exam-tips.md) — strategies and common traps from the original exam (some still applicable)
- [Companion Exams](./companion-exams.md) — DP-600, PL-300, DP-800, and how they relate
- [Official Links](./official-links.md) — Microsoft Learn entry points

## Official Documentation

- [Microsoft Certification Renewal](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification) — overview page
- [Certification Renewal FAQ](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification-faq) — edge cases, accommodations, what-ifs
- [DP-700 Skills Measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) — current blueprint, with change log
- [Manage Your Certifications](https://aka.ms/ManageCerts) — direct link to the renewal dashboard

---

**[↑ Back to Overview](../dp-700-overview.md)**
