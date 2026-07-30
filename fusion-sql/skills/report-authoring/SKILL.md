---
name: report-authoring
description: Use when creating or modifying a BI Publisher report layout — a report (.xdoz), an interactive XPT table, a print/invoice-grade RTF template, or a subtemplate (.xsb). Covers createReportFile / addReportLayout, the surgical modifyReportLayout ops on Word-authored and generated RTF, summarizeReportLayout, subtemplate import/call-template wiring, and the locale model.
---

# Report & layout (.xdoz / RTF / XPT / .xsb) authoring — engine-validated

Reports (`.xdoz`) bind to a data model's OUTPUT tree — **ground the model's output columns first**
(`getDataStructure` / `getDataModel(fileId,"structure")` on the model). All layouts here are validated
against the real BIP engine. After building or changing a layout, offer to render it so the user can
see it — invoke the **rendering-and-running** skill.

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
