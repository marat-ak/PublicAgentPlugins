---
name: adapter-wizard
description: Use for creating or editing ANY adapter endpoint (stagefile, REST, FTP, DB, ERP, collocated, OCI-fn) — the generic CAF wizard (oic_wizard_*) is THE path; the old recipe tools are removed. Echo-delta loop, hasEvent, file upload, SAMPLE FIDELITY LAW, child pages, resume, cancel, session model.
---

# Generic adapter wizard (oic_wizard_*) — THE path for ALL adapter endpoints, create AND edit

**Every adapter endpoint (stagefile, REST, FTP, DB, ERP, collocated, OCI-fn, any adapter) is created and
edited through `oic_wizard_*`.** (Structural nodes — label/assignment/router/route/for/scope/catch/throw/
stop/notification/publisher — stay plain blueprint POSTs per the structural-nodes skill; not wizard
territory.)

The CAF wizard (`ui/load|next|previous|event|generate`) is SELF-DESCRIBING: every response returns the
page's fields (name/type/value/options/hasEvent). The driver is a thin echo-delta layer over it — never
hardcode page/field names; read them from the returned page model.

## ONE procedure, three entry variants
Create and edit differ ONLY in the first call. Everything after `oic_wizard_create` returns the first
page is the SAME loop.

| Entry | First call | Pages arrive | Your job per page |
|---|---|---|---|
| **EDIT in place** | `oic_wizard_create` on the EXISTING node (its id and blueprint segment) | **pre-filled** with the existing config — incl. file bindings absent from get_node/blueprint/.jca (`Filename`/`FileReferenceName` expressions; otherwise only in `.iar` `*expr.properties`, see the stage-files and source-material skills) | change ONLY your deltas; everything else echoes |
| **NEW endpoint** | `oic_wizard_create` with the endpoint name, the connection and the anchor | **server defaults** | fill the required fields (read labels/options from the live page, like a designer user) |
| **NEW: first trigger of an empty flow** | `oic_wizard_create` as a TRIGGER with no anchor — the endpoint name is the wizard's own field | **server defaults** | same as a new endpoint; the connection is the user's choice |

One wizard per integration per conversation — every `oic_wizard_*` call names the same integration and
wsid; `oic_wizard_cancel` before creating another for the same integration.

Node-order plumbing is the tool's problem, not yours: invokes get a stub before the wizard; a Stage File
and a first trigger are created by `oic_wizard_save`. A Stage File (`STAGE_FILE_CONNECTION`) becomes its
STAGEFILE node at the anchor — the server then adds the request map a Write needs (a Read has none). A first
trigger is created only when a fresh read shows the flow is empty (otherwise save refuses, nothing changed);
the result names its id, and the tenant adds nodes around it, which may differ by trigger — read what it
built with `oic_reload_blueprint`, never assume a shape. `oic_wizard_save` is the same call either way
(edit = rebind in place; no delete, node id + request map survive, downstream never invalidates).

## The loop (identical for all)
1. Read the returned page: every field with its type, value, options, hasEvent, required and readOnly.
2. `oic_wizard_event` — REQUIRED for any change to a hasEvent field (parent): downstream fields/options
   are computed server-side by this round-trip. Re-read the returned page BEFORE filling dependents;
   combo options are valid only from the LATEST response.
3. `oic_wizard_file` — file/sample upload (file-browser fields: `SCHEMA_FILE_CHOOSER`, REST
   `inputContentRequest`): raw text in, the tool base64s + sends it via event, the SERVER parses and
   returns the detected root-element combo. NEVER send file content through next.
4. `oic_wizard_next` — commit the page and advance. Without deltas it is a **pure echo** (every stored
   value sent back unmodified); pass only the non-event fields you change. It also goes back a page.
5. Finish at the last enabled page: no response says when, so go to step 6 once no enabled page follows
   the current page. In every flow seen so far it is a summary showing the SERVER's view of the full config
   (incl. bindings like Filename/Append) — read it as the pre-generate confirmation that nothing was
   lost/missing.
6. `oic_wizard_generate` → `oic_wizard_save`; then `oic_commit` + `oic_verify`.
- `oic_wizard_page` — introspect without advancing; one field's RAW subtree for debugging unknown object
  types.

## Field semantics (from the parsed page model)
- `checkboxObject`: `value` is the checkbox ID string — the STATE is `checked` (boolean). The driver
  echoes booleans; never treat `value` as state.
- `expressionBuilderObject` (Filename, PhysicalDirectory, FileReferenceName…): the expression STRING
  only — literals quoted inside it, a payload path copied from `oic_expression_tree` at the node's spot (a
  new node's place, or the existing node), a function call with its `oic_xpath_functions` prefix (the maps
  skill's PREFIX SOURCE LAW). The driver sends the designer's shape: the label and the namespace pairs of
  every prefix the expression uses, resolved at that spot; an unknown prefix is refused before the call.
  Unchanged fields echo with what the server stored.
