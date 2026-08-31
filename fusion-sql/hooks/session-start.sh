#!/usr/bin/env bash
# SessionStart hook: inject the Fusion SQL agent instructions as additionalContext.
# Editing instructions.md changes the agent's behavior on the next session (git pull, no rebuild).
set -euo pipefail
INSTR="${CLAUDE_PLUGIN_ROOT}/instructions.md"
node -e 'const fs=require("fs");const t=fs.readFileSync(process.argv[1],"utf8");process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t}}))' "$INSTR"
