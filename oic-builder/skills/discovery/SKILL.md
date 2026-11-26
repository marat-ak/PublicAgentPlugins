---
name: discovery
description: Use for capability questions about the tenant across three shapes (catalog first: oic_catalog_search, counts/lists/reports via oic_catalog_sql) — FIND ("which integrations read email / talk to service Y / use adapter X?"), IMPACT ("what breaks if this connection changes?"), DIRECTION ("do we read or write system Z?"), plus the exhaustive inventory ("every system we talk to"). Search connections with the ONE call (oic_find_connections), expand to the integrations using each hit, blueprint only to confirm a shortlist. Also: CREATING or UPDATING a connection (search first, describe the adapter, ask; without secrets; either can start from a copy of another connection — standalone to project and back), TESTING a connection as it is saved (oic_test_connection), its CREDENTIALS (password, client secret, API key: the user types them in the credentials page, oic_connection_panel — never in the chat), and EXPORTING / IMPORTING connections by file between scopes or instances (oic_export_connections / oic_import_connections).
---

# Finding integrations, systems, and impact by connection

## The law

**A capability lives in the CONNECTION an integration uses, not in its name.** Search connections —
never open integrations to look inside them, never name-filter integrations as the search. A tenant
holds thousands of integrations; opening workspaces/blueprints to "look inside" candidates is slow,
lock-risky, and unbounded. Blueprint has exactly ONE role: confirming a flow-level detail on a
SHORTLIST you already built — never the search primitive.

## Catalog first

Before any live sweep, search the instance's local catalog: `oic_catalog_search` — one call, no sign-in
(your KC instance role is the gate), matching WORDS in name, description, summary, flow text and what the
nodes do (the live listing matches only name/code/description/keywords). Check `oic_catalog_status` and
tell the user the catalog's age (when its export was taken) and whether a job is running. Go live
(`oic_find_connections`, `oic_list_integrations`) only when the catalog is empty / not configured, stale
for the question, or the user asks for live state.

The catalog is filled and refreshed from the conversation with `oic_catalog_crawl` — the user's own OIC
sign-in does the work (no stored credential): it lists every integration and connection of the instance,
downloads only the integrations updated since the catalog's watermark (a full crawl re-reads all), stores
them node by node and, after a complete run, drops what the instance no longer has. Incremental and
resumable: an interrupted crawl (token expiry) keeps what it wrote and the next call continues. Crawling
PROJECT integrations reads them through a temporary deployment per project, so the user's OIC role must
allow creating project deployments; a standalone-only crawl needs no such role. It runs in the background
(minutes on a first run; tell the user) — follow it with `oic_catalog_job` (`oic_catalog_jobs` lists what
is running and the recent ones) and read the job's error list: every archive that failed is named with
its integration/project. An auth-required answer = sign the user in to THAT instance first (identity loop) — unless its reason is
`rejected`: no sign-in fixes that (instructions.md §Identity protocol).

### Counts, lists and reports — `oic_catalog_sql`

"How many / which / per adapter / per pattern / which integrations reference lookup L or library F" are SQL
over the catalog, not live sweeps. Describe the catalog ONCE (tables and columns from the database, node
types, pattern ids, the signature census — never guess a name), then ONE read-only SELECT per call: rows
are confined to the instance (no instance filter needed), capped (truncated = aggregate or page), and an
SQL error is yours to fix and retry. The node table (`integration_node`: one row per activity with its
`sig`, `flow_path`, `props`) joins `integration` on (project_id, code, version); `integration_endpoint` /
`_map` / `_variable` / `_tracking` / `_schedule` / `_lookup_ref` / `_library_ref` / `_pattern` are siblings
on the same key. State the catalog's age (`oic_catalog_status`) with every answer. A concrete example of
ONE activity ("show me a REST invoke with a templated URI") is `oic_catalog_examples`, not SQL.

