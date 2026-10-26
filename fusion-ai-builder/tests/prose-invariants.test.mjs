// Prose invariants for the fusion-ai-builder plugin: skill frontmatter, skill registration in
// instructions.md, reference paths that resolve, no pod/customer names, no dates, no TODOs,
// the always-on instructions stay small and name the load-bearing tools/rules, and the DRAFT-save
// offer rule lives once (instance-import-export), gated on the user's yes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, 'skills');
const instructions = readFileSync(join(root, 'instructions.md'), 'utf8');

// Oracle's own skill, vendored byte-for-byte by scripts/vendor-aistudio.ps1 — never authored here.
const VENDORED_SKILL = 'aistudio';
const vendoredDir = join(skillsDir, VENDORED_SKILL);

// Authored prose = everything we wrote. The vendored Oracle skill and this test dir are excluded.
function* walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (n === 'tests' || p === vendoredDir) continue;
      yield* walk(p);
    } else if (/\.(md|sh|json)$/.test(n)) yield p;
  }
}
const authored = [...walk(root)];

const skillDirs = readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory());
const ownSkillDirs = skillDirs.filter((n) => n !== VENDORED_SKILL);

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'frontmatter block missing');
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

test('plugin manifest is named fusion-ai-builder', () => {
  const pj = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(pj.name, 'fusion-ai-builder');
  assert.ok(pj.description && pj.version);
});

test('exactly the planned skills exist (every Studio artifact type and CLI capability has one, plus Oracle\'s own)', () => {
  assert.deepEqual(skillDirs.sort(), [
    'agents-topics-policies', 'aistudio', 'app-authoring', 'approvals', 'business-objects-and-tools', 'chat-debugger', 'connectors',
    'deeplinks', 'document-schemas', 'gnimsys-chat-widgets', 'import-export', 'instance-import-export', 'pod-operations',
    'policy-templates', 'run-and-debug', 'validation-and-debugging', 'widgets-and-forms', 'workflow-authoring',
  ]);
});

test('every skill has frontmatter name = dir name and a description; ours start with "Use when"', () => {
  for (const d of skillDirs) {
    const text = readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8');
    const fm = frontmatter(text);
    assert.equal(fm.name, d, `${d}: frontmatter name must equal directory name`);
    assert.ok(fm.description && fm.description.length > 20, `${d}: description missing`);
    assert.ok(fm.description.length <= 1024, `${d}: description too long`);
    // Oracle's vendored skill keeps Oracle's own wording (never edited).
    if (d !== VENDORED_SKILL) assert.match(fm.description, /^Use when/, `${d}: description must start with "Use when"`);
  }
});

test('the vendored Oracle skill is a loaded skill with its references, resources and UPL notice', () => {
  for (const rel of ['SKILL.md', 'LICENSE.txt', 'references/prompts/index.md', 'references/prompts/workflow-vibe.md',
    'references/prompts/workflow-node-prompts/index.md', 'resources/app-samples/index.md']) {
    assert.ok(existsSync(join(vendoredDir, rel)), `skills/${VENDORED_SKILL}/${rel} missing`);
  }
  assert.ok(!existsSync(join(vendoredDir, 'scripts')), 'the CLI ships in the fusion-ai-mcp image (mcp/vendor/), never in the plugin');
});

