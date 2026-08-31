---
name: adapter-wizard
description: Use for creating or editing ANY adapter endpoint (stagefile, REST, FTP, DB, ERP, collocated, OCI-fn) — the generic CAF wizard (oic_wizard_*) is THE path; the old recipe tools are removed. Echo-delta loop, hasEvent, file upload, SAMPLE FIDELITY LAW, child pages, resume, cancel, session model.
---

# Generic adapter wizard (oic_wizard_*) — THE path for ALL adapter endpoints, create AND edit

**The former per-adapter recipe tools (`oic_add_stagefile`, `oic_add_invoke_rest/ftp/collocated/ocifn`,
`oic_change_stagefile_schema`) are REMOVED from the tool set — do not look for them. Every adapter
endpoint goes through `oic_wizard_*`.** (Structural nodes — label/assignment/router/route/for/scope/
catch/throw/stop/notification/publisher — stay plain blueprint POSTs per the structural-nodes skill;
not wizard territory.)

The CAF wizard (`ui/load|next|previous|event|generate`) is SELF-DESCRIBING: every response returns the
page's fields (name/type/value/options/hasEvent). The driver is a thin echo-delta layer over it — never
hardcode page/field names; read them from the returned page model.

## ONE procedure, two entry variants
Create and edit differ ONLY in the first call. Everything after `oic_wizard_create` returns the first
page is the SAME loop.

| Entry | Call | Pages arrive | Your job per page |
|---|---|---|---|
| **EDIT in place** | `oic_wizard_create {connection, editNodeId, nodeType}` (`nodeType` = segment: `stagefiles`, `invokes`, …) | **pre-filled** with the existing config — incl. file bindings absent from get_node/blueprint/.jca (`Filename`/`FileReferenceName` expressions; otherwise only in `.iar` `*expr.properties`, see the stage-files and source-material skills) | change ONLY your deltas; everything else echoes |
| **NEW endpoint** | `oic_wizard_create {connection, name, anchor, rpi?}` | **server defaults** | fill the required fields (read labels/options from the live page, like a designer user) |

Node-order plumbing is the tool's problem, not yours: invokes/receives get a stub before the wizard;
stagefiles are POSTed at save with the generated artifact. `oic_wizard_save` is the same call either way
(edit = rebind in place; no delete, node id + request map survive, downstream never invalidates).

## The loop (identical for both)
1. Read the returned page: `fields:[{name,type,value,options,hasEvent,required,readOnly}]`.
2. `oic_wizard_event {field, value}` — REQUIRED for any change to a `hasEvent:true` field (parent):
   downstream fields/options are computed server-side by this round-trip. Re-read the returned page
   BEFORE filling dependents; combo options are valid only from the LATEST response.
3. `oic_wizard_file {field?, content, fileName?}` — file/sample upload (`fileBrowserObject`:
   `SCHEMA_FILE_CHOOSER`, REST `inputContentRequest`): raw text in, tool base64s + sends via event, the
   SERVER parses and returns the detected root-element combo. NEVER send file content through next.
4. `oic_wizard_next {fieldValue?}` — commit the page and advance. **No fieldValue = pure echo** (every
   stored value sent back unmodified); pass only non-event deltas. `op:'previous'` goes back.
5. At summary: it shows the SERVER's view of the full config (incl. bindings like Filename/Append) —
   read it as the pre-generate confirmation that nothing was lost/missing.
6. `oic_wizard_generate` → artifactId; `oic_wizard_save`; then `oic_commit` + `oic_verify`.
- `oic_wizard_page {field?}` — introspect without advancing; with `field` = RAW subtree (debug unknown
  object types).

## Field semantics (from the parsed page model)
- `checkboxObject`: `value` is the checkbox ID string — the STATE is `checked` (boolean). The driver
  echoes booleans; never treat `value` as state.
- `expressionBuilderObject` (Filename, FileReferenceName…): state = `expression` (+userFriendlyXpath,
  namespacePairs). Driver echoes all three companions. Literals double-quoted inside the expression.
- `comboBoxObject`: `options` = allowed values; `readOnly:true` fields still echo fine.

