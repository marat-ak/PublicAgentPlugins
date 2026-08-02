---
name: rendering-and-running
description: Use to render an authored/uploaded template + data to a real PDF/HTML/RTF/XLSX file, or to download, browse, run, or upload a catalog object on the live Fusion pod. Covers renderTemplate (bip-render engine) and the fusion-pod MCP tools (downloadCatalogObject / listCatalogFolder / runReport / uploadCatalogObject), and the author -> render -> show -> (optional) upload+run-verify loop.
---

# Rendering & running

Two capabilities that turn an authored artifact into something the user can SEE, and let you verify
against the live pod. Both are **gated/optional** — only available when the render service and/or pod
MCP are configured; each tool errors clearly if not. In every case the raw bytes go to the file store,
NOT into your context — you get a `fileId` and hand the user a download link.

## 1. Render a template to a real file — `renderTemplate` (bip-render engine, BYO Oracle jars)
Renders an RTF template + XML data to **pdf / html / rtf / xlsx / xml / csv** through the real Oracle
BI Publisher engine.

`renderTemplate({ fileId, label?, locale?, xml?, dataFileId?, format?, subtemplateFileIds? })`
- `fileId` — the template: a report (`.xdoz`) or a bare uploaded `.rtf`.
- `label` / `locale` — `.xdoz` only: which template + locale RTF to render (default: the report's
  default rtf, locale `en`).
- `xml` **or** `dataFileId` — the data: inline XML string, or the `fileId` of an uploaded XML/text data
  file (mutually exclusive; one is required).
- `format` — output format, default `pdf`.
- `subtemplateFileIds` — `fileId`s of `.xsb`/`.rtf` subtemplates the template imports; each is compiled
  and its `<?import:…?>` is resolved offline.

Returns `{ fileId, name, contentType, downloadHint }` — the bytes are not shown to you. **After you
create or modify any layout, OFFER to render it** and give the user the downloadable output.

Example:
```
renderTemplate({ fileId:"<the .xdoz>", label:"Invoice", format:"pdf",
                 dataFileId:"<uploaded sample.xml>", subtemplateFileIds:["<the .xsb>"] })
// → { fileId, name:"output.pdf", contentType:"application/pdf", downloadHint } → share the link
```

## 2. The live Fusion pod — `fusion-pod` MCP (SOAP: download / browse / run / upload)
These talk to a **real Oracle Fusion pod** over BI Publisher SOAP. Use them to inspect real catalog
objects and to verify an authored object actually runs there.

- **`listCatalogFolder(path)`** — browse a catalog folder → `{count, items}`. Safe (read-only).
- **`downloadCatalogObject(path)`** — fetch a REAL report/data-model (`.xdoz`/`.xdmz`) from the live
  catalog → its bytes, so you can inspect or modify it with the authoring tools. Safe (read-only).
- **`runReport(path, format?, parameters?)`** — execute a report on the real pod and return its output
  (`format?`: pdf default / html / xml / csv / excel; `parameters?`: `[{name, values[]}]`). Non-mutating
  and the **STRONGEST verification** — it proves the object renders with real data. Show sample rows /
  the rendered PDF before finalizing.
- **`uploadCatalogObject(path, fileId? | base64?, type?)`** — create/replace a catalog object. **This
  MUTATES the live pod.** CONFIRM the exact path + payload with the user before calling it. Never upload
  on your own initiative. **For a session-authored artifact (anything with a fileId from
  createDataModelFile / createReportFile / edit* / updateReportFile) pass its `fileId`** — the file's
  content is attached automatically on OUR side (the file-bridge wrapper), so this works no matter
  where the pod MCP runs. `base64` is ONLY for bytes you actually hold. **NEVER put a fileId into the
  `base64` field** — that ships garbage and fails with "Invalid object definition".

Pod caveats: requests are **WAF-throttled** (Akamai) — do not parallelize or burst; the client rate-
gates and backs off for you, but keep calls sequential. A `403 text/html "Access Denied"` is a rate
ban (wait it out), not a permission error.

## Test a DATA MODEL against the pod (no-layout report → XML)
A data model (`.xdmz`) has no layout, and the pod has **no run-datamodel op** — so to test one on the
live pod you upload the model **plus a no-layout report bound to it**, then run that report as **XML**
and show the returned dataset XML. The `prepareDataModelTest` authoring tool builds that report for you.

**Offer this only when the `fusion-pod` MCP (`uploadCatalogObject` + `runReport`) is available** — it is
the strongest verification that the model's SQL actually returns data on the real pod.

Flow (after you've authored a data model and offered its download):
1. **ASK** the user: *"Want me to test this data model against the pod?"* (uploads mutate the real pod).
2. If yes → **`prepareDataModelTest({ fileId: <the .xdmz> })`** → returns
   `{ reportFileId, reportName, dataModelPodPath, reportPodPath, params }`. It builds a no-layout
   report `.xdoz` whose `dataModelUrl` already equals `dataModelPodPath` (both under the shared test
   folder, env `POD_TEST_FOLDER`, default `/Custom/XXXGNIMSYS/Agent`), so the binding resolves once both
   are uploaded. Pass `base` to override the folder.
3. If `params` is non-empty → **ASK the user a value for EACH parameter**, showing its `name` and
   `defaultValue`. Skip this step when there are no params.
4. **CONFIRM, then upload BOTH** (this MUTATES the pod) via `uploadCatalogObject` — by FILE ID:
   - `uploadCatalogObject({ path: dataModelPodPath, fileId: <the .xdmz's fileId>, type: "xdmz" })`
   - `uploadCatalogObject({ path: reportPodPath, fileId: reportFileId, type: "xdoz" })`
5. **`runReport(reportPodPath, format="xml", parameters)`** — `parameters` as `[{name, values:[…]}]`
   from the user's answers — and **show the returned dataset XML** (the model's output).

Notes: keep uploads sequential (WAF). Uploads never leave the test folder. v1 is datamodel→XML only —
no layout/output-format testing, no cleanup (test objects stay in the folder).

## Blocked ≠ improvise
If a blocker prevents the output the user actually asked for (e.g. live-data render impossible):
**STOP, report the blocker plainly, and ASK before any workaround.** Specifically:
- Do NOT render with made-up sample data unless the user opts in — and if they do, put it in the file
  name (`…SAMPLE-DATA.pdf`) as well as the message.
- Do NOT modify the artifact as a workaround (e.g. adding an RTF print layout to render something)
  without asking first — that changes the deliverable.
- `.xpt` (interactive) layouts render ONLY via the pod (`uploadCatalogObject` + `runReport`) — the
  local `renderTemplate` engine is RTF-only. If the user wants to SEE an `.xpt` dashboard, the pod
  path is the only path; say so rather than silently substituting an RTF approximation.

## The author -> render -> show -> (optional) upload + run-verify loop
The recommended pattern when authoring against a live pod:
1. **Author / modify** the object with the datamodel-authoring or report-authoring tools (grounded SQL,
   verified structure).
2. **Render** it locally with `renderTemplate` and give the user the PDF/HTML/XLSX to review — no pod
   mutation, fast feedback.
3. If the user wants it live: **`uploadCatalogObject`** (after explicit confirmation of path + payload).
4. **`runReport`** on the uploaded path — the strongest verification — and show the returned output.
   Use `downloadCatalogObject` / `listCatalogFolder` for read-back grounding.

Prefer render + `runReport` for verification before you ever tell the user a report "works"; report the
business outcome and the download link, not the tool names.
