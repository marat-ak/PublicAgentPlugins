---
name: datamodel-authoring
description: Use when analyzing, modifying, or generating an Oracle BI Publisher data model (.xdmz) — datasets and their SQL, output group structure, group placement, master-detail group links, parameters, lexicals (flexfield/KFF), value sets (LOVs), event triggers (PL/SQL), bursting, or validations; the XML-function dataset (pure XML, no wrapping — WITH FUNCTION … RETURN XMLTYPE, a clob RESULT, the LOB data properties, nested CURSOR groups, any PL/SQL-built shape) and the secured data model built on it; also covers uploaded-file inspection, the SQL-first / group-by gates before createDataModelFile, and where totals/subtotals/aggregation live (detail + summary rows in ONE query via ROLLUP/GROUPING SETS vs a group-aggregate element).
---

# Data model (.xdmz) authoring

You can **analyze, modify, and generate** BIP data models — real, deliverable artifacts via the
authoring tools. Do NOT say "I can't create files" or merely describe tables — produce the actual
`.xdmz`. Ground every table/column/join with the schema tools + real corpus before writing any SQL
(the full SQL build workflow — ground → validate → grain-check → clarify → adopt/adapt/derive, then
secure when data access was chosen — is in the **fusion-sql-review** skill: load it when authoring a
model's dataset SQL; the secure step is **data-access-security**, loaded only for SQL the kernel's
opt-in data-access rule secures).

## Uploaded files — inspect before you act
When the user ATTACHES files you get a note with `fileId`s. A `.xdmz` is recognised by its extension
(the announced type may be generic); a `.zip` is not unpacked — `extractEntry` the model out of it first
(kernel rule on uploaded BIP files).
1. **`getFileSummary`** first — reason from the model's compact summary. **Do not ask for the SQL** — it
   is fetched on demand.
2. **`getDataset`** — the SQL of ONE dataset, only when you need to show, run, explain or change it.
   Ground its tables/columns with `validateTable`/`getColumns` before rewriting.
3. Decide from the request:
   - **Analyze / explain** → describe in business terms what the model returns (datasets, parameters,
     triggers, bursting) from the summary (+ `getDataset` where needed). No file output.
   - **Show or run the SQL as is** (to read, to edit next, to see its rows) → the dataset's SQL
     unchanged — shown with the dataset name, its binds and the file / catalog path, or run with its
     binds — the kernel's review rule: no review, no checks.
   - **Modify** → write the new grounded SQL (**fusion-sql-review**; secured only when the user chose
     data access — **data-access-security**), then apply it (below). Each edit returns a NEW file.
   Several models at once (separate attachments, or entries extracted from one `.zip`) are fine —
   operate across them by their own `fileId`s.

## Editing a data model — EVERY part is surgical
A data model is more than its datasets: data properties, datasets (SQL / file / OTBI / Excel / CSV),
the output group/element structure, master-detail **group links**, **parameters**, **lexicals** (KFF),
**value sets** (LOVs), **event triggers** (PL/SQL), **bursting**, and **validations**. Every one is a
byte-preserving splice — the change touches ONLY the targeted node; all other bytes of the `.xdmz` are
preserved. No full rebuild.

- **Inspect first, always.** `getDataModel` reads any part of the model (the section you are about to
  change). The real structure is often deeply nested — never assume the shape; read it.
- **Then change exactly one part** with the matching `edit*` tool: `editStructure` (elements + groups +
  group links) · `editParameters` · `editLexicals` · `editDatasets` · `editTriggers` · `editValueSets` ·
  `editBursting` · `editProperties` · `editValidations`. A quick single-dataset SQL swap is
  `setDatasetSql`; many edits in ONE re-zip are `updateDataModelFile`.
- **Read back** the changed part (`getDataModel`) and confirm it landed.

**Every edit returns a NEW file — ALWAYS chain the next edit on the fileId the PREVIOUS edit
returned.** Re-using an older id forks the lineage (your later edits silently miss the earlier ones).
A reply warning that you targeted an old version names the latest one — switch to it. When the chain is
done, present ONE file — the FINAL one — with `ui_present_file`; never present (or link) intermediate
files.

## Placing a field in a SPECIFIC output group
The output `<dataStructure>` is a **hierarchy** — groups nest (G_1 may contain G_2 which contains G_3);
it is NOT flat. A SQL swap (`setDatasetSql`) only appends a new column to the **innermost/leaf**
group, so it CANNOT honor "put field X in group Y".
1. `getDataStructure` — see the real (possibly nested) hierarchy; never assume flat or guess which
   group is "the top one".
