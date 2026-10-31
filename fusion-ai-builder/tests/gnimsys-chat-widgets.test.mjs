// The gnimsys-chat-widgets skill: a selection/decision turn on OUR chat component is a `gnimsys-ui`
// form block emitted by a CODE renderer (never a model), read back from the `<gnimsysSubmit>`
// envelope with the contract's regex and routed with a SWITCH on the clicked button's `data` key.
// A select datasource is a Business Objects API (BOSS) one by default, Fusion REST or a BI Publisher
// report (`BIPReport`, only one the user names) on request. A select may show its dropdown as a table
// (`collectionTemplateTable`) and submit the whole picked row(s) (`submit: "item"`).
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
  assert.match(flat, /Business Objects API \(BOSS\) by default, Fusion REST only when the user asks for it, a BI Publisher report only when the user names one/);
});

test('gnimsys-chat-widgets: BOSS is the default datasource, Fusion REST only on the user\'s request — BOSS comes first', () => {
  const ds = dsSection.replace(/\s+/g, ' ');
  assert.match(ds, /`target` decides the query language the chat speaks: `"BOSS"` = the Business Objects API, every other target = Fusion REST/);
  assert.match(ds, /Write a BOSS datasource unless the user asks for Fusion REST or names a BI Publisher report/);
  assert.match(ds, /with `valueField` \+ `labelField` \(\+ optional `searchField` and `searchTemplate \{ "minChars", "debounceMs" \}`\) on the field/);
  assert.match(ds, /the dashboard REST datasource `\{ "type": "rest", "target", "method": "GET", "url", "headers"\?, "body"\?, "dataTransform"\? \}` and a BI Publisher report `\{ "type": "BIPReport", … \}`/);
  const boss = dsSection.indexOf('### BOSS — `"target": "BOSS"` (the default)');
  const fa = dsSection.indexOf('### Fusion REST — `"target": "FA"`, only when the user asks for it');
  const bip = dsSection.indexOf('### BI Publisher report — `"type": "BIPReport"`, only when the user names the report');
  assert.ok(boss > 0 && fa > boss && bip > fa, 'BOSS subsection first, then FA, then the report');
  assert.match(skill, /description: .*server-searched datasource \(Business Objects API by default, Fusion REST or a BI Publisher report on request\), its dropdown optionally a table and its submit optionally the whole picked row/);
});

test('gnimsys-chat-widgets: no placeholder in a datasource url — fixed filters only, the chat builds the search clause on searchField else labelField', () => {
  const ds = dsSection.replace(/\s+/g, ' ');
  assert.match(ds, /The url carries only FIXED filters — never `\{\{query\}\}` or any other placeholder: the `RETURN` node evaluates every `\{\{…\}\}` in its output, so a placeholder reaches the chat empty/);
  assert.match(ds, /The chat builds the search clause itself from the typed text on `searchField` \(else `labelField`\) and ANDs it with the url's fixed filter; empty text = the fixed filter only/);
  for (const m of skill.matchAll(/"url":\s*"([^"]*)"/g)) assert.ok(!m[1].includes('{{'), `placeholder in url ${m[1]}`);
  assert.match(flat, /`\{\{query\}\}` or any other placeholder in a datasource url — the chat builds the search clause/);
  assert.match(ds, /The same holds for every value in the block: no `\{\{…\}\}` anywhere — report `parameters` are literal values the renderer writes/);
  assert.match(flat, /`\{\{…\}\}` in report `parameters` or anywhere else in the block — literal values only/);
  // no example field in the skill carries a template in any value
  for (const m of skill.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)) assert.ok(!m[1].includes('{{'), 'template in an example field');
});

