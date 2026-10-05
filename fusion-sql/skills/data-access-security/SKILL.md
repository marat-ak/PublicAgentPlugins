---
name: data-access-security
description: Use before emitting or running ANY Fusion SQL — a final answer, a data model's dataset or LOV SQL, a runSql / run_sql / explain_plan probe, SQL in prose or in a hand-off — to limit it to the data the running user may see. Covers reading the pushed `dataSecurity` payload, the per-table PLAN from getDataAccessPredicate, fetching each condition from the user's pod with getSecurityPredicate (Oracle's own FND_DATA_SECURITY API, by object + privilege NAME), assembling the secured CTE in the isolated form, disallowed tables, HCM, the three access verdicts (restricted / none / global) and the "built for the running user" wording, unsecured SQL on request, and the mandatory `Data access:` lines of the Filter check.
---

# Data-access security — every emitted SQL reads only the user's data

A BIP SQL dataset, `runSql`, and `run_sql` execute the SQL exactly as written: Fusion data security
(the business units, ledgers, organizations, persons … the user may see) is NOT applied for you. So
every query you emit reads each secured table through its **secured CTE**, whose condition is the one
**Oracle itself generates for the running user** — `FND_DATA_SECURITY.GET_SECURITY_PREDICATE`, called
on the user's pod by **object + privilege NAME**. Nothing about the condition is stored or guessed on
our side: the catalog knows WHICH object and privilege secure a table; the pod produces the text.
Scope = every SQL you emit: a final answer, a data model dataset or LOV, a probe, SQL in prose, a
hand-off.

## Two tools, one flow
1. **`getDataAccessPredicate({table, alias})`** (fusion-schema) → the **PLAN** for that table
   instance: `form`, `entries[]` (each: `object`, `privilege` or null, `privilegeSource`, the
   isolated-form `condition` with a `{PRED:n}` placeholder, `notes`), `fetch[]` (one
   `{object, privilege, alias:"sec$"}` per distinct pair), `cte` (the CTE skeleton with the
   placeholders), `cteName`. No SQL condition text, no ids — names only.
2. **`getSecurityPredicate({pairs:[{object, privilege, alias:"sec$"}]})`** (fusion-pod) → **ONE call
   for ALL the `fetch` entries** of the query (de-duplicated; every field required), exactly as the
   plan names them. It runs on the user's pod session itself (one round trip) and returns
   `{instance, pairs:[{object, privilege, alias, status, access, predicate, length, error?}],
   elapsedMs, statement}`: `status` `ok` | `error`; `access` `restricted` (a condition to splice),
   `none` (the text is `(1=2)` — the user holds no grant for the pair), `global` (`(1=1)` — no
   restriction); `predicate` is the full text. Paste it VERBATIM in place of the plan's `{PRED:n}` —
   it is written against the alias `sec$` the plan uses; never edit, trim, re-alias or "simplify" it.
3. **Assemble**: fill every `{PRED:n}` of `cte`, put the CTE in the query's ONE leading `WITH`, and
   read `cteName` where the table stood (`FROM ap_invoices_all ap` → `FROM ap_sec ap`; the CTE returns
   `t.*`, the rest of the statement is unchanged).

`privilege` is REQUIRED on every pair — there is no privilege-less call (it would mean "any grant on
the object", and a GLOBAL grant for any privilege yields `(1=1)`: no security at all). A plan entry
without a privilege is `needs-input`, never a call. Never invent a privilege, never pass `read`,
never ask the end user which privilege to use.

## Detection — READ `dataSecurity`, never derive it
Every table payload (`getTable`, `getColumns`, `validateColumns`, `validateTable`) carries
`dataSecurity {form, object, privilege, columns, disallowed, hcm, none}`. It is the only source of
which tables are secured and through what — never infer it from a column name, never guess, never
exempt a table because it is "only a lookup".
- `form: "direct"` — the table is itself a registered security object: the condition is generated on
  the table (`object`), applied on its primary key.
- `form: "via_join"` — not registered: EVERY context column (`columns[]`, each with its reference
  `object`, e.g. `ORG_ID → FUN_ALL_BUSINESS_UNITS_V`, `LEDGER_ID → GL_LEDGERS`) is secured through the
  reference object's condition, applied through the join; a nullable column is NULL-tolerant (`IS
  NULL OR`, a row with no value in that context is not restricted by it).
- `none: true` — no secured context column and not registered → use the table directly.
- `disallowed` set — a security column of unknown context and no real report uses the table → it
  NEVER goes into secured SQL (the plan refuses it): read a used alternative (the table real reports
  read for the same data — `findSimilarQueries` / `validateTable`), or tell the user it cannot be
  secured. Only an explicitly unsecured request may read it.
- `hcm: true` — an HCM object: the same API, the same flow; say that HCM restriction is still
  pending its pod verification (the plan's note) — the `*_SECURED_LIST_V` views remain Oracle's
  documented BIP alternative.

## Building the secured query
1. For EVERY table/view instance whose payload has `form` direct or via_join — in FROM, joins,
   inline views, scalar / IN / EXISTS subqueries, every UNION arm, inside the query's own CTEs — call
   `getDataAccessPredicate({table, alias})` with the alias that instance uses. One CTE per
   table-instance alias (the same table twice = two calls, two CTEs); aliases must be unique across
   the statement (the CTE is named `<alias>_sec`). A secured table keeps its CTE even when a join
   partner already carries the same context value.
2. Fetch every `fetch` entry of every plan with ONE `getSecurityPredicate` call — the pairs of all
   the plans merged and de-duplicated (the same `(object, privilege)` across several tables is one
   pair, its text reused). A pair with `status: "error"` is a failure: relay its `error` text, do not
   emit the table secured by a guess.
3. ALL secured CTEs go into ONE leading `WITH`, ahead of the query's own CTEs (which may read them);
   inline PL/SQL declarations always come first:
   ```sql
   WITH
     FUNCTION f(p NUMBER) RETURN NUMBER IS BEGIN RETURN p; END;  -- only if the query has one
     ap_sec AS (select /*+ INLINE */ t.* from AP_INVOICES_ALL t
       where t.ORG_ID in (select sec$.BU_ID from FUN_ALL_BUSINESS_UNITS_V sec$ where <predicate 1 verbatim>)
         AND t.SET_OF_BOOKS_ID in (select sec$.LEDGER_ID from GL_LEDGERS sec$ where <predicate 2 verbatim>)),
     open_inv AS (SELECT … FROM ap_sec ap JOIN …)
   SELECT … FROM open_inv …
   ```
   In a data model dataset the statement is then wrapped per datamodel-authoring's CTE rule.
4. The **isolated form is mandatory**: the condition always sits in its own `(SELECT … FROM <object>
   sec$ WHERE …)` subquery, never spliced into the main FROM against the table's own alias — many
   Oracle conditions name columns without an alias and would bind to the wrong table in a join. The
   plan's `condition` already has that shape; keep it.
5. An entry with `condition: null` (an object registered several ways, or without a registered key)
   needs the user's answer first — never emit that table unsecured silently.

Never hand-write a data-access predicate or IN-list, and never join `FUN_USER_ROLE_DATA_ASGNMNTS`,
`FND_GRANTS` or a `*_SECURED_LIST_V` into the main FROM — an adopted corpus exemplar's own security
joins are replaced by the secured CTEs, not kept alongside them.

## The condition is the running user's
`getSecurityPredicate` returns the condition for the user whose pod session runs it. An ad-hoc
`runSql` answer is therefore exact. A **data model authored for others** embeds the author's
condition at authoring time — state it in the deliverable ("data access condition built for
<user>, regenerate for another author"), never hide it. **No pod session** (no identity, or the
pod tools answer auth-required) ⇒ `needs-input`: ask the user to connect the pod first; never emit
the SQL unsecured as a substitute.

## What the answer says
- Name what was applied: "limited to your business units (FUN_ALL_BUSINESS_UNITS_V /
  AP_REPORT_PAYABLES_DATA) and ledgers (GL_LEDGERS / GL_REPORT_GENERAL_LEDGER_DATA)".
- A pair with `access: "none"`: say "no access to <object> for <privilege>" — the query returns no
  rows for that table because the user holds no grant, NEVER "no data" / "no matching rows". A pair
  with `access: "global"`: "no restriction on <object> for <privilege>".
- GL segment-value (balancing-segment) security is NOT covered — when the query reports GL
  balances, say so explicitly. Relay the plan's other `notes` briefly.

## Unsecured SQL — only on the user's word
The data-access question rides the ONE align ask (default YES, no extra turn); a request that already
says secured or unsecured is the answer; a pure query request is secured by default. Unsecured =
plain tables (a `disallowed` table included), and the answer says "unsecured" explicitly.

## Filter-check lines (mandatory)
In the kernel's Filter check before every ```sql block, under each table:
- `Data access: <table>.<column> → <object> / <privilege>` — one LINE per via_join entry, e.g.
  `Data access: AP_INVOICES_ALL.ORG_ID → FUN_ALL_BUSINESS_UNITS_V / AP_REPORT_PAYABLES_DATA`, never
  merged; append `(no access)` when the pair's `access` is `none`;
- `Data access: <table> → <object> / <privilege>` — a direct entry (the registered table itself);
- `Data access: none (no secured context column)` — a table with `none: true`;
- `Data access: <table> disallowed (unknown context, unused)` — a `disallowed` table the request
  pointed at: name what replaced it, or that it was read only because the user asked for unsecured SQL;
- `Data access: SKIPPED (user asked for unsecured SQL)` — when the user chose unsecured SQL;
- on a data model: `Data access: condition built for the running user (<user>) at authoring time`.
These lines are never dropped, however terse the answer.
