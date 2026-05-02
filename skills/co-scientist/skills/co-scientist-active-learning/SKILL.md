---
name: co-scientist-active-learning
description: |
  Active learning skill. Uncertainty sampling, Query-by-Committee, expected model change, pool-based/stream-based, batch active learning, GP-based active learning with ARD-RBF kernel, dimension-adaptive convergence, stopping criteria, and model improvement pipeline.
  Use when working with uncertainty sampling, query-by-committee, expected model change.
---

# Active learning

Active learning skill. Uncertainty sampling, Query-by-Committee, expected model change, pool-based/stream-based, batch active learning, GP-based active learning with ARD-RBF kernel, dimension-adaptive convergence, stopping criteria, and model improvement pipeline.

## Use This Skill When

- Uncertainty sampling.
- Query-by-Committee.
- Expected model change.
- Pool-based/stream-based.
- Batch active learning.

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

- Data leakage between train/test splits invalidates all metrics. Verify no leakage before reporting results
- Random seeds must be set for numpy, random, and framework-specific RNGs separately (torch, tf)
- Hyperparameter tuning needs held-out test data never seen during tuning. Three-way split is minimum

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
