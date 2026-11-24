---
name: projects
description: Use when working with OIC projects or making a copy of an integration — listing projects and their integrations; CLONING an integration (oic_clone_integration — a new version of the same integration, or a new integration under a NEW code/name: "clone X as Y", "copy X to a new integration", "duplicate", "save as", "create Y from X"); CREATING a new, empty integration (oic_create_integration: "create a new integration", "new scheduled integration", "event-triggered integration", "from scratch"); EVENTS — creating an event type in a project (oic_create_event_type: "create an event", "define an event") and subscribing an event integration to one (oic_subscribe_event: "subscribe to the event", "start it when the event is published"); ACTIVATING an integration version (oic_activate_integration: "activate", "deploy this version", "make it live") and changing the tracing level of an ACTIVE one (oic_set_tracing_level); DEACTIVATING an activated version (oic_deactivate_integration: "deactivate", "take it offline", "turn it off"); PAUSING or STOPPING the schedule of an activated scheduled integration (oic_pause_schedule / oic_stop_schedule: "pause the schedule", "stop the scheduler", "cancel the scheduled runs"); RUNNING or TESTING a REST-triggered or scheduled integration (oic_run_panel — the user runs it in the side panel: "run it", "test it", "try this integration", "send a request to it", "submit now", "run the schedule once"); copying existing integrations into a project (oic_copy_integrations_to_project — by reference, same code/version); importing an uploaded archive; and pointing to the connection copy/import tools for a project's connections.
---

# Projects (grouping integrations under an OIC project)

OIC **projects** are a management grouping; project-scoped integrations live under `…/projects/{projectId}/…`.

## Discover
- Catalog first: `oic_catalog_search` restricted to projects (or searching inside one project) answers
  "which project holds …" without a live call — check the catalog's age with `oic_catalog_status`; the live
  list below when it is empty/stale.
- `oic_list_projects` — every project (paged to the end). The project id is what every project-scoped call
  takes.
- `oic_list_integrations` — in the pinned search scope (one project, standalone, or both, every item named
  with its project; none = standalone). Its search is OIC's own server-side search (case-insensitive
  substring of name, code, description AND keywords — not a regex; alternatives go in separate terms);
  check code/name before trusting a hit. Its status / style / last-updated-by filters are OIC's own
  server-side filters too — use them for "the ACTIVATED ones", "the scheduled ones" instead of listing
  everything and sorting by hand. A truncated answer means a search stopped at its limit — the list
  is incomplete. The scope — and every later project — is the user's pinned choice (instructions.md
  §Integration scope).
- Style and pattern on a row are Oracle's own words — report them as Oracle gives them. Neither names the
  trigger's adapter: never call an integration "REST-triggered" (or SOAP, …) from its style or pattern.
- One integration's endpoint URL (endPointURI) and its endpoints come from `oic_get_integration` — not
  from `oic_raw_api`.
- Lookups (DVMs): `oic_list_lookups` takes the same search scope; the tools on ONE lookup
  (`oic_get_lookup`, `oic_create_lookup`, `oic_update_lookup`, `oic_delete_lookup`, `oic_clone_lookup`,
  `oic_lookup_usage`, `oic_export_lookup`, `oic_import_lookup`) act on a project's lookups when given the
  project, on the top-level lookups without it.

## Copy existing integrations INTO a project — `oic_copy_integrations_to_project`
The designer's "Add to project" = `POST /projects/{projectId}/integrations/copy`.
- **Copy BY REFERENCE — no export/import.** The source standalone integrations are UNTOUCHED (an ACTIVATED
  source stays activated and running); the project gets independent **CONFIGURED** copies (not activated).
- The target is the project; the source is standalone (globally available) integrations or another
  project's.
- The tool copies ONE integration per call by default and reports each: copied / already in the project
  (safe to re-run — idempotent-ish) / an error with its body. All-or-nothing in a single call exists —
  avoid it unless you want exactly that.
- Typical flow: `oic_list_integrations` in the SOURCE scope (standalone or its project), filtered by OIC
  (e.g. status ACTIVATED) → `oic_copy_integrations_to_project` with that list → confirm with
  `oic_list_integrations` in the target project.
- NOT a move and NOT a clone: the copy keeps the same code/version, now under the project (a new version, or
  a copy under a new code/name, is `oic_clone_integration` — below). If a same-code integration already
  exists in the project you get 409 (no overwrite).
- **Connections follow the project.** A project integration uses only its own project's connections, or
  connections shared from another project — never the global (standalone) ones. The copy behaves like an
  import: each connection the integration needs that the project lacks is created in the project with EMPTY
  credentials (its properties may be empty too).
