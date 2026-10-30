---
name: gnimsys-chat-widgets
description: Use when a chat workflow talks to the user through OUR chat component (`xxx-gnimsys-ai-chat` — the user says so, never assumed) and a turn needs a selection or a decision — a select with inline options or a server-searched datasource (Business Objects API by default, Fusion REST on request), a radio or checkbox list, hidden turn state, Approve/Back/Cancel buttons — emitted as a `gnimsys-ui` block from a CODE node and read back from the `<gnimsysSubmit>` envelope on the next turn. Oracle chat surfaces get pills instead (widgets-and-forms).
---

# gnimsys chat widgets — selection and decision turns in our chat component

Contract authority: the published JSON Schema
`fusion-ai-chat/src/ts/jet-composites/xxx-gnimsys-ai/chat/schemas/gnimsys-ui-v1.schema.json`
(`$id` `https://gnimsys.com/schemas/ai-chat/gnimsys-ui-v1.json`; the component validates every block
against it and renders a violation as an error box with the raw block). This skill restates the
slice it covers; where they differ, the schema wins. Node format authority:
`skills/aistudio/references/prompts/workflow-node-prompts/code.md`, `return.md`, `switch.md`.

## The surface decides — never assume it

- The block renders ONLY in our component. The Studio test chat, Ask Oracle and an Agentic App
  panel print it as text. Emit it only when the user has said the workflow's chat surface is our
  component; an Agentic App gets `oraInfoDisplay` (**widgets-and-forms**), Oracle chat gets pills.
- The README's `## Callers & channels` names the component as the surface and says the block is
  plain text anywhere else; `## Known issues & limitations` says the Studio test chat shows it raw.
- A turn qualifies when its answer is one of N, several of N, or a decision (Approve / Reject /
  Back). A free-text answer stays a text question.

## The block (agent → chat)

A fenced ```` ```gnimsys-ui ```` block inside the reply text; markdown around it renders normally.
Several blocks per message are allowed and independent, but a turn whose answer IS the block
carries ONE block.

```
{ "v": 1, "kind": "form", "id": "destSubinv", "title": "Select the destination subinventory",
  "fields": [ … ], "buttons": [ … ] }
```

| Envelope key | Rule |
|---|---|
| `v` | integer `1` |
| `kind` | `form` — a choice is a `form` with one `radio` / `checkbox` field; no other kind in this slice |
| `id` | `[A-Za-z0-9_-]{1,64}`, unique in the message; echoed in the submit — name it after the step (`destSubinv`) |
| `title` | optional heading; also the second half of the readable line |
| `fields` | ordered, at least one |
| `buttons` | ordered, required, ≥ 1 — every button carries `data`; there is no default button |

Field keys: `id` (same charset, unique in the block, the key in the submit JSON), `type`,
`label` (not for `hidden`), `required` (default `false`), `value` (initial: scalar for single,
array for multi / `checkbox`, string for `hidden`), `help`.

| `type` | Options | Value |
|---|---|---|
| `select` | EXACTLY ONE of `options: [{ "value", "label" }]` (any length) or `dataSource` + `valueField` + `labelField` | scalar; `"multi": true` → array |
| `radio` | `options` inline only, optional `description` per option | scalar |
| `checkbox` | `options` inline only, optional `description` per option | array |
| `hidden` | — | string, echoed verbatim in the submit |

Buttons: `id` (same charset, unique in the block; only marks the clicked button), `label`, `data`
(REQUIRED, non-empty object of scalars/arrays, merged on top of the field values in the submit
JSON — how the workflow learns which button was clicked, e.g. `{ "decision": "APPROVE" }`; its
keys must not reuse a field id — on a clash the button wins; two buttons with equal `data` are
rejected by the chat), `variant` (`callToAction` \| `outlined` \| `borderless`; default first
`callToAction`, others `outlined`), `validate` (default `true`: `required` fields must be filled;
`false` submits whatever is there), `confirm` (text; the button asks `<confirm> — OK / Cancel`
inline first). EVERY button submits the same values plus its own `data` — there is no
non-submitting button.

## Choosing the field and its options

- `radio` / `checkbox` when the list is short enough to show whole and the options deserve a
  `description`; `select` when it is long or the user will look for an entry. One of N → `radio`
  or `select`; several of N → `checkbox` or `select` with `multi: true`. Item counts are not capped.
- Inline `options` only for FIXED short lists the workflow holds itself (`BO_FUNCTION` →
  `{value, label}` in a data node, an enumeration): the values are exact and the next turn
  re-validates the submit against the same source. Option `value`s are strings (a number comes
  back as a number).
- `dataSource` for anything large or searchable — items, serials, lots, suppliers (thousands):
  the chat serves it through a JET DataProvider with SERVER search and paging, with the USER's
  session. Only when the user confirms the page configuration allows it: config
  `datasources.allowInline` true AND a `url` starting with one of `datasources.allowPrefixes`;
  otherwise the field shows "datasource not allowed" and the block can leave only through a
  `validate: false` button. Never assume it is allowed. Business Objects API (BOSS) by default,
  Fusion REST only when the user asks for it — next section.
- `hidden` carries what the next turn needs and the user does not choose: ids picked earlier, the
  step name, a draft — strings; accumulated wizard state as ONE JSON string in one field.
  CONVERSATION variables stay the chat memory; the hidden field is the per-block carrier that
  survives the user re-reading an older block.
- `required: true` on the selection field; `value` preselects. Back / Cancel buttons carry
  `validate: false` (a `required` field then submits `null` / `[]`); a destructive or final
  button carries `confirm`.

## The datasource — Business Objects API by default, Fusion REST on request

The dashboard datasource shape: `{ "type": "rest", "target", "method": "GET", "url", "headers"?,
"body"?, "dataTransform"? }`, with `valueField` + `labelField` (+ optional `searchField` and
`searchTemplate { "minChars", "debounceMs" }`) on the field. `target` decides the query language
the chat speaks: `"BOSS"` = the Business Objects API, every other target = Fusion REST. Write a
BOSS datasource unless the user asks for Fusion REST.

The url carries only FIXED filters — never `{{query}}` or any other placeholder: the `RETURN` node
evaluates every `{{…}}` in its output, so a placeholder reaches the chat empty. The chat builds the
search clause itself from the typed text on `searchField` (else `labelField`) and ANDs it with the
url's fixed filter; empty text = the fixed filter only.

### BOSS — `"target": "BOSS"` (the default)

The `select` field (inside `fields`; the renderer stringifies the whole block):

```json
{ "id": "agent", "type": "select", "label": "Agent", "required": true,
  "dataSource": { "type": "rest", "target": "BOSS", "method": "GET",
    "url": "/api/boss/data/objects/ora/commonFusionAI/agents/v1/$en/workflows?$filter=status = 'PUBLISHED'&$fields=workflowCode,name" },
  "valueField": "workflowCode", "labelField": "name", "searchTemplate": { "minChars": 2 } }
