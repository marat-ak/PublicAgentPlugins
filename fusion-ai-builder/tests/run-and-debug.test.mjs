// The run-and-debug skill's breakpoint facts: stopBefore = Studio's debugger breakpoint (debug
// endpoint only), the stopped turn ends an ordinary `stop` whose output is the last executed node's,
// and a conversation with a stopped turn is investigated on a fresh one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const skill = fs.readFileSync(new URL('../skills/run-and-debug/SKILL.md', import.meta.url), 'utf8');
const flat = skill.replace(/\s+/g, ' ');

test('run-and-debug: stopBefore is Studio\'s breakpoint — stop BEFORE the node, debug endpoint only, codes of the workflow file', () => {
  assert.match(flat, /a breakpoint set on a node in Studio's debugger → `stopBefore:\['<CODE>'\]`/);
  assert.match(flat, /stops BEFORE the first named node it reaches — Studio's debugger breakpoint, sent as `debugParams\.breakPoints`/);
  assert.match(flat, /`pathAssertions\.mustNotExecute`/);
  assert.match(flat, /Debug endpoint only: refused with `chat:true`/);
  assert.match(flat, /an unknown code is `invalid-arg`/);
});

test('run-and-debug: when to use it — short of the side-effect nodes, right after the suspect node', () => {
  assert.match(flat, /without reaching its side-effect nodes \(creates, updates, business-object writes, notifications\)/);
  assert.match(flat, /stop at the node right AFTER the one under suspicion, then read the suspect's input, output and `nodeContext`/);
});

test('run-and-debug: reading the answer — a stop looks like a normal end on that node; only the established label forbids relaying the output', () => {
  assert.match(flat, /`breakpoints` = `\{requested, notExecuted, lastExecuted\}`; a node off the turn's path also lands in `notExecuted`/);
  assert.match(flat, /A stop shows as `finishReason:'stop'` whose `output` is the LAST EXECUTED node's output — the same shape as a turn that ended normally on that node \(an LLM reply\), so the stream alone does not tell them apart/);
  assert.match(flat, /`outputIs` without `unverified` = the stop is established \(the requested node is what the graph runs right after the last executed one, or the server named it as `pausedNode`\): `output` is not the agent's reply — never relay it as the workflow's answer/);
  assert.match(flat, /`outputIs` starting with `unverified` = not established: either `output` equals the last node's output but the graph does not run a requested node next \(it may be the real reply\), or it does not equal it/);
  assert.match(flat, /Check `nodes` against the graph before saying which/);
  assert.match(flat, /`paused` with `pausedNode` = a requested code and no `waitingNode` is a stop too \(how Oracle's CLI reads a breakpoint\): the answer has no `resume`/);
  assert.match(flat, /A `paused` with `waitingNode` is still a `HUMAN` or `WAIT` node waiting for a decision/);
  assert.match(flat, /Nothing resumes or continues a stopped turn/);
});

test('run-and-debug: mode 2 — `paused` is a HUMAN/WAIT wait only with waitingNode; at a requested breakpoint it is a stopped turn', () => {
  assert.match(flat, /`finishReason:'paused'` with `waitingNode` = the run waits on a `HUMAN` or `WAIT` node \(a `paused` at a requested breakpoint is a stopped turn — above\)/);
});

test('run-and-debug: a stopped turn leaves the conversation UNVERIFIED — investigate on a fresh conversation, never continue the real one', () => {
  assert.match(flat, /The conversation's server state after a stopped turn is UNVERIFIED/);
  assert.match(flat, /investigate a stopped turn on a fresh conversation — replay the earlier turns there \(mode 2, below\)/);
  assert.match(flat, /never continue a real interaction on a conversation that had a stopped turn until its state is verified/);
});

test('run-and-debug: rerun repeats stopBefore AND the conversationId — a stopped turn is investigated again on a fresh conversation, not rerun', () => {
  assert.match(flat, /`rerun:true` repeats the last request exactly — `stopBefore` AND its `conversationId` — so rerunning a stopped turn continues that UNVERIFIED conversation: investigate again on a fresh conversation instead \(above\); other breakpoints = a full request there\. A `resume` may carry `stopBefore` too/);
});

// Scenario runs: a batch from the user's file, run alone — the open questions are asked before the
// first run, improvised answers only with permission and always marked, one run at a time, one report.
const scen = (flat.split('## Scenario runs')[1] || '').split('## Tests')[0];

test('run-and-debug scenario runs: conversation policy, improvise permission and side effects are settled before the first run — asked when unclear', () => {
  assert.ok(scen.length > 0, 'the skill must have a Scenario runs section');
  assert.match(scen, /whatever they leave open, ask in ONE `AskUserQuestion` — never assume, never start a batch with an open question/);
  assert.match(scen, /Conversation policy, per batch or per scenario: a FRESH conversation per scenario, or the SAME conversation continued — then the user names the reset command/);
  assert.match(scen, /improvise on the user's behalf ONLY with their permission for this batch; without it such a step is `blocked`/);
  assert.match(scen, /"safe" or "don't create" means `stopBefore`\. When you ask, say that a full run creates real data on the pod/);
  assert.match(scen, /the saved DRAFT unless the user says PUBLISHED/);
  const settle = scen.split('The file:')[0];
  assert.match(settle, /SAME conversation \+ `stopBefore`: after a stop, do the remaining scenarios run fresh, or does the batch stop\?/, 'part of the ONE pre-run question');
  assert.match(scen, /in a SAME-conversation batch it ends the shared conversation — the remaining scenarios then run fresh or the batch stops, as settled before the first run/);
});

test('run-and-debug scenario runs: the upload reaches the workspace via fai_file_put, read with fai_file_read; CSV columns mapped by meaning and shown', () => {
  assert.match(scen, /`fai_file_put \{ws, fileId, path:'inputs\/<name>'\}`, then `fai_file_read \{ws, path\}`/);
  assert.match(scen, /Show the mapping and the scenario and step counts before running; a column that fits two meanings, or none, → ask/);
});

test('run-and-debug scenario runs: one run at a time (the pod\'s firewall bans bursts), pacing told to the user; approvals resume; a stopped turn ends its scenario', () => {
  assert.match(scen, /ONE CALL AT A TIME — the next only after the previous answer, never two runs in parallel: the pod's firewall bans request bursts\. Tell the user this pacing/);
  assert.match(scen, /An approval step answers a `paused` run with `waitingNode` → `resume:\{action, content\?\}`/);
  assert.match(scen, /A stopped turn leaves its conversation UNVERIFIED, so its scenario ends there/);
  assert.match(scen, /`responseFile` holds only the LAST run: diagnose a step before running the next one/);
});

test('run-and-debug scenario runs: improvised answers are marked, never presented as the file\'s; the never-invent rule stays the default', () => {
  assert.match(scen, /An improvised answer is marked `improvised` in every record and in the summary — never presented as the file's/);
  assert.match(flat, /never invent one \(the one exception: an improvised answer in a scenario run, with the user's permission — below\)/);
});

test('run-and-debug scenario runs: per-step record + diagnosis from the full run; one report folder delivered with fai_file_export; regression-test offer', () => {
  assert.match(scen, /`test-reports\/scenarios\/<batch>\/steps\.csv`/);
  assert.match(scen, /the executed nodes, `breakpoints` \(`requested`, `notExecuted`, `lastExecuted`\) and `outputIs` when present/);
  assert.match(scen, /`passed` \(the expected result holds\), `diverged`/);
  assert.match(scen, /Diagnose every `failed`, `diverged` or unexpected question from the full run \(`responseFile`: node input and output, `nodeContext`, `nodeStepInfo`/);
  assert.match(scen, /`fai_file_export \{ws, path:'test-reports\/scenarios\/<batch>'\}` \(one zip\) and offer to turn each stable scenario into a mode-1 regression test \(`fai_test_scaffold`\)/);
});