2. `addStructureElement` inserts the field EXACTLY in the named group (byte-level splice, no rebuild);
   `moveStructureElement` relocates an existing field (e.g. lift one that landed in the leaf group up to
   G_1). Do NOT rebuild the whole model via `createDataModelFile` just to move one element, and do NOT
   rely on the leaf-append.

## Verify before you claim; report the outcome, not the tooling
After ANY structure/SQL edit, call `getDataStructure` (or `getFileSummary`/`getDataModel`) on the
RESULT and CONFIRM the element is in the group the user asked for BEFORE saying it is done. A field can
look added yet sit in the wrong group (a real session claimed a field was in G_1 when it was actually
in G_3). Then tell the user the business result — *"Added From Warehouse to the top group G_1, right
after Ship From Organization — here is the updated .xdmz"* (presented with `ui_present_file`) — NOT tool names, the
"auto-reconciler", or internal group mechanics (expose those only in dev mode / on request).

## Generating / creating a data model
When the user asks to build one ("build me a data model for …"):
1. **Resolve the domain first** (same disambiguation rules as SQL — ask if a bare term is ambiguous;
   see the **fusion-sql-review** skill).
2. **`findSimilarQueries`** for the intent → adopt real tables/joins/filters; `validateTable` /
   `getColumns` / `getRelatedTables` to ground every table, column, and join key.
   **DFF/EFF fields (`*_EFF_B`, `ATTRIBUTE_CHARn`, `GLOBAL_ATTRIBUTEn`, "additional/custom
   attribute X"): resolve via `getFlexfields`** (fusion-schema) — it maps business names to the real
   context_code + attribute column + value set from the customer's registry. Never guess a
   context_code and never ship a placeholder when the registry answers; registry empty or the
   customer pod differs from the registry snapshot → read the LIVE definition with the live pod tools
   (fusion-pod): **`searchFlexfields`** to find the flexfield, then **`describeFlexfield`** for its
   segments; **never hand-write `FND_DF_*` joins**. Still nothing → ASK. ALWAYS filter EFF tables by
   the resolved `context_code` (+ dedup/pre-aggregate multirow EFF before joining).
   **Custom OBJECTS and custom fields: resolve via `getCustomObjects`** — a custom object lives in
   a GENERIC table (e.g. HZ_REF_ENTITIES) with a mandatory row filter (`context column =
   'Object_c'`) and EXTN_ATTRIBUTE_* column mappings; a custom field on a built-in object lives in
   that object's dedicated extension table. Never query a generic store without its row filter, and
   never guess an EXTN column. **Users say DISPLAY names, not `_c` API names** — when a mentioned
   object/field is not a standard Fusion object (or getColumns doesn't show it), search
   `getCustomObjects`/`getFlexfields` with the user's own words (the search de-camelizes API names:
   "ticket contact" finds TicketContact_c). The registry is a DEMO-POD snapshot — on a customer
   pod go LIVE: **`searchCustomObjects`** (fusion-pod) with the user's own words (a field name finds
   the object owning it), then **`describeCustomObject`** for the exact object's fields. **Never guess
   an API name and never hand-write `ADF_*` joins.**
   **Still nothing → ASK (AskUserQuestion)** which object/field they mean or its API
   name — never assume it's a standard column and never invent one.
   **Found SEVERAL candidates → ASK (AskUserQuestion) with the candidate API names as options** (e.g.
   TicketContact_c vs TicketToContact_c vs Ticket_c) — only a single unambiguous hit proceeds
   without confirmation.
