---
name: co-scientist-critical-review
description: |
  Critical review skill for phase-gate checks and deep review of paper drafts.
  Focuses on structure, claims, statistics, reproducibility, and citations.
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
4. Classify findings:
   - **Critical**: must be fixed before proceeding.
   - **Other findings**: record as comments with concrete suggestions.
5. If a Critical issue is found, apply one focused fix.
6. Re-run the failed checks once.
7. Save the findings to `results/review-{phase}.md` or `results/review-paper.md`.
8. Record evidence with a simple format: `- [PASS/FAIL] item: evidence | action`.

## Deliverables

- `results/review-{phase}.md` for Phase Gate reviews.
- `results/review-paper.md` for Deep Review.
- `report.md` summary in the user's language with blockers, comments, and file inventory.

## Quality Gates

- [ ] The selected review mode matches the task and output file.
- [ ] Every checklist item is marked PASS or FAIL with brief evidence.
- [ ] Every Critical issue is fixed and re-checked before completion.

## Gotchas

- Phase Gate is a quick screen; it does not replace Deep Review for `paper.md`.
- Fix the failing section only; do not regenerate the whole paper for a local issue.
- Claims in Discussion and Conclusion must trace back to specific Results and citations.