## ⚖ SAMPLE FIDELITY LAW (hard rule)
Uploading a sample into a wizard REPLACES that endpoint's ENTIRE schema — a sample rebuilt from memory
or notes silently drops fields and flips types. So for ANY edit of an endpoint whose request payload is
configured ("Configure a request payload for this endpoint" checked) — and same for a configured
response — an existing sample EXISTS, and you MUST start from it verbatim:
1. **Stagefile / XML-sample pages** echo the current sample in the file field's `value` (base64) on
   resume → decode it, splice your fields in, upload. Verbatim + splice, never retype.
2. **REST request/response pages DO NOT echo the stored sample** (`inputContentRequest` /
   `inputContentResponse` come back `null` on resume) — BUT the ORIGINAL sample the user uploaded is
   stored VERBATIM in the endpoint's artifact. Get it with a TOOL, do NOT reconstruct and do NOT script:
   - **`oic_iar_samples`** (defaults to the live integration) → `endpoints:{<Ref>:{requestSample,
     responseSample,…}}`. `requestSample`/`responseSample` are the exact JSON/XML the user uploaded. THAT
     is the source of truth — exactly what the wizard expects re-uploaded.
   - Splice ONLY your intended additions into that verbatim sample (e.g. insert new fields after a named
     sibling), keeping every existing field, value, and type. Upload it.
   - The generated `*_REQUEST.wsdl` is DERIVED from the sample and is LOSSY for this purpose (types/order/
     arrays) — use it only for the post-save diff (§4), never as the rebuild source. Never unzip/regex the
     `.iar` yourself; the `oic_iar_*` tools do it.
3. **Can't obtain the existing payload** (`oic_iar_samples` returns no sample for the endpoint, no
   capture)? **STOP AND ASK THE USER** for the current sample. NEVER generate a payload from memory, notes,
   or field lists.
4. **Mandatory post-save proof — via `oic_iar_schema_diff`, not a script**: `oic_export_iar {outFile:pre.iar}`
   BEFORE the edit; after saving, `oic_iar_schema_diff {oldFile:'pre.iar', code, version}` (diffs the
   before image against the live after). Assert for the edited endpoint: `removed:[]`, `typeChanged:[]`,
   `added:[exactly the intended fields]`, `clean:true` (request AND response). A schema edit without this
   diff is UNVERIFIED regardless of oic_verify being green.

## Adapter payload classes + the "rebuild-by-duplication" workaround
Adapters differ in WHERE the endpoint's field set comes from — this decides who owns "are all fields
present?":
- **Sample-defined** (REST, stagefile): the user supplies a JSON/XML sample; the schema IS that sample.
  The agent has full deterministic control — add/keep fields in place via the SAMPLE FIDELITY LAW above.
