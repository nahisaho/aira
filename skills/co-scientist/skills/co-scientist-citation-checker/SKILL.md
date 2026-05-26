---
name: co-scientist-citation-checker
description: |
  Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.
  Use when working with reference validation, doi verification, retraction detection.
tu_tools:
  - key: crossref
    name: Crossref
  - key: semantic_scholar
    name: Semantic Scholar
---

# Citation checking

Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.

## Use This Skill When

- Reference validation.
- DOI verification.
- Retraction detection.
- Citation consistency checking.
- Bibliography formatting compliance.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. **Cross-reference with literature survey** (if `results/reference-list.md` exists):
   - Compare the paper's References against `results/reference-list.md`
   - Flag any survey references missing from the paper
   - Flag any paper references not in the survey (these need extra verification)

2. Format checks:
   - Does every `(Author, Year)` in the text correspond to a References entry?
   - Is every entry in References cited in the text?
   - If a DOI exists, verify its existence via the Crossref API

3. Semantic alignment checks:
   - At each citation point, verify that the citation supports the claim
   - Pattern detection:
     - ❌ "[1-5] have studied X" → each paper's specific contribution should be described
     - ❌ "As shown in [3]" → what is shown should be stated explicitly
     - ✅ "Smith et al. (2023) demonstrated that Y achieves Z% on dataset W"
   - Citation density check: warn if citations are concentrated in the Introduction and absent in Methods/Results

4. Hallucination detection:
   - Verify the author name + title + year combination via Crossref/Semantic Scholar
   - Mark unverifiable citations with ⚠️
   - If the unverifiable citation rate exceeds 20%, mark the Quality Gate as FAIL

## Bulk Citation Handling

Detect bulk citations [N-M] (regex: `\[\d+[-–]\d+\]`). Replace each with individual citations describing each reference's contribution.

## DOI and Metadata Strategy

Search DOI via Crossref → Semantic Scholar → if not found, use minimal metadata (author, title, year only). Never guess volume/page numbers.

## Deliverables

- `report.md`: concise summary of citation issues, fixes, and remaining risks.
- `results/citation-report.md`: verification status, semantic mismatch notes, and metadata updates.
- `logs/process-log.jsonl`: tool usage, checks performed, and files written.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |
| Semantic Scholar | `SemanticScholar_get_citations` | Semantic Scholar API |

## Quality Gates

- [ ] If `results/reference-list.md` exists, all survey references are accounted for in the paper (included or explicitly excluded with reason).
- [ ] Every in-text citation maps to a reference entry, and unused references are resolved.
- [ ] Bulk citations are replaced with citation-specific support.
- [ ] Unverified references are flagged, with verification failure kept below 20%.
- [ ] DOI and metadata updates avoid guessed bibliographic fields.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Do not treat a citation as valid unless the referenced work actually supports the claim.
- Replace bulk citations with citation-specific statements.
- If DOI lookup fails, keep only minimal metadata and never guess missing fields.

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
