---
name: fusion-sql-review
description: Use before finalizing any Fusion SQL query to catch common grounding and scoping pitfalls — unvalidated tables/columns, guessed join keys, and missing org/currency/date scoping.
---

# Fusion SQL pre-flight review

Run this checklist on a drafted Oracle Fusion query **before** presenting it. For each item, if it
fails, fix it using the `fusion-schema` MCP tools — do not hand-wave.

## 1. Every object is validated
- [ ] Each table/view in the query was confirmed with `validateTable` (not recalled from memory).
- [ ] Each column was confirmed with `getColumns` / `validateColumns` on its table.

## 2. Every join is real
- [ ] Each join uses keys returned by `getRelatedTables` (declared FK or high-confidence mined),
      not a guessed `*_ID = *_ID`.
- [ ] Name/description columns resolve through the correct path (e.g. a supplier/customer often
      carries `PARTY_ID` into `HZ_PARTIES.PARTY_NAME` rather than holding a name column itself —
      verify with `getColumns`).

## 3. Scoping is explicit where it matters
- [ ] **Multi-org**: does the query need an `ORG_ID` / business-unit filter?
- [ ] **Currency**: are amounts summed across possibly-mixed currencies? Note it or add a currency
      dimension / conversion.
- [ ] **Status/date semantics**: is the intended status flag and date type (creation vs transaction
      vs accounting) the one the user meant? (If it was ambiguous, you should have already asked.)

## 4. Output
- [ ] Oracle dialect (e.g. `FETCH FIRST n ROWS ONLY`, not `LIMIT`).
- [ ] SQL in a single ```sql block, with a one-line note on any assumption made.

If any table or column could not be validated, say so explicitly instead of emitting the query.
