---
name: workflow-authoring
description: Use when creating or modifying any Studio workflow (.wf) — adding, editing, wiring or deleting nodes, writing prompts or expressions, choosing node types, guarding data dependencies, or fixing control-flow/schema errors — whether the workflow is standalone or backs an app.
---

# Workflow authoring

Format authority: `skills/aistudio/references/prompts/workflow-vibe.md` (read it once per
conversation before the first mutation) and the per-node contracts in
`skills/aistudio/references/prompts/workflow-node-prompts/` (read the file for every node type
you touch; `index.md` lists them). CLI parity: `skills/aistudio/references/prompts/workflow-cli-compat.md`.
Pattern authority: `fai_examples_search` plus the shipped patterns below (Oracle stays the format
authority where they differ).

## Before the first mutation

1. Standalone or app-backed? (instructions.md quotes Oracle's boundary.) App-backed → also invoke
   **app-authoring**; the router and the dedicated stage terminals are part of the build.
2. Family/product: `fai_cli {ws, command:'list-workflow-families'}` then
   `list-workflow-products` with `{family}`; exact match only, else `AskUserQuestion`.
3. Find the closest shipped shape: `fai_examples_search {archetype, nodeType, q}` →
   `fai_example_get {kind:'workflow', code, view:'graph'}` → `view:'node:<CODE>'` for the nodes
   you will imitate. Imitate structure and prompts; never copy an `ORA_` code.
4. Data source: any workflow that displays, ranks, summarizes or acts on records needs a real
   producer node (`BO_FUNCTION`, `TOOL`, `EXTERNAL_REST`, `RAG_DOCUMENT_TOOL`, `VECTOR_DB_READER`,
   `WORKFLOW`). Confirm the BO with the user (**business-objects-and-tools**) before building
   prompts that assume its fields.

## The build loop (one implementation pass, no partial states)

`do-create-workflow {name, family, product, workflowCode?}` → for each node
`do-create-node {file, type, name, code?, metadataPatch?, inputsPatch?, outputSpecification?,
aiAppOutputSpecification?}` → `do-modify-node` for bindings → `do-modify-node-edges` for wiring →
`do-delete-node` for removals → ONE `do-prettify-workflow {file}` → `fai_validate {ws, path}`.

- Producer for a consumer? Insert it upstream in the same pass. "Would you like me to connect
  it?" is a violation — wire it.
- `inputsPatch.<name>` values are the raw final value (string / expression), never
  `{type, value}` wrappers or full input entries. Prompts, `condition`, `caseExpression`,
  `message`, `returnValue` are INPUTS; `chatHistoryEnabled`, `modelConfiguration`,
  `businessObjectCode`, `functionName`, `sourceCode`, `returnType` are METADATA.
- Serial mutations per file; re-read with `get-nodes-metadata-by-code {file, nodeCodes:[…]}`
  (never from memory) before editing an existing node — modify, do not rewrite. A BO node's
  stringified `outputSpecification` makes that answer large: `select` the fields you need.
- Changing part of an existing field — a line of `sourceCode`, a sentence of a prompt, one key of
  `aiAppOutputSpecification` / `modelConfiguration` / an AGENT `specification` / `chatChannelInput`
  — is `fai_wf_field_edit {file, node, field, edits | merge}`, never a resend of the whole value
  (`do-modify-node` replaces objects whole and refuses a partial one). A value patch keeps the
  input's declared type; a type change or an input removal is `fai_workflow_node_struct`.
- `do-create-node` writes no `convergenceTargetId`: set it on every `CONDITION` / `SWITCH` /
  `PARALLEL` with `fai_workflow_node_struct {op:'set-convergence', node, target}` (target = the
  code of the node where the branches rejoin, in the same scope, or `end`).
- `get-workflow-node-structure {file}` reconstructs the true execution path when you inherit a
  workflow; explain workflows semantically, not edge by edge.

## README in `description` — the workflow documents itself

The workflow's top-level `description` IS its README. A later conversation that fetches the
workflow from a pod learns its purpose and its known issues from there — the nodes only show
what the code does. It travels with the file (export, DRAFT save, Studio), so it is the one place
documentation survives.

- Write it as plain text with markdown-style headings (Studio shows it as plain text), the
  sections in this fixed order, each present even when short:
  `## Purpose` (the business outcome, for whom) · `## Callers & channels` (who calls it and how:
  Agentic App panel + hints, Teams/chat, REST trigger — what message and parameters each sends) ·
  `## Flow` (the path in business terms: main branches, what each terminal returns) ·
  `## Inputs & state` (trigger inputs, `$inputContext` keys, conversation-scope variables and
  what they carry across turns — multi-turn = the same `conversationId`) ·
  `## Known issues & limitations` (what does not work yet, assumptions, data gaps, accepted
  validator warnings, pod facts such as "unpublished → the chat endpoint answers `FAI-40300`") ·
  `## Changelog` (one line per `v<n>`, newest first: what changed and why). Do not end it with a
  `Version <n>.` sentence — the export stamp appends that itself.
- The first draft goes in with `do-create-workflow {description}` (or `do-modify-workflow-metadata
  {file, description}` right after it). Update it on EVERY material edit (a node added, removed or
  re-routed, an input or BO changed, a prompt contract changed, a limitation found or fixed) and on
  every version bump — BEFORE `fai_export` or `fai_pod_save` — with `fai_wf_field_edit {file,
  field:'description', edits}` (the changed lines only: a Changelog line, a Known issue, a Flow
  step). The README in the file is what the user gets; an outdated one is a defect, report it in
  **Validation**.
- Per-node `description` (`metadataPatch.description`) = the WHY of that node in one or two
  sentences; it is not repeated in the README, and the README does not list nodes one by one.
- Length: no documented limit (the CLI and Oracle's references give none; Oracle's samples are a
  sentence). Write the README in full. If `fai_pod_save` (or a Studio import) rejects the
  description for its length, shorten `## Changelog` first, then `## Flow`, keep `## Purpose` and
  `## Known issues & limitations` intact, and REPORT the exact server error text to the user
  verbatim so the limit can be pinned here later. Never guess a number.
- Apps: the same README goes in the app's `internalDescription` when the app has its own purpose
  and limits (panels, actions, launch context, which backing workflow does what) — skill
  **app-authoring** §README.

## Expressions and schemas (the rules the validator enforces)

- `{{…}}` with NO inner spaces; no `{{#if}}`/`{{#each}}`/block tags ever; optional content =
  `CONDITION` branch or a `CODE` node producing a safe-to-inject string.
- Only documented paths: `$context.$nodes.<CODE>.$output…`, `$context.$variables…`,
  `$context.$triggers.REST.$input.<name>` (other trigger types: the fixed paths in
  `workflow-vibe.md` §Workflow Trigger Inputs; `SCHEDULE` exposes none), `$context.$system.$inputMessage` (+ the built-in list
  in `workflow-vibe.md` §Built-in `$context` expressions), `$context.$app.*` only when app-backed.
  `$context.$system.$chatHistory` / `$conversationHistory` are NOT allowed — set
  `metadataPatch.chatHistoryEnabled = true` instead (many shipped workflows read it directly; do not copy that).
- `CODE` bodies are plain JS with `return`; output lives under
  `$context.$nodes.<CODE>.$output.result` (fixed wrapper `result|timeout|error`, persisted on the node); `LLM`/`AGENT`/`BO_FUNCTION`/`EXTERNAL_REST`
  are editable-schema producers — every field a downstream node references must be declared in the
  producer's `outputSpecification` (JSON Schema draft-04), and the prompt must actually instruct the
  model to return it. An `LLM` without one returns text a downstream `CODE` parses.
- A reference does not execute a node: `B` referencing `A` requires `A` to be an ancestor of `B`.
  Enumerate referenced codes after every rewire and confirm each is upstream.
- No `jsonStringify(...)` around injected outputs.

## Node choice, quick reference

| Need | Node | Non-derivable facts |
|---|---|---|
| Judgment, text, structured extraction | `LLM` | `prompt` = instructions to the model, never the final user message; ground it with `{{$context.$nodes…}}` data; `DATA:/TASK:/OUTPUT:` structure |
| Tool-using reasoning | `AGENT` | `metadata.type = PRIVATE`, `maxInteractions` 1–20 under `metadata.specification`, `toolCodes` non-empty top-level; no tools → use `LLM` |
| Deterministic shaping | `CODE` | function BODY only, no wrappers/imports/`Intl`; bind inputs from `$context…` explicitly; `returnType` matches the return |
| Yes/no branch | `CONDITION` | outcomes `true`+`false` to DISTINCT nodes, top-level `convergenceTargetId`; existence checks as `{{!!…?.[0]?.Id}}` — a bare data path is not a boolean |
| Enum routing | `SWITCH` | `caseExpression` input; outcome keys = case values; no built-in default; `convergenceTargetId` |
| Exact terminal payload | `RETURN` | `returnValue` input, `outcomes: {}`; not needed just to finish — route `success` to `END`; the default terminal of an app widget stage (**widgets-and-forms** §Dual path) |
| Fusion data | `BO_FUNCTION` | see **business-objects-and-tools** |
| Policy lookup, fuzzy matching (category, UOM) | `RAG_DOCUMENT_TOOL` / `VECTOR_DB_READER` | inputs `question` / `indexName`, `query`, `maximumResults`, `filterCriteria` |
| Loop state | `WHILE`/`LOOP` | evolving state in `dataPipeline.variables` + `SET_FIELDS` before and inside the loop; current item at `$context.$nodes.<LOOP>.$currentItem` |
| In-chat approval / free text | `HUMAN` | chat-only; INCOMPATIBLE with app-backed workflows (**app-authoring**); see Chat input below |
| Delay / bounded poll | `WAIT` | timer fields are metadata (`wait.md`); its only shipped use (one workflow) waits 2 minutes for a vector index refresh and loops back once (`loopBackNodeId`, `maxIterations`); a run pauses on it (**run-and-debug**) |

## Shipped structure (every workflow in the corpus)

- `architecture: "data_pipeline"` and ONE trigger of `type: "REST"`; chat arrives through that
  same trigger plus `$context.$system.*`. Studio also offers EMAIL (one registered inbound
  Microsoft/Google mailbox per workflow, polled), SCHEDULE (interval or recurrence; the user needs
  `ORA_DR_FAI_BATCH_JOB_MANAGER_DUTY`), signal (`EVENTS`) and `CAPABILITY` triggers; shipped content
  uses none (`deletedTriggerTypes` is always `[]`). They are set in the workflow's Settings →
  Triggers in Studio and fire only once the workflow is PUBLISHED. No CLI command creates one
  (`workflow-vibe.md` §Signal subscriptions names Studio UI tools the CLI does not have) and
  `fai_workflow_triggers` edits REST inputs only — never hand-write a trigger entry; the README names
  the trigger setup as the user's step.
- Top-level `emailConfigCode` / `jobRequestId` are server-owned (always `null` in shipped content;
  no command sets them; probably the inbound mailbox and the schedule job — unverified): preserve
  them, never invent a value.
- Trigger inputs are `{id, name, type, scope?}` with `type` `string` (dominant), `boolean`,
  `integer`, `number` or `object` (+ `typeSpecification`). `scope: "JOB"` marks what the calling
  page supplies (ids, language, UI context); unscoped inputs are per-message payload
  (`userMessage`, record ids, `isReplyFlow`). Read them as `{{$context.$triggers.REST.$input.<name>}}`;
  declare, change or remove them with `fai_workflow_triggers` (no CLI command edits them).
- `errorHandlers: [{type: "EMAIL", inputs: toList/ccList/subject/body}]` is present (usually
  blank); `humanApprovalFlag: true` only when `HUMAN` nodes exist; `aiAppsCompatibleFlag: true`
  only on app-backed workflows.
- Node `code` = UPPER_SNAKE of the display name; node ids are epoch-millis strings; input ids
  `"<nodeId>_<n>"`. Identity on export is the `*Code`; ids are null.

## Archetypes (`fai_examples_search {archetype}`)

| Archetype | Shape | Typical size | Signature |
|---|---|---|---|
| `generator` | `START → LLM (→ SWITCH/LLM) → END`; all input via REST trigger inputs; no memory | 3–8 nodes | no `BO_FUNCTION`; sentinel outputs ("Enter a different goal") for unsafe input |
| `pipeline` | deep `WORKFLOW` call graphs, heavy `BO_FUNCTION`/`CODE`, `RETURN` early exits, `PARALLEL` fan-out | tens of nodes per child, many children | questions to the user are TEXT output; on the next turn an `LLM` over `$system.$inputMessage` + chat history detects the reply, and turn state lives in CONVERSATION variables (guards, resets); a parent passes flags such as `isReplyFlow` to a child as `WORKFLOW` inputs |
| `conversational` | `HUMAN` and/or `AGENT` nodes collect input mid-run; guard-then-prompt loops | 30–150 nodes | `CONDITION "feedback exists?" → HUMAN → SET_FIELDS/CODE → loop back`, `maxIterations` |
| `app-router` | `START → session/context → CODE resolve hint → SWITCH on hint → stage terminals` | varies | `aiAppsCompatibleFlag`, no `HUMAN`; contract in **app-authoring** |

Node frequency in shipped content, most to least: `CODE`, `BO_FUNCTION`, `CONDITION`,
`SET_FIELDS`, `LLM`, `WORKFLOW`, `ADD`, `AGENT`, `PARALLEL`, `RETURN`, `HUMAN`, `SWITCH`, `LOOP`,
then rarely `RAG_DOCUMENT_TOOL`, `VECTOR_DB_READER`, `TOOL`, `WHILE`, `EMAIL`. Design accordingly:
`CODE` shapes, `LLM` judges, `CONDITION` guards.

## Recurring patterns worth copying

- **Variables as the state bag**: declare `dataPipeline.variables[]` up front
  (`fai_workflow_variables`), write them with `SET_FIELDS`. The first node copies
  `$system.$inputContext` → `$variables.UserContext` and `$system.$inputMessage` →
  `$variables.userInputMessage`; everything downstream reads variables. The DECLARATION's `scope`
  governs (`JOB` = this run, Studio's "User Question"; `CONVERSATION` = every turn of one
  `conversationId`); the per-entry
  `scope` some shipped `SET_FIELDS` inputs carry is noise (Oracle: scope belongs to the declaration).
- **CONVERSATION variables = cross-turn memory of chat and `Query` turns**: a first-turn guard
  (`{{!$context.$variables.<name>}}` → fetch + `SET_FIELDS`, else reuse) for caches, drafts and
  accumulated history, and an explicit reset of what must not carry over. Never for app
  display→submit state (**widgets-and-forms** §Carrying state). Unverified until a live run shows
  it: persistence across Agentic App turns, sharing with a child `WORKFLOW` (shipped parents pass
  state to children as `WORKFLOW` inputs), size limits.
- **CODE shapes, LLMs get prebuilt prompt strings** (`EXTRACT_*_PROMPT` / `GET_*_PROMPT` pairs).
  About half of shipped `LLM` nodes return structured output via `outputSpecification`; the rest
  are parsed by a `CODE` `JSON.parse`.
- **Model tiers**: a cheap/basic model for generators (low temperature, a few-thousand-token cap),
  a premium reasoning model for agents, set through `metadata.modelConfiguration` (`code`,
  `provider`, `model`, `modelProperties`) — copy a shipped block, never invent a code.
- **Channel awareness**: read a channel marker from context (`ORA_SMS`/`ORA_WHATSAPP`), append
  "plain text only" to the system message and route to `_TEXT` agent variants without markup.
- **Scheduled batch** (`ORA_ACCOUNT_INTELLIGENCE_SCHEDULER_AGENT`, `ORA_MEETING_PREPARATION_SCHEDULER`,
  `ORA_OPPORTUNITY_SUMMARIZATION_SCHEDULER_AGENT_TEAM`): still REST-triggered, with an `action` /
  `config` object input (mode `FULL`/`INCREMENTAL`, batch size, limits, a look-ahead in days); the
  workflow selects its own work set through a BO, chunks it in `CODE` and runs a `LOOP`/`WHILE` over
  the worker. The timing comes from a Studio SCHEDULE trigger or an outside caller; nothing in the
  workflow reads a schedule, and a SCHEDULE run carries no inputs — a batch it starts cannot depend
  on REST inputs for its work set.
- **Runtime prompt store** (Expenses only: `ORA_FIN_EXPENSES_GETAGENTINITPARAMS.getAgentInitParams`
  keyed by `{{$context.$workflow.$name}}`): `BO_FUNCTION` → `CODE`
  `prompts.find(p => p.promptType === 'MAIN')?.prompt || <default kept in the CODE>` → `LLM`, so the
  prompt text changes server-side without a new version. No generic store exists — use the pattern
  only where the product exposes such an API.

## Chat input (standalone workflows)

| Mechanism | Read as | Notes |
|---|---|---|
| Current message | `$context.$system.$inputMessage` | primary chat input |
| Page/UI context | `$context.$system.$inputContext.<key>` | the hosting page passes ids, BU, feature flags |
| Trigger vs chat | `$context.$system.$triggerType` | branch `"REST"` vs chat |
| Conversation id | `$context.$workflow.$conversationId` | hand it to the multi-file processor tool to read chat attachments |
| Prior turns | `metadata.chatHistoryEnabled = true` on the `LLM`/`AGENT` | never inject history into the prompt |
| `HUMAN` node | `$context.$nodes.<CODE>.$feedbackRecieved` (sic — the misspelling IS the API; shipped code also checks `$feedbackReceived`), `$actionPerformed == 'APPROVED'` | `channelType: "CHAT"`, `feedbackEnabledFlag`, `approvalEnabledFlag`, `loopBackNodeId`, `maxIterations`, `chatChannelInput.messageTemplate.message` (HTML allowed), `requestChangeMessage`, `maxIterationsExceededTemplate` |
| Selection | numbered list + the typed number parsed by `CODE` (`/^\d+$/` → index, else name match) or by an `LLM` ("2", "two", "1 and 3") | or the pills tag (**widgets-and-forms**) |
| Files | `TOOL` `ORA_MULTI_FILE_PROCESSOR_TOOL` with `parseFiles`, `makeRawFilesAvailable`, input `conversationId` | `$output.<fileName>` = text; raw content map under `ORA_CHAT_ATTACHMENTS_RAW_FILECONTENT` |
| Email as input | REST input `emailJson` | §Email below |
| Voice | no live audio: `LLM` inputs are text (`systemPrompt`, `prompt`); the app's mic is browser speech-to-text that sends text | a recorded audio/video FILE is "multimedia" in Oracle's file FAQ (≤ 25 MB, read by the default models on chat upload or by `DOCUMENT_PROCESSOR`, never by the RAG document tool), but the chat picker's default types list none — verify on the pod before promising it; audio OUTPUT = podcast templates (**app-authoring**) |

`HUMAN` modes: free text (feedback only), approve-only gate, approve + request change. Always put
it inside a `CONDITION`-guarded loop so re-entry skips the prompt. `HUMAN` has no typed form input;
HTML in its template cannot post values back — only links navigate.

Declared but unused anywhere in shipped content — do not build on them: tool-level
`userInputRequiredFlag` / `specification.uiInput`, `waitFlag`, `chatExpThirdPartyDetails`.

Follow-up questions (Studio "Follow-up Questions") = workflow-level `followupEnabledFlag` +
`followupPrompt`, set with `fai_workflow_followup {op:'set', enabled, prompt}` (no CLI command
writes them; never `fai_file_write`). The prompt generates the questions from the conversation and
returns only a JSON array `[{"question": "..."}]`; it may read `{{$context.$system.$chatHistory}}`,
`{{$context.$system.$inputMessage}}` and declared `{{$context.$variables.<name>}}`
(`ORA_DEAL_ADVISOR_WORKFLOW` gates on a JOB variable and returns `[]` when it is empty). Enabling
needs a prompt; disabling keeps it.

## Email

- **Intake** (`ORA_FIN_EXM_EXPENSE_EMAIL_PROCESSING_ASSISTANT`): REST input `emailJson` (a JSON
  string: `subject`, `body_plain`, `body_html`, `attachments[]`) plus the ids the caller knows →
  `CODE` parse (HTML → text when there is no plain body, `hasAttachments`) → `LLM` triage
  (auto-reply, out-of-office and reaction mails end the run; the rest route by intent) → `CODE` strips
  banners, `LLM` strips greetings/signatures → a reply (prefix + known sender) finds its record by
  the thread's reference ids, else by details an `LLM` extracts from the quoted notification, with
  an explicit "ambiguous" flag when neither is unique → BO write → child workflows. Do not copy its
  defects: prompts naming camelCase fields of a snake_case payload, a user message built from the
  plain body only (HTML-only mail loses its text), `LLM` outputs parsed in `CODE` in one place and
  read as `$output.<field>` in another, `Re:` as the only reply marker.
- An `EMAIL` trigger (fires per new mail in the workflow's registered inbound mailbox) has fixed
  paths `$context.$triggers.EMAIL.$input.subject` / `fromAddress` / `content` / `headers` /
  `attachments`; no shipped workflow uses one.
- **Outbound**: an `EMAIL` node (`email.md`), an email tool (`do-create-tool {toolType:'email'}`,
  delivery `HCM_EMAIL` / `HCM_ALERTS`), a `HUMAN` node's EMAIL channel (`human-approval.md`; every
  shipped `HUMAN` uses `CHAT`), the workflow's `errorHandlers` EMAIL entry (on most workflows,
  almost always blank). `do-modify-email-account` sets an approval process's account only.

