---
name: structural-nodes
description: Use when adding or editing structural blueprint nodes — labels, assignments, routers+routes, foreach, scope/TRY, catchall, stop, note, throw, notification, publisher, STITCH, and node MOVE — plus expression authoring (XPath 1.0 core, fn: prefix for 2.0) and placement gotchas.
---

# Structural nodes

Every tool below works in the workspace YOU opened WITH the lock in this conversation (instructions.md
§Session lifecycle). A new node is placed relative to an anchor: BEFORE a sibling, or at the END inside
a container. Node ids are server-assigned sequentially per type (next free `l*`, `a*`, `s*`, `sc*`,
`f*`, `t*`…). If the task requires SPECIFIC ids, creation ORDER determines them — plan the order first.
Names and variable names you mint follow the core naming rule (instructions.md).

**Catalog example first.** For the node type you are about to add or modify, `oic_catalog_examples` (by
node type — ROUTER_ROUTE, FOR, WHILE, ASSIGNMENT, THROW, NOTIFICATION, PUBLISHER, STITCH, TRY, … — or by
an activity signature such as `ROUTER_ROUTE.compound`, `ASSIGNMENT.string.function`,
`NOTIFICATION.attach`) returns working examples with their expressions, variable types, conditions and
position in the flow. Copy the shape; their expressions carry FOREIGN prefixes — PREFIX SOURCE LAW (maps
skill).

**Every expression** (assignment, route condition, for-each, throw, notification): paths come from
`oic_expression_tree` read at the spot the write tool uses — where the new node goes, or the existing
node — function prefixes from `oic_xpath_functions` (the maps skill's PREFIX SOURCE LAW); the tool
declares every prefix the expression uses — no tool takes namespace pairs. A lookup value =
`oic_lookup_expression` (live-checked lookup + columns → the call). Call `oic_expression_tree` BEFORE
authoring the expression, copy the path, drill into one subtree rather than dumping the tree.

| Tool | Notes |
|---|---|
| `oic_add_label` | container for assignments |
| `oic_add_assignment` | goes into its label. XPath 1.0 core / 2.0-via-`fn:` per the maps skill §the `fn:` law. No `if/then/else` (XSLT, not a function). |
| `oic_add_router` | auto-creates its FIRST empty route (next `sc*` id) |
| `oic_add_route` | the Otherwise (default) branch is a flag — the server generates its xpath; never send your own `true` |
| `oic_set_route_condition` | set/replace a condition; re-running it also refreshes a stale route verdict. A lookup-driven condition (`<lookup call> = 'true'`) wraps the call `oic_lookup_expression` returns. |
| `oic_add_foreach` | over the REPEATING element (the maps skill: only where the schema repeats) |
| `oic_add_scope` | TRY container (`t*`). Variables declared INSIDE are invisible after it — declare outer flags before the scope. |
| `oic_add_catchall` | fault handler (`ta*`) on an EXISTING `t*`. GLOBAL fault handler creation is UNDECODED (no gt0 element exists until it materializes) — if asked, STOP and report. |
| `oic_add_stop` | valid at branch/route end only, not mid-sequence |
| `oic_add_throw` / `oic_add_note` | the throw's condition is a SKIP condition: true skips the throw, false raises the fault; to throw when X, write `not(X)`. |
| `oic_add_notification` | referenced variables must exist in scope; the body is HTML, not an expression. An address or subject kept in a lookup = the call `oic_lookup_expression` returns. |
| `oic_add_publisher` | resolves the event type's revision live (never hardcode a revision); creates its request map — configure per the maps skill |
| `oic_patch_assignment` | edit an assignment's expression in place (the tool builds the minimal body; echoing a GET body back → 400). Same expression engine as create (the maps skill §the `fn:` law). |
| `oic_expression_tree` | **the expression picker at a flow location** — every variable in scope with its PREFIXED path, type, repeat, and the writable variables. The maps skill's PREFIX SOURCE LAW. |

## Assignment authoring
Assignment is a PLAIN blueprint node (NOT a CAF wizard): create = POST, edit = the same expression via
PATCH. The designer only adds catalog READS around it: the expression picker (→ `oic_expression_tree`)
and the function catalog (→ `oic_xpath_functions`). To author generically: `oic_expression_tree` at the
assignment's spot for the variable's prefixed path, `oic_xpath_functions` for the Oracle/custom functions
and the prefix their call is written with, then `oic_add_assignment` with the expression text. The tool
declares the expression's prefixes at that spot. (Expression-engine rule — 1.0 core vs 2.0-via-prefix —
is the maps skill §the `fn:` law.)
- **Canvas label vs evaluated xpath**: the designer sends a friendly label shown on the canvas AND the
  canonical xpath of the same value; runtime evaluates the XPATH. A valid xpath given as the expression
  text works as both — only the canvas label differs; give a separate label only if you want a prettier
  canvas.

## STITCH (no dedicated tool — use the escape hatches)
A STITCH appends/assigns into a variable in place (XPath 2.0-capable — use the `fn:` prefix). Two steps,
no mapper pipeline (unlike TRANSFORMER): create the shell with `oic_node_post` (it returns the new `sh*`
id), then configure its statements with `oic_node_patch` — paths from `oic_expression_tree` at that
`sh*` node; the tool fills the node's namespaces with every prefix the statements use (never send them);
the server populates its variables. Then `oic_commit`. The same holds for any expression object in an
escape-hatch body (a logger's message, a while condition): its namespaces are the tool's.
- **Append only targets a REPEATING element** (`maxOccurs`>1). The designer reads maxOccurs from the schema
  tree and won't let you target a single node; the API just stores the path, so YOU must ensure the
  target path is a repeating element.
- The statement operations are Append / Assign / Remove.
- Expressions run XPath 2.0 via the `fn:` prefix (the maps skill §the `fn:` law).
- Keeps the SOURCE element's namespace (unlike a write-stagefile, which mints a new one) → append into a
  same-typed global var to filter/accumulate with ZERO downstream cascade (see the stage-files skill,
  cascade caveat).

## Node MOVE (any type) — `oic_move_node`
The designer's GENERIC move: several nodes move together, their relative order kept.
- BEFORE a **sibling** = reorder, OR drop INTO the container that sibling belongs to (container membership
  is implied by the anchor's position — you never name the container for BEFORE).
- At the END of a **container** (scope t*, route sc*, foreach f*, label l*) = append inside it.
- Canvas layout only re-flows on the next designer reload (blueprint is the source of truth).
- Prefer `oic_move_node` over a per-type move through the escape hatch: the per-type endpoint takes a
  different body shape (mismatching gives ICS-11115); the generic one is uniform across types +
  multi-select.

## Placement gotchas
- Build strictly in flow order — a later node cannot be anchored to a not-yet-existing predecessor.
- Appending at the END directly after a REPLY/terminal → ICS-10039; anchor a route/container instead.
- Appending at the END of a LEAF nests inside that leaf — wrong for siblings; anchor the next sibling with BEFORE.
- Deleting an invoke/stagefile CASCADES its request map. Router delete cascades routes+children.

## Persist check
After any add/patch, a 200 is not persistence: confirm the node is in the blueprint tree with your
attributes AND a fresh `oic_verify` is clean, per the verification skill.
