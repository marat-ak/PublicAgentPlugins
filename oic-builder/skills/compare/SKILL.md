---
name: compare
description: Use when asked what CHANGED / what DIFFERS between two integrations or two versions of one integration (review a new version, audit a copy, explain a regression) — the load-both → summary → drill-by-ref ladder over the local archive cache, and how to explain the result in designer terms.
---

# Comparing integrations

The compare works on the integrations' ARCHIVES (.iar / project .car) held in the local cache — never
on live blueprints. Both sides must be loaded first; the compare itself is cache-only and instant.

Each side is one of two sources:
- **LIVE** `{code, version, project?}` — must be loaded first with
  `oic_load_iar {instance, code, version, project?}` (a tenant download is never triggered from the
  compare). Live sides must live in the SAME instance.
- **UPLOADED ARCHIVE** `{fileId}` (the id of the .iar/.car the USER attached) or `{file}` (its file
  name once it is in this conversation). **No load step and no sign-in**: pass the two fileIds and the
  compare fetches and caches them itself, then answers. The result names each side's `file`, `code` and
  `version` — read from the archive — so later calls can use `{file}`.

Two uploads CAN share a file name — the same integration exported from two tenants is
`CODE_VERSION.iar` both times, which is exactly the "test vs dev1" comparison. Both are kept; name
those sides by `{fileId}` (a by-name call then answers with an ambiguity error listing both ids).

So upload↔upload, upload↔live and live↔live all run through the same `oic_compare_integrations`. Pass
`instance` only when a side is live. `oic_compare_detail {compareId, ref}` needs nothing else — the
compare remembers both sides.

## The ladder (always in this order)

1. **Identify both sides explicitly** — `{code, version, project?}` for a live one, `{fileId}`/`{file}`
   for an uploaded archive. Two versions of one code, two different integrations, or an uploaded archive
   against what is live. Never guess a version: list with `oic_list_integrations {codeFilter}` and
   confirm with the user when several exist.
2. **Load the LIVE sides** with `oic_load_iar {instance, code, version, project?}` (an uploaded side
   needs no load — the compare resolves it). A `needs-load` answer names the live side still missing —
   load it, do not retry blindly. A dead fileId errors with "re-upload": ask the user to attach it again.
3. **Summary**: `oic_compare_integrations {left, right}` (+ `instance` when a side is live) → `compareId`, `counts`, `project`
   (name/version fields; connections added / removed / rebound) and `changes[]` — ONE row per activity
   with its OWN change: `ref` (d1, d2 …), `status` added|removed|modified, the designer `path`
   (`GLOBAL_TRY > Scope > Route > activity`), the identity on each side `{id, type, name}` and counts
   of field / file / child changes. Containers changed only through a descendant are NOT listed — the
   `path` of the descendant says where it sits. Paginate with `offset/limit` when `next` is present.
4. **Drill what matters**: `oic_compare_detail {compareId, ref}` → `fieldDiffs` (name, variable,
   expression XPath/text, connection, endpoint…) + per changed file structured `facts` by `kind`:
   - `mapping` (.xsl): `targetsAdded / targetsRemoved / selectChanged {target, old, new} /
     contextChanged (for-each / if / when ancestry) / variables / sourcesChanged / targetSchemaChanged`.
   - `adapterConfig` (.jca): property `changed/added/removed`; `RequestSample/ResponseSample` as JSON
     key paths.
   - `wsdl` / `xsd`: `elements {added, removed, typeChanged}`, `operations`, `addresses`.
   - `dvm` (lookups): `columns`, `rows {added, removed, changed}` keyed by the first column.
   - `expr` / `properties` / `nxsd` / `json`: key-level old → new; `xml`: element/attribute entries.
   - `other` or a parse error: line counts only (`addedLines/removedLines`).
   `file=<path>` narrows to one file; `raw:true` (with `file`) returns unified line hunks — a LAST
   RESORT when the facts cannot express the change, never the default.
5. **Stale compare**: a `stale` answer means a side was reloaded/evicted — re-run the summary.

## Explaining the result

- Speak designer language: activity **name + type + where it sits** (`path`), then WHAT changed in it
  (the fact), then the likely intent/consequence. Never paste +/- text lines or raw XML.
- Order by impact: removed/added activities and connection rebinds first, then mapping target changes
  (a changed `select` on a business field beats a namespace shuffle), then expressions, then cosmetics
  (descriptions, notes). Group many small mapping edits per map.
- The project-level `ARCHIVE_FILES` row holds files owned by no activity (lookups `.dvm`, shared
  schemas); report those as "shared resources", not as an activity.
- A rename (same type, same position, different name/variable) is reported as `modified` with the
  old → new name — say "renamed", not "removed and added".
- Quote counts from the tool (`counts`, `total`) — do not recount from memory. When the user asked a
  narrow question ("did the map to X change?"), drill only that ref and answer it.

## Limits worth stating when relevant

- Ids compare by position + type + name, not by node id: an activity moved to another branch shows as
  removed there and added here.
- Complex maps (templates, for-each-group) may surface a restructure as removed + added targets.
- Cross-instance compare (test vs dev1) is not available — LIVE sides must be in the bound instance. An
  uploaded archive belongs to no instance, so it can be compared against either one.