test('one canonical layout: no references/ tree beside the skills, no prose pointing at the old paths', () => {
  assert.ok(!existsSync(join(root, 'references')), 'references/ is gone: Oracle\'s skill lives in skills/aistudio/, the corpus rules in the skills');
  const hits = [];
  for (const f of authored) {
    const t = readFileSync(f, 'utf8');
    if (/references\/(oracle|corpus)\b/.test(t)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});

test('instructions.md states that the plugin takes precedence over Oracle\'s verbatim skill', () => {
  const sec = instructions.split(/\r?\n## /).find((s) => /^Oracle's `aistudio` skill is verbatim/.test(s));
  assert.ok(sec, 'precedence section missing');
  assert.match(sec, /THIS PLUGIN WINS/);
  for (const needle of ['fai_cli', 'fai_workspace_create', 'fai_pod_connect', 'AUTH_REQUIRED', 'app-pkg', 'Publishing: never', 'test-sync']) {
    assert.ok(sec.includes(needle), `precedence section must cover ${needle}`);
  }
});

test('every skill is listed in instructions.md', () => {
  for (const d of skillDirs) {
    assert.match(instructions, new RegExp(`\\*\\*${d}\\*\\*`), `skill ${d} not listed in instructions.md`);
  }
});

test('every plugin path (skills/…, references/…) mentioned in authored prose exists', () => {
  const missing = [];
  let checked = 0;
  for (const f of authored) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/`(?:\$\{CLAUDE_PLUGIN_ROOT\}\/)?((?:skills|references)\/[A-Za-z0-9_./-]+)`/g)) {
      const rel = m[1].replace(/\*+$/, '').replace(/\/$/, ''); // `dir/**` and `dir/` are directory mentions
      checked++;
      if (!existsSync(join(root, rel))) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.ok(checked > 20, `only ${checked} plugin paths found — the path pattern no longer matches the prose`);
  assert.deepEqual(missing, []);
});

// No pod / tenant / customer names, no dates, no TODO markers in agent-facing prose.
const BANNED = [
  /\b(eqdq|exqw|oraclepdemos|oraclecloud\.com)\b/i,
  /\b20\d\d-\d\d-\d\d\b/,
  /TODO|TBD/,
  /\bnoga\b/i,
];
test('no pod names, dates, or TODO markers in authored prose', () => {
  const hits = [];
  for (const f of authored) {
    const t = readFileSync(f, 'utf8');
    for (const re of BANNED) if (re.test(t)) hits.push(`${f}: ${re}`);
  }
  assert.deepEqual(hits, []);
});

test('instructions.md is small and names the load-bearing tools and rules', () => {
  const lines = instructions.split(/\r?\n/).length;
  assert.ok(lines <= 240, `instructions.md has ${lines} lines (max 240)`);
  for (const needle of ['fai_validate', 'fai_export', 'fai_cli', 'never publish', 'AskUserQuestion', 'do-prettify-workflow', 'v<n>']) {
    assert.ok(instructions.includes(needle), `instructions.md must mention ${needle}`);
  }
  assert.match(instructions, /## Validation/, 'reporting format must require a Validation section');
});

test('the persona is never told to run shell commands or edit files directly', () => {
  const hits = [];
  for (const f of authored) {
    const t = readFileSync(f, 'utf8');
    for (const re of [/\bnode\s+\S*aistudio\.js\b/, /\bnpm (run|test)\b/, /\bBash\b/, /\bWrite tool\b/]) {
      if (re.test(t)) hits.push(`${f}: ${re}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('hooks are wired and the pre-compact script is plain prose', () => {
  const hooks = JSON.parse(readFileSync(join(root, 'hooks', 'hooks.json'), 'utf8'));
  assert.ok(hooks.hooks.PreCompact?.[0]?.hooks?.[0]?.command.includes('pre-compact.sh'));
  const sh = readFileSync(join(root, 'hooks', 'pre-compact.sh'), 'utf8');
  assert.match(sh, /fai_validate/);
  assert.match(sh, /fai_export/);
});

test('the DRAFT-save offer lives ONCE in instance-import-export, saves only on the user\'s yes, states the effect per kind', () => {
  const save = readFileSync(join(skillsDir, 'instance-import-export', 'SKILL.md'), 'utf8');
  const pod = readFileSync(join(skillsDir, 'pod-operations', 'SKILL.md'), 'utf8');
  const offer = save.split(/\r?\n## /).find((s) => /^Offer a DRAFT save after each good block/.test(s));
  assert.ok(offer, 'offer section missing from instance-import-export');
  const flat = offer.replace(/\s+/g, ' ');
  for (const needle of ['`fai_validate`', 'closing offer', '`AskUserQuestion`', '"save now"', '"not yet"', 'scratch',
    '`fai_pod_fetch`', '`fai_export`', '"connect + save"', '`identity_targets`', '**pod-operations**']) {
    assert.ok(flat.includes(needle), `offer section must say ${needle}`);
  }
  // the effect per kind, truthfully: workflow/app = the pod's DRAFT slot; everything else = the live object
  assert.match(flat, /workflow or app → replaces the pod's DRAFT of that code \(the published version is untouched/);
  assert.match(flat, /BO, tool, agent, topic, deeplink, policy, function [^.]*→ updates the live object on the pod/);
  // the gate stays: a save happens only on the user's yes, never by itself
  assert.match(save, /Only on the user's yes/);
  assert.match(flat, /"save now" is the explicit ask/);
  for (const t of [save, pod, instructions]) assert.doesNotMatch(t, /auto-?sav/i);
  // once: the option strings live only here; pod-operations and instructions.md point at the skill by name
  for (const [name, t] of [['pod-operations', pod], ['instructions.md', instructions]]) {
    assert.doesNotMatch(t, /"save now"/, `${name} must point to the offer, not restate it`);
    assert.match(t, /DRAFT-save offer/, `${name} must name the offer`);
    assert.match(t, /\*\*instance-import-export\*\*/, `${name} must point to the skill`);
  }
});
