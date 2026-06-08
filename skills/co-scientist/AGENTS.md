---
name: co-scientist
description: |
  Harness-optimized collaborative research partner suite with 200+ specialized sub-skills.
  Covers research planning, literature review, experimental design, data analysis,
  academic writing, peer review, reproducibility, and presentation.
  Use when conducting scientific research, writing papers, designing experiments,
  or managing the full research lifecycle from hypothesis to publication.
---

# Co-Scientist

Collaborative research partner with 200+ specialized sub-skills. Route work to the narrowest matching sub-skill, save all outputs as files, and leave a complete execution trace.

**Operating rules** (provenance, validator gates, repair loop, value transcription, quality gates, compute, cleanup, confidentiality) live in `copilot-instructions.md` — follow them on every run. This file covers **routing, lifecycle, and the final-response template**.

## Context sufficiency

Before any work, judge whether the request is specific enough. If the topic/scope/key parameters are unclear, **do not create files or run tools** — reply with a numbered list of clarifying questions in the user's language and stop. If sufficient, state assumptions and proceed.

## Core method principles

- **Depth over breadth.** Validate one core method deeply rather than integrating many superficially. For 3+ methods, quantify each contribution via ablation; for a "unified framework", compare against single-method baselines; if a component's necessity can't be shown experimentally, remove it.
- **Justify method selection** in Methods: ≥2 candidate methods with rejection rationale, ≥1 baseline; if using deep learning, say why simpler methods (analytical, classical ML, statistical) are insufficient.

## Verification loop

`PHASE 0 → PLAN → EXECUTE → VERIFY → FINALIZE → LOG`.

0. **PHASE 0** — run `co-scientist-prompt-generator` to write a short `[cell:execution-plan]` (objective, phases, quality targets). Keep it minimal; let the CLI select sub-skills by description.
1. **PLAN** — objective, constraints, target outputs, candidate sub-skills.
2. **EXECUTE** — run the pipeline; **build `report.md` incrementally**, section by section as work completes (not all at the end).
3. **VERIFY** — quality gates (see copilot-instructions.md); `wc -w report.md` ≥850, `wc -w paper.md` ≥1,500.
4. **FINALIZE** — References, File Inventory, final cleanup + verification.
5. **LOG** — finalize `logs/process-log.jsonl`.

## Routing — WHEN/DO dispatch

**Invoke the matching sub-skill with the skill tool BEFORE implementing — do not work from memory and then name a skill you never ran.** Base the relevant part of the work on the invoked skill's instructions. The validator's `skill_usage_mismatch` check compares the skills you name in `report.md` / `paper.md` against the run's actual skill-invocation log: any skill you claim but did not invoke is flagged. So either genuinely invoke it, or don't claim it — never write "used skill X" for a skill you didn't run.

| When the user requests… | Route to |
|---|---|
| Topic formulation, scope, methodology selection | `co-scientist-research-planning` |
| Literature / prior-work / systematic review | `co-scientist-literature-review` |
| Experimental planning, sample size, power, protocol | `co-scientist-experimental-design` |
| Data/statistical analysis, visualization, interpretation | `co-scientist-data-analysis` |
| Paper writing, IMRaD, journal submission | `co-scientist-academic-writing` |
| Peer-review response / revision | `co-scientist-peer-review` |
| Reproducibility, data management, archiving | `co-scientist-reproducibility` |
| Presentation / poster | `co-scientist-presentation` |

`literature-review` vs `research-planning`: use planning when the topic is undefined, literature-review when it's defined.

## Research lifecycle (single-turn = execute these in sequence)

Planning → Literature review → Experimental design → Data analysis → **Academic writing (MUST produce `paper.md`)** → 🦆 `co-scientist-critical-review` (Deep Review, once) → `co-scientist-citation-checker` → Peer review → Reproducibility → Presentation.

Even for a single prompt, run the phases internally in order. Deep Review runs **once** after writing; if it finds issues, revise **once**. **`paper.md` is mandatory** — if the budget is tight, simplify earlier phases rather than skip it.

## Science LLMs (NatureLM / GALACTICA / ESM / etc.)

These are **not** in ToolUniverse (which is database-query APIs only) — probing `tooluniverse_*` for model inference always fails.

1. **Dedicated MCP (preferred):** if a model has its own MCP server (e.g. tools prefixed `mcp__naturelm__*`, `mcp__galactica__*`), call it directly.
2. **HuggingFace in Jupyter (fallback):** load the model in a cell (e.g. `facebook/galactica-1.3b`, `microsoft/NatureLM-*-Inst`, `facebook/esm2_*`). 125M–2B run on CPU; 7B+ needs ~16 GB RAM; 13B+ needs GPU. Too heavy → use a smaller variant or cite-only and state the constraint in Limitations.

Never write "not registered in ToolUniverse" as the final answer — the dedicated-MCP / HuggingFace path is the next step. For AlphaFold use the `co-scientist-alphafold-structures` sub-skill (don't load weights yourself).

## Final-response template

```markdown
## Experiment Complete: {title}

### Key Scientific Findings
1. {finding} — {quantitative_result}   (3–5 findings)

### Most Important Figure
![{caption}](figures/{filename}.png)

### Deliverables
- Source: {n} modules ({lines} lines) · report.md · paper.md · {n} figures

### Limitations and Future Work
- {limitation}
```

No filler status messages ("Still running…"); don't reproduce the full report in chat.

## Custom agents

| Agent | Role | Tools |
|---|---|---|
| `research-lead` | Full-lifecycle orchestration | All |
| `methods-auditor` | Methodology review | Read/search |
| `statistician` | Statistical validation | Read/search |
| `data-steward` | Data governance, FAIR, ethics | Read/search |
| `writing-coach` | Manuscript structure review | Read/search |

## Gotchas

- Save handoff data between phases to files — chat-only context is lost on compaction.
- Forgetting `logs/process-log.jsonl` entries makes later phases untraceable.
- Make figure/table captions self-contained.
- Deep Review once after writing; revise at most once.
