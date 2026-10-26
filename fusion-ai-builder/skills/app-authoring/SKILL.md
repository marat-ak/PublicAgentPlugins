---
name: app-authoring
description: Use when the user wants an Agentic App (.app), an app panel/agent/action/communication/template, or a workflow that must power an app (InitDisplay, Query, Summary, InitActions, InvokeAction, app-compatible, Agentic App) — including converting an existing chat workflow into an app-backed one.
---

# App authoring

Format authority: `skills/aistudio/references/prompts/app-ingestion.md` (intake — mandatory),
`app-best-practices.md` (do / do-not list), `app-vibe-master.md` (config model, actions,
communications, templates, swimlanes, and §Backing workflow contract — the authority for
everything below except one rule), `app-vibe-widgets.md` (widget schemas), `app-vibe-actions.md`,
`app-vibe-templates.md` — all under `skills/aistudio/references/prompts/`. Pattern authority:
`fai_examples_search {archetype:'app-router'}`, `fai_examples_search {kind:'app'}` and the shipped
contract below; widgets and forms: **widgets-and-forms**. The one override: a stage whose output
is widgets ends in the `llmGUI` dual path (**widgets-and-forms** §Dual path), not in Oracle's
terminal-`LLM`-only shape.

## Intake — the checkpoint is not optional

Oracle's rule: no `.app`, no backing workflow, no prompt, no test is created until the user has
confirmed the structured pre-build checkpoint IN A FOLLOW-UP reply. A detailed first request
pre-fills it; it does not confirm it. Present the checkpoint with the headings from
`app-ingestion.md` (Data source · App goal and user · First-load experience · Query behavior ·
Priority actions · Communications · Side effects · Launch context · Validation) and ask "changes,
or continue with this scope?" via `AskUserQuestion`.

- Data source first: business-record apps need a confirmed BO/tool/workflow producer. Search
  (`fai_bo_search`, broaden terms) before asking; present candidates in terms of the requested
  functionality; never pick silently. Context/attachments/user prompt are not data sources.
- `InitDisplay` is required first-load behavior backed by retrieved data; a prompt-only startup
  panel is fabrication. If unclear, ask what it should retrieve.
- Actions/communications: search for supportable options before recommending "omit for now";
  build their stage paths only after the user confirms scope.
- Never ask the user for internal ids, action codes, panel names, node ids.

## The runtime model (why an app-backed workflow differs)

- **An Agentic App never resumes a paused workflow.** Every panel load, query, click and form
  submit is a NEW workflow call carrying a message hint; the workflow routes on it and returns for
  that hint only. Hence `aiAppsCompatibleFlag: true`, `humanApprovalFlag: false` and no `HUMAN`
  nodes — no app-compatible shipped workflow has one.
- State lives in what the app re-sends on every call (page inputs, `$OraAppContext`), in the form
  or the action payload, or is re-derived — never in a paused node (**widgets-and-forms** §Carrying state).

## Request contract: `$context.$app.*`

| `$OraMessageHint` | When | Return |
|---|---|---|
| `InitDisplay` | panel first load / refresh | one or more `oraInfoDisplay` blocks |
| `Query` | user typed in the ask box | answer (text or widgets) |
| `InvokeAction` | user clicked an action / submitted a form | read `$OraAction`, do the work, return widgets/text |
| `Summary` | app header summary | one sentence, no widgets |
| `InitActions` | priority-actions lane | `oraInsight` items |
| `InitCommunications` | communications lane | `oraComms` items (only when dynamic comms are wanted) |
| `FillParameters` / `SendCommunication` | template-backed communications | raw `<parameter id="…">value</parameter>` elements / send behavior |
| `InvokeCapability` | autonomous capability call | `$OraAction` = the capability name, `$OraActionPayload` = its input |
| `InitSampleQueries` | dynamic starter queries | strict JSON keyed by category id `{displayName, samples[]}` |
| `initSubtitle`, `additionalContent`, `InitContextSuggestions` / `QueryContextSuggestions` | subtitle, expanded panel (`$OraPanelName`), context switcher (`messageListWidget` items calling `ora.App.setContext`) | seen in shipped content |

Other request variables: `$OraAction` (the clicked payload — a simple code string or the object
passed to `ora.Invoke`), `$OraActionPayload`, `$OraAppContext`, `$OraUserContext`,
`$OraAppDisplayDiscriminator` (which panel is asking when one workflow powers several),
`$OraPanelName`, `$OraAttachments`. Full list: `workflow-vibe.md` §`$app`. Hint casing varies in
shipped content (`InitDisplay`/`initDisplay`, `InvokeAction`/`invokeAction`) — normalize before
switching.

## Backing workflow contract

- Required stages: `InitDisplay`, `Query`, `Summary`, `InitActions` when actions are in scope;
  `InitCommunications` only for dynamic `oraComms`; `FillParameters` for template-backed
  communication autofill; `SendCommunication` when a `targetAgent` sends; `InvokeCapability` /
  `InitSampleQueries` when the app config references them. `InvokeAction` handles clicks (parse
  `$context.$app.$OraAction` in a `CODE` node).
