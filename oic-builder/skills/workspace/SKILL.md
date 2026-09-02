---
name: workspace
description: Use when opening, committing, unlocking, verifying, or releasing an OIC integration workspace — oic_open_workspace / oic_commit / oic_unlock / oic_verify / oic_release_workspace semantics, the lock rule (read vs edit), read-only and concurrent workspaces, 423 lock conflicts, release-on-done, project-scoped calls.
---

# Workspace lifecycle

## The lock rule — open correctly the FIRST time
A workspace id is required for BOTH reading a blueprint and editing; the LOCK differs by intent, so
choose it up front (opening the wrong way wastes a throwaway open):

- **READ a blueprint / inspect** (`oic_get_blueprint`, `oic_get_node`, `oic_get_map_xslt`, …): the
  wsid may be opened **WITHOUT lock** — `oic_open_workspace {code, version, lock:false}`. Read-only,
  never contends with a human designer.
- **Any EDIT / mutation** (`oic_set_map_xslt`, structural-node adds, assignments, wizard save, delete
  — anything that changes the integration): requires a wsid opened **WITH lock** —
  `oic_open_workspace {code, version, lock:true}`. A `lock:false` wsid CANNOT edit.

So: open `lock:false` for read-only work; open (or re-open) `lock:true` BEFORE the first edit. If you
inspected read-only and then decide to edit, re-open with `lock:true`.

## Tools
- `oic_open_workspace {code, version, lock:true|false}` → `{wsid, locked}`. `lock:false` = read-only open (safe for inspection); `lock:true` = editable (see the lock rule above). Every OPEN in a new process mints a NEW wsid.
- `oic_commit` → persists the workspace draft to the integration. Releases nothing; you can keep working.
- `oic_unlock {code?, version?}` → force-releases the edit lock. 200 = released, 412 = wasn't locked (fine). This is for clearing your OWN stale lock at the START of a session (instructions.md §Session lifecycle step 2) — to release WHEN DONE, see "Releasing when done" below.
- `oic_verify {code?, version?}` → opens a FRESH workspace and returns `{hasErrors, hasWarnings, problems[]}` — the authoritative validation verdict. Problems carry the node `id` when node-specific.
- `oic_release_workspace {code?, version?, wsid?}` → releases the integration for a human (see "Releasing when done").
- `oic_open_workspace {…, setContext:false}` + read tools (`oic_get_blueprint`, `oic_get_node`, `oic_dump_blueprint`, `oic_get_map_xslt`, `oic_get_map_namespaces`) accepting `{wsid, code, version}` → CONCURRENT read-only workspaces on different integrations without disturbing the current edit context (the server holds N workspaces per session; only edit locks are exclusive). Use for cross-integration inspection mid-build.

## Releasing when done (ASK — never automatic)
When you judge the work DONE (all changes committed and verified), do NOT release on your own. First
**ASK the user** via the **AskUserQuestion** tool whether to release the integration back so a human
can open it in the designer. Branch on the answer:

- **YES** → call `oic_release_workspace {code, version}`. It mirrors Oracle's own model: if the
  workspace id is KNOWN (this session opened it and tracks it — the normal case) it DELETEs the
  workspace (the clean path); if the wsid is UNKNOWN (a crash / lost session) it UNLOCKs instead (you
  can unlock only your OWN lock; an admin can unlock any). Commit any pending changes BEFORE releasing.
- **NO / keep working** → leave it locked and continue.

After a release the session's workspace binding + this integration's blueprint cache reset, so if the
user then asks for MORE work the next workspace-scoped call opens a fresh workspace automatically —
your OIC identity (token) is untouched. This is distinct from the start-of-session `oic_unlock` that
clears your own stale lock.

## Rules
- Lock survives process death (server-side) — a server-held lock outlives the process that took it.
- 423 on open = someone else's lock (or your stale one). Distinguish by briefing/task context. Human designer lock → STOP, report.
- Work in a workspace is INVISIBLE to others (and to `oic_verify`) until commit.
- (Session cadence — start-with-unlock, commit after every chunk, unlock when done — is the core: instructions.md §Session lifecycle.)
- After committing changes, a human with the designer open sees a STALE canvas — note in your report that the designer must be reloaded.

## Projects
Project-scoped integrations: pass `project` to the same tools (same API, `/projects/{pid}` prefix).
