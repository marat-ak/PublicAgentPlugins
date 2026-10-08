#!/usr/bin/env node
// PreToolUse hook (matcher matches the MUTATING authoring build tools + the SQL executors — see
// REQUIRED and SQL_EXECUTORS below; the hooks.json matcher alternation must mirror their tool names).
// Two rules, both on MODEL-issued calls only (an engine `useTool` continuation hop — runSecuredSql's
// own runSql / run_sql step, the flexfield search/describe tools — runs inside the wrapper and never
// reaches PreToolUse). NEVER touches read-only/inspection tools (getDataModel, getDataStructure,
// summarizeReportLayout, …), converters, prepare*/upload*, or renderTemplate/runReport.
//
// 1. SKILL LOADS — the deterministic backstop to the thin-kernel router: DENY a build tool until every
//    skill it requires was loaded THIS session (recorded by skill-record.mjs), with a clear "load X
//    first" reason so the model loads the skill(s) and retries.
//   datamodel-mutating tools  -> datamodel-authoring (structural discipline: fileId chain, surgical
//                                edits, grouping shapes); the SQL-carrying ones (createDataModelFile,
//                                setDatasetSql) ALSO require fusion-sql-review (grounding workflow +
//                                the aggregation ladder) and data-access-security (the data-access
//                                choice of authored SQL)
//   report/layout-mutating    -> report-authoring
//   instantiateTemplate       -> using-templates
//   FAIL-OPEN by design: a QUALITY backstop (the engine's readGate/askGate are security gates and fail
//   closed). If markers cannot be persisted (unwritable dir) or the hook errors, we ALLOW — a hook bug
//   must never brick a legitimate build, and the kernel's skill router remains the primary mechanism.
//   Deny happens ONLY when we can positively confirm the dir is writable AND the required marker is absent.
//
// 2. ACCESS MODE on the SQL executors (pod runSql and the CloudBeaver run_sql it is substituted by):
//    SQL the model writes itself carries no data-access condition, so it runs only in the access modes
//    named in PLAIN_SQL_MODES (the plugin's .claude-plugin/modes.json declares the modes; the engine
//    exports the turn's mode as AGENT_MODE). In every other mode the model's runSql / run_sql is DENIED
//    — secured SQL goes through runSecuredSql — except the instance probe (`select 1 from dual`: reads
//    no data, reports the pod `instance` the data-access plan needs). The mode's tool allow-list cannot
//    carry this rule: runSecuredSql's continuation needs runSql mounted, and the CloudBeaver run_sql is
//    a caller tool outside the manifest. A SECURITY backstop, so it fails CLOSED: with modes declared, a
//    turn without AGENT_MODE, or an event the hook cannot read, is denied. No skill is required for
//    plain SQL (developer analysis runs it as written).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DM = "datamodel-authoring", SQL = "fusion-sql-review", RPT = "report-authoring", TPL = "using-templates";
const DAS = "data-access-security";
const REQUIRED = [
  // data model — mutating tools; SQL-carrying ones also re-read the SQL discipline + data access
  { tool: "createDataModelFile", skills: [DM, SQL, DAS] },
  { tool: "setDatasetSql", skills: [DM, SQL, DAS] },
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

// Rule 2 (access mode). PLAIN_SQL_MODES = the mode names of modes.json whose model may run SQL it wrote.
const MODES_FILE = fileURLToPath(new URL("../.claude-plugin/modes.json", import.meta.url));
const PLAIN_SQL_MODES = new Set(["developer"]);
const SQL_EXECUTORS = new Set(["runSql", "run_sql"]);
const INSTANCE_PROBE = /^select\s+1\s+from\s+dual(\s+fetch\s+first\s+\d+\s+rows?\s+only)?\s*;?$/i;
/** The turn's mode when it may NOT run plain SQL ("" = modes declared but no AGENT_MODE); null = it may. */
const restrictedMode = () => {
  if (!fs.existsSync(MODES_FILE)) return null;                // no modes declared: SQL runs as written
  const mode = String(process.env.AGENT_MODE ?? "");
  return PLAIN_SQL_MODES.has(mode) ? null : mode;
};

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

const sqlDenyReason = (mode) => mode
  ? `In the "${mode}" access mode SQL runs only with the user's data-access conditions: write it with ` +
    `the data-access plan's {PRED:<object>|<privilege>} slots left in place and run it through ONE ` +
    `runSecuredSql call. runSql / run_sql run only the instance probe \`select 1 from dual\`.`
  : `SQL cannot run: this plugin declares access modes but the engine exported no AGENT_MODE for this ` +
    `turn, so the caller's access mode is unknown. Tell the user their data cannot be read right now; ` +
    `do not retry.`;
/** An event the hook cannot read: rule 1 fails open, rule 2 fails closed (the tool is unknown, and in a
 *  restricted mode every SQL executor is denied). */
const unreadable = () => {
  const mode = restrictedMode();
  if (mode === null) proceed();
  deny(sqlDenyReason(mode));
};

let raw = "";
try {
  for await (const chunk of process.stdin) raw += chunk;
} catch { unreadable(); }

let evt;
try { evt = JSON.parse(raw || "{}"); } catch { unreadable(); }

const toolName = String(evt?.tool_name ?? "");
const sep = toolName.lastIndexOf("__");
const baseName = sep >= 0 ? toolName.slice(sep + 2) : toolName; // mcp__<server>__<tool> -> <tool>

// rule 2 — the SQL executors: the access mode decides; no skill is required
if (SQL_EXECUTORS.has(baseName)) {
  const mode = restrictedMode();
  if (mode === null || INSTANCE_PROBE.test(String(evt?.tool_input?.sql ?? "").trim())) proceed();
  deny(sqlDenyReason(mode));
}

// rule 1 — skill loads. EXACT base-name match, not endsWith (removeStructureElement endsWith moveStructureElement).
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
  `rules, SQL discipline (incl. the aggregation ladder and the data-access secured CTEs), and ` +
  `render-verified recipes are required and are NOT in the always-on instructions — working from ` +
  `memory produces the wrong shape (e.g. a second summary SELECT instead of one ROLLUP query) or ` +
  `unsecured SQL. If a skill will not load after you call it, STOP and tell the user; do not build ` +
  `from memory.`
);
