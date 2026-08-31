---
name: stage-files
description: Use when creating, editing, or debugging Stage File nodes — operations, schema samples (repeating + namespace rules), the payload-boundary field drop, the upstream-build pattern, write-request reads, and payload references. Create/edit goes through the adapter-wizard skill.
---

# Stage File nodes

## Create / edit — via the GENERIC WIZARD (the adapter-wizard skill)
All stagefile creation and schema editing goes through `oic_wizard_*` on `STAGE_FILE_CONNECTION` —
the former `oic_add_stagefile` recipe tool is REMOVED; do not look for it. Facts that apply regardless
of tool:

| Operation (wizard `Operation` combo) | File config | Notes |
|---|---|---|
| Write | Filename + PhysicalDirectory (expression fields) | WRITE gets an auto-created empty request map (TRANSFORMER just before the node) — configure per the maps skill, else the node stays invalid. `Append` checkbox for row-appends. |
| ReadWithOutChunk | Filename + PhysicalDirectory | no request map |
| ReadWithOutChunk + FileRefProcessingEnabled=true | FileReferenceName (expression field) | read by file reference; no request map |

Expression fields: literals are quoted INSIDE the expression string (a filename or directory literal is
written wrapped in quotes within the expression); variables plain (`$<variableName>`); `namespacePairs`
= the prefix→URI pairs the expression uses.
Schema page (`nxsdSchemaOptions`): `nxsdSchemaOptionsJSON`/`XML` = sample-derived (upload via
`oic_wizard_file`; JSON root element = `request-wrapper`); `nxsdSchemaOptionSelect` = upload XSD (opaque
uses the fixed opaque XSD); `nxsdSchemaOptionsCreate` = CSV wizard (delimited/nxsd).

### Sample XML must SHOW repeating + carry the namespace
The `xml` kind INFERS the schema from your sample, so the sample must demonstrate two things or the schema
is wrong:
1. **Repeating nodes** — include **≥2** instances of any element that will repeat. One
   instance → the designer infers `maxOccurs=1` (single) → **no for-each allowed** over it, and a map writing
   multiple fails. This is silent: the stagefile builds fine, the breakage shows only when you loop/verify.
2. **The target namespace** — declare `xmlns="<the ns you want>"` on the root of the sample. A no-namespace
   sample gets a generated **surrogate** ns (`…/nxsd/surrogate/<Name>`). If downstream code already
   references the ORIGINAL element type, the surrogate ns breaks EVERY consumer (maps included). Putting
   the ORIGINAL namespace on the sample makes the write schema reuse it → the loop variable keeps its
   type → **zero cascade**.

## MANDATORY result check (known silent failure)
After create/edit + save, `oic_get_node stagefiles/<id>` (or `oic_get_blueprint`) and assert:
1. `operationName` equals what you requested — the CAF `ui/event` firing field MUST be `processed:false`
   (`processed:true` makes the server silently IGNORE the change → e.g. a Write silently becomes Read).
   The generic driver builds orderOfEvents this way by construction; still verify the result.
2. for write: the auto-map TRANSFORMER exists immediately before the stagefile.
If either fails: DELETE the node, report the failure — do not patch around it.

## Change schema in place — wizard resume is THE path (the former `oic_change_stagefile_schema` tool is REMOVED)
A stagefile's file bindings (the `Filename` expression, the read-fileref `FileReferenceName`
expression, the directory) are NOT in `oic_get_node` or the blueprint dump, and NOT in
the `.jca`. They live in TWO places only: the `.iar`'s `*expr.properties` (`WRITE_FILENAMEexpr` /
`WRITE_DIRNAMEexpr` / `READ_FILE_REFERENCEexpr` — see the source-material skill) and a RESUMED wizard
session. ⚠ Do not grep the .iar for the field name ("FileReferenceName") — the value files are named by
ROLE; a name-grep finds nothing and falsely suggests the binding is unrecoverable.

