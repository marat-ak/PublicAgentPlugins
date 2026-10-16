---
name: connectors
description: Use when the request involves a connector definition (generated from an OpenAPI or MCP spec), a connector instance (a configured connector), a connector tool, or Knowledge Management connector discovery (list-km-connectors, list-km-connector-tools).
---

# Connectors — definitions, instances, connector tools

Format authority: `skills/aistudio/references/prompts/connector-definition-cli-compat.md`,
`skills/aistudio/references/prompts/connector-instance-cli-compat.md`; the tool side:
`skills/aistudio/references/prompts/tools-builder.md`. Exact flags: `fai_cli_help {command}`.
Everything here except local patching and validation needs the pod (**pod-operations**).

## What they are

- A **Connector Definition** is a server record: `do-generate-connector-definition` creates it on
  the pod and writes `src/connectorDefinitions/*.connectorDefinition` with its server ids. There is
  no offline create — never assemble the file by hand. Identity = `connectorDefinitionId`.
- A **Connector Instance** is always bound to one definition (`connectorDefinitionArticleId`); its
  `code` is the content type reference key. For form-backed definitions `do-create-connector-instance`
  writes a local draft; for custom/internal definitions it creates the server record directly.
- A **connector tool** (`do-create-tool {toolType:'connector'}`) binds a KM connector instance by
  server ids (`specification.kmConnectorConfig.connectorId` / `connectorReferenceKey`). Exports
  always list that binding in `missing[]`: it cannot be packaged and must exist on the target.

## Flow (Oracle's staged flow — one question per stage)

1. Reuse first: `search-connector-definitions {query}` → offer Name + Overview, never internal
   ids; the user picks one.
2. A new definition only when nothing fits or the user asks: the spec comes from the user
   (`fai_file_put {fileId}` → `do-generate-connector-definition {specFile:'inputs/<file>', name}`)
   or an MCP server URL (`mcpInstanceUrl`). Failure before an id is returned → one retry with
   `verbose:true`, then report. An id returned but the detail fetch failed →
   `do-fetch-connector-definition {connectorDefinitionId, verbose:true}`; never generate twice.
3. Before EVERY instance create: `prepare-connector-instance-create {connectorDefinitionId, name,
   …values collected so far}` and ask ONLY for the returned `nextStage` (family → product →
   syncFields → config → optionalConfig → ready). Families/products from `list-workflow-families`
   / `list-workflow-products`; user groups from `list-connector-user-groups` (All Users `-5` stands
   alone); the prefix from `suggest-connector-instance-prefix`.
4. `ready` → `do-create-connector-instance` → `validate-connector-instance`; save
   (`do-save-connector-instance` or `fai_pod_save`) only on an explicit ask.

## Rules

- A secret config value: warn first that it is stored in the local draft and sent on save; never
  repeat it; pass it through a `files` blob, not inline text.
- `do-unpublish-connector-definition` and `do-delete-connector-instance` change server state: ask,
  then `confirm:true`. Publishing a definition is denied.
- Local edits: `do-update-connector-definition` / `do-update-connector-instance {patch}`; the CLI
  names any field it does not support.

## Common mistakes

- Asking for auth or config before `prepare` returns `nextStage: config`.
- Showing definition ids in a choice list; combining several stages in one question.
- Running generation again after a partial success.
