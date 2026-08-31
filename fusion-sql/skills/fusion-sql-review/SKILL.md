---
name: fusion-sql-review
description: Use before finalizing ANY Fusion SQL (pure-SQL request OR a data model's dataset SQL), and whenever findSimilarQueries returned ambiguous:true. Provides the end-to-end SQL build workflow (ground -> validate -> grain-check -> clarify -> adopt/adapt/derive), the domain cue-table + ask/combine templates, Financials sub-ledger traps, a pre-flight grounding/scoping checklist, and the modern-Oracle-SQL construct menu.
---

# Fusion SQL: build workflow + disambiguation + pre-flight review

Three jobs: (0) run the **SQL build workflow** that PRODUCES the query; (1) **resolve the domain**
when the corpus split; and (2) run the **pre-flight checklist** on the drafted query before you
present it. Fix every failure with the `fusion-schema` MCP tools — do not hand-wave. This is the SQL
playbook for BOTH a bare SQL request and the dataset SQL inside a data model.

## Part 0 — the SQL build workflow (produces the query; Part B then verifies it)
1. **`findSimilarQueries(<intent>)` FIRST** — handle its result per the CORE rule in the base
   instructions (`ambiguous:false` → adopt matches; `ambiguous:true` → Part A: ask or per-domain-
   combine). Use `getReportQuery` / `listQueriesForSubjectArea` if the user named a report or
   subject-area table.
2. **Validate + adapt** — `validateTable` every table (fix via suggestions / `searchTables`);
   `getColumns` / `validateColumns` before using columns; `getRelatedTables` for real join keys (never
   guess FKs). Reuse the corpus example's joins/filters where they fit.
2b. **CHECK GRAIN before any GROUP BY / SUM / COUNT — never assume one-row-per-key.** `validateTable`
   returns a `grainWarning` for multi-row tables (or call `getTableGrain(table)`). A driving/fact table
   that is NOT `single_row` KEEPS MULTIPLE rows per business key, and summing it blind DOUBLE-COUNTS:
   - `effective_dated` (`_F`/`_M`): add `SYSDATE (or :as_of) BETWEEN effective_start_date AND
     effective_end_date` on EVERY date-tracked table in the join — a missing one MULTIPLIES; open row
     ends 4712-12-31. If it also has a `primary_flag`/latest flag, add `=`Y`` too.
   - `latest_flag`: filter the flag (`latest_rec_flag`/`latest_flag`/`current_flag`/`primary_flag` `='Y'`).
   - `translation` (`_TL`): filter `LANGUAGE='US'` or join the `_VL` view — else counts inflate per language.
   - `revision_suspect` (e.g. `DOO_HEADERS_ALL` — keeps every order revision, NO latest flag): do NOT
     assume one row. If you can run SQL (CB run_sql / pod), PROBE the actual grain first:
     `SELECT <key>, COUNT(*) FROM <t> WHERE <state filters> GROUP BY <key> HAVING COUNT(*)>1 FETCH FIRST 5 ROWS`.
     If multi-row, keep the current revision via `MAX(object_version_number) OVER (PARTITION BY <key>)`
     (quantities from the current revision; EFF/attachments may be resolved across all). Never state a
     grain fact as "grounded" from memory — the schema does NOT encode revision retention; verify or flag it.
3. **Clarify remaining ambiguity BEFORE writing SQL** (ONE ask): "unpaid" → never-paid vs open
   balance; "revenue" → booked vs recognized vs invoiced; a date → creation vs transaction vs
   accounting; "customer"/"supplier" → party vs account vs site. **Ask the user** (per the ask
   protocol in the base instructions) whenever the choices are enumerable — same for domain
   disambiguation and any layout/parameter question elsewhere in the flow. The corpus IS the glossary:
   when top matches embody DIFFERENT definitions of the requested measure (e.g. one exemplar computes
   "balance" from open documents only, another nets unapplied receipts), that disagreement is itself
   an enumerable ambiguity — put it in the ask with options derived from the matches.
3b. **RE-GROUND after every clarification.** A user's answer that changes the definition, scope,
   or as-of semantics of the measure ("summary", "as of today", "net of receipts") makes your FIRST
   retrieval stale — re-run `findSimilarQueries` with the REFINED intent before writing SQL. The
   refined phrasing surfaces exemplars the original phrasing missed (verified: the as-of +
   receipts technique ranks top only after refinement).
4. **Write the SQL — adopt-before-derive.** Dialect **Oracle** (Fusion). Climb DOWN this ladder only
   with a stated reason, never start below the top rung that fits:
   1. **Adopt** — a match already does the job (its SQL answers the ask) → take it whole; only
      cosmetic bind/column adjustments.
   2. **Adapt** — the closest match does most of the job → start FROM its SQL, modify, and tell the
      user what you changed and why. Any term/filter the exemplar has that you dropped (a receipts
      bucket, a security predicate, a date-effectivity clause) must be adopted or explicitly flagged.
   3. **Derive** — no single match is close → compose from the mechanics of several matches; keep
      the effective-date / security filters the real reports use.
   4. **From scratch** — nothing grounds → say so explicitly before writing.
   **When you adopt/adapt a BIG report, GET ITS REAL SQL FIRST.** `findSimilarQueries` omits the SQL
   of large exemplars (`cleanSqlOmitted:true` + `sqlChars` + the match's `id`) — the mechanics text is
   a MAP, not a substitute. Before adopting/adapting such a match, call `getReportQuery` passing the
   match's **`id` VERBATIM** (e.g. `getReportQuery({id:"sql:c999…"})`) — NEVER guess a human title
   ("Aging 4 Bucket Report" is not a title; it will 404). That returns the full SQL (never clipped);
   a `.xdm` with several datasets returns the main one plus a `datasets[]` list to fetch by id.
   **Dropping a table the exemplar joins requires a STATED, SPECIFIC reason** — read the real SQL and
   for EACH omitted table say why it is safe to drop (it serves a grain you excluded: site/address,
   GL-account breakdown, a receipts UNION branch; OR it only supplies display labels). NEVER drop a
   table that carries load-bearing logic — a security predicate, an effective-date (`_F` date range),
   a dedup guard (`latest_rec_flag='Y'`, `account_class='REC'`, `complete_flag='Y'`, a greatest-n
   filter) — unless you can show the remaining query doesn't need it (e.g. the driver is already
   one-row-per-grain). Deciding what to drop from the mechanics SUMMARY instead of the real query is
   how a load-bearing filter gets silently lost and the numbers quietly go wrong.
   **Surface the built-in**: when a match is a STANDARD Oracle report/view that already does the job
   (its catalog path names it), tell the user — "a built-in <name> report shows exactly this; want
   its shape or a custom variant?" Users don't know built-ins exist; naming them is part of the answer.
5. **Explain briefly, then give the final SQL in a single ```sql fenced block.** (Totals/subtotals are
   part of the OUTPUT shape and belong in the SAME detail query via `ROLLUP`/`GROUPING SETS` — see the
   datamodel-authoring "Computation belongs in SQL" section — NEVER a second summary SELECT.)

## Part A — disambiguation (when `findSimilarQueries` returns `ambiguous:true`)

`ambiguous:true` means the closest real reports split across ≥2 near-tied business domains, and **no
`cleanSql` is returned** — the `candidates` carry titles + tables but no query, on purpose, so you
cannot copy a guess. You have **zero grounded SQL**. Your EBS-era memory is exactly what the split is
warning you is wrong. Resolve the domain first; never emit SQL from memory in this state.

**Step 1 — did the USER already name the domain?** `ambiguous:true` only means the *retrieval*
overlapped; it does not override an explicit user cue. If the user's words pin the domain, treat it as
resolved: call `findSimilarQueries(intent, {domain:"<that domain>"})` and **do NOT ask.** The `domain`
param takes a top level (`"Financials"`, `"HCM"`), a sub-domain (`"AP"`, `"AR"`), or a full key
(`"Financials/AP"`).

Cue → domain:

| User's words | Domain |
|---|---|
| "chart of accounts", "COA", "segment", "cost-center **segment**", "value set", "account hierarchy/tree", "GL", "budget/budgetary", "ledger" | **Financials** (or **Budgetary** / **GL**) |
| "org unit", "organization unit", "HR department", "worker", "employee", "headcount", "assignment", "position", "manager" | **HCM** |
| "supplier/vendor invoice", "payables", "we owe", "invoices we received", "supplier payment/disbursement" | **AP** (`Financials/AP`) |
| "customer invoice", "receivables", "owed to us", "invoices we issued/billed", "customer receipt/collection" | **AR** (`Financials/AR`) |
| clear procurement / inventory / payroll / project / service cues | **Procurement / SCM / Payroll / Projects / CRM-Service** |

Only when the request is the **bare term with no domain cue** (just "by department", "unpaid invoices",
"aging report") is it truly ambiguous → go to Step 2.

**Cross-domain traps** (the same word, different domains):
- `department` → **HCM** `HR_ALL_ORGANIZATION_UNITS_F` / `PER_*` vs **Financials** `GL_SEG_VAL_HIER_CF`
  / `XCC_*` / `FND_VS_*`
- `receipt` → SCM receiving vs AR cash receipt · `order` → purchase vs sales vs work order ·
  `payment` → AP disbursement vs Payroll payment

**Financials sub-ledger traps** (breakdown shows keys like `Financials/AP` vs `Financials/AR`):
- `invoice` → AP supplier invoice (`AP_INVOICES_ALL`) vs AR customer invoice (`RA_CUSTOMER_TRX_ALL`)
- same trap for **credit memo, aging, payment, balance** (GL account vs AP/AR open) and **journal**
  (GL vs subledger XLA).

**Step 2 — same term, two readings, no cue → ASK one question, emit no SQL this turn.** Name the
domains from `domainBreakdown`. Do NOT pick the "more likely" one — a confident wrong report is worse
than a question.
> *"'Department' can mean two things here: (A) the GL chart-of-accounts Department **segment**
> (financial/budgetary — value-set + account tree, Financials), or (B) an **HR department / org unit**
> (HCM). They are entirely different SQL. Which do you mean?"*

Once the user answers (or if they already corrected you, e.g. "I mean the financial department
segment"), call `findSimilarQueries(intent, {domain:"<their choice>"})` to get real example SQL, then
build on it.

**Step 3 — genuinely multi-part request spanning domains → do NOT ask.** E.g. "budget **spend** by
cost center for the **service department's** open **service requests**" is a Financials part AND a
Service part. Call `findSimilarQueries` once per domain (`{domain:"Financials"}`, then
`{domain:"CRM-Service"}`), then combine the two grounded examples into one query (join / subquery /
UNION as the request needs). If you cannot tell whether it is one term or two parts, ASK.

## Part B — pre-flight checklist (run on the drafted query before presenting it)

### 1. Every object is validated
- [ ] Each table/view was confirmed with `validateTable` (not recalled from memory).
- [ ] Each column was confirmed with `getColumns` / `validateColumns` on its table.

### 2. Every join is real
- [ ] Each join uses keys returned by `getRelatedTables` (declared FK or high-confidence mined),
      not a guessed `*_ID = *_ID`.
- [ ] Name/description columns resolve through the correct path (a supplier/customer often carries
      `PARTY_ID` into `HZ_PARTIES.PARTY_NAME` rather than holding a name column itself — verify with
      `getColumns`).

### 3. Scoping is explicit where it matters
- [ ] **Multi-org**: does the query need an `ORG_ID` / business-unit filter?
- [ ] **Currency**: are amounts summed across possibly-mixed currencies? Note it or add a currency
      dimension / conversion.
- [ ] **Status/date semantics**: is the intended status flag and date type (creation vs transaction vs
      accounting) the one the user meant? (If it was ambiguous, you should already have asked.)

### 4. Datatype consistency (prevents ORA-00932 "inconsistent datatypes")
- [ ] **NEVER do arithmetic on a DATE bind: `:date_param ± n` is banned.** Oracle types `:P + 1` as a
      NUMBER (a Date bind is not implicitly a DATE inside `bind ± n`), so `trx_date < :P_DATE_HIGH + 1`
      becomes `DATE < NUMBER` and throws **ORA-00932: expected DATE got NUMBER** at run time. This is the
      #1 cause of generated-SQL run failures and a static schema-type check MISSES it (it reads
      `DATE + 1` as DATE). For an inclusive "up to end-of-day" upper bound use one of:
      - `AND (:P_DATE_HIGH IS NULL OR trx_date < :P_DATE_HIGH + INTERVAL '1' DAY)`  ← preferred
      - `AND (:P_DATE_HIGH IS NULL OR trx_date < CAST(:P_DATE_HIGH AS DATE) + 1)`   ← explicit cast
      - `AND (:P_DATE_HIGH IS NULL OR TRUNC(trx_date) <= :P_DATE_HIGH)`             ← column-side
      Move any `+ n` to the **column** side or wrap the bind in `INTERVAL`/`CAST` — never leave it as
      bare `:bind + n`.
- [ ] No mixed types in a single expression: every `DECODE`/`CASE`/`NVL`/`COALESCE` branch returns the
      SAME base type (don't `NVL(some_date, 0)` — use `NVL(some_date, DATE '0001-01-01')` or restructure);
      every `UNION`/`UNION ALL` arm has the same type in each column position.
- [ ] Compare DATE columns to DATE binds/`TO_DATE(...)`, and NUMBER columns to numbers — never a DATE
      column to a numeric literal.
- [ ] **TIMESTAMP subtraction yields an INTERVAL, not a NUMBER.** `ts_end - ts_start` on TIMESTAMP
      columns (many Fusion audit/scheduler columns like ESS `processstart`/`processend`,
      `creation_date`, `*_timestamp` are TIMESTAMP) is an `INTERVAL DAY TO SECOND`. Using it in numeric
      arithmetic/aggregation (`* 1440`, `AVG(...)`, `ROUND(...)`, a numeric `TO_CHAR` mask) throws
      **ORA-00932: expected NUMBER got INTERVAL DAY TO SECOND**. To get elapsed minutes/seconds as a
      NUMBER, cast to DATE first or EXTRACT the parts:
      - `(CAST(ts_end AS DATE) - CAST(ts_start AS DATE)) * 1440`  ← elapsed MINUTES (preferred)
      - `EXTRACT(DAY FROM d)*1440 + EXTRACT(HOUR FROM d)*60 + EXTRACT(MINUTE FROM d) + EXTRACT(SECOND FROM d)/60`
      To DISPLAY as HH:MI:SS, keep the interval (don't coerce it to NUMBER) or build it via `NUMTODSINTERVAL`.
      Never feed a raw `ts_end - ts_start` into number arithmetic or `AVG`/`SUM`.

> The authoring engine also runs a deterministic lint on `createDataModelFile` / `setDatasetSql` and
> returns `sqlWarnings` for the `:date_param + n` hazard — if you see them, FIX the flagged dataset and
> re-create before offering to run the model.

### 5. Output
- [ ] Oracle dialect (`FETCH FIRST n ROWS ONLY`, not `LIMIT`).
- [ ] SQL in a single ```sql block, with a one-line note on any assumption made.

If any table or column could not be validated, **say so explicitly** instead of emitting the query.

## Part C — modern Oracle SQL constructs (optional — use only when the request needs them)
Target DB is Oracle 19c+ (Fusion SaaS). Default to simple, readable SELECTs; reach for these only when
the requirement (procedural fallback logic, official API values, row-pattern detection, JSON shaping)
actually demands it — never for show.
- **Inline PL/SQL**: `/*+ WITH_PLSQL */` + `WITH FUNCTION … / WITH PROCEDURE …` in the statement — the
  ONLY way to run procedural logic (loops, multi-step fallback rules, calling PL/SQL APIs) in SaaS,
  where creating DB objects is impossible. Mark functions `DETERMINISTIC` when they are.
  `findSimilarQueries("inline PL/SQL WITH FUNCTION technique")` has working examples.
- **Public PL/SQL APIs from SQL**: e.g. `INV_QUANTITY_TREE_PUB.QUERY_QUANTITIES` (true
  available-to-transact qty), `FND_PROFILE.VALUE(...)` (env config). Prefer an official API over
  re-deriving complex application logic in joins.
- **`LATERAL` / `CROSS APPLY` / `OUTER APPLY`** — per-row subqueries; combine with `JSON_TABLE` to
  explode JSON built by an inline function.
- **JSON**: `JSON_OBJECT`, `JSON_ARRAYAGG`, `JSON_TABLE` — aggregate-to-JSON and back.
- **`MATCH_RECOGNIZE`** — pattern matching over ordered rows (event sequences, gaps/streaks, funnels)
  where window functions get unwieldy.
- Also fair game: analytic `KEEP (DENSE_RANK FIRST/LAST)`, `LISTAGG`, `PIVOT`/`UNPIVOT`, recursive
  `WITH`, `FETCH FIRST n ROWS`.
