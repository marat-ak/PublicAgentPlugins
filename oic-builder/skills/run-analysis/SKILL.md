---
name: run-analysis
description: Use when analyzing or debugging WHY one integration RUN behaved as it did — why it failed / where it errored / why a ForEach looped N times / which node was slow / what a node emitted — starting from a run instanceId. Blueprint-first, then a bounded activity OVERVIEW, then targeted search/drill/payload. NEVER dump the full runtime stream into reasoning.
---

# Analyzing / debugging an integration run

The runtime activity stream of a real run is HUGE (deep trees, per-iteration nodes, payloads). Reasoning
about behaviour by pulling that whole stream in is the mistake this skill exists to prevent. Two disciplines
govern everything below:

- **NEVER dump the full activity tree.** Work from bounded summaries and targeted queries; let the tool hold
  the parsed stream server-side and hand you only the slice a question needs.
- **Payloads ONLY when the question needs a body.** Never fetch a node's payload to reason about STRUCTURE —
  structure comes from the blueprint, not from runtime bodies.

## 1. Build the mental model from the BLUEPRINT, not the run

Before touching runtime, understand the integration's DESIGN. `oic_get_blueprint` (session-cached, cheap to
re-call) is the bounded structural map: the trigger, every node (list/read, ForEach loops, maps, invokes,
routers/routes, scopes), and what calls what. Open the integration read-only for this (Session lifecycle:
read-only — no lock). Your model of "what SHOULD happen" is built here; the run tells you what DID.

## 2. Get the instanceId, then the OVERVIEW — never the full tree

A run is addressed by its `instanceId` (from `oic_list_instances` — filter `status:"FAILED"` for a failing
run; that is the discovery skill's inventory law applied to runs). Then:

`oic_activity_flow {op:"overview", instanceId}` returns a TINY summary — did it fail and WHERE, the hoisted
error root cause, node/error counts, and a shallow skeleton (top-level nodes + collapsed subtree counts). It
is deliberately not the full tree. The stream is fetched + parsed ONCE per instanceId and cached in the
session; later ops reuse it (`refresh:true` re-fetches). A `410 Gone` means the run's stream was purged —
pick a more recent run.

Read the overview to decide the ONE question worth drilling. **A failed run's implicit goal is "why did it
fail" → go straight to the hoisted root cause / the error nodes.** For a broad or unpinned request ("check
this run", "is it healthy"), do NOT trawl — ASK what to verify first (instructions.md: when requirements
don't decide, ASK).

## 3. Correlate runtime ↔ design by `#identifier`

Every activity node carries a `#identifier` correlation key that maps to a blueprint node. This is the hinge
of the whole workflow: a runtime finding (an error, a slow node, a loop with the wrong count) is turned into
a DESIGN node by looking its `#identifier` up in `oic_get_blueprint` / `oic_describe_activity`. Reason about
the fix on the design node, never on the raw runtime record.

## 4. Targeted SEARCH — find the interesting node without seeing them all

`oic_activity_flow {op:"search", …}` queries the flat index; filters compose (regex where noted,
case-insensitive):
- `errorsOnly` — just the failing nodes (paginated; the way to enumerate them all).
- `adapter` — nodes of one adapter kind.
- `text` — regex over node milestone + message; `milestone` — regex over the milestone only.
- `minIterations` / `maxIterations` — loop iteration-count range (find the loop that ran too few / too many).
- `descendantsOf {nodeId}` — restrict to one node's SUBTREE.
- `slowerThanMs` — nodes at/over an elapsed threshold (the slow-node question).

## 5. DRILL one node — `op:"node"`, pages never expands

`oic_activity_flow {op:"node", nodeId}` returns one node plus its immediate children, PAGINATED (`offset`).
Big loops are the reason for this: a loop with thousands of iterations pages its children — never expand it
whole. Loops also carry an event cap (~20K events): when a loop reports more iterations than children loaded,
the tool says so — the full log lives in the platform's flow log, not this stream.

## 6. PAYLOAD on demand — `op:"payload"`, one body

`oic_activity_flow {op:"payload", nodeId}` fetches exactly ONE node's body, only when the question is about a
VALUE (what was sent/received, why a mapped field was empty). Some nodes have no payload; the tool says so.
Never bulk-pull payloads.

**Payload attribution comes before payload reasoning.** An invoke logs up to FOUR bodies, not two: OIC's
inner prepared payload (almost always XML — Oracle's canonical form) AND the wire payload the adapter
actually sent/received, for BOTH the request and the response (with tracing on, all four are present). So
a JSON REST invoke shows an XML request + a JSON request, then an XML response + a JSON response. Seeing
an XML body does not make it the response; seeing a JSON body does not make it the request. Decide which
bodies are request and which are response from the stream's position / label / direction markers FIRST,
then match the error message against the WIRE payload of the correct direction ("could not parse the
payload" is about the wire REQUEST body, not the inner XML you happened to read).

## 7. From finding to FIX

WHERE the fix goes is a separate, governed decision — invoke the **fix-placement** skill before proposing any location: the node that errored is where a broken obligation was DETECTED, not necessarily where it was broken.

Correlate the failing/anomalous runtime node to its blueprint node (§3), read that node and its map with the
existing tools (maps · structural-nodes · source-material), identify the cause, then propose or apply the fix
per instructions.md (ASK when the change isn't determined; verify per the verification skill).

Diagnostic principle worth stating once: **a ForEach that ran FEWER iterations than its source list has almost
always been bound to the wrong repeating element** — cross-check its blueprint for-each xpath against the
schema's repeating element (the maps skill: for-each only over the schema-repeating element; the
structural-nodes foreach xpath). An overview error root cause, a loop's iteration count, and one payload are
usually enough to prove which — in that order of cost.
