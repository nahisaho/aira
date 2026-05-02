---
name: co-scientist-pharmacology-targets
description: |
  Pharmacology targets skill. Target validation, druggability assessment, target prioritization scoring, and pharmacological target-disease mapping.
  Use when working with target validation, druggability assessment, target prioritization scoring.
tu_tools:
  - key: chembl
    name: ChEMBL
  - key: pharos
    name: Pharos
---

# Pharmacology targets

Pharmacology targets skill. Target validation, druggability assessment, target prioritization scoring, and pharmacological target-disease mapping.

## Use This Skill When

- Target validation.
- Druggability assessment.
- Target prioritization scoring.
- Pharmacological target-disease mapping.

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
| ChEMBL | `ChEMBL_search_target` | ChEMBL API |
| Pharos | `Pharos_search_target` | Pharos API |

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Patient data must be de-identified before analysis. Check for quasi-identifiers (age + zip + diagnosis)
- Clinical endpoints must distinguish primary from secondary outcomes. Multiple primaries require alpha correction
- Drug interaction databases have incomplete coverage. Cross-reference at least two databases for safety checks

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
