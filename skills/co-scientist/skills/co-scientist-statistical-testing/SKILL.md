---
name: co-scientist-statistical-testing
description: |
  Statistical testing skill. Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests), multiple testing correction, effect size calculation, and power analysis.
  Use when working with frequentist hypothesis testing (t-test, anova, chi-square, nonparametric tests), multiple testing correction, effect size calculation.
---

# Statistical testing

Statistical testing skill. Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests), multiple testing correction, effect size calculation, and power analysis.

## Use This Skill When

- Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests).
- Multiple testing correction.
- Effect size calculation.
- Power analysis.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. Confirm scope, assumptions, and the exact artifact set to save.
2. Apply the narrowest domain method that answers the request with defensible evidence.
3. Save code, tables, figures, and intermediate outputs to files instead of chat-only output.
4. State limitations, uncertainty, and any validation or sensitivity checks performed.
5. Append skill selection, handoff I/O, and file writes to `logs/process-log.jsonl`.

## Reporting Requirements

Report all results as: metric = X.XX ± σ (95% CI: [a, b]). Comparisons must include test name, statistic, p-value, and effect size.

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Results include uncertainty, test details, and effect sizes.
- [ ] Outputs are saved to files and traceable from inputs to conclusions.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Test assumptions before using parametric methods.
- Apply multiple-testing correction when running 3+ comparisons.
- Do not report p-values without uncertainty and effect size.

## Validation Loop

1. Execute analysis and generate outputs
2. Check:
   - Method selection matches the research question and stated assumptions
   - All outputs are saved to files (no chat-only results)
   - Limitations and uncertainty are explicitly stated
   - `logs/process-log.jsonl` is updated with execution trace
3. If any check fails:
   - Identify the failing gate
   - Fix the specific issue
   - Re-run validation
4. Proceed only after all gates pass
