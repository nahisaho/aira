---
name: spread1000-cost-estimator
description: |
  Estimate Azure costs based on architecture design. Generate monthly and full research period
  (~180 days) cost estimates and produce cost breakdowns required for SPReAD budget applications.
  Use when estimating Azure costs, planning budgets, or filling in expense sections of the proposal.
---

# Cost Estimator

Calculate costs from the Azure architecture design and generate estimates aligned with SPReAD budget application requirements.

## Use This Skill When

- Azure architecture design is complete and costs need to be estimated
- Creating an expense plan for the SPReAD proposal
- Evaluating cost optimization options (Spot VMs, Reserved Instances, etc.)

## Required Inputs

- `output/{project-name}/phase1-azure-architecture.md` (Azure architecture design)
- Research period (~180 days ≈ ~6 months)
- Estimated monthly usage hours (GPU uptime, etc.)

## Workflow

1. **Parse the architecture design**: Extract resource list, SKUs, and quantities
2. **Retrieve unit prices (MANDATORY — using LLM memory/estimated values is PROHIBITED)**:
   The agent **must retrieve actual latest prices using the steps below** and attach the results to the estimate document.
   If web fetch or API calls fail, the estimate document must state "Price not retrieved" and display a bold warning indicating the value is estimated.

   #### Step 2a: Call the Azure Retail Prices API (recommended, highest priority)
   Retrieve JSON via browser, `fetch_webpage`, or `curl` using the following URL pattern:
   ```
   https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'japaneast' and armSkuName eq 'Standard_ND96asr_v4'
   ```
   - Replace `armSkuName` with the target VM (e.g., `Standard_NC24ads_A100_v4`, `Standard_HB120rs_v3`)
   - Set `armRegionName` to the user-specified region (default: `japaneast`)
   - Use `retailPrice` (USD/hour) from the response JSON as the unit price
   - Distinguish `Consumption` (Pay-as-you-go) and `Reservation` (RI) via the `type` field
   - For Spot pricing: add `and priceType eq 'Consumption' and skuName eq '... Spot'` to `$filter`

   #### Step 2b: Web-fetch Azure official pricing pages (fallback if API fails)
   - [Azure VM Pricing](https://azure.microsoft.com/en-us/pricing/details/virtual-machines/linux/) — GPU VM Pay-as-you-go / Spot / RI pricing
   - [Azure Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/) — Blob / ADLS Gen2
   - [Azure ML Pricing](https://azure.microsoft.com/en-us/pricing/details/machine-learning/) — ML Compute
   - [Azure AI Services Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/) — OpenAI / AI Foundry
   - [Azure Managed Lustre Pricing](https://azure.microsoft.com/en-us/pricing/details/managed-lustre/) — HPC storage
   - [Azure Cosmos DB Pricing](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/) — Graph DB
   - [Azure AI Search Pricing](https://azure.microsoft.com/en-us/pricing/details/search/) — Search service

   #### Step 2c: Price items to retrieve
   - Pay-as-you-go price (USD/hour)
   - Reserved Instance 1-year and 3-year prices
   - Spot VM prices
   - Applicability of Azure for Research / Academic discounts

   #### Step 2d: Record-keeping
   - **Price retrieval date** must be recorded in the estimate document
   - **Price source** (API URL or page URL) must be recorded in the estimate document
   - **Exchange rate**: use the TTM rate as of the retrieval date, and cite the source
3. **Cost calculation**:
   - Monthly cost / 月額コスト (normal usage and peak usage)
   - Total cost / 総額コスト for the full research period / 研究期間 (~180 days)
   - Comparison of cost optimization options
   - Verify that 直接経費 fits within the 予算上限（500万円以下）
   - **算定根拠の記載**: 各リソースの「算定根拠」列に以下を記入する
     - 単価の出典（API URL または公式ページ URL）
     - 使用量の算定方法（例: 平日8h × 20日 = 月160時間）
     - 計算式（例: $3.50/h × 160h = $560/月）
4. **Generate budget plan**: Save as `output/{project-name}/phase2-cost-estimate.md`
   - Reuse `assets/cost-estimate-template.md` when producing the estimate
5. **Validation**: Confirm alignment with the SPReAD budget ceiling (直接経費 ≤ ¥5M)

## Deliverables

- `output/{project-name}/phase2-cost-estimate.md`: Cost estimate document (complete version)

## Quality Gates

- [ ] Unit price sources are documented for all resources
- [ ] Estimates are presented at two levels: monthly and total
- [ ] Cost optimization options (Spot VMs, RI, shutdown schedules) have been evaluated
- [ ] Alignment with SPReAD budget requirements (直接経費 ≤ ¥5M, 間接経費 30%) is confirmed
- [ ] Exchange rate (JPY/USD) is stated
- [ ] 全リソースの「算定根拠」列に単価出典・使用量根拠・計算式が記載されている
- [ ] 「6. 算定根拠の詳細」セクションに価格取得ソース・為替レート根拠・使用量算定根拠が記載されている

## HARD GATE — Price Verification

Before finalizing the estimate, the following checks must be executed. **If any check FAILs, mark the estimate as "Draft (prices unverified)" and warn the user.**

- [ ] Unit prices for all VM SKUs have been retrieved from the Azure Retail Prices API or official pricing pages
- [ ] Retrieval date is recorded in the estimate document
- [ ] Source URLs are recorded in the estimate document
- [ ] Exchange rate source is cited
- [ ] No line item has been calculated solely from LLM memory/estimated values

## Gotchas

- **🚫 Do NOT use historical prices from LLM training data.** The agent must call the Azure Retail Prices API (`prices.azure.com`) via `fetch_webpage` or terminal `curl`, and extract `retailPrice` from the response JSON. If the API call is skipped and estimated values are used, display a bold warning `⚠️ 価格未検証（推定値）` in the estimate document
- The Azure Retail Prices API (`prices.azure.com`) returns the latest unit prices in JSON. Default `armRegionName` to `japaneast` and adjust to the user's preferred region
- Spot VMs offer up to 90% discount but carry preemption risk. Assume training interruption tolerance (checkpointing) is in place
- Azure for Research program discount rates vary by application. List them as reference values, not confirmed amounts
- Do not overlook hidden costs / 隠れコスト (データ転送, log storage, Key Vault operations)

## Validation Loop

1. Generate the cost estimate
2. Check:
   - Are all resources covered?
   - Is the total within the budget ceiling?
   - Have cost optimization opportunities been explored?
3. If any check fails:
   - Consider VM size downgrade or switching to Spot VMs
   - Propose usage optimization (e.g., overnight shutdown schedules)
   - Recalculate
4. Finalize the deliverable only after all gates pass
