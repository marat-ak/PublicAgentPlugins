---
name: report-authoring
description: Use when creating or modifying a BI Publisher report layout — a report (.xdoz), an interactive XPT table, a print/invoice-grade RTF template, an XSL stylesheet for plain-text / CSV / markdown / feed output, or a subtemplate (.xsb). Covers createReportFile / addReportLayout, the surgical modifyReportLayout ops on Word-authored and generated RTF, editLayout on XPT, summarizeReportLayout, subtemplate import/call-template wiring, and the locale model.
---

# Report & layout (.xdoz / RTF / XPT / .xsb) authoring — engine-validated

Reports (`.xdoz`) bind to a data model's OUTPUT tree — **ground the model's output columns first**
(`getDataStructure` / `getDataModel` on the model). All layouts here are validated against the real BIP
engine. The layout fields (components, grid, blocks, filters, totals, formats, page) are defined in the
authoring tools' own descriptions — this skill is the design rules and the order. After building or
changing a layout, offer to render it so the user can see it — invoke the **rendering-and-running**
skill.

## Layout corpus — consult BEFORE designing (findLayoutPattern / getLayoutPattern)
The layout-pattern corpus holds render-VERIFIED archetypes (whole-report shapes), techniques (single
mechanics with exact recipes), antipatterns (broken shapes + the working alternative), and capability
notes (what BIP can do that the DSL can't yet — offer these as prose, don't fake them in the DSL).
- **At the STRUCTURE step** (before the data model): `findLayoutPattern` for archetypes with the user's
  own words — the matching archetype names the grouping levels, page breaks, and sections, which then
  drive the model's grouping.
- **While building**: `findLayoutPattern` for each distinct mechanic ("totals row", "landscape",
  "page header"); `getLayoutPattern` returns the full verified recipe — PREFER a corpus recipe over
  improvising; its pitfalls are engine-observed, not theory.
- **A result may COMPOSE several rows** — one archetype + several techniques merged into one block tree
  or grid; the composition notes say what combines.
- **On a builder error naming a corpus id, fetch that row** — the builders cross-reference the corpus.
- A technique withheld as format-exclusive (e.g. xpt-only side-by-side chart+repeating-table) when you
  asked for the other format: switch format or pick the alternative it names, don't force it.
- The corpus is about VISUAL layouts. A capability note calling eText "unsupported" concerns Oracle eText
  templates only — it does NOT mean text output is impossible: text output is the `xsl` kind (Create,
  below), written directly.

## Create
`createReportFile` / `addReportLayout`. Three layout kinds:
- **`.xpt` (interactive table / DASHBOARD)** — fully generatable; binds to the model's output tags. A
  SINGLE `.xpt` layout is a whole dashboard — KPI cards (headline single-value metrics — do **NOT**
  render headline numbers as a table), interactive charts, and one or more data tables, stacked, or
  placed side by side in a grid (the real "monitoring dashboard" look: a chart beside a repeating detail
  table).
  - **A chart binds EXACTLY ONE measure**; multi-series comes from a series DIMENSION field, never from
    extra measure columns (wide pre-aggregated columns are the wrong shape for an interactive chart —
    feed it detail rows + a count).
  - **Scope a table / crosstab with its real BIP filters**, never an XPath predicate (0 rows in an
    interactive DataTable) — so ONE dataset/group feeds several tables (24h / 7d / errors-only); a lean
    model + filtered tables beats many near-duplicate datasets.
  - **For "a dashboard that shows X, Y, Z" build ONE layout** (grid for side-by-side, or stacked) — do
    NOT split each section into a separate template/tab (multiple templates = alternative views the user
    switches between, not one dashboard). Because XPT mirrors the model tree, you can generate a model
    and a matching dashboard from one request.
- **RTF (print / PDF / DASHBOARD)** — the FIXED-layout path: title, header fields, line-item table,
  totals, master-detail, running page header/footer, format masks, sort, static images, conditionals,
  subtemplate imports + calls, and chart blocks. **RTF DASHBOARDS** use the grid block — a borderless
  table that places components SIDE-BY-SIDE (chart | chart, chart | KPIs) in a clean one-page PDF; a wide
  page for landscape.
- **`xsl` (plain TEXT — text / markdown / CSV / fixed-width / flat file / feed; also XML or HTML)** — a
  complete XSLT stylesheet YOU write, run by BIP's XSL engine over the model's output XML. It is the ONLY
  kind whose output can be `text` — RTF and `.xpt` templates never allow it — so any ask for text output
  gets an xsl layout, never RTF/XPT.
  - `xml` / `csv` on any template are DATA outputs (the stylesheet is not applied) — a CSV with chosen
    columns/headers/quoting is a text stylesheet run as `text`.
  - The simplicity contract (below) holds: SQL computes, the stylesheet only prints ready columns.
  - Verify with `renderTemplate` (it compiles + runs the stylesheet) before upload; running it on the pod
    needs it to be the report's default template (rendering-and-running §1, §2).
  - Oracle **eText** templates (fixed-position bank/EFT payment files) are NOT generatable — they stay
    hand-authored; say so, never present an xsl text file as one.

