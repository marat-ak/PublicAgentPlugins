---
name: data-access-security
description: Use before emitting or running ANY Fusion SQL — a final answer, a data model's dataset or LOV SQL, a runSql / run_sql / explain_plan probe, SQL in prose or in a hand-off — to apply the kernel's data-access rule: the SQL it secures reads only the data the running user may see, the rest runs plain. Covers the pod `instance` the plan needs, the developer PLAN from getDataAccessPredicate (one secured CTE per table + the rewrite map, a grade and the keying — table, or the OTBI subject area with `subjectArea` — on every condition, blocked / unsecured tables), the END-USER plan getSecuredQueryPlan (subject-area gate + column whitelist with filter-only columns, the strictest of candidates, the structural none rule, the no-area policy; the end-user overlay owns that flow), running or delivering the statement with the plan's slots left in place through ONE runSecuredSql call (the server fills Oracle's own condition — FND_DATA_SECURITY, by object + privilege NAME, for the user whose session runs the SQL — the text never enters the conversation; deliver run / dataset / file), sign-in only on an auth-required reply, sensitive tables and masked columns, the three access verdicts (restricted / none / global) and their wording, the "built for the running user" rule for data models, plain (unsecured) SQL, and the mandatory `Data access:` lines of the Filter check.
---

# Data-access security — secured SQL reads only the user's data

A BIP SQL dataset, `runSql` and `run_sql` execute the SQL exactly as written: Fusion data security
(the business units, ledgers, organizations, persons … the user may see) is NOT applied for you. So
every query you secure reads each secured table through its **secured CTE**, whose condition is the one
**Oracle itself generates for the running user** — `FND_DATA_SECURITY.GET_SECURITY_PREDICATE`, called on
the user's pod by **object + privilege NAME**. Nothing about the condition is stored or guessed on our
side: the catalog knows WHICH object and privilege secure a table on THAT pod; the pod produces the text.
You never see or handle that text: you write the plan's `{PRED:<object>|<privilege>}` slots, and
`runSecuredSql` fills them server-side and runs or delivers the result.
Which SQL is secured and which runs plain is the kernel's data-access rule; this skill is the how.

## The pod `instance` — required, never guessed
The plan is per pod. `instance` = the pod host EXACTLY as a `runSql` or `run_sql` reply in this
conversation reports it (`instance` field). No such reply yet → run one trivial probe (`select 1 from dual`)
and take its `instance`. A `run_sql` reply without `instance` is not a Fusion pod connection — there is no
data-access plan for it; say so. Never type a host from memory, another conversation or a URL guess. An
"unknown instance / no layer loaded" error names the loaded pods: relay it — the data-access layer of
that pod has to be loaded first (an admin action) — and do not emit the SQL unsecured as a substitute.