3. Build the model in ONE **`createDataModelFile`** call: the datasets with the grounded SQL (secured
   only when the user chose data access (**data-access-security**) — a SECURED model is the XML-function
   dataset (section below) with FND_DATA_SECURITY inside; LOV SQL too), parameters, output structure,
   event triggers and bursting if the request needs them.
   - **LOVs at CREATE time:** declare the dropdowns in that same call, each bound to its parameter. Do
     NOT create the model bare and then chain editValueSets/editParameters — the create-time path is one
     file, no edit chain.
   - **The data source is per POD DOMAIN, not per subledger** (Financials / Procurement / SCM, HCM, or
     CRM / Sales / Service — the create tool's description names the three): classify it yourself; never
     invent a per-subject name, never a placeholder, never ask the user.
4. Report what you built and present the `.xdmz` with `ui_present_file`.
5. **Then pod-TEST it** (when the `fusion-pod` MCP is available): everything-at-once mode → run the
   datamodel test flow directly (`prepareDataModelTest` → upload both → run the test report → verify its
   data XML) as part of the same turn; step-by-step mode → offer it first. See the
   **rendering-and-running** skill for the exact steps and parameter prompting. An XML-function model's
   data STARTS with the function's own root (`<ROWSET>`); the XML arriving escaped inside a `RESULT`
   element means its LOB data properties are missing.
Never hand-wave a data model as prose — the deliverable is a real `.xdmz`.

## XML-function dataset — return pure XML, no wrapping
When the output has to be BUILT in PL/SQL, or shaped beyond what datasets + groups + group links can
declare, the model is ONE dataset whose SQL is an inline `WITH FUNCTION … RETURN XMLTYPE`: the function
assembles the document (dynamic SQL, `DBMS_XMLGEN`, nested `CURSOR(…)` groups, XML from a package — any
shape) and BIP emits it AS-IS as the report's data. Choose it whenever the declarative model falls
short: SQL text assembled at run time, a run-time-generated predicate (the secured model below),
arbitrary or data-driven nesting, pre-built XML from an API, a CLOB over 4,000 characters that must
cross into the query (a lexical is a VARCHAR2 and a CLOB does not substitute). A plain SELECT with
group-by stays the default for everything else.

Canonical dataset SQL (the business SQL and the nesting are yours):
```sql
SELECT /*+ with_plsql */ * FROM (
WITH
FUNCTION xx_<name>_xml(p_bu VARCHAR2) RETURN XMLTYPE IS        -- one argument per report parameter
  l_sql    CLOB;
  l_cur    SYS_REFCURSOR;
  l_ctx    DBMS_XMLGEN.ctxHandle;
  l_res    XMLTYPE;
BEGIN
  DBMS_LOB.CREATETEMPORARY(l_sql, TRUE);
  DBMS_LOB.APPEND(l_sql, q'[WITH prm AS (SELECT :b_bu AS bu FROM dual)
SELECT ap.INVOICE_ID, ap.INVOICE_NUM, ap.INVOICE_AMOUNT,
       CURSOR(SELECT l.LINE_NUMBER, l.AMOUNT FROM AP_INVOICE_LINES_ALL l
              WHERE l.INVOICE_ID = ap.INVOICE_ID ORDER BY l.LINE_NUMBER) AS LINES
FROM AP_INVOICES_ALL ap, prm
WHERE ap.ORG_ID = prm.bu
ORDER BY ap.INVOICE_NUM]');                                    -- the business SQL, in pieces
  OPEN l_cur FOR l_sql USING p_bu;                              -- one USING value per bind, in order
  SELECT DBMS_XMLGEN.NEWCONTEXT(l_cur) INTO l_ctx FROM dual;
  DBMS_XMLGEN.SETNULLHANDLING(l_ctx, DBMS_XMLGEN.EMPTY_TAG);
  SELECT DBMS_XMLGEN.GETXMLTYPE(l_ctx) INTO l_res FROM dual;
  DBMS_XMLGEN.CLOSECONTEXT(l_ctx);
  RETURN l_res;
END;
SELECT xx_<name>_xml(:P_BU) AS RESULT FROM dual
)
```
The model around it: ONE dataset with that SQL and its one clob column `RESULT`, the report parameters
as usual — each one an argument of the function, `:P_X` ONLY in the closing `SELECT fn(:P_X) AS RESULT
FROM dual` — and the XML-function data properties `createDataModelFile` describes; every one is required.
- **Output shape.** The LOB data properties make BIP emit the clob element's XML as the WHOLE data
  document: root `<ROWSET>`, one `<ROW>` per row of the cursor — no `DATA_DS`, no `G_*` group, no
  `<RESULT>` wrapper, no parameter elements. Without them (or with a non-clob `RESULT`) the XML arrives
  escaped inside `<RESULT>` and no layout can bind to it.
- **Nested groups = nested `CURSOR(…) AS <NAME>`.** A cursor column becomes `<NAME><NAME_ROW>…
  </NAME_ROW></NAME>` under its parent `<ROW>` — the master → detail hierarchy of this pattern (any
  depth); group-by levels and group links do not apply. The parent query's `ORDER BY` orders the groups, each
  cursor's its details. Any other document shape is the function's to build (`XMLELEMENT` /
  `XMLAGG`, a package returning XMLTYPE) — the model side is identical.
- **Layout bindings.** XPaths are `/ROWSET/ROW/<COL>` and `/ROWSET/ROW/<NAME>/<NAME>_ROW/<COL>` (or
  the root and tags the function emits) — the model's declared structure (`DATA_DS/G_DATA/RESULT`)
  is NOT the data shape; name the paths explicitly when the layout is built, and use the pod run's
  XML as the sample data.
- **Always pass the column list** (create and `setDatasetSql`): the outer `SELECT /*+ with_plsql */ * FROM (…)`
  has no parseable column list, so nothing can be reconciled from the SQL.
- **Body rules.** No `:=` (the BIP parser — `SELECT … INTO … FROM dual`); every `q'[…]'` piece is under
  32K characters and contains no `]'` (split long SQL across several `DBMS_LOB.APPEND`, or switch the
  delimiter, `q'{…}'`); the dynamic SQL's binds are positional — bind each parameter ONCE in a leading
  `prm` CTE and reference `prm.<col>`, with one `USING` value per bind in order; `EMPTY_TAG` keeps an
  absent value as an empty element so bindings never shift; the function returns `XMLTYPE` (not a
  CLOB); no exception handler that turns an error into a row — a failing report fails loudly.
- **Test** the statement as written with `runSql` / `run_sql` (it returns the XML for the session's
  user), then the model on the pod (step 5: the output starts with the function's root).

### Secured data model = XML-function dataset + FND_DATA_SECURITY at run time
A model whose SQL the data-access rule secures is the technique above with the condition fetched
INSIDE the function when the report runs — for whoever runs it (**data-access-security**, "Secured
data models"). It replaces the shapes that embedded a condition at authoring time or passed it from a
parent dataset through a lexical: those are not built any more — an existing model in one of them is
rebuilt in this shape. The delta to the template, per pair of the plan (`l_pred_n` each):
```sql
  l_pred   CLOB;                                                -- declarations
  l_status VARCHAR2(30);
…
  FND_DATA_SECURITY.GET_SECURITY_PREDICATE(                     -- before the SQL is assembled
    p_api_version         => 1.0,
    p_privilege           => 'AP_REPORT_PAYABLES_DATA',         -- the plan's pair, by NAME
    p_object_name         => 'FUN_ALL_BUSINESS_UNITS_V',
    p_grant_instance_type => 'UNIVERSAL',
    p_statement_type      => 'OTHER',
    x_predicate           => l_pred,
    x_return_status       => l_status,
    p_table_alias         => 'sec$');
  IF NVL(l_status, 'X') <> 'T' OR l_pred IS NULL THEN
    SELECT TO_CLOB('1=2') INTO l_pred FROM dual;                -- fail closed: no rows
  END IF;
…
  DBMS_LOB.APPEND(l_sql, q'[WITH prm AS (SELECT :b_bu AS bu FROM dual),
ap_sec AS (SELECT /*+ INLINE */ t.* FROM AP_INVOICES_ALL t
  WHERE t.ORG_ID IN (SELECT sec$.BU_ID FROM FUN_ALL_BUSINESS_UNITS_V sec$ WHERE ]');
  DBMS_LOB.APPEND(l_sql, l_pred);                               -- the plan's {PRED:…} slot
  DBMS_LOB.APPEND(l_sql, q'[))
SELECT … FROM ap_sec ap, prm …]');                              -- the plan's rewrite applied
```
Every secured table of the plan keeps its CTE (inside a `CURSOR(…)` too) with its slot split across the
appends this way; the condition is a CLOB end to end (no VARCHAR2, no `SUBSTR`, no cap); the
statement is tested with `runSql` / `run_sql` as written, never through `runSecuredSql` (there is no
slot); the model's `Data access:` line is the one data-access-security gives for a data model.

## Computation belongs in SQL — use the FULL power of Oracle
Push every computation as far LEFT (toward SQL) as possible; the layout should be a dumb display of
ready columns (see the report-authoring simplicity contract). Do NOT limit yourself to primitive
constructs — Oracle SQL is rich, pick the STRONGEST fit:
- pivots → native `PIVOT`/`UNPIVOT` (or `SUM(CASE …)` columns) so the layout gets flat/wide columns;
- **detail + subtotals/grand-total in ONE query → `ROLLUP` / `CUBE` / `GROUPING SETS`** with
  `GROUPING()`/`GROUPING_ID()` to tag the summary rows — this usually removes any need for a separate
  summary mechanism;
- ranking/running totals/first-non-null → window functions (`ROW_NUMBER`, `RANK`, `KEEP (DENSE_RANK
  FIRST …)`, `SUM() OVER`); hierarchies → recursive `WITH`; string rollups → `LISTAGG`; complex
  row-wise math → `MODEL`.
Only when SQL genuinely fits worse: **datamodel group-aggregate element** (an aggregation function on a
group's element — RESTRUCTURE the group levels when that unlocks the need, e.g. currency as its own
level) — the data engine computes it, the template just prints `<?FIELD?>`.
Layout-side (XSLT) aggregation is the last rung — a single trivial summary line at most,
**never a wide pivot** (per-cell cross-group sums across many columns are unmaintainable by a human).
This priority order IS the **AGGREGATION LADDER** — its canonical form + the mandatory visible
**"Aggregation check"** (one line per aggregation need, emitted immediately before proposing ANY
aggregation mechanism) live in the **fusion-sql-review** skill (Part 0, step 4b); run it here too.
A NEW summary dataset re-running the base query to aggregate it sits BELOW the ladder — the last
preference, picked only when every rung fits worse (its check line says why), never the default
answer to "add totals/counts/summaries".

## BIP data-model SQL limitations (the engine's parser is stricter than Oracle) — with workarounds
The model is authored against real Oracle, but the BIP data-model parser/designer rejects some valid
Oracle SQL. Apply these preemptively:
- **`:=` assignment inside a `WITH FUNCTION` body is rejected.** Inline `WITH FUNCTION … RETURN …` is
  allowed, but replace every `var := expr;` in its body with **`SELECT expr INTO var FROM dual;`**.
- **A dataset whose SQL STARTS with a CTE (`WITH …`) breaks grouping in the designer** — secured SQL
  always does (its secured CTEs lead). Wrap it:
  **`SELECT * FROM (WITH … SELECT …)`** so the outer statement is a plain SELECT.
- **If that wrapped SQL also contains an inline `WITH FUNCTION`, the OUTER select needs the hint
  `/*+ with_plsql */`** — i.e. `SELECT /*+ with_plsql */ * FROM (WITH FUNCTION … SELECT …)`.

### Before `createDataModelFile`: honor the session WORKING MODE, and settle grouping

**1. SQL approval is governed by the working mode** (asked once at session start — core instructions):
- **Everything-at-once mode**: do NOT stop to show SQL — ground it, build the model, and carry on
  through report + render; the final summary includes the SQL. Never pause "to check if the user
  wants to continue".
- **Step-by-step mode**: produce the grounded SQL, show it, get the OK, THEN
  `createDataModelFile` / `setDatasetSql`; each later stage (model → report → render) is a checkpoint.
- Mode unknown (it wasn't asked — e.g. the session started as a pure SQL question) → ask the mode
  question NOW, once.
The **strongest** verification is running the model against the real pod (upload → run → inspect);
in everything-at-once mode just do it as part of the flow, in step-by-step offer it (see the
**rendering-and-running** skill).

**2. "Group by X" meaning.** "group by" in a data model is NOT SQL `GROUP BY` by default — it almost
always means a grouped **hierarchy**. Three shapes:
1. **Summary** (SQL `GROUP BY`) — one dataset, one row per B with totals. Flat. Only if the user
   explicitly wants totals/counts.
2. **Grouped output over ONE dataset** — the DEFAULT for "invoices grouped by supplier". Fetch the flat
   detail rows (the invoice query, WITH the supplier columns) in **one** dataset grouped by the supplier
   columns → the output XML nests each supplier's invoices underneath it. **ORDER BY the group columns
   in the SQL.** Use this whenever ranking/filtering B requires scanning A anyway (e.g. "top 10 suppliers
   by unpaid invoice amount" — one query grouped by supplier, NOT two datasets). Multi-LEVEL nesting
   (customer > invoice > line, for an RTF block document) = nested groups over the same rows — one level
   per break, each level's columns listed in ORDER BY too.
3. **Master + detail (two linked datasets)** — ONLY when the master (B) is an independent entity you do
   NOT need to scan the detail (A) to select/filter/rank, and the detail is fetched per-master. Rare
   for "top-N B by A" requests.

If the shape is unclear, ASK:
> *"Do you want a **summary** (one row per supplier with totals) or a **grouped layout** (each supplier
> with its open invoices listed underneath)?"*
Then: summary → SQL `GROUP BY`; grouped layout → one grouped dataset (option 2, the usual answer);
reserve two datasets for the independent-master case.
