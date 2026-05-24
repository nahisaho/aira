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

## Mandatory Output Artifacts

不確実性定量化の結果は以下のファイルに保存し、Phase 4 (academic-writing) で参照されること:

### `results/uncertainty-summary.md`

```text
# Uncertainty Quantification Summary

## Per-Metric Uncertainty
| Metric | Mean | ± SD | 95% CI | Method |
|--------|------|------|--------|--------|
| [metric1] | X.XX | ± X.XX | [X.XX, X.XX] | [5-fold CV / bootstrap] |
| [metric2] | X.XX | ± X.XX | [X.XX, X.XX] | [5-fold CV / bootstrap] |

## Multi-Seed Results (5+ seeds)
| Seed | Metric 1 | Metric 2 | ... |
|------|----------|----------|-----|
| 42 | X.XX | X.XX | ... |
| 123 | X.XX | X.XX | ... |
| 456 | X.XX | X.XX | ... |
| 789 | X.XX | X.XX | ... |
| 1024 | X.XX | X.XX | ... |
| **Mean ± SD** | **X.XX ± X.XX** | **X.XX ± X.XX** | ... |

## Bootstrap Confidence Intervals (n ≥ 1000)
| Metric | Point Estimate | 95% CI (percentile) | 95% CI (BCa) |
|--------|---------------|---------------------|--------------|
| [metric] | X.XX | [X.XX, X.XX] | [X.XX, X.XX] |

## Calibration (分類問題の場合)
| Method | ECE | MCE | Brier Score |
|--------|-----|-----|-------------|
| Before calibration | X.XX | X.XX | X.XX |
| After calibration | X.XX | X.XX | X.XX |
```

このファイルが存在しない場合、Phase 4 の Uncertainty Gate で FAIL となる。

## Multi-Seed Execution Protocol

`results/seed-config.md` が experimental-design Phase で生成されている場合、
そこからシード値を読み込み、全シードで実験を実行すること。

### 実行手順

1. `results/seed-config.md` を読み込み、シード一覧を取得
2. 各シードで独立に実験を実行
3. 結果を Multi-Seed Results テーブルに記録
4. Mean ± SD を算出
5. Bootstrap CI を算出（n ≥ 1000 リサンプリング）

### seed-config.md が存在しない場合

- WARNING を発行
- デフォルトシード [42, 123, 456, 789, 1024] を使用
- このデフォルト使用を report.md に明記

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
- [ ] **`results/uncertainty-summary.md` が生成されている**
- [ ] **Multi-Seed Results テーブルに 5+ シードの結果が記録されている**
- [ ] **Bootstrap CI (n ≥ 1000) が主要メトリクスに対して算出されている**
- [ ] **全メトリクスに Mean ± SD が算出されている**
- [ ] **分類問題の場合: Calibration テーブルが含まれている**

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Statistical assumptions (normality, independence, homoscedasticity) must be tested before parametric methods
- Multiple testing correction is required when running 3+ tests. Use Bonferroni or FDR as appropriate
- Missing data mechanisms (MCAR, MAR, MNAR) must be assessed before choosing imputation strategy
- **`results/uncertainty-summary.md` は Phase 4 で直接参照される。このファイルが欠如すると論文の CI/± が付与されず、Quality Gate FAIL の連鎖を引き起こす**
- **Multi-seed 実行は計算コストが高いが、seed 感度を示すために必須。最低5シードで実行すること**
- **Bootstrap リサンプリングは n < 1000 だと CI 推定の精度が低い。必ず n ≥ 1000 を使用すること**
- **seed-config.md が存在する場合はそこからシードを読み込むこと。独自にシードを決めると Phase 間で不整合が生じる**

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
