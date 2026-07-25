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
objects and to verify an authored object actually runs there. Payloads are inline base64.

- **`listCatalogFolder(path)`** — browse a catalog folder → `{count, items}`. Safe (read-only).
- **`downloadCatalogObject(path)`** — fetch a REAL report/data-model (`.xdoz`/`.xdmz`) from the live
  catalog → its bytes, so you can inspect or modify it with the authoring tools. Safe (read-only).
- **`runReport(path, format?, parameters?)`** — execute a report on the real pod and return its output
  (`format?`: pdf default / html / xml / csv / excel; `parameters?`: `[{name, values[]}]`). Non-mutating
  and the **STRONGEST verification** — it proves the object renders with real data. Show sample rows /
  the rendered PDF before finalizing.
- **`uploadCatalogObject(path, base64, type?)`** — create/replace a catalog object. **This MUTATES the
  live pod.** CONFIRM the exact path + payload with the user before calling it. Never upload on your own
  initiative.

Pod caveats: requests are **WAF-throttled** (Akamai) — do not parallelize or burst; the client rate-
gates and backs off for you, but keep calls sequential. A `403 text/html "Access Denied"` is a rate
ban (wait it out), not a permission error.

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
