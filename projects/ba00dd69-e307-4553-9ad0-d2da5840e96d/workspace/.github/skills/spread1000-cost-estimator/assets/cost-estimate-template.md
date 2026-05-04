# Azure Cost Estimate

## 1. Estimate Overview

- **Target Research**: <!-- Research theme -->
- **Estimate Date**: <!-- YYYY-MM-DD -->
- **Research Period**: Approx. 180 days (from grant award date to January 6 of the following fiscal year)
- **Exchange Rate**: 1 USD = <!-- XXX --> JPY (at time of estimate)

## 2. Cost Breakdown by Resource

### Compute

| Resource Name | SKU | Qty | Monthly Hours | Unit Price/hr (USD) | Monthly (USD) | Monthly (JPY) | 算定根拠 |
|--------------|-----|-----|---------------|---------------------|--------------|---------------|----------|
| | | | | | | | <!-- 価格取得元URL・取得日・計算式を記載 --> |

### Storage

| Resource Name | SKU | Capacity | Unit Price/GB/mo (USD) | Monthly (USD) | Monthly (JPY) | 算定根拠 |
|--------------|-----|----------|----------------------|--------------|---------------|----------|
| | | | | | | <!-- 価格取得元URL・取得日・計算式を記載 --> |

### Network

| Resource Name | Item | Monthly Transfer | Unit Price (USD) | Monthly (USD) | Monthly (JPY) | 算定根拠 |
|--------------|------|-----------------|-----------------|--------------|---------------|----------|
| | | | | | | <!-- 価格取得元URL・取得日・計算式を記載 --> |

### AI Services

| Resource Name | SKU | Monthly Usage | Unit Price (USD) | Monthly (USD) | Monthly (JPY) | 算定根拠 |
|--------------|-----|--------------|-----------------|--------------|---------------|----------|
| | | | | | | <!-- 価格取得元URL・取得日・計算式を記載 --> |

### Other

| Resource Name | Item | Monthly (USD) | Monthly (JPY) | 算定根拠 |
|--------------|------|--------------|---------------|----------|
| Key Vault | Operations | | | <!-- 想定オペレーション数 × 単価 --> |
| Monitor | Log Ingestion | | | <!-- 想定ログ量 × 単価 --> |
| | | | | |

## 3. Cost Summary

| Period | Amount (USD) | Amount (JPY) |
|--------|-------------|-------------|
| Monthly (normal usage) | | |
| Monthly (peak usage) | | |
| Full research period (approx. 6 months) | | |

## 4. Cost Optimization Options

### Option A: Spot VM Utilization

| Item | Regular Price | Spot Price | Savings | Savings Rate |
|------|--------------|-----------|---------|-------------|
| | | | | |

**Risk**: Possible preemption (interruption). Checkpoint saving required.

### Option B: Reserved Instance

| Item | Pay-as-you-go | RI 1-year | RI 3-year | Max Savings Rate |
|------|--------------|----------|----------|-----------------|
| | | | | |

### Option C: Shutdown Schedule

| Time Period | Status | Savings Effect |
|------------|--------|---------------|
| Weekdays 9:00-21:00 | Running | - |
| Weekdays 21:00-9:00 | Stopped | ~50% reduction |
| Weekends | Stopped | ~28% reduction |

## 5. Budget Alignment

| Item | Budget Cap | Estimated | Difference | Verdict |
|------|-----------|-----------|-----------|---------|
| Direct Costs | 5,000,000 JPY | | | ✅/❌ |
| Indirect Costs (30%) | 1,500,000 JPY | | | ✅/❌ |
| Total Grant | 6,500,000 JPY | | | ✅/❌ |

## 6. 算定根拠の詳細

### 価格取得ソース

| # | リソース | 価格取得方法 | ソースURL | 取得日 |
|---|---------|------------|----------|-------|
| 1 | | ☐ Retail Prices API / ☐ 公式価格ページ | | |
| 2 | | ☐ Retail Prices API / ☐ 公式価格ページ | | |
| 3 | | ☐ Retail Prices API / ☐ 公式価格ページ | | |

### 為替レート根拠

| 項目 | 値 |
|------|----|
| 適用レート | 1 USD = <!-- XXX --> JPY |
| レート種別 | TTM（仲値） |
| 参照元 | <!-- 例: みずほ銀行 TTM --> |
| 参照日 | <!-- YYYY-MM-DD --> |

### 使用量の算定根拠

| リソース | 想定使用量 | 算定の考え方 |
|---------|-----------|-------------|
| GPU Compute | <!-- 例: 月160時間 --> | <!-- 例: 平日8h × 20日 --> |
| Storage | <!-- 例: 500 GB --> | <!-- 例: 学習データ200GB + モデル出力300GB --> |
| Network Transfer | <!-- 例: 100 GB/月 --> | <!-- 例: データセット転送 + モデル同期 --> |

## 7. Notes

- Prices are based on the Azure Pricing Calculator as of the estimate date
- Actual costs may vary depending on usage patterns
- Azure for Research / Academic program discounts require a separate application
- 算定根拠はすべて「6. 算定根拠の詳細」セクションに記録すること
