# Changelog

Notable changes to the DP-700 study guide.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/). Dates use ISO 8601. Each section is grouped under the Microsoft blueprint date it tracks, so future readers can match guide versions to the version of the exam they were preparing for.

## [Unreleased]

Still aligned to the **July 21, 2026** blueprint — no content or answer changes.

### Fixed

- Three `## Quick Recall` mindmaps failed to render as *"Error parsing Mermaid diagram!"* in Obsidian, on GitHub, and on the practice site. Mermaid reads `(` `)` as node-shape delimiters, so parentheses in node text break the whole diagram — and the double quotes added to work around it made it worse. Affected `certification/01-fabric-workspace-settings/fabric-workspace-settings.md`, `certification/03-security-governance/security-governance.md`, and `certification/09-monitoring-alerting/monitoring-alerting.md`; rewritten with `-` / `,` separators, same facts
- `.markdownlint-cli2.jsonc` and `lychee.toml` only ignored a root-level `node_modules/`, so local lint runs walked dependency READMEs once `scripts/` had its dependencies installed

### Added

- `scripts/validate-mermaid.mjs` — parses every ```` ```mermaid ```` block in the repo with the real Mermaid parser and reports `file:line` for any failure. Skips diagrams nested inside ```` ```markdown ```` examples
- `Mermaid diagram syntax` job in `.github/workflows/lint.yml` — a broken diagram now fails the PR instead of shipping to readers
- Mindmap punctuation rule documented in `CLAUDE.md` and `CONTRIBUTING.md`, with the local validation command

## [1.0.0] - 2026-07-11

The complete DP-700 study guide, aligned to the **July 21, 2026** blueprint.

### Added

- Repository scaffold + CI (markdownlint-cli2 + lychee link checking on every PR and push to `main`)
- 11 topic sections across all three domains, each mapped 1:1 to the official skills-measured list
- 7 cheat sheets + appendix (glossary, comparison tables, error-message reference)
- 82 practice questions across three domains, with full explanations
- 3 full mock exams (150 questions total — 45 standalone + 5-question case study each) with per-mock debriefs
- 10 hands-on labs chained on one shared workspace across every exam domain
- Anki deck (146 cards) + final review + exam tips, official links, companion-exam, and renewal-guide resources
- Adaptive practice quiz app, live on GitHub Pages (232 questions across 4 banks)

## [0.1.0] - 2026-07-11

Initial scaffold of the open-source DP-700 study guide. Aligned to the Microsoft skills-measured list updated **2026-07-21**.

### Added

- Repository scaffold: `LICENSE` (MIT), `CLAUDE.md` project conventions, `README.md`, `CONTRIBUTING.md` / `CONTRIBUTORS.md` / `TRANSLATING.md` / `OBSIDIAN-SETUP.md`
- **CI** — `.github/workflows/lint.yml` runs markdownlint-cli2 + lychee internal-link integrity on every PR and on pushes to `main`; `.github/workflows/deploy-practice.yml` scaffolded for the future GitHub Pages practice-quiz deploy
- `.markdownlint.json` + `.markdownlint-cli2.jsonc` with repo-wide glob set and `.obsidian/`, `node_modules/`, `.git/` ignores
- `lychee.toml` validating every relative `.md`/image/file link; skips external HTTP(S), mail, tel, ftp schemes; temporary exclusion for the 11 not-yet-written section index files (removed once all content lands)
- Issue templates (factual correction, new question/topic, typo/link fix) and PR template under `.github/`
- `i18n/README.md` — translation locale index (no locales yet)
- `practice/format.md` — the markdown → JSON contract the future `practice/build.py` converter will parse
- `certification/dp-700-overview.md` — certification index skeleton: exam overview, domain-weight pie, Study Topics table linking all 11 planned sections, Practice & Resources table, Study Progress Tracker
- 11 empty section folders under `certification/` (`01-fabric-workspace-settings` … `11-performance-optimization`), each with a `.gitkeep` placeholder pending its content task
