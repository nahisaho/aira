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

## Deliverables

- `report.md`: analysis narrative with embedded figure references.
- `results/statistical-summary.md`: test results, effect sizes, CIs.
- `figures/`: publication-quality plots (English labels).
- `data/`: processed datasets when transformation occurs.

## Quality Gates

- [ ] Statistical assumptions are checked before applying tests.
- [ ] Effect sizes and confidence intervals are reported alongside p-values.
- [ ] Figures use English text and colorblind-friendly palettes.
- [ ] Multiple comparisons are corrected (Bonferroni, FDR, etc.) when applicable.
- [ ] Limitations of the analysis are explicitly stated.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- p値だけでなく効果量と信頼区間を必ず報告すること。「p < 0.05 で有意」だけでは不十分
- 多重比較を行う場合は補正が必須。検定の数が3以上なら Bonferroni または FDR 補正を適用
- 外れ値の除外は根拠を明示すること。「見た目で除外」は再現性を損なう
- 図のテキストは必ず英語。日本語のラベルが入った図はジャーナル投稿で再作成が必要になる
- データの前処理手順は `data/preprocessing-log.md` に記録すること。処理の再現性を担保する

## Validation Loop

1. 分析結果を生成
2. チェック:
   - 仮定の検証（正規性、等分散性等）が行われているか
   - 効果量と信頼区間が報告されているか
   - 多重比較補正が必要な場面で適用されているか
   - 図が英語ラベルで colorblind-friendly か
3. 不合格なら該当箇所を修正して再分析
4. 合格後のみレポート確定
