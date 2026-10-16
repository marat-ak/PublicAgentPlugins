---
name: run-and-debug
description: Use when the user wants to run or test a workflow or app on the pod, see what a run did (executed nodes, node inputs and outputs), rerun, override or pin node config/outputs for debugging, create/sync/run workflow or app tests (scripted conversation tests via fai_test_scaffold), compare runs or optimize model choice and token cost — and when run results or test reports should reach the user as files.
---

# Run, debug, test

Before the FIRST run or debug in a conversation, `Read`
`skills/aistudio/references/prompts/workflow-debug.md` — required, not optional: it is how a run
is investigated (written for the Studio debugger UI — the mapping below). Test formats:
`skills/aistudio/references/prompts/workflow-test-authoring.md`,
`skills/aistudio/references/prompts/workflow-conversation-test-authoring.md`,
`skills/aistudio/references/prompts/app-test-authoring.md`. Runs, recordings and model catalogs
need the pod (**pod-operations**); test authoring, the debugger sidecar, comparisons and reports
are offline.

## Run and inspect — `fai_workflow_run`

- A run executes the SERVER copy of the workflow, never the local file. To run local changes,
  save the DRAFT first with `fai_pod_save` (ask the user before this pod write, like every save),
  then `fai_workflow_run {ws, file, message, workflowStatus:'DRAFT'}` (the orchestrator debug
  endpoint — this server posts to the orchestrator itself; the CLI's `run-workflow` /
  `run-workflow-chat` are denied). `chat:true` is the chat endpoint and runs only the PUBLISHED
  version: a workflow that was never published answers `errorCode` `FAI-40300` there (the answer's
  `hint` says which copy is missing).
