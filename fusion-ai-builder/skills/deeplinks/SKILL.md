---
name: deeplinks
description: Use when the request involves a deeplink artifact (.dl — a Fusion page URL with tokens), a deep link tool that opens one, or deep link discovery on the pod (list-deep-links, search-deeplink-tools).
---

# Deeplinks and deep link tools

Format authority: `skills/aistudio/references/prompts/artifact-conventions.md` (file shape) and
the CLI's own help (`fai_cli_help {command:'do-create-deeplink'}`); tools:
`skills/aistudio/references/prompts/tools-builder.md`.

- A `.dl` is the source artifact: `do-create-deeplink {name, description, family, product,
  destinationUrl, deeplinkCode?, message?, usageType?, parameters?}`. Each `{TOKEN}` in
  `destinationUrl` becomes a `deepLinkProperties.parameterDefinitions` entry that needs a
  `description` and a `sampleValue` (`do-modify-deeplink-parameter {parameterName, patch}`) or
  `validate-deeplink` fails. Changing the URL (`do-update-deeplink {patch}`) resyncs the tokens.
  `deepLinkProperties` is JSON locally and stringified only on save. In shipped `.dl` files the
  `message` carries a `{deepLink}` placeholder where the link goes.
- A deep link TOOL is a different artifact: `do-create-tool {toolType:'deep-link', deepLinkId}`
  references an EXISTING, saved deeplink by server id (`list-deep-links`, pod) and shows its
  message read-only — never set a message on the tool. A new URL is a `.dl` first, saved, then
  the tool.
- Workflows reach a deeplink only through a tool (`TOOL` node → deep link tool → deeplink).
- How a tool references its deeplink: `deepLinkTool[].deepLink.deepLinkCode` (Studio export form),
  only `deepLinkId` (CLI-created tools — matched against the `.dl` file's `deepLinkId`, so a fresh
  local `.dl` without a server id cannot be matched until it is saved and fetched), or
  `specification.baseObjectCode` (Oracle sample form). Anything unmatched is listed in `missing[]`.
- Saving both: `fai_pod_save` on the tool saves the `.dl` first.
