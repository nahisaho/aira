---
name: co-scientist-academic-writing
description: |
  Academic paper writing and formatting skill. IMRaD structure, journal-specific formats
  (Nature, Science, ACS, IEEE, Elsevier), citation management, and abstract optimization.
  Use when WRITING research papers, drafting manuscripts, formatting for journal submission,
  structuring IMRaD sections, or optimizing abstracts and titles.
tu_tools:
  - key: crossref
    name: Crossref
---

# Academic Writing

Research paper drafting, journal formatting, and citation management.

## Use This Skill When

- Drafting a new research paper from analysis results.
- Structuring a manuscript in IMRaD format.
- Formatting for a specific journal (Nature, Science, ACS, IEEE, Elsevier).
- Writing or optimizing an abstract.
- Managing citations and references.

## Workflow

1. Determine target journal and format:
   - Identify journal guidelines (word limit, section structure, figure limits)
   - Select appropriate template

2. Draft sections in order:
   - Methods (most objective, draft first)
   - Results (present findings with figure references)
   - Introduction (frame the research question and significance)
   - Discussion (interpret results, limitations, future work)
   - Abstract (summarize after all sections complete)
   - Title (optimize for discoverability)

3. Citation integration:
   - Insert in-text citations in required format
   - Generate reference list
   - Verify all citations are referenced and vice versa

4. Quality review:
   - Check logical flow across sections
   - Verify figures and tables are referenced
   - Ensure claims are supported by results

5. 自己査読（Self-Review）:
   - Claim Calibration — Automated Filter を適用し過大主張を検出・修正
   - `co-scientist-citation-checker` の意味的対応チェックを実施
   - 全ての定量的結果に不確実性指標（CI, SD, p値）が付与されているか確認
   - 問題があれば修正してから最終版を保存

6. 最終品質確認:
   - 全 Quality Gates の通過を確認
   - `results/quality-check.md` に検証結果を保存

## Paper Structure Template (Mandatory Sections)

1. Abstract
2. Introduction
3. Methods / Proposed Approach
4. Results
5. Discussion
6. **Limitations and Future Work** ← 必須セクション
7. Conclusion
8. References

### Limitations and Future Work セクションの要件

**リテラルスケルトン方式**: LLM は以下のテンプレートの `[...]` 部分のみを自由記述する。
見出し構造の省略は禁止。各カテゴリ最低1段落。全体で 200語以上。

```text
## Limitations and Future Work

### Data Limitations
[合成データのみか実データか。サンプルサイズ。既知のバイアス。ドメイン制約を記述]

### Methodological Limitations  
[仮定の妥当性。スケーラビリティ。計算コスト。手法固有の制約を記述]

### Evaluation Limitations
[評価指標の選択根拠と限界。ベースライン数。外部検証の有無を記述]

### Generalizability
[他のドメイン/データセットへの適用可能性。ドメインシフトの影響を記述]

### Future Directions
[具体的な改善策。短期（6ヶ月）と長期（1-2年）のロードマップを記述]
```

**合成データのみの場合の必須文**: 以下の文を Evaluation Limitations に必ず含めること:
> "External validation with independent real-world datasets is essential to confirm the generalizability of these findings beyond simulated conditions."

## Deliverables

- `report.md`: writing progress summary.
- `results/manuscript.md`: complete manuscript draft.
- `results/abstract.md`: optimized abstract.
- `results/references.md`: formatted reference list.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |

- Reuse `assets/imrad-template.md` when writing IMRaD-format papers.

## Hard Quality Gates (MUST PASS — 論文完成前に自動チェック)

### 不確実性チェック (Uncertainty Gate)

論文内の全ての定量的結果に対し、以下のいずれかが付与されていることを検証:
- 95% 信頼区間: "X (95% CI: [a, b])"
- 標準偏差: "X ± σ"
- 四分位範囲: "median X (IQR: a–b)"
- ベイズ的事後分布: "posterior mean X, 95% HDI: [a, b]"

違反パターン:
- ❌ "accuracy was 0.93" → ✅ "accuracy was 0.93 ± 0.02 (5-fold CV)"
- ❌ "AUC of 0.87" → ✅ "AUC of 0.87 (95% CI: 0.83–0.91, n=500)"
- ❌ "RMSE decreased by 15%" → ✅ "RMSE decreased by 15% (p < 0.01, paired t-test)"

