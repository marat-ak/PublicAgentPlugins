---
name: datamodel-authoring
description: Use when analyzing, modifying, or generating an Oracle BI Publisher data model (.xdmz) — datasets and their SQL, output group structure, group placement, master-detail group links, parameters, lexicals (flexfield/KFF), value sets (LOVs), event triggers (PL/SQL), bursting, or validations; also covers uploaded-file inspection, the SQL-first / group-by gates before createDataModelFile, and where totals/subtotals/aggregation live (detail + summary rows in ONE query via ROLLUP/GROUPING SETS vs a group-aggregate element).
---

# Data model (.xdmz) authoring

You can **analyze, modify, and generate** BIP data models — real, downloadable artifacts via the
authoring tools. Do NOT say "I can't create files" or merely describe tables — produce the actual
`.xdmz`. Ground every table/column/join with the schema tools + real corpus before writing any SQL
(the full SQL build workflow — ground → validate → grain-check → clarify → adopt/adapt/derive — is in
the **fusion-sql-review** skill; load it too when authoring a model's dataset SQL).

## Uploaded files — inspect before you act
When the user ATTACHES files you get a note with `fileId`s.
1. **`listUploadedFiles`** first — each file's COMPACT summary (kind; datasets + type + tables;
   parameters; triggers; bursting; layouts/formats). Reason from summaries. **Do not ask for the SQL** —
   it is fetched on demand.
2. **`getDataset(fileId, dataset)`** — the full SQL of ONE dataset, only when you need to explain or
   change it. Ground its tables/columns with `validateTable`/`getColumns` before rewriting.
3. Decide from the request:
   - **Analyze / explain** → describe in business terms what the model returns (datasets, parameters,
     triggers, bursting) from the summary (+ `getDataset` where needed). No file output.
   - **Modify** → write the new grounded SQL, then apply it (below). Each edit returns a NEW `fileId`.
   Multiple files / a `.zip` bundle are fine — operate across them by `fileId`.

## Editing a data model — EVERY part is surgical
A data model is more than its datasets: data properties, datasets (SQL / file / OTBI / Excel / CSV),
the output group/element structure, master-detail **group links**, **parameters**, **lexicals** (KFF),
**value sets** (LOVs), **event triggers** (PL/SQL), **bursting**, and **validations**. Every one is a
byte-preserving splice — the change touches ONLY the targeted node; all other bytes of the `.xdmz` are
preserved. No full rebuild.

- **Inspect first, always.** `getDataModel(fileId, section)` reads any part as compact JSON — `section`:
  `overview` (section names + output tree) · `structure` · `groupLinks` · `parameters` · `lexicals` ·
  `datasets` · `triggers` · `valueSets` · `bursting` · `properties` · `validations`. The real structure
  is often deeply nested — never assume the shape; read it.
- **Then change exactly one part** with the matching `edit*` tool (each takes an `action`):
  `editStructure` (elements + groups + group links) · `editParameters` · `editLexicals` · `editDatasets`
  (setSql / setSource / rename / add / remove) · `editTriggers` · `editValueSets` · `editBursting`
  (set / update / clear) · `editProperties` · `editValidations`. For a quick single-dataset SQL swap use
  `setDatasetSql(fileId, dataset, sql, columns?)`; to batch many edits into ONE re-zip use
  `updateDataModelFile` (params / triggers / bursting / rename / setSql together). Non-SQL datasets
  (file/Excel/OTBI/CSV) are read + name/source only — their bodies are not authored.

Example:
```
getDataModel(fileId, "parameters")            // read current params
editParameters(fileId, { action:"add", name:"P_REGION", dataType:"string", … })
editStructure(fileId, { action:"addGroupLink", parent:"G_HEADER", child:"G_LINES", … })
getDataModel(newFileId, "parameters")         // read back — confirm it landed
```

**Every edit returns a NEW fileId — ALWAYS chain the next edit on the fileId the PREVIOUS edit
returned.** Re-using an older id forks the lineage (your later edits silently miss the earlier ones).
If a reply carries `staleWarning`/`latestFileId`, you targeted an old version — switch to
`latestFileId`. When the chain is done, share ONE download link — the FINAL file's — and state its
fileId as the final version; never post links for intermediate files.

## Placing a field in a SPECIFIC output group
The output `<dataStructure>` is a **hierarchy** — groups nest (G_1 may contain G_2 which contains G_3);
it is NOT flat. `setDatasetSql`'s auto-reconcile only APPENDS a new column to the **innermost/leaf**
group, so it CANNOT honor "put field X in group Y".
1. `getDataStructure(fileId)` — see the real (possibly nested) hierarchy; never assume flat or guess
   which group is "the top one".
2. `addStructureElement(fileId, group, name, …, after?)` inserts the field EXACTLY in the named group
   (byte-level splice, no rebuild); `moveStructureElement(fileId, element, toGroup, after?)` relocates
   an existing field (e.g. lift one that landed in the leaf group up to G_1). Do NOT rebuild the whole
   model via `createDataModelFile` just to move one element, and do NOT rely on the leaf-append.

