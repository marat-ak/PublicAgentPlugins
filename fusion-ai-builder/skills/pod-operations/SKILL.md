---
name: pod-operations
description: Use when the user explicitly asks to connect to a Fusion pod or work against one (fetch or save DRAFTs, find a pod workflow by name or code, search pod business objects / deep links / connectors, remote lists, runs and tests, server-side generation), or when a fai tool answers pod-required, auth-required or confirm-required.
---

# Pod operations (explicit, scoped, never publishing)

Format authority for what needs a pod: `skills/aistudio/references/prompts/artifact-conventions.md`
§Lifecycle Rules. Which commands need it: `fai_cli_help {filter}` (`pod` column).

## Connect — only on explicit ask, to an instance the user chose

- Instances are the identity targets, not hosts: `identity_targets` lists the instances this user
  may sign in to (name, label, sign-in status). The user picks one; never infer it from a workflow
  name, never reuse one from an earlier task without asking. Several plausible → `AskUserQuestion`.
- `fai_pod_connect {ws, instance}` — `instance` exactly as `identity_targets` names it. There is no
  host, user, password or token argument: the only credential is the user's own sign-in, which the
  engine attaches to every call. The CLI settings (pod host, IdP tenant, client id)
  are the instance's login attributes for this agent in setup, and the sign-in scopes are the agent's separate `scope` and `extraScopes` there, both maintained by an admin.
- One sign-in covers every scope the CLI uses (Studio, BOSS, Fusion REST, …): the first scope shows
  a sign-in page, the rest complete silently.
- A result `{state:"auth-required", target}` (from `fai_pod_connect` or any pod tool) means this
  conversation has no usable sign-in to `target` (never signed in, or it expired). Sign in, then
  repeat the same call: `identity_select {target}` when `identity_targets` already shows a live
  sign-in for it, otherwise `identity_login_start` with that `target` (the user completes the sign-in on the
  page it returns) followed by `identity_login_poll {target}`.
- The CLI never opens a browser here, and you never send the user to the CLI's own login.
  `cli-login-lost` = the CLI lost its login during a call: repeat the call once (it logs in again).
  `login-failed` = the first login with the sign-in was rejected: report it verbatim.
- The connection is per workspace, and a workspace belongs to this conversation alone (it starts
  empty, ends with the conversation); `fai_pod_status {ws}` reports the connection (`identity:
  missing` = the next pod call asks for a sign-in), `fai_pod_disconnect {ws}` ends it.

## What becomes possible

