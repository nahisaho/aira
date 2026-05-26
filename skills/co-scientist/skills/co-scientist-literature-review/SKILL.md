---
name: co-scientist-literature-review
description: |
  Systematic literature review and synthesis skill. PRISMA-compliant screening,
  source evaluation, gap identification, and evidence synthesis from multiple databases.
  Use when COLLECTING prior research, searching databases, screening papers,
  synthesizing findings, or identifying research gaps in existing literature.
tu_tools:
  - key: pubmed
    name: PubMed
  - key: semantic_scholar
    name: Semantic Scholar
  - key: crossref
    name: Crossref
---

# Literature Review

Systematic literature search, screening, and evidence synthesis.

## Use This Skill When

- Searching for prior research on a topic.
- Conducting a PRISMA-compliant systematic review.
- Screening and evaluating source quality.
- Synthesizing findings across multiple studies.
- Identifying research gaps.

## Workflow

1. Define search strategy:
   - Keywords and Boolean operators
   - Target databases (PubMed, Scopus, Web of Science, Google Scholar)
   - Inclusion/exclusion criteria
   - Date range and language filters

2. Execute search and screen results:
   - Title/abstract screening
   - Full-text screening
   - Quality assessment (risk of bias)

3. Extract and synthesize:
   - Data extraction table
   - Thematic analysis or narrative synthesis
   - Gap identification

4. Generate PRISMA flow diagram data

5. Save all outputs to files

## Deliverables

- `report.md`: synthesis narrative with key findings.
- `results/search-strategy.md`: documented search methodology.
- `results/screening-table.csv`: inclusion/exclusion decisions.
- `results/extraction-table.csv`: extracted data from included studies.
- `results/reference-list.md`: structured citation list for downstream use by `co-scientist-academic-writing`.
- `figures/prisma-flow.md`: PRISMA flow diagram data.

### Reference List Format (`results/reference-list.md`)

Each entry must include: Author(s), Title, Journal/Venue, Year, and DOI (if available).
Use `(Author, Year)` citation keys consistently. Example:

```markdown
1. (Doe, 2023) Doe, J., & Smith, A. (2023). Title of the paper. *Journal Name*, 12(3), 45–67. https://doi.org/10.xxxx/xxxxx
2. (Lee, 2022) Lee, K. et al. (2022). Another paper title. *Conference Proceedings*. https://doi.org/10.xxxx/xxxxx
```

This file is the **source of truth** for citations in subsequent paper writing. Every paper included after screening must appear here.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| PubMed | `PubMed_search` | PubMed API |
| PubMed | `PubMed_get_article` | PubMed API |
| Semantic Scholar | `SemanticScholar_search` | Semantic Scholar API |
| Semantic Scholar | `SemanticScholar_get_paper` | Semantic Scholar API |
| Crossref | `Crossref_search_works` | Crossref API |

- Read `references/prisma-guide.md` when conducting PRISMA-compliant systematic reviews.

## Quality Gates

- [ ] Search strategy is documented and reproducible.
- [ ] Inclusion/exclusion criteria are explicit.
- [ ] At least 3 sources are cross-validated for key claims.
- [ ] Single-source findings are marked with ⚠️.
- [ ] Research gaps are identified with supporting evidence.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Google Scholar search results have low coverage. Always use it together with PubMed/Scopus
- Information from a single source should be marked with ⚠️ and not used for definitive conclusions
- Preprints (bioRxiv, arXiv) must be explicitly labeled as pre-peer-review
- Expanding search terms bilingually in Japanese and English helps avoid missing important non-English research
- Save screening results to files incrementally; compaction can erase intermediate results

## Validation Loop

1. Generate the search strategy and screening results
2. Check:
   - Do the search terms cover the research objective?
   - Are two or more databases used?
   - Are single-source claims marked with ⚠️?
3. If it fails, revise the search strategy and rerun
4. Proceed to the synthesis phase only after passing
