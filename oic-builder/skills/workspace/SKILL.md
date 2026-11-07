---
name: workspace
description: Use when opening, committing, unlocking, verifying, or releasing an OIC integration workspace — oic_open_integration (the one-call default open) / oic_open_workspace / oic_commit / oic_unlock / oic_verify / oic_release_workspace, the lock rule (read vs edit), read-only and concurrent opens, the lock upgrade, 423 lock conflicts, release-on-done, project-scoped calls.
---

# Workspace lifecycle

There is no implicit workspace: every workspace call names its integration and the wsid opened for it
in THIS conversation (instructions.md §Session lifecycle).

## Open with ONE call — `oic_open_integration`
`oic_open_integration` loads the archive, opens the workspace and loads the blueprint in a single
round-trip — it IS `oic_load_iar` + `oic_open_workspace` + `oic_load_blueprint` (same handlers, same
caches, same registration). This is the DEFAULT way to start on an integration. The single tools — or
the one call with parts skipped — are for a PARTIAL load only (e.g. loading the blueprint on the wsid
already registered for the integration). Parts fail independently; an opened wsid is always reported —
read the whole result.

## The lock rule — open correctly the FIRST time
A workspace is required for BOTH reading a blueprint and editing; the LOCK differs by intent, so choose
it up front (opening the wrong way wastes a throwaway open):

- **READ a blueprint / inspect** (`oic_get_blueprint`, `oic_get_node`, `oic_get_map_xslt`, …): open
  **WITHOUT the lock** (the default). Read-only, never contends with a human designer.
- **Any EDIT / mutation** (`oic_set_map_xslt`, structural-node adds, assignments, wizard save, delete —
  anything that changes the integration): requires a workspace opened **WITH the lock**. A workspace
  opened without it CANNOT edit.

So: open without the lock for read-only work; open (or re-open) with the lock BEFORE the first edit. If
you inspected read-only and then decide to edit, release that wsid and open again with the lock (§Lock
upgrade).

## Tools
- `oic_open_integration` — the one-call default (above). Same open semantics as `oic_open_workspace`
  (a second open of an already-open integration is an ERROR: reuse its wsid).
- `oic_open_workspace` — the single open, for a partial load (lock upgrade, re-open after release).
  Every open mints a NEW wsid. Opening an integration that is already open in this conversation is an
  ERROR (reuse the registered wsid, or release it first). You may hold several integrations open at
  once — every call names which. A workspace belongs to the signed-in OIC user: after switching user it
  is not visible (switch back to reach it); what you loaded stays readable in the instance folder.
- `oic_commit` — persists the workspace draft. Releases nothing; keep working.
- `oic_unlock` — force-releases the edit lock. For clearing your OWN stale lock at the START of a
  session (instructions.md §Session lifecycle step 2) and for crash recovery when you have no wsid — to
  release WHEN DONE see "Releasing when done".
- `oic_verify` — opens a FRESH workspace, reports the problems per node, deletes that throwaway. The
  authoritative verdict.
- `oic_release_workspace` — releases the workspace for a human (see "Releasing when done").
- Reads: `oic_load_blueprint` (already done by `oic_open_integration`) and `oic_get_map_namespaces` (a
  LIVE mapper read) need the workspace; `oic_get_blueprint`, `oic_blueprint_view`, `oic_get_node`,
  `oic_get_map_xslt` are cache-only, no workspace. Cross-integration inspection mid-build =
  `oic_open_integration` each integration (without the lock) and name it on every read.

## Lock upgrade
Inspected without the lock and now need to edit? `oic_release_workspace` that wsid, then
`oic_open_workspace` WITH the lock — the server refuses edits on an unlocked workspace and refuses a
second open of the same integration while the first is registered.

## Releasing when done (ASK — never automatic)
When you judge the work DONE (all changes committed and verified), do NOT release on your own. First
**ASK the user** via the **AskUserQuestion** tool whether to release the integration back so a human
can open it in the designer. Branch on the answer:

- **YES** → `oic_release_workspace`: DELETEs that workspace (the clean path) and forgets it in this
  conversation. Commit any pending changes BEFORE releasing. Lost the wsid (crash / lost
  conversation)? That is `oic_unlock`, not release.
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
A project-scoped integration is named with its project on the same tools (the pinned scope —
instructions.md §Integration scope).