## Guards and errors

- First-record reads (`items[0]`) get a `CONDITION` guard with safe navigation and a fallback path
  (`RETURN` with the exact message, or a no-data `LLM`).
- A `BO_FUNCTION` needing `personId`/`assignmentId` gets an upstream prerequisite BO call bound
  into its inputs — not optional, not a question.
- Error handling = `metadata.errorNodeId` on `BO_FUNCTION`/`CODE`/`WORKFLOW`/`TOOL` nodes routing
  to a handler path (an `EMAIL` node or a dedicated `*_error_handler` child workflow);
  `$context.$error.$errorMessage` is readable there. Do not invent a `failure` outcome on
  `LLM`/`AGENT`/`BO_FUNCTION`.
- Inject retrieved data into prompts inside a labeled, delimited data section with a system-prompt
  line that it is untrusted data, not instructions.

## Common mistakes

- Writing the user-facing sentence into `prompt` instead of an instruction to generate it.
- Declaring an object `outputSpecification` the prompt never asks for (or vice versa).
- Reading `$output.field` from a `CODE` node (it is `$output.result.field`).
- Prettifying between every edit; skipping `fai_validate` because the CLI said `ok`.
- Adding `aiAppsCompatibleFlag` or a hint router to a standalone workflow.
- Leaving a placeholder like `"provided in conversation"` where a real upstream field belongs.
- Exporting or saving with a `description` that still describes the previous version.
