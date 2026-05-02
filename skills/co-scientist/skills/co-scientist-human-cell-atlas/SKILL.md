---
name: co-scientist-human-cell-atlas
description: |
  Human Cell Atlas skill. HCA data portal queries, cell type reference mapping, organ-specific cell atlases, and single-cell study integration across the Human Cell Atlas project.
  Use when working with hca data portal queries, cell type reference mapping, organ-specific cell atlases.
tu_tools:
  - key: hca
    name: Human Cell Atlas
---

# Human Cell Atlas

Human Cell Atlas skill. HCA data portal queries, cell type reference mapping, organ-specific cell atlases, and single-cell study integration across the Human Cell Atlas project.

## Use This Skill When

- HCA data portal queries.
- Cell type reference mapping.
- Organ-specific cell atlases.
- Single-cell study integration across the Human Cell Atlas project.

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

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Human Cell Atlas | `HCA_search_projects` | Human Cell Atlas API |
| Human Cell Atlas | `HCA_get_project` | Human Cell Atlas API |

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
