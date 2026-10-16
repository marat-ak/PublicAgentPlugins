---
name: agents-topics-policies
description: Use when the request involves an AGENT node, a reusable agent artifact (.agent), topics/guardrails/instructions (.topic), a policy store or policy node (.policy), or a reusable function template (.function) — including deciding AGENT node vs LLM node and private vs reusable agents.
---

# Agents, topics, policies, functions

Format authority: `skills/aistudio/references/prompts/workflow-node-prompts/agent.md` (node),
`skills/aistudio/references/prompts/artifact-conventions.md` (`.agent`/`.topic` file shapes and
commands), `skills/aistudio/references/prompts/policy-store-builder.md` (+
`policy-store-cli-compat.md`), `skills/aistudio/references/prompts/function-builder.md` (+
`function-cli-compat.md`). Patterns: `fai_examples_search {nodeType:'AGENT'}` and
`fai_examples_search {kind:'agent'}` / `{kind:'topic'}`.

## AGENT node vs LLM node (Oracle's rule)

No tools attached → `LLM`. `AGENT` only when tool-backed behavior is required and at least one
tool code is attached. Private is the default: `metadata.type = PRIVATE`, inputs `prompt` +
`message` (raw strings), `metadata.specification.{maxInteractions (1–20, required), agentRole,
summarizationMode Default|Custom|Disabled, summarizationPrompt, outputSpecification}`, top-level
`metadata.toolCodes[]` / `topicCodes[]`. Chat memory = `metadataPatch.chatHistoryEnabled`. On an
existing node, change part of `metadata.specification` with `fai_wf_field_edit {node,
field:'metadata:specification', merge:{…}}` — a `metadataPatch` replaces it whole.

Reusable mode only when the user explicitly wants an existing reusable agent: `metadata.type =
REUSABLE`, `metadata.agentCode` = the real code, `message` input, plus ONLY the variable inputs
that agent declares (`{{$context.$agents.$self.$input.<name>}}` inside the agent's prompt); its
output schema is read-only.

## `.agent` artifact

`do-create-agent {…}` → `do-add-agent-tool {…}` per tool → topics via mappings. Local shape:
`specification` is an object; `agentToolMappings` / `agentTopicMappings` are arrays. Shipped
agents that gather input multi-turn use step-wise prompts ("ask one question at a time, never
repeat answered questions"), a terminate sentinel, and the pills tag for selectable answers
(**widgets-and-forms**). A `WORKFLOW` orchestrator typically builds one fully-qualified message
(context + history + user message) and a router LLM + `SWITCH` dispatches to the agent nodes.

## Topics (`.topic`)

`do-create-topic` then `do-add-topic-instruction`. Files use BOSS field names directly
(`instructions.items`), no `specification` wrapper. Shipped guardrail topics are parameterized
with `${…}` template variables filled at runtime (primary goal, allowed related topics,
strictness, max redirects) — reuse the seeded guardrail topics by code rather than re-authoring
them; author a new topic only for domain instructions.

## Policies (`.policy`) and function templates (`.function`)

- Policy: `do-create-policy` (ask template code, roles, generation prompt when missing;
  `ORA_GENERIC_POLICY_TEMPLATE` for a generic document-derived policy; the template itself: skill
  **policy-templates**) → documents (`fai_file_put` the user's upload, then
  `do-add-policy-documents {documents:[{path, description}]}`) and function generation need the
  pod → workflow use via `do-create-policy-node {policyFile}` (a `POLICY` node stores `policyCode`
  + `functionCode`; several functions → ask which). `validate-policy` after edits. Save is a user
  decision; publish is denied.
- Function template: `do-create-function` → `do-generate-function-implementation` (pod) →
  `validate-function`; `run-function {functionCode, input}` and `run-function-test-cases` execute
  it offline; in workflows use `do-create-function-node {functionFile}` — not a hand-built `CODE`
  node (the node's `functionTemplateCode` is the reference `fai_export` follows).

## Common mistakes

- `AGENT` with empty `toolCodes`; `maxInteractions` at top-level metadata; `prompt` under
  `metadataPatch`.
- Inventing reusable-agent inputs the agent does not declare; leaving stale inputs after switching
  agents.
- Wrapping a topic in `specification`.
