---
name: spread1000-experiment-planner
description: |
  Generates a detailed experiment plan document from an approved research plan.
  Covers hypothesis formulation, variable definition, experimental conditions,
  model architecture selection, hyperparameter search strategy, evaluation metrics,
  statistical analysis plan, data requirements, and a milestone-based timeline.
  Use when you want to create a detailed experiment plan, define experimental conditions,
  design ML experiments, plan evaluation strategy, or prepare a statistical analysis plan.
  詳細な実験計画書を作りたい、実験条件を定義したい、ML実験を設計したい、
  評価戦略を計画したい、統計解析計画を立てたい場合に使用。
---

# Experiment Planner

承認済みの研究プラン（Phase 0）をもとに、再現可能で検証可能な詳細実験計画書を生成する。

## Use This Skill When

- 研究プランが承認済みで、具体的な実験条件・手順を設計したい
- 仮説を明確に定義し、検証方法を計画したい
- ML モデルのアーキテクチャ・ハイパーパラメータ探索戦略を決めたい
- 評価指標・ベースライン・比較条件を体系的に整理したい
- 統計的検定計画（検出力分析・多重比較補正等）を策定したい
- 実験のマイルストーン・成功基準・中止基準を定めたい

## Required Inputs

- `output/{project-name}/phase0-research-plan.md` (approved research plan)
- `output/{project-name}/phase0-research-survey.md` (literature survey — optional)
- Research domain and AI method (from Phase 0)
- Dataset overview (type, size, format, availability)

## Workflow

### Step 1: Extract Research Context

Parse the research plan to extract:

- Research theme and objectives
- AI/ML methods selected in Phase 0
- Dataset characteristics (type, size, format)
- Expected computational requirements
- Key prior work and baselines from literature survey

### Step 2: Formulate Hypotheses

Define testable hypotheses based on the research plan:

1. **主仮説（Primary Hypothesis）**
   - 研究の中心的な問いに対する仮説を1文で記述
   - 帰無仮説 (H₀) と対立仮説 (H₁) を明確に定義

2. **副仮説（Secondary Hypotheses）**
   - 主仮説から派生する2〜3個の検証可能な副仮説
   - 各副仮説に対応する検証実験を紐付け

3. **探索的仮説（Exploratory）**
   - 確認的検証ではなく探索的に調査する項目

### Step 3: Define Variables and Experimental Conditions

1. **独立変数（Independent Variables / Factors）**
   - ML 手法: モデルアーキテクチャ、損失関数、最適化手法
   - データ: 前処理方法、データ拡張、特徴量選択
   - 学習設定: 学習率、バッチサイズ、エポック数

2. **従属変数（Dependent Variables / Responses）**
   - 主要評価指標（Primary Metrics）
   - 副次評価指標（Secondary Metrics）
   - 計算コスト指標（学習時間、GPU メモリ使用量）

3. **制御変数（Controlled Variables）**
   - ランダムシード、データ分割、ハードウェア環境
   - ソフトウェアバージョン（フレームワーク、CUDA）

4. **実験条件マトリクス**
   - 全実験条件の一覧表（因子 × 水準）
   - 全組合せ vs 部分実施（直交表・Latin Hypercube 等）の選択と根拠

### Step 4: Design Model Architecture and Training Strategy

1. **モデル候補**
   - 最低2つの候補モデルとその選定理由
   - ベースラインモデル（単純な手法）の定義

2. **ハイパーパラメータ探索**
   - 探索空間の定義（各パラメータの範囲・分布）
   - 探索手法の選定（Grid / Random / Bayesian / Hyperband）
   - 探索予算（試行回数・計算時間上限）

3. **学習戦略**
   - 学習率スケジューラ
   - 正則化手法（Dropout, Weight Decay, Early Stopping）
   - データ拡張戦略

4. **分散学習計画**（該当時）
   - データ並列 / モデル並列の選択
   - ノード数・GPU 数の構成

### Step 5: Plan Evaluation Strategy

1. **データ分割戦略**
   - Train / Validation / Test の分割比率と根拠
   - 交差検証の種類と fold 数
   - 層化抽出・時系列分割等の考慮事項

2. **評価指標の定義**

   | 指標カテゴリ | 指標名 | 定義 | 成功基準 |
   |-------------|--------|------|---------|
   | 主要指標 | | | |
   | 副次指標 | | | |
   | コスト指標 | | | |

