# CLAUDE.md

Open-source community study guide for the Microsoft **DP-700: Implementing Data Engineering Solutions Using Microsoft Fabric** certification exam. Licensed under MIT (see `LICENSE`). Aligned to the official skills-measured list updated **July 21, 2026**.

The repository is public; contributions arrive as pull requests. Keep this in mind: every change is visible to the community. Prefer additive, well-justified edits over silent rewrites, and verify factual claims against the [official skills measured](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700) page before merging.

## Repository Structure

```text
dp-700-study-guide/
├── certification/
│   ├── dp-700-overview.md              # Certification index with exam overview and progress tracker
│   ├── 01-fabric-workspace-settings/   # Spark, domain, OneLake, Airflow workspace settings
│   ├── 02-lifecycle-management/        # Version control, database projects, deployment pipelines
│   ├── 03-security-governance/         # Workspace/item access, granular access controls, OneLake security, DDM, governance
│   ├── 04-orchestration/               # Choosing an orchestration tool, schedules/triggers, orchestration patterns
│   ├── 05-loading-patterns/            # Full/incremental loads, dimensional model loading, streaming loading pattern
│   ├── 06-batch-ingestion/             # Choosing a data store, OneLake shortcuts, mirroring, pipeline ingestion
│   ├── 07-batch-transformation/        # Choosing a transform tool, PySpark/T-SQL/KQL transformations, data quality patterns
│   ├── 08-streaming-data/              # Choosing a streaming engine, Eventstreams, Spark structured streaming, KQL real-time, windowing
│   ├── 09-monitoring-alerting/         # Monitoring surfaces, semantic model refresh, Activator alerts
│   ├── 10-error-resolution/            # Pipeline/Dataflow, notebook/T-SQL, real-time, and shortcut errors
│   ├── 11-performance-optimization/    # Lakehouse, warehouse, Spark, real-time, and pipeline/query optimization
│   └── resources/                      # Practice questions, mock exams, exam tips, code examples, appendix, cheat sheets
├── i18n/                                # Community translations — parallel tree per locale, see TRANSLATING.md
├── practice/                            # Static adaptive practice quiz — HTML/JS/CSS + Python build.py + JSON banks
```

Each topic folder contains a named index file (e.g., `orchestration.md`, `streaming-data.md`) and numbered `.md` topic files.

Top-level files:

- `README.md` — public-facing entry point with badges, exam overview, and quick navigation. Rewrite when the blueprint date or major features change.
- `LICENSE` — MIT.
- `CLAUDE.md` — this file. Project conventions for AI assistants and contributors.
- `CONTRIBUTING.md` / `CONTRIBUTORS.md` / `CHANGELOG.md` — public-facing community files.
- `TRANSLATING.md` — translation conventions: BCP-47 locale codes, `i18n/<locale>/` mirror layout, priority order, currency policy. Translations must not alter English source files.
- `OBSIDIAN-SETUP.md` — optional setup notes for editing the guide in Obsidian.

## Practice Quiz (`practice/`)

A static browser-based quiz live at <https://kengio.github.io/dp-700-study-guide/>. Auto-deployed by `.github/workflows/deploy-practice.yml` on any push that touches `practice/**` or the source markdown.

- **Source of truth is markdown.** `practice/build.py` parses `certification/resources/practice-questions/*.md` and `mock-exam/questions.md` + `mock-exam-2/questions.md` + `mock-exam-3/questions.md` into `practice/data/*.json`. The deploy workflow re-runs `build.py` on every deploy, so the live site always reflects current markdown even if the committed JSON is stale.
- **Edit markdown, not JSON.** New questions, fixes, and renumbering go in the source `.md` files; the JSON in `practice/data/` is generated. Run `python3 practice/build.py` locally to refresh before committing.
- **Question format** — see [`practice/format.md`](./practice/format.md). The parser supports three heading formats, accepts `A.` or `A)` choices, and recognises both `**B. <choice>**` and `**Correct Answer: B**` styles inside the `> [!success]-` callout. Mock-exam domains are demarcated by `<!-- DOMAIN N: <name> (~M questions) -->` HTML comments; case-study sub-questions use `###` H3 headings under a `## Case Study: ...` H2.
- **Question `id` is stable across rebuilds.** Don't renumber questions inside a `.md` file without intent — it breaks learners' localStorage progress.
- **`dp700-practice-` storage prefix.** All quiz progress keys in browser localStorage are namespaced `dp700-practice-<bank>-...` so this guide's quiz never collides with the DP-800 guide's quiz if a learner has both open.

