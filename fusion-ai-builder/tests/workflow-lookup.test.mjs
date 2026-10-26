// Finding a pod workflow by its name: fai_pod_workflows is the lookup (pod-operations holds the
// recipe, chat-debugger points at it); search-workflows is a suggestions agent, not a lookup; no
// plugin text tells the user that workflows cannot be listed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const flat = (t) => t.replace(/\s+/g, ' ');
const pod = read('../skills/pod-operations/SKILL.md');
const dbg = read('../skills/chat-debugger/SKILL.md');

test('pod-operations: a "Find a workflow by name or code" recipe built on fai_pod_workflows', () => {
  const sec = pod.split(/\r?\n## /).find((s) => /^Find a workflow by name or code/.test(s));
  assert.ok(sec, 'section missing');
  const f = flat(sec);
  assert.match(f, /`fai_pod_workflows \{ws, query\}`/);
  assert.match(f, /substring match on name OR code/);
  assert.match(f, /`paging\.nextOffset` while `hasMore`/);
  assert.match(f, /`AskUserQuestion` with code, name and status/);
  assert.match(f, /Ask the user for the code only when the list has no match/);
  assert.match(f, /`search-workflows` is NOT a lookup/);
  assert.match(f, /`list-policy-workflow-contexts` returns only PUBLISHED workflows .* it misses every workflow that has only a DRAFT/);
  assert.match(f, /never tell the user there is no way to list or find them/);
  assert.match(flat(pod), /\| Find a workflow by name or code \(the pod's workflow list\) \| `fai_pod_workflows \{ws, query\}` \|/);
});

test('pod-operations: the "What becomes possible" table is one table (no prose between its rows)', () => {
  const sec = pod.split(/\r?\n## /).find((s) => /^What becomes possible/.test(s));
  const lines = sec.split(/\r?\n/);
  const first = lines.findIndex((l) => l.startsWith('|'));
  let last = first;
  while (last + 1 < lines.length && lines[last + 1].startsWith('|')) last += 1;
  assert.equal(lines.slice(last + 1).filter((l) => l.startsWith('|')).length, 0, 'a table row after the table ended');
});

test('chat-debugger: a workflow named by its title is looked up with fai_pod_workflows, not asked for first', () => {
  const f = flat(dbg);
  assert.match(f, /`fai_pod_workflows \{ws, query\}` on a workspace connected to the signed-in instance — skill \*\*pod-operations\*\* §Find a workflow by name or code/);
  assert.match(f, /Ask the user for the code only when that list has no match/);
  assert.match(f, /`search-workflows` is a suggestions agent, not a lookup/);
  assert.doesNotMatch(f, /none in this conversation → ask the user for the code/);
});

test('no plugin text says workflows cannot be listed, or sends the agent to search-workflows as a lookup', () => {
  const own = fs.readdirSync(new URL('../skills/', import.meta.url)).filter((d) => d !== 'aistudio');
  for (const t of [read('../instructions.md'), ...own.map((d) => read(`../skills/${d}/SKILL.md`))]) {
    assert.doesNotMatch(flat(t), /no way to list workflows|cannot list workflows|Never search a pod for a workflow/i);
  }
});
