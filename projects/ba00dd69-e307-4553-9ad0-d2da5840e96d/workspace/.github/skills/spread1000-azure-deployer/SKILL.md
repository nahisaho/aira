---
name: spread1000-azure-deployer
description: |
  Guide the step-by-step Azure deployment procedure for SPReAD research infrastructure.
  Covers prerequisite checks, OIDC federation setup, Bicep deployment execution,
  post-deployment verification, and rollback procedures.
  Use when you want to deploy Azure resources, set up OIDC authentication,
  execute Bicep deployment, verify deployed resources, or troubleshoot deployment errors.
---

# Azure Deployer

IaC Deployer が生成した Bicep テンプレートと CI/CD パイプラインを使い、Azure 上に研究基盤を実際にデプロイする手順をガイドする。

## Use This Skill When

- 生成済みの Bicep テンプレートを Azure にデプロイしたい
- OIDC フェデレーション認証をセットアップしたい
- デプロイ後のリソース検証を行いたい
- デプロイエラーのトラブルシューティングが必要
- ロールバック手順を知りたい

## Required Inputs

- `output/{project-name}/phase4-iac/` ディレクトリ（Bicep テンプレート一式）
- Azure サブスクリプション ID
- デプロイ先リージョン（例: `japaneast`）
- プロジェクト名（リソース命名に使用）
- 環境名（`dev` / `staging` / `prod`）

## Workflow

### Step 1: 前提条件チェック

デプロイ前に以下を確認し、不足があれば対処手順を案内する。

| # | 前提条件 | 確認コマンド |
|---|---------|------------|
| 1 | Azure CLI がインストール済み（v2.60+） | `az version` |
| 2 | Bicep CLI がインストール済み | `az bicep version` |
| 3 | Azure にログイン済み | `az account show` |
| 4 | 正しいサブスクリプションが選択済み | `az account set --subscription <ID>` |
| 5 | GPU VM クォータが十分 | `az vm list-usage --location <region> -o table` |
| 6 | リソースプロバイダーが登録済み | `az provider list --query "[?registrationState=='Registered']"` |
| 7 | Bicep テンプレートがリント通過 | `az bicep build --file main.bicep` |

### Step 2: リソースグループ作成

```bash
az group create \
  --name rg-${projectName}-${environment} \
  --location ${region} \
  --tags Project=${projectName} Environment=${environment} Program=SPReAD1000
```

### Step 3: What-If 実行（ドライラン）

実際のデプロイ前に変更内容をプレビューする。

```bash
az deployment group what-if \
  --resource-group rg-${projectName}-${environment} \
  --template-file output/{project-name}/phase4-iac/main.bicep \
  --parameters output/{project-name}/phase4-iac/parameters/${environment}.bicepparam
```

- ⏸️ What-If の結果をユーザーに提示し、承認を得てから Step 4 へ進む
- 予期しないリソース削除（Delete）がある場合は警告を出す

### Step 4: Bicep デプロイ実行

```bash
az deployment group create \
  --resource-group rg-${projectName}-${environment} \
  --template-file output/{project-name}/phase4-iac/main.bicep \
  --parameters output/{project-name}/phase4-iac/parameters/${environment}.bicepparam \
  --name deploy-${projectName}-$(date +%Y%m%d-%H%M%S) \
  --verbose
```

- デプロイ名にタイムスタンプを含め、履歴追跡を可能にする
- `--verbose` でリアルタイムの進捗を表示する

### Step 5: OIDC フェデレーション設定（CI/CD 用）

GitHub Actions からのデプロイに OIDC フェデレーションを設定する。
Read `references/oidc-setup-guide.md` when setting up OIDC federation.

1. Microsoft Entra ID でアプリ登録を作成
2. フェデレーテッド資格情報を追加（GitHub リポジトリを指定）
3. サブスクリプションに対する RBAC ロール割り当て
4. GitHub リポジトリに Secrets/Variables を設定

### Step 6: デプロイ後検証

Read `references/post-deploy-verification.md` when verifying deployed resources.