## Currency Policy

The exam blueprint is the source of truth. When Microsoft updates the [skills-measured list](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700):

- Update the **"What's New"** callout at the top of `certification/dp-700-overview.md` with the new blueprint date and the diff vs. the prior version.
- Update the **"Updates"** section in `certification/resources/final-review.md` to surface the highest-leverage new facts for exam day.
- Update the blueprint date badge in `README.md`.
- Mark questions that target newly added skills with a `*(YYYY update)*` suffix in the question heading so studiers can find them.
- Move features from "Preview" to "GA" labelling as their status changes.
- **July 21, 2026 refresh — the one change to know:** "Configure Dataflows Gen2 workspace settings" → "Configure Apache Airflow workspace settings" (within *Configure Microsoft Fabric workspace settings*). Every other bullet is unchanged vs. the April 20, 2026 blueprint — never present another item as "new in July."

## Content Guidelines

### Content Placement

- **Single certification** — all content lives under `certification/`
- **Code examples** go in `certification/resources/code-examples/{pyspark,tsql,kql}/` as `.md` files, never `.py`, `.sql`, or `.kql`

### Code Examples

- **Always `.md` files**, never raw `.py`/`.sql`/`.kql` — store in `certification/resources/code-examples/{pyspark,tsql,kql}/`
- Fenced code blocks with language tags (`python`, `sql`, `kql`, `json`, `yaml`)
- Group related snippets under `##` headings; add YAML frontmatter with `tags`
- Every transformation topic shows PySpark/T-SQL/KQL side-by-side where all three apply

### File Size

- **Target: 300–600 lines**; hard limit: ~800 lines (~20–25 KB)
- **Exception:** `mock-exam/questions.md` files — do not split
- **Split** when 2+ distinct sub-topics can stand alone → `03-topic-part1.md` + `03-topic-part2.md`:
  1. Same number prefix; append `-part1` / `-part2`
  2. Each part gets own YAML frontmatter and intro
  3. Terminal sections (Use Cases → Official Docs) go in **Part 2 only**; Part 1 ends with forward link
  4. Update topic index file; delete original; fix all links repo-wide

### Markdown Conventions

- Run markdownlint on every modified file; blank lines before/after headings (MD022)
- Language tags on all code blocks (`python`, `sql`, `kql`, `json`)
- **Practice answers:** Obsidian foldable `> [!success]- Answer` callout
- **Practice choices:** A/B/C/D on separate lines (no bullets); two trailing spaces for line breaks

### Obsidian Callouts

Use callouts to break up dense text in topic files and cheat sheets. Standard types:

| Callout | Usage |
| :--- | :--- |
| `> [!info]` | Section intros, neutral context, "what this is" |
| `> [!tip] What the Exam Tests` | Top-of-file orientation: 2–4 bullets on what the exam specifically tests in this file |
| `> [!tip] Exam Tips` | Exam-specific advice in the terminal Exam Tips section |
| `> [!warning] Common Mistake` | Frequent errors, gotchas, "don't confuse X with Y" |
| `> [!note]` | Extra detail, caveats, "worth knowing but not critical" |
| `> [!success]- Answer` | Collapsed practice question answers (foldable) |
| `> [!abstract]` | Quick-reference summaries at top of cheat sheets and topic files |

- Use `> [!tip] What the Exam Tests` immediately after the `[!abstract]` callout, before the first `##` section
- Use `> [!tip] Exam Tips` blocks instead of bare bullet lists for the **Exam Tips** section in topic files
- Use `> [!warning]` to highlight traps covered in the **Common Issues** section
- Highlight key terms in tables with `==text==` (Obsidian highlight syntax)

### Diagrams & Images

- **Architecture diagrams:** Mermaid (`flowchart`, `sequenceDiagram`, `graph`)
- **Directory trees:** ASCII text, not Mermaid
- **Screenshots:** `images/<feature>/`; standard markdown `![Alt](path)` with caption; ≤800 px wide

### Links

- **Link to files, not folders** (`path/to/orchestration.md`, not `path/to/`)
- **Topic index files** are named after their folder (e.g., `./orchestration.md`, `./streaming-data.md`) — never `README.md`
- **Always use `./filename.md`** for same-folder links — bare filenames resolve ambiguously in Obsidian
- Verify target files exist after edits

### Section Ordering (End of Topic Files)

Terminal sections in this exact order:

