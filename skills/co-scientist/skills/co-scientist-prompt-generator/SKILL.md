---
name: co-scientist-prompt-generator
description: |
  Phase 0 meta-skill: analyzes the user's research topic and generates an optimized
  execution plan before the main Co-Scientist pipeline begins. Rule-based template
  assembly (no LLM generation) ensures deterministic, concise prompts that maximize
  citation density and minimize context pressure.
tags:
  - meta
  - planning
  - prompt-optimization
---

# Prompt Generator (Phase 0)

This skill runs **before** the main research pipeline. It analyzes the user's research topic
and assembles an optimized execution plan that the Co-Scientist follows.

## When to Use

- **Always** as the first step when receiving a new research topic
- Before literature review, experimental design, or any analysis

## What This Skill Does

1. **Domain Classification** — Categorize the research topic into one of 5 domains
2. **Skill Selection** — Identify which Co-Scientist sub-skills are relevant
3. **Template Assembly** — Generate a structured execution plan with domain-specific instructions

## Domain Classification Rules

Classify the user's research topic based on keyword matching:

| Domain | Keywords |
|--------|----------|
| **genomics** | genome, GWAS, SNP, variant, transcriptome, RNA-seq, scRNA, single-cell, epigenome, methylation, gene expression, ゲノム, 遺伝子 |
| **molecular** | molecule, drug, compound, docking, SMILES, LogP, pharmacophore, ligand, binding, inhibitor, 分子, 薬物 |
| **protein** | protein, amino acid, folding, PDB, AlphaFold, antibody, peptide, kinase, enzyme, タンパク質 |
| **materials** | material, alloy, crystal, polymer, ceramic, battery, catalyst, surface, 材料, 合金 |
| **general-science** | (default if no specific domain matches) |

## Execution Plan Template

Generate the following plan as a markdown cell `[cell:execution-plan]`:

```markdown
# Execution Plan

## Domain: {classified_domain}
## Relevant Skills: {selected_skills}

## Phase 1: Literature Review + Experimental Design
- Search for 5+ recent papers (2020+) using Semantic Scholar / PubMed
- {domain_specific_tools}

## Phase 2: Implementation + Execution
- Python implementation with Jupyter MCP
- Required: random_state=42, cross-validation with std
- {domain_specific_libraries}

## Phase 3: Citation Ledger + Figure Ledger
- [cell:results-summary]: ALL numeric values to be cited
- [cell:figure-ledger]: ALL figure paths with assert existence check
- Literal paths only for plt.savefig()

## Phase 4: Paper Writing
- IMRaD structure (Abstract 200+ words)
- Every number must have [cell:xxx] citation
- Limitations section: 200+ words, discuss synthetic data limitations
- At least 2 candidate methods compared, with rejection rationale

## Quality Targets
- [cell:] citations: ≥ 2 per 100 words
- Uncited claims: 0
- Figure orphans: 0
- All figures: literal savefig paths matching paper.md references
```

## Domain-Specific Instructions

### Genomics
- Use NatureLM MCP (`ask_naturelm`) for biological mechanism parameters
- Use GALACTICA MCP (`scientific_qa`) for scientific validation
- Libraries: `pandas`, `numpy`, `scikit-learn`, `matplotlib`, `seaborn`, `scipy.stats`

### Molecular
- Use NatureLM MCP (`predict_logp`, `predict_property`, `generate_smiles`) for molecular predictions
- Use GALACTICA MCP (`generate_molecule`, `scientific_qa`) for validation
- Libraries: `rdkit`, `pandas`, `numpy`, `scikit-learn`, `matplotlib`

### Protein
- Use NatureLM MCP (`generate_protein_sequence`, `ask_naturelm`) for protein analysis
- Use GALACTICA MCP (`predict_protein_annotations`) for annotation
- Libraries: `biopython`, `pandas`, `numpy`, `scikit-learn`, `matplotlib`

### Materials
- Use NatureLM MCP (`predict_material_composition`, `ask_naturelm`) for material properties
- Libraries: `pymatgen`, `pandas`, `numpy`, `scikit-learn`, `matplotlib`

### General Science
- Use NatureLM MCP (`ask_naturelm`) for quantitative parameters
- Use GALACTICA MCP (`scientific_qa`) for validation
- Libraries: `pandas`, `numpy`, `scikit-learn`, `matplotlib`, `seaborn`, `scipy.stats`

## Critical Rules (from Round 11-30 benchmark analysis)

1. **Citation density ≥ 2%** — Every 100 words should contain at least 2 `[cell:xxx]` citations
2. **Minimal instructions** — Do NOT add redundant warnings. Each instruction should appear exactly once
3. **Figure literal paths** — `plt.savefig("figures/name.png")`, never f-strings or variables
4. **results-summary before paper** — Create `[cell:results-summary]` with ALL values before writing paper.md
5. **No re-execution** — Never re-run `[cell:results-summary]` after paper.md is written
