---
name: import-export
description: Use when delivering any artifact as a file (fai_export of a workflow, app, agent, tool, BO, deeplink, topic, policy, policy template, function, document schema, approval or connector; download link; version stamp; Studio import steps), when the user uploads an export or artifact file to work on (fai_import), when a copy must get a new code, when export reports missing dependencies, or when asked what Studio Import accepts.
---

# Import and export (files)

Local file conventions: `skills/aistudio/references/prompts/artifact-conventions.md`. The export
contract below is observed from Studio's own Export button (the corpus of Studio export zips — every
file of every rooted zip is reached by the closure rules here) unless marked Oracle-documented or
unverified. Saving to / fetching from a pod instead: skill **instance-import-export**.

## What a Studio export IS

- **Workflow export = a client-side zip** of `src/<kindDir>/<code>.<ext>` JSON files, no manifest
  (directories seen: `workflows`, `agents`, `tools`, `businessObjects`, `deeplinks`, `topics`,
  `policies`). Filenames are the lowercased code plus extension; `specification` is an object.
- The zip bundles **every artifact reached transitively**, including through the bodies of `LOOP`
  / `WHILE` / `REFERENCEABLEBLOCK` containers: child workflows (`WORKFLOW`), agents
  (`AGENT.agentCode`), tools (`TOOL`, `RAG_DOCUMENT_TOOL`, `EXTERNAL_REST.externalRestToolCode`,
  private `AGENT.toolCodes[]`), topics (`AGENT.topicCodes[]`, agent topic mappings), business
  objects (`BO_FUNCTION`, `DOCUMENT_PROCESSOR`, tools), deeplinks (tools), policies (`POLICY`).
- NOT bundled: policy templates, connector instances, a customization parent
  (`sourceWorkflowCode`), a policy's generation context (`context.workflowContext`), and some
  standard seeded BOs/tools that exist on every pod.
- Server ids: exported workflows carry no `workflowId` / `$id`; every other kind keeps its server
  id (`agentId`, `toolId`, `topicId`, `deepLinkId`, `supportedObjectId`, policy `id`).
- **App export = one JSON file** with `code`, `name`, `internalName`, `internalDescription`,
  `status`, `version` and `specification` as a STRING (no server ids, no `description`). Oracle's
  local `.app` stores `specification` as an object; `fai_import` parses the string,
  `fai_export {kind:'app'}` stringifies it back. Do not "fix" either form.
- **Identity is the code** (`workflowCode`, `code`, `objectCode`, `toolCode`, `agentCode`,
  `topicCode`, `deepLinkCode`, `moduleIdentifier` for an approval process); a Connector Definition
  has only its server `connectorDefinitionId`. Import matches on the code: same code = update the
  existing DRAFT, new code = new artifact.
- Studio Import (UI) is verified for workflow zips and app JSON. The CLI's `do-save-<kind>`
  (`fai_pod_save`) is the documented way in for every type. Whether Studio Import accepts a zip
  whose root is another type (a tool, an agent, a policy, …) is NOT verified.

## Deliver a build

1. `fai_validate` every artifact in the closure (`ok:true`), then
   `fai_export {ws, kind, code, version:<n>}` — any of the 14 kinds →
   `{fileId, name, downloadHint, files[], missing[], warnings[]}`.
2. Form: an app → one JSON (`specification` a string — the pod export form) plus `requires[]`,
   its backing workflows (from `applicationMetadata.agents.<slot>.agent`), each exported as its own
   zip. Every other kind → a zip of `src/<kindDir>/<file>` with the root first and its full
   dependency closure (`withDeps:false` = the root alone, only when the user asks for exactly that).
