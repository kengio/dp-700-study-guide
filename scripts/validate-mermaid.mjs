#!/usr/bin/env node
// Validate every ```mermaid block in the repo's markdown by running it through
// the real Mermaid parser. Catches syntax that renders as "Error parsing Mermaid
// diagram!" in Obsidian / GitHub / the practice site before it reaches main.
//
// Usage:
//   node scripts/validate-mermaid.mjs              # scan the whole repo
//   node scripts/validate-mermaid.mjs a.md b.md    # scan specific files
//
// Exit code 1 if any diagram fails to parse.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, join } from 'node:path';
import { JSDOM } from 'jsdom';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', '.obsidian', '.reference']);

function findMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findMarkdown(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

// Pull out ```mermaid blocks. Tracks generic fence state so a mermaid fence
// nested inside a larger ```markdown example block is not treated as a diagram.
function extractBlocks(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const blocks = [];
  let fence = null; // { char, len, isMermaid, startLine, body[] }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`~]*)/);
    if (!fence) {
      if (open) {
        fence = {
          char: open[1][0],
          len: open[1].length,
          isMermaid: open[2].toLowerCase() === 'mermaid',
          startLine: i + 2, // first line of the diagram body, 1-indexed
          body: [],
        };
      }
      continue;
    }
    const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
    if (close && close[1][0] === fence.char && close[1].length >= fence.len) {
      if (fence.isMermaid) blocks.push({ file, line: fence.startLine, src: fence.body.join('\n') });
      fence = null;
      continue;
    }
    fence.body.push(line);
  }
  return blocks;
}

// Mermaid needs a DOM even to parse.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false });

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => resolve(f))
  : findMarkdown(REPO_ROOT);

const blocks = targets.flatMap(extractBlocks);
const failures = [];

for (const block of blocks) {
  try {
    await mermaid.parse(block.src);
  } catch (err) {
    failures.push({ ...block, message: (err?.message ?? String(err)).trim() });
  }
}

// Mermaid reports "Parse error on line N" relative to the block; map it back to
// the line in the markdown file so the output is clickable.
function absoluteLine(block, message) {
  const m = message.match(/Parse error on line (\d+)/);
  return m ? block.line + Number(m[1]) - 1 : block.line;
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} of ${blocks.length} Mermaid diagram(s) failed to parse:\n`);
  for (const f of failures) {
    console.error(`  ${relative(REPO_ROOT, f.file)}:${absoluteLine(f, f.message)}`);
    for (const l of f.message.split('\n')) console.error(`    ${l}`);
    console.error('');
  }
  console.error('Common causes in mindmaps: ( ) [ ] { } or " in node text — Mermaid reads');
  console.error('those as node-shape delimiters. Use "-" or "," instead.\n');
  process.exit(1);
}

console.log(`✓ ${blocks.length} Mermaid diagram(s) parsed cleanly across ${targets.length} markdown file(s).`);