## Output STRUCTURE first — it drives the data model (analyze BEFORE building the model)
A report's layout requirements dictate the DATA shape, so extract them BEFORE (or together with)
building the data model — not after. From the user's ask, pull the STRUCTURAL requirements: grouping
levels (one page per customer → invoices → lines = 3 nested groups), page breaks, which columns, any
subtotals/totals, any pivot/matrix, parameters. These decide the model's grouping nesting, field
list, and aggregation — get them wrong and you rebuild the model (the customer-A requirements-doc failure). Ask the
user (per the ask protocol) for any structural detail that's ambiguous. STYLING (colors, fonts, exact template)
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
  even when it renders (the customer-A pivot) — pivot in SQL, keep the template a flat `<?FIELD?>` table.
- ONE grouped dataset is the default; two linked datasets only for a truly independent master.
- The hand-editability test before delivery: could a business user rename/move/delete a column in Word
  WITHOUT silently changing numbers? If a layout edit can corrupt data, the logic is in the wrong
  layer — move it into the model and rebuild.

## Multi-level documents (RTF block tree) — the ONLY correct 3-level pattern
"For each CUSTOMER a title page, then their INVOICES, each with LINES" (statement runs, dossiers,
grouped listings) is **NOT** the invoice shape (outer group + lines group) faked deeper with `../FIELD`
or `preceding-sibling` guards — that renders broken tables. Model the hierarchy in the DATA (nested
groups G_CUSTOMER > G_INVOICE > G_LINE), then mirror it with nested blocks — the verified recipe is
corpus pattern `lp:technique:rtf-multilevel-blocks` (archetype `lp:archetype:statement-run`), fetched
with `getLayoutPattern`. Rules that survive any recipe: inner loops / tables are **RELATIVE** (no leading
`/`) so they nest; an absolute inner group under an outer loop iterates the whole document — a bug.
**Split-by-page on the outer loop** = each customer starts a fresh page — this is the page-break knob.
Never reach "up" with `../` from a flat group — restructure the data model instead (datamodel-authoring:
nested groups).

## Charts in RTF — engine-proven shape (works locally AND on the pod)
RTF charts render fine (BI Beans vector graphics) — fetch the exact verified block shape: corpus
patterns `lp:technique:rtf-chart` (side-by-side variants: `rtf-grid-chart-chart`, `rtf-grid-chart-kpis`).
- The RTF chart vocabulary is NOT the `.xpt` chart vocabulary. The builder auto-translates the obvious
  cases and REJECTS the rest with a fix message; read the error, don't conclude "RTF can't do charts".
- **Top-level block only.** A chart inside a loop is re-emitted EVERY iteration (N copies down the
  page). "Chart on the first page" = chart block before the loop blocks.
- **The one silent failure:** a chart group selection matching 0 nodes in the data XML renders a
  normal-looking chart frame containing the literal text "No data to display" — HTTP 200, NO warning,
  and a page with other content defeats the empty-page heuristic. So (1) check the chart's group path
  against the real data XML tree BEFORE rendering, (2) after rendering LOOK at the chart AREA in the Read
  pages, not just "the page has content".
- **Text probes cannot see charts**: the chart lives in a shape's alt-text (`wzDescription`), NOT in
  `<?…?>` tags — `summarizeReportLayout` showing no tags / extracted text showing no chart markup on a
  chart-only template is NORMAL, not evidence the chart is missing. Only a visual Read proves it.

## Clarify the layout first
When a requested dashboard has MORE THAN ONE plausible block arrangement (which sections, how many,
side-by-side vs stacked, what goes top vs bottom), ASK the user (per the ask protocol) which blocks and
where BEFORE building — a wrong first guess costs a full rebuild-and-recheck round trip, while the
question costs one turn.
This applies whether you're building from scratch or from a template — if a ready-made layout fits the
request, check the **using-templates** skill first (`listTemplates`); its slot model turns most of this
same clarification into naming a handful of slots instead of designing a grid from nothing.

