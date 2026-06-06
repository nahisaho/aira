---
name: co-scientist-critical-review
description: |
  Critical review skill for phase-gate checks and deep review of paper drafts.
  Focuses on structure, claims, statistics, reproducibility, and citations, plus
  adversarial Devil's-Advocate counterarguments and orthogonal multi-perspective
  review (statistics / domain / methodology) for a non-sycophantic critique.
  Use for Phase Gate Review and Deep Review.
---

# Critical Review

Concise scientific review skill for quick phase checks and comprehensive paper review.

## Use This Skill When

- **Phase Gate Review**: quick pass/fail screening at a phase handoff.
- **Deep Review**: comprehensive review of `paper.md` before finalization.
- You need clear blockers, comments, and one-step repair guidance.

## Review Modes

### Phase Gate
Quick checklist for readiness at a handoff. Save findings to `results/review-{phase}.md`.

### Deep Review
Primary review mode for `paper.md`. Run the full checklist below and save findings to `results/review-paper.md`.

## Deep Review Checklist

### Structure Check
- [ ] Required sections are present: Abstract, Introduction, Methods, Results, Discussion, Conclusion, References, and Limitations and Future Work.
- [ ] Limitations and Future Work is substantive and at least 200 words.
- [ ] Abstract states objective, method, key result, and conclusion.
- [ ] Discussion and Conclusion do not introduce claims that are not supported in Results.

### Overclaiming Check
- [ ] Use `novel` only when concrete differences from prior work are stated.
- [ ] Use `state-of-the-art` only when strong comparative evidence is shown.
- [ ] Use `guarantees` or similarly absolute language only when proof or equivalent support exists.
- [ ] Use `significant` for statistical significance only when a test result is reported.

### Statistical Check
- [ ] Every key quantitative result includes uncertainty such as CI, ±, or equivalent.
- [ ] Comparative performance claims report a statistical test when comparison is central to the claim.
- [ ] Synthetic-only studies explicitly state external validation limits.

### Reproducibility Check
- [ ] Core hyperparameters or experimental settings are reported.
- [ ] Random seed handling is stated.
- [ ] Dataset split or evaluation protocol is stated.

### Citation Check
- [ ] Bulk citations such as `[1-5]` or `[1–5]` are removed.
- [ ] Every in-text citation maps to a reference entry.
- [ ] Every reference entry is cited in the text.

### Anomaly / Leakage Check
- [ ] No reported metric is near-perfect (AUROC / accuracy / F1 ≥ 0.99) without an accompanying leakage audit. If one is, route to `co-scientist-leakage-detection`.

## Devil's Advocate

> Strengthen the work by attacking it. Tone is "demand more verification", not "this is wrong".

For each **main claim** (typically 1–3), generate three structured counterarguments,
each paired with a concrete verification method. Record them in `results/devils-advocate.md`
and fold any that survive into Limitations.

| Angle | The counterargument asks | Verification method to attach |
|-------|--------------------------|-------------------------------|
| **Alternative explanation** | Could a confounder / leakage / artifact explain the result instead of the stated cause? | Partial-correlation or ablation controlling for the confounder |
| **Sample size** | Is the effect robust, or an artifact of small / imbalanced n? | Bootstrap 95% CI; report whether it excludes the null |
| **Label reliability** | Are the ground-truth labels trustworthy (noisy, proxy, annotator-dependent)? | Label-source audit; inter-rater agreement or sensitivity to label noise |

A counterargument is **resolved** only when its verification was actually run and reported.
Otherwise it becomes a stated Limitation.

## Multi-Perspective Review

> Review through orthogonal lenses so a single viewpoint's blind spot is covered.

Evaluate the draft from three independent angles; keep them separate so they don't collapse into one:

- **Statistical**: tests, uncertainty, multiple-comparison handling, power.
- **Domain**: does the result make sense in the field; are effect sizes plausible; prior work consistent?
- **Methodological**: design validity, data pipeline, evaluation protocol, reproducibility.

For **each critical concern** raised by any lens, mark exactly one disposition and state why:

- **Resolved** — addressed with new analysis/text (cite where).
- **Mitigated** — partially addressed; residual risk documented in Limitations.
- **Accepted** — out of scope; explicitly acknowledged as a limitation.

## Simple Lint

- [ ] A `## Limitations` or `## Limitations and Future Work` header exists.
- [ ] The limitations section contains at least 200 words.
- [ ] No bulk citation pattern such as `[N-M]` or `[N–M]` remains.

## Repair: Limitations Addition

> Read the current `paper.md`. Add a `## Limitations and Future Work` section before `## Conclusion`.
> Cover data limitations, methodological limitations, evaluation limitations, generalizability, and future directions.
> Minimum 200 words total.
> If the study uses synthetic data only, state that external validation on independent real-world data is still required.

## Workflow

1. Determine mode: use Phase Gate for a handoff check, or Deep Review for `paper.md`.
2. For a paper draft, run Simple Lint before the main checklist.
3. Run the relevant checklist and mark each item PASS or FAIL.
4. For Deep Review, run **Devil's Advocate** on each main claim and a **Multi-Perspective Review** (statistical / domain / methodological).
5. Classify findings:
   - **Critical**: must be fixed before proceeding.
   - **Other findings**: record as comments with concrete suggestions.
6. If a Critical issue is found, apply one focused fix.
7. Re-run the failed checks once.
8. Give every multi-perspective critical concern a disposition (Resolved / Mitigated / Accepted).
9. Save the findings to `results/review-{phase}.md` or `results/review-paper.md` (+ `results/devils-advocate.md` for Deep Review).
10. Record evidence with a simple format: `- [PASS/FAIL] item: evidence | action`.

## Deliverables

- `results/review-{phase}.md` for Phase Gate reviews.
- `results/review-paper.md` for Deep Review.
- `results/devils-advocate.md` for Deep Review — counterarguments + verification status per main claim.
- `report.md` summary in the user's language with blockers, comments, and file inventory.

## Quality Gates

- [ ] The selected review mode matches the task and output file.
- [ ] Every checklist item is marked PASS or FAIL with brief evidence.
- [ ] Every Critical issue is fixed and re-checked before completion.
- [ ] Deep Review: each main claim has ≥1 Devil's-Advocate counterargument with a verification method, and each multi-perspective critical concern has a Resolved/Mitigated/Accepted disposition.

## Gotchas

- Phase Gate is a quick screen; it does not replace Deep Review for `paper.md`.
- Fix the failing section only; do not regenerate the whole paper for a local issue.
- Claims in Discussion and Conclusion must trace back to specific Results and citations.
- Devil's Advocate must *demand verification*, not merely assert doubt — an unattached counterargument is incomplete.
- Keep the three perspectives separate; if they all say the same thing you have collapsed them into one.
