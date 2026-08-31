# PublicAgentPlugins

Public Claude Code plugin **marketplace** by gnimsys (Marat Akselrod).

Marketplace name: **`public-agent-plugins`**

## Add this marketplace
```
/plugin marketplace add https://github.com/marat-ak/PublicAgentPlugins.git
```

## Plugins
| Plugin | Description |
|---|---|
| **fusion-sql** | Oracle Fusion Cloud SQL expert — grounds tables/columns/relations against the real Fusion schema (via the fusion-schema MCP), asks a clarifying question when ambiguous. |
| **oic-builder** | Oracle Integration Cloud (OIC) design-time builder — works exclusively through the oic MCP tools: adapter endpoints via the generic wizard, XSLT maps under the namespace law, structural nodes, with a hard no-memory rule and fresh-verify discipline. |

```
/plugin install fusion-sql@public-agent-plugins
/plugin install oic-builder@public-agent-plugins
```

## Layout
```
.claude-plugin/marketplace.json   marketplace manifest
fusion-sql/                        the plugin (instructions, SessionStart hook, skills)
oic-builder/                       the plugin (instructions, SessionStart hook, skills)
```