test('gnimsys-chat-widgets: the BOSS rules — $filter fixed only, $fields with value+label, valueField unique without the url filter, no paging params', () => {
  const b = sub('BOSS');
  assert.match(b, /`url` = `\/api\/boss\/data\/objects\/ora\/<family>\/<product>\/v1\/\$en\/<object>\?…`/);
  assert.match(b, /`\$filter` = the fixed condition only \(omit it when there is none\)\. The chat ANDs `<searchField> ~LIKE '%<text>%'` to it and URL-encodes the whole `\$filter`: write it unencoded/);
  assert.match(b, /`\$fields` lists at least the `valueField` and the `labelField`/);
  assert.match(b, /`valueField` must identify ONE row without the url's fixed filter: the chat fetches the selected value's label by `\$filter=\(<valueField> = 'k1' or …\)` on the url with its whole `\$filter` removed/);
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
    url: "/api/boss/data/objects/ora/commonFusionAI/agents/v1/$en/workflows?$filter=status = 'PUBLISHED'&$fields=workflowCode,name",
  });
  assert.equal(f.valueField, 'workflowCode');
  assert.equal(f.labelField, 'name');
  const [path, query] = f.dataSource.url.split('?');
  assert.match(path, /^\/api\/boss\/data\/objects\/ora\/[^/]+\/[^/]+\/v1\/\$en\/[^/]+$/);
  const params = Object.fromEntries(query.split('&').map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
  assert.ok(!f.dataSource.url.includes('{{'), 'no placeholder in the url');
  assert.equal(params.$filter, "status = 'PUBLISHED'", 'the $filter is the fixed condition only');
  assert.ok(!('searchField' in f), 'the label is the searched attribute here');
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
  assert.match(fa, /e\.g\. `"url": "\/fscmRestApi\/resources\/11\.13\.18\.05\/itemsV2\?onlyData=true"` with `"searchField": "ItemNumber"`/);
  assert.match(fa, /`q` = the fixed condition only \(omit it when there is none\)\. The chat ANDs `UPPER\(<searchField>\) LIKE '%<TEXT>%'` to it — the typed text upper-cased, a case-insensitive contains/);
  assert.match(fa, /The chat sends `REST-Framework-Version: 4` itself — leave it out of `headers`\. One written there must be `2` or higher: a lower value is refused and the field shows "datasource failed: … cannot carry the search filter"\. A BOSS datasource gets no framework header/);
  assert.doesNotMatch(fa, /TODO|TBD/);
  assert.match(fa, /Never a `limit` or `offset` in the url — the chat appends them and pages/);
  assert.match(fa, /`valueField` must be a filterable key attribute of the resource/);
  assert.match(fa, /`\$filter` \/ `\$fields` are BOSS syntax, never on an FA url/);
  const both = sub('Both REST targets');
  assert.match(both, /Never `"type": "lodash"`: the chat does not evaluate expressions/);
  assert.match(both, /`dependsOn` \(cascading selects\) is not in this slice/);
});