- `comboBoxObject`: `options` are the ONLY values it takes, sent as the option itself — an option `"true"`
  is the string `"true"`, never a boolean (the driver refuses a value that is not an option; a mistyped
  one is answered 400 GENERIC by the server). `readOnly:true` fields still echo fine.

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
   - **`oic_iar_samples`** (cache-only over the archive `oic_open_integration` loaded when you started —
     or `oic_load_iar` alone; load it first) returns each endpoint's request/response sample: the exact
     JSON/XML the user uploaded. THAT is the source of truth — exactly what the wizard expects re-uploaded.
   - Splice ONLY your intended additions into that verbatim sample (e.g. insert new fields after a named
     sibling), keeping every existing field, value, and type. Upload it.
   - The generated `*_REQUEST.wsdl` is DERIVED from the sample and is LOSSY for this purpose (types/order/
     arrays) — use it only for the post-save diff (§4), never as the rebuild source. Never unzip/regex the
     `.iar` yourself; the `oic_iar_*` tools do it.
3. **Can't obtain the existing payload** (`oic_iar_samples` returns no sample for the endpoint, no
   capture)? **STOP AND ASK THE USER** for the current sample. NEVER generate a payload from memory, notes,
   or field lists.
4. **Mandatory post-save proof — via `oic_iar_schema_diff`, never a script and never a file.** All on the
   same integration:
   a. BEFORE the edit: the archive baseline — already loaded by `oic_open_integration`; otherwise
      `oic_load_iar` (no-op if already loaded).
   b. After saving: `oic_reload_iar` — re-downloads the archive and stashes the baseline schema.
   c. `oic_iar_schema_diff` — the before/after verdict. Assert for the edited endpoint: nothing removed,
      no type changed, exactly the intended fields added, clean (request AND response).
   d. When the diff needs explaining, read the after-image itself with `oic_iar_samples` /
      `oic_iar_schema`.
   A schema edit without this diff is UNVERIFIED regardless of oic_verify being green.

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
No separate recipe — both are the loop above. A **schema edit**: resume on the node (edit in place), obtain
the current sample per the SAMPLE FIDELITY LAW, splice, generate/save, then its mandatory `.iar` diff proof
(law §4) + a validation-only `oic_set_map_xslt` refresh on each dependent map. A **new endpoint**: the same loop from
defaults, then configure the request map the server created (an invoke, a stage-file Write — the maps
skill) before verify. Commit per node.

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
`oic_wizard_save` is what links the generated artifact to the node (PATCH existing / POST stagefile / POST first trigger).
Consequences:
- `cloudAdapterFilterId` on load is just a READ pointer ("pre-fill from that node's config") — not an
  edit target. Editing an UNCONFIGURED node (stub, or a canceled wizard) has nothing to resume → the
  driver opens blank create-style pages but still binds the node at save (mode:'edit-unconfigured').
- **Abandoning a wizard: ALWAYS `oic_wizard_cancel`** (ui/cancel — the designer's Cancel). Node
  untouched; a create stub remains unconfigured ("configuration not complete") — delete it via
  oic_delete_node if unwanted. Never just walk away from a session.

## Cautions
- stagefile sessions auto-use the stagefile filter; a trigger gets its inbound filter by default — override
  the filter only when you must.
- CAF conventions already inside the driver: firing field `processed:false`, pluginId echo, checkbox
  booleans, and **ooe ACCUMULATION** (orderOfEvents re-lists every prior page submission `processed:true`
  + current deltas `false`, reset on page change — a lone-delta ooe → 400 "field required": the server
  registers a field ONLY through ooe; field values alone are ignored).
- On the FIRST welcome event of a create, the endpoint name (`referenceName`) rides along with that
  event's delta (the event field itself read from the live page, never pinned) — the designer's own
  pattern (referenceName rides the first event).
- Adapter-specific page knowledge lives in the adapter-invokes skill — consult it before driving a
  known-tricky adapter (collocated: leave the operation combo UNSELECTED — selecting binds the wrong op;
  OCI-fn: region→compartment→app→function = chained hasEvent parents).
- Always run the result checks per build (the stage-files skill §MANDATORY result check: node type +
  `operationName`, request map only for a Write, expressions in the archive; fresh `oic_verify`) — a
  completed wizard is not proof.
- ⚠ A create that FAILS mid-wizard leaves its stub behind — DELETE the ghost stub before commit, or it
  commits as "Invoke configuration not complete".
- PREFER edit-in-place over delete/recreate ALWAYS — delete cascades request maps + downstream validity.
- Resume decode (for reference): `ui/load` with the node's `cloudAdapterFilterId` (from GET node) =
  resume; a `cloudAdapterFilter` JSON string = new. Fresh bindingId/artifactId both ways.
