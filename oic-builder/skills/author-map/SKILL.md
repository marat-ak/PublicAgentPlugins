---
name: author-map
description: Use when authoring a map (XSLT) from stated requirements — discover target/source shapes, find a corpus precedent, write the body, save with source registration, and check it landed. The production map flow (porting from another integration is the port-map skill).
---

# Authoring a map from requirements (the REAL production flow)

The user states WHAT the map must do — which target fields get which source values, grouping,
conditional emission. You author the XSLT.
(Copying from another integration — the port-map skill — is a learning/benchmark aid, not the product flow.)

## Procedure
1. **Discover the TARGET shape** — fetch the fresh doc (`oic_get_map_xslt {mapId}`): the empty template
   shows the target root element; the schema section names the target wsdl. For element structure read the
   target's wsdl/schema from the .iar (the source-material skill) or the live tree
   (`fetchTreeNodeChildren type:target` via `oic_raw_api`, jetmapper contentType text/plain). For stagefile
   writes the structure = the schema SAMPLE that created the stagefile.
2. **Discover the SOURCE shapes** — which upstream payloads/variables carry the data: `oic_get_blueprint`
   (what exists upstream), payload structures from their schema samples/wsdls. Variables are simple strings
   unless typed.
3. **Find a precedent** — `oic_corpus_find` / `oic_corpus_flow` / `oic_corpus_node_shape`: a corpus of
   real integrations; a close example de-risks structure and function choice. Corpus XSLT bodies carry FOREIGN
   prefixes — treat any example as intent-reference only; prefixes always per the maps skill's NAMESPACE LAW.
4. **Write the body**: `<xsl:param name="X"/>` for every referenced payload/variable + one
   `<xsl:template match="/">` producing the target root. XSLT 2.0 available (`for-each-group`,
   `current-group()`, `replace`); mapper functions: `dvm:lookupValue`, `oraext:encodeReferenceToBase64`,
   `xp20:*` (catalog is auto-sent by the save tool). Prefixes: the NAMESPACE LAW — the server's
   `addNamespacesToXSLT` table only; never generate declarations.
5. **Save** with `oic_set_map_xslt {mapId, spliceBody|xslt, extraSources:[…]}` — extraSources entry per
   param (source registration; otherwise params are silently stripped).
6. **Check** (discipline: the verification skill): save result `errorsCount:0` AND `sourcesReferencedCount`
   == params you used; commit; fresh `oic_verify`; refetch shows body intact.

## Authoring rules
- Emit optional target elements inside `<xsl:if test="normalize-space(…) != ''">` when the requirement says
  "only when present".
- Dates: never assume a format from memory — the agent knows neither what the source returns nor what the
  target expects (ISO-with-`T` is only one of many, and a `T`-split fits only that one). Determine the actual
  source AND target date formats from the schema/sample, or ASK the user — including which fields carry dates —
  before writing any date transform.
- Packed config / key-value strings: parsing depends on the string's ACTUAL format (delimiter, escaping,
  nesting), which the agent cannot know from memory. If the format is anything but trivial the USER must
  state it — get the exact shape from the requirement or a sample, or ASK, before writing any parse
  expression. (A `substring-before`/`substring-after` chain is right ONLY if the format is exactly a flat
  `;k=v;…`, not as a general answer.)
- Lookups: `dvm:lookupValue($lookupName, '<sourceColumn>', <key>, '<COLUMN>', '<default>')` — dvm prefix from header.
- File handoff between nodes: never pass raw file content. A FileReference xpath is the PREFERRED handoff
  WHERE THE CONSUMING OPERATION SUPPORTS IT (e.g. a stagefile read-by-reference — the stage-files skill
  §Payload references). Where the operation does NOT take a reference (e.g. a stagefile WRITE, which accepts
  only a directory/folder name + filename), supply those instead. Determine what the target operation accepts.