Connection search sees **DIRECT reach only.** An integration that reaches a capability transitively —
by invoking another integration, or subscribing to its published event — holds no connection of its
own, so it never surfaces in usage. State that limit honestly; a transitive trace is a separate
integration-dependency question, and no tool answers it today.

## The one search call

`oic_find_connections` sweeps every connection ONCE and searches IN MEMORY across every field — adapter
code + display name, connection name, description, endpoint/host URLs — so one call carries as many
angles as you need: the adapter kind, the connection name, and the whole haystack (where a provider's host
or API name surfaces a *generic* connector no name would reveal). A connection returns if ANY term hits.
You supply the terms from your own knowledge of the world (a brand, a host, an API name); the tool
matches them against the LIVE tenant. This skill names no providers, hosts, or adapter codes — those are
instance facts, discovered live.

Each hit says which field + term matched, with a snippet, so YOU judge relevance **by that field**: the
same host can legitimately sit in BOTH the auth/token field and the API/resource field of one connection,
and a match ONLY in the auth/token field is a WEAKER signal than one in the resource URL.

**Search BOTH shapes in the one call.** A capability is reached EITHER through a dedicated adapter OR
through a generic connector (REST/SOAP/database/…) whose URL targets the provider — so run the adapter
angle AND the text/URL angle together, or you silently miss the other shape. Turn "the provider I have
in mind" into the real adapter code with `oic_list_adapters` (the tenant's live adapter catalog) BEFORE
the adapter angle of `oic_find_connections`; never type a code from memory. An EMPTY adapter list does
NOT prove the capability is absent — it may exist only as a generic-connector-with-URL, so still run the
text angle.

(The tool auto-refreshes its cache once on a zero-hit search, so a just-created connection is not
missed; a fresh sweep can be forced.) A text/URL search is substring-based, so it misses a host hidden
behind an alias, proxy, CNAME, or account-locator-only URL. When a provider connection is EXPECTED but
the search stays thin, ASK the user for the exact host or account URL rather than concluding absence — a
false negative in front of an impact or rotation question is dangerous.

## Expand to integrations

For each kept connection, `oic_connection_usage` returns the integrations USING it with their status and
whether the usage is active. Interpret the status: ACTIVATED + active = the integration breaks the moment
the connection changes; CONFIGURED / inactive = a latent or stale reference, not a live break. If several
connections matched but the question implies ONE ("our X connection"), confirm WHICH is in scope before
unioning their usage.

Both `oic_find_connections` and `oic_connection_usage` search the conversation's pinned integration scope
(instructions.md §Integration scope — asked before the first search when the tenant has projects):
standalone, one call per chosen project, or both in one call (every hit names its project; none =
standalone). The same connection id can exist in several places as DIFFERENT connections — expand a hit
in its own place: its project, or standalone when it has none. An EXHAUSTIVE or inventory question covers
the WHOLE pinned scope — every project in it — or project-scoped connections and usages are silently
missed (see the **projects** skill).

## By question shape

### Find (baseline) — "which integrations read/use/talk-to X"

The shared core above (law → search → expand) already answers this — stop after usage. If a
direction is named, add a LIGHT per-finalist operation check (the **Direction** rule), not the
scale seam (finalists are a handful); skip Inventory grouping for a targeted FIND.

### Inventory — "every system we talk to"

`oic_find_connections` with NO terms IS the exhaustive primitive — it returns EVERY connection of that
scope; that full set (across the whole pinned scope) is your raw material. Group connections into SYSTEMS by
resolved host, NOT by connection count: judge each by its API/resource URL field, not its name, and
union both shapes (dedicated adapter and generic-connector) that resolve to the same host onto ONE
system. EXCLUDE or explicitly FLAG auth/IdP-only hosts (token endpoints, identity providers) — they are
how you reach a system, not a system you exchange data with. Decide up front whether a dormant/unused
connection (no active usage) counts as a system you "talk to", state which rule you applied, or ASK — it
changes the roster.

