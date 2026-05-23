---
name: co-scientist-uncertainty-quantification
description: |
  Uncertainty quantification skill. Aleatory/epistemic uncertainty estimation, ensemble uncertainty, conformal prediction, calibration, and uncertainty propagation.
  Use when working with aleatory/epistemic uncertainty estimation, ensemble uncertainty, conformal prediction.
---

# Uncertainty quantification

Uncertainty quantification skill. Aleatory/epistemic uncertainty estimation, ensemble uncertainty, conformal prediction, calibration, and uncertainty propagation.

## Use This Skill When

- Aleatory/epistemic uncertainty estimation.
- Ensemble uncertainty.
- Conformal prediction.
- Calibration.
- Uncertainty propagation.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. 不確実性の種類を特定:
   - Aleatoric（データ固有のノイズ）→ データ拡張、ノイズモデリング
   - Epistemic（モデルの知識不足）→ アンサンブル、MC Dropout、ベイズ推論
   - 両方 → Conformal Prediction（分布フリー）

2. 定量化手法を選択:
   - 分類: 予測確率の校正（Platt Scaling, Temperature Scaling）
   - 回帰: 予測区間（Quantile Regression, Conformal）
   - 比較: Bootstrap信頼区間（n≥1000回リサンプリング）

3. 報告形式:
   - 表: "metric ± std" or "metric [95% CI: lower, upper]"
   - 図: error bar, confidence band, violin plot
   - テキスト: "achieved X (95% CI: [a, b], n=N)"

4. 感度分析:
   - ハイパーパラメータ摂動に対するロバスト性
   - データサイズに対する学習曲線
   - ランダムシード変動（5+シード）

5. Save code, tables, figures, and intermediate outputs to files instead of chat-only output.
6. Append skill selection, handoff I/O, and file writes to `logs/process-log.jsonl`.

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
