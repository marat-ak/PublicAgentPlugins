#!/usr/bin/env node
// PreToolUse hook (matcher "Skill"): record that a skill BODY was loaded this session, so the
// skill-gate hook can require it before createDataModelFile / createReportFile. The Skill tool
// fires PreToolUse before the body loads; we record optimistically (a mis-named skill that fails
// to load is a non-issue — the model picks names from the router). NEVER denies — always lets the
// Skill call proceed. Non-fatal on any error (empty stdout = no decision = proceed).
//
// Marker: <dir>/<session_id>__<skill>.loaded, keyed on the SDK session_id (BaseHookInput.session_id),
// which is stable across resume + compaction within a session. The gate hook computes the same path.
// Container restart wipes a tmp dir (graceful: the skill body is still in the resumed transcript, so
// the gate simply re-asks for a reload once). Set FUSION_SKILLGATE_DIR to a persisted path to survive
// restarts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Skills whose loads we track. The gate (skill-gate.mjs REQUIRED) uses datamodel-authoring /
// report-authoring / fusion-sql-review / using-templates; rendering-and-running is recorded
// harmlessly (future-proofing) and never gates anything.
const KNOWN_SKILLS = [
  "datamodel-authoring",
  "report-authoring",
  "fusion-sql-review",
  "using-templates",
  "rendering-and-running",
];

const markerDir = process.env.FUSION_SKILLGATE_DIR || path.join(os.tmpdir(), "fusion-sql-skillgate");
const sanitize = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, "_");

let raw = "";
try {
  for await (const chunk of process.stdin) raw += chunk;
} catch { /* no stdin — nothing to record */ }

try {
  const evt = JSON.parse(raw || "{}");
  if (evt?.tool_name === "Skill" && evt?.session_id) {
    // The skill name may live under command/name/skill, may be plugin-qualified
    // (fusion-sql:datamodel-authoring), or be phrased as a slash command — a substring scan of the
    // serialized input catches every shape.
    const blob = JSON.stringify(evt.tool_input ?? {});
    const sid = sanitize(evt.session_id);
    fs.mkdirSync(markerDir, { recursive: true });
    for (const skill of KNOWN_SKILLS) {
      if (blob.includes(skill)) {
        try { fs.writeFileSync(path.join(markerDir, `${sid}__${skill}.loaded`), ""); } catch { /* ignore */ }
      }
    }
  }
} catch { /* malformed input or unwritable dir — record nothing, never block */ }

// No decision: let the Skill call proceed.
process.stdout.write("");