- **The path**: a schema change in place = resume the wizard on the node (`editNodeId`,
  `nodeType:'stagefiles'`, `connection:'STAGE_FILE_CONNECTION'`) and change only the schema. Read the
  CURRENT sample from the page's own file field `value` (base64 — no .iar needed), splice, upload. Bindings
  (Filename/Append/FileRef) survive by construction; walk it per the adapter-wizard skill.

AFTER the edit: commit → FRESH lock → `oic_set_map_xslt {validateOnly:true}` on every dependent map
(stale-error fix), then commit again.

## Payload fields DIE at every schema boundary (debugging rule)
Every stage-file write, stage-file read and REST-invoke request validates against ITS OWN schema and
**silently drops fields the schema doesn't declare** — no error, no warning. Consequences:
- Adding a field to a flowing payload means regenerating EVERY schema boundary on its path
  (e.g. tmp-write → append-write → readback → REST request = 4 regens + the map that fills it).
  Map work alone changes nothing if a downstream schema drops the field.
- When data is missing at runtime but maps look right: diff each boundary's schema
  (`element name=` list in its wsdl) against what the upstream map emits — suspect SCHEMAS, not maps.

## Pattern: build payload content UPSTREAM; keep the final map a blind copy
When an invoke's request is assembled from a staged payload file, put ALL content logic (new structures,
conditionals) in the maps that BUILD the staged payload, and leave the invoke's request map a passthrough
(`copy-of`). Two wins: the staged file on SFTP/stage is a truthful pre-image of the API call (debuggable),
and the invoke map never needs touching when content evolves — only schemas widen.

## Payload references
- Write response file ref: `$<Name>/nsA:WriteResponse/nsB:WriteResponse/nsC:ICSFile/nsC:FileReference`
  (nsA=`…stagefile/<Name>_REQUEST/types`, nsB=`…cloud/staging/write`, nsC=`…cloud/ics/file/v1/types`).
- A write stagefile's REQUEST payload is readable downstream as `$<Name>_REQUEST/…Write/…request-wrapper/…`.

## A WRITE request already holds the written data — read-after-write is usually redundant
Every write operation's REQUEST payload contains EXACTLY what was written, in the write's defined form:
- **structured schema** (json/xml/nxsd) → the whole structure, referenceable field-by-field downstream as
  `$<Name>_REQUEST/…:Write/…:<root>/…:<field>`;
- **opaque** → the base64 you wrote.
So to transform/filter a payload with a MAP (or with a STITCH — XPath 2.0 via the `fn:` prefix, the maps
skill §the `fn:` law) and then iterate the result, WRITE it and loop/count the write REQUEST directly:
1. WRITE stagefile whose schema models the target shape; its auto-request-map does the filtering/reshaping.
2. Loop / count over `$<Name>_REQUEST/…/repeatingElem`.
The ONLY reason to add a READ right after a WRITE is a **format switch** — you wrote in one form and need the
other (wrote opaque/base64, want structured rows; or wrote structured, want raw bytes). Same-form read-back
is pure waste (a node + an FTP/stage round-trip).

### Cascade caveat
A write schema gets its OWN target namespace (`…/nxsd/surrogate/<Name>`). If you repoint an existing loop to
the write request, the loop variable's TYPE changes namespace — and EVERY downstream expression referencing
it breaks, not just assignments: ASSIGNMENTs (cheap, XPath-1.0 PATCH) **and every MAP that consumes the loop
var** (each needs its XSLT re-namespaced + re-registered — expensive, risky). Before choosing write-request
looping over an existing loop, grep the loop var across BOTH blueprint (assignments/routes) AND map XSLTs in
the `.iar`; if maps consume it, prefer a STITCH Append into a same-typed global var — it keeps the original
namespace (0 cascade) AND can still filter with XPath 2.0 functions (the maps skill §the `fn:` law).
The stagefile route is only needed when you must RESHAPE into a genuinely different schema, not merely filter.

### Expression functions — `fn:` prefix for XPath 2.0
The STITCH from/to and route conditions used here run XPath 1.0 core; 2.0 functions need the `fn:` prefix
(the maps skill §the `fn:` law) — that is what lets a STITCH filter by extension without a 1.0
`translate`/`substring` hack.
