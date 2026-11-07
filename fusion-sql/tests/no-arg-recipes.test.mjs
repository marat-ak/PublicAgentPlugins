// Guard: fusion-sql prose says WHEN / WHY / in what ORDER a tool is used — never HOW to call it. A
// tool's arguments, their meaning, enums, return shape and limits live ONLY in the tool's own MCP
// description + input schema (fusion-pod-mcp, fusion-schema-mcp, the engine's tools); the model loads
// that schema before the first call. This test fails on argument recipes in the instructions or skills:
// call syntax (`renderTemplate({…})`, `getDataModel(fileId, …)`), engine-tool argument objects
// (`identity_select {target}`), return shapes (`→ {…}`), backticked object literals with several keys,
// a tool name followed by `param:value`, and backticked `param:value` settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The prose the model reads: the kernel, the end-user overlay, every skill body. */
function proseFiles() {
  const out = [join(root, 'instructions.md'), join(root, 'instructions.end-user.md')];
  const skills = join(root, 'skills');
  for (const d of readdirSync(skills)) {
    const p = join(skills, d, 'SKILL.md');
    if (statSync(join(skills, d)).isDirectory()) out.push(p);
  }
  return out;
}

// Result values a rule may name as its trigger (WHEN), e.g. "when findSimilarQueries returns ambiguous:true".
const TRIGGER_FIELDS = new Set(['ambiguous']);

const RULES = [
  { name: 'tool call syntax', re: /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\(/g },
  { name: 'engine tool with arguments', re: /\b(?:identity_[a-z_]+|ui_[a-z_]+)(?:\(|`?\s*\{)/g },
  { name: 'return shape', re: /(?:→|->|\breturns?\b)\s*`?\s*\{/g },
  { name: 'backticked object literal', re: /`\{(?![A-Z]+:<)[^`\n]*,[^`\n]*\}`/g },
  { name: 'tool name + param:value', re: /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*`?\s+[A-Za-z_]+\s*:\s*["'[{0-9]/g },
  { name: 'backticked param:value', re: /`([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*(?:true|false|-?\d|"|'|\[|\{)/g, allow: (m) => TRIGGER_FIELDS.has(m[1]) },
];

/** Every recipe hit: file:line, rule, the matched text. */
function recipeHits(file) {
  const hits = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const r of RULES) {
      for (const m of line.matchAll(r.re)) {
        if (r.allow?.(m)) continue;
        hits.push(`${relative(root, file)}:${i + 1} [${r.name}] ${m[0]}`);
      }
    }
  });
  return hits;
}

test('fusion-sql instructions and skills carry no argument recipes', () => {
  const hits = proseFiles().flatMap(recipeHits);
  assert.deepEqual(hits, [], `argument recipes belong in the tool descriptions:\n${hits.join('\n')}`);
});

test('the guard catches each recipe shape (self-test)', () => {
  const samples = [
    '`renderTemplate({ fileId, label? })` renders',
    'start with `getFileSummary(fileId)`',
    'then `identity_select {target, sub}`',
    '`listTemplates` → `{templates:[{id, name}]}`',
    'pass `{field:"DAYS", operator:"less_or_equal"}`',
    '`runReport format:"text"`',
    'set `splitByPage:true` on the loop',
  ];
  for (const s of samples) {
    const hit = RULES.some((r) => [...s.matchAll(r.re)].some((m) => !r.allow?.(m)));
    assert.ok(hit, `not caught: ${s}`);
  }
  for (const s of ['`findSimilarQueries` returned `ambiguous:true`', 'slots `{PRED:<object>|<privilege>}`', '`ToolSearch` with `select:<full tool name>`']) {
    const hit = RULES.some((r) => [...s.matchAll(r.re)].some((m) => !r.allow?.(m)));
    assert.ok(!hit, `false positive: ${s}`);
  }
});

test('the kernel tells the model to load a tool schema before its first call', () => {
  const kernel = readFileSync(join(root, 'instructions.md'), 'utf8');
  assert.match(kernel, /ToolSearch/);
  assert.match(kernel, /select:<full tool name>/);
});
