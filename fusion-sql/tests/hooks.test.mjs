// The PreToolUse hooks key on tool NAMES: the hooks.json matcher, skill-gate's REQUIRED list and its SQL
// executors must name the same tools, and the gate must still deny / allow by name. Runs the real hook
// scripts as the CLI does (event JSON on stdin, decision JSON on stdout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gate = join(root, 'hooks', 'skill-gate.mjs');
const record = join(root, 'hooks', 'skill-record.mjs');
const hooks = JSON.parse(readFileSync(join(root, 'hooks', 'hooks.json'), 'utf8'));
const gateSrc = readFileSync(gate, 'utf8');

function run(script, event, env = {}) {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(event), encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const decision = (out) => out?.hookSpecificOutput?.permissionDecision ?? 'allow';

test('hooks.json matcher names exactly the gated tools + the SQL executors', () => {
  const matcher = hooks.hooks.PreToolUse.find((h) => h.hooks[0].command.includes('skill-gate')).matcher;
  const inMatcher = matcher.match(/__\((.*)\)$/)[1].split('|').sort();
  const required = [...gateSrc.matchAll(/\{ tool: "([A-Za-z]+)"/g)].map((m) => m[1]);
  const executors = gateSrc.match(/SQL_EXECUTORS = new Set\(\[([^\]]*)\]/)[1].match(/"([A-Za-z_]+)"/g).map((s) => s.slice(1, -1));
  assert.deepEqual(inMatcher, [...required, ...executors].sort());
});

test('skill-gate denies a build tool until its skills were recorded, then allows it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fusion-gate-'));
  try {
    const env = { FUSION_SKILLGATE_DIR: dir };
    const call = { session_id: 's1', tool_name: 'mcp__fusion-pod__createDataModelFile', tool_input: {} };
    const denied = run(gate, call, env);
    assert.equal(decision(denied), 'deny');
    assert.match(denied.hookSpecificOutput.permissionDecisionReason, /datamodel-authoring/);
    run(record, { session_id: 's1', tool_name: 'Skill', tool_input: { skill: 'fusion-sql:datamodel-authoring' } }, env);
    run(record, { session_id: 's1', tool_name: 'Skill', tool_input: { skill: 'fusion-sql:fusion-sql-review' } }, env);
    assert.equal(decision(run(gate, call, env)), 'allow');
    // read-only tools are never gated
    assert.equal(decision(run(gate, { session_id: 's2', tool_name: 'mcp__fusion-pod__getDataModel', tool_input: {} }, env)), 'allow');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skill-gate: plain runSql runs in developer mode, only the instance probe in end-user mode', () => {
  const sql = (s) => ({ session_id: 's3', tool_name: 'mcp__fusion-pod__runSql', tool_input: { sql: s } });
  assert.equal(decision(run(gate, sql('select x from t'), { AGENT_MODE: 'developer' })), 'allow');
  assert.equal(decision(run(gate, sql('select x from t'), { AGENT_MODE: 'end-user' })), 'deny');
  assert.equal(decision(run(gate, sql('select 1 from dual'), { AGENT_MODE: 'end-user' })), 'allow');
});