3. Closure rules beyond Studio's own: `HUMAN.approvalProcessCode` → approval process,
   reusable-function `CODE.functionTemplateCode` → function template, `policyTemplateCode` →
   policy template, a connector instance's `connectorDefinitionArticleId` → connector definition
   (by `connectorDefinitionId`). A tool names its BO / deeplink by code (Studio export form), by
   server id only (`supportedObjectId` / `deepLinkId` — CLI-created tools; matched against the
   target file's same field) or by `specification.baseObjectCode` (Oracle sample deep link tools).
4. Read the result: `files[]` is the exact package; `missing[]` / `warnings[]` name every
   reference that is NOT in the workspace (never dropped) — it must already exist on the target or
   the import fails. Seeded `ORA_` content usually exists on every pod; your own must be added
   (`fai_example_copy` or build it). A connector tool's KM connector binding is always listed:
   connector instances are server records and never travel in a file. Report `warnings[]` verbatim.
5. Version: first delivery `v1`, every later change bumps. The stamp lands on the root's exported
   copy only (` v<n>` on `name`, `Version <n>.` on an existing `description`); artifacts without a
   top-level name (approval processes) cannot be stamped — export them without `version`.
6. Workflow `workflowId` / `$id` and app `$id` / `id` / `appId` are stripped from the exported
   copy (Studio's export form has none); every other file ships byte-for-byte. Workspace files
   keep their ids.
7. The file is uploaded to the file store under the caller's identity; its `name` is what the user
   downloads (`downloadHint`) and imports. Reply with each file's `name`, kind, code, `v<n>`, and
   the import steps below.

## Import steps for the user (put them in the reply)

- Download the file with its download button or link in this chat.
- Workflow zip: AI Agent Studio **Workflows → Import**, choose the zip. Identity is the
  `workflowCode`: a DRAFT with the same code is updated in place; a new code creates a new
  workflow. Dependencies inside the zip import alongside.
- App JSON: **Agentic Apps → Import**, choose the JSON (do not "fix" the string `specification`);
  import its backing workflow zips first so the app's agents resolve.
- Any other root (a tool, agent, policy, approval, …): Studio's import of such a zip is not
  verified — say so, and offer `fai_pod_save` (the CLI's own save path) when the user has pod
  access.
- The imported artifact is a DRAFT: test it in the Studio test chat (widgets print as XML there)
  or in the app; publishing is the user's act in Studio.

## Work on an uploaded file

`fai_import {ws, fileId}` accepts a Studio export zip (entries under `src/<kindDir>/` of the 14
types), any single artifact file of the 14 types, and an app export JSON (string `specification` →
object under `src/apps/<code>.app`). Entries that are not artifacts come back in `skipped[]` with
the reason — mention them. Then `fai_workspace_tree`, the README of each workflow/app
(`fai_file_read {path, select:'description'}` / `'internalDescription'`; missing or stale → tell
the user) and `fai_validate` before touching anything —
imported pod content often fails Oracle's stricter validator (**validation-and-debugging**). A
non-artifact upload (a document, a spec) goes in with `fai_file_put` instead.

## Copies and codes

- `ORA_` codes are Oracle-seeded. Never export a workflow/app under an `ORA_` code (Import would
  overwrite the seeded DRAFT): create yours with `do-create-workflow {workflowCode}` and rebuild
  the nodes from the example (`fai_example_get {view:'node:<CODE>'}`), or — if
  `do-modify-workflow-metadata` cannot change the code — `fai_file_write` the renamed copy once
  (the sanctioned raw edit), then `fai_validate`.
- Referenced `ORA_` BOs, tools, topics keep their codes: they are references to seeded content.
- `workflowCode` matches `^[A-Z0-9_]+$`; the CLI derives it from the name when not given.
- Filenames are the lowercased code plus extension; the CLI names them — do not rename files.
- A "duplicate" / "copy" request means a NEW code, never an in-place change of the original; a
  fix to an existing delivery keeps the code and bumps `v<n>`.

## Common mistakes

- Delivering with non-empty `warnings[]` unmentioned.
- Re-using `v1` after a change; forgetting to state the version.
- Exporting an app without its `requires[]` workflows (one export per file, a link for each).
- Telling the user to publish, or implying the import is live.
