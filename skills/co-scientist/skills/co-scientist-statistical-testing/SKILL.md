---
name: co-scientist-statistical-testing
description: |
  Statistical testing skill. Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests), multiple testing correction, effect size calculation, and power analysis.
  Use when working with frequentist hypothesis testing (t-test, anova, chi-square, nonparametric tests), multiple testing correction, effect size calculation.
---

# Statistical testing

Statistical testing skill. Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests), multiple testing correction, effect size calculation, and power analysis.

## Use This Skill When

- Frequentist hypothesis testing (t-test, ANOVA, chi-square, nonparametric tests).
- Multiple testing correction.
- Effect size calculation.
- Power analysis.

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

## Mandatory Output Format (全結果に適用)

### 数値報告の必須フォーマット

全ての統計検定結果は以下のフォーマットで報告すること:

**単一指標**:
```text
metric = X.XX ± σ (95% CI: [a.aa, b.bb], n=N)
```

**比較結果**:
```text
Method A: metric = X.XX ± σ₁
Method B: metric = Y.YY ± σ₂
Difference: Δ = X.XX - Y.YY (paired t-test, t(df) = T.TT, p = P.PP, Cohen's d = D.DD)
```

**多重比較**:
```text
| Method | Metric ± σ | 95% CI | vs Baseline p | vs Baseline d |
|--------|-----------|--------|--------------|--------------|
| Baseline | X.XX ± σ | [a, b] | — | — |
| Method A | X.XX ± σ | [a, b] | p = 0.003* | d = 0.67 |
| Method B | X.XX ± σ | [a, b] | p = 0.142 | d = 0.23 |
*Bonferroni-corrected α = 0.025
```

### 禁止される報告形式

以下の報告形式は Quality Gate FAIL となる:
- ❌ p値のみ: "p < 0.05 で有意" → 効果量と CI が必要
- ❌ 区間なし: "accuracy 0.93" → ± σ と CI が必要
- ❌ 検定なし比較: "our method outperforms" → 統計検定が必要
- ❌ 効果量なし: "有意差あり (p = 0.03)" → Cohen's d 等が必要

### 結果テーブルテンプレート

`results/statistical-summary.md` は以下の形式で保存:

```text
# Statistical Summary

## Primary Results
| Metric | Method | Mean ± SD | 95% CI | Median (IQR) |
|--------|--------|-----------|--------|--------------|
| [metric] | [method] | X.XX ± X.XX | [X.XX, X.XX] | X.XX (X.XX–X.XX) |

## Pairwise Comparisons  
| Comparison | Test | Statistic | p-value | Effect Size | Interpretation |
|------------|------|-----------|---------|-------------|---------------|
| A vs B | paired t | t(df)=X.XX | p=X.XX | d=X.XX | [small/medium/large] |

## Multiple Comparison Correction
Method: [Bonferroni / Holm / BH-FDR]
Corrected α: X.XX
```

## Few-Shot Examples (正しい統計報告)

### Example 1: 分類問題の結果報告

> The proposed classifier achieved an accuracy of 0.934 ± 0.018 (95% CI: [0.916, 0.952]) 
> across 5-fold cross-validation with n = 2,000 samples. Compared to the random forest 
> baseline (accuracy = 0.891 ± 0.022), the improvement was statistically significant 
> (paired t-test, t(4) = 4.12, p = 0.015, Cohen's d = 1.84). Effect size interpretation: 
> large effect (d > 0.8).

### Example 2: 回帰問題の結果報告

> RMSE decreased from 2.45 ± 0.31 (baseline) to 1.87 ± 0.22 (proposed method), 
> a 23.7% reduction. The improvement was confirmed by Wilcoxon signed-rank test 
> (W = 3, p = 0.008, r = 0.71) across 5 random seeds. The 95% bootstrap CI for 
> the RMSE difference was [0.38, 0.78], indicating a practically meaningful improvement.

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
- [ ] **全ての定量結果に ± σ AND 95% CI が付与されている**
- [ ] **全ての比較に統計検定結果（検定名、統計量、p値）が含まれている**
- [ ] **全ての比較に効果量（Cohen's d, η², r 等）が報告されている**
- [ ] **多重比較（3+検定）に補正が適用されている**
- [ ] **`results/statistical-summary.md` が上記テンプレートに準拠している**

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Statistical assumptions (normality, independence, homoscedasticity) must be tested before parametric methods
- Multiple testing correction is required when running 3+ tests. Use Bonferroni or FDR as appropriate
- Missing data mechanisms (MCAR, MAR, MNAR) must be assessed before choosing imputation strategy
- **結果報告時は必ず効果量（Cohen's d, η², r²等）と信頼区間を併記すること。p値のみの報告は不十分**
- **k-fold CV の結果には fold 間の標準偏差を必ず報告すること**
- **合成データでの性能評価は「上界推定」であることを明記し、実データとの乖離可能性を注記すること**
- **全ての数値に 95% CI または ± std を付与すること。区間なしの数値は Quality Gate FAIL**
- **比較には必ず効果量を併記すること。p値のみの報告は不十分であり、「有意」の実質的意味が不明になる**
- **`results/statistical-summary.md` は Phase 4 (academic-writing) で直接参照される。テンプレートに従わないと論文の Results が不完全になる**

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