| # | 検証項目 | 確認方法 |
|---|---------|---------|
| 1 | 全リソースがプロビジョニング成功 | `az resource list -g <rg> -o table` |
| 2 | タグが正しく付与されている | `az resource list -g <rg> --query "[].{Name:name, Tags:tags}"` |
| 3 | ネットワーク分離が機能している | Private Endpoint の接続状態確認 |
| 4 | Key Vault が Managed Identity でアクセス可能 | `az keyvault show --name <kv>` |
| 5 | ML ワークスペースが正常起動 | Azure Portal で接続確認 |
| 6 | Compute Cluster のスケール設定 | `az ml compute show` |

### Step 7: デプロイチェックリスト生成

すべての手順の実施結果を `output/{project-name}/phase5-deployment-checklist.md` に保存する。
Reuse `assets/deployment-checklist-template.md` when producing the checklist.

## Deliverables

- `output/{project-name}/phase5-deployment-checklist.md`: デプロイ手順チェックリスト（実施結果付き）

## Quality Gates

- [ ] 前提条件（Azure CLI、Bicep CLI、サブスクリプション、クォータ）がすべて確認済み
- [ ] What-If で予期しないリソース削除がないことを確認済み
- [ ] Bicep デプロイが成功（ProvisioningState = Succeeded）
- [ ] 全リソースにタグ（Project, Environment, Owner, Program）が付与済み
- [ ] Private Endpoint / VNet によるネットワーク分離が機能している
- [ ] Key Vault のシークレットに Managed Identity でアクセス可能
- [ ] OIDC フェデレーションが設定済み（CI/CD パイプライン用）
- [ ] デプロイチェックリストがファイルに保存済み

## Gotchas

- GPU VM（NC/ND シリーズ）はリージョンによってクォータが 0 の場合がある。デプロイ前に必ず `az vm list-usage` でクォータを確認すること
- Azure Machine Learning ワークスペースは依存リソース（Storage, Key Vault, App Insights, ACR）が多い。デプロイ順序のエラーが発生した場合はモジュール間の依存を再確認すること
- `az deployment group create` はデフォルトで増分（Incremental）モード。Complete モードは既存リソースを削除するため、明示的な指定なしに使わないこと
- Bicep パラメータファイル（`.bicepparam`）は Bicep CLI v0.18+ が必要。古い CLI ではエラーになる
- Private Endpoint の DNS 解決には Private DNS Zone が必要。VNet 内からのみアクセス可能になるため、デプロイ後の検証は VNet 内 VM または Bastion 経由で行うこと

## Security Guardrails

- デプロイコマンドに資格情報やシークレットを直接含めない。Key Vault 参照または `@secure()` デコレータを使用すること
- OIDC フェデレーションの設定ではサービスプリンシパルのシークレットを生成しない。Federated Credential のみ使用すること
- RBAC ロール割り当ては最小権限の原則に従う。Contributor ロールはリソースグループスコープに限定すること
- GitHub Secrets にサブスクリプション ID を保存する場合は、リポジトリの Visibility が Private であることを確認すること
- デプロイチェックリストにシークレット値・接続文字列を含めないこと

## Validation Loop

1. 前提条件チェックを実行
2. What-If でデプロイ内容をプレビュー
3. ⏸️ ユーザー承認
4. Bicep デプロイを実行
5. デプロイ後検証:
   - 全リソースが Succeeded 状態か？
   - タグが正しく付与されているか？
   - ネットワーク分離が機能しているか？
   - Managed Identity でのアクセスが可能か？
6. 検証に失敗した場合:
   - Read `references/troubleshooting-guide.md` when diagnosing errors
   - エラーメッセージを解析し、修正手順を案内
   - 必要に応じてロールバック手順を提示
7. 全ゲート通過後にチェックリストをファイナライズ

## Rollback Procedure

デプロイが失敗または問題が発見された場合のロールバック手順:

1. **部分的なロールバック**: 特定リソースのみ再デプロイ
   ```bash
   az deployment group create \
     --resource-group <rg> \
     --template-file output/{project-name}/phase4-iac/modules/<module>.bicep \
     --parameters <params>
   ```

2. **完全なロールバック**: リソースグループごと削除（⚠️ データ消失に注意）
   ```bash
   # ⚠️ 要ユーザー確認 — すべてのリソースとデータが削除される
   az group delete --name rg-${projectName}-${environment} --yes --no-wait
   ```

3. **デプロイ履歴からの復元**: 過去の成功デプロイを再実行
   ```bash
   az deployment group list --resource-group <rg> -o table
   ```

---
> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
