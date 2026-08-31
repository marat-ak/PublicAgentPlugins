---
name: maps
description: Use for ANY map (XSLT / TRANSFORMER node) configuration — THE NAMESPACE LAW, the map-builder law (only existing sources/targets), saving with oic_set_map_xslt, validateOnly, the clean-build recipe, adding standalone map nodes, and verifying a map really persisted.
---

# Maps (XSLT / TRANSFORMER nodes)

## THE NAMESPACE LAW (violating this breaks maps silently)
Prefixes are **per-map, server-assigned, and unstable across maps**: the fresh wrapper header numbers
`nsmprN` prefixes in THIS map's upstream-payload order. The same prefix name binds DIFFERENT URIs in
different maps. Therefore:

1. **The prefix table is RETURNED BY THE API — you never derive, guess, or regex-scrape it.**
   `oic_get_map_namespaces {mapId}` → `{namespaces: [{prefix, ns}], registeredSources, target}` — the
   complete table the server assigned for THIS map: every upstream payload, utility and function namespace.
   The designer is a dumb renderer of this table; be the same.
2. To reference a payload/variable: find its namespace URI's entry in `namespaces`, use that prefix.
   (The fresh wrapper header from `oic_get_map_xslt` shows only the in-use subset — the TABLE is the authority.)
3. **WE NEVER GENERATE NAMESPACE DECLARATIONS. NEVER.** Not inline, not at the stylesheet top. The server
   owns declarations and emits them when it saves your doc. If a URI you need has NO entry in the table,
   that payload is not part of this map's model — register it (`extraSources` on save / confirm the payload
   exists upstream), re-run `oic_get_map_namespaces`, use the server's entry. Still absent → STOP and
   report; never invent.
4. NEVER copy prefixes from another map, another integration, an export, documentation, or memory.
5. Table prefixes are PER-WORKSPACE — a relock renumbers them. Re-fetch after any relock; never reuse
   a table across locks.

### URI patterns (for LOCATING the right entry in the table — never for building declarations)
| Payload | URI |
|---|---|
| stagefile root (Write/ReadResponse) | `http://xmlns.oracle.com/cloud/adapter/stagefile/<Name>_REQUEST/types` |
| stagefile inner request-wrapper | `http://xmlns.oracle.com/cloud/adapter/stagefile/<Name>/types` |
| uploaded no-namespace XSD (surrogate) | `http://xmlns.oracle.com/cloud/adapter/nxsd/surrogate/<Name>` |
| FTP invoke | `http://xmlns.oracle.com/cloud/adapter/ftp/<Name>_REQUEST/types` |
| REST invoke root / inner | `http://xmlns.oracle.com/cloud/adapter/REST/<Name>_REQUEST/types` / `…/REST/<Name>/types` |
| ICSFile/FileReference | `http://xmlns.oracle.com/cloud/ics/file/v1/types` |
| stage write response inner | `http://xmlns.oracle.com/cloud/staging/write` |
| schedule (trigger) | `http://www.oracle.com/2014/03/ics/schedule` |

## ⚖ MAP-BUILDER LAW — use ONLY existing sources and existing targets
Every element you read must exist in a registered SOURCE schema; every element you write must exist in
the TARGET schema. Never invent, guess, or carry names over. This is a construction-time discipline the
validator will NOT enforce: `oic_set_map_xslt {validateOnly}` / the save pipeline only check that SOURCE
references resolve and the XSLT is well-formed — a write to a target element absent from the schema
validates clean (`errorsCount:0`) yet is **SILENTLY DROPPED at the adapter boundary** (`rules`/
`targetsMappedCount` count the value-of rules you wrote, not whether they hit real fields). Verify
targets against the schema, not the validator:

1. **Targets — write only names present in the current target schema.** Read it with `oic_iar_schema`
   (endpoint → `[{name,type}]`): REST/stagefile from the wsdl payload; DB adapters from the `*_REQUEST.xsd`
   object model, including columns AND relation collections (a child collection is named after its
   relation and exists only through it). That list is the set of legal target names.
   - **EXCEPTION — opaque/template targets:** when the target is OPAQUE (opaque stagefile write) or the map
     produces the payload from a TEMPLATE/literal body (e.g. a JSON string assembled by the template, not a
     mapped schema), there IS no defined target schema — the existence check does not apply.
     `oic_iar_schema` will be empty/opaque for these; that is expected, not a miss.
2. **Sources — read only names present in a registered source.** Register sources per the NAMESPACE LAW /
   `extraSources`; reference only elements that exist in those source schemas.