## Two tools, one flow
1. **`getDataAccessPredicate({instance, tables:[{table, alias}, …], subjectArea?})`** (fusion-schema) — ONE
   call with EVERY table instance of the statement (FROM, joins, inline views, scalar / IN / EXISTS
   subqueries, every UNION arm, the query's own CTEs; the same table twice = two entries, two aliases). It
   returns the developer plan, keyed by TABLE (`keying: 'table'`) — or, when the query reads ONE OTBI
   subject area you know (the user named it, or the report is built on it), keyed on that area with
   `subjectArea` (`keying: 'area'`: each table read as that area reads it — see Reading the plan):
   - `ctes[]` — one per secured table instance: `cteName` (`<alias>_sec`), `cte` (the full CTE text with
     `{PRED:<object>|<privilege>}` slot(s)), `pairs`, `grade`, `route` (direct = the table is its own
     security object | reference = its primary context column through the reference object), `column`
     / `context` (the secured context column), `evidence`, `equivalentTo?`, `masked?`;
   - `rewrite[]` — `{from: '<TABLE> <alias>', to: '<alias>_sec <alias>'}`;
   - `pairs[]` — the distinct `{object, privilege, alias:"sec$"}` of the whole statement;
   - `blocked[]` — `{table, alias, column?, reason, candidates?}`: the pair could not be resolved —
     fail closed, nothing is guessed;
   - `unsecured[]` — `{table, alias, reason}`: no context column and not a security object (reference
     data) → the table is read directly;
   - with `subjectArea` also `columns{<alias>: {hidden, hiddenCount, maskingShapes?}}` — the columns the
     area does NOT expose (advice: an OTBI user of that area could not see them; say so when you select
     one) — and `gate: {applied: false}`: whether the running user holds the area is an END-USER rule.
2. **Write the statement with the slots LEFT IN PLACE**: put ALL the ctes, exactly as the plan gives them,
   into the statement's ONE leading `WITH` (inline PL/SQL declarations first, the query's own CTEs after
   them — they may read the secured CTEs), then apply `rewrite` to every FROM / JOIN / subquery / UNION
   arm: `FROM ap_invoices_all ap` → `FROM ap_sec ap` (the CTE returns `t.*`; the rest of the statement is
   unchanged). Never fill, edit, move or drop a `{PRED:<object>|<privilege>}` slot — the slots ARE the
   pairs the server resolves.

   ```sql
   WITH
     FUNCTION f(p NUMBER) RETURN NUMBER IS BEGIN RETURN p; END;        -- only if the query has one
     ap_sec as (select /*+ INLINE */ t.* from AP_INVOICES_ALL t
       where t.ORG_ID in (select sec$.BU_ID from FUN_ALL_BUSINESS_UNITS_V sec$
                          where {PRED:FUN_ALL_BUSINESS_UNITS_V|AP_REPORT_PAYABLES_DATA})),
     open_inv AS (SELECT … FROM ap_sec ap …)
   SELECT … FROM open_inv …
   ```
   In a data model dataset the statement is first wrapped per datamodel-authoring's CTE rule.
3. **`runSecuredSql({sql, maxRows?, deliver?})`** (fusion-pod) — ONE call with that statement. The server
   asks Oracle for each pair's condition in the session that executes this conversation's SQL (the pod
   sign-in, or the editor connection in CloudBeaver), fills every slot verbatim and delivers (see
   Deliverables). The reply carries `dataAccess`: per pair `{object, privilege, access, length}` —
   `restricted` (a condition applied), `none` (the user holds no grant for the pair: the statement still
   runs, those rows are withheld), `global` (no restriction) — plus `notes` with the wording, and the
   gate verdicts when a gate was passed. You never receive the condition text or the filled statement.
   An error of the statement points into YOUR slotted SQL (`errorPosition`; `errorIn` when it falls inside
   a condition) — fix your SQL, never the slot.

`privilege` is REQUIRED on every pair — there is no privilege-less call (a GLOBAL grant for any privilege
yields `(1=1)`: no security at all). Never invent a privilege, never pass `read`, never ask the end user
which privilege to use. When the pod cannot produce a pair's condition, `runSecuredSql` refuses the whole
call naming the pair (as it does for a truncated answer): relay it — never fill a slot yourself, never drop
the slot or the table's CTE to make the statement run.

