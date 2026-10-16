---
name: validation-and-debugging
description: Use when fai_validate or a validate-* command reports errors or warnings (any of the 14 artifact types), when an imported or fetched artifact fails validation, or when you need to understand an existing workflow's structure and real execution path. Running and the debugger itself: run-and-debug.
---

# Validation and debugging

Format authority: the per-node "Invalid patterns" sections in
`skills/aistudio/references/prompts/workflow-node-prompts/` and each artifact's builder
reference; debugger semantics: `skills/aistudio/references/prompts/workflow-debug.md`.

## `fai_validate {ws, path}` — what it returns

`{ok, errors[], warnings[]}` = Oracle's `validate-<kind>` (all 14 types) merged with our checks:

| Source | What it catches | Typical fix |
|---|---|---|
| Oracle `validate-workflow` | expression syntax, undeclared `$context` paths, `condition` that is not an explicit boolean (a bare data path, a stripped literal), missing required inputs/metadata per node type, app-stage routing errors on app-backed workflows, `workflowCode` format | rewrite per the node's contract; existence checks as `{{!!…?.[0]?.Id}}`; file-backed patches keep quotes intact (`fai_cli` does this for you) |
| Oracle `validate-<other kind>` | required fields, contracts, document metadata, credential safety (tools), UI-required fields (approval email account, levels) | the matching `do-update-*` / `do-modify-*` command of that artifact's skill |
| structural: dangling outcomes | an `outcomes.<key>` pointing at a node id that does not exist | `do-modify-node-edges` |
| structural: duplicate node codes | two nodes with the same `code` | `do-modify-node {code}` / delete the stray |
| structural: missing convergence target | a `CONDITION` / `SWITCH` / `PARALLEL` (any nesting level) without node-level `convergenceTargetId` — Oracle requires it; `do-create-node` does not write it | `fai_workflow_node_struct {op:'set-convergence', node, target}` (the node where the branches rejoin, same scope, or `end`) |
| warning: server id | `workflowId` / `$id` / app `id` written by a pod fetch or save | none — `fai_export` strips them; never hand-edit |
| warning: missing reference | anything the artifact's dependency closure references that is not under `src/` (any nesting level, any of the 14 kinds) | add the artifact or accept it as pod-seeded (`ORA_`) and say so |

Oracle's validator is stricter than the pod: shipped seeded workflows can fail it (typically
`CONDITION` guards written as bare data values). Fix what you own; report what you inherited.

## Repair discipline

- Read the error, open the node (`get-nodes-metadata-by-code {file, nodeCodes}`; `select` or
  `grep` the failing field), open the node's Oracle contract, change the minimum. Re-run
  `fai_validate` after every repair batch. Do not loosen a user-requested output contract to make
  validation pass.
- Never "repair" by hand-editing JSON when a `do-modify-*` command or a `fai_*` editing tool
  (`fai_wf_field_edit`, `fai_workflow_node_struct`) covers it; never delete nodes you were not
  asked to touch.
- Warnings are reported verbatim in the **Validation** section even when `ok:true`.

## Understanding a workflow

- The README first: `fai_file_read {path, select:'description'}` (apps: `internalDescription`)
  — purpose, callers, state and known issues as the author wrote them (skill
  **workflow-authoring** §README); missing or stale → say so to the user.
- `get-workflow-node-structure {file}` = nodes, connections, display-name → code map. Start here
  for any structural question, then `get-nodes-metadata-by-code` for the control-flow nodes
  (`CONDITION`, `SWITCH`, `CODE`, `LOOP`, `WHILE`, `LLM`, `AGENT`) to reconstruct the real path.
- `fai_example_get {kind:'workflow', code, view:'graph'}` gives the same view for corpus items.
- Describe workflows semantically (what and why), not edge by edge.

## Debugging a run

Running, executed nodes, node results, overrides and pinned outputs: skill **run-and-debug**
(`fai_workflow_run`). "Rerun" always means the whole chat/run, never one node. Investigate with
tools before asking; ask at most one question.

## Common mistakes

- Reporting the CLI's `ok:true` as validation (the truth is `fai_validate`).
- Rewriting a node from scratch to fix one field.
- Treating pod-seeded validation failures as your bug to silently fix.
