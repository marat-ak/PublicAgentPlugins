---
name: data-access-security
description: Use before writing or running SECURED Fusion SQL — the kernel's opt-in data-access rule: in developer mode only when the user asked for data access / security or said yes when the align ask offered it, and every end-user read — a final answer, a data model's dataset or LOV SQL, a secured run, SQL in prose or in a hand-off; secured SQL reads only the data the running user may see. Plain SQL (the developer default) needs no load. Covers the pod instance the plan needs, the developer PLAN from getDataAccessPredicate (one secured CTE per table + the rewrite, a grade and the keying — table, or the OTBI subject area — on every condition, blocked / unsecured tables), the END-USER plan getSecuredQueryPlan (the end-user overlay owns that flow), running or delivering the statement with the plan's slots left in place through ONE runSecuredSql call (the server fills Oracle's own condition — FND_DATA_SECURITY, by object + privilege NAME, for the user whose session runs the SQL — the text never enters the conversation), the secured DATA MODEL rule (the ONE XML-function dataset that generates the running user's condition at run time — never an embedded or lexical-passed condition), sensitive tables and masked columns, the three access verdicts (restricted / none / global) and their wording, and the mandatory `Data access:` lines of secured SQL's Filter check.
---

# Data-access security — secured SQL reads only the user's data

A BIP SQL dataset, `runSql` and `run_sql` execute the SQL exactly as written: Fusion data security
(the business units, ledgers, organizations, persons … the user may see) is NOT applied for you. So
every query you secure reads each secured table through its **secured CTE**, whose condition is the one
**Oracle itself generates for the running user** — `FND_DATA_SECURITY.GET_SECURITY_PREDICATE`, called on
the user's pod by **object + privilege NAME**. Nothing about the condition is stored or guessed on our
side: the catalog knows WHICH object and privilege secure a table on THAT pod; the pod produces the text.
You never see or handle that text: for an ad-hoc run or a `.sql` file you write the plan's
`{PRED:<object>|<privilege>}` slots and `runSecuredSql` fills them server-side; a DATA MODEL embeds no
condition at all — its one dataset calls the API itself when the report runs (Secured data models below).
Which SQL is secured (opt-in) and which runs plain is the kernel's data-access rule; this skill is the how.
The plan tools' descriptions define everything they return (CTEs, rewrite, pairs, grades, keying,
blocked / unsecured / masked entries) — this skill is the order and the rules around them.

## The pod instance — required, never guessed
The plan is per pod: its instance is the pod host EXACTLY as a `runSql` or `run_sql` reply in this
conversation reports it. No such reply yet → run the instance probe `select 1 from dual` (a fixed
connectivity probe that reads no table — not reviewed, kernel review rule) and take the instance it
reports. A `run_sql` reply that names no instance is not a Fusion pod connection — there is no data-access
plan for it; say so. Never type a host from memory, another conversation or a URL guess. An "unknown
instance / no layer loaded" error names the loaded pods: relay it — the data-access layer of that pod has
to be loaded first (an admin action) — and do not emit the SQL unsecured as a substitute.

## One flow
1. **`getDataAccessPredicate`** — ONE call with EVERY table instance of the statement. It is keyed by
   table, or — when the query reads ONE OTBI subject area you know (the user named it, or the report is
   built on it) — on that area.
2. **Write the statement with the slots LEFT IN PLACE**: all the plan's CTEs, exactly as given, in the
   statement's ONE leading `WITH` (inline PL/SQL declarations first, the query's own CTEs after them — they
   may read the secured CTEs), the plan's rewrite applied to every FROM / JOIN / subquery / UNION arm. Never
   fill, edit, move or drop a `{PRED:<object>|<privilege>}` slot — the slots ARE the pairs the server
   resolves.

   ```sql
   WITH
     FUNCTION f(p NUMBER) RETURN NUMBER IS BEGIN RETURN p; END;        -- only if the query has one
     ap_sec as (select /*+ INLINE */ t.* from AP_INVOICES_ALL t
       where t.ORG_ID in (select sec$.BU_ID from FUN_ALL_BUSINESS_UNITS_V sec$
                          where {PRED:FUN_ALL_BUSINESS_UNITS_V|AP_REPORT_PAYABLES_DATA})),
     open_inv AS (SELECT … FROM ap_sec ap …)
   SELECT … FROM open_inv …
   ```
   In a data model dataset no slot is left for the server: the same CTEs go inside the XML function
   (Secured data models below), each slot replaced by the condition the function fetched.
