// The plugin must never teach an implicit workspace/context and must never name the engine purge hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function* walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'tests') yield* walk(p); } else if (/\.(md|sh)$/.test(n)) yield p; } }
// The full banned set. `\bcurrent ` keeps "concurrent workspaces" from tripping the guard;
// "conversation" is the CORRECT noun and is never banned.
const BANNED = [
  /setContext/,
  /oic_dump_blueprint/,
  /oic_export_iar/,          // never existed as a tool; the archive is LOADED into the conversation
  /oldFile/,                 // the iar tools take no file paths at all (no disk, no before/after files)
  /\bcurrent (workspace|context|session)\b/i,
  /workspace context/i,
  /server holds your context/i,
  /purgeSessionCache/,
  /sessionPurge/,
  /X-Session-/,
  /UNKNOWN[^\n]*UNLOCK/i,
];
test('no implicit-context wording, no purge hook, no dead tool names in the plugin', () => {
  const hits = [];
  for (const f of walk(root)) { const t = readFileSync(f, 'utf8'); for (const re of BANNED) if (re.test(t)) hits.push(`${f}: ${re}`); }
  assert.deepEqual(hits, []);
});
test('workspace skill teaches the explicit triple', () => {
  const t = readFileSync(join(root, 'skills/workspace/SKILL.md'), 'utf8');
  assert.match(t, /\{instance, code, version, project\?, wsid\}/);
  assert.match(t, /Lock upgrade/);
});
