---
name: structural-nodes
description: Use when adding or editing structural blueprint nodes — labels, assignments, routers+routes, foreach, scope/TRY, catchall, stop, note, throw, notification, publisher, STITCH, and node MOVE — plus expression authoring (XPath 1.0 core, fn: prefix for 2.0) and placement gotchas.
---

# Structural nodes

All create tools take `anchor` + `rpi` (`BEFORE` = insert before anchor node; `AT_END` = append inside anchor
container). Node ids are server-assigned sequentially per type (next free `l*`, `a*`, `s*`, `sc*`, `f*`, `t*`…).
If the task requires SPECIFIC ids, creation ORDER determines them — plan the order first.
`name`/`variableName` values you mint follow the core naming rule (instructions.md).

| Tool | Notes |
|---|---|
| `oic_add_label {name, anchor, rpi}` | container for assignments |
| `oic_add_assignment {anchor, variableName, textExpression, xpathExpression?, namespaces?, variableType?}` | XPath 1.0 core / 2.0-via-`fn:` per the maps skill §the `fn:` law. No `if/then/else` (XSLT, not a function). namespaces = ARRAY of `{prefix, namespace}` — prefix names are FREE here (sent with URIs), unlike maps. dvm lookups need the `dvm:` prefix pair. |
| `oic_add_router {name, anchor, rpi}` | auto-creates its FIRST empty route (next `sc*` id) |
| `oic_add_route {routerId, otherwise?, expressionName?, textExpression?, xpathExpression?, namespaces?}` | `otherwise:true` = default branch (server generates xpath — never send your own `true`) |
| `oic_set_route_condition {routeId, textExpression, xpathExpression?, expressionName?, namespaces?}` | set/replace condition; re-running it also refreshes a stale route verdict |
| `oic_add_foreach {name, anchor, rpi, variableName, textExpression, xpathExpression, namespaces?, parallel?}` | xpath = repeating element |
| `oic_add_scope {name, anchor, rpi}` | TRY container (`t*`). Variables declared INSIDE are invisible after it — declare outer flags before the scope. |
| `oic_add_catchall {tryId}` | fault handler (`ta*`) on an EXISTING t*. GLOBAL fault handler creation is UNDECODED (no gt0 element exists until it materializes) — if asked, STOP and report. |
| `oic_add_stop {anchor}` | valid at branch/route end only, not mid-sequence |
| `oic_add_throw {…}` / `oic_add_note {…}` | see tool schema |
| `oic_add_notification {anchor, rpi, name, from, to, subject, body, attachments?}` | from/to/subject = `{textExpression, xpathExpression?}`; body = HTML string; referenced $vars must exist in scope; `name` REQUIRED |
| `oic_add_publisher {anchor, rpi, name, eventCode}` | resolves eventType code→revision dynamically (never hardcode revision); creates its request map — configure per the maps skill |
| `oic_patch_assignment` | edit expr in place. Minimal body {operation,typeDef,expression} = create body minus location (tool handles it; GET-echo → 400). Same expr engine as create (the maps skill §the `fn:` law). |
| `oic_list_datatypes {anchor, rpi?, elementType?}` | **variable catalog at a flow location** — the designer's expression-picker list. Returns `source` (readable vars) + `target` (writable vars), each `{name, ns, root}` → build xpath `$name/ns:root/…` with NO guessing of names/namespaces. Call BEFORE authoring any assignment/route/foreach/notification expression. `elementType` defaults `assignments`. |

## Assignment authoring
Assignment is a PLAIN blueprint node (NOT a CAF wizard). Create = `POST assignments {location, operation:"Assign",
typeDef:"simple", expression:{…}}`; edit = same `expression` minus `location` via PATCH. The designer only
adds catalog READS around it: `listAvailableDatatypesForLocation` (→ `oic_list_datatypes`), `xpathFunctions`
(→ `oic_xpath_functions`), `webmapper/schematree` (expression-builder tree — no tool, heavy). To author
generically: `oic_list_datatypes` to find the var + its ns/root, `oic_xpath_functions` for non-standard funcs,
then `oic_add_assignment`. (Expression-engine rule — 1.0 core vs 2.0-via-prefix — is the maps skill §the `fn:` law.)
- **textExpression vs xpathExpression**: designer sends `textExpression` = the friendly label shown on
  the canvas, `xpathExpression` = the canonical xpath of the same value (`$<var>/<ns>:<root>/…`). Runtime
  evaluates the XPATH. The tools default xpath=text — pass a valid xpath as `textExpression` and it works
  as both; only the canvas label differs. Give distinct `xpathExpression` only if you want a prettier label.

## STITCH (no dedicated tool — use the escape hatches)
A STITCH appends/assigns into a variable in place (XPath 2.0-capable — use the `fn:` prefix). Two-step, no
mapper pipeline (unlike TRANSFORMER):
1. Create shell: `oic_node_post {segment:"stitches", body:{...minimal...}}` (returns the new `sh*` id).
2. Configure: `oic_node_patch {segment:"stitches", id:"<the sh* id>", body:{ name, description:"", statements:[
   {operation:"Append", to:{type:"XPathPath", path:"$targetVar/ns:Repeating/ns:Elem"},
    from:{type:"XPathExpression", expression:"$src/ns:...[predicate]"}} ], namespaces:[{prefix,value}] }}`.
   Server auto-populates `variables[]` + the full namespace table; a MINIMAL `namespaces` (just the prefixes
   your paths use) is fine. Then `oic_commit`.
- **Append only targets a REPEATING element** (`maxOccurs`>1). The designer reads maxOccurs from the schema
  tree (`webmapper/schematree`) and won't let you target a single node; the API just stores the path, so YOU
  must ensure `to.path` is a repeating element.
- `operation` also = `Assign` / `Remove` (same to/from shape).
- Expressions run XPath 2.0 via the `fn:` prefix (the maps skill §the `fn:` law).
- Keeps the SOURCE element's namespace (unlike a write-stagefile, which mints a new one) → append into a
  same-typed global var to filter/accumulate with ZERO downstream cascade (see the stage-files skill,
  cascade caveat).

## Node MOVE (any type) — `oic_move_node {elementIds, anchor, rpi?}`
The designer's GENERIC endpoint: `POST …/blueprint/move
{elementIDs:[...], location:{rpi, anchorElementId}}` → **204**. No type/id in the path, `location` is NESTED,
`elementIDs` is an ARRAY (move several together, relative order kept).
- `rpi:"BEFORE"` + a **sibling** id = reorder, OR drop INTO the container that sibling belongs to (container
  membership is implied by the anchor's position — you never name the container for BEFORE).
- `rpi:"AT_END"` + a **container** id (scope t*, route sc*, foreach f*, label l*) = append inside it.
- Canvas layout only re-flows on the next designer reload (blueprint is the source of truth).
- Body shape is endpoint-specific: the generic `blueprint/move` needs the NESTED `location:{}`, the per-type
  `.../move` needs a FLAT `{rpi,anchorElementId}` — mismatching gives ICS-11115. `oic_move_node` handles this;
  prefer it (uniform across types + multi-select).

## Placement gotchas
- Build strictly in flow order — a later node cannot be anchored to a not-yet-existing predecessor.
- Appending AT_END directly after a REPLY/terminal → ICS-10039; anchor a route/container instead.
- Deleting an invoke/stagefile CASCADES its request map. Router delete cascades routes+children.

## Persist check
After any add/patch, a 200 is not persistence: confirm the node is in the blueprint tree with your
attributes AND a fresh `oic_verify` is clean, per the verification skill.
