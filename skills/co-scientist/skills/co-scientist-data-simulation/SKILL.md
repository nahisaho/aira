---
name: co-scientist-data-simulation
description: |
  Data simulation skill. Synthetic data generation, Monte Carlo simulation, bootstrap resampling, parametric/non-parametric simulation, and power analysis via simulation.
  Use when working with synthetic data generation, monte carlo simulation, bootstrap resampling.
---

# Data simulation

Data simulation skill. Synthetic data generation, Monte Carlo simulation, bootstrap resampling, parametric/non-parametric simulation, and power analysis via simulation.

## Use This Skill When

- Synthetic data generation.
- Monte Carlo simulation.
- Bootstrap resampling.
- Parametric/non-parametric simulation.
- Power analysis via simulation.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. Confirm scope, assumptions, and the exact artifact set to save.
2. Apply the narrowest domain method that answers the request with defensible evidence.
3. Save code, tables, figures, and intermediate outputs to files instead of chat-only output.
4. State limitations, uncertainty, and any validation or sensitivity checks performed.
5. Append skill selection, handoff I/O, and file writes to `logs/process-log.jsonl`.

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Statistical assumptions (normality, independence, homoscedasticity) must be tested before parametric methods
- Multiple testing correction is required when running 3+ tests. Use Bonferroni or FDR as appropriate
- Missing data mechanisms (MCAR, MAR, MNAR) must be assessed before choosing imputation strategy
- **合成データでの好結果は「手法の正当性の必要条件」であり「十分条件」ではない。report.md に必ず以下を明記すること:**
  1. データ生成の仮定（分布、パラメータ）
  2. 実データとの既知の乖離点
  3. 実データ検証の推奨ステップ
- **合成データのパラメータが実世界の統計量に基づくことを示すこと**（例: "平均値と分散は [Reference] の報告値に基づく"）
- **シミュレーション結果のみで "validates the approach" と主張してはならない。"demonstrates feasibility under simulated conditions" が適切**

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
