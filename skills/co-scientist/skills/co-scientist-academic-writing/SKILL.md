---
name: co-scientist-academic-writing
description: |
  Academic paper writing and formatting skill. IMRaD structure, journal-specific formats
  (Nature, Science, ACS, IEEE, Elsevier), citation management, and abstract optimization.
  Use when WRITING research papers, drafting manuscripts, formatting for journal submission,
  structuring IMRaD sections, or optimizing abstracts and titles.
tu_tools:
  - key: crossref
    name: Crossref
---

# Academic Writing

## Use This Skill When

- Drafting a new research paper from analysis results.
- Structuring a manuscript in IMRaD format.
- Formatting for a specific journal (Nature, Science, ACS, IEEE, Elsevier).
- Writing or optimizing an abstract.
- Managing citations and references.

## Workflow

1. Determine target journal and format:
   - Identify journal guidelines (word limit, section structure, figure limits)
   - Select appropriate template

2. **Load literature survey outputs** (if available):
   - Read `results/reference-list.md` from the literature review phase
   - This is the **primary citation source**; all surveyed references should be cited unless explicitly irrelevant
   - If the file does not exist, build the reference list during writing using Crossref/Semantic Scholar

3. Draft sections in order:
   - Methods (most objective, draft first)
   - Results (present findings with figure references)
   - Introduction (frame the research question and significance)
   - Discussion (interpret results, limitations, future work)
   - Abstract (summarize after all sections complete)
   - Title (optimize for discoverability)

4. Citation integration:
   - Use **`(Author, Year)` style** for all in-text citations (e.g., `(Doe, 2023)`, `Doe et al. (2023)`)
   - Every entry from `results/reference-list.md` must appear in the References section
   - Each citation must be individually supported — describe what the cited work contributes
   - Generate a numbered reference list at the end, sorted alphabetically by first author

4. Quality review:
   - Check logical flow across sections
   - Verify figures and tables are referenced
   - Ensure claims are supported by results

5. Self-Review:
   - Perform the semantic alignment check from `co-scientist-citation-checker`
   - Confirm that all quantitative results include uncertainty indicators (CI, SD, p-values)

## Paper Structure Template (Mandatory Sections)

1. Abstract
2. Introduction
3. Methods / Proposed Approach
4. Results
5. Discussion
6. **Limitations and Future Work** ← required section
7. Conclusion
8. References

### Limitations and Future Work

```text
## Limitations and Future Work

### Data Limitations
[State whether only synthetic data or real data was used. Describe sample size, known biases, and domain constraints]

### Methodological Limitations  
[Describe the validity of assumptions, scalability, computational cost, and method-specific constraints]

### Evaluation Limitations
[Describe the rationale and limits of metric selection, the number of baselines, and whether external validation was conducted]

### Generalizability
[Describe applicability to other domains/datasets and the impact of domain shift]

### Future Directions
[Describe specific improvements and a short-term (6 months) and long-term (1-2 years) roadmap]
```

**Required sentence when using only synthetic data**: include the following sentence in Evaluation Limitations:
> "External validation with independent real-world datasets is essential to confirm the generalizability of these findings beyond simulated conditions."

## Reference Rules

**Citation style: `(Author, Year)`** — use this consistently throughout the paper.
- Single author: `(Smith, 2023)`
- Two authors: `(Smith & Lee, 2023)`
- Three or more: `(Smith et al., 2023)`
- Narrative form: `Smith et al. (2023) demonstrated that...`

When listing references, include DOI whenever possible.
If DOI is unknown, omit volume/issue/page numbers and list only the title and authors.
It is better to omit details than to guess and include inaccurate metadata.

### Reference Quality Standards
- For papers involving literature review, target **≥10 references**.
- All references from `results/reference-list.md` (literature survey output) must be included. If any are omitted, document the reason.
- DOI format check: confirm it matches the `10.XXXX/XXXXX` pattern. Remove invalid DOI strings.
- Each reference must be cited individually in the main text. Bulk citations such as `[1-5]` are prohibited.

## Claim Calibration

Avoid overclaiming: replace "novel"→"proposed", "state-of-the-art"→"competitive", "guarantees"→"is designed to" unless evidence supports the claim.
Use cautious phrasing when evidence is limited, especially for synthetic-only or single-benchmark studies.
Discussion and Conclusion must not make claims that Results do not support.

## Deliverables

- `report.md`: writing progress summary.
- `results/manuscript.md`: complete manuscript draft.
- `results/abstract.md`: optimized abstract.
- `results/references.md`: formatted reference list.

`report.md` must be at least 1,000 words and include objectives, methods, results, and discussion.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |

- Reuse `assets/imrad-template.md` when writing IMRaD-format papers.

## Quality Gates

- [ ] Limitations and Future Work section exists, ≥200 words
- [ ] report.md ≥ 1,000 words
- [ ] All quantitative results have uncertainty indicators (CI, ±SD, or p-value)

## Gotchas

- Write the Methods section first. It is the most objective section and forms the foundation for the others
- Do not cite data in the Discussion that are not reported in the Results
- Write the Abstract only after all sections are complete. Writing it earlier can cause divergence from the final content
