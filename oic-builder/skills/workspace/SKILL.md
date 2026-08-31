---
name: workspace
description: Use when opening, committing, unlocking, or verifying an OIC integration workspace — oic_open_workspace / oic_commit / oic_unlock / oic_verify semantics, read-only and concurrent workspaces, 423 lock conflicts, project-scoped calls.
---

# Workspace lifecycle

## Tools
- `oic_open_workspace {code, version, lock:true|false}` → `{wsid, locked}`. `lock:false` = read-only open (safe for inspection). Every OPEN in a new process mints a NEW wsid.
- `oic_commit` → persists the workspace draft to the integration. Releases nothing; you can keep working.
- `oic_unlock {code?, version?}` → force-releases the edit lock. 200 = released, 412 = wasn't locked (fine).
- `oic_verify {code?, version?}` → opens a FRESH workspace and returns `{hasErrors, hasWarnings, problems[]}` — the authoritative validation verdict. Problems carry the node `id` when node-specific.
- `oic_open_workspace {…, setContext:false}` + read tools (`oic_get_blueprint`, `oic_get_node`, `oic_dump_blueprint`, `oic_get_map_xslt`, `oic_get_map_namespaces`) accepting `{wsid, code, version}` → CONCURRENT read-only workspaces on different integrations without disturbing the current edit context (the server holds N workspaces per session; only edit locks are exclusive). Use for cross-integration inspection mid-build.

## Rules
- Lock survives process death (server-side) — a server-held lock outlives the process that took it.
- 423 on open = someone else's lock (or your stale one). Distinguish by briefing/task context. Human designer lock → STOP, report.
- Work in a workspace is INVISIBLE to others (and to `oic_verify`) until commit.
- (Session cadence — start-with-unlock, commit after every chunk, unlock when done — is the core: instructions.md §Session lifecycle.)
- After committing changes, a human with the designer open sees a STALE canvas — note in your report that the designer must be reloaded.

## Projects
Project-scoped integrations: pass `project` to the same tools (same API, `/projects/{pid}` prefix).
