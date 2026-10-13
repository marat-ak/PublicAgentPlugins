---
name: stage-files
description: Use when creating, editing, or debugging Stage File nodes — operations, schema samples (repeating + namespace rules), consuming a BI Publisher report's output (reportBytes), the payload-boundary field drop, the upstream-build pattern, write-request reads, and payload references. Create/edit goes through the adapter-wizard skill.
---

# Stage File nodes

## Create / edit — via the GENERIC WIZARD (the adapter-wizard skill)
All stagefile creation and schema editing goes through `oic_wizard_*` on `STAGE_FILE_CONNECTION` —
the former `oic_add_stagefile` recipe tool is REMOVED; do not look for it. Facts that apply regardless
of tool:

**Catalog example first.** `oic_catalog_examples {instance, nodeType: "STAGEFILE", operation?}` (or a `sig` such
as `STAGEFILE.write.csv.by-filename` / `STAGEFILE.read.xml.by-fileref`) shows this tenant's working stage-file
nodes: operation, format (opaque/json/xml/csv), by-filename vs by-fileref, the filename/directory/reference
expressions, append flag, and the map feeding a WRITE. Copy the shape, never the prefixes.

A new Stage File is a STAGEFILE node (`sf*`): `oic_wizard_create {…, connection:"STAGE_FILE_CONNECTION",
name, anchor, rpi}` opens the wizard without a node, `oic_wizard_save` creates the node at that anchor.

| Operation (wizard `Operation` combo) | File config | Notes |
|---|---|---|
| Write | Filename + PhysicalDirectory (expression fields) | the server creates an empty request map (TRANSFORMER just before the node) — configure per the maps skill, else the node stays invalid. `Append` checkbox for row-appends. |
| ReadWithOutChunk | Filename + PhysicalDirectory | NO request map |
| ReadWithOutChunk + FileRefProcessingEnabled=`"true"` | FileReferenceName (expression field) | read by file reference; NO request map |

Expression fields take the expression STRING: literals quoted INSIDE it (a filename or directory literal is
written wrapped in quotes within the expression), a payload reference as the PREFIXED path
`oic_expression_tree {…, wsid, anchor, rpi, elementType:"stagefiles"}` returns for the node's spot, a
function call with its `oic_xpath_functions` prefix. The driver adds the label and declares every prefix
the expression uses — never send an object, `::namespacePairs` or `::userFriendlyXpath`. Combo fields
(`Operation`, `FileRefProcessingEnabled`) take one of their `options`, sent as the option itself — `"true"`,
not `true`.
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
After create/edit + save, `oic_get_node {instance, code, version, project?, nodeType:'stagefiles', nodeId}` (or `oic_get_blueprint`) and assert:
1. the node is a STAGEFILE (`sf*`) and `operationName` equals what you requested — the CAF `ui/event`
   firing field MUST be `processed:false` (`processed:true` makes the server silently IGNORE the change →
   e.g. a Write silently becomes Read). The generic driver builds orderOfEvents this way by construction;
   still verify the result.
2. for a write: the request-map TRANSFORMER exists immediately before the stagefile; for a read: none does.
3. an expression field you set is in the archive: `oic_reload_iar`, then the node's `*expr.properties`
   (`READ_FILE_REFERENCEexpr` / `WRITE_FILENAMEexpr` …, the source-material skill) holds your XpathExpression
   with a NamespaceList for its prefixes.
If any fails: DELETE the node, report the failure — do not patch around it.

## Consuming a BI Publisher report's output (`reportBytes`)
A BIP `runReport` returns the report as base64 (`…/runReportResponse/runReportReturn/reportBytes`). To read
its rows, turn the bytes into a FILE and read that file with the report's XML sample. Ranked:
1. **PREFERRED — opaque Write → Read by reference.** (a) A Stage File **Write** with the opaque schema
   (`nxsdSchemaOptionSelect`, upload as the schema file:
   `<schema targetNamespace="http://xmlns.oracle.com/pcbpel/adapter/opaque/" xmlns="http://www.w3.org/2001/XMLSchema"><element name="opaqueElement" type="base64Binary"/></schema>`,
   element `opaqueElement`; Filename/PhysicalDirectory = quoted literals). (b) Its request map writes
   `reportBytes` into `opaqueElement` — a plain `xsl:value-of` of the path (already base64). (c) A Stage File
   **Read** (ReadWithOutChunk, FileRefProcessingEnabled `"true"`) whose FileReferenceName = the Write's
   response file reference (`$<Write>/…:WriteResponse/…:WriteResponse/…:ICSFile/…:FileReference`, path
   copied from `oic_expression_tree` at the read's spot), schema = the report's XML sample
   (`nxsdSchemaOptionsXML`, §Sample XML above). Downstream maps read `$<Read>/…:ReadResponse/…`.
2. **ALTERNATIVE — Read by filename:** the same Write, then a Read with Filename + PhysicalDirectory = the
   Write's literals.
3. **DIRECT — decode inline:** FileReferenceName = `oraext:decodeBase64ToReference(<reportBytes path>)`, or an
   ASSIGNMENT `oraext:decodeBase64ToReference(<reportBytes path>)` into a variable and FileReferenceName =
   `$<variable>`. Fewer nodes; no staged pre-image of the report to inspect.
Paths and prefixes in every step come from the live tools for that node's spot (the maps skill's PREFIX
SOURCE LAW); a tenant integration doing the same gives the shape to copy (instructions.md §Precedent first).

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

AFTER the edit: `oic_commit {instance, code, version, project?, wsid}` → a FRESH lock (release that wsid, then `oic_open_workspace {…, lock:true}` — new wsid) → `oic_set_map_xslt {…, wsid, mapId, validateOnly:true}` on every dependent map
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
  (nsA=`…stagefile/<Name>_REQUEST/types`, nsB=`…cloud/staging/write`, nsC=`…cloud/ics/file/v1/types`; the
  real prefixes are the ones `oic_expression_tree` shows at the node you write).
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
