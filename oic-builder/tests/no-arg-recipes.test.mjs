// The oic MCP's own tool description + input schema is the ONE source of a tool's arguments, their meaning,
// return shape, limits and errors. The plugin says WHEN / WHY / in which ORDER and carries the domain rules;
// a tool name appears only as a pointer. This guard fails on an argument recipe in instructions.md or a skill:
// an argument list after a tool name, a call with parentheses, an argument assignment after a tool name, or a
// return shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function* walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'tests' && !n.startsWith('.')) yield* walk(p); } else if (n.endsWith('.md')) yield p; } }

const RECIPES = [
  [/\boic_\w+`?\s*\{/, 'argument list after a tool name (oic_x {a, b})'],
  [/\boic_\w+\(/, 'call syntax (oic_x(…))'],
  [/\boic_\w+`?\s+[a-zA-Z]+\s*:\s*["'`\w[{]/, 'argument assignment after a tool name (oic_x arg:value)'],
  [/(→|->)\s*`?\{\s*[a-zA-Z]/, 'return shape (→ {…})'],
];

test('no argument recipes in the oic-builder instructions or skills', () => {
  const hits = [];
  for (const f of walk(root)) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [re, what] of RECIPES) if (re.test(line)) hits.push(`${relative(root, f)}:${i + 1}: ${what}: ${line.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('instructions tell the agent to load a tool schema before its first call', () => {
  const t = readFileSync(join(root, 'instructions.md'), 'utf8');
  assert.match(t, /ToolSearch/);
  assert.match(t, /select:/);
});