このゲートを通過しない論文は完成とみなさない。

### 結果報告の Few-Shot 例（CI/± 必須フォーマット）

Results セクションの数値報告は以下の形式に従うこと:

**良い例（参照すべき書き方）**:
- "The proposed method achieved an accuracy of 0.934 ± 0.018 (95% CI: [0.916, 0.952], 5-fold CV, n=2000)."
- "Compared to the baseline (AUC = 0.812 ± 0.025), our approach yielded a significantly higher AUC of 0.879 ± 0.021 (paired t-test, p = 0.003, Cohen's d = 0.67)."
- "RMSE decreased from 2.45 ± 0.31 to 1.87 ± 0.22 (Wilcoxon signed-rank test, p < 0.01), representing a 23.7% improvement."

**悪い例（禁止される書き方）**:
- ❌ "accuracy was 0.93" → CI/± なし
- ❌ "AUC of 0.87" → 区間なし
- ❌ "our method outperforms the baseline" → 統計検定なし
- ❌ "RMSE decreased by 15%" → 絶対値と不確実性なし

### Limitations チェック

- [ ] **Limitations and Future Work セクションが存在し、200語以上である**
- [ ] **合成データのみの場合: 「実データでの検証が必要」が明記されている**
- [ ] **単一ベンチマークの場合: 一般化可能性の限界が議論されている**

### 外部検証チェック (External Validation Gate)

- [ ] **合成データのみの場合: Discussion AND Limitations に外部検証への言及がある**
- [ ] **External Validation Statement が挿入されている（上記パターン A or B）**

### Reproducibility Table チェック

- [ ] **Methods セクションに Reproducibility Table が存在する**
- [ ] **Random seed(s), Train/Val/Test split が空欄でない**

### Report 品質チェック

- [ ] **report.md が 1,000語以上である**
- [ ] **paper.md と report.md の主要数値が一致している**

## Quality Gates

- [ ] Manuscript follows target journal's structure and guidelines.
- [ ] All claims in Discussion are supported by Results.
- [ ] Every figure and table is referenced in text.
- [ ] Abstract contains objective, methods, key results, and conclusion.
- [ ] Word count is within journal limits.
- [ ] **全ての定量的結果に不確実性指標が付与されている**（95%CI, ±SD, p値のいずれか）
- [ ] **性能比較には統計的有意差検定が含まれている**（paired t-test, Wilcoxon, McNemar等）
- [ ] **合成データの場合、データ生成過程のパラメータと感度分析が記載されている**
- [ ] **合成データのみの場合、Limitations に「External validation with real-world data is needed」が含まれている**
- [ ] **検証戦略が Internal validation のみの場合、Discussion に一般化可能性の限界が議論されている**

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Reproducibility Checklist (Methods セクション完成時に検証)

### 必須項目
- [ ] **全モデルのハイパーパラメータが表形式で記載されている**
  - 学習率、バッチサイズ、エポック数、オプティマイザ
  - モデル固有のパラメータ（層数、隠れ層次元、ドロップアウト率等）
- [ ] **ランダムシードが記載されている**（または「5 シードの平均 ± 標準偏差」形式）
- [ ] **データセット分割が明記されている**（例: "80/10/10 train/val/test split"）
- [ ] **計算環境が記載されている**（GPU型番、メモリ、学習時間）

### 推奨項目
- [ ] コードの利用可能性に関する記述がある
  - 理想: "Code is available at [URL]"
  - 最低限: "Implementation details are provided in the supplementary material"
- [ ] データの利用可能性に関する記述がある
- [ ] 主要な前処理ステップが記載されている

### Reproducibility Table Template (Methods セクションに必ず含めること)

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

このテーブルが Methods セクションに存在しない場合、Quality Gate FAIL とする。
`results/seed-config.md` が experimental-design Phase で生成されている場合、そこからシード値を読み込むこと。

## Experimental Report Template (report.md)

### 必須セクション

1. **実験目的と背景** (200語以上)
   - 研究課題の定義
   - 仮説または検証したい主張

2. **手法・アルゴリズムの概要** (300語以上)
   - 使用した手法の説明
   - 実装の詳細（パラメータ、ライブラリ）

3. **実験設計** (200語以上)
   - データセット/シミュレーション設定
   - 評価指標
   - ベースライン手法