- The answer is the run read from its own event stream: `finishReason` (`stop`, `error`, `paused`),
  `output` (the final answer; on `error` the orchestrator's error record verbatim plus `errorCode`),
  `conversationId`, `nodes` (the executed node occurrences in order, with `outputChars`) and, for
  `nodeCodes:[…]`, those nodes' runs with decoded input/output. The full run is `responseFile`:
  read parts of it with `fai_file_read {path, select, grep}` (e.g. select
  `nodeOccurrences[?nodeCode=='X'].output`). `rerun:true` repeats the last request exactly,
  `conversationId` included. The message is the user's text, verbatim — never invent one.
- Oracle's debug prompt names UI tools; their equivalents here: `do-run-chat` → `fai_workflow_run
  {message, workflowStatus:'DRAFT'}` on the saved DRAFT; `do-rerun-last-chat` → `{rerun:true}`;
  `get-debugger-results-for-nodes` → the run answer's `nodeCodes`; `get-last-chat-response` /
  `get-last-user-message` → the run answer and `.debug/fai-runs/<workflow>/last-*.json`;
  `do-select-node` has none. The CLI commands `get-nodes-executed-on-last-debug` and
  `get-debugger-results-for-nodes` read the local debugger sidecar, which runs never fill.

## Multi-turn, mode 2 — an interactive conversation through `fai_workflow_run`

Conversation-scope variables live on the SERVER per `conversationId`; a workflow remembers only
within one conversation. Never encode state into the message text and never invent a state input
(`wizardState` and the like) — the server keeps it.

1. First turn: `fai_workflow_run {ws, file, message, workflowStatus:'DRAFT'}` — the answer carries
   the `conversationId` this server generated.
2. Read `output` and `followUpQuestions`; put the workflow's question to the user with
   `AskUserQuestion` (its options VERBATIM when it offers any).
3. Every later turn: the same call with the user's answer as `message` and the SAME
   `conversationId`. A new conversation only when the user starts over.
4. `finishReason:'paused'` = the run waits on a HUMAN or WAIT node: `waitingNode` holds the node
   and its `initialMessage`, `resume.actions` the decisions it accepts (`approve`, `reject`,
   `feedback`, `timeout`). Ask the user, then `fai_workflow_run {ws, file, conversationId,
   resume:{action, content?}}` — no message; feedback text goes in `content`. A conversation that
   is not paused cannot be resumed (`needs-input`).
5. `finishReason:'error'` + `errorCode` `FAI-40300`: the server copy is missing or not runnable
   for this user — follow the answer's `hint` (save the DRAFT; or the chat endpoint needs the
   PUBLISHED version).

## Multi-turn, mode 1 — Oracle's scripted conversation test, run LIVE

Mode 2 explores; mode 1 is the regression form of a dialogue once its path is stable: ONE
conversation identity across scripted steps, run on the pod, every step asserted. Read
`skills/aistudio/references/prompts/workflow-conversation-test-authoring.md` first.

1. Author with `fai_test_scaffold {ws, file, spec}` — never hand-write Oracle's full definition
   (it demands every assertable node classified in every step and named ids everywhere; the
   scaffold does that from the CLI's own `get-workflow-conversation-test-context`). The spec is
   compact: `testName`, `goal`, `steps[]` — a chat step `{stepId, message, expectNodes:[…],
   output:{contains, notContains}}` per user message in the user's words, `expectWait:'<HUMAN>'`
   on the step that pauses, a resume step `{stepId, resume:{waitStepId, action, content?},
   expectNodes, output}` per decision. `stepId` = two lowercase words (`request-move`); no bare
   numbers in `contains`. The answer carries the test file, the definition path and the
   classification per step; a generator rejection comes back as `cli-error` — repair the spec,
   call it again (an existing test file is updated in place).
2. Run it live: `fai_cli run-workflow-test {testFile, dataSource:'live', workflowStatus:'DRAFT'}`
   (the DRAFT saved first, as for any run). The report tells which step diverged and where.
3. Report: `get-workflow-test-final-summary {file}`; the reports under `test-reports/` go to the
   user with `fai_file_export`.

Recording and file replay (`do-record-workflow-test`, `do-apply-workflow-test-data`,
`dataSource:'file'`) are NOT used until further notice: the recorder keeps a node response only up
to 3,072 bytes, below every Fusion list answer, so it returned `needs-model-test-data` for most
steps and asked for 0.85–1.1 MB of hand-prepared data per step. Live runs need none of that.
- Investigate in order: `get-workflow-node-structure` → the run's `nodes` →
  `get-nodes-metadata-by-code` (configuration; `select` the fields you need) → the node runs
  (`nodeCodes`). After every rerun read the NEW run — LLM nodes are not deterministic.
- Debugger overrides and pinned outputs (`do-modify-node-overrides`, `do-node-override-output`,
  `do-clear-node-override`, `do-clear-node-output-override`, `list-pinned-outputs`;
  `get-debugger-node-override-schema` before saying a field cannot be overridden) edit the local
  debugger sidecar only — no run sends them, neither `fai_workflow_run` nor the tests. Set them only
  on request and say so; changing what a run does is a workflow change, saved as a DRAFT, then rerun.

## Tests

- Oracle's sync loop, with its recording steps left out: plan (`get-workflow-test-sync-plan`) →
  author (conversation tests: `fai_test_scaffold`; single-turn: `do-generate-workflow-test` /
  `do-update-workflow-test`) → run LIVE (`run-workflow-test` / `run-workflow-tests` with
  `dataSource:'live'`) → attach local judge results (`attach-workflow-test-judge-result(s)`) →
  `get-workflow-test-final-summary`, which is the evidence for the reply's **Validation and
  Insights** section. Apps: `get-app-test-sync-plan` → `do-sync-app-tests` →
  `get-app-test-final-summary`; one panel: `run-app-test`.
- A preview request runs only the plan command; an execution request finishes the loop. A
  `needs-model-test-data` answer means a recording was attempted — recording is off (above): run
  live instead.
- `judgeProvider:'remote'` only when asked; `evaluationMode:'deterministic'` only when asked.
- Masking (`get-test-data-masking-context`, `do-create-test-data-masking-profile`,
  `do-mask-test-data`) applies to recorded data only — nothing to mask while recording is off.

## Optimization — only when asked about cost, tokens or model choice

`get-workflow-model-override-targets`, `list-workflow-model-configurations` (pod),
`propose-sweep-candidates` (pod; stops for the user's review), labeled test runs,
`compare-workflow-test-runs`, `analyze-token-usage {report}`, `generate-optimization-report`,
`run-optimization-sweep`.

## Results as files

A result over 16 KB arrives as `resultFile` + `resultShape` (its outline): read what you need with
`fai_file_read {path, select, grep}`.
Reports live under `test-reports/`; give them to the user with `fai_file_export {ws, path}` (a
directory becomes one zip) and name each file in the reply — the workspace, its test files, runs
and reports end with the conversation. A test file is re-creatable from its spec
(`fai_test_scaffold` again, on the fetched workflow); keep the spec in the reply when the user
will want the test later.
