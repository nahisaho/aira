---
name: co-scientist-gpu-singlecell
description: |
  GPU-accelerated single-cell skill. RAPIDS/cuML-based single-cell analysis, GPU-accelerated dimensionality reduction, clustering, and differential expression on large datasets.
  Use when working with rapids/cuml-based single-cell analysis, gpu-accelerated dimensionality reduction, clustering.
---

# GPU-accelerated single-cell

GPU-accelerated single-cell skill. RAPIDS/cuML-based single-cell analysis, GPU-accelerated dimensionality reduction, clustering, and differential expression on large datasets.

## Use This Skill When

- RAPIDS/cuML-based single-cell analysis.
- GPU-accelerated dimensionality reduction.
- Clustering.
- Differential expression on large datasets.

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

- Cell filtering thresholds (min genes, max mito %) are dataset-specific. Do not apply universal cutoffs without QC
- Batch effects across samples must be corrected before integration. Document the correction method used
- Downstream analysis depends on normalization choice. Log-normalize for clustering, SCTransform for DE in single-cell

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