- Router (the shipped shape; widget stages as our dual path):

  ```
  START → SET_FIELDS SET_WORKFLOW_SETTINGS (llmGUI) → session/context nodes (shared)
        → CODE RESOLVE_APP_HINT → SWITCH ROUTE_APP_HINT
     InitDisplay  → CODE data → CONDITION llmGUI → false: CODE render → RETURN
                                                → true:  LLM (widget-licensed) → END
     Summary      → LLM (one sentence) → END
     InvokeAction → CODE parse $OraAction → CONDITION/SWITCH by form id or command → …
                    → next form/view: its own dual path · confirmation: text
     Query (and the catch-all) → the conversational chain → terminal LLM (text) or a dual path (widgets)
  ```

- Shared fetch/guard nodes run once BEFORE the switch; never clone fetch chains per stage. Each
  stage ends in its own dedicated terminal(s): a widget stage in its dual path (renderer → `RETURN`
  by default, `LLM` when `llmGUI` is true — **widgets-and-forms** §Dual path), a text stage in its
  `LLM`/`AGENT`. Never one terminal that branches on the hint inside its prompt, never two hints
  into one terminal; `convergenceTargetId` = `end`.
- **Resolve the hint in a `CODE` node with try/catch** — `$context.$app` does not exist in the
  Studio test chat and reading it directly throws:

  ```js
  let hint = null;
  try { hint = $context && $context.$app ? $context.$app.$OraMessageHint : null; } catch (e) { hint = null; }
  hint = String(hint || '').trim();
  const norm = hint.toLowerCase();
  if (norm === 'initdisplay') return 'InitDisplay';
  if (norm === 'invokeaction') return 'InvokeAction';
  if (norm === 'summary') return 'Summary';
  return 'Query';
  ```

  then `SWITCH.caseExpression = {{$context.$nodes.RESOLVE_APP_HINT.$output.result}}`.
- Catch-all: Oracle's `SWITCH` has no built-in default, so the resolver returns an explicit case
  (`Query`) for everything unknown and the test chat (no hint) takes the conversational path.
  Shipped routers additionally point `outcomes.success` at the same target; Oracle's reference
  does not document that key on `SWITCH` — keep the explicit case as the real route and let
  `fai_validate` judge the extra key.
- The `llmGUI`-path `LLM` of a widget stage carries `aiAppOutputSpecification.dataDisplay.layouts`
  (+ `enableActions` for `oraInsight`, `enableCommunications` for `oraComms`) via
  `do-create-node {aiAppOutputSpecification}`, changed later with a `fai_wf_field_edit` `aiApp`
  merge — see **widgets-and-forms**; the default-path `RETURN` needs none; a node that stops
  rendering loses its layouts.
- Do not paste raw `$OraAppContext`/`$OraUserContext` into prompts; extract the fields needed.

## Converting a chat workflow

| Chat pattern | App-compatible replacement |
|---|---|
| `HUMAN` "do you want to proceed?" + `IF_APPROVED` | the form itself (`recordWidget`, `submitText`) — the submit IS the approval |
| `HUMAN` "confirm category" loop | one `select` per line in the form, the LLM-suggested value preselected |
| `HUMAN` "send error email?" + `EMAIL` | end with the failure message (no side-effect prompt) |
| summarize-then-ask | render the summary as a table widget alongside the form |
| `$feedbackRecieved` parsing | `CODE` parsing `<oraFormSubmit>` on the `InvokeAction` path |

- Attachments: the submit turn re-reads uploaded files with the file-processor `TOOL` using
  `{{$context.$workflow.$conversationId}}` — the conversation persists across calls even though
  the workflow does not.
- Identity: the same `workflowCode` as the original → Import updates the original DRAFT in place;
  to keep both, use a new code. `fai_validate` must pass (it is stricter than the pod —
  bare-data-path conditions fail here).

## Testing without an app

The Studio test chat sends no hint: the resolver's default case runs and widgets print as raw XML.
Run a stage the way the app calls it instead: a Studio run profile (`specification.dtRunProfiles`,
`type: "agentic-app"`, `agenticAppMode` `initDisplay` / `query` / `invokeAction` / `summary` /
`initActions`, `invokeActionPayload`) or `fai_workflow_run {triggerType:'app',
parameters:{appHint:'<Stage>', OraAppContext, OraUserContext}, message}` — for `InvokeAction` the
message is the action payload or the `<oraFormSubmit …>` block (**run-and-debug**); check on the
run's node inputs how the parameters reached `$context.$app.*`. Shipped profiles hold realistic
payloads: `fai_example_get {view:'full', select:'json.specification.dtRunProfiles'}`. Do not build
test-chat shortcuts (a typed keyword routed to `InvokeAction`, CONVERSATION variables standing in
for form state): app-trigger runs exercise the real path, and shipped form state never lives in
CONVERSATION variables.

