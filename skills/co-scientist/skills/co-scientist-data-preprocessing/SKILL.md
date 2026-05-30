---
name: co-scientist-data-preprocessing
description: |
  Data preprocessing skill. Missing value imputation, outlier detection, normalization, feature scaling, encoding, and data cleaning pipelines for scientific datasets.
  Use when working with missing value imputation, outlier detection, normalization.
---

# Data preprocessing

Data preprocessing skill. Missing value imputation, outlier detection, normalization, feature scaling, encoding, and data cleaning pipelines for scientific datasets.

## Use This Skill When

- Missing value imputation.
- Outlier detection.
- Normalization.
- Feature scaling.
- Encoding.

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

Preprocessing is iterative: assess → transform → re-assess. Use the **jupyter MCP** (see top-level AGENTS.md → Stateful Python Compute) so each step's effect is visible before committing to the next:

1. **Load raw data** in a cell. Keep the original `df_raw` alive — derive transformed views (`df_clean`, `df_norm`) without overwriting.
2. **Profile missingness** (per-column counts + MCAR/MAR/MNAR assessment) in its own cell. Decision on imputation strategy is made **after** seeing this.
3. **Outlier detection** (IQR / z-score / isolation forest) as a separate cell — visualize the flagged rows before dropping or capping.
4. **Imputation** (mean / median / KNN / MICE) — show before/after distributions side-by-side. If multiple strategies are compared, keep each as a separate DataFrame (`df_mean_imp`, `df_knn_imp`).
5. **Scaling / encoding** as the final transformation cell. Fit the scaler on training data only; persist it (`pickle.dump(scaler, ...)`) so test-time preprocessing is reproducible.
6. **Validation**: compare summary stats / distributions of `df_raw` vs `df_clean` in a single comparison cell. Document in `data/preprocessing-log.md`.
7. **Refactor** the settled pipeline into `src/preprocessing.py` as a single `preprocess(df) -> df` function. Re-run from the notebook to verify identical output to the cell-by-cell version.

Save the final processed dataset to `data/processed.parquet` (or equivalent) and reference the notebook cell IDs from `report.md` Methods so the reader can trace every transformation back to its decision.

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
