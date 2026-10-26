---
name: run-and-debug
description: Use when the user wants to run or test a workflow or app on the pod, see what a run did (executed nodes, node inputs and outputs), stop a run before a node (a breakpoint), run a batch of conversation scenarios from an uploaded file (scenario runs), rerun, override or pin node config/outputs for debugging, create/sync/run workflow or app tests (scripted conversation tests via fai_test_scaffold), compare runs or optimize model choice and token cost — and when run results or test reports should reach the user as files. The user trying it themselves in the chat debugger panel belongs to chat-debugger.
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
- Run it as its real caller does — the input of Oracle's run profiles: `triggerType:'rest'` +
  `parameters` = the REST inputs; `'app'` + `parameters:{appHint:'<Stage>', OraAppContext,
  OraUserContext}` with `message` = the query or the action payload (**app-authoring** §Testing
  without an app); `'email'` + `parameters:{subject, body, from, to, cc}`; `'schedule'` with
  `message:''` and no parameters; omitted = a chat turn. Oracle's `rest`, `email` and `schedule`
  profiles add `singleTurnOnly:true`. A shipped workflow's own profiles show realistic inputs
  (`fai_example_get {view:'full', select:'json.specification.dtRunProfiles'}`).
- The answer is the run read from its own event stream: `finishReason` (`stop`, `error`, `paused`),
  `output` (the final answer; on `error` the orchestrator's error record verbatim plus `errorCode`),
  `conversationId`, `nodes` (the executed node occurrences in order, with `outputChars`) and, for
  `nodeCodes:[…]`, those nodes' runs with decoded input/output. The full run is `responseFile`:
  read parts of it with `fai_file_read {path, select, grep}` (e.g. select
  `nodeOccurrences[?nodeCode=='X'].output`). `rerun:true` repeats the last request exactly,
  `conversationId` included. The message is the user's text, verbatim — never invent one (the one
  exception: an improvised answer in a scenario run, with the user's permission — below).
- Oracle's debug prompt names UI tools; their equivalents here: `do-run-chat` → `fai_workflow_run
  {message, workflowStatus:'DRAFT'}` on the saved DRAFT; `do-rerun-last-chat` → `{rerun:true}`;
  `get-debugger-results-for-nodes` → the run answer's `nodeCodes`; `get-last-chat-response` /
  `get-last-user-message` → the run answer and `.debug/fai-runs/<workflow>/last-*.json`;
  a breakpoint set on a node in Studio's debugger → `stopBefore:['<CODE>']` (below);
  `do-select-node` has none. The CLI commands `get-nodes-executed-on-last-debug` and
  `get-debugger-results-for-nodes` read the local debugger sidecar, which runs never fill.

## Stop before a node — `stopBefore` (Studio's breakpoint)

- `fai_workflow_run {ws, file, message, workflowStatus:'DRAFT', stopBefore:['<CODE>', …]}` runs
  the turn and stops BEFORE the first named node it reaches — Studio's debugger breakpoint, sent
  as `debugParams.breakPoints` (Oracle's test runner sets the same breakpoints from
  `pathAssertions.mustNotExecute`). Debug endpoint only: refused with `chat:true`. Each code must
  be a node of the workflow file, at any nesting level; an unknown code is `invalid-arg`.
- Use it to see how a turn is handled without reaching its side-effect nodes (creates, updates,
  business-object writes, notifications): stop at the node right AFTER the one under suspicion,
  then read the suspect's input, output and `nodeContext` (`nodeCodes`, or `responseFile`).
- Reading the answer:
  - `breakpoints` = `{requested, notExecuted, lastExecuted}`; a node off the turn's path also
    lands in `notExecuted` — name nodes the path reaches.
  - A stop shows as `finishReason:'stop'` whose `output` is the LAST EXECUTED node's output — the
    same shape as a turn that ended normally on that node (an LLM reply), so the stream alone
    does not tell them apart.
  - `outputIs` without `unverified` = the stop is established (the requested node is what the
    graph runs right after the last executed one, or the server named it as `pausedNode`):
    `output` is not the agent's reply — never relay it as the workflow's answer.
  - `outputIs` starting with `unverified` = not established: either `output` equals the last node's
    output but the graph does not run a requested node next (it may be the real reply), or it does
    not equal it (the path may never have reached the node). Check `nodes` against the graph
    before saying which.
  - `paused` with `pausedNode` = a requested code and no `waitingNode` is a stop too (how Oracle's
    CLI reads a breakpoint): the answer has no `resume`; `outputIs` names that node. A `paused`
    with `waitingNode` is still a `HUMAN` or `WAIT` node waiting for a decision.
  - Nothing resumes or continues a stopped turn.
- The conversation's server state after a stopped turn is UNVERIFIED (the turn never finished):
  investigate a stopped turn on a fresh conversation — replay the earlier turns there (mode 2,
  below), then the turn with `stopBefore` — and never continue a real interaction on a
  conversation that had a stopped turn until its state is verified.
- `rerun:true` repeats the last request exactly — `stopBefore` AND its `conversationId` — so
  rerunning a stopped turn continues that UNVERIFIED conversation: investigate again on a fresh
  conversation instead (above); other breakpoints = a full request there. A `resume` may carry
  `stopBefore` too.

## Multi-turn, mode 2 — an interactive conversation through `fai_workflow_run`

Conversation-scope variables live on the SERVER per `conversationId`; a workflow remembers only
within one conversation (Oracle's own test planner treats routes that need "state established by
an earlier conversation turn" as multi-turn only). Never encode state into the message text and
never invent a state input (`wizardState` and the like) — the server keeps it.

1. First turn: `fai_workflow_run {ws, file, message, workflowStatus:'DRAFT'}` — the answer carries
   the `conversationId` this server generated.
2. Read `output` and `followUpQuestions`; put the workflow's question to the user with
   `AskUserQuestion` (its options VERBATIM when it offers any).
3. Every later turn: the same call with the user's answer as `message` and the SAME
   `conversationId`. A new conversation only when the user starts over.
4. `finishReason:'paused'` with `waitingNode` = the run waits on a `HUMAN` or `WAIT` node (a
   `paused` at a requested breakpoint is a stopped turn — above): `waitingNode` holds the node
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
   numbers in `contains`; when conversation variables matter, a later step relies on a fact given
   only earlier (Oracle's continuity proof). The answer carries the test file, the definition path and the
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

## Scenario runs — a batch of conversations from the user's file, run alone

The user uploads a file of conversation scenarios and asks you to run it: you run every step
yourself through `fai_workflow_run`, record each result, diagnose what went wrong from the run
data, and hand over one report. Nothing is fixed during the batch — fixes are proposed after it.

Before the first run, settle each of these from the user's words; whatever they leave open, ask
in ONE `AskUserQuestion` — never assume, never start a batch with an open question:
- Conversation policy, per batch or per scenario: a FRESH conversation per scenario, or the SAME
  conversation continued — then the user names the reset command the workflow understands, sent
  as its own turn between scenarios.
- Answers the file does not give: improvise on the user's behalf ONLY with their permission for
  this batch; without it such a step is `blocked` and its scenario stops there.
- Side effects: run fully, or stop before the side-effect nodes (creates, updates,
  business-object writes, notifications) with `stopBefore` — "safe" or "don't create" means
  `stopBefore`. When you ask, say that a full run creates real data on the pod.
- Version: the saved DRAFT unless the user says PUBLISHED.
- SAME conversation + `stopBefore`: after a stop, do the remaining scenarios run fresh, or does
  the batch stop?

The file:
- The upload arrives as a handle `(id=<fileId>, <name>, …)`: `fai_file_put {ws, fileId,
  path:'inputs/<name>'}`, then `fai_file_read {ws, path}` (`offset`/`limit` page a long file).
- CSV first. Map the columns by meaning — scenario id, step order, the message or an approval
  decision (`approve` / `reject` / `feedback` + its text), optionally the expected result or text
  the output must contain. Show the mapping and the scenario and step counts before running; a
  column that fits two meanings, or none, → ask.

Running:
- One `fai_workflow_run` per step, in file order, ONE CALL AT A TIME — the next only after the
  previous answer, never two runs in parallel: the pod's firewall bans request bursts. Tell the
  user this pacing when the batch starts (the batch takes as long as its runs).
- Fresh: the scenario's first step omits `conversationId`, later steps reuse the id its answer
  carried. Same: one `conversationId` for the batch, the reset command between scenarios
  (recorded as a `reset` row).
- An approval step answers a `paused` run with `waitingNode` → `resume:{action, content?}`.
- With `stopBefore`, read each answer as "Reading the answer" above says. A stopped turn leaves
  its conversation UNVERIFIED, so its scenario ends there (later steps `not-run`); in a
  SAME-conversation batch it ends the shared conversation — the remaining scenarios then run fresh
  or the batch stops, as settled before the first run.
- An improvised answer is marked `improvised` in every record and in the summary — never presented
  as the file's.
- `responseFile` holds only the LAST run: diagnose a step before running the next one.

Record each step (scenario, step, sent as `file` / `improvised` / `reset`, the message or
decision, `finishReason`, `output` trimmed, the executed nodes, `breakpoints` (`requested`,
`notExecuted`, `lastExecuted`) and `outputIs` when present, the
expected result, the verdict, the finding) in `test-reports/scenarios/<batch>/steps.csv`;
`fai_file_write` replaces the whole file, so write it again after each scenario. Verdicts:
`passed` (the expected result holds), `diverged` (ran, but the expected result does not hold, or
the workflow asked something unexpected), `failed` (`error`), `stopped` (a breakpoint stop),
`blocked`, `not-run`; no expected result → `ran`.

Diagnose every `failed`, `diverged` or unexpected question from the full run (`responseFile`:
node input and output, `nodeContext`, `nodeStepInfo`, read with `fai_file_read {select, grep}`) in
the order of "Investigate in order" above; the finding names the node, the field and the evidence.

Report: `test-reports/scenarios/<batch>/summary.md` beside the CSV — per scenario `passed` /
`diverged` / `failed` with its diagnosis, the improvised answers listed as improvised, the
conversation policy, side-effect mode and version used, and for full runs what they created on the
pod. Deliver the folder with `fai_file_export {ws, path:'test-reports/scenarios/<batch>'}` (one
zip) and offer to turn each stable scenario into a mode-1 regression test (`fai_test_scaffold`).

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
