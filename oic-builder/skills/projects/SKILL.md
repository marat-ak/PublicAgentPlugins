---
name: projects
description: Use when working with OIC projects or making a copy of an integration — listing projects and their integrations; CLONING an integration (oic_clone_integration — a new version of the same integration, or a new integration under a NEW code/name: "clone X as Y", "copy X to a new integration", "duplicate", "save as", "create Y from X"); copying existing integrations into a project (oic_copy_integrations_to_project — by reference, same code/version); importing an uploaded archive; and pointing to the connection copy/import tools for a project's connections.
---

# Projects (grouping integrations under an OIC project)

OIC **projects** are a management grouping; project-scoped integrations live under `…/projects/{projectId}/…`.

## Discover
- `oic_list_projects` → `[{id, name, status, type}]`. The project id is what every project-scoped call takes.
- `oic_list_integrations {scope}` — `scope` is required: a project id lists that project's
  integrations, `"standalone"` the standalone (globally-available) ones, `"all"` both, every item tagged
  with its `project` (null = standalone). `search` = plain-text terms, each one OIC's own server-side
  search (case-insensitive substring of name, code, description AND keywords — not a regex; alternatives
  go in separate terms, merged and tagged `matchedBy`); check code/name before trusting a hit.
  `truncated:true` means a search stopped at `limit` — the list is incomplete. The scope — and every
  later `project` argument — is the user's pinned choice (instructions.md §Integration scope).
- Lookups (DVMs): the list `oic_list_lookups {scope}` takes the same required `scope` (with `"all"`,
  paging is per place). The tools on ONE lookup — `oic_get_lookup` / `oic_create_lookup` /
  `oic_update_lookup` / `oic_delete_lookup` / `oic_clone_lookup` / `oic_lookup_usage` /
  `oic_export_lookup` / `oic_import_lookup {csv, mode:add|replace}` — take `project?`: with it they act
  on `…/projects/{projectId}/lookups`, without it on the top-level lookups.

## Copy existing integrations INTO a project — `oic_copy_integrations_to_project`
The designer's "Add to project" = `POST /projects/{projectId}/integrations/copy`
`{projectCode, integrations:[{code,version,name?,status?,type?}]}` → 204.
- **Copy BY REFERENCE — no export/import.** The source standalone integrations are UNTOUCHED (an ACTIVATED
  source stays activated and running); the project gets independent **CONFIGURED** copies (not activated).
- `projectId` = TARGET project. `projectCode` = the SOURCE project id, or null/omit when the sources are
  standalone (globally available).
- The tool does ONE call per integration by default and returns each result: `204` copied / `409` already
  in the project (safe to re-run — idempotent-ish) / other = error with body. `batch:true` sends them in a
  single call (fails together — avoid unless you want all-or-nothing).
- Typical flow: `oic_list_integrations {scope: <the SOURCE scope — "standalone" or its project id>, search}` → filter (e.g. status ACTIVATED) →
  pass the `{code,version,name}` list to `oic_copy_integrations_to_project {projectId, integrations}` →
  confirm with `oic_list_integrations {scope: <projectId>}`.
- NOT a move and NOT a clone: the copy keeps the same code/version, now under the project (a new version, or
  a copy under a new code/name, is `oic_clone_integration` — below). If a same-code integration already
  exists in the project you get 409 (no overwrite).

## Clone an integration — `oic_clone_integration`
The designer's Clone: a new integration (or version) built from an existing one; the source is untouched.
`oic_clone_integration {instance, code, version, project?, toCode, toVersion?, toName?, description?}` —
`code`/`version`/`project` name the SOURCE, `toCode` picks the mode:
- **New version of the same integration** — `toCode` = `code`. Omit `toVersion` to bump off the highest
  existing version (01.00.0007 → 01.00.0008); the name stays the source's (`toName` is refused). The way
  to iterate on a copy while the current version stays intact.
- **New integration under a new code** — `toCode` ≠ `code`; `toName` AND `toVersion` are required. Take
  code, name and version from the user's request; whatever it leaves open → ASK (AskUserQuestion) — never
  invent a name, never assume a version, never derive the code yourself (offering the designer-style
  identifier of the name — upper case, underscores — as an option is fine).
- **Scope is explicit.** `instance` = the bound tenant. `project` follows the pinned scope choice
  (instructions.md §Integration scope): omitted = the standalone source, given = that project's; the
  clone lands in the same scope. Another tenant or another project is not this tool.
- **Clash = nothing changed.** The target code|version is checked first; if it is taken the call errors
  and the tenant is untouched — report it and ask for another code/version, never retry with one you
  made up.
- **Result check.** The clone is CONFIGURED, not activated (activation is a separate agreement). Confirm
  with `oic_list_integrations {scope: <project, or "standalone">, search: [<toCode>]}` before reporting it done.

## Connections in a project
To give a project its own copies of connections, copy them from standalone (or another project) with
`oic_copy_connections`, or import an uploaded export with `oic_import_connections` — both in the **discovery**
skill (§Exporting, importing and copying connections). An id may exist in a project and standalone at once.

## Import an UPLOADED archive into a tenant — `oic_import_integration`
When the user attaches an `.iar`/`.car`, `oic_import_integration {instance, fileId | file, targetProject?}`
puts it into that tenant (add `targetProject` to land it inside a project). The code|version come from the
archive itself. It is a MUTATION and the only one in this flow:
- If that code|version already exists you get `{state:"clash", existing:{code,version,status}}` and nothing
  was changed. ASK the user (AskUserQuestion) before overwriting — showing the
  `oic_compare_integrations` diff of live-vs-upload first is usually what they want — then re-call with
  `replace:true`, which is irreversible. An ACTIVATED target is refused even then.
- On success the integration is CONFIGURED, not activated, and its connections may be unconfigured in
  this tenant: `oic_verify {instance, code, version}`, and continue with `{code, version}` like any other
  live integration. Activation stays a separate agreement.

## Related (Oracle REST, not yet wrapped as tools)
- Clone a whole project: `POST /projects/{id}/clone`. Update/activate an integration already in a project:
  `POST /projects/{projectId}/integrations/{code%7Cversion}` (X-HTTP-Method-Override: PATCH).