```

- `url` = `/api/boss/data/objects/ora/<family>/<product>/v1/$en/<object>?…` — the object's
  collection.
- `$filter` = the fixed condition only (omit it when there is none). The chat ANDs
  `<searchField> ~LIKE '%<text>%'` to it and URL-encodes the whole `$filter`: write it unencoded.
- `$fields` lists at least the `valueField` and the `labelField`.
- `valueField` must identify ONE row without the url's fixed filter: the chat fetches the selected
  value's label by `$filter=(<valueField> = 'k1' or …)` on the url with its whole `$filter`
  removed — a unique code, never a name or a value unique only inside the filter.
- Never `$limit` or `$offset` (nor `q`, `limit`, `offset`) in the url — the chat writes `$limit`
  (the page size) and `$offset` and pages; it never asks for a row count.
- Omit `dataTransform`: the response is `{items, hasMore}`.
- The page's `datasources.allowPrefixes` must hold a BOSS prefix — `/api/boss/data/objects/ora/`
  or one family's `/api/boss/data/objects/ora/<family>/` — confirmed by the user like the rest of
  the config; none there → say so: the user adds it or asks for Fusion REST.
- Not yet proven on a pod, and it shapes what you write: a number key is sent unquoted (prefer a
  string code attribute as `valueField`); `~LIKE` is taken as case-insensitive (ask for a
  lower-case search in the user's first page test); whether the end user's Visual Builder session
  may read the object — the README's `## Known issues & limitations` lists it as open until that
  test.

### Finding the BOSS object and its attribute names

- Corpus: `fai_bo_search {q, resourcePath:'/api/boss/data/objects/'}` → Studio BOs whose functions
  call a BOSS object; `fai_bo_get {code}` → their resource paths
  (`…/objects/ora/<family>/<product>/v1/<object>`).
- Pod (when the user asked for the pod — **pod-operations**): `fai_cli`
  `list-supported-business-objects {query, family, product}` → `get-business-object-functions
  {objectCode}` (resource paths) → `get-bo-function-output-specification {objectCode,
  functionName}` on the object's GET collection function → its attribute names (from a saved
  response example, else the object's OpenAPI).
- An object no Studio BO wraps is out of every tool's reach, and no tool runs the datasource url
  itself: ask the user for the object path and the exact attribute names (value, label, searched
  attribute). Never derive them from the Fusion REST resource of the same data (another API, its
  own names), never invent them.
