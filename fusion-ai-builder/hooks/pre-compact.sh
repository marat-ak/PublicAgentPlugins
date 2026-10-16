#!/usr/bin/env bash
# PreCompact hook: inject instructions to preserve key facts verbatim across compaction.
#
# Mechanism: for PreCompact, the RAW non-empty stdout of a successful non-blocking hook is
# appended VERBATIM to the compaction summarization prompt under "Additional Instructions:".
# JSON output fields are NOT the channel for this event, so emit PLAIN prose on stdout.
set -euo pipefail
cat <<'EOF'
When compacting this conversation, preserve VERBATIM: (1) every workspace name used in this conversation (`ws`) and what it contains; (2) every artifact created or modified, as `{kind, code, path, current version v<n>}`, and the family/product the user chose; (3) the latest `fai_validate` outcome per artifact (ok, errors[], warnings[] verbatim) and which changes have been validated vs not yet; (4) every `fai_export` result (`fileId`, kind, code, version) already delivered to the user; (5) the pod connection state per workspace (host only, never credentials) and whether any `do-save-*` was performed; (6) explicit user constraints and decisions stated in the conversation (including answers to AskUserQuestion). These must survive compaction word-for-word.
EOF