## App artifact (`.app`) — CLI surface

`fai_cli {ws, command:'do-create-app', args:{…}}` then `do-add-agent` (an app agent is an
EXISTING workflow: confirm the code exists in the workspace tree or corpus; several plausible →
ask), `do-add-action` (initial `onInvokeSteps` array), `do-add-template` + `do-add-communication`
(every app-config communication needs a `templateId` and `applicableAgent` codes),
`do-modify-app-config` for role fields, then `validate-app {file}` once, then `fai_validate`.
Serial mutations; the returned app state is the truth.

- `pageConfig` references agents by app-local key; `queryAgent` / `summary.agentCode` /
  `subtitleAgentCode` by workflow code — leave those role fields UNSET unless the user asks.
- The panel's agent = its backing workflow; `agents[key].displayWidgetList` (or a container's
  `initDisplayWidgetListOverride`) = exactly the widget ids that workflow emits (e.g.
  `["ORA_LAYOUT_MULTIRECORD","ORA_LAYOUT_RECORD","ORA_LAYOUT_CARD"]`) and that the `displayPrompt`
  uses; a `displayPrompt` is instructions to emit widgets, never a pre-filled widget — for a
  workflow that renders its own: "Preserve workflow-returned oraInfoDisplay blocks exactly. Do not
  summarize or restructure them." `enableFileUpload: true` when uploads are part of the flow (Oracle's
  limit: 5 files per conversation, 50 MB combined; the picker's default types are office documents,
  text, csv, markdown, html, json, xml, zip and images).
- Templates (`app-vibe-templates.md`): `type` `ppt | docx | pdf | email | text | podcast`; shipped
  apps use `email` most, then `pdf` and `ppt`. `podcast` is text-to-speech OUTPUT: each section has
  a host (`hostId` → `podcastHosts[{id, name, voice}]`), data instructions and optional voice
  instructions (style, tone, pacing); at runtime the applicable agent writes each section's script.
  The CLI's voice catalogue: `alloy_neutral_balanced` (default), `echo_male_clear`,
  `fable_male_storyteller`, `onyx_male_deep`, `nova_female_bright`, `shimmer_female_soft`. No corpus
  example — whether `voice` stores that id or the bare voice name, and which part field holds the
  voice instructions, is unverified.
- Action step types: `agentCommand {sendPayloadAsContext, doNotAutoRefresh, command}`,
  `refreshAgents {agentCodes[], panelTargets[], refreshSummary, refreshPriorityActions}`,
  `switchAppContext {usePayloadAsContext, refreshApp}`, `navigateToAgenticApp {appCode,
  passPayloadAsContext}`, `preserveAction`, `editArtifact`, `showMedia`. Typical chains: row
  "Edit" → `switchAppContext` then `refreshAgents`; "Edit line" → `agentCommand` and the agent
  answers with an editable `recordWidget`; "Save" → `agentCommand` + `switchAppContext`.
- `ora.Invoke("code", payload)` in a widget needs an action with that `code` (its
  `events.onInvoke[]` decide what happens); `agentCommand` with `sendPayloadAsContext:true` means
  the payload must carry the instruction and the ids. A form submit needs no action — the runtime
  posts it.
- Delivery: `fai_export {ws, kind:'app', code, version}` (JSON with `specification` stringified)
  plus a separate workflow export for each backing workflow — a download link for each file.

## README in `internalDescription`

An app's `internalDescription` is its README, with the sections and rules of skill
**workflow-authoring** §README (Purpose · Callers & channels · Flow · Inputs & state · Known
issues & limitations · Changelog) written for the APP: its panels and what each shows, its
actions and communications, the launch context it expects, which backing workflow powers what,
and the app's own limits. Each backing workflow keeps its own README in its `description`; do
not duplicate one into the other.

- `do-create-app {description}` writes the first draft into `internalDescription`. No CLI command
  changes it afterwards (`do-modify-app-config` has no such key): update it with
  `fai_wf_field_edit {file:'src/apps/<code>.app', field:'internalDescription', edits}` (the changed
  lines only; edited in place) — it answers with the `fai_validate` verdict.
- The export version stamp lands only on a `description` field, never on `internalDescription`:
  the app README's `## Changelog` carries the `v<n>` itself.
- Keep it current on every material app change and before every export or DRAFT save, under
  the same length rule as the workflow README (write in full; shorten Changelog, then Flow, on a
  server rejection, and report the exact error text).

## Common mistakes

- Building in the same turn as the checkpoint.
- One `START → LLM → END` app workflow that "handles all hints in the prompt".
- A `SWITCH` with no path for the Studio test chat (hint absent) — validation may pass, runtime
  falls through.
- Setting `queryAgent`/summary roles "to be safe".
- A widget stage built any other way than the dual path — above all an `LLM` fed pre-built
  `oraInfoDisplay` XML to echo (**widgets-and-forms** §Dual path).