## Verify before you claim; report the outcome, not the tooling
After ANY structure/SQL edit, call `getDataStructure` (or `getFileSummary`/`getDataModel`) on the
RESULT and CONFIRM the element is in the group the user asked for BEFORE saying it is done. A field can
look added yet sit in the wrong group (a real session claimed a field was in G_1 when it was actually
in G_3). Then tell the user the business result — *"Added From Warehouse to the top group G_1, right
after Ship From Organization — the updated .xdmz is ready to download"* — NOT tool names, the
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
   context_code and never ship a placeholder when the registry answers; registry empty → ASK, and
   ALWAYS filter EFF tables by the resolved `context_code` (+ dedup/pre-aggregate multirow EFF
   before joining).
   **Custom OBJECTS and custom fields: resolve via `getCustomObjects`** — a custom object lives in
   a GENERIC table (e.g. HZ_REF_ENTITIES) with a mandatory row filter (`context column =
   'Object_c'`) and EXTN_ATTRIBUTE_* column mappings; a custom field on a built-in object lives in
   that object's dedicated extension table. Never query a generic store without its row filter, and
   never guess an EXTN column. **Users say DISPLAY names, not `_c` API names** — when a mentioned
   object/field is not a standard Fusion object (or getColumns doesn't show it), search
   `getCustomObjects`/`getFlexfields` with the user's own words (the search de-camelizes API names:
   "ticket contact" finds TicketContact_c). **Found nothing → emit a `fusion-ask` block** asking which
   object/field they mean or its API name — never assume it's a standard column and never invent one.
   **Found SEVERAL candidates → a `fusion-ask` block with the candidate API names as options** (e.g.
   TicketContact_c vs TicketToContact_c vs Ticket_c) — only a single unambiguous hit proceeds
   without confirmation.
3. Build a **`DataModelSpec`** (datasets with the grounded SQL; parameters; output structure; event
   triggers and bursting if the request needs them) and call **`createDataModelFile(spec)`**.
   - **LOVs at CREATE time:** declare dropdowns directly in the spec — `spec.valueSets:[{id, sql | 
     values}]` plus `parameter.valueSet: "<id>"` on the parameter that uses it (and `parameter.format`
     for date masks). Do NOT create the model bare and then chain editValueSets/editParameters — the
     create-time path is one file, no edit chain.
   - **`defaultDataSource` — classify the DOMAIN into ONE of three pod-level sources.** The JDBC data
     source is chosen per POD, NOT per subledger: **Financials / Procurement / SCM** (AP, AR, GL,
     invoices, POs, inventory) → **`ApplicationDB_FSCM`**; **HCM** (workers, payroll, absence,
     positions) → **`ApplicationDB_HCM`**; **CRM / Sales / Service** → **`ApplicationDB_CRM`**. AP/AR/GL
     ALL use `ApplicationDB_FSCM` — there is **no** `ApplicationDB_AR`/`ApplicationDB_AP`. Never invent a
     per-subject name and never use a placeholder or ask the user for it. If you truly can't classify,
     OMIT it → defaults to `ApplicationDB_FSCM`. (Unknown names are coerced to the pod default anyway.)
4. Report what you built and that the `.xdmz` (its `fileId`) is ready to download.
5. **Then pod-TEST it** (when the `fusion-pod` MCP is available): everything-at-once mode → run the
   datamodel test flow directly (`prepareDataModelTest` → upload both → `runReport` as XML → verify
   the data) as part of the same turn; step-by-step mode → offer it first. See the
   **rendering-and-running** skill for the exact steps and parameter prompting.
Never hand-wave a data model as prose — the deliverable is a real `.xdmz`.

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
Only when SQL genuinely can't carry it: **datamodel group-aggregate element** (`function="summation"|
"count"|"average"` on a group) — the data engine computes it, the template just prints `<?FIELD?>`.
Layout-side (XSLT) aggregation is the LAST resort — acceptable only for a single trivial summary line,
**never a wide pivot** (per-cell cross-group sums across many columns are unmaintainable by a human).

## BIP data-model SQL limitations (the engine's parser is stricter than Oracle) — with workarounds
The model is authored against real Oracle, but the BIP data-model parser/designer rejects some valid
Oracle SQL. Apply these preemptively:
- **`:=` assignment inside a `WITH FUNCTION` body is rejected.** Inline `WITH FUNCTION … RETURN …` is
  allowed, but replace every `var := expr;` in its body with **`SELECT expr INTO var FROM dual;`**.
- **A dataset whose SQL STARTS with a CTE (`WITH …`) breaks grouping in the designer.** Wrap it:
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
   detail rows (the invoice query, WITH the supplier columns) in **one** dataset and set
   `groupBy: ["SUPPLIER_ID","VENDOR_NAME"]` on it → the output XML nests each supplier's invoices
   underneath it. **ORDER BY the group columns in the SQL.** Use this whenever ranking/filtering B
   requires scanning A anyway (e.g. "top 10 suppliers by unpaid invoice amount" — one query grouped by
   supplier, NOT two datasets). Multi-LEVEL nesting (customer > invoice > line, for an RTF `blocks[]`
   document) = layered `groupBy` levels — each level's columns listed in ORDER BY too. A `groupFilter`
   condition is written with **bare operators** (`AMOUNT_DUE > 0`, `STATUS != 'CLOSED'`) — plain text,
   NOT XML-escaped `&gt;`/`&lt;` (the tools escape correctly; pre-escaped input becomes a WRONG filter).
3. **Master + detail (two linked datasets)** — ONLY when the master (B) is an independent entity you do
   NOT need to scan the detail (A) to select/filter/rank, and the detail is fetched per-master. Rare
   for "top-N B by A" requests.

If the shape is unclear, ASK:
> *"Do you want a **summary** (one row per supplier with totals) or a **grouped layout** (each supplier
> with its open invoices listed underneath)?"*
Then: summary → SQL `GROUP BY`; grouped layout → one dataset + `groupBy` (option 2, the usual answer);
reserve two datasets for the independent-master case.