### Change impact — "what breaks if connection X changes"

Affected = every integration that USES the connection at all — readers AND writers alike, because a read
needs valid credentials too. **Direction is irrelevant to the impact set** (this holds ONLY for impact —
a directional question is the opposite). The direct-reach limit from The law applies: an integration
that reaches the changed capability transitively will not appear.

### Direction — "reads vs writes"

Two independent axes — never collapse them. **Role = FLOW direction:** SOURCE/trigger means the
integration is entered through the connection, TARGET/invoke means it calls out through it; the adapter's
integration role (SOURCE_AND_TARGET vs TARGET) only BOUNDS which roles are possible — it does NOT
decide read-vs-write. **Operation = DATA direction:** an invoke running a query READS, an invoke running
a write op WRITES — so a TARGET-only connection is NOT automatically a writer. Which verb reads and
which writes is ordinary SQL/API knowledge; apply it. When the operation hides direction — a generic
connector where one endpoint carries both and the real verb lives in the request MAP or payload —
inspect that map/body (see **maps** / **source-material**; read-only blueprint mechanics in
**workspace**) or report the direction UNRESOLVED and name the artifact that would settle it. NEVER
infer read-vs-write from an HTTP method.

For a "mostly reads or writes?" question, tally per system (the host-grouping from **Inventory**)
and weight by ACTIVE usages, not raw
connection count. **Scale seam:** when the finalist set would be tenant-wide (direction across ALL
systems), the per-operation inspection is expensive — deliver the bounded inventory FIRST, then ASK to
scope or sample before running it. A role/method-based approximation is permitted ONLY as an
explicitly-labeled, caveated ESTIMATE, never as the silent answer.

## Creating a connection

Reuse beats a duplicate: search `oic_find_connections` for the system first and offer what exists. Create
only on the user's choice. Then:

1. **Describe** the adapter with `oic_list_adapters`: allowed roles, policies, and (when this scope already
   has one) the property + per-policy definitions. Everything the user must choose comes from this
   metadata, never from memory — the same steps serve an adapter you have never seen.
2. **Ask** (AskUserQuestion) for identifier, name, role, **standalone or which project**, security policy and
   the non-secret values. Nothing is defaulted.
3. **Create** — `oic_create_connection`. Secrets are never yours to carry: leave them out (a secret in the
   input is refused). A rejected result returns the definitions — show the errors, re-ask, retry. An
   existing identifier means it is taken — reuse it, rename, or update the existing one (below); create
   never overwrites.
4. **Report what the tool did.** It finishes like the console: when no required value is missing it TESTS
   the connection and saves it with the test's outcome — say that the test ran, whether it passed, and
   OIC's own message when it failed (the connection is saved either way and stays unconfigured until a
   test passes). When a required value is missing — typically a credential — no test is run: tell the
   user exactly which secrets, uploads and values the result lists; the credentials are entered as
   §Credentials says, the test waits until then. Repeat any warnings.

## Updating a connection

`oic_update_connection` changes an EXISTING connection, standalone or in a project: its non-secret
values, its security policy, its agent group. Only on the user's request, and only what they asked to
change — everything else, a stored secret included, stays as it is.

- **The confirmation is the TOOL's.** It asks the user itself, naming the connection, its scope and the
  properties that change; when active integrations use the connection it lists them and asks whether to
  reactivate them. Do not ask the same thing first and do not repeat it. Declined = nothing changed.
- **Tested before it is saved.** Passed: saved, configured again, and the integrations the user agreed to
  are reactivated — Oracle does that asynchronously, so report it as requested and not as done until
  their own status says so. Failed on a connection that was configured: nothing is saved, and the tool
  asks the user whether to save anyway — that answer is theirs, never yours. Report OIC's message
  either way.
- **A required value still missing** — typically a credential: it is saved without a test and is not
  usable until it is completed. The tool says so in its question; afterwards tell the user exactly what
  the result lists as still needed, and go on as §Credentials says.