## Reading the plan
- **Grade** — where the pair came from; it goes on the `Data access:` line: `trace` (proven by an OTBI
  LOGLEVEL-7 trace) · `inferred` (curated from the demo crawl, untraced) · `rule` (the only privilege of
  the table's module granted to the BI server identity) · `duty` (the HCM analysis-duty map) ·
  `equivalent` (one of several names with the identical grant set = the same predicate) · `consensus`
  (keyed on an area: the job roles Oracle's TBI guides name for the area agree on the privilege — every
  holder, or a unique majority — where the module rule found several or none) · `granted` (the only
  grant-set class of the module among ALL the pod's grants — not granted to the BI identity, so not
  OTBI-proven; say so) · `sensitive` (the table's own sensitive pair). End-user plans add `strictest` and
  `structural` (End-user mode below).
- **Keying `table`** — one condition per table: its own security object, or its PRIMARY context column.
  A table with several context columns is secured only when its prefix's primary context is audited
  (AP → BU from an OTBI trace; GL → ledger and DOO → business unit from the demo crawl's grant blocks) —
  the other context columns are then not applied, as OTBI does; otherwise the table is `blocked` and the
  reason says which audit is missing (keying on the subject area may decide it).
- **Keying `area`** (`subjectArea`) — OTBI's one reference entity per (subject area, table): the table's
  own security object, or the ONE context the area binds — a curated (area, entity) row, the table's
  only context, the area's VO evidence (a VO of the area joins exactly one context's entity), else the
  audited primary; otherwise `blocked`. A trace that names the column of THIS table (e.g.
  `AP_INVOICES_ALL.ORG_ID`) decides the column. The area's known (curated) privilege on an object applies to
  every table of the area on that object. The same table can take different privileges in two areas (the
  payment table: the Payables privilege in a Payables area, the orchestration privilege where it is a
  dimension of Supply Chain Financial Orchestration). An HCM table takes the privilege the AREA's duty
  roles hold (Oracle's TBI guide codes mapped to the pod's roles) — keyed on the table alone the HCM duty
  map must be unambiguous, else `blocked` asking for the area. A table the area does not read is
  `blocked`.
- **anyOf** — a cte with two or more `pairs` (supplier PII tables) ORs their predicates inside ONE
  condition (`where ({PRED:…|p1}) or ({PRED:…|p2})`): keep every slot; either privilege opens a row.
- **strictest** (end-user plans only) — a cte graded `strictest` ANDs its pairs inside ONE condition
  (`where ({PRED:…|p1}) and ({PRED:…|p2})`): the privilege is ambiguous, so a row shows only when the user
  holds EVERY candidate; keep every slot. The developer plan never ANDs — it blocks with the candidates.
- **Sensitive tables** (national identifiers, passports, visas, driver licences, salary, supplier PII,
  bank accounts) are read ONLY through their own pair — never through a person / duty privilege; a
  `blocked` sensitive table is not read unsecured as a workaround.
- **`masked`** `[{column, use}]` — never select `column`, select `use` (the masked twin: e.g.
  `MASKED_BANK_ACCOUNT_NUM`, not `BANK_ACCOUNT_NUM`).
- **`blocked`** — the developer is ASKED (needs-input, with the `reason` and the `candidates` when there
  are some: "INV_ORG_PARAMETERS carries 4 INV privileges with distinct grant sets — which one?"), or the
  table is left out / replaced by a used alternative (`findSimilarQueries` / `validateTable`). It is read
  unsecured only on the user's explicit word, labelled. A disallowed table (unknown context, unused) is
  never in secured SQL.
- **`unsecured`** — reference data, read directly; say so on its line.

## End-user mode — getSecuredQueryPlan (the overlay owns the flow)
A user WITHOUT the developer role gets the end-user overlay (`instructions.end-user.md`): the answer is the
data, never the SQL. The plan is **`getSecuredQueryPlan({instance, tables, subjectAreas?})`** — without
areas it returns the candidate subject areas (you settle one; never ask the end user), with them the
same CTE + rewrite contract keyed on the area, every CTE PROJECTING only the area's exposed columns
(`columns.<alias>.allowed`) plus join keys (`joinOnly`) and the corpus filter columns the area does not
show (`filterOnly`) — joinOnly / filterOnly columns go in JOIN / WHERE conditions only, never in the select
list — and `gate` — the subject areas (with their duty codes) to pass as `runSecuredSql`'s `gate`
(`{areas: gate.areas}`): every area must be held, else the call is refused naming the area — re-plan on a
held alternate or refuse.
- **`strictest`** — an ambiguous privilege of a table of the area's own modules: every candidate AND-ed
  (`strictest.privileges`). When `dataAccess` reports `access: "none"` for ONE of its pairs the table is empty for the
  user: say "access cannot be confirmed for <table> (ambiguous privilege, you lack <privilege>)" — never
  "no data", never plain "no access". The same ambiguity on a foreign dimension of the area is `blocked`.
- **`structural`** — a table with no security of its own (a `none` table) read WITHOUT a condition (no slot,
  no pair): it has no declared or mined relationship to secured data, or it is reference data (lookup,
  translation of reference data, calendar, currency, territory / geography). A `none` table that is a
  child of secured data (e.g. POZ_SUPPLIERS) is `blocked`.
- **No subject area reads the table** — a business table is never read by an end user (`blocked`, with
  `readInstead` = the equivalent a subject area reads: re-ground on it); a reference-family `none` table
  is read whole (its non-sensitive columns), keying `table`, no gate area.
- An end user never gets a pool-2 pick (grade `granted` is `blocked`) and never an unsecured statement.

## Joins — the fact drives, dimensions LEFT JOIN
A secured DIMENSION read for names / attributes (business unit, supplier site, person, item …) joins
through its CTE with LEFT JOIN when the query joined it as a descriptor: a dimension row the user may not
see then blanks those columns instead of dropping the fact rows the user may see. The fact's CTE stays the
inner, row-driving set. Say it in one clause when it changes visible output ("names of business units you
cannot see show empty"); keep an inner join only where the user's question needs the dimension to filter.

## The condition is the running user's
`runSecuredSql` fills the condition of the user whose session executes this conversation's SQL (the pod
sign-in; in CloudBeaver the editor connection's user): a secured run returns exactly that user's rows. A **data model authored
for others** embeds the AUTHOR's condition at authoring time — state it in the deliverable ("data access
condition built for <user>, regenerate for another author"), never hide it. **Sign-in**: never pre-check
sign-ins (`identity_targets`) before a secured run — only an `auth-required` REPLY from `runSecuredSql`
means one is needed (resolve it per the kernel's pod-identity rule, then call again). Never emit the SQL
unsecured as a substitute.

## Deliverables — the slotted SQL is shown, the executable text is delivered by the tool
Show the SLOTTED statement in the answer's ```sql block with its `Data access:` lines; the filled text
exists only server-side and reaches its destination through `deliver`:
- `"run"` (default) — the rows come back (`maxRows` as runSql);
- `{dataset: {fileId, dataset}}` — the data model's dataset SQL is replaced (a NEW fileId): author the
  dataset with the slotted statement (wrapped per datamodel-authoring), then deliver it here BEFORE any
  upload or run — a dataset still holding slots does not execute;
- `"file"` — a downloadable `.sql` file (fileId): offer the download for SQL the user runs elsewhere.
Never read a filled statement back (`getDataset` of a filled dataset, opening the delivered file): keep
working from your slotted SQL and deliver again after any change.

## What the answer says
- Name what was applied: "limited to your business units (FUN_ALL_BUSINESS_UNITS_V /
  AP_REPORT_PAYABLES_DATA, trace)".
- A pair with `access: "none"`: "no access to <object> for <privilege>" — the table returns no rows
  because the user holds no grant, NEVER "no data" / "no matching rows". On a `strictest` cte: "access
  cannot be confirmed for <table> (ambiguous privilege, you lack <privilege>)". `access: "global"`: "no
  restriction on <object> for <privilege>".
- GL segment-value (balancing-segment) security is NOT covered — say so when the query reports GL
  balances. Relay a `granted` grade as "not OTBI-proven".

## Plain (unsecured) SQL
Where the kernel's data-access rule says plain: the tables as written — no plan call, no CTEs, no
`runSecuredSql`; it runs through `runSql` / `run_sql`. Its Filter check carries the SKIPPED line
(below); authored SQL the user chose unsecured is also called "unsecured" in the answer.

## Filter-check lines (mandatory)
In the kernel's Filter check before every ```sql block, one line per table instance:
- `Data access: <table>.<column> → <object> / <privilege> [<grade>, keying table]` — a reference cte,
  e.g. `Data access: AP_INVOICES_ALL.ORG_ID → FUN_ALL_BUSINESS_UNITS_V / AP_REPORT_PAYABLES_DATA [trace,
  keying table]`; keyed on an area: `[<grade>, keying area <subject area>]`; append `(no access)` when the
  pair's `access` is `none`, `(no restriction)` when `global`;
- `Data access: <table> → <object> / <privilege> [<grade>, keying table]` — a direct cte (the table is its
  own security object); anyOf: `<object> / <p1> | <p2>`; masked: `(masked: <column> → <use>)`;
- `Data access: <table> unsecured (reference data)` — an `unsecured` entry;
- `Data access: <table> → <object> / <p1> AND <p2> [strictest, keying area <subject area>]` and
  `Data access: <table> read without a condition [structural, …]` — end-user plans (the line stays in the
  tool log; the end user sees the `limits` sentence);
- `Data access: <table> BLOCKED — <reason>` — only while asking the user, never in emitted SQL;
- `Data access: SKIPPED (analysis)` or `Data access: SKIPPED (user chose unsecured SQL)` — plain SQL,
  one line for the statement;
- on a data model: `Data access: condition built for the running user (<user>) at authoring time`.
These lines are never dropped, however terse the answer.
