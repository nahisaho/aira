# Phase 2: Azure コスト見積もり

**プロジェクト名**: oscc-fn-ai-detection
**研究テーマ**: AIによる口腔扁平上皮癌内Fusobacterium nucleatum感染の可視化と腫瘍浸潤メカニズムの解明
**作成日**: 2026-05-04
**価格取得日**: 2026-05-04
**リージョン**: East US

---

## 1. 価格取得ソース

| リソース | 取得元 | URL |
|---------|--------|-----|
| NC24ads_A100_v4 | Azure Retail Prices API | `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and armSkuName eq 'Standard_NC24ads_A100_v4'` |
| D16s_v5 | Azure Retail Prices API | `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and armSkuName eq 'Standard_D16s_v5'` |
| DS4_v2 | Azure Retail Prices API | `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and armSkuName eq 'Standard_DS4_v2'` |
| Blob Storage | Azure Retail Prices API | `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Storage' and armRegionName eq 'eastus' and productName eq 'Blob Storage'` |

**為替レート**: 1 USD = 145 JPY（2026年5月時点の概算TTMレート、実際の適用レートは支払時点で変動）

---

## 2. 単価一覧（Azure Retail Prices API取得値）

### 2.1 コンピュート

| SKU | 課金タイプ | 単価 (USD/hr) | 備考 |
|-----|----------|-------------|------|
| Standard_NC24ads_A100_v4 | Pay-as-you-go (Linux) | $3.673 | A100 40GB |
| Standard_NC24ads_A100_v4 | Low Priority (Linux) | $0.735 | PAYG比 80%OFF |
| Standard_NC24ads_A100_v4 | Spot (Linux) | $0.747 | 変動価格 |
| Standard_D16s_v5 | Pay-as-you-go (Linux) | $0.768 | 16vCPU, 64GB |
| Standard_D16s_v5 | Low Priority (Linux) | $0.154 | PAYG比 80%OFF |
| Standard_DS4_v2 | Pay-as-you-go (Linux) | $0.585 | 8vCPU, 28GB |
| Standard_DS4_v2 | Low Priority (Linux) | $0.117 | PAYG比 80%OFF |

### 2.2 ストレージ

| SKU | 階層 | 単価 | 単位 |
|-----|------|------|------|
| Blob Storage LRS | Hot | $0.0208 | USD/GB/月 |
| Blob Storage LRS | Cool | $0.0152 | USD/GB/月 |
| Blob Storage LRS | Archive | $0.002 (概算) | USD/GB/月 |

---

## 3. 使用量算定

### 3.1 GPU Cluster（NC24ads_A100_v4 × 1 node, Low Priority）

| 月 | タスク | 推定使用時間 | 算定根拠 |
|----|--------|------------|---------|
| Month 1 | 環境テスト・小規模試行 | 20h | 初期セットアップ、テスト実行 |
| Month 2 | Transformer学習 | 60h | 学習48h + チューニング12h |
| Month 3 | 大規模推論 | 30h | 300検体推論24h + 検証6h |
| Month 4 | HAN初期学習 | 20h | 初期実験・パラメータ探索 |
| Month 5 | HAN本学習 + SHAP | 40h | 本学習24h + SHAP解析16h |
| Month 6 | 追加検証・再実験 | 30h | 汎用性検証、追加解析 |
| **合計** | | **200h** | |

### 3.2 CPU Cluster（D16s_v5, Low Priority, max 4 nodes）

| 月 | タスク | ノード数 | 推定使用時間（ノード時間） | 算定根拠 |
|----|--------|---------|------------------------|---------|
| Month 1 | PathSeq前処理（前半） | 4 | 400h (100h × 4 nodes) | 300検体の前半150検体 |
| Month 2 | PathSeq前処理（後半） | 4 | 400h (100h × 4 nodes) | 後半150検体 |
| Month 3 | 検証・再処理 | 2 | 50h | 部分的再処理 |
| Month 4 | DESeq2 + WGCNA | 1 | 50h | 差次発現解析 + ネットワーク解析 |
| Month 5 | グラフ構築・追加解析 | 1 | 30h | 異種グラフ構築 |
| Month 6 | 最終解析 | 1 | 20h | 結果統合 |
| **合計** | | | **950 ノード時間** | |

### 3.3 Compute Instance（DS4_v2）