4. **結果と分析** (300語以上)
   - 定量的結果（表・図を含む）
   - 主要な発見の解釈

5. **考察と限界** (200語以上)
   - 結果の解釈
   - 手法の限界
   - 改善の方向性

### 品質基準
- 最低語数: 1,000 語（HARD MINIMUM — 未満の場合は自動再生成対象）
- 定量的結果を含むこと（数値・表・図のいずれか）
- paper.md と内容が整合していること
- paper.md と report.md の主要数値（精度、効果量、p値等）が一致していること（数値整合性チェック）

## Gotchas

- Methods セクションを最初に書くこと。最も客観的で、他セクションの基盤になる
- Discussion で Results に記載されていないデータを引用してはならない
- Abstract は全セクション完成後に書くこと。先に書くと内容との乖離が生じる
- 引用は「著者名+年」形式と「番号」形式でジャーナルごとに異なる。投稿先を確認してから書式を決定
- 図表の説明文（caption）は図を見ただけで内容が分かる自己完結型にすること

## Claim Calibration — Automated Filter

### Phase 1: 禁止語スキャン（論文完成直後に自動実行 — HARD CONSTRAINT）

以下の表現が検出された場合、条件を満たさない限り自動的に代替表現へ置換:

| 検出表現 | 条件チェック | 条件不成立時の自動置換 |
|---------|------------|-------------------|
| "novel" | Methods に先行研究との差分が3点以上明記 | "proposed" |
| "state-of-the-art" | Results に3+の最新SOTAとの定量比較あり | "competitive" |
| "guarantees" | Methods に数学的証明（定理+証明）あり | "is designed to" |
| "significant" (統計文脈外) | 近傍にp値 or 統計検定結果あり | "notable" or "substantial" |
| "outperforms all" | 5+手法との比較 + 有意差検定あり | "outperforms the compared baselines" |
| "superior" | 統計検定で有意差確認済み | "competitive with" |
| "optimal" | 最適性の証明あり | "effective" or "well-performing" |
| "solves the problem" | 全ケースで検証していない場合 | "addresses" / "mitigates" |

**これは HARD CONSTRAINT である**: 条件を満たさない限り、上記の表現は最終版に残してはならない。
Critical Review (Lint) で検出された場合、自動的に Repair Prompt が発行される。

### Phase 2: 主張-証拠整合性チェック

Discussion/Conclusion の各文を以下で分類:
- **Strong claim** → Results に統計的有意差の裏付けが必要
- **Moderate claim** → Results に定量的比較の裏付けが必要
- **Weak claim / Observation** → 定性的な裏付けで可

### 主張レベルの階層

| レベル | 使用条件 | 例 |
|--------|---------|-----|
| Strong claim | 数学的証明 OR 5+データセット+統計検定 | "provably converges" |
| Moderate claim | 3+データセット + 有意差あり | "consistently outperforms baselines" |
| Weak claim | 1-2データセット OR 合成データのみ | "shows promise" / "preliminary results suggest" |
| Observation | 統計検定なし | "we observe that" / "results indicate" |

## External Validation Statement (合成データのみの場合は必須)

合成データのみで実験を行った場合、Discussion の末尾に以下のいずれかの定型文を挿入すること:

**パターン A（実データが利用可能な分野）**:
> "While our synthetic experiments demonstrate the feasibility of the proposed approach, validation on real-world datasets such as [specific datasets] is necessary to establish clinical/practical utility."

**パターン B（実データが利用困難な分野）**:
> "The synthetic nature of our experimental data represents a key limitation. Future work should prioritize collaboration with domain experts to obtain representative real-world datasets for independent validation."

この定型文は Discussion/Conclusion 内 AND Limitations 内の両方に、適切な形で含めること。

## 参考文献生成ルール

参考文献を記載する際は、可能な限り DOI を付与すること。
DOI が不明な場合は巻号・ページ番号を省略し、タイトルと著者のみ記載すること。
不正確なメタデータを推測して記載するより、省略する方が望ましい。

## Validation Loop

1. 原稿を生成
2. チェック:
   - ターゲットジャーナルの構造に合致しているか
   - Discussion の主張が全て Results に根拠があるか
   - 全図表がテキスト中で参照されているか
   - 語数がジャーナル制限以内か
3. 不合格なら該当セクションを修正
4. 合格後のみ投稿準備完了
