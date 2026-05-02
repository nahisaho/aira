---
name: co-scientist-marine-ecology
description: |
  Marine ecology skill. Ocean biodiversity analysis, marine species distribution modeling, fisheries data analysis, coral reef assessment, and marine environmental monitoring.
  Use when working with ocean biodiversity analysis, marine species distribution modeling, fisheries data analysis.
tu_tools:
  - key: obis
    name: OBIS
  - key: gbif
    name: GBIF
---

# Marine ecology

Marine ecology skill. Ocean biodiversity analysis, marine species distribution modeling, fisheries data analysis, coral reef assessment, and marine environmental monitoring.

## Use This Skill When

- Ocean biodiversity analysis.
- Marine species distribution modeling.
- Fisheries data analysis.
- Coral reef assessment.
- Marine environmental monitoring.

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
| OBIS | `OBIS_search_occurrences` | OBIS API |
| GBIF | `GBIF_search_occurrences` | GBIF API |

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Geographic coordinate systems (WGS84, UTM) must be specified. Mixing systems causes spatial analysis errors
- Seasonal and temporal autocorrelation must be accounted for in ecological time series
- Species taxonomy may differ between databases (GBIF, NCBI). Use a single backbone and document the choice

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
