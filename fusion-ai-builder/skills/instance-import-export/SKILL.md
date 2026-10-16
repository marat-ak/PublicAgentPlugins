---
name: instance-import-export
description: Use when the user asks to pull an artifact and its dependencies from a Fusion pod into the workspace, to save a workspace artifact and its dependencies to the pod as DRAFTs, to move artifacts between instances, or asks what fetch or save does to local and server state.
---

# Instance import / export (pod ⇄ workspace)

Connection and auth: skill **pod-operations**. Lifecycle rules:
`skills/aistudio/references/prompts/artifact-conventions.md` §Lifecycle Rules. File delivery
instead of a pod: skill **import-export**.

## Instance → workspace: `fai_pod_fetch {ws, kind, code, withDeps?, status?, force?}`

- Fetches the root by code plus every referenced dependency the workspace lacks. Dependencies
  already in `src/` are kept, never overwritten (`present[]`). The root follows the CLI: when the
  local file differs it stops; `force:true` only after the user agreed to lose local edits.
  `status:'PUBLISHED'` fetches the published workflow or app.
- Listed instead of fetched: dependencies referenced only by server id (a CLI-created tool's
  deeplink or BO), connector bindings (`missing[]`), and whatever the pod refused (`failed[]`).
  Connector definitions/instances and signals are fetched by id through `fai_cli`
  (`do-fetch-connector-definition`, `do-fetch-connector-instance`, `do-fetch-signal`).
- Fetched files are the server's canonical form and carry server ids. Read the README first
  (`fai_file_read {path, select:'description'}`; apps: `internalDescription` — skill
  **pod-operations** §Rules), then `fai_validate` before editing.

## Workspace → instance: `fai_pod_save {ws, kind, code, withDeps?}`

- Saves the closure as DRAFTs, dependencies first, and stops at the first failure or conflict
  (`failed`, `notAttempted[]`). Oracle-seeded dependencies are skipped (they exist on every pod);
  a seeded root is refused. Never publishes.
- Only on the user's yes — their own request, or their "save now" pick of the offer below; never
  unasked. Report which DRAFTs were saved on which instance. Each save rewrites the local file
  with the server's canonical content.
- Conflicts are the user's call — a newer remote workflow DRAFT (`overwriteRemoteDraft` +
  `expectedRemoteVersion`, or `force`), an existing approval process (`allowConflictUpdate`):
  ask, then repeat that single save with `fai_cli`.
- `missing[]` must already exist on the target, or the saves that need it fail.

## Offer a DRAFT save after each good block

A workspace is THIS conversation's scratch: it starts empty (`fai_pod_fetch` / `fai_import` bring
content in), no other conversation can see it, and it disappears when the conversation is deleted
or the service restarts — whatever was neither saved to a pod nor exported is gone with it. What
persists is the user's saved DRAFTs (`fai_pod_fetch` brings them back) and `fai_export` /
`fai_file_export` files in the filestore. A hand-off or report never cites a workspace path as
something durable; it names the pod artifact and the exported files.

- Once per workspace — when you create it in a conversation — say so in one line: this
  conversation's scratch (gone with the conversation or a restart), saved DRAFTs come back with
  fetch, `fai_export` is the other way out.
- After each coherent block of work that passes `fai_validate` (a workflow, app, BO, tool … complete
  enough to stand on its own), end the turn with the DRAFT-save offer as your closing offer — an
  `AskUserQuestion`, single-select, options "save now" / "not yet": the DRAFT of `<code>` plus its
  workspace-held dependencies, counted (`fai_export`'s `files[]` without the root; Oracle-seeded
  ones are skipped by the save and do not count), to the connected `<instance>`.
- The offer states the effect truthfully, per kind: workflow or app → replaces the pod's DRAFT of
  that code (the published version is untouched; a newer remote DRAFT is a conflict, rules above);
  BO, tool, agent, topic, deeplink, policy, function (and the other non-workflow kinds) → updates
  the live object on the pod.
- "save now" is the explicit ask: `fai_pod_save`, then report. "not yet": keep working and offer
  again after the next good block — never mid-block, never again for an unchanged state.
- No connection yet → the offer is "connect + save": the instance comes from `identity_targets` and
  the connect follows skill **pod-operations** (its rules on choosing the instance and signing in
  run before the save).

## Between instances

Fetch from A → `fai_validate` → `fai_pod_connect` to B (one connection per workspace; B needs its own
sign-in) → save.
Policies, policy templates, functions and document schemas are saved by their `id` when the file
has one, and a fetched file carries pod A's `id`; connector records are bound by server ids. The
CLI does not document how a foreign id behaves on B — read the first save's answer and ask, never
strip or invent ids on a guess. For workflows and apps, Studio Import of a `fai_export` file is the
other path.
