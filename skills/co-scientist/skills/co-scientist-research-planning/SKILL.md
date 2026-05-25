---
name: co-scientist-research-planning
description: |
  Research planning and objective structuring skill. Formulates research questions,
  defines scope and methodology, identifies constraints, and creates actionable plans.
  Use when STARTING a new research project, defining research scope,
  choosing methodology, or structuring a research objective into components.
---

# Research Planning

Research question formulation, scope definition, and methodology selection.

## Use This Skill When

- Starting a new research project from scratch.
- Defining or refining a research question.
- Choosing between qualitative, quantitative, or mixed methods.
- Scoping a feasibility study or pilot.

## Workflow

1. Structure the user's request into 6 components:
   - **PURPOSE**: What decision or knowledge gap to address
   - **TARGET**: Specific phenomenon, population, or system
   - **SCOPE**: Breadth and depth boundaries
   - **CONSTRAINTS**: Time, budget, data access, ethical limits
   - **METHODOLOGY**: Candidate approaches ranked by fit
   - **DELIVERABLES**: Expected outputs and success criteria

2. Present the structured plan and wait for user approval ⏸️

3. After approval, generate:
   - `results/research-plan.md` with the full plan
   - `results/methodology-rationale.md` with methodology justification

4. Append to `logs/process-log.jsonl`

## Deliverables

- `report.md`: structured plan summary in user's language.
- `results/research-plan.md`: 6-component plan.
- `results/methodology-rationale.md`: methodology selection rationale.

## Quality Gates

- [ ] All 6 components are addressed.
- [ ] Methodology choice is justified with rationale.
- [ ] Constraints and limitations are explicitly stated.
- [ ] Plan is approved by user before proceeding.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- If the research topic is ambiguous, do not try to clarify it with a single question; gather information step by step, one question at a time
- When selecting methodology, check data availability first. Even an ideal method is infeasible without data
- If the scope is too broad, execution becomes infeasible. Recommend starting from the minimum verifiable scope

## Validation Loop

1. Generate the 6 components plan
2. Check:
   - Is PURPOSE written in a way that leads to decision-making?
   - Is SCOPE narrowed to a verifiable range?
   - Do CONSTRAINTS include "data availability"?
3. If it fails, revise and re-check
4. Complete only after user approval
