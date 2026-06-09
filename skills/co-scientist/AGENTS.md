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

- **Depth over breadth.** Validate one core method deeply, not many superficially. For 3+ methods, ablate each contribution; for a "unified framework", compare vs single-method baselines; drop any component whose necessity isn't shown experimentally.
- **Justify the method choice** (incl. why not a simpler analytical / classical-ML / statistical baseline) — full requirements in copilot-instructions.md quality gates.

## Verification loop

`PHASE 0 → PLAN → EXECUTE → VERIFY → FINALIZE → LOG`.

0. **PHASE 0** — run `co-scientist-prompt-generator` to write a short `[cell:execution-plan]` (objective, phases, quality targets). Keep it minimal; let the CLI select sub-skills by description.
1. **PLAN** — objective, constraints, target outputs, candidate sub-skills.
2. **EXECUTE** — run the pipeline; **build `report.md` incrementally**, section by section as work completes (not all at the end).
3. **VERIFY** — quality gates (see copilot-instructions.md); `wc -w report.md` ≥850, `wc -w paper.md` ≥1,500.
4. **FINALIZE** — References, File Inventory, final cleanup + verification.
5. **LOG** — finalize `logs/process-log.jsonl`.

## Routing — WHEN/DO dispatch

**Invoke the matching sub-skill (skill tool) before implementing; never claim a skill you didn't run** — the validator's `skill_usage_mismatch` flags claimed-but-uninvoked skills.

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

## Science LLMs (NatureLM / GALACTICA / ESM …)

Not in ToolUniverse (DB-query APIs only). If a dedicated MCP exists (e.g. `mcp__naturelm__*`, `mcp__galactica__*`) call it; otherwise load from HuggingFace in a Jupyter cell (≤2B on CPU, 7B+ ~16 GB RAM, 13B+ GPU) or cite-only and note the limit. Never answer "not in ToolUniverse" and stop. AlphaFold → `co-scientist-alphafold-structures` (don't load weights yourself).

## Final response

`## Experiment Complete: {title}` → 3–5 key findings (each with its number) · the single most important figure · deliverables (modules/lines · report.md · paper.md · figures) · Limitations. No filler ("Still running…"); summarize files, don't reproduce the full report in chat.

## Gotchas

- Save handoff data between phases to files — chat-only context is lost on compaction.
- Forgetting `logs/process-log.jsonl` entries makes later phases untraceable.
- Make figure/table captions self-contained.
- Deep Review once after writing; revise at most once.
