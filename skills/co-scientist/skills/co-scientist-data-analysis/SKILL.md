---
name: co-scientist-data-analysis
description: |
  Statistical data analysis and visualization skill. Hypothesis testing, regression,
  ANOVA, Bayesian analysis, exploratory data analysis, and publication-quality figures.
  Use when ANALYZING collected data, running statistical tests, creating visualizations,
  interpreting results, or performing exploratory data analysis on datasets.
---

# Data Analysis

Statistical analysis, visualization, and result interpretation.

## Use This Skill When

- Running hypothesis tests (t-test, ANOVA, chi-square, etc.).
- Building regression or classification models.
- Performing exploratory data analysis (EDA).
- Creating publication-quality figures.
- Interpreting statistical results in research context.

## Workflow

1. Data assessment:
   - Check data structure, types, and dimensions
   - Identify missing values, outliers, and distributional properties
   - Validate assumptions for planned analyses

2. Analysis execution:
   - Apply appropriate statistical methods
   - Report effect sizes and confidence intervals (not just p-values)
   - Run sensitivity analyses when assumptions are questionable

3. Visualization:
   - Generate publication-quality figures (English text only)
   - Use colorblind-friendly palettes
   - Save all figures to `figures/`

4. Interpretation:
   - State what the results mean in research context
   - Acknowledge limitations and alternative explanations
   - Distinguish statistical significance from practical significance

## Mandatory Sensitivity Analysis

全ての実験で以下の sensitivity analysis を実施し、`results/sensitivity-analysis.md` に保存すること:

### 必須項目（全実験で実施）

1. **シード感度**: 5+シードでの結果のばらつき
   - `results/seed-config.md` が存在する場合はそこからシードを読み込む
   - 結果を Mean ± SD で報告

2. **主要ハイパーパラメータ感度**: 最重要パラメータ2-3個を ±10%, ±20% 変動
   ```text
   | Parameter | -20% | -10% | Default | +10% | +20% |
   |-----------|------|------|---------|------|------|
   | learning_rate | X.XX | X.XX | X.XX | X.XX | X.XX |
   | regularization | X.XX | X.XX | X.XX | X.XX | X.XX |
   ```

### 推奨項目（時間が許す場合に実施）

3. **データサイズ感度**: 20%, 40%, 60%, 80%, 100% のデータで性能変化
4. **ノイズ耐性**: 入力データにガウスノイズを追加した場合の性能劣化

### `results/sensitivity-analysis.md` テンプレート

```text
# Sensitivity Analysis

## Seed Sensitivity (5 seeds)
| Seed | Metric 1 | Metric 2 |
|------|----------|----------|
| 42 | X.XX | X.XX |
| 123 | X.XX | X.XX |
| ... | ... | ... |
| Mean ± SD | X.XX ± X.XX | X.XX ± X.XX |
| CV (%) | X.X% | X.X% |

## Hyperparameter Sensitivity
[table as above]

## Interpretation
[1-2 paragraphs interpreting sensitivity results]
```

## Ablation Results Generation

`results/ablation-variants.md` が experimental-design Phase で生成されている場合、
全 variant を実行し結果を `results/ablation-results.md` に保存すること。

### 実行手順

1. `results/ablation-variants.md` を読み込み、variant 一覧を取得
2. 各 variant を独立に実行
3. 全メトリクスに ± SD と 95% CI を付与
4. 結果テーブルを生成

### `results/ablation-results.md` テンプレート

```text
# Ablation Study Results

## Configuration
- Base seeds: [from seed-config.md]
- Evaluation: [k-fold CV / hold-out]

## Results
| Variant | Component A | Component B | Component C | Metric 1 ± SD | Metric 2 ± SD | Δ from Full |
|---------|:-----------:|:-----------:|:-----------:|--------------|--------------|-------------|
| Full model | ✓ | ✓ | ✓ | X.XX ± X.XX | X.XX ± X.XX | — |
| w/o A | ✗ | ✓ | ✓ | X.XX ± X.XX | X.XX ± X.XX | -X.X% |
| w/o B | ✓ | ✗ | ✓ | X.XX ± X.XX | X.XX ± X.XX | -X.X% |
| w/o C | ✓ | ✓ | ✗ | X.XX ± X.XX | X.XX ± X.XX | -X.X% |
| Baseline | ✗ | ✗ | ✗ | X.XX ± X.XX | X.XX ± X.XX | -X.X% |

## Statistical Significance of Component Contributions
| Component | Δ Metric 1 | p-value | Effect Size |
|-----------|-----------|---------|-------------|
| A | X.XX | p = X.XX | d = X.XX |
| B | X.XX | p = X.XX | d = X.XX |
| C | X.XX | p = X.XX | d = X.XX |

## Interpretation
[Which components are most critical? Any surprising results?]
```

