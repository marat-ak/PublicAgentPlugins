# fusion-sql plugin

Oracle **Fusion Cloud** SQL grounding for Claude Code / the Claude Agent SDK. Turns natural
language into Fusion-correct Oracle SQL by validating every table/column/relation against the real
Fusion schema (the models know **EBS**, not Fusion), and asking one clarifying question when a
request is ambiguous.

Pairs with the **fusion-schema MCP server** (grounding tools: `searchTables`, `validateTable`,
`getColumns`, `validateColumns`, `getIndexes`, `getRelatedTables`).

## What it provides
- **`instructions.md`** — the agent's behavior (grounding workflow + clarify-first rule). The
  engine splices `instructions.md` into the system prompt each turn, so editing it changes
  behavior on the next turn (`git pull`, no rebuild).
- **`hooks/`** — PreToolUse hooks (skill routing record + authoring skill gate) and the PreCompact
  hook that preserves key facts across compaction.
- **`skills/fusion-sql-review`** — a pre-flight checklist the model runs before finalizing a query.

## Use in your own Claude Code
```
/plugin marketplace add https://github.com/marat-ak/PublicAgentPlugins.git
/plugin install fusion-sql@public-agent-plugins
```

## Use in the Fusion SQL agent (container)
The `fusion-agent` container clones this public repo (no auth) and loads `fusion-sql` via the SDK
`plugins` + `settingSources` options. See the fusion-agent README.

## Customize
Edit `instructions.md` (behavior) or add skills under `skills/`. Commit + push; the agent picks up
changes on its next `git pull`.
