---
name: report-authoring
description: Use when creating or modifying a BI Publisher report layout — a report (.xdoz), an interactive XPT table, a print/invoice-grade RTF template, or a subtemplate (.xsb). Covers createReportFile / addReportLayout, the surgical modifyReportLayout ops on Word-authored and generated RTF, summarizeReportLayout, subtemplate import/call-template wiring, and the locale model.
---

# Report & layout (.xdoz / RTF / XPT / .xsb) authoring — engine-validated

Reports (`.xdoz`) bind to a data model's OUTPUT tree — **ground the model's output columns first**
(`getDataStructure` / `getDataModel(fileId,"structure")` on the model). All layouts here are validated
against the real BIP engine. After building or changing a layout, offer to render it so the user can
see it — invoke the **rendering-and-running** skill.

## Layout corpus — consult BEFORE designing (findLayoutPattern / getLayoutPattern)
The layout-pattern corpus holds render-VERIFIED archetypes (whole-report shapes), techniques (single
mechanics with exact recipes), antipatterns (broken shapes + the working alternative), and capability
notes (what BIP can do that the DSL can't yet — offer these as prose, don't fake them in the DSL).
- **At the STRUCTURE step** (before the data model): `findLayoutPattern(<user's ask>, {kinds:
  ["archetype"]})` — the matching archetype names the grouping levels, page breaks, and sections,
  which then drive the model's `groupBy`.
- **While building**: `findLayoutPattern` for each distinct mechanic ("totals row", "landscape",
  "page header"); `getLayoutPattern(id)` returns the full verified recipe — PREFER a corpus recipe
  over improvising; its `pitfalls` are engine-observed, not theory.
- **A result may COMPOSE several rows** — one archetype + several techniques merged into one
  `blocks[]`/grid; the `composition` notes say what combines.
- **On a builder error naming a corpus id, fetch that row** — the builders cross-reference the corpus.
- Respect `formatAdvice` in results: a technique marked format-exclusive (e.g. xpt-only side-by-side
  chart+repeating-table) is withheld as a recipe when you asked for the other format — switch format
  or pick the alternative it names, don't force it.

