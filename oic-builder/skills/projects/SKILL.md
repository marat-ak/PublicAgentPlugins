---
name: projects
description: Use when working with OIC projects or making a copy of an integration — listing projects and their integrations; CLONING an integration (oic_clone_integration — a new version of the same integration, or a new integration under a NEW code/name: "clone X as Y", "copy X to a new integration", "duplicate", "save as", "create Y from X"); CREATING a new, empty integration (oic_create_integration: "create a new integration", "new scheduled integration", "from scratch"); copying existing integrations into a project (oic_copy_integrations_to_project — by reference, same code/version); importing an uploaded archive; and pointing to the connection copy/import tools for a project's connections.
---

# Projects (grouping integrations under an OIC project)

OIC **projects** are a management grouping; project-scoped integrations live under `…/projects/{projectId}/…`.

## Discover
- Catalog first: `oic_catalog_search` restricted to projects (or searching inside one project) answers
  "which project holds …" without a live call — check the catalog's age with `oic_catalog_status`; the live
  list below when it is empty/stale.
- `oic_list_projects` — every project (paged to the end). The project id is what every project-scoped call
  takes.
- `oic_list_integrations` — in the pinned search scope (one project, standalone, or both, every item named
  with its project; none = standalone). Its search is OIC's own server-side search (case-insensitive
  substring of name, code, description AND keywords — not a regex; alternatives go in separate terms);
  check code/name before trusting a hit. A truncated answer means a search stopped at its limit — the list
  is incomplete. The scope — and every later project — is the user's pinned choice (instructions.md
  §Integration scope).
- Lookups (DVMs): `oic_list_lookups` takes the same search scope; the tools on ONE lookup
  (`oic_get_lookup`, `oic_create_lookup`, `oic_update_lookup`, `oic_delete_lookup`, `oic_clone_lookup`,
  `oic_lookup_usage`, `oic_export_lookup`, `oic_import_lookup`) act on a project's lookups when given the
  project, on the top-level lookups without it.

## Copy existing integrations INTO a project — `oic_copy_integrations_to_project`
The designer's "Add to project" = `POST /projects/{projectId}/integrations/copy`.
- **Copy BY REFERENCE — no export/import.** The source standalone integrations are UNTOUCHED (an ACTIVATED
  source stays activated and running); the project gets independent **CONFIGURED** copies (not activated).
- The target is the project; the source is standalone (globally available) integrations or another
  project's.
- The tool copies ONE integration per call by default and reports each: copied / already in the project
  (safe to re-run — idempotent-ish) / an error with its body. All-or-nothing in a single call exists —
  avoid it unless you want exactly that.
- Typical flow: `oic_list_integrations` in the SOURCE scope (standalone or its project) → filter (e.g.
  status ACTIVATED) → `oic_copy_integrations_to_project` with that list → confirm with
  `oic_list_integrations` in the target project.
- NOT a move and NOT a clone: the copy keeps the same code/version, now under the project (a new version, or
  a copy under a new code/name, is `oic_clone_integration` — below). If a same-code integration already
  exists in the project you get 409 (no overwrite).

## Clone an integration — `oic_clone_integration`
The designer's Clone: a new integration (or version) built from an existing one; the source is untouched.
The source is named by its code, version and project; the TARGET code picks the mode:
- **New version of the same integration** — target code = source code. The version is bumped off the
  highest existing one unless given (01.00.0007 → 01.00.0008); the name stays the source's. The way to
  iterate on a copy while the current version stays intact.
- **New integration under a new code** — the new code needs a name AND a version. Take code, name and
  version from the user's request; whatever it leaves open → ASK (AskUserQuestion) — never invent a name,
  never assume a version, never derive the code yourself (offering the designer-style identifier of the
  name — upper case, underscores — as an option is fine).
- **Scope is explicit.** The instance = the bound tenant. The project follows the pinned scope choice
  (instructions.md §Integration scope): none = the standalone source, a project = that project's; the
  clone lands in the same scope. Another tenant or another project is not this tool.
- **Clash = nothing changed.** The target code|version is checked first; if it is taken the call errors
  and the tenant is untouched — report it and ask for another code/version, never retry with one you
  made up.
- **Result check.** The clone is CONFIGURED, not activated (activation is a separate agreement). Confirm
  it with `oic_list_integrations` (its scope, searching the new code) before reporting it done.

## Create a new, empty integration — `oic_create_integration`
The designer's Create: a new integration with no source (from an existing one = `oic_clone_integration`, from an
uploaded archive = `oic_import_integration`). The kind is App Driven (no trigger, no activities) or
Scheduled (the tenant adds the schedule trigger and a stop).
- **Nothing is defaulted.** Take code, name, version and kind from the user's request; whatever it leaves
  open → ASK (AskUserQuestion) — never invent a name, never assume a version or kind, never derive the code
  yourself (offering the designer-style identifier of the name — upper case, underscores — as an option is fine).
- **Scope is explicit.** The instance = the bound tenant. The project follows the pinned scope choice
  (instructions.md §Integration scope): none = standalone, a project = inside it (that path is not
  live-proven: rely on the result check).
- **Clash = nothing changed.** The target code|version is checked in that scope first; if it is taken the call
  errors and the tenant is untouched — report it and ask for another code/version, never retry with one you
  made up.
- **Result check.** A verified result = the re-read found it. An unverified one = the tenant accepted the
  create but the re-read did not confirm it: NOT done — confirm with `oic_list_integrations` (its scope,
  searching the code) before any next step.
- **What exists after it.** INPROGRESS, never activated (activation is a separate agreement); no workspace
  opened, nothing locked. An App Driven integration with no trigger is a valid state to keep.
- **First trigger of an App Driven flow** → the adapter-wizard skill, after opening it with the lock (the
  result's note names the call).

## Connections in a project
To give a project its own copies of connections, copy them from standalone (or another project) with
`oic_copy_connections`, or import an uploaded export with `oic_import_connections` — both in the **discovery**
skill (§Exporting, importing and copying connections). An id may exist in a project and standalone at once.

## Import an UPLOADED archive into a tenant — `oic_import_integration`
When the user attaches an `.iar`/`.car`, `oic_import_integration` puts it into that tenant (or inside a
project of it). The code|version come from the archive itself. It is a MUTATION and the only one in this
flow:
- If that code|version already exists you get a clash and nothing was changed. ASK the user
  (AskUserQuestion) before overwriting — showing the `oic_compare_integrations` diff of live-vs-upload
  first is usually what they want — then re-call with the replace confirmation, which is irreversible. An
  ACTIVATED target is refused even then.
- On success the integration is CONFIGURED, not activated, and its connections may be unconfigured in
  this tenant: `oic_verify` it, and continue with its code and version like any other live integration.
  Activation stays a separate agreement.

## Related (Oracle REST, not yet wrapped as tools)
- Clone a whole project: `POST /projects/{id}/clone`. Update/activate an integration already in a project:
  `POST /projects/{projectId}/integrations/{code%7Cversion}` (X-HTTP-Method-Override: PATCH).