| Need | Tool | Skill |
|---|---|---|
| Find a workflow by name or code (the pod's workflow list) | `fai_pod_workflows {ws, query}` | this skill, below |
| Pull an artifact + its dependencies | `fai_pod_fetch` | **instance-import-export** |
| Save a DRAFT (+ dependencies) | `fai_pod_save` | **instance-import-export** |
| Run a workflow (multi-turn: one `conversationId`), read the run | `fai_workflow_run` | **run-and-debug** |
| Tests, recordings, model catalogs | `fai_cli` (`run-workflow-test`, …) | **run-and-debug** |
| Live BO discovery | `fai_cli` `list-supported-business-objects {query, family, product}`, `get-business-object-functions` | **business-objects-and-tools** |
| Deep links, KM connectors, connector definitions | `fai_cli` `list-deep-links`, `list-km-connectors`, `search-connector-definitions` | **deeplinks**, **connectors** |
| Approval lookups | `fai_cli` `search-approval-users`, `list-approval-*` | **approvals** |
| Generation from documents | `fai_cli` `do-generate-policy-functions`, `do-generate-function-implementation`, `do-generate-document-schema` (documents via `fai_file_put`) | **agents-topics-policies**, **document-schemas** |

No free-text search for a BO, tool or agent on a pod: `search-business-objects`,
`search-deeplink-tools`, `search-external-rest-tools`, `search-document-tools` and `search-agents`
are denied (they run through the Studio UI's own streaming proxy, which a pod does not serve). Use a
`list-*` command with its filters, the corpus (`fai_bo_search`, `fai_examples_search`), or the user's
code. Workflows have their own lookup — next section.

## Find a workflow by name or code

The user names a workflow by its title or part of it and you need its `workflowCode` (to fetch,
run, debug or open it):

1. A workspace connected to the instance the user chose (above).
2. `fai_pod_workflows {ws, query}` — `query` = a distinctive part of the name or the code (`wizard`,
   `TRANSACTION`): a case-insensitive substring match on name OR code, newest change first, `DRAFT`
   and `PUBLISHED` rows (a workflow with both versions gives one row each).
3. No row → another word of the name, a shorter part, or no `query` at all, paging with
   `offset` = `paging.nextOffset` while `hasMore`.
4. One workflow → its `code`. Several plausible (similar names, a customization listed in
   `customizations[]`) → `AskUserQuestion` with code, name and status. Ask the user for the code
   only when the list has no match.

- `status` narrows to `DRAFT` or `PUBLISHED`; `includeSeededTemplates:true` only when the user looks
  for an Oracle seeded template (the list hides them, as Studio does).
- `search-workflows` is NOT a lookup: it asks the pod's suggestions agent to recommend workflows for
  a described purpose, and answers empty wherever that agent is not deployed — an empty answer says
  nothing about whether a workflow exists.
- `list-policy-workflow-contexts` returns only PUBLISHED workflows (code and name, as Policy Store
  generation context) — it misses every workflow that has only a DRAFT.
- A connected workspace can always list the pod's workflows: never tell the user there is no way to
  list or find them.
- `boss-error` = the pod's own refusal of the list: report its `status` and `body` verbatim.

## Rules

- **Never publish.** `do-publish-*` is denied; do not flip status, call REST, or script around it.
- `pod-required` → the workspace has no connection: connect it (ask which instance if unclear); do
  not retry blindly. `auth-required` → the sign-in loop above, then repeat the call once; a second
  `auth-required` right after a completed sign-in → tell the user, do not loop.
- `not-configured` from `fai_pod_connect` or a pod tool = the instance's login attributes for this
  agent in setup, or a sign-in scope (for example `fa`), are missing or wrong (the message names
  them); an admin fixes them in `/setup` — report it verbatim, do not retry, work around it or ask
  the user for the values. Once it is fixed, connect again.
- `confirm-required` → the command deletes or changes server state (remote delete, unpublish):
  name what and where, ask, and repeat with `confirm:true` only after a yes.
- A fetched workflow or app is READ README-FIRST: `fai_file_read {ws, path, select:'description'}`
  (`select:'internalDescription'` for an app) before any node or structure read. Its "Known
  issues & limitations" are authoritative context for the conversation — honour them, do not
  rediscover them. No README, or a stale one (it names nodes or branches that no longer exist,
  contradicts `get-workflow-node-structure`) → tell the user in one line and offer to rewrite it
  (skill **workflow-authoring** §README). Before a save, the README reflects the saved state.
- A save is a remote mutation: name the artifact and the instance, ask once, then save; report
  "DRAFT `<code>` saved on `<instance>`". The ask is the user's own request or their pick of the
  DRAFT-save offer — skill **instance-import-export** holds that rule (when to offer, what to say).
  Saving is not delivering — the user still gets an export when they asked for one.
- Publishing, activation, and role grants stay human acts in Studio — say so when asked.

## Common mistakes

- Connecting "to be helpful" before the user asked (offering "connect + save" is an ask; connecting is not).
- Asking the user for a host, password, token or CLI setting — there is nowhere to put one; the
  sign-in is the credential and the instance's setup attributes are the settings.
- Treating `pod-required` / `auth-required` as a result and moving on.
- Reading an empty `search-workflows` answer as "the workflow does not exist" — look it up with
  `fai_pod_workflows`.
- Fetching with `force` over a local edit.
