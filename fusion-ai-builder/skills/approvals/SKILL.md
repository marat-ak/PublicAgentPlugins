---
name: approvals
description: Use when the request involves an approval process (.approval) — its payload attributes, rule levels, approvers, notification channels or email account — when a HUMAN approval node must point at an approval process, or for approval lookups (users, email accounts, manager types, representative types, hierarchy start).
---

# Approval processes

Format authority: `skills/aistudio/references/prompts/approval-process-builder.md` (written for
the builder UI) with the CLI overrides and UI→CLI command map in
`skills/aistudio/references/prompts/approval-process-cli-compat.md`; the workflow side:
`skills/aistudio/references/prompts/workflow-node-prompts/human-approval.md`.

## Shape and identity

- `src/approvals/<code>.approval` holds the create payload at top level (no `specification`).
  Identity = `moduleIdentifier`, set from `processCode` at create and immutable afterwards.
- A `HUMAN` node with `channelType: APPROVAL_PROCESS` names it in `metadata.approvalProcessCode`;
  that is the reference `fai_export` and `fai_pod_save` follow.

## Build (offline; lookups need the pod)

`do-create-approval-process {name, processCode}` → payload (`do-create-approval-payload`,
`do-create-approval-attribute`, `do-modify-approval-attribute`; every leaf carries
`attributeType`) → levels (`do-create-approval-rule`, `do-modify-approval-rule {levelNumber}`
1-based, `do-delete-approval-rule`) → approver per level (`do-modify-approver-type`: `User`,
`Management Hierarchy`, `Representative`) → `do-modify-notification-channel` →
`do-modify-email-account` → `validate-approval-process` (issues are keyed by UI focus ids; an
email account and at least one level are required).

- Rule `criteria` and `routeUsing` are parsed JSON in CLI input — pass objects; the CLI
  stringifies them on save.
- Users, email accounts, manager types, representative types and the hierarchy start come from
  `search-approval-users` / `list-approval-*` (pod); pass returned values verbatim.
- The CLI cannot generate approval conditions: ask for exact criteria, never invent them.

## Save, conflicts, delete

- Save only on an explicit ask (`fai_pod_save {kind:'approval'}`). `conflictType:
  existing-remote | duplicate-create` → ask whether to update the existing process; only after a
  yes, `do-save-approval-process {file, allowConflictUpdate:true}`. `duplicate-unavailable` → ask
  for another code.
- `do-delete-approval-process` deletes the remote process too: ask, then `confirm:true`.
- An app-backed workflow never resumes a paused run, so a `HUMAN` approval node does not work
  behind an app (**app-authoring**).
