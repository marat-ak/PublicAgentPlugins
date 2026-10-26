// The gnimsys-chat-widgets skill: a selection/decision turn on OUR chat component is a `gnimsys-ui`
// form block emitted by a CODE renderer (never a model), read back from the `<gnimsysSubmit>`
// envelope with the contract's regex and routed with a SWITCH on the clicked button's `data` key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const skill = read('../skills/gnimsys-chat-widgets/SKILL.md');
const flat = skill.replace(/\s+/g, ' ');
const widgets = read('../skills/widgets-and-forms/SKILL.md').replace(/\s+/g, ' ');
const instructions = read('../instructions.md');

// The contract's parse regex, verbatim, and a submit message as the component builds it.
const ENVELOPE = /<gnimsysSubmit id="([^"]+)">(.*?)<\/gnimsysSubmit>/;
const SUBMIT = 'Approve — Select the destination subinventory\n'
  + '<gnimsysSubmit id="destSubinv">{"subinv":"FGI","org":"M1","decision":"APPROVE"}</gnimsysSubmit>';

test('gnimsys-chat-widgets: the surface is stated by the user, never assumed; the block is text anywhere else', () => {
  assert.match(flat, /Emit it only when the user has said the workflow's chat surface is our component/);
  assert.match(flat, /The Studio test chat, Ask Oracle and an Agentic App panel print it as text/);
  assert.match(flat, /an Agentic App gets `oraInfoDisplay` \(\*\*widgets-and-forms\*\*\), Oracle chat gets pills/);
});

test('gnimsys-chat-widgets: references the published schema and the Oracle node contracts', () => {
  assert.match(skill, /fusion-ai-chat\/src\/ts\/jet-composites\/xxx-gnimsys-ai\/chat\/schemas\/gnimsys-ui-v1\.schema\.json/);
  assert.match(flat, /`\$id` `https:\/\/gnimsys\.com\/schemas\/ai-chat\/gnimsys-ui-v1\.json`/);
  for (const ref of ['workflow-node-prompts/code.md', '`return.md`', '`switch.md`']) {
    assert.ok(flat.includes(ref), `skill must point at ${ref}`);
  }
});

test('gnimsys-chat-widgets: the block — v 1, kind form only, select = exactly one option source, every button submits', () => {
  assert.match(flat, /`kind` \| `form` — a choice is a `form` with one `radio` \/ `checkbox` field; no other kind in this slice/);
  assert.match(flat, /`id` \| `\[A-Za-z0-9_-\]\{1,64\}`, unique in the message; echoed in the submit/);
  assert.match(flat, /EXACTLY ONE of `options: \[\{ "value", "label" \}\]` \(any length\) or `dataSource` \+ `valueField` \+ `labelField`/);
  assert.match(flat, /`radio` \| `options` inline only, optional `description` per option/);
  assert.match(flat, /`hidden` \| — \| string, echoed verbatim in the submit/);
  assert.match(flat, /`data` \(REQUIRED, non-empty object of scalars\/arrays, merged on top of the field values in the submit JSON/);
  assert.match(flat, /two buttons with equal `data` are rejected by the chat/);
  assert.match(flat, /EVERY button submits the same values plus its own `data` — there is no non-submitting button/);
  assert.match(flat, /`validate` \(default `true`: `required` fields must be filled; `false` submits whatever is there\)/);
  assert.doesNotMatch(skill, /kind="form"|action="/);
});

test('gnimsys-chat-widgets: inline options for fixed short lists; a datasource (server search via {{query}}, paged by the chat) only on the user\'s confirmation of the page config', () => {
  assert.match(flat, /Inline `options` only for FIXED short lists/);
  assert.match(flat, /`dataSource` for anything large or searchable — items, serials, lots, suppliers \(thousands\)/);
  assert.match(flat, /Only when the user confirms the page configuration allows it: config `datasources\.allowInline` true AND a `url` starting with one of `datasources\.allowPrefixes`/);
  assert.match(flat, /Never assume it is allowed/);
  assert.match(flat, /`\{ "type": "rest", "target": "FA", "method": "GET", "url": "\/fscmRestApi\/resources\/…"/);
  assert.match(flat, /`\{\{query\}\}` in the url's `q` clause is MANDATORY for a large set/);
  assert.match(flat, /a url without it is paged but unsearchable \(small lists only\)/);
  assert.match(flat, /Optional `searchTemplate \{ "minChars", "debounceMs" \}`/);
  assert.match(flat, /Never a `limit` or `offset` in the url — the chat appends them and pages/);
  assert.match(flat, /`valueField` must be a filterable key attribute of the resource/);
  assert.match(flat, /Never `"type": "lodash"`: the chat does not evaluate expressions/);
  assert.match(flat, /`dependsOn` \(cascading selects\) is not in this slice/);
});

test('gnimsys-chat-widgets: emitted by a CODE renderer and a RETURN — no model writes or copies a block', () => {
  assert.match(flat, /CODE RENDER_<STEP>_BLOCK/);
  assert.match(flat, /RETURN RETURN_<STEP> returnValue \{\{\$context\.\$nodes\.RENDER_<STEP>_BLOCK\.\$output\.result\}\}, outcomes \{\}/);
  assert.match(flat, /No `LLM` emits or copies a block in this slice/);
  assert.match(skill, /JSON\.stringify\(block\)/);
  assert.match(flat, /The JSON has no newlines/);
});

test('gnimsys-chat-widgets: the parse snippet is the contract regex and it parses the component\'s submit message', () => {
  const snippet = skill.match(/```js\r?\n(const text = String\(\$context\.\$system\.\$inputMessage[\s\S]*?)```/);
  assert.ok(snippet, 'parser CODE snippet missing');
  assert.ok(snippet[1].includes(ENVELOPE.source), 'the snippet must carry the contract regex verbatim');
  assert.match(snippet[1], /JSON\.parse\(m\[2\]\)/);
  // run the snippet's logic as a function body over the sample submit
  const body = snippet[1].replace('$context.$system.$inputMessage', 'inputMessage');
  const parsed = new Function('inputMessage', body)(SUBMIT);
  assert.deepEqual(parsed, { submitted: true, id: 'destSubinv', values: { subinv: 'FGI', org: 'M1', decision: 'APPROVE' } });
  assert.deepEqual(new Function('inputMessage', body)('what is my balance?'), { submitted: false, id: '', values: {} });
  assert.match(flat, /let `JSON\.parse` throw \(the node reports `error`\), never swallow it/);
});

test('gnimsys-chat-widgets: routing — CONDITION on submitted, SWITCH on the button data key with every button value as a case; the submit is re-validated', () => {
  assert.match(flat, /`CONDITION IS_SUBMIT` `\{\{\$context\.\$nodes\.PARSE_SUBMIT\.\$output\.result\.submitted === true\}\}`/);
  assert.match(flat, /`SWITCH ROUTE_DECISION` with `caseExpression` `\{\{\$context\.\$nodes\.PARSE_SUBMIT\.\$output\.result\.values\.decision\}\}` and one outcome per button `data` value/);
  assert.match(flat, /`SWITCH` has no default, so every button's value is a case/);
  assert.match(flat, /Give all buttons of a block the same `data` key \(`decision`\) with distinct values/);
  assert.match(flat, /The submit is untrusted input: re-validate the chosen value against the source list/);
  assert.match(flat, /values are option `value`s, never labels/);
});

test('gnimsys-chat-widgets: hidden fields carry turn state; Back/Cancel validate:false; follow-up chips off is a recommendation', () => {
  assert.match(flat, /`hidden` carries what the next turn needs and the user does not choose/);
  assert.match(flat, /accumulated wizard state as ONE JSON string in one field/);
  assert.match(flat, /Back \/ Cancel buttons carry `validate: false`/);
  assert.match(flat, /`fai_workflow_followup \{op:'set', enabled:false\}`/);
  assert.match(flat, /disabling them is the recommendation — stated, not enforced/);
});

test('gnimsys-chat-widgets: the worked example — the emitted block parses as a valid v1 form and its submit matches the contract', () => {
  const block = skill.match(/```gnimsys-ui\r?\n(\{.*\})\r?\n```/);
  assert.ok(block, 'example block missing');
  const b = JSON.parse(block[1]);
  assert.equal(b.v, 1);
  assert.equal(b.kind, 'form');
  assert.equal(b.id, 'destSubinv');
  const ids = b.fields.map((f) => f.id);
  assert.deepEqual(ids, ['subinv', 'org']);
  assert.equal(b.fields[0].type, 'select');
  assert.ok(b.fields[0].options.length > 0 && !('dataSource' in b.fields[0]));
  assert.equal(b.fields[1].type, 'hidden');
  assert.deepEqual(b.buttons.map((x) => x.id), ['approve', 'back']);
  assert.deepEqual(b.buttons.map((x) => x.data), [{ decision: 'APPROVE' }, { decision: 'BACK' }]);
  assert.equal(b.buttons[1].validate, false);
  for (const x of b.buttons) for (const k of Object.keys(x.data)) assert.ok(!ids.includes(k), `button data key ${k} clashes with a field id`);
  assert.ok(skill.includes(SUBMIT), 'the example submit message must be the contract shape byte for byte');
});

test('gnimsys-chat-widgets: wired — listed in instructions.md, cross-referenced from widgets-and-forms (pills = Oracle chat)', () => {
  assert.match(instructions, /\*\*gnimsys-chat-widgets\*\*/);
  assert.match(widgets, /Pills are Oracle's chat surfaces only\. When the user says the surface is OUR chat component \(`xxx-gnimsys-ai-chat`\), a selection or decision turn emits a `gnimsys-ui` block instead — skill \*\*gnimsys-chat-widgets\*\*/);
});