- A pod read runs as the developer's sign-in: it proves the object and the names, not the end
  user's access.

### Fusion REST — `"target": "FA"`, only when the user asks for it

- `"url": "/fscmRestApi/resources/…"`, e.g. `"url":
  "/fscmRestApi/resources/11.13.18.05/itemsV2?onlyData=true"` with `"searchField": "ItemNumber"`.
- `q` = the fixed condition only (omit it when there is none). The chat ANDs
  `UPPER(<searchField>) LIKE '%<TEXT>%'` to it — the typed text upper-cased, a case-insensitive
  contains.
- The chat sends `REST-Framework-Version: 4` itself — leave it out of `headers`. One written there
  must be `2` or higher: a lower value is refused and the field shows "datasource failed: … cannot
  carry the search filter". A BOSS datasource gets no framework header.
- Never a `limit` or `offset` in the url — the chat appends them and pages; it fetches the
  selected value's label itself by `<valueField> IN (…)`, so `valueField` must be a filterable key
  attribute of the resource. `$filter` / `$fields` are BOSS syntax, never on an FA url.
- Omit `dataTransform` for the Fusion REST shape (the body's `items` array, or the body when it is
  an array).

### Both targets

- `dataTransform` `"map"` = the dotted path to the row array, only for a body that is neither an
  array nor `{items}`. Never `"type": "lodash"`: the chat does not evaluate expressions and shows
  such a field as unavailable.
- The page's `widgets[widgetId].fields[fieldId]` overlay wins over the block's datasource.
  `dependsOn` (cascading selects) is not in this slice — a dependent list is the next turn's block.

## Emit it — a `CODE` renderer and a `RETURN` (no model)

```
… → CODE BUILD_<STEP>_DATA   semantic: options {value,label}, state to carry, the title
  → CODE RENDER_<STEP>_BLOCK  the text + the block (returnType string)
  → RETURN RETURN_<STEP>      returnValue {{$context.$nodes.RENDER_<STEP>_BLOCK.$output.result}}, outcomes {}
```

- Deterministic: the renderer reads only the data node, builds the object, `JSON.stringify`s it
  between the fences and returns the whole message text. No `LLM` emits or copies a block in this
  slice: a model mangles ids and option values. Text the model should write (an explanation) is
  produced upstream as data and placed above the block by the renderer.
- Renderer body (copy; function body only, plain JS, `returnType: "string"`):

````js
const data = $context.$nodes.BUILD_DEST_SUBINV_DATA.$output.result;
const block = {
  v: 1, kind: 'form', id: 'destSubinv', title: 'Select the destination subinventory',
  fields: [
    { id: 'subinv', type: 'select', label: 'Destination subinventory', required: true, options: data.options },
    { id: 'org', type: 'hidden', value: String(data.orgCode) }
  ],
  buttons: [
    { id: 'approve', label: 'Approve', data: { decision: 'APPROVE' }, confirm: 'Transfer to the selected subinventory?' },
    { id: 'back', label: 'Back', data: { decision: 'BACK' }, validate: false }
  ]
};
return data.intro + '\n\n```gnimsys-ui\n' + JSON.stringify(block) + '\n```';
````

- The JSON has no newlines (`JSON.stringify` without indentation) — the submit regex below relies
  on that; the fences sit on their own lines.

## Read it back — the submit envelope

One user message per click: `<button label> — <title>` (the label alone without a title), a
newline, then the envelope — arriving as `$context.$system.$inputMessage`:

```
Approve — Select the destination subinventory
<gnimsysSubmit id="destSubinv">{"subinv":"FGI","org":"M1","decision":"APPROVE"}</gnimsysSubmit>
```

- The envelope carries the widget `id` only. The JSON holds EVERY field by `id`, `hidden`
  included, then the clicked button's `data` merged on top; unset optional fields are `null`
  (single) or `[]` (multi / `checkbox`); values are option `value`s, never labels.
- Parser `CODE` node `PARSE_SUBMIT` (`returnType: "object"`), the first node after `START` on
  a chat workflow that emits blocks (copy):

```js
const text = String($context.$system.$inputMessage || '');
const m = text.match(/<gnimsysSubmit id="([^"]+)">(.*?)<\/gnimsysSubmit>/);
if (!m) return { submitted: false, id: '', values: {} };
return { submitted: true, id: m[1], values: JSON.parse(m[2]) };
```

  An envelope that does not parse is a defect: let `JSON.parse` throw (the node reports `error`),
  never swallow it.
