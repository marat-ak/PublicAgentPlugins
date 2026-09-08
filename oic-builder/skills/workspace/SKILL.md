---
name: workspace
description: Use when opening, committing, unlocking, verifying, or releasing an OIC integration workspace — oic_open_workspace / oic_commit / oic_unlock / oic_verify / oic_release_workspace semantics, the lock rule (read vs edit), read-only and concurrent opens, the lock upgrade, 423 lock conflicts, release-on-done, project-scoped calls.
---

# Workspace lifecycle

## The lock rule — open correctly the FIRST time
A workspace id is required for BOTH reading a blueprint and editing; the LOCK differs by intent, so
choose it up front (opening the wrong way wastes a throwaway open):

- **READ a blueprint / inspect** (`oic_get_blueprint`, `oic_get_node`, `oic_get_map_xslt`, …): the
  wsid may be opened **WITHOUT lock** — `oic_open_workspace {instance, code, version, project?, lock:false}`. Read-only,
  never contends with a human designer.
- **Any EDIT / mutation** (`oic_set_map_xslt`, structural-node adds, assignments, wizard save, delete
  — anything that changes the integration): requires a wsid opened **WITH lock** —
  `oic_open_workspace {instance, code, version, project?, lock:true}`. A `lock:false` wsid CANNOT edit.

So: open `lock:false` for read-only work; open (or re-open) `lock:true` BEFORE the first edit. If you
inspected read-only and then decide to edit, release that wsid and open again with `lock:true` (§Lock upgrade).

## Tools
- `oic_open_workspace {instance, code, version, project?, lock:true|false}` → `{instance, code, version, project, wsid, locked}`. `lock:false` = read-only open (safe for inspection); `lock:true` = editable (lock rule above). Every open mints a NEW wsid. Opening an integration that is already open in this conversation is an ERROR (reuse the registered wsid, or release it first). You may hold several integrations open at once — every call names which.
- `oic_commit {instance, code, version, project?, wsid}` → persists the workspace draft. Releases nothing; keep working.
- `oic_unlock {instance, code, version, project?}` → force-releases the edit lock. 200 = released, 412 = wasn't locked (fine). For clearing your OWN stale lock at the START of a session (instructions.md §Session lifecycle step 2) and for crash recovery when you have no wsid — to release WHEN DONE see "Releasing when done".
- `oic_verify {instance, code, version, project?}` → opens a FRESH workspace, returns `{hasErrors, hasWarnings, problems[]}`, deletes that throwaway. The authoritative verdict. Problems carry the node `id` when node-specific.
- `oic_release_workspace {instance, code, version, project?, wsid}` → releases the workspace for a human (see "Releasing when done").
- Read tools (`oic_load_blueprint` needs `{…, wsid}`; `oic_get_blueprint`, `oic_blueprint_view`, `oic_get_node`, `oic_get_map_xslt`, `oic_get_map_namespaces` need `{instance, code, version, project?}` — cache-only, no wsid) → cross-integration inspection mid-build = open each integration `lock:false` and name it on every read.

## Lock upgrade
Inspected with `lock:false` and now need to edit? `oic_release_workspace` that wsid, then
`oic_open_workspace {…, lock:true}` — the server refuses edits on a `lock:false` wsid and refuses a
second open of the same integration while the first is registered.

## Releasing when done (ASK — never automatic)
When you judge the work DONE (all changes committed and verified), do NOT release on your own. First
**ASK the user** via the **AskUserQuestion** tool whether to release the integration back so a human
can open it in the designer. Branch on the answer:

- **YES** → `oic_release_workspace {instance, code, version, project?, wsid}`: DELETEs that
  workspace (the clean path) and forgets it in this conversation. Commit any pending changes BEFORE
  releasing. Lost the wsid (crash / lost conversation)? That is `oic_unlock`, not release.
- **NO / keep working** → leave it locked and continue.

After a release the wsid is gone from this conversation and this integration's blueprint cache is
dropped; MORE work = `oic_open_workspace` again explicitly — your OIC identity (token) is untouched.

## Rules
- Lock survives process death (server-side) — a server-held lock outlives the process that took it.
- 423 on open = someone else's lock (or your stale one). Distinguish by briefing/task context. Human designer lock → STOP, report.
- Work in a workspace is INVISIBLE to others (and to `oic_verify`) until commit.
- (Session cadence — start-with-unlock, commit after every chunk, ASK-then-release when done — is the core: instructions.md §Session lifecycle.)
- After committing changes, a human with the designer open sees a STALE canvas — note in your report that the designer must be reloaded.

## Projects
Project-scoped integrations: pass `project` to the same tools (same API, `/projects/{pid}` prefix).
