#!/usr/bin/env node
// PreToolUse hook (matcher matches the MUTATING authoring build tools — see REQUIRED below; the
// hooks.json matcher alternation must mirror its tool names): the deterministic backstop to the
// thin-kernel router. DENY the build tool until every skill it requires was loaded THIS session
// (recorded by skill-record.mjs), returning a clear "load X first" reason so the model loads the
// skill(s) and retries. Gates ONLY mutating build tools — NEVER read-only/inspection tools
// (getDataModel, getDataStructure, summarizeReportLayout, …), converters, prepare*/upload*, or
// renderTemplate/runReport.
//
//   datamodel-mutating tools  -> datamodel-authoring (structural discipline: fileId chain, surgical
//                                edits, grouping shapes); the SQL-carrying ones (createDataModelFile,
//                                setDatasetSql) ALSO require fusion-sql-review (grounding workflow +
//                                the aggregation ladder)
//   report/layout-mutating    -> report-authoring
//   instantiateTemplate       -> using-templates
//
// FAIL-OPEN by design: this is a QUALITY backstop, not a security gate (the engine's readGate/askGate
// are the security gates and fail closed). If markers cannot be persisted (unwritable dir) or the
// hook errors, we ALLOW — a hook bug must never brick a legitimate build, and Part 1 (the vacuum: the
// how-to simply isn't in the kernel) remains the primary mechanism. Deny happens ONLY when we can
// positively confirm the dir is writable AND the required marker is absent.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DM = "datamodel-authoring", SQL = "fusion-sql-review", RPT = "report-authoring", TPL = "using-templates";
const REQUIRED = [
  // data model — mutating tools; SQL-carrying ones also re-read the SQL discipline
  { tool: "createDataModelFile", skills: [DM, SQL] },
  { tool: "setDatasetSql", skills: [DM, SQL] },
  { tool: "updateDataModelFile", skills: [DM] },
  { tool: "addStructureElement", skills: [DM] },
  { tool: "moveStructureElement", skills: [DM] },
  { tool: "removeStructureElement", skills: [DM] },
  { tool: "editStructure", skills: [DM] },
  { tool: "editParameters", skills: [DM] },
  { tool: "editLexicals", skills: [DM] },
  { tool: "editDatasets", skills: [DM] },
  { tool: "editTriggers", skills: [DM] },
  { tool: "editValueSets", skills: [DM] },
  { tool: "editBursting", skills: [DM] },
  { tool: "editProperties", skills: [DM] },
  { tool: "editValidations", skills: [DM] },
  // report / layout — mutating tools
  { tool: "createReportFile", skills: [RPT] },
  { tool: "updateReportFile", skills: [RPT] },
  { tool: "addReportLayout", skills: [RPT] },
  { tool: "setReportLayout", skills: [RPT] },
  { tool: "modifyReportLayout", skills: [RPT] },
  { tool: "editLayout", skills: [RPT] },
  { tool: "createSubtemplateFile", skills: [RPT] },
  // template instantiation
  { tool: "instantiateTemplate", skills: [TPL] },
];

const markerDir = process.env.FUSION_SKILLGATE_DIR || path.join(os.tmpdir(), "fusion-sql-skillgate");
const sanitize = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, "_");
const proceed = () => { process.stdout.write(""); process.exit(0); };
const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }));
  process.exit(0);
};

/** Positively confirm the marker dir is usable (distinguishes "skill not loaded" from "can't track"). */
function canPersist(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // existsSync never blocks; skip mkdir in steady state
    const probe = path.join(dir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return true;
  } catch { return false; }
}

let raw = "";
try {
  for await (const chunk of process.stdin) raw += chunk;
} catch { proceed(); }

let evt;
try { evt = JSON.parse(raw || "{}"); } catch { proceed(); }

const toolName = String(evt?.tool_name ?? "");
const sep = toolName.lastIndexOf("__");
const baseName = sep >= 0 ? toolName.slice(sep + 2) : toolName; // mcp__<server>__<tool> -> <tool>
// EXACT base-name match, not endsWith (removeStructureElement endsWith moveStructureElement).
const match = REQUIRED.find((r) => r.tool === baseName);
if (!match || !evt?.session_id) proceed(); // not one of the gated tools -> no opinion

const sid = sanitize(evt.session_id);
const missing = match.skills.filter((skill) => {
  try { return !fs.existsSync(path.join(markerDir, `${sid}__${skill}.loaded`)); }
  catch { return false; }                    // can't check this marker -> treat as loaded (fail open)
});
if (!missing.length) proceed();              // every required skill was loaded this session -> allow

if (!canPersist(markerDir)) proceed();       // can't track markers here -> fail open (no loop)

deny(
  `Load the ${missing.map((s) => `\`${s}\``).join(" and ")} skill${missing.length > 1 ? "s" : ""} ` +
  `FIRST (one Skill-tool call each), then retry ${match.tool}. The build procedure, grouping-shape ` +
  `rules, SQL discipline (incl. the aggregation ladder), and render-verified recipes are required and ` +
  `are NOT in the always-on instructions — building from memory produces the wrong shape (e.g. a ` +
  `second summary SELECT instead of one ROLLUP query). If a skill will not load after you call it, ` +
  `STOP and tell the user; do not build from memory.`
);
