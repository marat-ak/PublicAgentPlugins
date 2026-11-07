---
name: source-material
description: Use when a task says "replicate X from integration Y" or you must read an existing integration's artifacts — .iar exports (schemas, filenames, samples via the oic_iar_* tools), oic_describe_activity, live read-only blueprints, and jca configs.
---

# Reading source material

When a task says "replicate X from integration Y", the source of truth is Y's live API + its .iar export.
Never reconstruct payloads/schemas/samples from memory or documentation.

## First choice: `oic_describe_activity`
For a STAGEFILE or INVOKE/RECEIVE node, this returns the parsed config directly — no hand-reading the
`.iar`: a stage file's operation, format, delimiter/header and by-filename vs by-reference; a REST invoke's
verb, URI, parameters, media type and headers; a Fusion ERP/HCM invoke's kind (object CRUD, BIP report,
ESS job, bulk import, UCM upload, data extract) and object; an FTP invoke's operation and file/directory
modes; a DB invoke's operation kind. Read-only. Use it to learn what an existing node does. Fall back to
the raw-artifact tables below only for what the tool does not return (exact schema sample text, map XSLT).

## The .iar archive — loaded by `oic_open_integration` (single: `oic_load_iar`)
`oic_open_integration` (the default one-call start — **workspace** skill) loads the integration archive
into this conversation's folder of that instance (at the integration's path) together with the
workspace + blueprint; `oic_load_iar` is the archive-only partial load (no file, no disk, nothing to
unzip). Every reader below then works cache-only over it, naming the same integration — the instance
names the folder, whatever is signed in now. Re-download after an edit with `oic_reload_iar`.

Zip layout INSIDE the archive (what the readers parse — for orientation, not for you to open):

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
- `oic_iar_samples` — the verbatim REST samples the user uploaded (THE definitive source for editing a
  REST payload, the adapter-wizard skill § SAMPLE FIDELITY LAW) + the stage files' nxsd samples.
- `oic_iar_schema` — per endpoint, the ordered payload element list (payload `xsd:` elements;
  adapter-envelope `xs:` excluded).
- `oic_iar_schema_diff` — per endpoint, what was added / removed / retyped between the schema loaded NOW
  and the one captured at the PREVIOUS load — the fidelity proof. Sequence: `oic_load_iar` (baseline) →
  edit the integration → `oic_reload_iar` (stashes the baseline) → `oic_iar_schema_diff`.
The generated `*_REQUEST.wsdl` is a LOSSY derivation of the sample (types/order/arrays) — never rebuild a
payload from it; use `oic_iar_samples`. (These tools run the sample/schema extraction server-side, so no
script is needed.)

## Live blueprint of the source — read-only workspace
`oic_open_integration` without the lock (= archive + read-only workspace + blueprint in one call — the
singles `oic_open_workspace` + `oic_load_blueprint` only for a partial load), then `oic_get_blueprint` /
`oic_get_node` / `oic_blueprint_view`.
Gives: node tree + ids, route `expressionXpath` (conditions), assignment expressions+namespaces, foreach
xpaths, notification fields, invoke connection ids. Blueprint node reads are the write-shape reference.
Copying any of it: namespace URIs carry over, prefixes never do (the maps skill, PREFIX SOURCE LAW).

## Correlating
`refUri: "processor_N"` on a blueprint node ↔ `resources/processor_N/` in the .iar. Auto-map of an
invoke/stagefile lives in its own processor (the TRANSFORMER's refUri).
