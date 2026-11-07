// Guard: fusion-ai-builder prose says WHEN / WHY / in what ORDER a tool is used, plus the domain
// rules — never HOW to call it. A fai tool's arguments, their meaning, enums, return shape, limits
// and errors live ONLY in the tool's own description + input schema (fusion-ai-mcp), and an aistudio
// command's flags ONLY in its help (fai_cli_help); the model loads a schema before the first call.
// This test fails on an argument recipe in instructions.md, the PreCompact hook or one of our skills:
// an argument list or call syntax after a fai tool name, an argument assignment after it, a return
// shape next to it, an argument list after a CLI command, a CLI flag, or a backticked tool-argument
// setting. Oracle's vendored skill (skills/aistudio/) is not ours and is not scanned. Engine tools
// (identity_*, ui_*, pod_call_log) belong to the engine and are not policed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDORED_SKILL = 'aistudio';

/** The prose the model reads: the kernel, the PreCompact hook, every skill we author. */
function proseFiles() {
  const out = [join(root, 'instructions.md'), join(root, 'hooks', 'pre-compact.sh')];
  const skills = join(root, 'skills');
  for (const d of readdirSync(skills)) {
    if (d === VENDORED_SKILL || !statSync(join(skills, d)).isDirectory()) continue;
    out.push(join(skills, d, 'SKILL.md'));
  }
  return out;
}

// Argument names of the fai tools and of the aistudio flags the skills talk about: a backticked
// `<name>:<value>` with one of them is a call recipe. Result fields named as a trigger (WHEN) are not
// in this list (`ok`, `finishReason`, `identity`, …).
const ARGS = ['select', 'grep', 'context', 'ignoreCase', 'offset', 'limit', 'chat', 'workflowStatus', 'stopBefore', 'rerun',
  'triggerType', 'parameters', 'singleTurnOnly', 'conversationId', 'resume', 'nodeCodes', 'withDeps', 'force', 'confirm', 'view',
  'archetype', 'nodeType', 'op', 'field', 'edits', 'merge', 'includeSeededTemplates', 'query', 'status', 'kind', 'ws', 'path',
  'file', 'message', 'version', 'dataSource', 'testFile', 'judgeProvider', 'evaluationMode', 'toolType', 'remote', 'verbose',
  'allowConflictUpdate', 'enabled', 'update', 'files', 'args', 'command', 'fileId', 'instance', 'spec', 'variables', 'patch',
  'inputs', 'node', 'target', 'input', 'layout', 'hint', 'boCode', 'family', 'product', 'resourcePath', 'q', 'nodeCode',
  'metadataPatch', 'inputsPatch', 'aiAppOutputSpecification'];

const ARG_SETTING = `(?:${ARGS.join('|')})\\s*:(?=\\s*(?:["'\\[{0-9]|true\\b|false\\b))`;
// a line that names a fai tool or a CLI command (kebab-case, in backticks)
const TOOL_LINE = /\bfai_[a-z_]+|`[a-z]+(?:-[a-z]+)+`/;

const RULES = [
  { name: 'fai tool + argument list', re: /\bfai_[a-z_]+`?\s*\{/g },
  { name: 'fai tool call syntax', re: /\bfai_[a-z_]+\(/g },
  { name: 'fai tool + argument assignment', re: /\bfai_[a-z_]+`?\s+[A-Za-z_]+\s*:\s*["'`[{0-9]/g },
  { name: 'return shape after a fai tool', re: /\bfai_[a-z_]+\b[^\n]*?(?:→|->)\s*`\{/g },
  { name: 'object literal on a fai tool line', re: /\bfai_[a-z_]+\b[^\n]*`\{[^`\n]*,[^`\n]*\}`/g },
  { name: 'CLI command + argument list', re: /\b[a-z]+(?:-[a-z]+)+`?\s*\{/g },
  { name: 'CLI flag', re: /(?:^|[\s`(])--[a-z][a-z0-9-]+/g },
  { name: 'backticked argument setting', re: new RegExp(`\`${ARG_SETTING}`, 'g') },
  { name: 'argument setting on a tool line', re: new RegExp(`\\b${ARG_SETTING}`, 'g'), when: (line) => TOOL_LINE.test(line) },
];

/** The rules a line breaks: [rule name, matched text]. */
function lineHits(line) {
  const out = [];
  for (const r of RULES) {
    if (r.when && !r.when(line)) continue;
    for (const m of line.matchAll(r.re)) out.push([r.name, m[0].trim().slice(0, 80)]);
  }
  return out;
}

/** Every recipe hit: file:line [rule] matched text. */
function recipeHits(file) {
  const hits = [];
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const [name, text] of lineHits(line)) hits.push(`${relative(root, file)}:${i + 1} [${name}] ${text}`);
  });
  return hits;
}

test('fusion-ai-builder instructions, hook and skills carry no argument recipes', () => {
  const hits = proseFiles().flatMap(recipeHits);
  assert.deepEqual(hits, [], `argument recipes belong in the tool descriptions (fusion-ai-mcp) or the CLI help (fai_cli_help):\n${hits.join('\n')}`);
});

test('the guard catches each recipe shape and passes plain pointers (self-test)', () => {
  const caught = (s) => lineHits(s).length > 0;
  for (const s of [
    'read it with `fai_file_read {ws, path, select}`',
    'call `fai_cli(ws, command)`',
    'then `fai_workflow_run` resume:{action}',
    '`fai_export` → `{fileId, name, mime}`',
    'a `fai_export` result is `{fileId, name, mime}`',
    '`do-create-node {file, type, name}`',
    'run it: `fai_cli run-workflow-test {testFile, dataSource:\'live\'}`',
    '`list-workflow-products --family <F>`',
    'pass `stopBefore:[\'X\']`',
    'with `select:\'description\'`',
    'a run with `chat:true`',
  ]) assert.ok(caught(s), `not caught: ${s}`);
  for (const s of [
    'validate with `fai_validate`, then export with `fai_export`',
    '`ToolSearch` with `select:<full tool name>`',
    'a run answering `finishReason:\'paused\'` with `waitingNode`',
    'the `fai_cli` command `do-create-workflow`',
    'Oracle\'s stream sends `{type:"TEXT", text}` parts',
    'send the panel `ui_side_panel_message {id:"ai-chat-debug", message:{type, …}}`',
  ]) assert.ok(!caught(s), `false positive: ${s}`);
});

test('the kernel tells the model to load a tool schema before its first call', () => {
  const kernel = readFileSync(join(root, 'instructions.md'), 'utf8');
  assert.match(kernel, /ToolSearch/);
  assert.match(kernel, /select:<full tool name>/);
});
