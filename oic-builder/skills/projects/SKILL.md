---
name: projects
description: Use when working with OIC projects — listing projects and their integrations, and copying existing integrations into a project (oic_copy_integrations_to_project — by reference, no export/import).
---

# Projects (grouping integrations under an OIC project)

OIC **projects** are a management grouping; project-scoped integrations live under `…/projects/{projectId}/…`.

## Discover
- `oic_list_projects` → `[{id, name, status, type}]`. The project id is what every project-scoped call takes.
- `oic_list_integrations {project}` lists a project's integrations; without `project` it lists standalone
  (globally-available) ones. `codeFilter` is a regex on the code.

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
- Typical flow: `oic_list_integrations {codeFilter}` → filter (e.g. status ACTIVATED) → pass the
  `{code,version,name}` list to `oic_copy_integrations_to_project {projectId, integrations}` → confirm with
  `oic_list_integrations {project}`.
- NOT a move and NOT a clone-with-rename: the copy keeps the same code/version, now under the project. If a
  same-code integration already exists in the project you get 409 (no overwrite).

## Related (Oracle REST, not yet wrapped as tools)
- Import an .iar into a project: `POST /projects/{projectId}/integrations/archive` (multipart `file`).
- Clone a whole project: `POST /projects/{id}/clone`. Update/activate an integration already in a project:
  `POST /projects/{projectId}/integrations/{code%7Cversion}` (X-HTTP-Method-Override: PATCH).
