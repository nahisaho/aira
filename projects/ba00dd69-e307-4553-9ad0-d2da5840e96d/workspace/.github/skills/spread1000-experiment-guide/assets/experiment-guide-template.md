# 実験手順書

## 基本情報

- プロジェクト名: {{projectName}}
- 研究テーマ: {{researchTheme}}
- AI手法: {{aiMethod}}
- フレームワーク: {{framework}}
- 作成日: {{date}}

---

## 1. 実験環境セットアップ

### 1.1 Azure ML Workspace 接続

| 項目 | 値 |
|------|-----|
| Workspace 名 | mlw-{{projectName}}-{{env}} |
| リソースグループ | rg-{{projectName}}-{{env}} |
| リージョン | {{region}} |
| 接続状態 | ☐ 確認済み |

```bash
az ml workspace show \
  --name mlw-{{projectName}}-{{env}} \
  --resource-group rg-{{projectName}}-{{env}}
```

### 1.2 Compute Target

| リソース | SKU | ノード数 | スケール設定 | Spot VM |
|----------|-----|---------|-------------|---------|
| {{computeName}} | {{vmSku}} | min: {{min}} / max: {{max}} | idle: {{idle}} | ☐ Yes / ☐ No |

### 1.3 実験環境（Environment）

```yaml
# conda.yml
name: {{projectName}}-env
channels:
  - defaults
  - conda-forge
  - pytorch
dependencies:
  - python=3.11
  - pytorch>=2.1
  - torchvision
  - numpy
  - pandas
  - scikit-learn
  - matplotlib
  - pip:
    - mlflow
    - azureml-mlflow
    - azure-ai-ml
```

- ☐ curated environment を使用: `azureml:{{curatedEnv}}@latest`
- ☐ カスタム environment を登録

### 1.4 データストア設定

| データストア | タイプ | コンテナ/パス | 認証 |
|-------------|--------|-------------|------|
| {{datastoreName}} | Blob Storage | {{containerPath}} | Managed Identity |

---

## 2. データ準備

### 2.1 データアップロード

```bash
az storage blob upload-batch \
  --account-name st{{projectName}}{{env}} \
  --destination {{containerName}} \
  --source ./data/ \
  --auth-mode login
```

### 2.2 Azure ML Data Asset 登録

```yaml
# data-asset.yml
$schema: https://azuremlschemas.azureedge.net/latest/data.schema.json
name: {{datasetName}}
version: "1"
type: uri_folder
path: azureml://datastores/{{datastoreName}}/paths/{{dataPath}}
description: {{dataDescription}}
```

### 2.3 前処理

| ステップ | 処理内容 | 入力 | 出力 |
|---------|---------|------|------|
| 1 | {{step1}} | raw data | cleaned data |
| 2 | {{step2}} | cleaned data | features |
| 3 | Train/Val/Test 分割 | features | split datasets |

- 分割比率: Train {{trainRatio}}% / Val {{valRatio}}% / Test {{testRatio}}%

---

## 3. 学習実行

### 3.1 ジョブ定義

```yaml
# job.yml
$schema: https://azuremlschemas.azureedge.net/latest/commandJob.schema.json
experiment_name: {{projectName}}-experiment
display_name: {{experimentDisplayName}}
command: >
  python train.py
  --data_path ${{inputs.data}}
  --epochs ${{inputs.epochs}}
  --batch_size ${{inputs.batch_size}}
  --lr ${{inputs.lr}}
  --output_dir ${{outputs.model}}
environment: azureml:{{curatedEnv}}@latest
compute: azureml:{{computeName}}
inputs:
  data:
    type: uri_folder
    path: azureml:{{datasetName}}@latest
  epochs: {{epochs}}
  batch_size: {{batchSize}}
  lr: {{learningRate}}
outputs:
  model:
    type: uri_folder
resources:
  instance_count: 1
```

### 3.2 ジョブ投入

```bash
az ml job create \
  --file job.yml \
  --resource-group rg-{{projectName}}-{{env}} \
  --workspace-name mlw-{{projectName}}-{{env}}
```

### 3.3 チェックポイント設定

| 項目 | 設定値 |
|------|--------|
| 保存間隔 | {{checkpointInterval}} エポックごと |
| 保存先 | `outputs/checkpoints/` |
| 最大保持数 | {{maxCheckpoints}} |
| Spot VM 再開 | ☐ resume from latest checkpoint 実装済み |

### 3.4 モニタリング

- ☐ MLflow 自動ログ有効化
- ☐ Azure ML Studio でリアルタイム監視
- ☐ GPU 利用率のメトリクス確認

---

## 4. 推論・評価

### 4.1 推論実行

```bash
az ml job create \
  --file inference-job.yml \
  --resource-group rg-{{projectName}}-{{env}} \
  --workspace-name mlw-{{projectName}}-{{env}}
```

### 4.2 評価メトリクス

| メトリクス | 目標値 | 実測値 | 判定 |
|-----------|--------|--------|------|
| {{metric1}} | {{target1}} | | ☐ Pass / ☐ Fail |
| {{metric2}} | {{target2}} | | ☐ Pass / ☐ Fail |
| {{metric3}} | {{target3}} | | ☐ Pass / ☐ Fail |

### 4.3 モデル登録

```bash
az ml model create \
  --name {{modelName}} \
  --version 1 \
  --path azureml://jobs/<job-id>/outputs/model \
  --type custom_model \
  --resource-group rg-{{projectName}}-{{env}} \
  --workspace-name mlw-{{projectName}}-{{env}}
```

---

## 5. 再現性管理

### 5.1 再現性チェックリスト

| # | 項目 | 状態 |
|---|------|------|
| 1 | ランダムシード固定（`seed={{seed}}`） | ☐ |
| 2 | conda.yml / Dockerfile バージョン管理 | ☐ |
| 3 | Data Asset バージョン記録 | ☐ |
| 4 | ハイパーパラメータの MLflow 記録 | ☐ |
| 5 | 学習ジョブ ID の記録 | ☐ |
| 6 | GPU ドライバ / CUDA バージョンの記録 | ☐ |

### 5.2 実験記録

| ラン | ジョブ ID | データバージョン | 主要メトリクス | メモ |
|------|----------|----------------|--------------|------|
| Run 1 | | v1 | | Baseline |
| Run 2 | | v1 | | |
| Run 3 | | v1 | | |

---

## 6. 研究データマネジメント

- ☐ メタデータ付与（NII Research Data Cloud 準拠）
- ☐ データ公開方針の決定（オープン / 条件付き / 非公開）
- ☐ FAIR 原則適合状況の記録
- ☐ 研究成果報告書（Phase 6）への成果データ引用準備

---

> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