| 使用パターン | 算定根拠 |
|------------|---------|
| 平日8時間/日 × 20日/月 = 160h/月 | 開発・ノートブック作業 |
| 6ヶ月間 = 960h | |

### 3.4 ストレージ

| コンテナ | 容量 | 階層 | 期間 | 備考 |
|---------|------|------|------|------|
| tcga-raw | 15TB (15,360GB) | Cool | 6ヶ月 | Month 1でダウンロード、以降保持 |
| processed | 500GB | Hot | 5ヶ月 | Month 2から使用開始 |
| models | 50GB | Hot | 5ヶ月 | Month 2から使用開始 |
| results | 100GB | Hot→Cool | 6ヶ月 | 30日後にCool移行（平均Hot 3ヶ月, Cool 3ヶ月） |

---

## 4. 月別コスト明細

### 4.1 コンピュート月額

| リソース | SKU | 課金タイプ | 月間使用量 | 単価 | 月額 (USD) | 算定根拠 |
|---------|-----|----------|----------|------|-----------|---------|
| GPU Cluster | NC24ads_A100_v4 | Low Priority | 平均33h/月 | $0.735/h | $24.3 | 200h ÷ 6ヶ月 = 33h/月平均 |
| CPU Cluster | D16s_v5 | Low Priority | 平均158h/月 | $0.154/h | $24.3 | 950h ÷ 6ヶ月 = 158h/月平均 |
| Compute Instance | DS4_v2 | Pay-as-you-go | 160h/月 | $0.585/h | $93.6 | 平日8h × 20日 |
| **コンピュート小計** | | | | | **$142.2/月** | |

> 注: 月平均で算出。実際のコストは月により変動（Month 1-2は高コスト、Month 5-6は低コスト）。

### 4.2 ピーク月コスト（Month 2: 最大使用月）

| リソース | 月間使用量 | 月額 (USD) | 算定根拠 |
|---------|----------|-----------|---------|
| GPU Cluster (LP) | 60h | $44.1 | Transformer学習48h + チューニング12h |
| CPU Cluster (LP) | 400h | $61.6 | PathSeq後半150検体 × 4 nodes |
| Compute Instance | 160h | $93.6 | 通常開発作業 |
| **ピーク月コンピュート** | | **$199.3** | |

### 4.3 ストレージ月額

| コンテナ | 容量 | 階層 | 月額 (USD) | 算定根拠 |
|---------|------|------|-----------|---------|
| tcga-raw | 15,360GB | Cool | $233.5 | 15,360GB × $0.0152/GB/月 |
| processed | 500GB | Hot | $10.4 | 500GB × $0.0208/GB/月 |
| models | 50GB | Hot | $1.0 | 50GB × $0.0208/GB/月 |
| results | 100GB | Hot | $2.1 | 100GB × $0.0208/GB/月 |
| **ストレージ小計** | | | **$247.0/月** | |

### 4.4 その他月額

| リソース | 月額 (USD) | 算定根拠 |
|---------|-----------|---------|
| Key Vault（シークレット操作） | $5 | 少量のシークレット管理 |
| Private Endpoint × 2 | $14.6 | $7.3/endpoint/月 × 2 |
| Azure Monitor / Log Analytics | $20 | 基本的なログ・メトリクス収集 |
| データ転送（送信） | $10 | 少量の結果ダウンロード |
| **その他小計** | **$49.6/月** | |

---

## 5. 総コスト（180日 / 6ヶ月）

### 5.1 推奨構成（Low Priority VM活用）

| カテゴリ | 6ヶ月総額 (USD) | 6ヶ月総額 (JPY) | 算定根拠 |
|---------|---------------|---------------|---------|
| GPU Cluster (LP) | $147.0 | ¥21,315 | 200h × $0.735/h |
| CPU Cluster (LP) | $146.3 | ¥21,214 | 950h × $0.154/h |
| Compute Instance | $561.6 | ¥81,432 | 960h × $0.585/h |
| ストレージ（Cool 15TB × 6ヶ月） | $1,401.0 | ¥203,145 | 15,360GB × $0.0152 × 6ヶ月 |
| ストレージ（Hot 650GB × 5ヶ月） | $67.6 | ¥9,802 | 650GB × $0.0208 × 5ヶ月 |
| Key Vault | $30.0 | ¥4,350 | $5 × 6ヶ月 |
| Private Endpoint | $87.6 | ¥12,702 | $14.6 × 6ヶ月 |
| Monitor / Log Analytics | $120.0 | ¥17,400 | $20 × 6ヶ月 |
| データ転送 | $60.0 | ¥8,700 | $10 × 6ヶ月 |
| **Azure 利用料合計** | **$2,621.1** | **¥380,060** | |