- **Metadata-defined** (DB adapter; and any adapter whose schema is derived from a live external source —
  DB table columns, a service's own model — rather than a user-supplied sample): the field set comes from
  outside, NOT from anything the agent uploads. The agent CANNOT reliably force it (see the DB
  KNOWN-ISSUE box below). **Ensuring all required fields are present is the USER's responsibility.**

When a metadata-defined adapter node is MISSING fields, two resolutions:
1. **User fixes in place** — refresh the connection + re-import/regenerate in the designer (preferred —
   ASK the user; for DB adapters this is the ONLY reliable path).
2. **Rebuild-by-duplication** — ONLY when the user EXPLICITLY asks the agent to do it (because the in-place
   edit won't take). Steps:
   a. Create a NEW activity = a duplicate of the current one (same connection + operation), so it picks up
      the complete/current schema.
   b. Repoint EVERY mapping that targeted or sourced the OLD activity to the NEW one (change each map's
      target/source to the new node — author via the maps skill).
   c. Delete the OLD activity.
   d. Verify NOTHING still references the old node; fix any mapping left dangling.
   Commit + fresh `oic_verify` after. NEVER do this silently — it deletes an activity (cascades its maps)
   and is a user-requested workaround, not a default.

## Worked recipes
No separate recipe — both are the loop above. A **schema edit**: resume on `editNodeId`, obtain the current
sample per the SAMPLE FIDELITY LAW, splice, generate/save, then its mandatory `.iar` diff proof (law §4) +
a `oic_set_map_xslt {validateOnly}` refresh on each dependent map. A **new endpoint**: the same loop from
defaults, then configure the auto-created request map (the maps skill) before verify. Commit per node.

## Child pages + `submitchild` (dialogs-within-a-page)
Some wizard pages open a modal SUB-FORM (a "child page") when you click a `linkObject`/`buttonObject`.
The child's fields arrive nested; you drive them, then COMMIT the child with `ui/submitchild` (the dialog's
OK). Mechanics (raw ui/* shape — the driver may not yet wrap every adapter, so these may be `oic_raw_api`):
- Opening a child = `ui/event` on the link/button field; the response's `currentPageId` gains a
  `:CHL:<ChildPageName>` suffix and its `editFields` are the child's fields.
- Child fields are carried inside `pages[0].children[0].invocations["0"]` (pageId = the child id,
  `fieldValue` + `orderOfEvents` for the child's own fields). Children can NEST (`:CHL:A:CHL:B`) — each
  level is another `children[]` wrapper.
- **`ui/submitchild` roots `pages[0].pageId` at the child's PARENT page, not the top page** (a 2-level
  relations dialog submits with `pages[0].pageId = …:CHL:WorkBenchRelationsPage`, not
  `OperationOnTablePage`). A top-rooted submit throws GENERIC-cancel.
- Cascading combos inside a child are `hasEvent` — fire each via `ui/event` (child-nested) and re-read
  before filling dependents, exactly like top-level.
- A 400 mid-dialog often WEDGES the session ("cancel this configuration session and restart") — you must
  `ui/cancel` and re-`ui/load` (re-fetch the node's CURRENT `cloudAdapterFilterId` first; a save rebind
  mints a new one, the old is stale → blank resume).

## Microsoft SQLServer DB adapter (Operation-On-Table)
Plugin `sqlserverdatabase`. Editing the schema (add table columns) is NOT a sample upload — it is a live
metadata RE-IMPORT through child pages, and a USER designer action (drive it live per the KNOWN-ISSUE box below).

### 🛑 KNOWN OIC DB-CONNECTOR ISSUE — ALWAYS ASK THE USER TO REFRESH (do not fight it via API)
Oracle OIC database adapters have KNOWN bugs surfacing schema changes: after DB columns are added, the
adapter's Import/Attributes tree often STILL does not show the new columns (stale connection metadata
cache), and the re-import + relation-rebuild wizard path is unreliable to drive. **When a DB-adapter
schema change is needed (new columns not visible, or a table re-import), STOP and ASK THE USER to REFRESH
the connection in the designer** (Connections → open the DB connection → refresh/re-test so it re-reads DB
metadata; then re-open the invoke and re-import the table). Do NOT attempt to force the column refresh or
recreate relations blindly through `ui/*` — treat the DB adapter object-model edit as a USER designer
action, then resume with the maps once the user confirms the columns are present.

Mechanics below are reference only — for reading what a DB invoke already contains, NOT a drive-it-yourself
recipe (this is a user-designer action):
- Welcome: `DatabaseOpApi='Perform an Operation On a Table'`, `UIDatabaseWelcomeOperationOnTableOptionsFields`
  = Insert/Update/Merge/Select (echo existing).
- **OperationOnTablePage** holds link buttons (dropped by the parsed model — read the RAW page):
  `…ImportTablesBtn` (Add), `…RemoveTablesBtn`, `…RelationsBtn` (Edit relations), `…AttributesBtn` (Edit
  columns). Re-importing a table REFRESHES its column metadata from the live DB.
- **Import child** (`…:CHL:WorkBenchImportTablesPage`): `UIDatabaseWorkBenchSchemaSelect` (hasEvent —
  the DB schema) → `…TablesFilterName` (the table-name filter) → `…TablesFilterButton` (Search, a
  buttonObject event) → a `…TablesShuttle` (shuttleObject) appears with matches → set it to the wanted
  table → `ui/submitchild`. Re-import MERGES (no dup) and the Attributes tree then shows the new columns
  already CHECKED.
- **Attributes child** (`…:CHL:WorkBenchAttributesPage`): `UIDatabaseWorkBenchAttributesTree` (treeObject) —
  `keyName` per column = `<schema>.<table>.<column>`, `nodeChecked`. Submit the full checked key list to
  keep columns.
- ⚖ **DB relations rule**: when a DB adapter endpoint uses MORE THAN ONE table, relations between the
  tables must be defined, each ONE_TO_ONE or ONE_TO_MANY, and every relation MUST be given a name (hard
  rule — the relation's attribute). The relation's attribute names the child collection element in the
  request xsd (the collection exists ONLY through the relation); by convention the attribute is usually
  the CHILD table's name with a `Collection` suffix (which also satisfies the core naming rule). ⚠ **Re-importing a table DROPS its existing
  relations** (the Relations child shows none afterwards) — they must be recreated or the child
  collection vanishes from the request xsd. The original relation spec is in the pre-edit .iar
  `*_REQUEST-or-mappings.xml` (`one-to-many-mapping` → `target-foreign-key` source/target fields).
- **Relations → Create New** (`…:CHL:WorkBenchRelationsPage:CHL:WorkBenchRelationsCreatePage`):
  `…RelationsParent` (hasEvent) → `…RelationsChild` (hasEvent) → `…RelationsType`
  (ONE_TO_ONE/ONE_TO_ONE_FOREIGN_KEY/ONE_TO_MANY, hasEvent) → auto `…RelationsAttribute` (the collection
  name, auto-filled per the naming convention in the relations rule above)
  + a `…RelationsCreateDynamicTable` join-column table (left cell fixed to the parent table's primary-key
  column, right cell a combo of child columns).
- 🚫 **relation-create OK submit — do not attempt to automate it**: blind
  `UIDatabaseWorkBenchRelationsCreateDynamicTable` formats 400 (`DBWBRELATIONS002_UPDATEPAGE: …
  "optionValue" is null`). DB schema/relation changes are USER designer actions (KNOWN-ISSUE box above);
  you only (re)build the dependent maps via API once the user confirms the columns/relations exist.

## Session model (why save works the way it does)
The wizard subsystem (`/ic/api/adapters/v1/ui/*`) is DECOUPLED from blueprint nodes: sessions are
anonymous server-side scratchpads keyed by CLIENT-minted binding/artifact uuids (fresh every session,
create and edit alike). The node↔wizard association exists only in the CLIENT (this driver's session):
`oic_wizard_save` is what links the generated artifact to the node (PATCH existing / POST stagefile).
Consequences:
- `cloudAdapterFilterId` on load is just a READ pointer ("pre-fill from that node's config") — not an
  edit target. Editing an UNCONFIGURED node (stub, or a canceled wizard) has nothing to resume → the
  driver opens blank create-style pages but still binds the node at save (mode:'edit-unconfigured').
- **Abandoning a wizard: ALWAYS `oic_wizard_cancel`** (ui/cancel — the designer's Cancel). Node
  untouched; a create stub remains unconfigured ("configuration not complete") — delete it via
  oic_delete_node if unwanted. Never just walk away from a session.

## Cautions
- stagefile sessions auto-use the stagefile filter; TRIGGER endpoints: `target:'trigger'` + `filter`
  with `"inbound":true`.
- CAF conventions already inside the driver: firing field `processed:false`, pluginId echo, checkbox
  booleans, and **ooe ACCUMULATION** (orderOfEvents re-lists every prior page submission `processed:true`
  + current deltas `false`, reset on page change — a lone-delta ooe → 400 "field required": the server
  registers a field ONLY through ooe; fieldValue alone is ignored).
- On the FIRST welcome event of a create, ride the endpoint name alongside that event's delta as
  `fieldValue:{referenceName:'<endpoint name>'}` (the event field itself read from the live page, never
  pinned) — the designer's own pattern (referenceName rides the first event).
- Adapter-specific page knowledge lives in the adapter-invokes skill — consult it before driving a
  known-tricky adapter (collocated: leave the operation combo UNSELECTED — selecting binds the wrong op;
  OCI-fn: region→compartment→app→function = chained hasEvent parents).
- Always run the result checks per build (the stage-files skill: `operationName` matches + auto-map
  present; fresh `oic_verify`) — a completed wizard is not proof.
- ⚠ A create that FAILS mid-wizard leaves its stub behind — DELETE the ghost stub before commit, or it
  commits as "Invoke configuration not complete".
- PREFER edit-in-place over delete/recreate ALWAYS — delete cascades request maps + downstream validity.
- Resume decode (for reference): `ui/load` with the node's `cloudAdapterFilterId` (from GET node) =
  resume; a `cloudAdapterFilter` JSON string = new. Fresh bindingId/artifactId both ways.
