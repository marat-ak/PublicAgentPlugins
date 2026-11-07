---
name: rendering-and-running
description: Use to render an authored/uploaded template + data to a real PDF/HTML/RTF/XLSX/text file, to LOOK at any produced output (Read paths, PDF pages), or to download, browse, run, or upload a catalog object on the live Fusion pod. Covers renderTemplate, the visual verify loop, prepareDataModelTest / prepareReportForPod pod flows, the fusion-pod MCP tools (downloadCatalogObject / listCatalogFolder / runReport / uploadCatalogObject), and comparing two reports or data models (compareCatalogObjects / compareCatalogDetail).
---

# Rendering, seeing, and running

Turn an authored artifact into something the user can SEE, verify it WITH YOUR OWN EYES, and prove it
runs on the live pod. Render/pod tools are gated — each errors clearly when its service isn't
configured. Each tool's description is the reference for its arguments and results; this skill is the
order and the rules.

## 0. SEEING files — the `path` + Read loop (MANDATORY verification)
Tool results that produce a viewable file (rendered PDF/HTML/XML, extracted entries, uploads, pod
outputs) include a **`path`**. Open it with the built-in **Read** tool — PDFs render as PAGES (images),
pictures as pixels, XML/text as text.

- **After EVERY render you MUST Read the output and LOOK at it before claiming success**: borders,
  fills, alignment, wrapping, page breaks, formatted dates/amounts — compared against what the user
  asked (and their mockup image, which also carries a `path`).
- **PDFs: ALWAYS a few pages at a time (start with the first three)** — never read a PDF whole; a large
  unpaged PDF overflows the conversation (the gate will refuse it).
- Read accepts ONLY `path` values returned by this session's tools; anything else is denied.
- A render that warns the output looks EMPTY = the template's for-each matched 0 nodes; re-check the
  group paths (`summarizeReportLayout`) against the data XML before re-rendering.
- Fix → re-render → Read again. Iterate until it matches; only then report success.

## 0b. Showing files to the USER — `ui_present_file`
The user sees a file ONLY when you present it with `ui_present_file`, in the mode the request implies
(preview vs download). Present the FINAL version only (never an intermediate of an edit chain), never
invent a fileId, never write a link for a file in your text. Embedded hosts show a download button
only — never claim the file was opened there.

## 1. Local render — `renderTemplate` (bip-render engine, RTF + XSL)
`renderTemplate` renders an RTF template (from a `.xdoz`, or a bare `.rtf`) or an **xsl** template
(report-authoring) with XML data to a real file → Read it (rule 0), then present the final version
(rule 0b). The xsl template is compiled and run by BIP's own XSL engine in secure mode, as on the pod —
this render is the stylesheet's only pre-upload check, so always run it.
`.xpt` (interactive) layouts do NOT render locally — pod only (below). Say so; never silently
substitute an RTF approximation.

## 2. The live Fusion pod — `fusion-pod` MCP
- **`listCatalogFolder`** — browse. Read-only.
- **`downloadCatalogObject`** — fetch a real `.xdoz`/`.xdmz` into a session file (filed in that pod's
  folder under its catalog path; downloading again replaces that entry). Inspect it with
  `summarizeReportLayout` / `getFileSummary`, pull one entry with `extractEntry`, or render it. Read-only.
- **`runReport`** — execute on the real pod: non-mutating, the STRONGEST verification; **Read the
  output**. A format the user asked for that the report's default template does not offer is fixed in
  the template (text output = an xsl layout made the default) — never dropped.