- **Complete but not configured, nothing to change** — never tested, or its last test failed; e.g. a
  connection an integration copy left in a project, which blocks the activation: the same tool tests it as
  it is and saves it only when the test passes — that save is what makes it configured. Call it for that
  connection with no value to change; its question tells the user that no value changes and that it is
  saved only if the test passes. A failed test saves nothing: report OIC's message. Report the test and the
  status the result shows — never send the user to the OIC console for this.
- **Nothing to change never saves without a passed test.** A connection that is already configured is
  only tested, never saved, and the user is not asked — it stays configured whatever the test says. When
  a required value is missing the tool does nothing and returns what is missing: tell the user, and go on
  as §Credentials says.
- **Not the way to check a configured connection.** Whether a connection that is already configured works
  is checked with `oic_test_connection` (§Testing a connection as it is saved): no lock, nothing written.
  An update with no value takes the connection's lock for its test — it is not for that.
- **Secrets are never yours to carry** — a secret in the input is refused; the user enters it himself
  (§Credentials). A rejected result returns the definitions — show the errors, re-ask, retry.

## Testing a connection as it is saved

`oic_test_connection` asks OIC to test ONE existing connection, standalone or in a project, with the values
and credentials it already holds. It changes no value and asks the user nothing.

- **When:** to check whether a connection that is already configured works — this tool, never an update
  with no value. It takes no lock and saves nothing, so it is not the way to make a
  complete connection configured — that is the update (§Updating a connection). Not for new values: an
  update tests those itself before it saves, and credentials are tested in the credentials page.
- **It contacts the target system** with the stored credentials. Run it when the user asked for it or
  agreed to it, one connection per call — never across a list "to check".
- **Report what the result says, nothing more:** passed or failed, OIC's own message when it failed, and
  the connection's status before and after the test. Oracle does not say whether a test stores its outcome:
  call a connection configured only when the status read after the test says so. A passed test that leaves
  the status as it was is exactly that — say it; the connection then still needs its test and save, which
  the update does (§Updating a connection).
- **Failed:** give OIC's message and what the result lists as still empty; credentials go in as
  §Credentials says. Not configured, or locked: say which, and who holds the lock.

## Starting from another connection (a copy)

To give a project its own copy of a standalone connection (or the reverse, or project to project), CREATE
it — or UPDATE the one that is already there, e.g. the empty connections an integration copy leaves in a
project — starting from the other connection. Both tools read the source themselves: its values never
pass through you, so never read them out to pass them along.

- Same adapter only, and never the connection itself. For a new copy the identifier, name and role are
  still the user's choice.
- Carried: the non-secret values, the security policy, the agent group. What you pass explicitly wins.
- Never carried: secrets (OIC never returns one) and file uploads — the result lists them; the
  secrets go in as §Credentials says, the uploads in the OIC console.
- One connection per call. Several = one call each, each on the user's go; name them to the user first.
- Across instances there is no copy: export on one, import on the other (each needs its own sign-in).

## Credentials — the user types them, in the credentials page

A password, client secret, API key or any other secret of a connection is entered by the USER, in the
credentials page that `oic_connection_panel` opens beside the chat. The page sends what is typed to OIC
itself, with the user's own sign-in; it never reaches you, a tool or the conversation.

- **Never ask the user to type a credential into the chat, and never pass one to a tool** — not to save
  time, not when the user offers it. A credential that appears in the chat anyway is not used and not
  repeated: point the user to the page.
- **When:** a create or update result says credentials are still needed, or the user wants to enter or
  change the credentials of a connection. Open the page for that one connection, then tell the user in
  one line what to do there: fill the fields, press Test, then Save. A stored secret left empty is kept.
- **You only requested the page.** Never say it is open, and never state an outcome you were not given.
- **The outcome:** on the user's next message, read the page's `get_result` (app `connection-credentials`,
  through `ui_app_tool`). It answers only whether it was saved, how the test went and what happened to
  the reactivation — never a value, never OIC's message. Report exactly that; no result, or not saved →
  say so and ask the user what they saw on the page. A reactivation is requested, not done, until the
  integrations' own status says so.
