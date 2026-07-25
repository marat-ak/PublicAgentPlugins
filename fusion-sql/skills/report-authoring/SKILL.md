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
- **`.xpt` (interactive table)** — fully generatable. Binds `/<root>/<group>/<COL>` (e.g.
  `/DATA_DS/G_1/PLAN_NAME`) to the datamodel output tags; flat `<DataTable>` (reliable) or `grouped`
  master/detail `<repeatSection>` (best-effort). Because XPT mirrors the model tree, you can generate a
  model and a matching XPT from one request.
- **`format:"rtf"` (print / invoice-grade)** — supports title + `headerFields` + line-item table
  (`linesGroup` / `columns`) + totals, optional `outerGroup` master-detail, running page
  **header/footer** (`page.header` / `page.footer`), **format masks** (`format:{type:date|number|
  currency, mask}` on columns/runs), **sort**, static PNG **images**, **choose/when/otherwise**, and
  subtemplate **imports + callTemplate**.

Example:
```
createReportFile({ name:"Supplier Invoices", dataModelUrl:"…", layout:{ format:"rtf",
  title:"Open Invoices", linesGroup:"/DATA_DS/G_1", columns:[…], page:{ header:…, footer:… } } })
addReportLayout(fileId, { label:"Invoice", format:"rtf", … })   // add another template/locale
```

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