- **After a copy:** list the project's connections (`oic_find_connections` in that project's scope), tell
  the user which ones need configuring, and do not activate before they are configured and tested.

## Clone an integration — `oic_clone_integration`
The designer's Clone: a new integration (or version) built from an existing one; the source is untouched.
The source is named by its code, version and project; the TARGET code picks the mode:
- **New version of the same integration** — target code = source code. The version is bumped off the
  highest existing one unless given (01.00.0007 → 01.00.0008); the name stays the source's. The way to
  iterate on a copy while the current version stays intact.
- **New integration under a new code** — the new code needs a name AND a version. Take code, name and
  version from the user's request; whatever it leaves open → ASK (AskUserQuestion) — never invent a name,
  never assume a version, never derive the code yourself (offering the designer-style identifier of the
  name — upper case, underscores — as an option is fine).
- **Scope is explicit.** The instance = the bound tenant. The project follows the pinned scope choice
  (instructions.md §Integration scope): none = the standalone source, a project = that project's; the
  clone lands in the same scope. Another tenant or another project is not this tool.
- **Clash = nothing changed.** The target code|version is checked first; if it is taken the call errors
  and the tenant is untouched — report it and ask for another code/version, never retry with one you
  made up.
- **Result check.** The clone is CONFIGURED, not activated (activation is a separate agreement —
  §Activate). Confirm it with `oic_list_integrations` (its scope, searching the new code) before reporting
  it done.

## Create a new, empty integration — `oic_create_integration`
The designer's Create: a new integration with no source (from an existing one = `oic_clone_integration`, from an
uploaded archive = `oic_import_integration`). The kind is App Driven (no trigger, no activities),
Scheduled (the tenant adds the schedule trigger and a stop) or Event (started by an event: the tenant adds
an event trigger that subscribes to nothing yet, and a stop — §Events).
- **Nothing is defaulted.** Take code, name, version and kind from the user's request; whatever it leaves
  open → ASK (AskUserQuestion) — never invent a name, never assume a version or kind, never derive the code
  yourself (offering the designer-style identifier of the name — upper case, underscores — as an option is fine).
- **Scope is explicit.** The instance = the bound tenant. The project follows the pinned scope choice
  (instructions.md §Integration scope): none = standalone, a project = inside it (that path is not
  live-proven: rely on the result check).
- **Clash = nothing changed.** The target code|version is checked in that scope first; if it is taken the call
  errors and the tenant is untouched — report it and ask for another code/version, never retry with one you
  made up.
- **Result check.** A verified result = the re-read found it. An unverified one = the tenant accepted the
  create but the re-read did not confirm it: NOT done — confirm with `oic_list_integrations` (its scope,
  searching the code) before any next step.
- **What exists after it.** INPROGRESS, never activated (activation is a separate agreement — §Activate,
  once the flow is complete); no workspace opened, nothing locked. An App Driven integration with no trigger is a valid state to keep.
