---
name: business-objects-and-tools
description: Use when a workflow needs Fusion data (which business object, which function, which parameters), when wiring a BO_FUNCTION node, when creating a Business Object (.bo) or a Tool (.tool — business-object, deep-link, document, email, external-rest, mcp, connector), or when a request says "BO tool", "deeplink tool", "tool node".
---

# Business objects and tools

Format authority: `skills/aistudio/references/prompts/workflow-node-prompts/bo-function.md`
(node contract), `skills/aistudio/references/prompts/business-object-builder.md` (+
`business-object-cli-compat.md`) for `.bo`, `skills/aistudio/references/prompts/tools-builder.md`
(+ `tools-cli-compat.md`) for `.tool`, `workflow-node-prompts/tool.md` for `TOOL` nodes.

## Disambiguate the request first (Oracle's table)

| Wording | Artifact | Command |
|---|---|---|
| "business object", "BO for workers" | `.bo` source artifact | `do-create-bo` |
| "BO tool", "business object tool" | `.tool` | `do-create-tool`, business-object type |
| "deeplink" / "deep link" | `.dl` | `do-create-deeplink` |
| "deeplink tool" | `.tool` | `do-create-tool`, deep-link type |
| "add <BO function> to this workflow", "tool node", "call tool in workflow" | workflow node | `do-create-node`, a `BO_FUNCTION` or `TOOL` node |

Still ambiguous → one targeted question. Never `do-create-bo` for a "BO tool" request.

## Finding the BO and function — corpus first, pod second

1. `fai_bo_search` → candidates with their function names; `fai_bo_get` → functions with
   parameters and resource paths. Broaden terms (singular/plural, parent/child record, synonyms)
   before declaring "no source".
2. Present candidates in terms of the user's functionality; the user confirms ONE. A user-named
   BO/function takes precedence over similar search hits — no silent substitution.
3. Pod lookup (`list-supported-business-objects` via `fai_cli`; the text search
   `search-business-objects` is denied — it needs the Studio UI's own proxy) only when the user
   asked for the pod (**pod-operations**); it may return the function metadata you need directly.
4. A BO that exists in the corpus but not in the user's workspace must be exported with the
   workflow: `fai_example_copy` of that BO alone puts the `.bo` under `src/businessObjects/` so
   `fai_export`'s dependency closure finds it (an `ORA_` BO is Oracle
   seeded and usually already present on the pod — keep its code; only workflows/apps you build
   get your own codes).

## `BO_FUNCTION` node (non-derivable facts)

- It wraps a Fusion REST call: its metadata = `businessObjectCode` + `functionName` (+
  `processJson` false only when needed). `family`/`product` are editor filters, never node metadata.
- Its inputs = one per TOKEN parameter of the selected function, raw values, names verified
  against the function definition; change the function → drop stale inputs.
- Common params in shipped content: `payload` / `payload_body` (POST/PATCH body),
  `batch_payload`, `queryParamString`, `q`, `limit`, `etag` (PATCH); read the exact list from
  `fai_bo_get`.
- `outputSpecification`: let `do-create-node` enrich it when the pod is connected (with the
  selected search result as its hint); offline, declare the fields downstream nodes reference from
  `fai_bo_get`'s function output or the corpus node (`fai_example_get`, that node) — never invent
  fields.
- `personId`/`assignmentId` inputs → insert the logged-in-assignment prerequisite BO call upstream
  and bind `{{$context.$nodes.<PREREQ>.$output.items[0].PersonId}}` (and `AssignmentId`) — not
  optional; the corpus names the shipped BO for it.
- Errors: `metadata.errorNodeId` to a handler path; no invented `failure` outcome.
- Guard `items[0]` reads with a `CONDITION` before consuming them (**workflow-authoring**).

## Tools (`.tool`)

- `do-create-tool` (seven types: business-object, deep-link, document, email, external-rest, mcp,
  connector) then `validate-tool`; `do-update-tool` for edits. Business-object and deep-link tools
  infer family/product from the source — do not override; the other types need explicit
  `family`/`product` (ask).
- CLI-created External REST / MCP tools carry NO credentials (`authInfo.type = "none"`); the user
  adds auth in the UI. Never put secrets in a `.tool`.
- Deep link tools: skill **deeplinks**; connector tools: skill **connectors**. A document tool's
  files are the user's uploads: `fai_file_put` each, then name their workspace paths in the
  tool's documents (uploaded to the pod during create).
- The `do-create-*-tool` aliases are denied; `do-create-tool` is the one entrypoint.
- `TOOL` node: `metadata.toolCode` + the tool's declared inputs; the multi-file processor tool
  reads chat attachments by `{{$context.$workflow.$conversationId}}` (pattern in
  **workflow-authoring** §Chat input).

## Common mistakes

- Persisting `family`/`product` or the whole search result in the node metadata.
- Referencing `$output.<field>` the function does not return.
- Building prompts that assume BO fields before the BO is confirmed.
