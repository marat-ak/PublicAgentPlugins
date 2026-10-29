// The gnimsys-chat-widgets skill: a selection/decision turn on OUR chat component is a `gnimsys-ui`
// form block emitted by a CODE renderer (never a model), read back from the `<gnimsysSubmit>`
// envelope with the contract's regex and routed with a SWITCH on the clicked button's `data` key.
// A select datasource is a Business Objects API (BOSS) one by default, Fusion REST only on request.
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

// The datasource section of the skill (between its heading and the next `## `).
const dsSection = (() => {
  const m = skill.match(/\n## The datasource — [\s\S]*?(?=\n## )/);
  assert.ok(m, 'datasource section missing');
  return m[0];
})();
const sub = (title) => {
  const m = dsSection.match(new RegExp(`\\n### ${title}[\\s\\S]*?(?=\\n### |$)`));
  assert.ok(m, `datasource subsection "${title}" missing`);
  return m[0].replace(/\s+/g, ' ');
};

test('gnimsys-chat-widgets: inline options for fixed short lists; a datasource only on the user\'s confirmation of the page config', () => {
  assert.match(flat, /Inline `options` only for FIXED short lists/);
  assert.match(flat, /`dataSource` for anything large or searchable — items, serials, lots, suppliers \(thousands\)/);
  assert.match(flat, /Only when the user confirms the page configuration allows it: config `datasources\.allowInline` true AND a `url` starting with one of `datasources\.allowPrefixes`/);
  assert.match(flat, /Never assume it is allowed/);
  assert.match(flat, /Business Objects API \(BOSS\) by default, Fusion REST only when the user asks for it/);
});

test('gnimsys-chat-widgets: BOSS is the default datasource, Fusion REST only on the user\'s request — BOSS comes first', () => {
  const ds = dsSection.replace(/\s+/g, ' ');
  assert.match(ds, /`target` decides the query language the chat speaks: `"BOSS"` = the Business Objects API, every other target = Fusion REST/);
  assert.match(ds, /Write a BOSS datasource unless the user asks for Fusion REST/);
  assert.match(ds, /with `valueField` \+ `labelField` \(\+ optional `searchTemplate \{ "minChars", "debounceMs" \}`\) on the field/);
  const boss = dsSection.indexOf('### BOSS — `"target": "BOSS"` (the default)');
  const fa = dsSection.indexOf('### Fusion REST — `"target": "FA"`, only when the user asks for it');
  assert.ok(boss > 0 && fa > boss, 'BOSS subsection must come before the FA one');
  assert.match(skill, /description: .*server-searched datasource \(Business Objects API by default, Fusion REST on request\)/);
});

test('gnimsys-chat-widgets: the BOSS rules — {{query}} inside $filter, $fields with value+label, valueField unique without the url filter, no paging params', () => {
  const b = sub('BOSS');
  assert.match(b, /`url` = `\/api\/boss\/data\/objects\/ora\/<family>\/<product>\/v1\/\$en\/<object>\?…`/);
  assert.match(b, /`\{\{query\}\}` sits inside the url's `\$filter`, within single quotes — `<attr> ~LIKE '%\{\{query\}\}%'`/);
  assert.match(b, /The chat substitutes the typed text \(single quotes doubled\) and URL-encodes the whole `\$filter`: write it unencoded/);
  assert.match(b, /MANDATORY for a large set; a `\$filter` without it is paged but unsearchable \(small lists only\)/);
  assert.match(b, /`\$fields` lists at least the `valueField` and the `labelField`/);
  assert.match(b, /`valueField` must identify ONE row without the url's own filter: the chat fetches the selected value's label by `\$filter=\(<valueField> = 'k1' or …\)` on the url with its whole `\$filter` removed/);
  assert.match(b, /Never `\$limit` or `\$offset` \(nor `q`, `limit`, `offset`\) in the url — the chat writes `\$limit` \(the page size\) and `\$offset`/);
  assert.match(b, /it never asks for a row count/);
  assert.match(b, /Omit `dataTransform`: the response is `\{items, hasMore\}`/);
  assert.match(b, /`datasources\.allowPrefixes` must hold a BOSS prefix — `\/api\/boss\/data\/objects\/ora\/`/);
  assert.match(b, /confirmed by the user like the rest of the config; none there → say so: the user adds it or asks for Fusion REST/);
});

test('gnimsys-chat-widgets: the BOSS example field is the contract\'s worked example and keeps every BOSS rule', () => {
  const m = dsSection.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(m, 'BOSS example field missing');
  const f = JSON.parse(m[1]);
  assert.equal(f.type, 'select');
  assert.ok(!('options' in f), 'a datasource select carries no inline options');
  assert.deepEqual(f.dataSource, {
    type: 'rest', target: 'BOSS', method: 'GET',
    url: "/api/boss/data/objects/ora/commonFusionAI/agents/v1/$en/workflows?$filter=status = 'PUBLISHED' and name ~LIKE '%{{query}}%'&$fields=workflowCode,name",
  });
  assert.equal(f.valueField, 'workflowCode');
  assert.equal(f.labelField, 'name');
  const [path, query] = f.dataSource.url.split('?');
  assert.match(path, /^\/api\/boss\/data\/objects\/ora\/[^/]+\/[^/]+\/v1\/\$en\/[^/]+$/);
  const params = Object.fromEntries(query.split('&').map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
  assert.ok(params.$filter.includes("'%{{query}}%'"), '{{query}} sits inside the $filter quotes');
  assert.deepEqual(params.$fields.split(',').sort(), [f.labelField, f.valueField].sort());
  for (const k of ['q', 'limit', 'offset', '$limit', '$offset']) assert.ok(!(k in params), `no ${k} on a BOSS url`);
  assert.ok(!('dataTransform' in f.dataSource));
});

test('gnimsys-chat-widgets: unverified BOSS points are stated where they change what the agent writes', () => {
  const b = sub('BOSS');
  assert.match(b, /Not yet proven on a pod, and it shapes what you write/);
  assert.match(b, /a number key is sent unquoted \(prefer a string code attribute as `valueField`\)/);
  assert.match(b, /`~LIKE` is taken as case-insensitive \(ask for a lower-case search in the user's first page test\)/);
  assert.match(b, /whether the end user's Visual Builder session may read the object — the README's `## Known issues & limitations` lists it as open until that test/);
});

test('gnimsys-chat-widgets: the BOSS object and attribute names come from the corpus or the pod, else from the user — never derived or invented', () => {
  const d = sub('Finding the BOSS object and its attribute names');
  assert.match(d, /`fai_bo_search \{q, resourcePath:'\/api\/boss\/data\/objects\/'\}` → Studio BOs whose functions call a BOSS object; `fai_bo_get \{code\}` → their resource paths/);
  assert.match(d, /Pod \(when the user asked for the pod — \*\*pod-operations\*\*\)/);
  assert.match(d, /`list-supported-business-objects \{query, family, product\}` → `get-business-object-functions \{objectCode\}` \(resource paths\) → `get-bo-function-output-specification \{objectCode, functionName\}`/);
  assert.match(d, /An object no Studio BO wraps is out of every tool's reach, and no tool runs the datasource url itself: ask the user for the object path and the exact attribute names/);
  assert.match(d, /Never derive them from the Fusion REST resource of the same data \(another API, its own names\), never invent them/);
  assert.match(d, /A pod read runs as the developer's sign-in: it proves the object and the names, not the end user's access/);
});

test('gnimsys-chat-widgets: Fusion REST keeps its rules as the on-request alternative', () => {
  const fa = sub('Fusion REST');
  assert.match(fa, /e\.g\. `"url": "\/fscmRestApi\/resources\/11\.13\.18\.05\/itemsV2\?q=UPPER\(ItemNumber\) LIKE '\{\{query\}\}%'&onlyData=true"`/);
  assert.match(fa, /`\{\{query\}\}` in the url's `q` clause is MANDATORY for a large set/);
  assert.match(fa, /a url without it is paged but unsearchable \(small lists only\)/);
  assert.match(fa, /Never a `limit` or `offset` in the url — the chat appends them and pages/);
  assert.match(fa, /`valueField` must be a filterable key attribute of the resource/);
  assert.match(fa, /`\$filter` \/ `\$fields` are BOSS syntax, never on an FA url/);
  const both = sub('Both targets');
  assert.match(both, /Never `"type": "lodash"`: the chat does not evaluate expressions/);
  assert.match(both, /`dependsOn` \(cascading selects\) is not in this slice/);
});

test('gnimsys-chat-widgets: the mistakes list names the datasource mistakes per target', () => {
  const mistakes = flat.slice(flat.indexOf('## Common mistakes'));
  assert.match(mistakes, /A Fusion REST \(`"target": "FA"`\) datasource the user did not ask for/);
  assert.match(mistakes, /On a BOSS url: `q`, `limit`, `offset`, `\$limit` or `\$offset`; `\{\{query\}\}` outside the `\$filter`; `\$fields` without the `valueField` or the `labelField`; a `valueField` unique only inside the url's own filter; an object path or attribute name that no tool found and the user did not give/);
  assert.match(mistakes, /On an FA url: `\$filter` or `\$fields`; a `limit` or `offset`/);
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