test('gnimsys-chat-widgets: the mistakes list names the datasource mistakes per target', () => {
  const mistakes = flat.slice(flat.indexOf('## Common mistakes'));
  assert.match(mistakes, /A Fusion REST \(`"target": "FA"`\) datasource the user did not ask for/);
  assert.match(mistakes, /On a BOSS url: `q`, `limit`, `offset`, `\$limit` or `\$offset`; `\$fields` without the `valueField` or the `labelField`; a `valueField` unique only inside the url's fixed filter; an object path or attribute name that no tool found and the user did not give/);
  assert.match(mistakes, /On an FA url: `\$filter` or `\$fields`; a `limit` or `offset`/);
});

// The table / item section of the skill, and every ```json example field of a text.
const tableSection = (() => {
  const m = skill.match(/\n## Table dropdown and whole-row submit — [\s\S]*?(?=\n## )/);
  assert.ok(m, 'table / item section missing');
  return m[0];
})();
const jsonFields = (text) => [...text.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map((m) => JSON.parse(m[1]));
const reportField = () => {
  const [f] = jsonFields(dsSection.slice(dsSection.indexOf('### BI Publisher report')));
  assert.ok(f, 'report example field missing');
  return f;
};
const parseSnippet = () => {
  const snippet = skill.match(/```js\r?\n(const text = String\(\$context\.\$system\.\$inputMessage[\s\S]*?)```/);
  assert.ok(snippet, 'parser CODE snippet missing');
  return new Function('inputMessage', snippet[1].replace('$context.$system.$inputMessage', 'inputMessage'));
};

test('gnimsys-chat-widgets: the block\'s select row names the optional table and submit keys', () => {
  assert.match(flat, /optional `collectionTemplateTable` and `submit` \(section "Table dropdown and whole-row submit"\)/);
  assert.match(flat, /`submit: "item"` → the submit carries the row\(s\), `value` presets stay keys/);
});

test('gnimsys-chat-widgets: a report must exist — every name from the user, no tool of this agent reads BI Publisher', () => {
  const r = sub('BI Publisher report');
  assert.match(r, /The report must exist: its catalog path, its data model's row elements, its columns and its parameters come from the user or from a source the user gives/);
  assert.match(r, /never invented, guessed or derived from a table or REST resource of the same data/);
  assert.match(r, /No tool of this agent reads BI Publisher: no `fai_\*` tool and no `aistudio` CLI command opens a report, its data model or its output\. Ask the user for each name that is missing/);
  assert.match(flat, /A BI Publisher report the user did not name; a report path, row element, column name or type, or parameter the user did not give/);
});

test('gnimsys-chat-widgets: the report shape — target FA only, typed columns, declared value/label/search columns, literal parameters', () => {
  const r = sub('BI Publisher report');
  assert.match(r, /`target` is `"FA"` only/);
  assert.match(r, /`reportName` = the absolute catalog path `\/…\/NAME\.xdo`; `recordsetSelector` = the element wrapping the rows \(the data model's root, e\.g\. `DATA_DS`\); `recordSelector` = one row's element \(the data set's group, e\.g\. `G_1`\)/);
  assert.match(r, /`type` `2` = number, `1` or none = text/);
  assert.match(r, /A row is exactly these columns; an element BI Publisher leaves out \(a NULL\) is `null`/);
  assert.match(r, /`valueField`, `labelField` and `searchField` must be declared columns, else the chat refuses the block/);
  assert.match(r, /`parameters` = fixed literal values `\[\{ "name", "value" \}\]`: a string, a number, or an array of them \(a multi-value parameter\); names unique, never the `searchParam`/);
});

test('gnimsys-chat-widgets: searchParam decides who searches — the report (searchTemplate applies, searchField refused) or the chat (searchTemplate refused)', () => {
  const r = sub('BI Publisher report');
  assert.match(r, /With `searchParam`: each distinct typed text is one report run with that parameter = the text as typed \(`""` when nothing is typed/);
  assert.match(r, /the report does the matching/);
  assert.match(r, /`searchTemplate` applies; `searchField` is refused/);
  assert.match(r, /Without `searchParam`: the report runs once and the chat filters its rows on `searchField` \(else `labelField`, a case-insensitive contains\); `searchTemplate` is refused/);
});

test('gnimsys-chat-widgets: the report gate covers the report service; the unverified points go to the README Known issues', () => {
  const r = sub('BI Publisher report');
  assert.match(r, /`datasources\.allowInline` must be true and `datasources\.allowPrefixes` must hold an entry covering `\/xmlpserver\/services\/ExternalReportWSSService`, e\.g\. `"\/xmlpserver\/"` — confirmed by the user like the rest of the config/);
  assert.match(r, /Not yet proven on a pod — the README's `## Known issues & limitations` lists each as open until the user's first page test/);
  assert.match(r, /the `runReport` call through the page's Visual Builder FA service connection and through the chat debugger; Visual Builder reading the `application\/soap\+xml` answer as text; the real BI Publisher fault and `reportBytes` shapes; how BI Publisher treats the empty `searchParam` value; the report's real output volume/);
});

test('gnimsys-chat-widgets: the report example field — multi, searched by the report, a table of declared columns, item submit', () => {
  const f = reportField();
  assert.equal(f.type, 'select');
  assert.equal(f.multi, true);
  assert.equal(f.submit, 'item');
  assert.ok(!('options' in f), 'a datasource select carries no inline options');
  const ds = f.dataSource;
  assert.deepEqual(Object.keys(ds).sort(), ['columns', 'parameters', 'recordSelector', 'recordsetSelector', 'reportName', 'searchParam', 'target', 'type']);
  assert.equal(ds.type, 'BIPReport');
  assert.equal(ds.target, 'FA');
  assert.match(ds.reportName, /^\/.+\.xdo$/);
  const names = ds.columns.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'column names are unique');
  for (const c of ds.columns) {
    assert.deepEqual(Object.keys(c).filter((k) => k !== 'name' && k !== 'type'), [], 'a column is { name, type? }');
    if ('type' in c) assert.ok([1, 2].includes(c.type), 'a column type is 1 or 2');
  }
  for (const k of ['valueField', 'labelField']) assert.ok(names.includes(f[k]), `${k} is a declared column`);
  assert.ok(!('searchField' in f), 'no searchField beside searchParam');
  assert.ok('searchTemplate' in f, 'searchTemplate applies with searchParam');
  assert.ok(!ds.parameters.some((p) => p.name === ds.searchParam), 'the searchParam is not a fixed parameter');
  for (const p of ds.parameters) assert.ok(['string', 'number'].includes(typeof p.value) || Array.isArray(p.value), 'a parameter value is a literal');
  const table = f.collectionTemplateTable.map((c) => c.field);
  assert.equal(new Set(table).size, table.length, 'table fields are unique');
  for (const x of table) assert.ok(names.includes(x), `table field ${x} is a declared column`);
});

test('gnimsys-chat-widgets: table dropdown + item submit — the keys, the row per source, inline rows only with either key', () => {
  const t = tableSection.replace(/\s+/g, ' ');
  assert.match(t, /`collectionTemplateTable: \[\{ "field", "headerText"\? \}\]` — at least one, each `field` once/);
  assert.match(t, /Single: a row click \(or Enter\) picks that row\. Multi: the table's row selection is the value/);
  assert.match(t, /a REST row field \(not checked: a wrong name shows an empty column/);
  assert.match(t, /`submit`: `"value"` \(default — the key, as before\) or `"item"` \(the whole picked row\)/);
  assert.match(t, /single `\{…row\}`, `null` when unset; multi `\[\{…row\}, …\]` in the order picked, `\[\]` when unset\. `value` presets stay keys either way/);
  assert.match(t, /a report row = exactly its declared `columns`, typed; a REST row = every field the resource returned/);
  assert.match(t, /`fields=` with `onlyData=true` \(Fusion REST rows otherwise carry `links`\); an inline option = the option as written/);
  assert.match(t, /Inline options are rows only with `collectionTemplateTable` or `submit: "item"`/);
  assert.match(t, /Without either key any other option field is refused/);
  assert.match(flat, /Extra inline option fields without `collectionTemplateTable` or `submit: "item"`; a table field no option carries, or a REST table field the url does not return/);
});

test('gnimsys-chat-widgets: several entities in one list = one row per combination from the source; the chat neither joins nor flattens', () => {
  const t = tableSection.replace(/\s+/g, ' ');
  assert.match(t, /Several entities in one list \(a supplier and its site in one pick\) = one row per combination FROM THE SOURCE: a report whose data set returns supplier-site rows/);
  assert.match(t, /The chat neither joins two sources nor flattens nested data/);
  // `expand` is named only as what does not work
  let i = flat.indexOf('`expand`');
  assert.ok(i > 0, '`expand` is named as a non-mechanism');
  for (; i >= 0; i = flat.indexOf('`expand`', i + 1)) {
    const around = flat.slice(i - 40, i + 60);
    assert.ok(/no way|instead of/.test(around), `\`expand\` suggested: ${around}`);
  }
});

test('gnimsys-chat-widgets: the BOSS table + item example keeps the BOSS rules and lists every shown field in $fields', () => {
  const [f] = jsonFields(tableSection);
  assert.ok(f, 'BOSS table example field missing');
  assert.equal(f.submit, 'item');
  assert.deepEqual([f.dataSource.type, f.dataSource.target, f.dataSource.method], ['rest', 'BOSS', 'GET']);
  assert.ok(!f.dataSource.url.includes('{{'), 'no placeholder in the url');
  const [path, query] = f.dataSource.url.split('?');
  assert.match(path, /^\/api\/boss\/data\/objects\/ora\/[^/]+\/[^/]+\/v1\/\$en\/[^/]+$/);
  const params = Object.fromEntries(query.split('&').map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
  const listed = params.$fields.split(',');
  for (const k of [f.valueField, f.labelField, ...f.collectionTemplateTable.map((c) => c.field)]) assert.ok(listed.includes(k), `${k} missing from $fields`);
  for (const k of ['q', 'limit', 'offset', '$limit', '$offset']) assert.ok(!(k in params), `no ${k} on a BOSS url`);
});

test('gnimsys-chat-widgets: the item envelope example parses with the contract parser into rows of exactly the declared columns, typed', () => {
  const env = tableSection.match(/```\r?\n(OK — Pick the supplier sites\r?\n<gnimsysSubmit[^\n]*)\r?\n```/);
  assert.ok(env, 'item envelope example missing');
  const parsed = parseSnippet()(env[1]);
  assert.equal(parsed.submitted, true);
  assert.equal(parsed.id, 'supplierSites');
  assert.equal(parsed.values.decision, 'OK');
  const f = reportField();
  const rows = parsed.values[f.id];
  assert.ok(Array.isArray(rows) && rows.length === 1, 'multi + item = an array of rows');
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), f.dataSource.columns.map((c) => c.name).sort(), 'a report row = exactly its declared columns');
    for (const c of f.dataSource.columns) assert.equal(typeof row[c.name], c.type === 2 ? 'number' : 'string', `${c.name} typed`);
  }
});

test('gnimsys-chat-widgets: an item field is read as an object or an array where a key was read; a submitted row is re-read by its key', () => {
  assert.match(flat, /values are option `value`s, never labels — except a `submit: "item"` select, which carries its row\(s\)/);
  assert.match(flat, /A `submit: "item"` field reads differently: where a node read a key \(`…values\.<fieldId>`\), it now reads an object \(`…values\.<fieldId>\.VENDOR_NAME`, `null` unset\) or, multi, an array of objects in pick order \(`\[\]` unset\)/);
  assert.match(flat, /Changing a field to `"item"` changes every node that reads it/);
  assert.match(flat, /A submitted row is client data too: re-read the record by the row's key before a write/);
});

test('gnimsys-chat-widgets: the mistakes list names the report, table and item mistakes', () => {
  const mistakes = flat.slice(flat.indexOf('## Common mistakes'));
  assert.match(mistakes, /On a report: a `target` other than `"FA"`; `searchField` together with `searchParam`; `searchTemplate` without `searchParam`; a `valueField`, `labelField`, `searchField` or table field that is not a declared column; the `searchParam` also in `parameters`; no `searchParam` on a large list/);
  assert.match(mistakes, /A node still reading a key from a field switched to `submit: "item"`; writing from the submitted row's fields instead of re-reading the record by its key; several entities joined in the chat or through `expand` instead of one row per combination from the source/);
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
