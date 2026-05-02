---
name: co-scientist-crossref-metadata
description: |
  Crossref metadata skill. Scholarly publication metadata retrieval, citation count tracking, DOI resolution, funder information extraction, and bibliometric analysis via Crossref API.
  Use when working with scholarly publication metadata retrieval, citation count tracking, doi resolution.
tu_tools:
  - key: crossref
    name: Crossref
---

# Crossref metadata

Crossref metadata skill. Scholarly publication metadata retrieval, citation count tracking, DOI resolution, funder information extraction, and bibliometric analysis via Crossref API.

## Use This Skill When

- Scholarly publication metadata retrieval.
- Citation count tracking.
- DOI resolution.
- Funder information extraction.
- Bibliometric analysis via Crossref API.

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
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Search results vary by database. Use at least 2 databases (PubMed + Scopus) for systematic reviews
- Preprints (bioRxiv, arXiv, medRxiv) are not peer-reviewed. Flag preprint sources with ⚠️
- MeSH terms and free-text keywords return different result sets. Combine both for comprehensive coverage

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
