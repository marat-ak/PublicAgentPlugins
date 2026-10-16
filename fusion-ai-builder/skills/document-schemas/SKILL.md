---
name: document-schemas
description: Use when the request involves a document schema (.documentSchema), a Draft-07 JSON Schema generated from one source document — creating it, attaching or replacing the source document, generating or editing the schema, validating, customizing a seeded schema, or saving it.
---

# Document schemas

Format authority: `skills/aistudio/references/prompts/document-schema-builder.md` (the
generator's own strict rules) + `skills/aistudio/references/prompts/document-schema-cli-compat.md`.

- One schema per file (`src/documentSchemas/<code>.documentSchema`) and ONE source document per
  schema; to use another document, `do-remove-document-schema-document` first.
- Ask when missing: name, code, the source document and its description, save intent.
- The source document is the user's upload: `fai_file_put {fileId}` → `do-add-document-schema-document
  {file, path:'inputs/<file>', description}` (uploads and parses on the pod). Already-uploaded
  metadata (`documentId`, `parsedDocumentId`, `fileName`) attaches offline.
- `do-generate-document-schema {file, prompt?}` (pod) writes the schema: root `type: object`,
  every property present in the document. Never add fields by hand to "complete" it; manual edits
  go through `do-update-document-schema {specification}`.
- `validate-document-schema` after every change. A seeded schema is adapted with
  `do-customize-document-schema` (pod), which creates a customization draft.
- Save on an explicit ask (`fai_pod_save {kind:'documentSchema'}`); publishing is denied;
  `do-delete-document-schema {remote:true}` → ask, then `confirm:true`.
- Oracle's references do not document a workflow field that names a document schema (the
  `DOCUMENT_PROCESSOR` `template` used in LLM extraction mode is undocumented), so a schema travels
  only as its own export — say so when a workflow seems to depend on one.