### 5.2 Pay-as-you-go 比較（参考）

| カテゴリ | Low Priority (USD) | Pay-as-you-go (USD) | 削減率 |
|---------|-------------------|-------------------|--------|
| GPU Cluster | $147.0 | $734.6 (200h × $3.673) | 80% |
| CPU Cluster | $146.3 | $729.6 (950h × $0.768) | 80% |
| Compute Instance | $561.6 | $561.6 (変更なし) | 0% |
| **コンピュート合計** | **$854.9** | **$2,025.8** | **58%** |

### 5.3 コスト最適化オプション評価

| オプション | 削減額 (USD) | リスク | 推奨 |
|-----------|-------------|--------|------|
| GPU Cluster: Low Priority | -$587.6 vs PAYG | プリエンプション（チェックポイントで対策済み） | ✅ 採用 |
| CPU Cluster: Low Priority | -$583.3 vs PAYG | プリエンプション（再開可能） | ✅ 採用 |
| Compute Instance: 自動シャットダウン | 既に平日8h想定 | なし | ✅ 採用済み |
| ストレージ: Cool Tier for BAM | -$128/月 vs Hot | データ取得時レイテンシ（許容範囲） | ✅ 採用 |
| ストレージ: ライフサイクル管理 | 研究後Archive化で大幅削減 | データ再アクセス時にRehydrate必要 | ✅ 採用 |

---

## 6. SPReAD 予算整合性

### 6.1 直接経費の内訳

| 費目 | 金額 (JPY) | 備考 |
|------|-----------|------|
| **Azure 利用料（計算資源・ストレージ）** | **¥380,060** | 上記見積もり |
| 論文投稿料（英文校正含む） | ¥300,000 | 国際誌1本想定 |
| 学会参加費・旅費 | ¥200,000 | 国内学会1回 |
| 消耗品・書籍 | ¥100,000 | 参考書籍、ソフトウェアライセンス |
| データ取得・利用料 | ¥50,000 | TCGA以外の追加データ |
| 予備費 | ¥169,940 | 予期しないAzure利用増加等への備え |
| **直接経費合計** | **¥1,200,000** | |

### 6.2 間接経費

| 項目 | 金額 (JPY) | 算定根拠 |
|------|-----------|---------|
| 間接経費 | ¥360,000 | 直接経費の30% |

### 6.3 総額

| 項目 | 金額 (JPY) |
|------|-----------|
| 直接経費 | ¥1,200,000 |
| 間接経費 | ¥360,000 |
| **総額** | **¥1,560,000** |

✅ **SPReAD 予算上限（直接経費500万円以下）の範囲内: ¥1,200,000 < ¥5,000,000**

> 本研究はコンピュータサイエンス中心の解析研究であり、大規模な試薬・機器購入が不要なため、直接経費は比較的コンパクトに収まる。余剰予算は追加の計算資源確保や追加データセットの取得に柔軟に対応可能。

---

## 7. 算定根拠の詳細

### 7.1 価格取得ソース

- **Azure Retail Prices REST API**: `https://prices.azure.com/api/retail/prices`
- **取得日時**: 2026-05-04
- **レスポンスフィールド**: `retailPrice`（USD/hour）を使用
- **リージョン**: `eastus`（armRegionName）

### 7.2 為替レート根拠

- **適用レート**: 1 USD = 145 JPY
- **根拠**: 2026年5月時点の概算TTMレート
- **注意**: 実際の支払いはAzure請求時の為替レートが適用されるため、変動あり

### 7.3 使用量算定根拠

- **GPU使用時間**: Phase 0研究計画書の計算資源見積もり（GPU 84-144時間）に基づき、検証・再実験を含めて200時間と算定
- **CPU使用時間**: PathSeq前処理200時間（4ノード並列 = 800ノード時間）+ DESeq2/WGCNA 50時間 + その他100時間 = 950ノード時間
- **Compute Instance**: 研究者1名の開発作業。平日8時間 × 月20日 = 月160時間
- **ストレージ**: TCGA OSCC（Head and Neck SCCの一部）のBAMデータ約300検体。1検体平均50GBで計15TB

---

> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
