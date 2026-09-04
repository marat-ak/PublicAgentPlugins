---
name: fix-placement
description: Use when a defect's cause is understood and you are choosing WHERE in the flow to fix it — BEFORE proposing or applying any fix. Derive the location from the flow's chain of obligations (what each step guarantees to the steps after it), never from where the error surfaced or where the edit is smallest.
---

# Choosing WHERE a fix goes

Diagnosis (**run-analysis**) tells you WHAT went wrong. Choosing WHERE to change the flow is a
separate, governed decision — made at the run-analysis finding→fix handoff, and equally when a defect
is found by reading the design or reported by the user.

**THE LAW — NON-NEGOTIABLE: a fix location is DERIVED from the flow's design — its chain of
obligations — never from where the error surfaced, where the edit would be smallest, or where a
single edit would reach the most cases. Those three signals measure your convenience, not the
design. Until you can state, in one sentence, WHICH obligation was violated and WHO owns it, you
have a symptom location, not a fix location.**

## A flow is a chain of obligations

Every step carries two contracts, readable from the blueprint, maps, and config (**maps** ·
**structural-nodes** · **source-material** — never from the runtime record alone):

- **OWES** — what it guarantees to everything after it: data properties (shape, format, units,
  completeness, ordering) AND behaviour (uniqueness, timing, idempotency, error semantics, side
  effects). Read it from what the step's logic is built to produce and from what later steps consume
  WITHOUT re-checking — that unchecked reliance is the design telling you who owns the rule. When a
  step's actual output and the downstream reliance disagree, the reliance defines the obligation and
  the step is the suspect.
- **ASSUMES** — what it is entitled to take for granted about its input: the union of what every
  earlier step OWES. A step does not re-verify its entitlements; the design promises them.

Owners are not only steps: a lookup table, a connection or schedule configuration, a feeding
integration, or the external source system can hold an obligation — trace to the true producer, not
the nearest step that faithfully consumed bad data.

A failure observed at step X has two readings; decide which before touching anything:

- **X is the VIOLATOR** — its own logic breaks its own OWES. Fix X.
- **X is the DETECTOR** — it received input it was entitled never to receive. Failing loudly there
  is CORRECT BEHAVIOUR, not a gap to close; the fix belongs upstream at the violator. (For a silent
  wrong result with no error, the detection point is wherever the wrongness was observed — same
  procedure.)

## Procedure — run BEFORE proposing any fix

1. Pin the defect to a design node (**run-analysis** §3). Record it as the DETECTION point — not yet
   the fix point.
2. Trace the bad value/state/behaviour to its producer: walk the blueprint upstream — which step or
   artifact computed, mapped, fetched, configured, or defaulted it? One targeted payload per open
   question (run-analysis §6) to confirm at which hop it went wrong — never bulk.
3. For every step between producer and detection point, state its PURPOSE: what does it exist to
   guarantee to the steps after it? A step whose job is to establish the very property that arrived
   broken is your prime suspect. If you cannot tell what a step is for after reading its design
   artifacts, ASK — never invent a purpose.
4. Name the violated obligation in one sentence: "S must deliver <property> to everything
   downstream; in this run it delivered <actual>."
   - No owner exists (the property is relied on but assigned to nothing) → design GAP: ASK.
   - No obligation is violated (the chain is internally consistent; an external requirement or
     endpoint changed) → this is a DESIGN CHANGE, not a bug fix: the user decides where the new
     obligation lives.
5. The owner of the violated obligation is the DEFAULT fix location. Any other candidate must
   survive every disqualifier below; failing one rejects it, however convenient it looks.

## Disqualifiers — any one rejects a candidate location

- **Knowledge test.** The fix needs a fact the step structurally does not have. Check the
  candidate's declared inputs (blueprint + map sources): if the discriminating fact is not among
  them, any handling that varies on it is a guess — and a guess applied to data is silent corruption
  reported as success. No "I can recognize it from the value itself" exemption.
- **Duty transfer.** The fix re-establishes, at a second location, a guarantee the design assigns
  elsewhere. The broken owner stays broken, every other consumer of it stays exposed, and two owners
  of one rule drift apart.
- **Tolerance widening.** The fix makes a step accept, coerce, or repair input the design says it
  must never receive. That converts a loud failure at the true boundary into silently wrong data
  under a green status — strictly worse than the bug. This is a contract change: present it to the
  user as a redesign (see ASK), never apply it as "the fix".
- **Blanket edit.** The fix also executes on inputs that were never broken, rewriting the contract
  for every producer to fix one.

## Convenience is not an argument

"Smallest diff", "the shared place", "one edit reaches everything" measure edit cost, not
correctness. A central step is central because many things depend on it — a wrong fix there
multiplies the blast radius. When several steps each broke the same obligation, the correct fix is a
fix at EACH of them: the repetition is the design telling you where the duty lives, not a smell to
centralize away. And a fix that makes existing steps look redundant is a warning — the design
already assigned them the job you are about to relocate.

## When to ASK (instructions.md: requirements don't decide → ASK)

- A design gap (no owner) or a step whose purpose you cannot determine from its design artifacts.
- The tempting fix would MOVE an obligation — relocate validation, widen tolerance, change what a
  step promises — even if it would make the failing run pass. Propose the in-contract fix at the
  owner as YOUR recommendation, name its cost, and offer the relocation as an explicit user-owned
  design change — never an equal-weight menu, never a silent side effect of a bug fix.
- Two plausible owners the evidence doesn't separate: name the one payload or node read that would
  decide it (run-analysis ladder), or ask.

## Proposing the fix — report shape

State, in order: (1) the detection point; (2) the violated obligation and its owner, with the
evidence; (3) the fix at the owner; (4) which tempting candidates you rejected and by which
disqualifier. If you cannot fill (2), you are not ready to propose. Verify per the **verification**
skill — and re-check the OTHER consumers of the fixed step's output: an obligation serves everything
downstream, not only the path that failed.

## Gotchas

- The error message names the step that DETECTED, not the step that CAUSED. Same for the user's "it
  fails at X" — X is the entry point for your trace, not an instruction to edit X.
- A rerun that passes does not validate the LOCATION: a mislocated fix often passes the failing case
  while corrupting cases you did not run. The obligation chain and disqualifiers validate location;
  the rerun validates only the repair.
- Do not also "harden" the detector after fixing the owner — its strictness is the flow's safety
  net. The only admissible hardening is an explicit loud-failure check EARLIER in the flow, never a
  silent conversion anywhere.