3. **`runSecuredSql`** — ad-hoc runs and `.sql` files, never a data model dataset: ONE call with that
   statement. The server asks Oracle for each pair's condition in the session that executes this
   conversation's SQL (the pod sign-in, or the editor connection in CloudBeaver), fills every slot verbatim
   and runs or delivers it (Deliverables below). You get the verdict per pair, never the condition text or
   the filled statement. An error of the statement points into YOUR slotted SQL — fix your SQL, never the
   slot.

Every pair names its privilege — there is no privilege-less condition (a GLOBAL grant for any privilege
yields no security at all). Never invent a privilege, never pass `read`, never ask the end user which
privilege to use. When the pod cannot produce a pair's condition, `runSecuredSql` refuses the whole call
naming the pair: relay it — never fill a slot yourself, never drop the slot or the table's CTE to make the
statement run.

## Rules on the plan's entries
- **Grade + keying** go on the `Data access:` line (below); relay a `granted` grade as "not OTBI-proven".
- **Several pairs on one CTE** (anyOf — supplier PII tables): keep every slot; either privilege opens a row.
- **Sensitive tables** (national identifiers, passports, visas, driver licences, salary, supplier PII,
  bank accounts) are read ONLY through their own pair — never through a person / duty privilege; a blocked
  sensitive table is not read unsecured as a workaround.
- **Masked columns** — never select the raw column; select its masked twin.
- **Blocked** — the developer is ASKED (needs-input, with the reason and the candidates when there are
  some: "INV_ORG_PARAMETERS carries 4 INV privileges with distinct grant sets — which one?"), or the table
  is left out / replaced by a used alternative (`findSimilarQueries` / `validateTable`). It is read
  unsecured only on the user's explicit word, labelled. A disallowed table (unknown context, unused) is
  never in secured SQL.
- **Unsecured** — reference data, read directly; say so on its line.

## End-user mode — the overlay owns the flow
A user WITHOUT the developer role gets the end-user overlay (`instructions.end-user.md`): the answer is the
data, never the SQL, through `getSecuredQueryPlan` (the subject-area plan: the area is settled by you,
never asked of the end user) and ONE `runSecuredSql` with the plan's gate. An end user never gets a
pool-2 pick (grade `granted`), a blocked table or an unsecured statement; a reference table no subject area
reads is read whole (its non-sensitive columns).

