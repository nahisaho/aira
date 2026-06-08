---
name: co-scientist-prompt-generator
description: |
  Phase 0 planning skill. Before any research work begins, produce a short, concrete
  execution plan for the user's topic — objective, the four pipeline phases, and explicit
  quality targets — saved as [cell:execution-plan]. Use this FIRST when receiving a new
  research topic, before literature review, experimental design, or analysis.
tu_tools:
---

# Prompt Generator (Phase 0)

Runs **first**, before the main Co-Scientist pipeline. It turns the user's topic into a
short execution plan the rest of the run follows.

Keep the plan **brief and concrete**. Benchmark analysis (Rounds 11–30) is unambiguous:
adding instructions *lowers* quality (citation density R26 3.27% → R30 1.91%; FigOrp
R22 6.1 → R24 13.1). A tight, targeted plan beats a long one. Do not restate rules that
already live in the other sub-skills — point to them.

## Domain & skill selection — already done for you

AIRA's dynamic skill router (v3.6.1) has **already classified the topic and synced only the
relevant sub-skills** into this workspace. Do **not** re-derive the domain or re-list
skills — inspect the skills available under `.github/skills/` and plan around them. This
keeps Phase 0 a planner, not a duplicate classifier.

## What to produce

Write `[cell:execution-plan]` as a short markdown cell:

```markdown
# Execution Plan — {one-line topic restatement}

Objective: {1 sentence}
Available skills: {names actually synced under .github/skills/}

1. Literature + design — 5+ recent papers (2020+) via Semantic Scholar / PubMed
2. Implementation — Python via Jupyter MCP; random_state=42; CV with std
3. Ledgers — [cell:results-summary] (all values) and [cell:figure-ledger] (literal savefig paths)
4. Paper — IMRaD; every number carries a [cell:xxx]; Limitations ≥200 words

Quality targets: citations ≥ 2 / 100 words · uncited = 0 · figure orphans = 0
```

## Domain-specific hints (one line; include only the matching domain)

- **genomics** — NatureLM `ask_naturelm`; libs: pandas, numpy, scikit-learn, scipy.stats, seaborn
- **molecular** — NatureLM `predict_logp` / `generate_smiles`; libs: rdkit, pandas, scikit-learn
- **protein** — NatureLM `generate_protein_sequence`; GALACTICA `predict_protein_annotations`; libs: biopython, pandas
- **materials** — NatureLM `predict_material_composition`; libs: pymatgen, pandas, scikit-learn
- **general** — NatureLM `ask_naturelm`; GALACTICA `scientific_qa`; libs: pandas, numpy, scipy.stats

> NatureLM / GALACTICA are the external MCP servers the Co-Scientist suite already assumes
> (see the suite AGENTS.md). Reference a tool only if its MCP is configured.

## The one rule that matters here

Phase 0 outputs **only** the plan above. It does not start the research, run cells, or
write the paper — those are Phases 1–4. Hand off to the synced sub-skills and stop.
