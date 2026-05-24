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

6. 検証戦略の設計:
   - **内部検証**: k-fold CV, hold-out test set (最低20%)
   - **外部検証計画**: 独立データセットの特定（公開データ or 将来取得予定）
   - **ドメインシフト評価**: 学習データと異なる条件での性能評価計画
   - **消融実験（Ablation study）**: 各コンポーネントの寄与度検証

7. 合成データ使用時の制約文書化:
   - データ生成の仮定を明示（分布、ノイズモデル、相関構造）
   - 実データとの乖離可能性を列挙
   - 「合成→実」転移のための検証計画を記載

## Deliverables

- `report.md`: design summary and rationale.
- `results/design-matrix.csv`: experimental design matrix.
- `results/power-analysis.md`: sample size and power calculations.
- `results/protocol.md`: formal experimental protocol.
- `results/seed-config.md`: reproducibility configuration (seeds, splits, hardware).
- `results/validation-plan.md`: validation strategy with internal/external plans.
- `results/ablation-variants.md`: ablation experiment variant list (when applicable).

## Validation Strategy Template (必須)

実験設計時に以下の検証戦略を明示すること:

### Tier 1: 内部検証（必須）
- k-fold Cross-Validation (k ≥ 5) OR Hold-out test set (≥ 20%)
- Bootstrap 信頼区間 (n ≥ 1000)
- ランダムシード変動テスト (5+ シード)

### Tier 2: ロバスト性検証（推奨）
- Ablation study（提案手法の各コンポーネントの寄与度）
- ハイパーパラメータ感度分析
- データサイズに対する学習曲線
- ノイズ耐性テスト

### Tier 3: 外部検証（合成データのみの場合は必須記述）
- 利用可能な独立データセットの特定
- ドメインシフトシナリオの検討
- 実データとの乖離に関する定性的議論

合成データのみの実験では:
- Tier 1 + Tier 2 の全項目が必須
- Tier 3 は Limitations セクションでの議論が必須
- "validates the approach" の代わりに "demonstrates feasibility under simulated conditions" を使用

## Ablation Study Design (提案手法のコンポーネント数 ≥ 2 の場合は必須)

### Variant 自動生成（Phase 2 で実行）

提案手法のコンポーネント数 ≥ 2 の場合、以下の手順で ablation variant を自動生成し
`results/ablation-variants.md` に保存すること:

1. 提案手法のコンポーネント一覧を列挙
2. Leave-One-Out variant を自動生成（各コンポーネントを1つずつ除外）
3. Baseline variant を追加（全コンポーネント除外）
4. 各 variant の期待される実行コストを見積もる

```text
# Ablation Variants

## Components
1. Component A: [description]
2. Component B: [description]
3. Component C: [description]

## Variants to Execute
| Variant | A | B | C | Estimated Cost |
|---------|---|---|---|---------------|
| Full model | ✓ | ✓ | ✓ | baseline |
| w/o A | ✗ | ✓ | ✓ | ~same |
| w/o B | ✓ | ✗ | ✓ | ~same |
| w/o C | ✓ | ✓ | ✗ | ~same |
| Baseline | ✗ | ✗ | ✗ | lower |
```

Phase 3 (data-analysis) はこのファイルを読み込み、全 variant を実行する。
全 variant の実行が困難な場合は、sensitivity analysis を最低ラインとして必須化する。

### 設計パターン

1. **Leave-One-Out Ablation**: 
   - 各コンポーネントを1つずつ除外し、性能変化を計測
   - 全 N コンポーネントに対し N 回の実験が必要

2. **Incremental Addition**:
   - ベースラインから1つずつコンポーネントを追加
   - 各追加による性能向上を定量化

3. **Ablation Table の必須要素**:
   | Variant | Component A | Component B | Component C | Performance |
   |---------|:-----------:|:-----------:|:-----------:|:-----------:|
   | Full model | ✓ | ✓ | ✓ | X.XX ± σ |
   | w/o A | ✗ | ✓ | ✓ | X.XX ± σ |
   | w/o B | ✓ | ✗ | ✓ | X.XX ± σ |
   | w/o C | ✓ | ✓ | ✗ | X.XX ± σ |
   | Baseline | ✗ | ✗ | ✗ | X.XX ± σ |

## Seed Propagation (必須)

実験設計時に以下の再現性情報を `results/seed-config.md` に保存し、後続フェーズに伝播すること:

```text
# Seed Configuration

## Random Seeds
seeds: [42, 123, 456, 789, 1024]

## Data Split
train_ratio: 0.8
val_ratio: 0.1
test_ratio: 0.1

## Hardware Target
device: [e.g., GPU / CPU]
framework: [e.g., PyTorch 2.1]

## Key Hyperparameters
| Parameter | Value | Search Range |
|-----------|-------|-------------|
| learning_rate | 1e-3 | [1e-4, 1e-2] |
| batch_size | 32 | [16, 64] |
| [add more] | ... | ... |
```