3. **ベースライン比較**
   - 最低1つの単純ベースライン（ランダム、多数決、線形モデル等）
   - 先行研究で報告されている性能値との比較
   - Ablation study の計画（コンポーネントが2つ以上の場合）

4. **統計的検定計画**
   - 検定手法（paired t-test, Wilcoxon, bootstrap CI 等）
   - 有意水準（α = 0.05 がデフォルト）
   - 検出力分析（最小検出可能効果量の算出）
   - 多重比較補正（Bonferroni / FDR）の必要性判定

### Step 6: Define Data Requirements

1. **データ収集・取得計画**
   - データソースとアクセス方法
   - データ量の見積もり（サンプル数、特徴量数）
   - データ品質要件（欠損許容率、ラベル精度）

2. **前処理パイプライン**
   - 各前処理ステップの定義と順序
   - 品質管理チェックポイント

3. **合成データ利用計画**（該当時）
   - 合成データの生成方法と仮定
   - 実データとの既知の乖離点
   - 実データへの移行計画

### Step 7: Create Timeline and Milestones

180日間の研究期間に合わせたマイルストーン計画:

| フェーズ | 期間 | 内容 | マイルストーン | 成功基準 |
|---------|------|------|-------------|---------|
| 環境構築 | Day 1–14 | | | |
| データ準備 | Day 15–30 | | | |
| 予備実験 | Day 31–60 | | | |
| 本実験 | Day 61–120 | | | |
| 分析・執筆 | Day 121–160 | | | |
| 報告・公開 | Day 161–180 | | | |

### Step 8: Define Risk and Contingency

1. **リスク一覧**

   | リスク | 発生確率 | 影響度 | 対策 |
   |-------|---------|--------|------|
   | GPU クォータ不足 | | | |
   | データ品質問題 | | | |
   | モデル収束失敗 | | | |
   | 期間超過 | | | |

2. **中止基準（Stopping Criteria）**
   - 予備実験でベースラインを X% 以上改善できない場合の判断
   - 計算コストが予算の Y% を超過した場合の対応

### Step 9: Generate Experiment Plan Document

すべての設計を統合し、`output/{project-name}/phase0b-experiment-plan.md` に保存する。
テンプレートは `assets/experiment-plan-template.md` を使用。

## Deliverables

- `output/{project-name}/phase0b-experiment-plan.md`: 詳細実験計画書（完全版）
- `output/{project-name}/phase0b-experiment-matrix.md`: 実験条件マトリクス

## Quality Gates

- [ ] 主仮説が帰無仮説・対立仮説の形で明確に定義されている
- [ ] 独立変数・従属変数・制御変数が一覧化されている
- [ ] 実験条件マトリクスが網羅的に記載されている
- [ ] 最低2つのモデル候補とベースラインが定義されている
- [ ] 評価指標に成功基準（数値目標）が設定されている
- [ ] 統計的検定計画（検定手法・有意水準・検出力）が記載されている
- [ ] データ分割戦略と交差検証計画が明記されている
- [ ] 180日間のマイルストーンが具体的に定義されている
- [ ] リスクと中止基準が記載されている
- [ ] 研究プラン（Phase 0）との整合性が取れている

## Gotchas

- 実験条件が多すぎると計算予算を超過する。因子数が4以上の場合は部分実施法を検討すること
- ハイパーパラメータ探索の計算コストを過小評価しないこと。探索予算を事前に算出する
- 合成データのみで検証する場合、結論に「合成条件下での実現可能性の実証」と明記すること
- 予備実験（Day 31–60）の結果次第で本実験の計画を修正する柔軟性を持たせること
- SPReAD の補助上限（500万円以下）に収まる実験規模を設計すること

## Validation Loop

1. 実験計画書を生成
2. チェック:
   - 仮説が検証可能な形で定義されているか
   - 実験条件が研究プランの AI 手法と整合しているか
   - 評価指標がドメインの標準に沿っているか
   - 統計的検定計画が適切か（α, β, 多重比較）
   - 全マイルストーンが180日以内に収まるか
   - コスト見積もりが SPReAD 予算内か
3. 不合格なら該当箇所を修正して再チェック
4. 合格後のみ成果物を確定
