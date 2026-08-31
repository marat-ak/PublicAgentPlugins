---
name: port-map
description: Use when porting a map body from another integration or an .iar export ("make map mX equal to the map from integration Y / this .xsl file") — the prefix remap algorithm. A learning/benchmark aid; the production flow is the author-map skill.
---

# Porting a map body from another integration (prefix remap)

Use when a task says "make map mX equal to map from integration Y / this .xsl file".
The source doc's prefixes are INVALID here (see the maps skill, THE NAMESPACE LAW). Port = remap by URI.

## Algorithm (mechanical — never regex-scrape a header for prefixes, never mint your own)
1. Get THIS map's server prefix table: `oic_get_map_namespaces {mapId}` → `namespaces: [{prefix, ns}]`.
   Invert → `uri→prefix`.
2. `oic_get_map_xslt {mapId}` → FRESH doc. Keep everything through `</oracle-xsl-mapper:schema>` UNTOUCHED
   (server-owned header + schema section).
3. From the SOURCE doc: take the tail AFTER `</oracle-xsl-mapper:schema>` (xsl:params + ALL templates,
   including named templates, + `</xsl:stylesheet>`). The SOURCE header's `prefix→uri` map tells you what
   each source prefix MEANT (reading the source header is fine — it's dead input, not a live authority).
4. For every prefix used in the tail (wherever a `prefix:` token can appear):
   - source URI has an entry in the server table → rename that prefix to the SERVER's prefix throughout the
     tail (regex `\b<prefix>:` — longest prefix names first to avoid partial hits).
   - source URI absent from the table → **WE NEVER GENERATE A NAMESPACE DECLARATION.** The payload is not in
     this map's model. Register it (`extraSources` on a save / confirm the payload exists upstream), re-run
     `oic_get_map_namespaces`, use the server's entry. Still absent → STOP and report.
   - prefix not declared in the source header (typically the target `nstrgmpr`) → leave as-is; the fresh
     wrapper defines the target binding.
5. Assemble: UNMODIFIED fresh header + fresh schema section + remapped tail.
6. Save with `oic_set_map_xslt {mapId, xslt: <assembled doc>}` + `extraSources` for every `xsl:param` the
   tail declares (see the maps skill, source registration).
7. Verify per the maps skill §Verifying (refetch + fresh verify; params must survive).

## Gotchas
- Do the string work in a small script written to a scratch file — never hand-edit 20KB+ XSLT inline
  (silent corruption risk).
- Strip nothing else: keep `xml:id` attributes, keep named templates, keep param order.
- If the source tail references a payload that does not exist in the target integration (different node
  names), STOP — porting cannot fix a topology mismatch; report it.