- Route: `CONDITION IS_SUBMIT` `{{$context.$nodes.PARSE_SUBMIT.$output.result.submitted === true}}`
  (`false` = an ordinary chat message); then `SWITCH ROUTE_DECISION` with `caseExpression`
  `{{$context.$nodes.PARSE_SUBMIT.$output.result.values.decision}}` and one outcome per button
  `data` value (`APPROVE`, `BACK`); `SWITCH` has no default, so every button's value is a case.
  Give all buttons of a block the same `data` key (`decision`) with distinct values. Several
  blocks sharing one parser: the parser returns `route = id + ':' + values.decision` and the
  cases are `destSubinv:APPROVE`, `destSubinv:BACK`, … The `id` says which step answered, the
  button's `data` what to do.
- The readable line is for the transcript: an `LLM` with `chatHistoryEnabled` sees the choice as
  the user's turn; nothing parses it.
- The submit is untrusted input: re-validate the chosen value against the source list (the data
  the workflow fetched, or a BO lookup by the submitted id — mandatory after a `dataSource`, whose
  rows the workflow never saw) before any write; a value outside the list re-emits the block with
  an explanation above it. `hidden` values come back as sent, but as text from the client — parse
  and check them the same way.
- After a click the block turns read-only in the chat (one submit per rendered block): a corrected
  choice is a NEW block in a new turn, never "edit your answer".

## Oracle's follow-up chips

The workflow's follow-up questions (`followupEnabledFlag`, `fai_workflow_followup {op:'set',
enabled:false}`) are unrelated to the block and render beside it. When the block is the expected
answer, disabling them is the recommendation — stated, not enforced; a chip click arrives as a
plain message and takes the `IS_SUBMIT` false path.

## Worked example — "select the destination subinventory"

An inventory transaction wizard, chat surface = our component. The organization was chosen a turn
earlier; the destination subinventory has 24 candidates fetched by `BO_FUNCTION`, mapped by
`BUILD_DEST_SUBINV_DATA` to `{options, orgCode, intro}`. The renderer above returns (three of the
24 options shown):

````
Organization `M1` — choose where the items go.

```gnimsys-ui
{"v":1,"kind":"form","id":"destSubinv","title":"Select the destination subinventory","fields":[{"id":"subinv","type":"select","label":"Destination subinventory","required":true,"options":[{"value":"FGI","label":"FGI — Finished goods"},{"value":"RAW","label":"RAW — Raw materials"},{"value":"STG","label":"STG — Staging"}]},{"id":"org","type":"hidden","value":"M1"}],"buttons":[{"id":"approve","label":"Approve","data":{"decision":"APPROVE"},"confirm":"Transfer to the selected subinventory?"},{"id":"back","label":"Back","data":{"decision":"BACK"},"validate":false}]}
```
````

The user picks `FGI` and clicks Approve; the workflow's next turn receives:

```
Approve — Select the destination subinventory
<gnimsysSubmit id="destSubinv">{"subinv":"FGI","org":"M1","decision":"APPROVE"}</gnimsysSubmit>
```

`PARSE_SUBMIT` → `{submitted:true, id:'destSubinv', values:{subinv:'FGI', org:'M1', decision:'APPROVE'}}`
→ `IS_SUBMIT` true → `ROUTE_DECISION` case `APPROVE` → re-validate `FGI` against the
organization's subinventories → the transfer. Back returns
`{"subinv":null,"org":"M1","decision":"BACK"}` → case `BACK` → the previous step's block.

## Common mistakes

- Emitting the block without the user having named our component as the surface; "fixing" a
  workflow because the Studio test chat shows the fence as text.
- A model generating, copying or "formatting" the block; option values invented or labels sent as
  values; the JSON pretty-printed (newlines break the single-line regex).
- Both `options` and `dataSource` on one `select`, or neither; a `dataSource` without the user
  confirming `datasources.allowInline` and the prefix; inline `options` for a large set; `radio`
  with `multi`.
- `{{query}}` or any other placeholder in a datasource url — the chat builds the search clause.
- A Fusion REST (`"target": "FA"`) datasource the user did not ask for. On a BOSS url: `q`,
  `limit`, `offset`, `$limit` or `$offset`; `$fields` without the `valueField` or the
  `labelField`; a `valueField` unique only inside the url's fixed filter; an object path or
  attribute name that no tool found and the user did not give. On an FA url: `$filter` or
  `$fields`; a `limit` or `offset`.
- A block without `buttons`; a button without `data`, two buttons with the same `data`, a `data`
  key equal to a field id; a
  `SWITCH` missing a button's `data` value as a case; routing on the readable line or the button
  `id`; a Back button without `validate: false`; acting on the submitted value without
  re-validating it.
- Turn state only in memory the next call cannot see; wizard state spread over many `hidden`
  fields instead of one JSON string.
- Several blocks in a turn whose answer is one of them; re-emitting the same `id` for a
  different step.
