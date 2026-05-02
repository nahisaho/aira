---
name: co-scientist-experimental-design
description: |
  Experimental design and protocol skill. DOE (Design of Experiments), power analysis,
  sample size calculation, randomization, control design, and protocol documentation.
  Use when DESIGNING experiments, calculating sample sizes, choosing factorial designs,
  planning randomization, or writing experimental protocols.
---

# Experimental Design

DOE, power analysis, sample size calculation, and protocol design.

## Use This Skill When

- Designing a new experiment or study.
- Calculating required sample size or statistical power.
- Choosing between factorial, fractional-factorial, or response surface designs.
- Designing controls and randomization strategies.
- Writing a formal experimental protocol.

## Workflow

1. Define experimental parameters:
   - Independent variables (factors) and levels
   - Dependent variables (responses)
   - Expected effect size and variance
   - Significance level (α) and power (1-β)

2. Select design type:
   - Full factorial / Fractional factorial / Plackett-Burman
   - Response surface (CCD, Box-Behnken)
   - Randomized block / Latin square
   - Sequential / Adaptive design

3. Calculate sample size and power

4. Generate protocol document:
   - Materials and equipment
   - Step-by-step procedure
   - Randomization plan
   - Data collection template
   - Safety considerations

5. Save design matrix and protocol to files

## Deliverables

- `report.md`: design summary and rationale.
- `results/design-matrix.csv`: experimental design matrix.
- `results/power-analysis.md`: sample size and power calculations.
- `results/protocol.md`: formal experimental protocol.

## Quality Gates

- [ ] Design type matches the research question and constraints.
- [ ] Power analysis confirms adequate sample size.
- [ ] Confounding variables are identified and controlled.
- [ ] Randomization strategy is documented.
- [ ] Protocol is detailed enough for independent replication.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- 検出力分析でα=0.05, power=0.80 をデフォルトとするが、ユーザーの分野慣習を確認すること。臨床試験ではα=0.025（片側）が標準
- 完全実施要因計画は因子数が多いと実験数が爆発する。因子4つ以上では部分実施要因を提案すること
- 対照群なしの実験計画を提案してはならない。最低限、陽性対照または陰性対照を含めること
- サンプルサイズが小さすぎる場合は、効果量の再検討を促すこと（「データが足りない」ではなく「検出したい差を明確に」）

## Validation Loop

1. 実験計画を生成
2. チェック:
   - 検出力が 0.80 以上か（または分野慣習に合致するか）
   - 対照群が設定されているか
   - 交絡変数への対処が記載されているか
   - ランダム化戦略が明示されているか
3. 不合格なら設計を修正
4. ユーザー承認後のみプロトコル確定 ⏸️
