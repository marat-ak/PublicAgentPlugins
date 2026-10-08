---
name: schedule-to-rest
description: Use when a SCHEDULED integration must be started by a REST call instead of its schedule — the user chooses an eligible REST connection, oic_convert_schedule_to_rest replaces the schedule trigger with a minimal default REST trigger, then the agent configures that endpoint with the wizard.
---

# Replace a schedule trigger with a REST trigger

Three steps, always in this order: **choose the connection** (the user) → **replace** (one tool, minimal
default endpoint) → **configure** (the generic wizard, edit in place). The replace alone is never the
finished job unless the user wants exactly the defaults.

## 1. Choose the connection — the USER's choice

The only input besides the workspace is the **connection** the new trigger is built on. Eligible =
**adapter REST AND role SOURCE (trigger) or SOURCE_AND_TARGET (trigger and invoke)**, in the
integration's own scope. TARGET (invoke-only) and every non-REST adapter are not eligible.

1. List them: `oic_find_connections {instance, scope, adapters: ["^rest$"]}` — `scope` = the
   integration's own place (its project id, or `"standalone"` for a standalone integration). Keep only
   results whose `role` is `SOURCE` or `SOURCE_AND_TARGET`.
2. ASK the user to choose (AskUserQuestion; options = the eligible connections by name + id, verbatim).
   Never pick one yourself — even a single eligible connection is offered and confirmed, not taken.
3. None eligible → say so and stop; never fall back to another adapter, a TARGET connection, or a
   connection outside the scope.

## 2. Replace — `oic_convert_schedule_to_rest {instance, code, version, project?, wsid, connection}`

Workspace = one YOU opened `lock:true` (instructions.md §Session lifecycle); `connection` = the id the
user chose.

What it does:
- Refuses BEFORE any change when the flow does not start with a schedule trigger, nothing follows the
  trigger, the connection is not eligible (the error names the adapter + role it found) or not in the
  scope, or a wizard is open on the integration (finish or `oic_wizard_cancel` it first). A refusal
  changed nothing — fix the input, retry.
- Builds the REST endpoint with default data — endpoint name `Start`, and the wizard's OWN defaults: GET,
  resource `/`, no request and no response payload (`summary` in the result is the server's view) — and
  puts it where the schedule trigger was. The schedule trigger is gone; the integration is no longer
  scheduled. Maps see the incoming request under the endpoint name (`Start`).
- Re-reads the flow. `state:"converted"` = the flow now starts with a trigger on that connection named
  `Start` — `trigger.id` is the node you configure next. `state:"converted-unverified"` = that could
  not be proven: inspect the flow (`oic_blueprint_view` after `oic_reload_blueprint`) before anything
  else, and never report it as done.
- Does NOT commit. A failure mid-way cancels its own wizard and says at which step; re-read the flow
  before retrying.

Then `oic_commit` — the replace is a logical chunk of its own.

## 3. Configure — the generic wizard on the new trigger

The defaults are a placeholder. Configure the endpoint the user actually needs with the adapter-wizard
skill (invoke it) — EDIT IN PLACE on the new trigger, never delete and recreate it:

1. `oic_wizard_create {instance, code, version, project?, wsid, connection, editNodeId: <trigger.id>,
   nodeType: "receives"}` — resumes the endpoint pre-filled.
2. Resource page: the resource path and the verb are `hasEvent` fields → `oic_wizard_event`, re-read,
   then tick what the endpoint needs (query parameters, request payload, response payload, headers) →
   `oic_wizard_next`.
3. Request / response pages: the format and the sample — a sample goes in through `oic_wizard_file`
   (raw JSON/XML text). The sample comes from the user or the source material; never invent one (the
   SAMPLE FIDELITY LAW in adapter-wizard).
4. Summary → `oic_wizard_generate` → `oic_wizard_save` → `oic_commit` → `oic_verify`.

Whatever the request does not decide — path, verb, request/response shape, synchronous response or
not — ASK. The page model is the authority for field names and options, not this skill.

## After the configure

- `replaced.scheduleParameters` / `warnings`: the schedule's parameters and anything that read the old
  trigger have no source anymore. `oic_verify` lists what broke; repair it with the maps /
  structural-nodes skills, or ask when the replacement value is not obvious.
- Report: the replaced node, the new trigger (id, connection, name), its configuration, and the fresh
  `oic_verify` outcome verbatim.
