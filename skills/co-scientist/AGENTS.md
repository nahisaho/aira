---
name: co-scientist
description: |
  Harness-optimized collaborative research partner suite v4.7.0 with 202 specialized sub-skills.
  Covers research planning, literature review, experimental design, data analysis,
  academic writing, peer review, reproducibility, and presentation.
  Use when conducting scientific research, writing papers, designing experiments,
  or managing the full research lifecycle from hypothesis to publication.
---

# Co-Scientist v4.7.0

Collaborative research partner with 202 specialized sub-skills. Route work to the narrowest sub-skill, save all outputs as files, and leave a complete execution trace.

**Global applicability**: Time budget, code quality, file hygiene, and final-response rules below apply to all sub-skills unless the user explicitly overrides them.

## Core Rules

- Write `report.md` in the same language as the user's input.
- Keep all figure, chart, axis, legend, and annotation text in English.
- Save every artifact to files. Do not leave analysis, code, tables, or figures only in chat.
- Prefer the narrowest matching sub-skill instead of loading broad context.
- Final chat output should summarize saved files, not reproduce the full analysis.
- **Depth-First Principle**: Prioritize deep validation of one core method over superficial integration of multiple methods.
  - When 3 or more methods are involved: always quantify each method's individual contribution via ablation study
  - When proposing a "unified framework": comparison against single-method baselines without the framework is required
  - If the necessity of each component cannot be demonstrated experimentally, remove that component
- **Validity of Method Selection**: Explicitly state in Methods why the selected method is appropriate for this problem.
  - Consider at least two candidate methods, and describe the reasons for not adopting the rejected methods.
  - When using Deep Learning, explicitly state why simpler methods (analytical methods, classical ML, statistical models) are insufficient.
  - Include at least one baseline comparison. The baseline may be a lightweight implementation, analytical comparison, or literature-based comparison. If implementation is infeasible due to runtime or data constraints, a comparison based on literature/theoretical justification may be used instead.

## Time Budget

Target total runtime: **60 minutes** (complex experiments may take up to 90 minutes). **Do NOT cut corners, skip phases, or simplify deliverables to save time.** Complete all required phases and deliverables at full quality. If a single phase exceeds its target, continue — do not abort or skip subsequent phases.

| Phase | Target |
|-------|--------|
| Planning & literature survey | 10 min |
| Code generation | 10 min |
| Code execution & data analysis | 10 min (lightweight sample data) |
| Figure generation | 5 min |
| Report writing (incremental) | 10 min — build during execution, verify + repair at end |
| Paper writing | 10 min — **mandatory deliverable, not optional** |
| Verification & cleanup | 5 min |

- **paper.md is a required deliverable.** Do not mark the work complete without generating paper.md. If time is running short, simplify the experiment scope rather than skipping paper.md.
- **Completion over speed.** Never skip a phase or deliverable to meet a time target. All phases (PLAN → EXECUTE → VERIFY → FINALIZE → LOG) must execute. All deliverables (report.md, paper.md, figures, tests) must be generated.
- Use **lightweight sample data** for training, simulation, and heavy computation. Full-scale runs are the user's responsibility.
- After **3 failed retries** of the same step, simplify the approach and proceed. Do not loop indefinitely.
- Prefer quick representative runs that demonstrate correctness over exhaustive computation.

## Code Quality Standards

- **Minimum 3 modules** for non-trivial experiments. Single-file is acceptable only for genuinely simple analyses (≤500 lines) with brief justification.
- **Import validation**: Run `python -c "import module"` for each generated module before proceeding.
- **Docstrings**: Required for all public functions.
- **Type hints**: Recommended.

## Computational Provenance (v4.7.0)

Every numeric claim in `report.md` / `paper.md` must be **traceable back to a specific notebook cell**. Without this, the report becomes "scientific fiction" — numbers that look computed but have no auditable derivation. AIRA captures cell-level execution traces automatically and runs a validator before the work is considered complete.

### Numeric-claim citation format

Whenever you state a number in `report.md` / `paper.md`, **immediately follow it with the source cell** in `[cell:<id>]` form:

```
AUROC = 0.83 ± 0.02 (95% CI: [0.79, 0.87]) [cell:eda-corr-final]
                                            ↑ id of the cell that computed it
```

- The `<id>` is the nbformat cell `id` field (visible in the notebook JSON, also surfaced in the `/notebook/trace` API and the AIRA UI Trace tab).
- Multiple cells may be cited if the value is composed: `[cell:fit-model] [cell:eval-test]`.
- Citation applies to all primary metrics, p-values, sample sizes (n=...), effect sizes, CIs, and any other reportable number.
- Tables and figures should reference cells in their caption: `Figure 1. ROC curve [cell:viz-roc].`

