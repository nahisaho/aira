# IMRaD Paper Template (v4.0)

## Title
[Descriptive title reflecting key findings — avoid "novel", "state-of-the-art" unless justified]

## Abstract
- **Objective**: [1 sentence — what problem is addressed]
- **Methods**: [1-2 sentences — key approach and evaluation]
- **Results**: [1-2 sentences — primary quantitative findings with CI/±]
- **Conclusion**: [1 sentence — calibrated claim matching evidence strength]

## 1. Introduction
- Background and significance
- Research gap (with specific citations, no bulk [1-5])
- Objective and hypothesis
- Contributions (numbered list, each with supporting evidence pointer)

## 2. Methods
- Study design
- Participants/Materials
- Procedures
- Statistical analysis

### Reproducibility Table (必須)

| Parameter | Value |
|-----------|-------|
| Random seed(s) | [e.g., 42, 123, 456, 789, 1024] |
| Train/Val/Test split | [e.g., 80/10/10] |
| Hardware | [e.g., NVIDIA A100 40GB × 1] |
| Training time | [e.g., 2.5 hours] |
| Framework | [e.g., PyTorch 2.1, scikit-learn 1.3] |
| Learning rate | [e.g., 1e-3 with cosine annealing] |
| Batch size | [e.g., 32] |
| Optimizer | [e.g., AdamW (β₁=0.9, β₂=0.999)] |
| Key hyperparameters | [model-specific parameters] |

## 3. Results

### Primary Results
| Metric | Method | Mean ± SD | 95% CI | p-value | Effect Size |
|--------|--------|-----------|--------|---------|-------------|
| [metric] | Proposed | X.XX ± X.XX | [X.XX, X.XX] | — | — |
| [metric] | Baseline | X.XX ± X.XX | [X.XX, X.XX] | p = X.XX | d = X.XX |

- Primary findings (with figures/tables, all values with CI/±)
- Secondary findings
- Statistical summaries (effect sizes + CIs + p-values)

### Ablation Study (if ≥ 2 components — 必須)
| Variant | Components | Metric ± SD | Δ from Full | p-value |
|---------|-----------|-------------|-------------|---------|
| Full model | All | X.XX ± X.XX | — | — |
| w/o A | -A | X.XX ± X.XX | -X.X% | p = X.XX |

### Sensitivity Analysis
- Hyperparameter sensitivity (±10%, ±20%)
- Seed sensitivity (5+ seeds, Mean ± SD)

## 4. Discussion
- Interpretation of results
- Comparison with prior work (specific citations with quantitative comparison)
- Each strong claim must reference a specific table/figure number

## 5. Limitations and Future Work (必須 — 200語以上)

### Data Limitations
[合成データのみか実データか。サンプルサイズ。既知のバイアス。ドメイン制約を記述]

### Methodological Limitations
[仮定の妥当性。スケーラビリティ。計算コスト。手法固有の制約を記述]

### Evaluation Limitations
[評価指標の選択根拠と限界。ベースライン数。外部検証の有無を記述]
<!-- 合成データのみの場合、以下を必ず含める: -->
<!-- "External validation with independent real-world datasets is essential to confirm the generalizability of these findings beyond simulated conditions." -->

### Generalizability
[他のドメイン/データセットへの適用可能性。ドメインシフトの影響を記述]

### Future Directions
[具体的な改善策。短期（6ヶ月）と長期（1-2年）のロードマップを記述]

## 6. Conclusion
[1 paragraph summary — calibrated claims only, no "novel"/"state-of-the-art" without evidence]

## References
[Numbered or author-year per journal style; include DOI when available]
[No bulk citations [1-5] — each reference cited individually with specific contribution]
[DOI not available: use minimal metadata (authors, title, year only)]
