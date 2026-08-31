---
name: source-material
description: Use when a task says "replicate X from integration Y" or you must read an existing integration's artifacts — .iar exports (schemas, filenames, samples via the oic_iar_* tools), oic_describe_activity, live read-only blueprints, and jca configs.
---

# Reading source material

When a task says "replicate X from integration Y", the source of truth is Y's live API + its .iar export.
Never reconstruct payloads/schemas/samples from memory or documentation.

## First choice: `oic_describe_activity {code, version, nodeId}`
For a STAGEFILE or INVOKE/RECEIVE node, this returns the parsed config directly — no hand-reading the
`.iar`. STAGEFILE → `{op, format: opaque|json|xml|csv, delimiter, headerRow, ref}`. INVOKE → REST
`{verb, uri, uriKind, templateParams, queryParams, mediaType, customHeaders}`, Fusion ERP/HCM
`{kind: objectCrud|bipReport|essJob|bulkImport|ucmUpload|dataExtract, object, customObject, crud}`, FTP
`{op, filenameMode, dirMode}`, DB `{opKind}`. Read-only. Use it to learn what an existing node does.
Fall back to the raw-artifact tables below only for what the tool does not return (exact schema sample
text, map XSLT).

## .iar export — `oic_export_iar {code, version, outFile}`
Zip layout: `icspackage/project/<CODE>_<VER>/resources/…`

| Artifact | Where | What you get |
|---|---|---|
| stagefile schema sample | `processor_N/resourcegroup_M/nxsdmetadata.properties` | JSON: `SEL_SCHEMA_FILE_KEY` = EXACT uploaded sample, `SELECT_SCHEMA_ROOT_ELEMENT`, `SELECT_SCHEMA_FILE_NAME`, `nxsdSchemaOptions` (JSON/XML/opaque kind) |
| write stagefile filename/dir | `processor_N/resourcegroup_M/WRITE_FILENAMEexpr.properties`, `WRITE_DIRNAMEexpr.properties` | TextExpression/XpathExpression (variable `$x` vs literal `"x"`) + NamespaceList |
| read-fileref expression | `READ_FILE_REFERENCEexpr.properties` | same shape |
| adapter operation config | `*_REQUEST.jca` | FTP/stagefile: Operation, Append, schema element+ns. REST: HttpVerb, ResourceURI, RequestSample/ResponseSample (HTML-escaped — unescape `&quot;` `&amp;`), media types |
| REST query params | `*_REQUEST.wsdl` → `QueryParameters` complexType | element names = param names |
| map XSLT | `processor_N/resourcegroup_M/req_*.xsl` | full source doc — port per the port-map skill, NEVER splice verbatim |
| map validation state | `req_*_stateinfo.xml` | ErrorsCount / WarningsCount ground truth |

Note: `.properties` files here are JSON (load with utf-8-sig) or `Key : value` lines — inspect before parsing.

⭐ **Read `.iar` contents with the MCP tools — NEVER unzip/regex/python it yourself:**
- `oic_iar_samples` → `endpoints:{<Ref>:{requestSample,responseSample,requestMediaType,responseMediaType}}`
  (verbatim REST samples the user uploaded — THE definitive source for editing a REST payload, the
  adapter-wizard skill § SAMPLE FIDELITY LAW) + `stagefiles:{<name>:{sample,rootElement,schemaType}}`
  (nxsd samples).
- `oic_iar_schema` → per-endpoint ordered payload element list `[{name,type}]` (payload `xsd:` elements;
  adapter-envelope `xs:` excluded).
- `oic_iar_schema_diff {oldFile, newFile|code+version}` → per-endpoint `{added,removed,typeChanged,clean}`
  (the fidelity proof).
The generated `*_REQUEST.wsdl` is a LOSSY derivation of the sample (types/order/arrays) — never rebuild a
payload from it; use `oic_iar_samples`. (These tools run the sample/schema extraction server-side, so no
script is needed.)

## Live blueprint of the source — read-only workspace
`oic_open_workspace {code, version, lock:false}` + `oic_get_blueprint` / `oic_get_node` / `oic_dump_blueprint {outFile}`.
Gives: node tree + ids, route `expressionXpath` (conditions), assignment expressions+namespaces, foreach
xpaths, notification fields, invoke connection ids. Blueprint node reads are the write-shape reference.

## Correlating
`refUri: "processor_N"` on a blueprint node ↔ `resources/processor_N/` in the .iar. Auto-map of an
invoke/stagefile lives in its own processor (the TRANSFORMER's refUri).