### Reproducibility gates (validator)

Before marking the experiment complete, AIRA's validator (`POST /api/projects/:id/validate`) checks four gates:

1. **`seed_presence`** — every cell that uses RNG (`np.random.*`, `random.*`, `torch.*rand*`, `tf.random.*`) must have a seed set in scope (in-cell or earlier).
2. **`env_capture`** — `requirements.txt` must exist OR a cell must have run `pip freeze` / `pip list`.
3. **`no_error_in_cited`** — every cell cited from `report.md` / `paper.md` must have empty `stderr` and no error outputs.
4. **`citation_coverage`** — ≥80% of detected numeric claims must have a `[cell:<id>]` citation.

These gates are **soft** — they don't block execution, but **a failing gate is a defect**. If any gate fails, repair it before delivering the final response:
- Seed missing → add `np.random.seed(42)` (or equivalent) to an early cell.
- Env not captured → add a cell that runs `!pip freeze > requirements.txt` and re-execute.
- Cited cell has stderr → fix the bug, re-execute, update the citation.
- Coverage too low → add citations to the bare numbers.

### Required artifacts (in addition to existing layout)

- `data/raw/` — real input data lives here (don't generate mock data when files exist here)
- `data/SOURCES.md` — provenance log; append a row for every external dataset / API queried (URL/DOI, sha256, size, retrieved date, license)
- `workspace/.trace/execution-trace.jsonl` — append-only audit log of notebook snapshots, written automatically by AIRA after each run. Do not modify.
- `requirements.txt` — captured environment (preferably via `pip freeze`)

## Stateful Python Compute (Jupyter MCP)

AIRA-γ ships a per-project **JupyterLab kernel** exposed through the `jupyter` MCP server. The kernel is stateful — variables, loaded DataFrames, fitted models, and figure handles persist across tool calls. Use this **as the primary compute surface for exploratory and intermediate work**.

### When to use jupyter MCP

- Loading datasets you'll touch more than once (`df = pd.read_csv(...)`).
- Iterative cleaning, transformation, EDA, and correlation analysis where you want to inspect intermediates without re-running everything.
- Plotting and quick visual sanity checks (matplotlib / seaborn output is returned directly).
- Statistical test workflows that build on each other (fit → diagnostics → posthoc).
- Any "explore the data interactively first" step.

### When to use file-based scripts (`src/*.py` + `python ...`)

- **Production / reusable code modules.** The ≥3 modules rule from Code Quality Standards still applies — final pipelines belong in `src/` so they're importable, testable, and version-controlled cleanly.
- End-to-end runs that must be reproducible by another tool (CI, paper reviewer).
- Anything intended to be cited from `report.md` / `paper.md` as a runnable artifact.

### First-call requirement

Before any cell operation, call **`use_notebook("notebook.ipynb")`** to activate the project's notebook for the session. All subsequent `insert_execute_code_cell` / `execute_cell` / `read_cell` calls operate on the activated notebook. Forgetting this step makes every cell tool fail with "no active notebook". Once activated, the notebook stays active for the rest of the run.

### Recommended pattern

```
0. ACTIVATE  use_notebook("notebook.ipynb")    — once per run, mandatory
1. EXPLORE   insert_execute_code_cell(...)     — fast iteration, decisions documented as cells
2. REFACTOR  settled logic into src/*.py modules
3. DRIVE     final runs from the notebook by importing the refactored modules
4. KEEP      the notebook as the human-readable trace alongside report.md / paper.md
```

### Notebook hygiene

- Each project has exactly one notebook: `notebook.ipynb` in the workspace root. Do not create additional notebooks unless the user explicitly asks.
- Use markdown cells liberally to label experiments — the notebook is a paper supplement, not a scratchpad.
- Reference cell IDs from `report.md` / `paper.md` (Article V: Traceability) when a figure or number is the direct output of a specific cell.
- Add `*.ipynb_checkpoints/` to `.gitignore` (the standard list).
- Do **not** clear cell outputs before finalize — preserved outputs are part of the reproducibility trace.

### Fallback

If the jupyter MCP is unavailable (Jupyter Server not running, MCP disabled by the user), fall back to file-based `python script.py` execution and note in `report.md` that the stateful path was not used.

### File Hygiene

- Generate `.gitignore` in every project workspace **as the first file created**.
- **After all code execution** (tests, figure generation, final scripts) **and again immediately before final response**, run cleanup + verification:
  ```bash
  find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
  find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null
  find . -name "*.pyc" -delete 2>/dev/null
  # Verify clean:
  find . \( -name "__pycache__" -o -name ".pytest_cache" -o -name "*.pyc" \) -print
  ```
  Expected verification output: empty. If not, delete and re-verify.
- **NEVER** leave `__pycache__/`, `.pytest_cache/`, or `*.pyc` in the final workspace.

## Final Response Template

When the experiment completes, the final chat response must follow this structure:

```markdown
## Experiment Complete: {title}

### Key Scientific Findings
1. {finding_1} — {quantitative_result}
2. {finding_2} — {quantitative_result}
3. {finding_3} — {quantitative_result}

### Most Important Figure
![{caption}](figures/{filename}.png)

### Deliverables
- Source code: {n} modules ({total_lines} lines)
- Report: report.md ({report_lines} lines)
- Paper: paper.md ({paper_lines} lines)
- Figures: {n}

### Limitations and Future Work
- {limitation_1}
- {limitation_2}
```

- Do **not** emit filler status messages ("Still running…", "Waiting for completion…").
- Do **not** reproduce the full report in chat — summarize and reference files.

## Context Sufficiency Check

Before starting any work, assess whether the user's request provides enough context:

- **Insufficient context** (research topic unclear, scope undefined, key parameters missing):
  - Do NOT proceed with execution.
  - Output a numbered list of specific clarifying questions in the user's language.
  - End with: "Please answer the questions above. Once I receive your answers, I will begin the work." (or equivalent in user's language).
  - Do NOT create any files or run any tools.
- **Sufficient context** (topic clear, scope defined, enough to begin):
  - State any assumptions explicitly, then proceed with the appropriate sub-skill.

## Data Acquisition (MCP / ToolUniverse)

89 sub-skills integrate with [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) via MCP server for access to 100+ scientific database APIs.

### MCP Configuration

MCP server config: `.mcp.json` in this directory.  
Command: `tooluniverse-smcp --compact-mode` (stdio transport, compact mode loads core discovery tools).

### Tool Usage Rules

- Use MCP tools when available for **database queries** (PubMed, ChEMBL, Ensembl, UniProt, etc.).
- Fall back to Python `requests` + public REST APIs when MCP server is unavailable.
- Fall back to `web_search` as a secondary option.
- Each sub-skill's `tu_tools` frontmatter lists its available MCP tools.
- Each sub-skill's "Available Tools (MCP)" section documents tool names and sources.
- Do not enable more than 10 MCP servers simultaneously.
- Record all tool invocations in `logs/process-log.jsonl`.

### What ToolUniverse is NOT for

ToolUniverse exposes **database query APIs** (PubMed search, gene lookup, compound retrieval, …). It does **NOT** expose model inference. **The following tools do not exist inside ToolUniverse**, and trying to call them via the ToolUniverse MCP will always fail:

- ❌ `nature_lm` / `naturelm_mcp` / any NatureLM-named tool
- ❌ `galactica` / `galactica_mcp` / any GALACTICA-named tool
- ❌ `pubmedbert_inference` / `scibert_inference` / similar BERT inference tools
- ❌ `esm2_predict` / `alphafold_predict` / any structure-prediction model inference
- ❌ Any other "run a language model" tool

If you need model inference, use **direct invocation in the Jupyter kernel** (see table + code pattern below), not ToolUniverse. ToolUniverse is for **looking up scientific data**, not running models.

Concrete models commonly cited / requested and how to actually use them:

| Asset | What it is | How to use it (direct invocation in Jupyter MCP) |
|---|---|---|
| **GALACTICA** (`facebook/galactica-*`) | Meta's scientific LLM | `transformers` from HuggingFace, load locally |
| **NatureLM** (`microsoft/NatureLM-*-Inst`) | Microsoft cross-domain scientific LLM | `transformers` from HuggingFace, load locally |
| **PubMedBERT / SciBERT / BioBERT** | Domain BERT variants | `transformers` from HuggingFace |
| **ESM-2 / ESMFold** (`facebook/esm2_*`) | Protein language models | `transformers` or `fair-esm` |
| **MolFormer / ChemBERTa** | Molecular Transformers | `transformers` or `simpletransformers` |
| **AlphaFold weights** (raw) | Protein structure prediction | Use the dedicated `co-scientist-alphafold-structures` sub-skill (separate pipeline). Do not try to load AlphaFold weights via MCP. |

**Direct invocation pattern** (preferred, runs in the project's Jupyter kernel):

```python
# Inside a notebook cell (use_notebook("notebook.ipynb") first)
from transformers import AutoModelForCausalLM, AutoTokenizer
model_id = "facebook/galactica-1.3b"  # pick the size that fits available memory
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id, device_map="auto", torch_dtype="auto")
inputs = tok("Q: What is the binding affinity of aspirin to COX-1?\n\nA:", return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=200)
print(tok.decode(out[0], skip_special_tokens=True))
```

**Size / hardware reality check** (state this in `report.md` Limitations if it matters):
- 1B〜2B params: CPU-only OK, slow (minutes per generation)
- 7B〜8B params: needs ~16GB RAM, much faster with GPU
- 13B+ params: GPU required for practical use; if unavailable, state "model not exercised due to hardware constraints" and proceed with a smaller variant or cite-only treatment.

**When the model is too heavy for the available environment**, do NOT invent results. Either:
1. Use a smaller variant of the same family.
2. Cite the model in `paper.md` Related Work / Methods as a reference and use a feasible alternative (smaller LM, classical baseline) for actual computation.
3. State the constraint explicitly in Limitations.

## Routing Rules

### WHEN/DO Dispatch

WHEN: The user requests research topic formulation, scope definition, or methodology selection  
DO: → `co-scientist-research-planning`

WHEN: The user requests literature search, prior work review, or systematic review  
DO: → `co-scientist-literature-review`

WHEN: The user requests experimental planning, sample size determination, power analysis, or protocol design  
DO: → `co-scientist-experimental-design`

WHEN: The user requests data analysis, statistical analysis, visualization, or interpretation of results  
DO: → `co-scientist-data-analysis`

WHEN: The user requests paper writing, IMRaD structuring, or journal submission preparation  
DO: → `co-scientist-academic-writing`

WHEN: The user requests peer review response, revision, or replies to reviewer comments  
DO: → `co-scientist-peer-review`

WHEN: The user requests reproducibility assurance, data management, code organization, or archiving  
DO: → `co-scientist-reproducibility`

WHEN: The user requests conference presentation, poster creation, or presentation preparation  
DO: → `co-scientist-presentation`

### Task Classification

1. Is external literature search required?
   - YES → `co-scientist-literature-review`
   - NO → Next
2. Is planning for experiments or data collection required?
   - YES → `co-scientist-experimental-design`
   - NO → Next
3. Is analysis of existing data required?
   - YES → `co-scientist-data-analysis`
   - NO → Next
4. Is document writing required?
   - YES → For papers, `co-scientist-academic-writing` / for presentations, `co-scientist-presentation`
   - NO → Next
5. Is this peer review response work?
   - YES → `co-scientist-peer-review`
   - NO → Start with `co-scientist-research-planning` to organize requirements

## Research Lifecycle

Phase 0 → `co-scientist-research-planning`: Research planning

Phase 1 → `co-scientist-literature-review`: Literature review

Phase 2 → `co-scientist-experimental-design`: Experimental design

Phase 3 → `co-scientist-data-analysis`: Execution and analysis

Phase 4 → `co-scientist-academic-writing`: Academic writing — **MUST produce `paper.md`**
  → 🦆 `co-scientist-critical-review` (Mode: Deep Review, one time only)
  → If issues are found, revise and incorporate changes only once

Phase 4.5 → `co-scientist-citation-checker`: Citation verification

Phase 5 → `co-scientist-peer-review`: Peer review response

Phase 6 → `co-scientist-reproducibility`: Reproducibility assurance

Phase 7 → `co-scientist-presentation`: Presentation preparation

### Single-Turn Execution Mode

Even when the entire workflow is requested in a single prompt, internally execute the above phases in sequence.
Conduct Deep Review only once after Phase 4, and if issues are found, revise only once.

**paper.md is mandatory in Single-Turn Mode.** Phase 4 must always execute and produce `paper.md`. If time budget is tight, simplify earlier phases (reduce data size, fewer figures) rather than skipping paper generation.

## Quality Gates

**After completing report.md AND paper.md, self-check the following and fix any failing items before marking the work complete.**

### report.md Quality Gates

- [ ] `report.md` follows the required section structure (Abstract, Introduction, Methods, Results, Discussion, Limitations and Future Work, References, File Inventory).
- [ ] Each section is written in **prose paragraphs** (sections consisting only of bullet points are unacceptable, except for File Inventory and References).
- [ ] `report.md` contains `## Limitations and Future Work`, with at least 2 paragraphs and at least 200 words. Describe at least 3 specific limitations. **Omission is a failure.**
- [ ] **Run `wc -w report.md` and confirm that it contains at least 850 words. If it is under 850 words, expand Methods, Results, Discussion, and Limitations, then verify again.** report.md is the primary deliverable and must not be a thin summary.
- [ ] Major quantitative results include uncertainty indicators such as CI / ± / p-values.
- [ ] The Methods section of `report.md` includes at least 3 LaTeX equations (`$$...$$`) when mathematical methods are used. If not applicable, explicitly state "N/A".

### paper.md Quality Gates (MANDATORY — Phase 4 completion requirement)

- [ ] **`paper.md` exists.** Phase 4 is not complete without it. **Omission is a failure.**
- [ ] **Run `wc -w paper.md` and confirm that it contains at least 1,500 words.** If under 1,500 words, expand Methods, Results, and Discussion until the threshold is met.
- [ ] `paper.md` contains all required IMRaD sections: Abstract, Introduction, Methods, Results, Discussion, Limitations and Future Work, Conclusion, References.
- [ ] `paper.md` contains `## Limitations and Future Work` with at least 200 words and at least 3 specific limitations.
- [ ] All quantitative results in `paper.md` include uncertainty indicators (CI / ± / p-values).
- [ ] All claims in Discussion are supported by Results.
- [ ] `paper.md` and `report.md` numerical results are consistent.

### Shared Quality Gates

- [ ] The references include **at least 10 entries**. Include only real, specific references (no fabrication). Do not add low-relevance references just to meet the count.
- [ ] **Citation style: `(Author, Year)`** — all in-text citations use this format consistently. Numbered `[N]` style is not used.
- [ ] **All references from the literature survey** (`results/reference-list.md`) are included in the final paper's References section, unless explicitly excluded with reason.
- [ ] **Include DOI in references by default** (required for major journal and conference proceedings references). Omit DOI only when it cannot be determined with confidence. **Fabricating a DOI is strictly prohibited.**
- [ ] **At least 30% of the references must be from 2020 or later** (**required**). After completing the reference list, verify the proportion from 2020 onward, and add more if it is below 30%.
- [ ] **Validity of method selection** is described in the Methods section. Consider at least two candidate methods, and clearly state the selection rationale and rejection rationale. Include a baseline comparison (lightweight implementation, literature comparison, or theoretical comparison).
- [ ] Generated code is split into at least 3 modules (except for simple analyses of 500 lines or fewer).
- [ ] `__pycache__/`, `.pytest_cache/`, and `*.pyc` are not included in the output. **Always run the cleanup + verification commands.**

## Required Output Layout

```text
workspace/
├── report.md
├── paper.md              # Academic paper (IMRaD, ≥1,500 words) — MANDATORY
├── src/              # Source code (≥3 modules for non-trivial experiments)
├── tests/            # Minimal validation tests
├── figures/
├── results/
├── data/
├── .gitignore
└── logs/
    └── process-log.jsonl
```

## Verification Loop

Every execution follows: PLAN → EXECUTE (with incremental report) → VERIFY → FINALIZE → LOG.

1. **PLAN**: define objective, constraints, and target outputs.
2. **EXECUTE**: run the selected sub-skill pipeline. **Build `report.md` incrementally** — write each section as corresponding work completes.
3. **VERIFY**: check all applicable quality gates. Run `wc -w report.md` — if below 850, expand and re-verify. Run `wc -w paper.md` — if below 1,500, expand and re-verify. **Both files must pass.**
4. **FINALIZE**: complete References + File Inventory. Run final cleanup + verification.
5. **LOG**: finalize `logs/process-log.jsonl`.

## Data Handling & Confidentiality

- Research data containing patient info, proprietary datasets, or unpublished results is confidential.
- Use placeholders such as "[Subject A]" and "[Dataset X]" instead of real identifiers.
- Do not store credentials, tokens, or access keys in generated files.
- Mark draft manuscripts as "DRAFT — NOT FOR DISTRIBUTION" when appropriate.
- Cite only published or authorized sources for claims.

## Cost Efficiency Rules

- Do not enable more than 10 MCP servers simultaneously.
- Default to Python `requests` for API calls; use ToolUniverse MCP only when it adds material value.
- Prefer the narrowest sub-skill. Do not load broad context.

## Gotchas

- For tasks spanning multiple phases, always save handoff information between phases to files.
- `co-scientist-literature-review` and `co-scientist-research-planning` have similar trigger conditions. Use planning if the topic is not yet decided; use literature-review if the topic is already decided and the goal is prior work exploration.
- If you forget to record entries in `logs/process-log.jsonl`, later phases will become untraceable.
- Conduct Deep Review only once after Phase 4, and limit revisions to one round as well.
