#!/usr/bin/env bash
# PreCompact hook: inject instructions to preserve key facts verbatim across compaction.
#
# Mechanism (verified against claude-code CLI 2.1.210 code path): for PreCompact, the RAW
# non-empty stdout of a successful non-blocking hook is appended VERBATIM to the compaction
# summarization prompt under "Additional Instructions:". JSON output fields are NOT the channel:
# `systemMessage` is parsed and then DISCARDED for this event, and there is no
# PreCompactHookSpecificOutput / additionalContext in the SDK (@anthropic-ai/claude-agent-sdk
# 0.3.210 sdk.d.ts — 'PreCompact' is absent from the hookSpecificOutput union). So, unlike
# session-start.sh, emit the instruction text as PLAIN prose on stdout — no JSON wrapper.
set -euo pipefail
cat <<'EOF'
When compacting this conversation, preserve VERBATIM: (1) the integration code|version being worked on, the current workspace/lock state, and the OIC connection/login state; (2) every node id and map id created or modified this session, with what was changed; (3) the latest fresh oic_verify outcome (error/warning list) and which changes are committed vs uncommitted; (4) explicit user constraints and decisions stated in the conversation. These must survive compaction word-for-word.
EOF
