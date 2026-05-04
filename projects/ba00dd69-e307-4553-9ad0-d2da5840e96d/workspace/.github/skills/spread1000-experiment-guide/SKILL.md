---
name: spread1000-experiment-guide
description: |
  Generate step-by-step experiment procedure documents for running AI research
  on deployed Azure infrastructure. Covers environment setup, data preparation,
  training execution, inference, result evaluation, and checkpoint/reproducibility management.
  Use when you want to create an experiment procedure guide, run experiments on Azure ML,
  execute GPU training jobs, set up experiment environments, or manage reproducibility.
  実験手順書を作りたい、Azure上で実験を実行したい、学習ジョブを走らせたい、
  実験環境をセットアップしたい、再現性を管理したい場合に使用。
---

# Experiment Guide

デプロイ済みの Azure 研究基盤上で AI 実験を実施するための手順書を生成する。

## Use This Skill When

- デプロイ済みの Azure 基盤で実験を始めたい
- Azure ML 上で学習ジョブを投入する手順を知りたい
- データ準備から学習・推論・評価までの一連の手順書が欲しい
- 実験の再現性を確保するための管理方法を知りたい
- チェックポイント・ログ管理の設定手順を知りたい
- 実験結果の記録・分析テンプレートが欲しい

## Required Inputs

- `output/{project-name}/phase1-azure-architecture.md` (Azure architecture design)
- `output/{project-name}/phase0-research-plan.md` (research plan)
- `output/{project-name}/phase5-deployment-checklist.md` (deployment confirmation — optional)
- Research domain and AI method (from Phase 0)
- Dataset overview (type, size, format, location)

## Workflow

### Step 1: Extract Experiment Context

Parse the research plan and architecture design to extract:

- AI method and framework (PyTorch, TensorFlow, JAX, etc.)
- Target compute resource (GPU VM SKU, Compute Cluster name)
- Storage configuration (Blob container, Managed Lustre mount point)
- Dataset details (source, format, expected size)
- ML Workspace name and resource group

### Step 2: Generate Environment Setup Guide

Document the initial environment setup procedure:

1. **Azure ML Workspace 接続**
   - `az ml workspace show` で接続確認
   - CLI / SDK / Studio の接続方法

2. **Compute Target の確認**
   - Compute Cluster のスケール設定確認
   - GPU クォータと可用性の確認
   - Spot VM 利用時のプリエンプション対策

3. **実験環境（Environment）の構築**
   - conda / pip 依存パッケージの定義
   - Docker ベースイメージの選定
   - curated environment の活用（AzureML-pytorch-*, AzureML-tensorflow-* 等）

4. **データストアのマウント設定**
   - Blob Storage のデータストア登録
   - Managed Lustre のマウント手順（該当時）
   - データアクセスの認証方式（Managed Identity）

### Step 3: Generate Data Preparation Procedure

1. **データ取得・アップロード**
   - ローカルデータの Blob Storage アップロード手順
   - 外部データソースからの取得スクリプト
   - データバージョニング（Azure ML Data Assets）

2. **前処理パイプライン**
   - 前処理スクリプトのテンプレート生成
   - Azure ML Pipeline component としての登録
   - データ品質チェック項目

3. **データ分割**
   - Train / Validation / Test 分割比率
   - 層化抽出・時系列分割等の考慮事項

### Step 4: Generate Training Execution Procedure

1. **学習スクリプトの準備**
   - エントリスクリプトのテンプレート（`train.py`）
   - ハイパーパラメータの外部化（`argparse` / `config.yaml`）
   - MLflow / Azure ML 自動ログの設定

2. **学習ジョブの投入**
   ```bash
   az ml job create \
     --file job.yml \
     --resource-group rg-{project-name}-{env} \
     --workspace-name mlw-{project-name}-{env}
   ```

3. **ジョブ定義ファイル（job.yml）のテンプレート**
   ```yaml
   $schema: https://azuremlschemas.azureedge.net/latest/commandJob.schema.json
   command: python train.py --epochs ${{inputs.epochs}} --lr ${{inputs.lr}}
   environment: azureml:AzureML-pytorch-2.1-cuda12@latest
   compute: azureml:gpu-cluster
   inputs:
     epochs: 100
     lr: 0.001
   experiment_name: {project-name}-experiment
   ```

4. **チェックポイント管理**
   - 定期的なモデルチェックポイント保存設定
   - Spot VM プリエンプション時の自動再開（resume from checkpoint）
   - チェックポイントの Blob Storage 保存パス規則

5. **分散学習設定**（該当時）
   - PyTorch DDP / DeepSpeed 設定
   - マルチノード構成時の node_count / process_count_per_instance

### Step 5: Generate Inference & Evaluation Procedure

1. **推論方式の選定**（AI Foundry First ルール適用）
   - AI Foundry モデルカタログのモデルを使用している場合:
     - **Serverless API**: pay-per-token、インフラ管理不要
     - **Managed Online Endpoint**: カスタムモデルのマネージド推論
   - GPU VM での推論は、AI Foundry で提供されていないカスタムモデルの場合のみ

2. **推論ジョブの実行**
   - バッチ推論パイプライン
   - リアルタイム推論エンドポイント（該当時）

2. **評価メトリクスの記録**
   - 分野別の標準評価指標
   - MLflow メトリクスの自動ロギング
   - 評価結果の可視化手順

3. **モデル登録**
   - Azure ML Model Registry への登録
   - モデルバージョニング
   - メタデータ（学習条件、データセットバージョン、性能指標）の付与

### Step 6: Generate Reproducibility & Record-Keeping Guide

1. **再現性の確保**
   - ランダムシード固定の設定
   - 環境定義ファイル（conda.yml / Dockerfile）のバージョン管理
   - データセットバージョンと学習ジョブの紐付け

2. **実験ログの管理**
   - Azure ML Experiments でのラン比較
   - MLflow Tracking URI の設定
   - 実験メタデータの記録テンプレート

3. **研究データマネジメントとの連携**
   - FAIR 原則に基づくメタデータ付与
   - NII Research Data Cloud への登録準備
   - SPReAD 研究成果報告書（Phase 6）への成果データ引用方法

### Step 7: Generate Experiment Procedure Document

すべての手順を統合し、`output/{project-name}/experiment-guide.md` に保存する。
Reuse `assets/experiment-guide-template.md` when producing the document.

## Deliverables

- `output/{project-name}/experiment-guide.md`: 実験手順書（完全版）

## Quality Gates

- [ ] デプロイ済みリソース（Phase 5b）との整合性が取れている
- [ ] 研究プラン（Phase 0）の AI 手法に対応した学習手順が記載されている
- [ ] チェックポイント・再開手順が Spot VM 利用を考慮している
- [ ] データ準備から評価までの一連の流れが網羅されている
- [ ] 再現性確保の手順（シード固定、環境定義、データバージョン）が含まれている
- [ ] Azure ML ジョブ定義ファイル（YAML）が具体的に記載されている
- [ ] 研究データマネジメント（FAIR 原則）との連携が記載されている

## Gotchas

- GPU VM の Spot VM はプリエンプション（中断）される可能性がある。チェックポイント自動保存は必須
- Azure ML の curated environment は頻繁に更新される。最新バージョンを `az ml environment list` で確認すること
- 大規模データセットの場合、Blob Storage → Compute 間のデータ転送にかかる時間を考慮し、Managed Lustre の利用を検討すること
- 分散学習は NCCL バックエンド前提。InfiniBand 対応 VM（ND/HB シリーズ）でないとパフォーマンスが大幅に低下する