1. `## Use Cases`
2. `## Common Issues & Errors`
3. `## Best Practices` *(optional)*
4. `## Exam Tips`
5. `## Key Takeaways`
6. `## Related Topics`
7. `## Official Documentation`
8. `---` separator + navigation link (always last)

**Nav format:** `**[← Previous](./NN-prev.md) | [↑ Back to Section](./topic-index.md) | [Next →](./NN-next.md)**`

where `topic-index.md` is the folder's named index file (e.g., `./orchestration.md`, `./streaming-data.md`)

- Part 1 files: end with only forward link to Part 2
- Part 2 files: full three-way nav

## Index File Standards

### Certification Index (`certification/dp-700-overview.md`)

Required: YAML frontmatter (`title`, `type: certification`, `aliases`, `tags`), How to Use This Guide (numbered steps including `final-review.md`), Exam Overview table, Domain Weights (Mermaid pie), Study Topics table with weights, Practice & Resources table (must include `Final Review` row), Study Progress Tracker (checkboxes).

### Topic Folder Index (`<topic-folder>/<topic-name>.md`)

Required: YAML frontmatter (`title`, `type: category`, `tags`, `status`), topic title with exam weight, `## Quick Recall` Mermaid mindmap (first section, before Topics Overview), Topics Overview (Mermaid flowchart), Section Contents table, Key Concepts, Related Resources, Back/Next navigation.

- `status` field values: `draft`, `in-progress`, `complete`
- Update `status` in each topic index as sections are completed — do not leave complete sections as `draft`
- `## Quick Recall` mindmap lists the 3–6 most testable facts per section — use `mindmap` diagram type

### Topic File Structure (Top of File)

Every topic file must open with this pattern, in order, before the first `##` content section:

1. YAML frontmatter
2. `# Title`
3. `## Overview` paragraph (1–3 sentences)
4. `> [!abstract]` callout — 2–4 bullet summary of what the file covers
5. `> [!tip] What the Exam Tests` callout — 2–4 bullets on specifically what the exam tests from this file
6. `---` separator
7. First `##` content section

### Cheat Sheet Structure

Each cheat sheet (`resources/cheat-sheets/`) ends with:

1. `## Gotchas & Traps` — 4–8 bullets on common errors and exam traps specific to the topic
2. `## Before the Exam, I Can…` — 5–8 unchecked checkboxes (`- [ ]`) the reader should be able to tick before taking the exam

### Mock Exam Structure

Each mock exam (`resources/mock-exam/`, `resources/mock-exam-2/`, `resources/mock-exam-3/`) has:

- `mock-exam-N.md` — landing page with instructions, scoring guide, domain breakdown
- `questions.md` — 50 questions total: 45 standalone (Qs 1–45) followed by 1 case-study block (Qs 46–50)
- `mock-exam-N-debrief.md` — per-question map to topic file + cheat sheet, plus a "study plan by miss count" section that triages study by domain weakness

### Case-Study Blocks

Mock exams end with a case-study block to mirror the real DP-700 format:

- One multi-paragraph scenario at the start of the block
- 5 linked sub-questions covering 2–3 domains in a single business scenario
- Cross-domain by design — exam case studies typically blend orchestration, security, and performance
- Each sub-question has its own difficulty rating and follows the same answer-callout format as standalone questions

### Mental Models

Use `> [!note] Mental model — <topic>` callouts to give learners durable, concrete analogies for abstract concepts (e.g., medallion architecture = bronze/silver/gold refinement stages, OneLake shortcuts = symlinks across workspaces, watermarking = a tide line marking the last-processed row). Place these in topic files near the relevant concept, after the `Common Mistake` warning.

## Intensity Requirements (this guide's differentiator)

- Every "choose between X/Y/Z" blueprint bullet (orchestration tool, data store, transform tool, streaming engine) gets a decision matrix table + a `[!note] Mental model` callout + at least one worked scenario question.
- Every transformation topic shows PySpark/T-SQL/KQL side-by-side where all apply.
- Every topic file embeds 2–3 inline practice questions with foldable answers.

## Exam Domain Mapping

- **Domain 1 — Implement and manage an analytics solution (30–35%):** 01-fabric-workspace-settings, 02-lifecycle-management, 03-security-governance, 04-orchestration
- **Domain 2 — Ingest and transform data (30–35%):** 05-loading-patterns, 06-batch-ingestion, 07-batch-transformation, 08-streaming-data
- **Domain 3 — Monitor and optimize an analytics solution (30–35%):** 09-monitoring-alerting, 10-error-resolution, 11-performance-optimization
