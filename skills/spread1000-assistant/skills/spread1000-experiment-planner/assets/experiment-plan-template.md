# 詳細実験計画書

## 基本情報

- プロジェクト名: {{projectName}}
- 研究テーマ: {{researchTheme}}
- AI 手法: {{aiMethod}}
- フレームワーク: {{framework}}
- 研究期間: {{startDate}} 〜 {{endDate}}（180日間）
- 作成日: {{date}}

---

## 1. 研究仮説

### 1.1 主仮説（Primary Hypothesis）

- **H₀（帰無仮説）**: {{nullHypothesis}}
- **H₁（対立仮説）**: {{alternativeHypothesis}}
- **検証方法**: {{verificationMethod}}

### 1.2 副仮説（Secondary Hypotheses）

| # | 副仮説 | 対応する実験 | 検証指標 |
|---|--------|-------------|---------|
| S1 | {{subHypothesis1}} | Exp-{{n}} | {{metric}} |
| S2 | {{subHypothesis2}} | Exp-{{n}} | {{metric}} |
| S3 | {{subHypothesis3}} | Exp-{{n}} | {{metric}} |

### 1.3 探索的仮説（Exploratory）

- {{exploratoryHypothesis1}}
- {{exploratoryHypothesis2}}

---

## 2. 変数定義

### 2.1 独立変数（Factors）

| # | 因子名 | カテゴリ | 水準 | 備考 |
|---|--------|---------|------|------|
| F1 | モデルアーキテクチャ | ML手法 | {{levels}} | |
| F2 | 学習率 | 学習設定 | {{levels}} | |
| F3 | {{factor3}} | {{category}} | {{levels}} | |
| F4 | {{factor4}} | {{category}} | {{levels}} | |

### 2.2 従属変数（Responses）

| # | 指標名 | カテゴリ | 定義 | 成功基準 |
|---|--------|---------|------|---------|
| R1 | {{primaryMetric}} | 主要指標 | {{definition}} | {{criterion}} |
| R2 | {{secondaryMetric}} | 副次指標 | {{definition}} | {{criterion}} |
| R3 | 学習時間 | コスト指標 | Wall-clock time | {{criterion}} |
| R4 | GPU メモリ使用量 | コスト指標 | Peak VRAM (GB) | {{criterion}} |

### 2.3 制御変数

| 項目 | 設定値 | 固定方法 |
|------|--------|---------|
| ランダムシード | {{seed}} | numpy, random, torch 各ライブラリで個別設定 |
| データ分割 | {{splitRatio}} | 層化抽出、シード固定 |
| ハードウェア | {{hardware}} | Azure VM SKU 固定 |
| CUDA バージョン | {{cudaVersion}} | Docker イメージで固定 |
| フレームワーク | {{framework}} v{{version}} | conda.yml でバージョン固定 |

---

## 3. 実験条件マトリクス

### 3.1 設計方針

- 設計タイプ: {{designType}}（Full Factorial / Fractional Factorial / Latin Hypercube / 逐次探索）
- 選定理由: {{designRationale}}
- 総実験数: {{totalExperiments}}
- 各条件の反復数: {{repetitions}}

### 3.2 実験一覧

| Exp ID | F1: モデル | F2: 学習率 | F3: {{factor3}} | F4: {{factor4}} | 目的 |
|--------|-----------|-----------|----------------|----------------|------|
| Exp-01 | Baseline | | | | ベースライン |
| Exp-02 | | | | | |
| Exp-03 | | | | | |
| Exp-04 | | | | | Ablation |
| ... | | | | | |

---

## 4. モデル設計

### 4.1 候補モデル

| # | モデル名 | 概要 | 選定理由 | パラメータ数（概算） |
|---|---------|------|---------|-------------------|
| M1 | {{baseline}} | | ベースライン（単純な手法） | |
| M2 | {{proposed1}} | | 提案手法 | |
| M3 | {{proposed2}} | | 比較手法 | |

### 4.2 ハイパーパラメータ探索

| パラメータ | 探索範囲 | 分布 | 備考 |
|-----------|---------|------|------|
| 学習率 | [{{min}}, {{max}}] | Log-uniform | |
| バッチサイズ | {{options}} | Categorical | |
| {{param3}} | [{{min}}, {{max}}] | {{dist}} | |

- 探索手法: {{searchMethod}}（Grid / Random / Bayesian / Hyperband）
- 探索予算: {{budget}} 試行 × {{timePerTrial}} ≈ {{totalSearchTime}}
- 最適化指標: {{optimizeMetric}}

### 4.3 学習戦略

- 学習率スケジューラ: {{scheduler}}
- 正則化: {{regularization}}
- Early Stopping: patience = {{patience}} epochs, monitor = {{monitorMetric}}
- データ拡張: {{augmentation}}

---

## 5. 評価戦略

### 5.1 データ分割

- Train: {{trainPct}}% / Validation: {{valPct}}% / Test: {{testPct}}%
- 交差検証: {{cvType}}（{{kFold}}-fold）
- 分割方法: {{splitMethod}}（層化抽出 / 時系列 / グループ分割）

### 5.2 ベースライン比較

