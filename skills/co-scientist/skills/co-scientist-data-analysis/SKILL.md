---
name: co-scientist-data-analysis
description: |
  Statistical data analysis and visualization skill. Hypothesis testing, regression,
  ANOVA, Bayesian analysis, exploratory data analysis, and publication-quality figures.
  Use when ANALYZING collected data, running statistical tests, creating visualizations,
  interpreting results, or performing exploratory data analysis on datasets.
---

# Data Analysis

Statistical analysis, visualization, and result interpretation.

## Use This Skill When

- Running hypothesis tests (t-test, ANOVA, chi-square, etc.).
- Building regression or classification models.
- Performing exploratory data analysis (EDA).
- Creating publication-quality figures.
- Interpreting statistical results in research context.

## Workflow

1. Data assessment:
   - Check data structure, types, and dimensions
   - Identify missing values, outliers, and distributional properties
   - Validate assumptions for planned analyses

2. Analysis execution:
   - Apply appropriate statistical methods
   - Report effect sizes and confidence intervals (not just p-values)
   - Run sensitivity analyses when assumptions are questionable

3. Visualization:
   - Generate publication-quality figures (English text only)
   - Use colorblind-friendly palettes
   - Save all figures to `figures/`

4. Interpretation:
   - State what the results mean in research context
   - Acknowledge limitations and alternative explanations
   - Distinguish statistical significance from practical significance

## Sensitivity Analysis

Perform sensitivity analysis: test seed variation (5+ seeds) and key hyperparameter perturbation (±10-20%). Save to `results/sensitivity-analysis.md`.

## Ablation Results

If `results/ablation-variants.md` exists, execute all variants and save results to `results/ablation-results.md` with ± SD and 95% CI.

## Result Reporting

All result tables must include Mean ± SD and 95% CI. Comparisons must include statistical test and effect size.

## Deliverables

- `report.md`: analysis narrative with embedded figure references.
- `results/statistical-summary.md`: test results, effect sizes, CIs.
- `results/sensitivity-analysis.md`: sensitivity analysis results (seed, hyperparameter, data size).
- `results/ablation-results.md`: ablation study results (when ablation-variants.md exists).
- `figures/`: publication-quality plots (English labels).
- `data/`: processed datasets when transformation occurs.

## Quality Gates

- [ ] Statistical assumptions are checked before applying tests.
- [ ] Effect sizes and confidence intervals are reported alongside comparisons.
- [ ] Figures use English text and colorblind-friendly palettes.
- [ ] `results/sensitivity-analysis.md` is generated.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Report effect sizes and confidence intervals, not p-values alone.
- Document and justify any outlier removal or major preprocessing choice.
- Keep all figure text in English.
- If `results/seed-config.md` exists, use those seeds for consistency across phases.

## Validation Loop

1. Generate the analysis results
2. Check:
   - Are assumptions validated (normality, homoscedasticity, etc.)?
   - Are effect sizes and confidence intervals reported?
   - Is multiple-comparison correction applied where needed?
   - Are figures labeled in English and colorblind-friendly?
3. If it fails, fix the relevant parts and re-run the analysis
4. Finalize the report only after passing
