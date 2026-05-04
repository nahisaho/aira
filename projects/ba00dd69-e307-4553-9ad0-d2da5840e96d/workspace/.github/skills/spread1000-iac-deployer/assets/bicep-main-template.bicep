// ============================================================
// SPReAD 1000 研究基盤 - メイン Bicep テンプレート
// ============================================================
// このテンプレートは spread1000-iac-deployer スキルによって
// カスタマイズされるスターティングポイントです。

targetScope = 'resourceGroup'

// ============================================================
// パラメータ
// ============================================================

@description('デプロイ先リージョン')
param location string = resourceGroup().location

@description('プロジェクト名（リソース名のプレフィックス）')
@minLength(3)
@maxLength(15)
param projectName string

@description('環境名')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('タグ: プロジェクトオーナー')
param ownerName string

@description('タグ: 研究課題名')
param researchTopic string = ''

// ============================================================
// 変数
// ============================================================

var prefix = '${projectName}-${environment}'
var tags = {
  Project: projectName
  Environment: environment
  Owner: ownerName
  ResearchTopic: researchTopic
  ManagedBy: 'Bicep'
  Program: 'SPReAD1000'
}

// ============================================================
// モジュール参照
// ============================================================

// --- ネットワーク ---
module network 'modules/network.bicep' = {
  name: 'deploy-network'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

// --- ストレージ ---
module storage 'modules/storage.bicep' = {
  name: 'deploy-storage'
  params: {
    prefix: prefix
    location: location
    tags: tags
    subnetId: network.outputs.defaultSubnetId
  }
}

// --- Key Vault ---
module keyVault 'modules/keyvault.bicep' = {
  name: 'deploy-keyvault'
  params: {
    prefix: prefix
    location: location
    tags: tags
    subnetId: network.outputs.defaultSubnetId
  }
}

// --- Application Insights ---
module monitoring 'modules/monitoring.bicep' = {
  name: 'deploy-monitoring'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

// --- Azure Machine Learning ---
module machineLearning 'modules/machinelearning.bicep' = {
  name: 'deploy-machinelearning'
  params: {
    prefix: prefix
    location: location
    tags: tags
    storageAccountId: storage.outputs.storageAccountId
    keyVaultId: keyVault.outputs.keyVaultId
    appInsightsId: monitoring.outputs.appInsightsId
    subnetId: network.outputs.computeSubnetId
  }
}

// ============================================================
// 出力
// ============================================================

output resourceGroupName string = resourceGroup().name
output mlWorkspaceName string = machineLearning.outputs.workspaceName
output storageAccountName string = storage.outputs.storageAccountName