## Building a dashboard from a natural-language brief, then ITERATING on corrections
The user describes what they want to SEE in plain language; you build a first draft (it's fine if the
style/colors differ from what they pictured), then they CORRECT it and you re-apply. Map their words —
"two columns / side-by-side", "row 1: chart X left, table Y right", borders / gridlines, a shaded or dark
header row, a marked column, a shaded panel, landscape / wider, bigger / bold title, fonts, colors,
column widths, a totals row, date / amount formats, each group on its own page — to the layout's own
controls (the authoring tools' descriptions name each one). **"One page per table ROW"** is NOT
split-by-page on the table (engine-observed: header ends page 1 alone, last two rows share a page) — use
the corpus recipe `lp:technique:rtf-splitbypage-table`.
Keep everything else the user didn't mention unchanged. Re-run the create / add-layout call (XPT is
regenerated or edited with `editLayout`; RTF you can also `modifyReportLayout`). Offer to render so they
can see the correction. Titles: use ASCII (an em-dash/curly quote can render as `?`).

## Choosing the format: `.xpt` vs RTF (decide by DELIVERY channel, then offer)
Output that is TEXT rather than a visual document (text / markdown / CSV / flat file / feed) is `xsl`
(Create, above) — the choice below is only between the two VISUAL kinds.
Both bind to the SAME data-model output tree (`/<root>/<group>/<field>`), so a dashboard can be built in
EITHER. The choice is the delivery channel, not the data.

- **`.xpt` — interactive grid, ALSO a good PDF.** Strengths: `LayoutGrid` puts a chart and a REPEATING
  detail table SIDE-BY-SIDE in one row; `Crosstab` pivots; live charts; filters. Online it drills /
  click-filters / sorts. **It also exports to a clean PDF** — teal header, donut | full bordered detail
  table, bar | top-20, both charts embedded as PNGs — PROVIDED charts are 1-measure (above) and tables
  fit their cell (the builder distributes column widths; a table that overflows its cell collapses to
  headers-only). A long detail table simply paginates (normal). Earlier "PDF linearizes" lore was wrong —
  it was caused by a faulting multi-measure chart + column overflow, both now handled.
- **RTF — fixed PRINT / PDF / Word.** Strengths: pixel-precise fixed layout, real vector charts, page
  headers/footers, format masks, sub-templates, bursting. Weakness that decides format choice: **RTF has
  NO in-cell repeating table** — a grid cell can hold a chart/text/image and only a COMPACT non-repeating
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

**Iterate LOCALLY until the user approves (RTF, XSL).** When modifying a layout AFTER a rendered result was
already shared: edit → render **locally** (`renderTemplate`, reusing the real data XML from the earlier
pod run) → Read + verify → share the new PDF → repeat until the user **approves**. Do NOT upload /
`runReport` on the pod per tweak (uploads never overwrite → fresh path each time, WAF-throttled, proves
nothing while the layout is still moving). Pod upload + render happen **once, after approval** — see
rendering-and-running §7. `.xpt` is the exception (no local render — pod each time).
- **Inspect first** with `summarizeReportLayout` (an `.xsb` through `getFileSummary`).
- **RTF — surgical.** `modifyReportLayout` byte-splices Fusion **Word-authored** templates (form fields,
  docvar indirection, split tags) AND generated ones; everything untouched is preserved byte-for-byte. It
  never fails on not-found — **check what it reports applied**.
- **XPT — surgical too:** `editLayout` on the component tree (`getLayoutStructure` first for the ids), or
  regenerate the layout.
- **XSL — regenerate** the stylesheet (replace the layout) rather than splicing.

## Subtemplates (.xsb)
`createSubtemplateFile` builds a catalog-ready container of named blocks (`<?template:NAME?>`). Wiring
rules:
- The main template **imports** it (the create reply gives the exact import URL). **Imports are ALWAYS
  unconditional** — never inside an if/choose; an unresolvable import kills the WHOLE template.
- Then it **calls** `<?call-template:NAME?>` via a call block, which MAY be condition-wrapped
  (choose/when).

## Locale model
ONE template label can be backed by several physical locale files (`X_en.rtf`, `X_fr.rtf`, `X_en.xsl`;
XPT uses `en_US`); BIP resolves by the user's locale. Adding or replacing a layout, or modifying an RTF,
touches only the requested locale. An uploaded bare `.rtf` or `.xsb` is its own target (its own fileId),
not a locale inside a report.

Report the business outcome, not the tooling, and verify (`summarizeReportLayout` on the result) before
claiming a change landed. To let the user actually see the output, hand off to **rendering-and-running**.

Every create/edit returns a NEW fileId — chain further edits on the fileId the previous call RETURNED
(a reply warning that you targeted an old version names the latest one), and when the work is done
present ONE file per deliverable with `ui_present_file`: the FINAL version. Never present (or link)
intermediate versions.
