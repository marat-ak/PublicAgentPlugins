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
When compacting this conversation, preserve VERBATIM: (1) the latest working SQL statement under discussion (complete text, not summarized); (2) all schema decisions made — table choices, join keys, grain decisions, filter/predicate choices; (3) explicit user constraints and preferences stated in the conversation. These must survive compaction word-for-word.
EOF
