---
name: using-templates
description: Use when the user wants a report or dashboard and could start from a ready-made template instead of a from-scratch layout. Covers listTemplates / getTemplate / instantiateTemplate — picking a template, sizing it by its params, filling its slots from the grounded data-model output tree, and handing off to render.
---

# Using templates

Templates are a FASTER starting point for a dashboard: a pre-built, engine-validated layout SKELETON
with named fillable **slots**. You still ground every slot's data in the real data model — a template
saves you the LAYOUT decisions, not the SQL/field grounding.

## 1. Offer the template, let the user pick
`listTemplates()` → `{templates:[{id, name, description, params, slots, thumbnailUrl}]}`. Show each
template's thumbnail + description to the user and let them pick (or pick yourself when the user's
request obviously matches one template and there's only one to choose from — v1 has exactly one,
`monitoring`, a job-monitoring dashboard).

Once picked, `getTemplate(id)` returns that template's full slot list + thumbnail — read it before
asking anything, so your questions are grounded in the REAL slot names/roles, not guesses.

## 2. Pin down the params FIRST — the thumbnail is only one representative size
A template is **parametric**: `params` control its real size/repetition (e.g. Monitoring's `bands`:
`1` = 24h view only, `2` = adds a 7-day band). The thumbnail shows ONE instance at some default param
values — it is NOT necessarily the size the user will get. Before filling slots, either ASK the user
("Do you want just the 24-hour view, or also a 7-day trend band?") or INFER the params from what they
already told you about content (e.g. they mentioned "week-over-week" → `bands:2`). Never leave a param
at its default without deciding it belongs there.

## 3. Ask — don't guess — for every required or ambiguous slot
Walk the template's `slots` (`{id, label, role, accept, required}`). For each slot:
- If the user's request already names what goes there, use it.
- If the slot is `required` and unspecified, or the right fit is genuinely ambiguous (e.g. two
  candidate measures could plausibly fill a KPI slot), **ask ONE clarifying question** naming the slot's
  `label`/`role` and, where useful, the candidate options. Do not guess and build — guessing here is
  more expensive to undo than asking up front (see `report-authoring`'s "Clarify the layout first").
- Optional slots the user didn't mention and that aren't ambiguous can be left unfilled.

## 4. Ground every slot fill on the data-model output tree
Before building `assignments`, call `getDataStructure` (or `getDataModel(fileId,"structure")`) on the
data model the dashboard will bind to — never invent a field name. Each `assignments[slotId]` is a
grid-cell component spec matching the slot's `accept` (chart / table / crosstab / kpi / stack), built
from real output fields. The `.xpt` slot-fill rules from **report-authoring** still apply here: charts
bind exactly ONE measure (use a `seriesField` for multi-series), tables use `filters` (not an XPath
predicate) to scope one group into several slot views, KPI slots are single-row cards, and a
chart+count combo goes in a `stack` cell — a template slot is just a pre-positioned instance of these
same components.

## 5. Instantiate
`instantiateTemplate({ templateId, params?, assignments, customizations?, formats?:"auto" })` →
`{files:[{format, fileId, name}]}`. Pass the params decided in step 2 and the assignments built in
step 3-4. Leave `formats` at `"auto"` (the default) unless the user asked for a specific output —
`"auto"` emits every technique format the layout supports so the user (or you, later) can pick the
delivery channel without re-instantiating; the user never has to think about `.xpt` vs RTF up front.

## 6. Offer to render
After instantiation, OFFER to render one of the returned files so the user can see the result — hand
off to the **rendering-and-running** skill (`renderTemplate`). If they then want layout tweaks beyond
what a slot covers, that's a normal report-authoring `modifyReportLayout` / regenerate pass on the
resulting file, not a re-instantiation.