### ablation-variants.md が存在しない場合

- 提案手法のコンポーネント数が 2 以上の場合: WARNING を発行し、sensitivity analysis で代替
- 1コンポーネントのみの場合: ablation は不要（sensitivity analysis のみ）

## Result Table CI Requirements

全ての結果テーブルは以下のフォーマットに準拠すること:

### 必須列

| 列名 | 必須/推奨 | 説明 |
|------|---------|------|
| Metric name | 必須 | 評価指標名 |
| Mean ± SD | 必須 | 平均値と標準偏差 |
| 95% CI | 必須 | 95% 信頼区間 |
| n | 推奨 | サンプルサイズ |
| Method | 推奨 | CI 算出方法（bootstrap / analytical） |

### 禁止フォーマット

- ❌ 数値のみ: `0.934` → ✅ `0.934 ± 0.018 (95% CI: [0.916, 0.952])`
- ❌ SD なし CI: `0.934 [0.916, 0.952]` → ✅ `0.934 ± 0.018 [0.916, 0.952]`
- ❌ 比較 p値なし: `Method A > Method B` → ✅ `Method A > Method B (p = 0.003, d = 0.67)`

`results/statistical-summary.md` に全結果を統合して保存すること。

## Deliverables

- `report.md`: analysis narrative with embedded figure references.
- `results/statistical-summary.md`: test results, effect sizes, CIs.
- `results/sensitivity-analysis.md`: sensitivity analysis results (seed, hyperparameter, data size).
- `results/ablation-results.md`: ablation study results (when ablation-variants.md exists).
- `figures/`: publication-quality plots (English labels).
- `data/`: processed datasets when transformation occurs.

## Quality Gates

- [ ] Statistical assumptions are checked before applying tests.
- [ ] Effect sizes and confidence intervals are reported alongside p-values.
- [ ] Figures use English text and colorblind-friendly palettes.
- [ ] Multiple comparisons are corrected (Bonferroni, FDR, etc.) when applicable.
- [ ] Limitations of the analysis are explicitly stated.
- [ ] **`results/sensitivity-analysis.md` が生成されている**（最低: シード感度 + パラメータ感度）
- [ ] **`results/ablation-variants.md` が存在する場合、`results/ablation-results.md` が生成されている**
- [ ] **全結果テーブルの数値に ± SD と 95% CI が付与されている**
- [ ] **全比較に統計検定結果（p値 + 効果量）が含まれている**

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- p値だけでなく効果量と信頼区間を必ず報告すること。「p < 0.05 で有意」だけでは不十分
- 多重比較を行う場合は補正が必須。検定の数が3以上なら Bonferroni または FDR 補正を適用
- 外れ値の除外は根拠を明示すること。「見た目で除外」は再現性を損なう
- 図のテキストは必ず英語。日本語のラベルが入った図はジャーナル投稿で再作成が必要になる
- データの前処理手順は `data/preprocessing-log.md` に記録すること。処理の再現性を担保する
- **sensitivity analysis は全実験で必須。シード感度とパラメータ感度は最低ライン**
- **`results/ablation-variants.md` が存在するのに ablation 結果がない場合、Phase 4 の Review で Critical FAIL となる**
- **`results/statistical-summary.md` は Phase 4 で直接参照される。CI なしの数値は論文に転記されず Quality Gate FAIL の連鎖を引き起こす**
- **`results/seed-config.md` が存在する場合はそこからシードを読み込むこと。独自にシードを決めると Phase 間で再現性が保てない**

## Validation Loop

1. 分析結果を生成
2. チェック:
   - 仮定の検証（正規性、等分散性等）が行われているか
   - 効果量と信頼区間が報告されているか
   - 多重比較補正が必要な場面で適用されているか
   - 図が英語ラベルで colorblind-friendly か
3. 不合格なら該当箇所を修正して再分析
4. 合格後のみレポート確定
