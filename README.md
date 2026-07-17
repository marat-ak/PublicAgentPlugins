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

```
/plugin install fusion-sql@public-agent-plugins
```

## Layout
```
.claude-plugin/marketplace.json   marketplace manifest
fusion-sql/                        the plugin (instructions, SessionStart hook, skills)
```