このファイルは Phase 3 (data-analysis) と Phase 4 (academic-writing) で読み込まれ、
Methods セクションの Reproducibility Table に反映される。

## Validation Plan (必須 — `results/validation-plan.md` に保存)

実験設計時に以下の検証計画を策定し保存すること。
空欄のまま Phase 3 に進行した場合、Review 2 で FAIL となる。

```text
# Validation Plan

## Internal Validation (必須)
| Method | Configuration | Status |
|--------|--------------|--------|
| k-fold CV | k=5, stratified | Planned |
| Bootstrap CI | n=1000 resamples | Planned |
| Multi-seed | 5 seeds (see seed-config.md) | Planned |

## Robustness Validation (推奨)
| Method | Configuration | Status |
|--------|--------------|--------|
| Ablation study | See ablation-variants.md | Planned/N.A. |
| Sensitivity analysis | ±10% parameter perturbation | Planned |
| Learning curve | 20%, 40%, 60%, 80%, 100% data | Planned |

## External Validation (合成データのみの場合は計画必須)
| Dataset | Domain | Availability | Status |
|---------|--------|-------------|--------|
| [dataset name] | [domain] | [public/private/future] | Planned |
| — | — | — | N.A. (synthetic only — note in Limitations) |
```

**重要**: External Validation の行が全て N.A. の場合:
- Limitations に「External validation with real-world data is needed」を必須記載
- Discussion に外部検証の必要性を議論する段落を追加

## Sensitivity Analysis (Ablation 不可時の最低ライン)

完全な ablation study が実行困難な場合（コンポーネントの分離が不可能、計算コストが過大等）、
以下の sensitivity analysis を最低ラインとして必須化する:

1. **パラメータ感度**: 主要ハイパーパラメータを ±10%, ±20% 変動させた結果
2. **データ感度**: データサイズを 20%, 40%, 60%, 80%, 100% で変化させた学習曲線
3. **シード感度**: 5+シードでの結果の分散

`results/sensitivity-analysis.md` に結果を保存すること。
ablation も sensitivity analysis も実施しない場合、Review で Critical FAIL となる。

## Quality Gates

- [ ] Design type matches the research question and constraints.
- [ ] Power analysis confirms adequate sample size.
- [ ] Confounding variables are identified and controlled.
- [ ] Randomization strategy is documented.
- [ ] Protocol is detailed enough for independent replication.
- [ ] **提案手法が2+コンポーネントを含む場合、Ablation Table が存在する**
- [ ] **Ablation の各行に不確実性指標 (±σ) が付与されている**
- [ ] **コンポーネントの寄与が Discussion で議論されている**
- [ ] **検証戦略 (Tier 1-3) が明示されている**
- [ ] **`results/seed-config.md` が生成されている**（シード値、分割比率が空欄でない）
- [ ] **`results/validation-plan.md` が生成されている**（Internal Validation が最低1行）
- [ ] **合成データのみの場合: External Validation 行に「Limitations に記載」の注記がある**
- [ ] **2+コンポーネント: `results/ablation-variants.md` が生成されている OR sensitivity analysis が計画されている**

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- 検出力分析でα=0.05, power=0.80 をデフォルトとするが、ユーザーの分野慣習を確認すること。臨床試験ではα=0.025（片側）が標準
- 完全実施要因計画は因子数が多いと実験数が爆発する。因子4つ以上では部分実施要因を提案すること
- 対照群なしの実験計画を提案してはならない。最低限、陽性対照または陰性対照を含めること
- サンプルサイズが小さすぎる場合は、効果量の再検討を促すこと（「データが足りない」ではなく「検出したい差を明確に」）
- **提案手法が3つ以上のコンポーネントを含む場合、ablation study を必須とすること**。各コンポーネントを1つずつ除外した実験で、全コンポーネントの寄与を検証する
- **「統合」が目的化していないか確認すること**。統合することで性能が向上する実験的証拠がなければ、最も性能の高い単一手法を推奨する
- `results/seed-config.md` のシード値は Phase 3, 4 で自動参照される。ここで定義しないと Phase 4 の Reproducibility Table が空欄になり Review FAIL となる
- 完全な ablation が困難でも sensitivity analysis は必須。何も実施しない場合は Critical FAIL
- Validation Plan の External Validation が全て N.A. でも FAIL にはならないが、Limitations への記載が必須となる

## Validation Loop

1. 実験計画を生成
2. チェック:
   - 検出力が 0.80 以上か（または分野慣習に合致するか）
   - 対照群が設定されているか
   - 交絡変数への対処が記載されているか
   - ランダム化戦略が明示されているか
3. 不合格なら設計を修正
4. ユーザー承認後のみプロトコル確定 ⏸️
