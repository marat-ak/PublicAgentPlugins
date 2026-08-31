---
name: adapter-invokes
description: Use when creating or editing an adapter invoke (REST, FTP, ERP Cloud, DB, collocated, OCI-fn) — per-adapter wizard page notes to apply while driving the generic wizard, the edit-over-recreate rule, and downstream payload references.
---

# Adapter invokes

**All invoke endpoints (REST, FTP, ERP Cloud, DB, collocated, OCI-fn, any adapter) are created and edited
through the generic wizard `oic_wizard_*` — see the adapter-wizard skill. The former per-adapter recipe
tools (`oic_add_invoke_rest/ftp/collocated/ocifn`) are REMOVED — do not look for them.** This page =
per-adapter page knowledge to apply WHILE driving the wizard, plus downstream payload references.
Structural nodes are the structural-nodes skill; maps are the maps skill.

Every invoke's wizard auto-creates a request map (TRANSFORMER before the invoke) that YOU must configure
(the maps skill) — an invoke with an unconfigured map is invalid.

## Prefer EDIT over delete+recreate (artifact-conflict rule)
To change an existing invoke, EDIT it in place (`oic_wizard_create {editNodeId, nodeType:'invokes'}`).
NEVER churn delete→create of the same invoke in one workspace — it orphans wizard artifacts → later
PATCH 500 (Cache null / ICS-18122) or subsequent creates 400. If you truly must delete: delete +
`oic_commit`, then rebuild on a FRESH lock.

## Per-adapter page notes (apply while walking the wizard)
- **REST** (`connection` = your REST adapter connection id): welcome page — `resourceURI`, `httpVerb` (both
  `hasEvent`), request/response checkboxes. Request/response SAMPLE is a `fileBrowserObject`
  (`inputContentRequest` / `inputContentResponse`) → upload via `oic_wizard_file`; element combo =
  `request-wrapper` / `response-wrapper`. Downstream response payload:
  `$<Name>/nsA:executeResponse/nsB:response-wrapper/…` (nsA=`…REST/<Name>_REQUEST/types`, nsB=`…REST/<Name>/types`).
- **FTP**: operation combo WriteFile|MoveFile|ListFile|ReadFile. WriteFile/MoveFile put file names/dirs in
  the AUTO-MAP, not the wizard (WriteFile: OutboundFTPHeaderType fileName+directory + ICSFile/FileReference;
  MoveFile: FileMoveRequest directory/filename/targetDirectory/targetFilename). ListFile takes
  directory+includeFiles in-wizard.
- **Collocated (Local Integration)**: pick the target integration; the operation page is submitted with
  the operation combo left UNSELECTED — selecting any value binds the WRONG operation.
- **OCI Function**: region → compartment → application → function are CHAINED `hasEvent` parents — set
  each via `oic_wizard_event` and re-read before the next (options don't exist until the parent's event
  fires). Request = JSON sample; response = binary.
- **ERP Cloud / HCM / other Fusion adapters**: no per-adapter notes exist — drive the generic wizard as
  designed: read each page's fields/options from the LIVE response, fire `hasEvent` parents first, fill
  required fields, `generate` + `save`. First build on an adapter without notes: apply the result check +
  snapshot vs a reference node (the verification skill) and note in your report that the recipe is
  round-trip unverified until proven.

## Result check (after create/edit + map config + commit)
Invoke id in tree at the expected position + auto-map exists + fresh `oic_verify` clean for both ids
(verify discipline: the verification skill).
Abandoning a wizard without generate+save → `oic_wizard_cancel` (see the adapter-wizard skill).
