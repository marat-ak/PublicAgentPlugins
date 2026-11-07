---
name: compare
description: Use when asked what CHANGED / what DIFFERS between two integrations or two versions of one integration (review a new version, audit a copy, explain a regression) — the load-both → summary → drill-by-ref ladder over the local archive cache, and how to explain the result in designer terms.
---

# Comparing integrations

The compare works on the integrations' ARCHIVES (.iar / project .car) held in the local cache — never
on live blueprints. Both sides must be loaded first; the compare itself is cache-only and instant.

Each side is one of two sources:
- **INSTANCE** — an integration loaded into that instance's folder with `oic_load_iar` (a download needs
  that instance signed in; the compare never downloads). Each side names its OWN instance, so the two
  sides may come from DIFFERENT instances (test vs dev1): load each while signed in to it, then compare —
  the compare itself reads the folders and needs no sign-in or re-binding.
- **UPLOADED ARCHIVE** — the file id of the .iar/.car the USER attached, or its file name once it is in
  this conversation. **No load step and no sign-in**: pass the two uploads and the compare fetches and
  caches them itself, then answers. The result names each side's file, code and version — read from the
  archive — so later calls can use the file name.

Two uploads CAN share a file name — the same integration exported from two tenants is
`CODE_VERSION.iar` both times, which is exactly the "test vs dev1" comparison. Both are kept; name
those sides by their file ids (a by-name call then answers with an ambiguity error listing both ids).

So upload↔upload, upload↔instance and instance↔instance (same or different instances) all run through
the same `oic_compare_integrations`; the instance rides inside each instance side. The result's sides
name their instance + path (or file). `oic_compare_detail` needs only the compare and the change ref —
the compare remembers both sides.

## The ladder (always in this order)

1. **Identify both sides explicitly** — an instance side by its instance, code, version and project; an
   uploaded archive by its file id or name. Two versions of one code, two different integrations, the
   same integration in two instances, or an uploaded archive against what is in an instance. Never guess
   a version or an instance: list with `oic_list_integrations` (the pinned scope, searching the code) and
   confirm with the user when several exist.
2. **Load the instance sides** with `oic_load_iar`, each while signed in to its instance — the
   archive-only partial load is exactly what a compare needs (a side you also want to inspect/edit:
   `oic_open_integration` loads its archive too). A side already loaded earlier in the conversation needs
   no reload. An uploaded side needs no load — the compare resolves it. A needs-load answer names the
   instance side still missing (its instance + path) — load it, do not retry blindly. A dead file id errors
   with "re-upload": ask the user to attach it again.
3. **Summary**: `oic_compare_integrations` → the compare, its counts, the project-level facts (name/version
   fields; connections added / removed / rebound) and the changes — ONE row per activity with its OWN
   change: a ref (d1, d2 …), added|removed|modified, the designer path (`GLOBAL_TRY > Scope > Route >
   activity`), the identity on each side and counts of field / file / child changes. Containers changed
   only through a descendant are NOT listed — the path of the descendant says where it sits. Page through
   when the result says more follow.
4. **Drill what matters**: `oic_compare_detail` on a ref → its field diffs and, per changed file,
   structured facts by file kind (mapping, adapter config, wsdl/xsd, lookups, properties…). One file's full
   facts narrow the drill; raw unified line hunks are a LAST RESORT when the facts cannot express the
   change, never the default.
5. **Stale compare**: a stale answer means a side was reloaded/evicted — re-run the summary.

## Explaining the result

- Speak designer language: activity **name + type + where it sits** (path), then WHAT changed in it
  (the fact), then the likely intent/consequence. Never paste +/- text lines or raw XML.
- Order by impact: removed/added activities and connection rebinds first, then mapping target changes
  (a changed `select` on a business field beats a namespace shuffle), then expressions, then cosmetics
  (descriptions, notes). Group many small mapping edits per map.
- The project-level `ARCHIVE_FILES` row holds files owned by no activity (lookups `.dvm`, shared
  schemas); report those as "shared resources", not as an activity.
- A rename (same type, same position, different name/variable) is reported as modified with the
  old → new name — say "renamed", not "removed and added".
- Quote counts from the tool — do not recount from memory. When the user asked a narrow question ("did
  the map to X change?"), drill only that ref and answer it.

## Limits worth stating when relevant

- Ids compare by position + type + name, not by node id: an activity moved to another branch shows as
  removed there and added here.
- Complex maps (templates, for-each-group) may surface a restructure as removed + added targets.
- Cross-instance (test vs dev1): both sides must be loaded, each while signed in to its own instance;
  after that the compare works whatever is signed in. Name each side's instance when you explain the
  result. An uploaded archive belongs to no instance, so it can be compared against any of them.