- **First trigger of an App Driven flow** → the adapter-wizard skill, after opening it with the lock (the
  result's note names the call).
- **The trigger of an Event integration** exists already and subscribes to nothing → §Events.

## Events — `oic_create_event_type`, `oic_subscribe_event`
One integration PUBLISHES an event (`oic_add_publisher` — structural-nodes skill); another is STARTED by
it: an Event integration, whose trigger subscribes to one event type. The order: the event type exists →
the Event integration is created (§Create) → opened with the lock → its trigger subscribed → committed.
- **An event type** lives in a project; its identity is its code and revision. Code, name, revision and the
  JSON sample of its payload are the user's — ASK for whatever their request leaves open; never invent a
  payload field. Creating one is a MUTATION: only on the user's request. A taken code and revision = error,
  nothing changed. Result check as for §Create: unverified = NOT done.
- **Subscribing** names the trigger's endpoint and ONE event type by code and revision — the user's choice,
  never "the only one in the project". It is an edit in the open workspace, not committed. The result lists
  what the flow still lacks before it can be activated — report it, do not hide it.
- **What the two tools cover:** a JSON event type private to its project, without custom headers; a
  subscription to an event type of the integration's own project, without a filter, on a trigger that
  subscribes to nothing yet.
- **A variant they do not cover** — an XML event, a custom header, an event of another project, a system
  event, a subscription filter, changing an existing subscription. The designer is driven by the SERVER:
  what a call returns lists what can be done next. The trigger's wizard is the server's own — opened on the
  trigger node with the wizard tools (adapter-wizard skill), its page lists every field a subscription can
  carry; the event type's record lists the fields an event type has. Tell the user the variant was never
  captured, get their go, then continue from those returns with the `oic_wizard_*` tools or `oic_raw_api`,
  changing only what the server showed. Never invent an endpoint or a field: when nothing returned points
  to it, say it cannot be done here.

## Connections in a project
To give a project its own copy of a connection, create it in the project starting from the standalone one
(or another project's) — or, when the project already holds that connection, update it from that source —
or import an uploaded export with `oic_import_connections`: all in the **discovery** skill (§Starting from
another connection, §Exporting and importing connections). An id may exist in a project and standalone at once.

## Import an UPLOADED archive into a tenant — `oic_import_integration`
When the user attaches an `.iar`/`.car`, `oic_import_integration` puts it into that tenant (or inside a
project of it). The code|version come from the archive itself. It is a MUTATION and the only one in this
flow:
- **Only on the user's request** to import that archive into that tenant (and project, if any). One call:
  the tool checks the target itself.
- **Nothing on that code|version** → it is imported, no question.
- **The overwrite confirmation is the TOOL's.** When that code|version already exists, the tool itself
  asks the user to confirm the overwrite — naming the instance, project, code, version, its current status
  and the archive file — before anything is written. Do not pre-ask that question or repeat it. A decline
  (state declined) = nothing changed: say so and stop there. If the tool answers that this client cannot
  show the confirmation, nothing was changed either — report it as is.
- **An ACTIVATED target, or one whose status the tenant does not report, is refused** — nothing changed,
  no question. Deactivating is the user's separate decision (§Deactivate); say why it was refused.
- **What an overwrite would change** = the `oic_compare_integrations` diff of live-vs-upload — show it
  before the import when the user asks to see it.
- **Result check.** Imported or replaced = the re-read found it: CONFIGURED, not activated, and its
  connections may be unconfigured in this tenant — `oic_verify` it, and continue with its code and version
  like any other live integration. Unverified = NOT done: confirm with `oic_list_integrations` (its scope,
  searching the code) before any next step. Activation stays a separate agreement (§Activate).

## Activate an integration — `oic_activate_integration`
The designer's Activate, on one version — a live MUTATION of the tenant (it starts serving traffic or runs).
- **Only on the user's explicit go.** Activating is never a side effect of another task (clone, create,
  import, edit). The user's request names the version to activate; otherwise ASK (AskUserQuestion) — never
  pick "the latest" yourself. The scope follows the pinned scope choice (instructions.md §Integration scope).
- **The tracing level is the user's choice** — Production, Audit or Debug — asked if their request does not
  say it, never defaulted. Audit and Debug write payloads (possibly sensitive) to the activity stream and
  Oracle resets Debug to Production after 24 hours — say so when they pick one. The version's other
  activation settings are kept as they are.
- **Already ACTIVATED** = nothing is sent. To change the level of an ACTIVE integration use
  `oic_set_tracing_level` (the designer's tracing-level dialog) — not a re-activation.
- **No deactivate first.** Oracle deactivates the previously active version of the same major version by
  itself when the new one activates.
- **Scheduled integration.** Before activating, the tool STOPS the running schedule of every OTHER
  activated version with the SAME MAJOR version (activating 01.00.0012 → only other 01.xx versions);
  an active version of another major (02.xx) is left untouched and reported. A stop that fails or does not
  take effect activates nothing.
- **The stop confirmation is the TOOL's.** When a stop is due, the tool itself asks the user to confirm it,
  naming the exact versions ("Scheduler of X 01.00.0006 will be STOPPED to activate 01.00.0009."), before
  anything is written. Do not pre-ask that question or repeat it — the user's go on the activation is all
  you ask. A decline (state declined) = nothing changed: say so and stop there. If the tool answers that
  this client cannot show the confirmation, nothing was changed either — report it as is.
- **No schedule is ever started** — not the new version's, not the stopped one's. After a scheduled
  activation, tell the user where each schedule stands (the result lists it) and that starting a schedule
  is their decision; there is no tool for it.
- **Failure AFTER a stop: tell the user, the user decides.** If the activation fails or is not confirmed
  after a schedule was stopped, the error / note names every schedule that was stopped and REMAINS STOPPED
  (that version still activated, not running on schedule). Surface exactly that to the user — which
  schedule is stopped, and that nothing restarted it — and ASK what they want (restart that schedule in
  the designer, retry the activation, or leave it); then WAIT for their answer. Never retry, restart or
  work around it on your own.
- **Result check.** Report it active only on the activated state. Pending / unverified = NOT done:
  re-check with `oic_get_integration` before saying it is live. Refused before any change (not complete
  or not CONFIGURED, a schedule state the tool does not know) = nothing happened — tell the user why.

## Deactivate an integration — `oic_deactivate_integration`
One ACTIVATED version stops processing — a live MUTATION of the tenant: it takes no new messages, and
requests still pending are lost.
- **Only on the user's explicit request** to deactivate that version. Never as a side effect of another task
  (an import refused for an active target, an edit, a clone), never "to be safe". The scope follows the
  pinned scope choice (instructions.md §Integration scope); the user named only the code → find its activated
  version with `oic_list_integrations` (status filter); more than one activated (different majors) → ASK.
- **The confirmation is the TOOL's.** The tool itself asks the user to confirm, naming the instance, project
  and version and the effect, before anything is written. Do not pre-ask that question or repeat it. A
  decline = nothing changed: say so and stop there. If the tool answers that this client cannot show the
  confirmation, nothing was changed either — report it as is.
- **A scheduled integration whose schedule runs is refused.** Its schedule is stopped first — the user's own
  request and its own confirmation (§Pause or stop a schedule) — and only then is it deactivated. Tell the
  user that order; never stop a schedule on your own to get the deactivation through.
- **An integration that subscribes to an event:** the result marks it. What happens to events published
  while it is inactive is not known — tell the user exactly that.
- **Result check.** Report it deactivated only on the deactivated state. Pending / unverified = NOT done:
  re-check with `oic_get_integration`. Already inactive or refused = nothing happened — say why.
- **Activating it again** is a separate agreement (§Activate).

## Pause or stop a schedule — `oic_pause_schedule` / `oic_stop_schedule`
The schedule of ONE activated scheduled integration version — a live MUTATION of the tenant.
- **Only on the user's explicit request** to pause or stop that schedule. Never as a side effect of another
  task, never "to be safe", never to work around something. The scope follows the pinned scope choice
  (instructions.md §Integration scope); the version is the ACTIVATED one — the user named only the code →
  find it with `oic_list_integrations` (status filter); more than one activated (different majors) → ASK.
- **Pause ≠ stop — use the one the user asked for.** Pause: runs already in progress finish, no new run
  starts; when the schedule is resumed, the run that fell due while paused runs. Stop: every run of the
  schedule is CANCELLED and none starts until the schedule is started again. The user's words are ambiguous
  ("turn the scheduler off", "halt it") → ASK which one, saying that difference.
- **The confirmation is the TOOL's.** The tool itself asks the user to confirm, naming the version and the
  effect, before anything is written. Do not pre-ask that question or repeat it. A decline = nothing
  changed: say so and stop there. If the tool answers that this client cannot show the confirmation,
  nothing was changed either — report it as is.
- **Only a RUNNING schedule** is paused or stopped. Refused before any change = nothing happened — tell the
  user why: not found in that scope, not a scheduled integration, not activated, no schedule defined,
  already stopped, or a schedule state the tool does not know (a paused one included — stopping a paused
  schedule is not possible here yet).
- **Result check.** Report it paused / stopped only on the paused / stopped state. Pending (Oracle accepted,
  the schedule still reports running) or unverified = NOT done — say exactly that.
- **No resume and no start tool.** Resuming a paused schedule or starting a stopped one is the user's
  decision and is done in the designer — say so; never work around it.

## Run or test an integration — `oic_run_panel`
The user runs it, never you: `oic_run_panel` opens the integration's run form in the user's side panel, where
the USER fills the request and presses Run. A scheduled integration gets its Submit now form instead (its
schedule parameters); it is submitted as the signed-in user — no other user can be chosen.
- **Never call the integration yourself** — not through `oic_raw_api`, not any other way, not "to check it".
- **Never report a run result you were not shown.** The request, the answer and the run's status stay in the
  panel. Tell the user in one line that the run form was requested for that integration and version; never say
  it ran, finished or failed.
- **Which version:** the ACTIVATED one. The user named only the code → find its activated version with
  `oic_list_integrations` (status filter); more than one activated (different majors) → ASK. The scope follows
  the pinned scope choice (instructions.md §Integration scope).
- **On a refusal say why**, from its reason: not activated (activating is a separate agreement — §Activate),
  not REST-triggered (SOAP- or event-triggered integrations have no run form), no usable endpoint URL, no usable
  Submit now address or schedule parameters (scheduled), no usable design host.
- **Do not reopen it unasked:** opening it for another integration replaces the panel, and a run the user is
  waiting for is lost.
- **The user asks about the run they made there** ("this run", "the instance", "why did it fail") → the panel's
  page tool `get_instance_id` first (app `api-run`, through `ui_app_tool`), then the run-analysis skill with that
  id. Never search runs to guess it; no run in the panel / panel not open / refusal → say so and ask for the run.
- The tool exists only where the chat can show the panel. When it is not among your tools, say the run form is
  not available here — never substitute another way of running it.

## Related (Oracle REST, not yet wrapped as tools)
- Clone a whole project: `POST /projects/{id}/clone`.