## Create
`createReportFile` / `addReportLayout`. Two layout kinds:
- **`.xpt` (interactive table / DASHBOARD)** — fully generatable. Binds `/<root>/<group>/<COL>` (e.g.
  `/DATA_DS/G_1/PLAN_NAME`) to the datamodel output tags. A SINGLE `.xpt` layout is a whole dashboard —
  it stacks, top→bottom:
  - **`kpis`** — a row of KPI CARDS (caption over a big value), each `{label, field, group}`. Use for
    headline single-value metrics (totals/counts). Do **NOT** render headline numbers as a table.
  - **`charts`** — interactive charts; each may bind its own `group`. **Each chart binds EXACTLY ONE
    measure** (`measures:[one]`). Multi-series comes from a series DIMENSION FIELD (`seriesField` →
    ColLabels), NOT extra measure columns — e.g. a stacked bar of runs-per-day-by-status is
    `dimensionField:"PROCESS_START_DAY", seriesField:"REQUEST_STATE", measures:[{name:"REQUESTID",
    agg:"count"}]`. Putting 2+ measures on an `.xpt` chart renders when it's alone but FAULTS
    ("XMLElement.getChildNodes() param is null") the moment a second chart shares the page — the builder
    now rejects it. (Wide pre-aggregated columns like NUMBER_OF_SUCCEEDED / _ERROR are the wrong shape for
    an interactive chart; feed it long/detail rows + count instead.)
  - **`tables`** — one or MORE `<DataTable>`s, each `{title?, group, filter?/filters?, fields[]}` bound to
    its own output group. This is how several detail sections (24h detail AND a 7-day view) sit on ONE
    page from ONE group. **FILTER MECHANISM — for `.xpt`, use `filters` (the real BIP filter), NOT the
    XPath `filter` predicate.** An XPath predicate baked into a `DataTableField` (`/G[DAYS<=1]/COL`) yields
    **0 rows** in the interactive DataTable (the processor can't derive the repeating context). Instead give
    `filters:[{field:"DAYS", operator:"less_or_equal", value:1}]` → emits a `<filters><filter
    operator><values>` block (exactly what Oracle's own ESS dashboard uses). Operators: `equal`,
    `not_equal`, `greater`, `less`, `greater_or_equal`, `less_or_equal`, `top_n`, `is_null`, `not_null`.
    So **ONE dataset/group feeds several tables** (24h / 7d / errors-only) — a lean model + filtered tables
    beats many near-duplicate datasets. (The `filter` XPath predicate still works for RTF `for-each` and for
    `.xpt` CHART aggregation, but for an `.xpt` DataTable/Crosstab you MUST use `filters`.)
  - **`grid` (side-by-side)** — the `LayoutGrid`: `{columns:[w1,w2,…], rows:[{cells:[{…}]}]}` places a
    chart and a repeating detail table (or chart|chart, chart|crosstab) BESIDE each other in one row —
    the real "monitoring dashboard" look. **`columns` are in PIXELS** (NOT twips — that's the RTF grid);
    sum ≈ page width − margins (~1554 for a 1650px page). A monitoring dashboard is typically
    `columns:[560, 1044]`, `pageWidth: 1650`. Values like `[4200, 7800]` are twips and push cells
    OFF-PAGE → blank render. A `header:{title, bgColor, logo, banner}` becomes the top full-width band;
    logo/banner are placeholders unless the user gives images. Each cell holds ONE of
    text|chart|table|crosstab|image|kpis, with optional `colspan`/`rowspan`/`bg`/`valign`.
  Legacy `fields` = a single DataTable; `grouped` master/detail `<repeatSection>` is best-effort.
  **For "a dashboard that shows X, Y, Z" build ONE layout (grid for side-by-side, or kpis+charts+tables
  stacked) — do NOT split each section into a separate template/tab** (multiple templates = alternative
  views the user switches between, not one dashboard). Because XPT mirrors the model tree, you can
  generate a model and a matching dashboard from one request.
- **`format:"rtf"` (print / PDF / DASHBOARD)** — the FIXED-layout path. Title + `headerFields` + line-item
  table (`linesGroup` / `columns`) + totals, optional `outerGroup` master-detail, running page
  **header/footer** (`page.header` / `page.footer`), **format masks** (`format:{type:date|number|
  currency, mask}`), **sort**, static PNG **images**, **choose/when/otherwise**, subtemplate
  **imports + callTemplate**, and (in `blocks[]`) `chart` blocks. **RTF DASHBOARDS** use the **`grid`**
  block — a borderless table that places components SIDE-BY-SIDE: `{kind:"grid", columns:[w1,w2] (twips),
  rows:[{cells:[{align?, colspan?, blocks:[…]}]}]}`. Each cell hosts child blocks — a `chart` (real vector
  graphic), a `table` (rendered as a compact header+rows panel that fits a cell), `heading`/`paragraph`
  text, or an `image`. This is how you get the dense 2-column dashboard (chart | chart, chart | table) in
  a clean one-page PDF. Set a wide page (`page.widthTwips > heightTwips`, e.g. 15840×12240) for landscape.

Example:
```
createReportFile({ name:"Supplier Invoices", dataModelUrl:"…", layout:{ format:"rtf",
  title:"Open Invoices", linesGroup:"/DATA_DS/G_1", columns:[…], page:{ header:…, footer:… } } })
addReportLayout(fileId, { label:"Invoice", format:"rtf", … })   // add another template/locale
```

## Output STRUCTURE first — it drives the data model (analyze BEFORE building the model)
A report's layout requirements dictate the DATA shape, so extract them BEFORE (or together with)
building the data model — not after. From the user's ask, pull the STRUCTURAL requirements: grouping
levels (one page per customer → invoices → lines = 3 nested groups), page breaks, which columns, any
subtotals/totals, any pivot/matrix, parameters. These decide the model's `groupBy` nesting, field
list, and aggregation — get them wrong and you rebuild the model (the Cotton File failure). Ask the
user (via a `fusion-ask` block) for any structural detail that's ambiguous. STYLING (colors, fonts, exact template)
comes LATER, on top of the correct structure. So the flow is **output structure ⇒ data model ⇒
styling**, not "layout on top of whatever model exists".

## Simplicity contract — the MODEL computes, the LAYOUT displays; keep it HAND-EDITABLE
The deliverable must be modifiable by a business/BI person by hand — among equivalent solutions, pick
the most human-editable. That means:
- All computation lives in SQL (see datamodel-authoring "Computation belongs in SQL"): aggregation,
  pivots, subtotals via `ROLLUP`/`GROUPING SETS`, ranking. The template binds ready columns.
- **BANNED in templates:** cross-group XPath aggregation in cells (`sum(/DS/G[…=current()…]/QTY)`
  repeated per column), per-value predicates duplicated across columns (per-SKU literals in N cells),
  and BIP conditionals that have an SQL equivalent. A wide pivot done in the template is unmaintainable
  even when it renders (the Tama pivot) — pivot in SQL, keep the template a flat `<?FIELD?>` table.
- ONE dataset + `groupBy` is the default; two linked datasets only for a truly independent master.
- The hand-editability test before delivery: could a business user rename/move/delete a column in Word
  WITHOUT silently changing numbers? If a layout edit can corrupt data, the logic is in the wrong
  layer — move it into the model and rebuild.

## Multi-level documents (RTF `blocks[]`) — the ONLY correct 3-level pattern
"For each CUSTOMER a title page, then their INVOICES, each with LINES" (statement runs, dossiers,
grouped listings) is **NOT** the invoice shape (`outerGroup`+`linesGroup`) faked deeper with `../FIELD`
or `preceding-sibling` guards — that renders broken tables. Model the hierarchy in the DATA (nested
groups G_CUSTOMER > G_INVOICE > G_LINE), then mirror it with **`blocks[]`** — fetch the verified recipe:
`getLayoutPattern("lp:technique:rtf-multilevel-blocks")` (archetype: `lp:archetype:statement-run`).
Rules that survive any recipe: inner `forEach`/`table` groups are **RELATIVE** (no leading `/`) so they
nest; an ABSOLUTE inner group under an outer forEach is a bug (the builder rejects it).
**`splitByPage:true` on the outer forEach** = each customer starts a fresh page — this is the page-break
knob; there is no `pageBreakAfter`. Never reach "up" with `../` from a flat group — restructure the data
model instead (datamodel-authoring: nested groups).

## Charts in RTF — engine-proven shape (works locally AND on the pod)
RTF charts render fine (BI Beans vector graphics) — fetch the exact verified block shape:
`getLayoutPattern("lp:technique:rtf-chart")` (side-by-side variants: `rtf-grid-chart-chart`,
`rtf-grid-chart-kpis`).
- The RTF chart keys are **NOT** `.xpt` chart vocabulary (`type`/`dimensionField`/string
  `group`/`measures[].name`/`agg:"summation"` all belong to `.xpt`; RTF wants `graphType` +
  `group:{select,by}` + `measures:[{label,field,agg}]`). The builder auto-translates the obvious
  cases and REJECTS the rest with a fix message; read the error, don't conclude "RTF can't do charts".
- **Top-level block only.** A chart inside a `forEach` is re-emitted EVERY iteration (N copies down
  the page). "Chart on the first page" = chart block before the forEach blocks.
- `binding:"raw"` = one bar per ROW (no grouping); default grouped mode aggregates per `by` value.
- **The one silent failure:** a `select` matching 0 nodes in the data XML renders a normal-looking
  chart frame containing the literal text "No data to display" — HTTP 200, NO warning, and a page
  with other content defeats the empty-page heuristic. So (1) check `group.select` against the real
  data XML tree BEFORE rendering, (2) after rendering LOOK at the chart AREA in the Read pages, not
  just "the page has content".
- **Text probes cannot see charts**: the chart lives in a shape's alt-text (`wzDescription`), NOT in
  `<?…?>` tags — `summarizeReportLayout` tagCount 0 / extractText showing no chart markup on a
  chart-only template is NORMAL, not evidence the chart is missing. Only a visual Read proves it.

## Clarify the layout first
When a requested dashboard has MORE THAN ONE plausible block arrangement (which sections, how many,
side-by-side vs stacked, what goes top vs bottom), ASK the user (a `fusion-ask` block) which blocks and
where BEFORE building — a wrong first guess costs a full rebuild-and-recheck round trip, while the
question costs one turn.
This applies whether you're building from scratch or from a template — if a ready-made layout fits the
request, check the **using-templates** skill first (`listTemplates`); its slot model turns most of this
same clarification into naming a handful of slots instead of designing a grid from nothing.

## Building a dashboard from a natural-language brief, then ITERATING on corrections
The user describes what they want to SEE in plain language; you build a first draft (it's fine if the
style/colors differ from what they pictured), then they CORRECT it and you re-apply. Map their words to
these controls (RTF `grid` + `table`; the same ideas exist on the `.xpt` grid):

- **"two columns / a grid / side-by-side"** → an RTF `grid` block: `columns:[w1,w2] (twips, sum ≈ printable
  width)`, `rows:[{cells:[…]}]`. **"row 1: chart X on the left, table Y on the right; row 2: … left … right"**
  → one `rows[]` entry per row, two `cells` each, left cell first. A cell hosts a `chart`, a `table` (compact
  panel in-cell), text, or an image.
- **"show borders / gridlines"** → `border:true` on the `table` (and/or on a grid `cell`).
- **"shade/background the header row"** → `headerBg:"#cfe0f1"` on the table. **"give the header a dark bar"**
  → a dark `headerBg` (white header text follows). **"background/mark the <X> column"** → that column's
  `bg:"#eef3fb"` (body) and/or `headerBg`. **"shade this panel/cell"** → grid cell `bg:"#f4f8fd"`.
- **"landscape / wider"** → `page.widthTwips > heightTwips` (e.g. 15840×12240).
- **"bigger/bold title", fonts, colors** → paragraph `style:{size,bold,align,font}`; column widths via
  `width` (twips); chart `colors:[…]`, `size`.
- **"totals row"** → RTF table `totals:[{label?, field|expr, format?, span?}]` (+`totalsBg` shade);
  `span` merges leading label cells. `.xpt` `tables`: `totals:{label, aggs:{FIELD:"sum"|"count"|"avg"}}`
  emits the native totalRow.
- **"format the dates/amounts"** → `format:{type:"date"|"number"|"currency", mask}` — works on plain
  `field` columns AND on computed `expr` columns.
- **"each group on its own page"** → `splitByPage:true` on that `forEach` block (or on the top-level
  layout for the invoice shape). **"one page per table ROW"** → NOT `splitByPage` on the `table` block
  (engine-observed: header ends page 1 alone, last two rows share a page) — use a `forEach` with
  `splitByPage:true` wrapping a STATIC 1-row table (header then repeats every page):
  `getLayoutPattern("lp:technique:rtf-splitbypage-table")`.
Keep everything else the user didn't mention unchanged. Re-run `createReportFile`/`addReportLayout` (XPT is
regenerate-only; RTF you can also `modifyReportLayout`). Offer to render so they can see the correction.
Titles: use ASCII (an em-dash/curly quote can render as `?`).

## Choosing the format: `.xpt` vs RTF (decide by DELIVERY channel, then offer)
Both bind to the SAME data-model output tree (`/<root>/<group>/<field>`), so a dashboard can be built in
EITHER. The choice is the delivery channel, not the data.

- **`.xpt` — interactive grid, ALSO a good PDF.** Strengths: `LayoutGrid` puts a chart and a REPEATING
  detail table SIDE-BY-SIDE in one row; `Crosstab` pivots; live charts; `filters`. Online it drills /
  click-filters / sorts. **It also exports to a clean PDF** — teal header, donut | full bordered detail
  table, bar | top-20, both charts embedded as PNGs — PROVIDED charts are 1-measure (above) and tables
  fit their cell (the builder distributes column widths; a table that overflows its cell collapses to
  headers-only). A long detail table simply paginates (normal). Earlier "PDF linearizes" lore was wrong —
  it was caused by a faulting multi-measure chart + column overflow, both now handled.
- **RTF — fixed PRINT / PDF / Word.** Strengths: pixel-precise fixed layout, real vector charts, page
  headers/footers, format masks, sub-templates, bursting. Weakness that decides format choice: **RTF has
  NO in-cell repeating table** — a `grid` cell can hold a chart/text/image and only a COMPACT non-repeating
  panel, and a nested `<?for-each?>` table inside a cell is BROKEN in BIP (collapses to one garbage row).
  So RTF cannot do "chart on the left, repeating detail table on the right" in one row — that pattern is
  `.xpt` only. RTF does side-by-side chart|chart or chart|KPIs, plus full-width stacked tables.

**Decision rule:**
1. Dashboard with side-by-side chart + repeating detail table (the common "monitoring dashboard" look),
   viewed online OR as a PDF → **`.xpt`** (it does both; RTF physically can't do that layout).
2. Print/Word document, invoice/statement, bursting, page header/footer, or side-by-side that is only
   chart|chart / chart|KPIs → **RTF**.
3. If unsure which layout the user pictures, ASK what it should look like (one row chart+table? stacked
   sections?) rather than assuming — the answer picks the format.

**Converting between them:** same field bindings, different components — `.xpt` `DataTable`↔RTF `table`,
`.xpt` `Chart`↔RTF `chart` block, `.xpt` `Crosstab`↔RTF grouped table, `.xpt` grid cells↔RTF `grid` cells.
Rebuild the layout in the target format from the same output-field list (the data model is unchanged).
Offer conversion when the channel changes ("you want to email this now → I'll convert it to a print RTF").

## Modify an existing layout
- **RTF — surgical.** `modifyReportLayout(fileId, label?, locale?, ops[])` byte-splices Fusion
  **Word-authored** templates (form fields, docvar indirection, split tags) AND generated ones. Ops
  apply in order: `summarize` (semantic map, no change) · `remapField` (rebind a data field
  everywhere) · `renameLabel` (display text) · `addTableColumn` · `removeTableColumn` (cell widths
  rescaled, loop tags relocated) · `setDocvarCode`. Targets a `.xdoz` (template picked by label +
  locale) or a bare uploaded `.rtf`. Returns a NEW fileId; everything untouched is preserved
  byte-for-byte. It never throws on not-found — **check the `applied` result**.
- **XPT — regenerate, not surgical.** To change an XPT, rebuild the layout (`addReportLayout` /
  `setReportLayout`) rather than splicing.
- **Inspect first** with `summarizeReportLayout` (dataModel url; per-template label/type/default/format;
  per-XPT bound fields + flat/grouped; per-RTF raw `<?…?>` tags + a semantic map). `getFileSummary` on
  an `.xsb` returns the semantic map of its inner template.

Example:
```
summarizeReportLayout(fileId)                                  // read the semantic map
modifyReportLayout(fileId, { label:"Invoice", locale:"en",
  ops:[ { op:"remapField", from:"OLD_AMT", to:"NET_AMOUNT" },
        { op:"addTableColumn", after:"NET_AMOUNT", field:"TAX_AMOUNT", label:"Tax" } ] })
```

## Subtemplates (.xsb)
`createSubtemplateFile({ name, path?, templates:[{ name, blocks }] })` builds a catalog-ready container
of named blocks (`<?template:NAME?>`). Wiring rules:
- The main template **imports** it via `imports[]` (`xdoxsl:///<path>/<name>.xsb?loc=en`). **Imports are
  ALWAYS unconditional** — never inside an if/choose; an unresolvable import kills the WHOLE template.
- Then it **calls** `<?call-template:NAME?>` via a `callTemplate` block, which MAY be condition-wrapped
  (choose/when).

## Locale model
ONE `<template>` label/url can be backed by several physical locale files (`X_en.rtf`, `X_fr.rtf`; XPT
uses `en_US`). BIP resolves by the user's locale. `addLayout` with an existing label adds that locale's
file; `replaceLayout` / `modifyReportLayout` touch only the requested locale (default `en`). Uploaded
`.rtf` and `.xsb` classify as their own types.

Report the business outcome, not the tooling, and verify (`summarizeReportLayout` on the result) before
claiming a change landed. To let the user actually see the output, hand off to **rendering-and-running**.

Every create/edit returns a NEW fileId — chain further edits on the fileId the previous call RETURNED
(heed `staleWarning`/`latestFileId` in replies), and when the work is done share ONE download link:
the FINAL file's. Never post links for intermediate versions — state the final fileId explicitly.