## Joins — the fact drives, dimensions LEFT JOIN
A secured DIMENSION read for names / attributes (business unit, supplier site, person, item …) joins
through its CTE with LEFT JOIN when the query joined it as a descriptor: a dimension row the user may not
see then blanks those columns instead of dropping the fact rows the user may see. The fact's CTE stays the
inner, row-driving set. Say it in one clause when it changes visible output ("names of business units you
cannot see show empty"); keep an inner join only where the user's question needs the dimension to filter.

## The condition is the running user's
`runSecuredSql` fills the condition of the user whose session executes this conversation's SQL (the pod
sign-in; in CloudBeaver the editor connection's user): a secured run returns exactly that user's rows. A
**data model** never carries a condition: its dataset generates the RUNNING user's condition each time the
report runs (below) — so a model built by one user secures correctly for every other user. **Sign-in**
follows the kernel's pod-identity rule — an auth-required reply from `runSecuredSql` included. Never emit
the SQL unsecured as a substitute.

## Secured data models — the condition is generated at RUN time
A secured data model is ONE dataset: the general XML-function dataset of **datamodel-authoring**
("XML-function dataset — return pure XML, no wrapping"; its subsection "Secured data model =
XML-function dataset + FND_DATA_SECURITY at run time" shows the security delta). Inside the report, the
function calls `FND_DATA_SECURITY.GET_SECURITY_PREDICATE` for every pair of the plan, for whoever runs the
report, splices each condition into the plan's CTEs and returns the rows as XML. This REPLACES the
authoring-time shapes — a condition filled into a plain dataset, or a parent dataset handing the text to a
child through a lexical: they are not built any more, and an existing model in one of those shapes is
rebuilt as the XML function, not patched.
- The plan is the same `getDataAccessPredicate` plan: every CTE with its rewrite, in the business SQL the
  function builds. Each `{PRED:<object>|<privilege>}` becomes one API call on that pair (object and
  privilege as literals, table alias `sec$`) into its own `l_pred_n`, appended at the slot's place;
  anyOf / strictest keep their OR / AND around the pair variables.
- Fail closed inside the function: a status other than `T` or an empty text → `1=2` (no rows); a slot is
  never dropped and a table is never read unsecured to make the report run.
- Length is not a concern: the condition is a CLOB from the API to the cursor — no VARCHAR2, no
  `SUBSTR`, no chunking, no 4,000-character cap.
- No `runSecuredSql` for a data model: the dataset is written as-is through `createDataModelFile` /
  `setDatasetSql`. Its test is `runSql` / `run_sql` of the same statement (it secures itself for the
  session's user) and the pod run of the model.
- The condition text still never enters the conversation — it exists only inside the pod at run time.
- The blocked, unsecured, masked and sensitive-table rules are unchanged: a blocked table is asked about
  BEFORE the model is built.

## Deliverables — the slotted SQL is shown, the executable text is delivered by the tool
Show the SLOTTED statement in the answer's ```sql block with its `Data access:` lines; the filled text
exists only server-side and reaches its destination only through `runSecuredSql`: the rows of a run, or a
`.sql` file for SQL the user runs elsewhere (present it with `ui_present_file`). A data model is NOT
delivered: its dataset is the XML function (Secured data models above), written as-is — no slot stays in a
dataset and no condition is ever filled into one. Never read a filled statement back (opening the delivered
file): keep working from your slotted SQL and deliver again after any change.

## What the answer says
- Name what was applied: "limited to your business units (FUN_ALL_BUSINESS_UNITS_V /
  AP_REPORT_PAYABLES_DATA, trace)".
- A pair with no access: "no access to <object> for <privilege>" — the table returns no rows because the
  user holds no grant, NEVER "no data" / "no matching rows". On a strictest (ambiguous-privilege) CTE:
  "access cannot be confirmed for <table> (ambiguous privilege, you lack <privilege>)". A global grant:
  "no restriction on <object> for <privilege>".
- GL segment-value (balancing-segment) security is NOT covered — say so when the query reports GL
  balances.

## Plain SQL inside a secured flow
SQL the kernel's data-access rule leaves plain — the analysis runs (a lookup, a grain probe, a query run
to see its rows): the tables as written — no plan call, no CTEs, no `runSecuredSql`, no `Data access:`
lines; it runs through `runSql` / `run_sql`.

## Filter-check lines (mandatory for secured SQL)
In the kernel's Filter check before every ```sql block of secured SQL, one line per table instance:
- `Data access: <table>.<column> → <object> / <privilege> [<grade>, keying table]` — a reference CTE,
  e.g. `Data access: AP_INVOICES_ALL.ORG_ID → FUN_ALL_BUSINESS_UNITS_V / AP_REPORT_PAYABLES_DATA [trace,
  keying table]`; keyed on an area: `[<grade>, keying area <subject area>]`; append `(no access)` when the
  pair has no access, `(no restriction)` when the grant is global;
- `Data access: <table> → <object> / <privilege> [<grade>, keying table]` — a direct CTE (the table is its
  own security object); anyOf: `<object> / <p1> | <p2>`; masked: `(masked: <column> → <masked twin>)`;
- `Data access: <table> unsecured (reference data)` — an unsecured entry;
- `Data access: <table> → <object> / <p1> AND <p2> [strictest, keying area <subject area>]` and
  `Data access: <table> read without a condition [structural, …]` — end-user plans (the line stays in the
  tool log; the end user sees the limits sentence);
- `Data access: <table> BLOCKED — <reason>` — only while asking the user, never in emitted SQL;
- on a data model, after its table lines: `Data access: generated at run time for the running user
  (XML-function dataset)`.
These lines are never dropped from secured SQL, however terse the answer; plain SQL has none.
