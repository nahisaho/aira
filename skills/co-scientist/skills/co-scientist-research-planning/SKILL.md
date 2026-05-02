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

- 研究テーマが曖昧な場合、1回の質問で明確化しようとせず、1問ずつ段階的にヒアリングする
- 方法論の選択では、データ入手可能性を最初に確認すること。理想的な手法でもデータがなければ実行不可能
- スコープを広げすぎると実行不能になる。最小限の検証可能なスコープから始めることを推奨する

## Validation Loop

1. 6 components plan を生成
2. チェック:
   - PURPOSE が意思決定に繋がる形で記述されているか
   - SCOPE が検証可能な範囲に絞られているか
   - CONSTRAINTS に「データ入手可能性」が含まれるか
3. 不合格なら修正して再チェック
4. ユーザー承認後のみ完了
