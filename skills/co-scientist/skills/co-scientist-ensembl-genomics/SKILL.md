---
name: co-scientist-ensembl-genomics
description: |
  Ensembl genomics skill. Genome browser API queries, gene annotation retrieval, variant effect prediction, comparative genomics, and regulatory feature mapping via Ensembl REST API.
  Use when working with genome browser api queries, gene annotation retrieval, variant effect prediction.
tu_tools:
  - key: ensembl
    name: Ensembl
---

# Ensembl genomics

Ensembl genomics skill. Genome browser API queries, gene annotation retrieval, variant effect prediction, comparative genomics, and regulatory feature mapping via Ensembl REST API.

## Use This Skill When

- Genome browser API queries.
- Gene annotation retrieval.
- Variant effect prediction.
- Comparative genomics.
- Regulatory feature mapping via Ensembl REST API.

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
| Ensembl | `Ensembl_lookup_id` | Ensembl API |
| Ensembl | `Ensembl_get_sequence` | Ensembl API |
| Ensembl | `Ensembl_search_genes` | Ensembl API |

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Reference genome version (hg19 vs hg38) must be confirmed before analysis. Mixing versions produces invalid coordinates
- FASTQ quality scores can use different encoding (Phred+33 vs Phred+64). Verify encoding before alignment
- Batch effects between sequencing runs must be assessed. Combine technical replicates only after batch correction

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