- **The page tests before it saves** and asks the user itself before it saves a failed test over a
  connection that worked, and whether to reactivate the active integrations — those answers are theirs.
- **On a refusal say why and what comes first**, from its reason: the connection does not exist, another
  user holds its lock, it has no security policy yet (that is an update, on the user's choice), or its
  policy has nothing the user could type.
- **Not on the page:** non-secret values, the policy and the agent group (§Updating a connection), and
  file uploads — certificates, wallets, keys — which the user does in the OIC console.
- **Do not reopen it unasked:** opening it again, or for another connection, replaces the page and what
  the user has typed is lost.
- The tool exists only where the chat can show the page. When it is not among your tools, the user
  completes the credentials in the OIC console — say so; never substitute another way.

## Exporting and importing connections

Two tools over ONE read path and the SAME create path as `oic_create_connection` — a transfer by FILE.
The source and target scopes (standalone or a project) are the user's choice (ask; never inferred), and
the connections are named — every connection of a scope only when the user means all of them.

- **Export** — `oic_export_connections`: the user wants the connections as a FILE (backup, review, moving
  them to another instance) — one archive in the import format, or one `.json` per connection. Present the
  files with `ui_present_file` (instructions, Files for the USER). The result names what an import
  elsewhere will need entered in the console (secrets, uploads).
- **Import** — `oic_import_connections`: the user UPLOADED an export (the zip, or one connection `.json`)
  and wants those connections in the signed-in instance; an existing connection is skipped, never
  overwritten. A file the user edited to hold real passwords sets them — say so before importing. The
  import runs no connection test.

**One connection vs many.** An import is a mutation; how you confirm depends on the size:
- **One connection** (an upload holding one connection): once the user has asked for it
  and the target scope is settled, call the tool and report the status it returns — the state, the host
  it points to, and what must be completed in the console. There is no plan and no file.
- **A multi-connection upload**: the first call is a PLAN — it reads and
  counts but creates nothing. Show the user the plan (how many, how many are already in the target and
  will be skipped, the time estimate) and ASK two things together: go ahead? and do they want a
  per-connection results file? Never assume either answer. On a yes, execute the plan with their answer
  about the results file. Each call works for about a minute and a half and returns progress; keep
  executing the same plan until it is done, telling the user the progress between calls. Re-calling is
  always safe: finished connections are never redone and existing ids are never overwritten. A plan the
  user leaves unanswered expires — plan again rather than reuse an old one. If they skipped the results
  file and later want the details, execute the same plan once more asking for the file (nothing runs
  again).
- A large **export** (more than one call can safely read) also comes back as a plan: ask, then execute it
  until done — the export file arrives with the last call.

Values never enter the conversation: results carry counts, states, property NAMES, file ids and — for a
single connection — the HOST it points to; show it so the user can review where the connection points. The
exported files sit in the conversation's tree (an uploaded one with the uploads); search them only for what
the user asks about, and never repeat a secret.

States: `created`, `exists` (the id is taken in the target scope — skipped, NEVER overwritten; replacing it is
the user's console decision), `rejected` (the adapter is missing on the target, or a value the target's
definitions refuse — give the reason), `failed` (an Oracle error — report it). An upload that is not a clean
export (unexpected entries, oversize, bad JSON) is refused WHOLE — report the listed entries.

**Hand off**: per imported connection, the secrets to enter (OIC never returns a secret, so exported
connections arrive without theirs — §Credentials, one connection at a time), the certificate / keystore
uploads (the OIC console), and the missing required values. An imported connection is not tested until then. For one connection that list is in the status; for a bulk
run it is in the results file (present it with `ui_present_file`; read it via its path or `oic_grep`), or,
without one, give the counts and offer the file.
