---
name: rendering-and-running
description: Use to render an authored/uploaded template + data to a real PDF/HTML/RTF/XLSX file, to LOOK at any produced output (Read paths, PDF pages), or to download, browse, run, or upload a catalog object on the live Fusion pod. Covers renderTemplate, the visual verify loop, prepareDataModelTest / prepareReportForPod pod flows, and the fusion-pod MCP tools (downloadCatalogObject / listCatalogFolder / runReport / uploadCatalogObject).
---

# Rendering, seeing, and running

Turn an authored artifact into something the user can SEE, verify it WITH YOUR OWN EYES, and prove it
runs on the live pod. Render/pod tools are gated — each errors clearly when its service isn't
configured.

## 0. SEEING files — the `path` + Read loop (MANDATORY verification)
Tool results that produce a viewable file (rendered PDF/HTML/XML, extracted entries, uploads, pod
outputs) include a **`path`** field. Open it with the built-in **Read** tool — PDFs render as PAGES
(images), pictures as pixels, XML/text as text.

- **After EVERY render you MUST Read the output and LOOK at it before claiming success**: borders,
  fills, alignment, wrapping, page breaks, formatted dates/amounts — compared against what the user
  asked (and their mockup image, which also carries a `path`).
- **PDFs: ALWAYS pass `pages` (start `pages:"1-3"`)** — never read a PDF whole; a large unpaged PDF
  overflows the conversation (the gate will refuse it).
- Read accepts ONLY `path` values returned by this session's tools; anything else is denied.
- A render result may carry `warning: "output looks EMPTY…"` — the template's for-each matched 0
  nodes; re-check group paths (`summarizeReportLayout`) against the data XML before re-rendering.
- Fix → re-render → Read again. Iterate until it matches; only then report success.

## 1. Local render — `renderTemplate` (bip-render engine, RTF only)
`renderTemplate({ fileId, label?, locale?, xml? | dataFileId, format?, subtemplateFileIds? })` renders
an RTF template (from a `.xdoz` by label/locale, or a bare `.rtf`) + XML data to
**pdf / html / rtf / xlsx / xml / csv**. Returns `{ fileId, path, warning?, downloadHint }` → Read the
`path` (rule 0), then share ONE download link for the final version.
`.xpt` (interactive) layouts do NOT render locally — pod only (below). Say so; never silently
substitute an RTF approximation.

## 2. The live Fusion pod — `fusion-pod` MCP
- **`listCatalogFolder(path)`** — browse. Read-only.
- **`downloadCatalogObject(path)`** — fetch a real `.xdoz`/`.xdmz`. The bytes go to the session store;
  you get `{fileId, summary}` (entries/templates manifest) — NOT raw bytes. Inspect via
  `summarizeReportLayout` / `getFileSummary`, pull one entry with `extractEntry`, or render it by
  fileId. Read-only.
- **`runReport(path, format?, parameters?)`** — execute on the real pod. Output lands in the store →
  `{fileId, path, contentType}`; **Read the `path`** to see the data XML / rendered PDF. Non-mutating;
  the STRONGEST verification.
- **`uploadCatalogObject(path, fileId?, type?)`** — create a catalog object. **MUTATES the pod —
  CONFIRM path + payload with the user first.** Pass the session artifact's `fileId` (bytes attach on
  our side); `base64` only for bytes you actually hold; NEVER a fileId inside `base64`.
  **Uploads do NOT overwrite an existing path** ("already exists") — never re-upload to the same path
  after a fix; use a FRESH per-run subfolder (the prepare tools hand you fresh paths).

Pod caveats: WAF-throttled — keep calls sequential; a `403 text/html "Access Denied"` is a rate ban,
not permissions.

## 3. Pod paths — NEVER hand-pick
You may only write under your per-user area `/Custom/XXXGNIMSYS/Agent/<user>/…` — and you never type
it yourself: **the prepare tools compute every path**. Any absolute catalog path you invent (e.g.
`/Custom/AI/…`) is wrong and will be rejected.

## 4. Test a DATA MODEL on the pod — `prepareDataModelTest` (ALWAYS before building the report)
The pod has no run-datamodel op, so the tool builds a no-layout report bound to the model.
1. `prepareDataModelTest({fileId})` → `{reportFileId, dataModelPodPath, reportPodPath, params}` —
   aligned per-user paths; the test report's dataModelUrl already equals `dataModelPodPath`.
2. `params` non-empty → ASK the user a value per param. CONFIRM (mutation), then upload BOTH by fileId
   to the returned paths.
3. `runReport(reportPodPath, format="xml", parameters)` → **Read the returned XML** — real rows prove
   the SQL runs. Errors here mean FIX THE MODEL before any layout work.

## 5. Run a REAL report (with layouts) on the pod — `prepareReportForPod`
Never set a report's dataModelUrl by hand and never upload a report+DM pair without this:
1. `prepareReportForPod({reportFileId, dataModelFileId})` → rebinds the report's `<dataModel url>` to
   the DM's actual pod path; returns `{reportFileId (rebound), dataModelPodPath, reportPodPath,
   rebound, params}`.
2. CONFIRM, upload BOTH by fileId to those exact paths (skip the DM upload if this very fileId was
   already uploaded to that exact path in this session).
3. `runReport(reportPodPath, format:"pdf", parameters)` → **Read the render (pages!) and verify** per
   rule 0.

## 6. Blocked ≠ improvise
If the asked-for output is impossible (e.g. live-data render unavailable): STOP, report the blocker,
ASK before any workaround. No made-up sample data without opt-in (and then mark `…SAMPLE-DATA.pdf`);
no silently changing the deliverable.

## The loop
Author (grounded) → render locally → **Read + verify visually** → fix/iterate → user wants it live →
prepare* → confirm → upload → runReport → **Read + verify again** → report the business outcome + ONE
final download link. Never claim "works"/"matches" without having LOOKED at the output this turn.
