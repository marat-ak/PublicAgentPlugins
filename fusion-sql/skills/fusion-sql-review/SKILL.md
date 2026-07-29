---
name: fusion-sql-review
description: Use when resolving a domain-ambiguous Fusion request (findSimilarQueries returned ambiguous:true) and before finalizing any Fusion SQL. Provides the domain cue-table, ask/combine templates, Financials sub-ledger traps, a pre-flight grounding/scoping checklist, and the modern-Oracle-SQL construct menu.
---

# Fusion SQL: disambiguation + pre-flight review

Two jobs: (1) **resolve the domain** when the corpus split, and (2) run the **pre-flight checklist**
before you present any query. Fix every failure with the `fusion-schema` MCP tools — do not hand-wave.

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
