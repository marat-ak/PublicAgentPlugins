---
name: verification
description: Use before claiming ANY build result is verified — the levels-of-evidence ladder, the round-trip verification protocol for new/changed recipes (snapshot, delete, rebuild, compare), and recipe trust status.
---

# Verification protocol

## Levels of evidence (weakest → strongest)
1. Tool returned 200/id — means almost nothing alone.
2. Node visible in `oic_get_blueprint` tree with expected attributes (operationName, position).
3. Fresh `oic_verify` after commit: no NEW problems attributable to your ids.
4. Refetch equality: `oic_get_map_xslt` shows your content survived; `oic_get_node` matches expectations.
5. .iar export inspection: map `req_*_stateinfo.xml` ErrorsCount=0 AND WarningsCount=0; stagefile
   `nxsdmetadata.properties` shows your schema; `WRITE_FILENAMEexpr.properties` shows your filename expr.

Report at the highest level you actually reached, quoting outputs.

## Round-trip protocol (for verifying a NEW/changed recipe)
1. Clone the integration to a NEW version (`oic_create_new_version`) — the reference version stays intact
   as the baseline; all rebuilding happens on the clone.
2. On the clone: DELETE the reference node (`oic_delete_node`), commit.
3. Rebuild it via the TOOL under test, commit.
4. `oic_load_iar` BOTH versions, then `oic_compare_integrations {left: baseline, right: clone}` → require
   the rebuilt activity ABSENT from `changes` (ids are not compared; fields + files are). Any row for it
   → `oic_compare_detail` on that ref and report the fact that differs (see the `compare` skill).
5. Fresh `oic_verify` clean on the clone.
Only after ALL five may a recipe be called verified.

## Recipe trust
If your task/briefing marks a recipe or procedure UNTRUSTED, DISPUTED, or OPEN — stop and report rather
than build on it. A skill claim you could not confirm live is UNVERIFIED in your report, never "verified".

## Known benign noise (ignore unless your task is to address it)
- `oic_verify` error "Missing primary business identifier for tracking" = the integration-level tracking
  variable is not yet set; ignore unless your task is to set it.
- Route warning "No actions to execute under route" = a branch intentionally still empty; ignore if the
  branch is outside your task.