| # | ベースライン | 期待性能 | ソース |
|---|------------|---------|--------|
| B1 | {{simpleBaseline}} | {{performance}} | 本実験で実装 |
| B2 | {{literatureBaseline}} | {{performance}} | {{citation}} |

### 5.3 Ablation Study 計画

| # | 除外コンポーネント | 期待される影響 | 目的 |
|---|-------------------|--------------|------|
| A1 | {{component1}} | {{expectedEffect}} | 各要素の寄与定量化 |
| A2 | {{component2}} | {{expectedEffect}} | |

### 5.4 統計的検定計画

| 項目 | 設定 |
|------|------|
| 検定手法 | {{testMethod}}（paired t-test / Wilcoxon / bootstrap CI） |
| 有意水準 (α) | {{alpha}} |
| 検出力 (1-β) | {{power}} |
| 最小検出可能効果量 | {{minEffectSize}} |
| 多重比較補正 | {{correction}}（Bonferroni / FDR / N/A） |
| 反復数 | {{repetitions}}（異なるシードで） |

---

## 6. データ要件

### 6.1 データ概要

| 項目 | 値 |
|------|-----|
| データソース | {{dataSource}} |
| サンプル数 | {{sampleSize}} |
| 特徴量数 | {{featureCount}} |
| データ形式 | {{dataFormat}} |
| データサイズ | {{dataSize}} |
| ラベル有無 | {{labelInfo}} |

### 6.2 前処理パイプライン

| ステップ | 処理内容 | 入力 | 出力 | 品質チェック |
|---------|---------|------|------|------------|
| 1 | {{step1}} | Raw | Cleaned | {{check1}} |
| 2 | {{step2}} | Cleaned | Features | {{check2}} |
| 3 | Train/Val/Test 分割 | Features | Split data | シード固定確認 |

### 6.3 合成データ利用計画（該当時）

- 生成方法: {{generationMethod}}
- 仮定: {{assumptions}}
- 実データとの既知の乖離点: {{knownGaps}}
- 実データへの移行計画: {{migrationPlan}}

---

## 7. 実験スケジュール（180日間）

| フェーズ | 期間 | 内容 | マイルストーン | 成功基準 |
|---------|------|------|-------------|---------|
| 環境構築 | Day 1–14 | Azure 環境構築、データ取得 | 環境Ready | 全リソースプロビジョニング完了 |
| データ準備 | Day 15–30 | 前処理、EDA、データ分割 | データReady | 品質チェック全項目パス |
| 予備実験 | Day 31–60 | ベースライン実装、初期検証 | ベースライン確立 | ベースライン性能値の確定 |
| 本実験 | Day 61–120 | 提案手法実装、HP探索、本実験 | 主要結果取得 | 主仮説の検証完了 |
| 分析・執筆 | Day 121–160 | 統計的検定、論文執筆 | 論文ドラフト完成 | 全検定実施、図表完成 |
| 報告・公開 | Day 161–180 | 最終報告書、データ公開準備 | 最終報告書提出 | SPReAD 成果報告完了 |

### Go/No-Go 判定ポイント

- **Day 60（予備実験完了時）**: ベースラインが確立できない場合 → 手法の再検討
- **Day 90（本実験中間）**: 提案手法がベースラインを {{minImprovement}}% 以上改善できない場合 → 方針転換を検討

---

## 8. リスクと対策

| # | リスク | 発生確率 | 影響度 | 対策 |
|---|-------|---------|--------|------|
| R1 | GPU クォータ不足 | {{prob}} | {{impact}} | 事前にクォータ申請 / Spot VM 活用 |
| R2 | データ品質問題 | {{prob}} | {{impact}} | EDA 段階での品質チェック / 合成データ併用 |
| R3 | モデル収束失敗 | {{prob}} | {{impact}} | 学習率調整 / アーキテクチャ変更 |
| R4 | 期間超過 | {{prob}} | {{impact}} | 予備実験 Go/No-Go で早期判断 |
| R5 | 予算超過 | {{prob}} | {{impact}} | Spot VM 活用 / 実験条件の絞り込み |

### 中止基準（Stopping Criteria）

1. 予備実験（Day 31–60）でベースラインの実装・評価が完了しない場合 → 研究計画の根本的見直し
2. 本実験（Day 61–90）で提案手法がベースラインを統計的有意に改善できない場合 → 手法の変更または研究方向の転換
3. 計算コストが予算の 80% を Day 90 までに消費した場合 → 残り実験の優先順位付けと縮小

---

## 9. 再現性確保

| # | 項目 | 方法 |
|---|------|------|
| 1 | ランダムシード | numpy, random, torch 各ライブラリで seed={{seed}} を設定 |
| 2 | 環境定義 | conda.yml + Dockerfile でバージョン完全固定 |
| 3 | データバージョン | Azure ML Data Assets でバージョン管理 |
| 4 | コードバージョン | Git コミットハッシュを MLflow に記録 |
| 5 | 実験パラメータ | MLflow / Azure ML Experiments で自動ログ |

---

> **⚠️ 免責事項**: 本文書は AI（SPReAD-1000 Assistant）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
