---
name: co-scientist-eda-correlation
description: |
  EDA and correlation analysis skill. Exploratory data analysis, correlation matrices, distribution visualization, multivariate analysis, and automated EDA report generation.
  Use when working with exploratory data analysis, correlation matrices, distribution visualization.
---

# EDA and correlation analysis

EDA and correlation analysis skill. Exploratory data analysis, correlation matrices, distribution visualization, multivariate analysis, and automated EDA report generation.

## Use This Skill When

- Exploratory data analysis.
- Correlation matrices.
- Distribution visualization.
- Multivariate analysis.
- Automated EDA report generation.

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

## Stateful Compute Pattern (Jupyter MCP preferred)

EDA is the canonical "load once, inspect many times" workflow. Use the **jupyter MCP** for the interactive phase (see top-level AGENTS.md → Stateful Python Compute):

1. **Load** the dataset once in a cell (`df = pd.read_csv(...)`). Do not reload in subsequent cells.
2. **Profile**: shape, dtypes, missingness, basic descriptives — one operation per cell so each result is preserved in the notebook.
3. **Distributions**: histograms / boxplots per variable. Save figures to `figures/` from the cells.
4. **Correlation**: compute the matrix once, render heatmap, and save `results/correlation_matrix.csv` plus `figures/correlation_heatmap.png`.
5. **Multivariate**: pairplots / PCA / clustering as separate cells, each saving its output.
6. **Refactor** any non-trivial transformation into `src/eda_utils.py` once the approach stabilizes; re-run from the notebook by importing.

The notebook becomes the human-readable EDA log — reference its cell IDs from `report.md` when a finding traces back to a specific plot or table.

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Statistical assumptions (normality, independence, homoscedasticity) must be tested before parametric methods
- Multiple testing correction is required when running 3+ tests. Use Bonferroni or FDR as appropriate
- Missing data mechanisms (MCAR, MAR, MNAR) must be assessed before choosing imputation strategy

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
