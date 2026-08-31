---
name: discovery
description: Use for capability questions about the tenant across three shapes — FIND ("which integrations read email / talk to service Y / use adapter X?"), IMPACT ("what breaks if this connection changes?"), DIRECTION ("do we read or write system Z?"), plus the exhaustive inventory ("every system we talk to"). Search connections with the ONE call (oic_find_connections), expand to the integrations using each hit, blueprint only to confirm a shortlist.
---

# Finding integrations, systems, and impact by connection

## The law

**A capability lives in the CONNECTION an integration uses, not in its name.** Search connections —
never open integrations to look inside them, never name-filter integrations as the search. A tenant
holds thousands of integrations; opening workspaces/blueprints to "look inside" candidates is slow,
lock-risky, and unbounded. Blueprint has exactly ONE role: confirming a flow-level detail on a
SHORTLIST you already built — never the search primitive.

Connection search sees **DIRECT reach only.** An integration that reaches a capability transitively —
by invoking another integration, or subscribing to its published event — holds no connection of its
own, so it never surfaces in usage. State that limit honestly; a transitive trace is a separate
integration-dependency question, and no tool answers it today.

## The one search call

`oic_find_connections {adapters?, names?, text?}` sweeps every connection ONCE and searches IN MEMORY
across every field — adapter code + display name, connection name, description, endpoint/host URLs — so
one call carries as many angles as you need. `adapters` matches the adapter kind, `names` the
connection name, `text` the whole haystack (where a provider's host or API name surfaces a *generic*
connector no name would reveal). All terms are **regex, case-insensitive, OR** — a connection returns
if ANY term hits. You supply the terms from your own knowledge of the world (a brand, a host, an API
name); the tool matches them against the LIVE tenant. This skill names no providers, hosts, or adapter
codes — those are instance facts, discovered live.

Each hit carries `matchedOn` (which field + term + snippet), so YOU judge relevance **by that field**:
the same host can legitimately sit in BOTH the auth/token field and the API/resource field of one
connection, and a match ONLY in the auth/token field is a WEAKER signal than one in the resource URL.

**Search BOTH shapes in the one call.** A capability is reached EITHER through a dedicated adapter OR
through a generic connector (REST/SOAP/database/…) whose URL targets the provider — so run the
`adapters` angle AND the `text`/URL angle together, or you silently miss the other shape. Turn "the
provider I have in mind" into the real code with `oic_list_adapters {filter?}` (same regex over the
tenant's live adapter catalog) BEFORE `oic_find_connections {adapters:[...]}`; never type a code from
memory. An EMPTY adapter list does NOT prove the capability is absent — it may exist only as a
generic-connector-with-URL, so still run the text angle.

(The tool auto-refreshes its cache once on a zero-hit search, so a just-created connection is not
missed; `refresh:true` forces a fresh sweep.) A text/URL search is substring-based, so it misses a host
hidden behind an alias, proxy, CNAME, or account-locator-only URL. When a provider connection is
EXPECTED but the search stays thin, ASK the user for the exact host or account URL rather than
concluding absence — a false negative in front of an impact or rotation question is dangerous.

## Expand to integrations

For each kept connection, `oic_connection_usage {connectionId}` returns the integrations USING it
(code, version, status) plus `usageActive`. Interpret the status: ACTIVATED + active = the integration
breaks the moment the connection changes; CONFIGURED / inactive = a latent or stale reference, not a
live break. If several connections matched but the question implies ONE ("our X connection"), confirm
WHICH is in scope before unioning their usage.

Both `oic_find_connections` and `oic_connection_usage` take `project?`. An EXHAUSTIVE or inventory
question MUST enumerate the projects and sweep per-project **and** global — otherwise project-scoped
connections and usages are silently missed (see the **projects** skill). A single targeted lookup needs
only one global sweep.

## By question shape

### Find (baseline) — "which integrations read/use/talk-to X"

The shared core above (law → search → expand) already answers this — stop after usage. If a
direction is named, add a LIGHT per-finalist operation check (the **Direction** rule), not the
scale seam (finalists are a handful); skip Inventory grouping and per-project enumeration for a
targeted FIND.

### Inventory — "every system we talk to"

The no-term call `oic_find_connections {}` IS the exhaustive primitive — it returns EVERY connection;
that full set (swept per-project + global) is your raw material. Group connections into SYSTEMS by
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
integration is entered through the connection, TARGET/invoke means it calls out through it;
`integrationRole` (SOURCE_AND_TARGET vs TARGET) only BOUNDS which roles are possible — it does NOT
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