- **`runSql`** — run a query directly on the pod, rows inline. Use it for grain COUNT-probes, to
  sanity-run a grounded query before building a data model, for small lookups, and to run existing SQL
  as is (no review — the kernel's review rule) — it runs the SQL as written (plain); SQL the kernel's
  data-access rule secures runs through `runSecuredSql` instead (**data-access-security**). An Oracle
  error points into your SQL — fix it and retry.
- **Live metadata, search → describe** (see `datamodel-authoring` for when): `searchFlexfields` →
  `describeFlexfield`, `searchCustomObjects` → `describeCustomObject` — search with the words you have,
  describe the exact hit. **Never hand-write `ADF_*` / `FND_DF_*` joins — these tools are those joins.**
  Read-only.
- **`uploadCatalogObject`** — create a catalog object. **MUTATES the pod.** In **step-by-step** mode
  CONFIRM path + payload with the user first; in **everything-at-once** mode the mode choice already
  authorized uploads under your per-user area — proceed without a per-upload ask. Upload the session
  artifact by its fileId. Uploads never overwrite: after a fix, prepare again for fresh paths.
- **`listSessionFolders`** — this conversation's `working` folder plus one folder per pod, whichever
  identity is bound now.
- **`compareCatalogObjects` → `compareCatalogDetail`** — THE way to compare two data models or two
  reports (never diff them yourself). Download both sides first (`identity_select` between pods / users),
  compare, then fetch the detail of the rows you need and quote them.

Pod caveats: WAF-throttled — keep calls sequential; a `403 text/html "Access Denied"` is a rate ban,
not permissions.

## 3. Pod paths — NEVER hand-pick
You may only write under your per-user area `/Custom/XXXGNIMSYS/Agent/<user>/…` — and you never type
it yourself: **the prepare tools compute every path**. Any absolute catalog path you invent (e.g.
`/Custom/AI/…`) is wrong and will be rejected.

## 4. Test a DATA MODEL on the pod — `prepareDataModelTest` (ALWAYS before building the report)
The pod has no run-datamodel op, so the tool builds a no-layout report bound to the model.
1. `prepareDataModelTest` → the test report, the aligned per-user paths, the model's parameters.
2. Parameters → ASK the user a value per parameter. Step-by-step mode: CONFIRM (mutation) first;
   everything-at-once: proceed. Then upload BOTH by fileId to the returned paths.
3. Run the test report for its data XML (`runReport`) → **Read the returned XML** — real rows prove
   the SQL runs. Errors here mean FIX THE MODEL before any layout work.

## 5. Run a REAL report (with layouts) on the pod — `prepareReportForPod`
Never bind a report to a pod path by hand and never upload a report+DM pair without this:
1. `prepareReportForPod` with the report and its data model → the report rebound to the model's pod
   path, the aligned paths, the parameters.
2. Upload BOTH by fileId to those exact paths (step-by-step mode: CONFIRM first; skip the DM upload
   if this very fileId was already uploaded to that exact path in this session).
3. `runReport` the report (PDF; an xsl default template: its text / txml / html output) → **Read the
   render (a few pages) and verify** per rule 0.

## 6. Pod down ≠ dead end: RTF and XSL ALWAYS render locally
An RTF or xsl layout renders locally regardless of the pod. If the pod is unavailable or failing (401, WAF
ban, not configured), do **NOT** stop and do NOT ask permission to render — deliver anyway:
- Have real data XML from an earlier pod run → render locally with it (full-fidelity result).
- No real data → render locally with generated sample data, name it `…SAMPLE-DATA.pdf` and SAY it is
  sample data, then state exactly which pod step was skipped and why (so the user can retry live later).
`.xpt` is the one thing that cannot render locally — pod down + `.xpt` → report the blocker and ask
(never silently substitute an RTF approximation). Never silently change the deliverable.

## 7. Modifying after you've SHARED it — RTF / XSL iterate LOCALLY until approved
Once you've shared a rendered output and the user asks to change the layout, and the template is **RTF**
or **xsl**:
edit → `renderTemplate` **LOCALLY** (reuse the real data XML file from the earlier pod run — full
fidelity, §6) → **Read + verify** (§0) → share the new PDF → repeat until the user **APPROVES**. Do NOT
re-upload / re-run on the pod per tweak: pod uploads never overwrite (a fresh subfolder each time), are
WAF-throttled, and prove nothing while the layout is still changing. Go to the pod (`prepareReportForPod`
→ upload → `runReport`, §5) **only ONCE, AFTER approval**, and only when the deliverable is a runnable
report object on Fusion. (`.xpt` can't render locally — those still modify on the pod.)

## The loop
Author (grounded) → render locally → **Read + verify visually** → fix/iterate → live delivery →
prepare* → upload (confirm first only in step-by-step mode) → runReport → **Read + verify again** →
report the business outcome + `ui_present_file` for the ONE final version. Pod dead + RTF/XSL → local render per rule 6, still
delivered. Never claim "works"/"matches" without having LOOKED at the output this turn.
