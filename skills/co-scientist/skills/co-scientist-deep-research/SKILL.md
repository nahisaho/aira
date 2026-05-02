---
name: co-scientist-deep-research
description: |
  Deep research skill. Iterative literature research following the SHIKIGAMI WebResearcher paradigm (Think→Report→Action cycle) with academic database search, evidence hierarchy assessment, source tracking, and hallucination prevention.
  Use when working with iterative literature research following the shikigami webresearcher paradigm (think→report→action cycle) with academic database search, evidence hierarchy assessment, source tracking.
tu_tools:
  - key: pubmed
    name: PubMed
  - key: semantic_scholar
    name: Semantic Scholar
  - key: openal
    name: OpenAlex
---

# Deep research

Deep research skill. Iterative literature research following the SHIKIGAMI WebResearcher paradigm (Think→Report→Action cycle) with academic database search, evidence hierarchy assessment, source tracking, and hallucination prevention.

## Use This Skill When

- Iterative literature research following the SHIKIGAMI WebResearcher paradigm (Think→Report→Action cycle) with academic database search.
- Evidence hierarchy assessment.
- Source tracking.
- Hallucination prevention.

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
| PubMed | `PubMed_search` | PubMed API |
| PubMed | `PubMed_get_article` | PubMed API |
| Semantic Scholar | `SemanticScholar_search` | Semantic Scholar API |
| Semantic Scholar | `SemanticScholar_get_paper` | Semantic Scholar API |
| OpenAlex | `OpenAlex_search_works` | OpenAlex API |
| OpenAlex | `OpenAlex_get_work` | OpenAlex API |

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