3. **Porting from another version / onto a recreated adapter:** names are NOT guaranteed identical — a
   recreated adapter can carry a differently-NAMED relation collection or renamed columns. If any name in
   the source body is ABSENT from the current source/target schema, **STOP and ask** ("X from the source
   is not in the current adapter — it has Y; remap or confirm"). Never map to a name that isn't there;
   never assume a rename silently.
4. After save, confirm the writes land: diff your written target-element set against `oic_iar_schema` for
   that endpoint — zero writes to nonexistent targets (skip for opaque/template targets per the exception).

## Repeating targets — for-each ONLY where the schema repeats
Generate `for-each`/`for-each-group` ONLY for target elements the TARGET schema describes as REPEATING
(unbounded / maxOccurs > 1); never loop into a single-occurrence target. Without a for-each, a
non-repeating target element can still take an xpath that selects a repeated source — but the output then
CONCATENATES the selected values space-separated into that one element (mapper XSLT is 2.0: `value-of` on
a sequence emits it space-separated) instead of producing one element per source item.

## Adding a STANDALONE map node — `oic_list_map_targets` + `oic_add_map`
Most maps are auto-created by an invoke wizard. Add one MANUALLY when: a switch/route branch needs its OWN
map to a shared downstream activity (classic: several routes each building a different payload for the SAME
invoke after the switch — move the auto-map into one route with `oic_move_node`, `oic_add_map` in the
others), or Oracle failed to create the default map.
0. **Find the anchor** with `oic_get_blueprint` — the indented tree shows containment by nesting. To append
   as the LAST activity inside a route/scope/foreach, anchor the CONTAINER id with `rpi:"AT_END"` (NOT the
   last child with BEFORE). Identify a route by its CONTENTS, not by name. Re-run `oic_get_blueprint`
   after to confirm placement.
1. **Find the target id** with `oic_list_map_targets {anchor, rpi}` → the feedable targets, each
   `{endpointName, connectionName, applicationId}`. Match by `endpointName`/`connectionName`; take that
   entry's `applicationId`. NEVER guess it or reuse one from another session/capture — list it fresh at the
   anchor. (Same invoke = same `applicationId` across anchors, so several route maps can share one target.)
2. `oic_add_map {anchor, rpi, outputUri:<applicationId>}` → new `m*`, bound to that target. The map ships a
   valid identity xsl — it **verifies CLEAN even empty** (no blueprint error) while emitting no real target fields.
3. Configure it with `oic_set_map_xslt` (NAMESPACE LAW applies) → `oic_commit` for real output.
The target (`outputUri`) is the ONLY binding — several maps may target the same `applicationId` (one per
route). The designer's mapper-open calls (prepare/jetmapper) are the config UI, NOT needed to create the node.

## Configuring a NEW map whose source is a COMPLEX loop variable
A fresh auto-map (from a wizard-built invoke inside a foreach) has NO sources registered. For a SIMPLE
string var, `extraSources` (adapterId:variable UF entry) is enough. For a **complex** loop var (e.g. a var
typed as a repeating group element of an nxsd surrogate), extraSources ALONE fails with JETMAPPER-00324/00057
+ 00329 — the mapper cannot resolve the var's schema from the UF entry. The fix:
1. Find a SIBLING map that already uses the same var type; read its XSLT and copy its `mapSources`
   `<oracle-xsl-mapper:source>` entry for that var VERBATIM (its schema location + rootElement + param),
   swapping in YOUR param name.
2. Build the FULL doc (mode `xslt`, not spliceBody): fetched wrapper + that source entry added to
   mapSources (param name = YOUR var) + your xsl:param + pretty-printed body. Declare in the stylesheet
   tag every prefix your body uses, with URIs from the SERVER table (`oic_get_map_namespaces`) — the
   wrapper header only carries the in-use subset, so a spliced body referencing an undeclared prefix
   dies with JETMAPPER-00324 "Namespace prefix … used".
3. Keep the `extraSources` UF entry too. Result check: `rules>0`, `hasMappings:true`, `warningsCount:0`.
- Running a manual `prepare` alongside the save pipeline can wedge the workspace (`412 Workspace is in
  use`) and even DROP THE LOCK — if it persists, relock and redo uncommitted work.

## Saving a map — `oic_set_map_xslt`
Modes (one of): `xslt` (full doc) | `replace {old,new,all?}` (surgical, applied to freshly fetched doc) |
`spliceBody` (everything after `</oracle-xsl-mapper:schema>`: params + templates + `</xsl:stylesheet>`) |
`validateOnly:true` (re-run validation on the existing doc, no save).
Plus: `extraSources` (register sources), `skipBaseSources:true` (see clean-build recipe below).

## Building a clean map via the tool — verifies WITHOUT a designer re-open
A tool-authored map can persist a nonzero WarningsCount and show "Invalid map/expression" on fresh verify
even with `errorsCount:0` — clearing only when a human re-opens it in the designer. Two independent causes,
both fixed by how you call the tool:

1. **Phantom sources → JETMAPPER-00332.** The tool's generic base source list registers EVERY integration
   variable as an available source. A map that maps from only 1-2 of them gets "unknown source" warnings for
   the rest. **Pass the FULL real source set yourself via `extraSources` and set `skipBaseSources:true`** →
   only prepare's primary (schedule) + your extraSources register — the schema section then matches what the
   designer would build.
2. **Minified body → persistent `WarningsCount:1`.** A COMPACT `spliceBody` (no whitespace between elements,
   e.g. `<a><b><xsl:value-of.../></b></a>`) makes `saveSuccess`/`fetchRules` compute an incomplete rule set
   → 1 warning persists → badge flips. The SAME body **pretty-printed** (newlines + indentation between
   elements, designer style) verifies clean. The cause is the formatting — not `xml:id`, not the filter
   logic. **Always emit indented XSLT.**

Reliable clean build = indented `spliceBody` + `extraSources` = the real sources + `skipBaseSources:true`,
then commit + `oic_verify` (map absent from problems).

The tool runs the FULL required pipeline internally (saveSourceCode → tree enrichment ×3 → fetchRules →
rich saveSuccess → PATCH transformers). All stages are required for the verdict to persist. Commit separately.

Facts the tool relies on (do not fight them):
- The schema section (`oracle-xsl-mapper:mapSources/mapTargets`) is REGENERATED server-side from the map's registered model. Hand-injecting source entries there is ignored.
- An `<xsl:param name="X"/>` referencing an upstream payload NOT registered in the map model gets **silently stripped** on save → `$X` unresolved → map invalid on fresh verify. Registering sources: pass `extraSources` (entry shape in the tool description) — and check the save result's `stateInfo.sourcesReferencedCount` equals the number of params your body actually uses.
- The tool sends the instance's customFunctions catalog automatically (required — without it `oraext:`/`xp20:` calls flip the verdict INVALID).

## Verifying a map REALLY saved
1. Save result: `stateInfo.errorsCount == 0` AND `sourcesReferencedCount` == number of referenced params. `saveMessages` JETMAPPER-00332 WARNINGs are suspect — investigate, don't dismiss.
2. `oic_commit`, then fresh `oic_verify`: no "Invalid map/expression" for this map id.
3. Strongest evidence: `oic_get_map_xslt` refetch — your params/template survived verbatim.
4. Deep check (when asked): export .iar, read the map's `req_*_stateinfo.xml` — `ErrorsCount` and `WarningsCount` must be 0. WarningsCount > 0 flips the badge even with 0 errors.

## Mapper pipeline facts
- The designer's "Validate" runs the SAME pipeline the save tool runs (fetchMappingComponents → fetchXSLDoc
  → trees ×3 → fetchRules → saveSuccess → PATCH transformers). Its extra calls (`isMapDTR`, `isModelDirty`,
  `getInitialTree`) are view-only. Its rule objects add only a cosmetic `display` field (canvas line
  coordinates) — not required for a valid save.
