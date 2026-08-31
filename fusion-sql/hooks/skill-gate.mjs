#!/usr/bin/env node
// PreToolUse hook (matcher matches mcp__<server>__createDataModelFile / createReportFile): the
// deterministic backstop to the thin-kernel router. DENY the build tool until its matching skill
// body was loaded THIS session (recorded by skill-record.mjs), returning a clear "load X first"
// reason so the model loads the skill and retries. Gates ONLY these two tools — never
// using-templates / rendering-and-running / fusion-sql-review.
//
//   createDataModelFile -> requires the datamodel-authoring skill
//   createReportFile    -> requires the report-authoring skill
//
// FAIL-OPEN by design: this is a QUALITY backstop, not a security gate (the engine's readGate/askGate
// are the security gates and fail closed). If markers cannot be persisted (unwritable dir) or the
// hook errors, we ALLOW — a hook bug must never brick a legitimate build, and Part 1 (the vacuum: the
// how-to simply isn't in the kernel) remains the primary mechanism. Deny happens ONLY when we can
// positively confirm the dir is writable AND the required marker is absent.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REQUIRED = [
  { suffix: "createDataModelFile", skill: "datamodel-authoring" },
  { suffix: "createReportFile", skill: "report-authoring" },
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
const match = REQUIRED.find((r) => toolName.endsWith(r.suffix));
if (!match || !evt?.session_id) proceed(); // not one of the gated tools -> no opinion

const marker = path.join(markerDir, `${sanitize(evt.session_id)}__${match.skill}.loaded`);
try {
  if (fs.existsSync(marker)) proceed();     // skill was loaded this session -> allow
} catch { proceed(); }

if (!canPersist(markerDir)) proceed();       // can't track markers here -> fail open (no loop)

deny(
  `Load the \`${match.skill}\` skill FIRST (call the Skill tool), then retry ${match.suffix}. ` +
  `Its build procedure, grouping-shape rules, and render-verified recipes are required and are NOT ` +
  `in the always-on instructions — building from memory produces the wrong shape (e.g. two summary ` +
  `SELECTs instead of one ROLLUP query). If the skill will not load after you call it, STOP and tell ` +
  `the user; do not build from memory.`
);
