---
name: policy-templates
description: Use when the request involves a policy template (.policyTemplate) — the prompt and function contracts a template-based policy is generated from — creating, editing, validating, listing, fetching or saving one, or resolving a policy's policyTemplateCode.
---

# Policy templates

Format authority: `skills/aistudio/references/prompts/policy-store-builder.md` +
`skills/aistudio/references/prompts/policy-store-cli-compat.md`. Policies themselves: skill
**agents-topics-policies**.

- A template = a generation prompt + `specification.functions` (function contracts: input
  parameters and a return contract). A policy names it in `specification.policyTemplateCode`;
  template-mode generation (`do-generate-policy-functions`) fills the policy's functions from these
  contracts. `ORA_GENERIC_POLICY_TEMPLATE` is the seeded generic template — reference it, never
  copy it.
- Build: `do-create-policy-template {name, code, prompt}` → contracts
  `do-create-policy-template-function {function}` / `do-modify-policy-template-function
  {functionCode, patch}` / `do-delete-policy-template-function` → inputs
  `do-add-policy-template-function-input {functionCode, parameter}` / modify / delete → return
  `do-set-policy-template-function-return {functionCode, returnParameter}` →
  `validate-policy-template`.
- Remote reads: `list-policy-templates`, `get-policy-template {code}`, `fai_pod_fetch
  {kind:'policyTemplate'}` (pod). Templates have no publish step.
- `do-save-policy-template` creates when the file has no `id` and patches the record with that
  `id` when it has one — a template fetched from one pod carries that pod's `id`.
- `do-delete-policy-template {remote:true}` also deletes on the pod: ask, then `confirm:true`.
- A policy export carries its template when the template is in the workspace; a seeded template
  is listed in `missing[]` (it exists on every pod).