- A fetched doc's `xsl:param` list is NOT proof of what persisted (`fetchXSLDoc` may render params per
  session context rather than return the raw stored file); the `.iar` export's `req_*.xsl` is the stored truth.

## If a map stays flagged after a clean re-save
- Hand-authored map with persisted `WarningsCount:1` → usually the MINIFIED-body cause; indent the body
  (clean-build recipe above).
- Ported map that stays flagged after clean re-saves → usually body prefixes carried from the source
  integration colliding with fresh-header bindings (the NAMESPACE LAW); rebuild the body law-compliant
  (the port-map skill).
- Still flagged after a law-compliant, indented re-save with trimmed sources → report it as unresolved;
  do not loop retries.

⚠ LATENT-DEBT pattern: a map can be CLEAN yet carry INLINE xmlns declarations on body elements —
violating the law but passing validation so far. Treat these as time bombs: any regeneration or dependency
change may flip them invalid. If you touch one for any reason, rebuild its body law-compliant while you are
there, and note it in your report.

## The `fn:` law — XPath 1.0 core vs 2.0 (HOME; other skills cross-ref here)
The mapper (this skill) emits XSLT and runs full XPath **2.0 bare**. Every OTHER expression field —
blueprint ASSIGNMENT, ROUTER/route condition, FOR, STITCH from/to, NOTIFICATION — runs the XPath **1.0
core** engine (OIC is a BPEL engine): 1.0 core functions run bare, but any 2.0 function needs a prefix —
W3C `fn:` with `fn`=`http://www.w3.org/2005/xpath-functions` declared, or Oracle `xp20:`/`oraext:` (from
`oic_xpath_functions`) — else the engine errors "Could not find function"
(e.g. `fn:ends-with(fn:lower-case($x/ns:f),'<ext>')`). No API declares the version; `oic_xpath_functions`
lists only Oracle/custom libs, never the standard funcs. (In blueprint expression fields the `namespaces`
array prefix names are FREE, unlike a map's server-assigned prefixes above.)
