# Phase 0: AI研究計画書

**プロジェクト名**: oscc-fn-ai-detection
**研究テーマ**: AIによる口腔扁平上皮癌内Fusobacterium nucleatum感染の可視化と腫瘍浸潤メカニズムの解明
**作成日**: 2026-05-04

---

## 1. 研究背景と課題

### 1.1 口腔扁平上皮癌（OSCC）とFusobacterium nucleatum（Fn）

口腔扁平上皮癌（Oral Squamous Cell Carcinoma; OSCC）は口腔癌の約90%を占める最も頻度の高い悪性腫瘍である。歯周病原因菌であるFusobacterium nucleatum（Fn）は、腫瘍組織内に高頻度で検出され、以下のメカニズムを通じて腫瘍悪性度と正の相関を示すことが報告されている：

- **免疫回避**: FadAアドヘシン・Fap2タンパク質を介した免疫抑制性マクロファージの誘導、骨髄由来抑制細胞（MDSC）の蓄積促進
- **腫瘍浸潤促進**: Wnt/β-catenin、NF-κB、TGF-β経路の活性化を介した上皮間葉転換（EMT）の誘導
- **代謝リプログラミング**: アミノ酸代謝の撹乱、GLUT1経路を介した腫瘍進行促進
- **治療抵抗性**: オートファジー誘導・フェロトーシス阻害による化学療法・免疫療法への抵抗性付与

### 1.2 既存手法の限界

The Cancer Microbiome Atlas（TCMA）をはじめとする既存のアプローチには以下の限界がある：

1. **属レベル解析にとどまる**: ホストシーケンシングデータ（WGS/RNA-seq）から微生物を同定するため、ショートリードでは種特異的領域のカバレッジが不十分
2. **微量シグナルの検出困難**: 腫瘍組織中の微生物リードはヒトリードに対して極めて微量（全リードの0.01-0.1%程度）であり、従来のアライメントベースの手法では感度が不足
3. **機能的解釈の欠如**: 微生物の存在同定にとどまり、宿主遺伝子発現への影響や因果的分子機構の解析が統合されていない
4. **コンタミネーションの識別困難**: 低バイオマス検体における試薬・環境由来のコンタミネーション判別が不十分

### 1.3 本研究の着眼点

本研究では、RNA-seqデータに埋もれた微量なFn特異的配列をAIにより高精度に抽出する独自の解析パイプラインを構築し、腫瘍内に潜む"見えない感染"を可視化する。さらに、感染と宿主遺伝子発現を統合的に解析することで、Fnが駆動する腫瘍浸潤の因果的分子機構を明らかにする。

---

## 2. 研究目的

1. **Fn特異的配列のAI高精度抽出**: RNA-seqデータからFn由来の微量リードを深層学習モデルにより高感度・高特異度で検出するパイプラインを開発する
2. **腫瘍内Fn感染の可視化**: 検出されたFnシグナルを定量化し、腫瘍組織内の感染パターンをマッピングする
3. **宿主-微生物統合解析**: GNN（Graph Neural Network）を用いて、Fn感染と宿主遺伝子発現ネットワークの統合モデルを構築し、腫瘍浸潤を駆動する因果的分子メカニズムを解明する

---

## 3. AI活用戦略

### 3.1 AIと研究課題のマッピング

| 研究課題 | AI手法 | 期待される成果 |
|---------|--------|-------------|
| Fn微量リード検出 | Transformer-based sequence classifier + PathSeq前処理 | 既存手法比で感度20%以上向上（属→種レベル同定） |
| コンタミネーション除外 | Variational Autoencoder (VAE) による異常検知 | 偽陽性率の低減（FPR < 5%） |
| 宿主遺伝子発現パターン抽出 | Differential Expression + Weighted Gene Co-expression (WGCNA) | Fn感染特異的遺伝子モジュールの同定 |
| 宿主-微生物相互作用解析 | Heterogeneous Graph Attention Network (HAN) | Fn-宿主遺伝子間の因果的相互作用ネットワーク構築 |
| バイオマーカー候補同定 | SHAP値によるモデル解釈 + Random Forest検証 | 臨床応用可能な候補マーカーの抽出 |

### 3.2 技術的アプローチの詳細

#### Phase A: Fn特異的配列のAI抽出パイプライン

1. **前処理**: GATK PathSeqパイプラインによるヒトリードの除去・微生物リードの抽出
2. **カスタムリファレンス構築**: Fn完全ゲノム（subspecies: nucleatum, polymorphum, vincentii, animalis, fusiforme）を統合したFn特化型リファレンスデータベースの構築
3. **Transformer分類器**: 抽出された微生物候補リードに対し、Transformerベースの配列分類モデルを適用
   - 入力: k-merトークン化されたリード配列（k=6, 配列長150bp想定）
   - アーキテクチャ: 6層Transformer encoder + classification head
   - 学習データ: Fn全ゲノム由来のシミュレーションリード + NCBI RefSeq微生物データベースからの陰性コントロール
   - 評価指標: Sensitivity, Specificity, F1-score, AUC-ROC

#### Phase B: 宿主-微生物統合解析

1. **差次発現解析**: DESeq2によるFn陽性群 vs. Fn陰性群の差次発現遺伝子（DEG）同定
2. **共発現ネットワーク解析**: WGCNAによるFn感染関連遺伝子モジュールの抽出
3. **異種グラフ構築**: 以下のノード・エッジから構成される異種グラフの構築
   - ノード: 遺伝子（宿主）、微生物（Fn subspecies + 他の口腔細菌）、パスウェイ
   - エッジ: 遺伝子-遺伝子（共発現）、微生物-遺伝子（相関）、遺伝子-パスウェイ（GO/KEGG）
4. **Heterogeneous Graph Attention Network (HAN)**: 異種グラフ上でのノード表現学習
   - 注意機構により異なるエッジタイプの寄与を動的に重み付け
   - EMT関連遺伝子（Snail, Slug, Twist, Vimentin, E-cadherin等）への影響パスを解析
5. **因果推論**: SHAP値 + Attention重みの統合解釈により、Fn→宿主遺伝子→EMT/免疫回避の因果経路を同定

---

## 4. 文献調査

### 4.1 クエリ記録

| # | 検索ツール | クエリ | 取得件数 |
|---|-----------|--------|---------|
| 1 | Web Search (Bing) | "Fusobacterium nucleatum oral squamous cell carcinoma RNA-seq AI deep learning detection 2024 2025" | 5 |
| 2 | Web Search (Bing) | "AI machine learning microbial detection RNA-seq tumor microbiome deconvolution methods 2024 2025" | 7 |
| 3 | Web Search (Bing) | "The Cancer Microbiome Atlas TCMA limitations species-level microbial identification" | 3 |
| 4 | Web Search (Bing) | "Fusobacterium nucleatum immune evasion tumor invasion molecular mechanism EMT pathway 2024" | 3 |
| 5 | Web Search (Bing) | "graph neural network host-microbe interaction gene expression integration multi-omics cancer" | 3 |
| 6 | Web Search (Bing) | "PathSeq GATK microbial reads RNA-seq pipeline pathogen detection tumor" | 2 |

⚠️ ToolUniverse MCP サーバーは本環境で未接続のため、Web検索によるフォールバック調査を実施した。

### 4.2 取得文献リスト

| # | 著者/タイトル | DOI/URL | 取得元 | 関連性 |
|---|-------------|---------|--------|--------|
| 1 | Porphyromonas gingivalis and Fusobacterium nucleatum synergistically promote OSCC (2025) | https://link.springer.com/article/10.1186/s13027-025-00689-5 | Web Search | Fn+Pgの共感染によるOSCC促進メカニズム。RNA-seq解析 |
| 2 | Host-microbe computational proteomic landscape in oral cancer (Nature, 2024) | https://www.nature.com/articles/s41368-024-00326-8 | Web Search | 計算プロテオミクスによるFn-宿主相互作用。代謝リプログラミング |
| 3 | F. nucleatum facilitates OSCC progression via GLUT1 (eBioMedicine, 2023) | https://www.thelancet.com/journals/ebiom/article/PIIS2352-3964(23)00009-9/fulltext | Web Search | Fn-GLUT1経路によるOSCC進行促進メカニズム |
| 4 | ASD-cancer: DL framework for microbial-host transcriptome integration (mSystems, 2024) | https://journals.asm.org/doi/abs/10.1128/msystems.01395-24 | Web Search | 腫瘍マイクロバイオーム+宿主トランスクリプトームの深層学習統合 |
| 5 | MicroAIbiome: Explainable ML for multi-cancer classification (Microorganisms, 2025) | https://www.mdpi.com/2076-2607/13/9/2210 | Web Search | CLR変換+SHAP値による微生物プロファイルの解釈可能AI |
| 6 | Unmapped RNA-seq reads for spatial tumor microbiome (bioRxiv, 2024) | https://www.biorxiv.org/content/10.1101/2024.06.09.598160v1 | Web Search | Unmappedリードからの種レベル微生物検出手法 |
| 7 | AI-empowered human microbiome research (Gut, 2025) | https://gut.bmj.com/content/early/2025/09/22/gutjnl-2025-335946 | Web Search | AI×マイクロバイオーム研究の包括的レビュー |
| 8 | AI for Microbiology and Microbiome Research (arXiv, 2024) | https://arxiv.org/html/2411.01098v1 | Web Search | ML/DL手法選択ガイド。small-n, large-p問題への対応 |
| 9 | Fn in CRC: Immune evasion, EMT, chemoresistance (PMC, 2025) | https://pmc.ncbi.nlm.nih.gov/articles/PMC12525060/ | Web Search | FadA/Fap2免疫抑制、EMT誘導の包括的レビュー |
| 10 | Fn: transboundary pathogen (Gut Pathogens, 2025) | https://link.springer.com/article/10.1186/s13099-025-00775-4 | Web Search | 上皮バリア破壊・慢性炎症によるEMT維持メカニズム |

---

## 5. 関連事例（先行研究）

### 事例1: ASD-cancer — 深層学習による腫瘍マイクロバイオーム・宿主トランスクリプトーム統合

- **文献**: ASD-cancer: DL framework for microbial-host transcriptome integration
- **DOI/URL**: https://journals.asm.org/doi/abs/10.1128/msystems.01395-24
- **取得元ツール**: Web Search (Bing)
- **概要**: 腫瘍マイクロバイオームと宿主RNA-seqプロファイルを深層学習で統合し、生存予測と癌サブタイプ分類を実現。従来のPCAベース手法を凌駕する性能を達成。
- **本研究との関連性**: 本研究のPhase B（宿主-微生物統合解析）の基盤手法として参考。ただし本研究ではGNNベースのアプローチを採用し、因果的相互作用パスの同定に焦点を当てる点で差別化。

### 事例2: Unmapped RNA-seq reads を活用した空間的腫瘍マイクロバイオーム解析

- **文献**: Analysis of Unmapped RNA-seq Data from Cancer Spatial Transcriptomics
- **DOI/URL**: https://www.biorxiv.org/content/10.1101/2024.06.09.598160v1
- **取得元ツール**: Web Search (Bing)
- **概要**: RNA-seqの unmapped reads から微生物RNAをカスタムリファレンスデータベースに対してマッピングし、種レベルでの腫瘍マイクロバイオーム検出を実現。空間トランスクリプトミクスへの拡張も示した。
- **本研究との関連性**: 本研究のPhase A（Fn特異的配列抽出）の前処理戦略に直接的な参考。Unmapped reads活用という発想を共有するが、本研究ではTransformerベースの分類器を追加することで、より高精度なFn種特異的同定を目指す。

### 事例3: MicroAIbiome — 解釈可能AIによる癌分類

- **文献**: MicroAIbiome: Decoding Cancer Types from Microbial Profiles Using Explainable AI
- **DOI/URL**: https://www.mdpi.com/2076-2607/13/9/2210
- **取得元ツール**: Web Search (Bing)
- **概要**: CLR変換と特徴量削減を前処理に適用し、SHAP値による微生物プロファイルの生物学的解釈を可能にした説明可能AIパイプライン。属レベルの微生物量データから複数癌種の分類を達成。
- **本研究との関連性**: 本研究のモデル解釈戦略（SHAP値＋Attention重み）の参考。MicroAIbiomeは属レベル解析にとどまるが、本研究では種レベル（Fn subspecies含む）への拡張と、宿主遺伝子発現との統合解析を追加する点で発展的。

### 事例4: Host-microbe computational proteomic landscape in OSCC

- **文献**: Host-microbe computational proteomic landscape in oral cancer
- **DOI/URL**: https://www.nature.com/articles/s41368-024-00326-8
- **取得元ツール**: Web Search (Bing)
- **概要**: 計算プロテオミクスにより、OSCC組織中のFn由来ペプチドと宿主タンパク質の相互作用ランドスケープを解明。アミノ酸代謝経路の撹乱とEMT促進を報告。
- **本研究との関連性**: Fn-宿主相互作用の分子メカニズムに関する直接的な参考文献。本研究ではトランスクリプトームレベルでの統合解析を行い、プロテオミクス知見との整合性を検証する。

---

## 6. 計算資源要件の見積もり

### 6.1 Phase A: Fn特異的配列抽出パイプライン

| 項目 | 仕様 |
|------|------|
| 対象データ量 | TCGA OSCC RNA-seq約300検体（各50GB BAM → 計約15TB） |
| PathSeq前処理 | CPU中心処理。Standard_D16s_v5（16 vCPU, 64GB RAM）× 並列処理 |
| Transformer学習 | GPU必須。学習データ: Fnゲノム由来シミュレーションリード約100万配列 |
| GPU仕様 | NVIDIA A100 40GB × 1台（Standard_NC24ads_A100_v4相当） |
| 学習時間（推定） | 6層Transformer, batch_size=256: 約24-48時間 |
| 推論（300検体） | A100 × 1台で約12-24時間 |

### 6.2 Phase B: 宿主-微生物統合解析

| 項目 | 仕様 |
|------|------|
| DESeq2 / WGCNA | CPU処理。Standard_D16s_v5で十分 |
| HAN学習 | グラフサイズ: ノード約20,000（遺伝子15,000 + 微生物100 + パスウェイ5,000） |
| GPU仕様 | NVIDIA A100 40GB × 1台 |
| 学習時間（推定） | HAN (4層, hidden_dim=256): 約6-12時間 |
| SHAP計算 | CPU + GPU並列。約4-8時間 |

### 6.3 ストレージ

| 項目 | 容量 |
|------|------|
| 生データ（TCGA BAM） | 約15TB |
| 前処理後データ | 約500GB |
| モデル・チェックポイント | 約50GB |
| 中間結果・ログ | 約100GB |
| **合計** | **約16TB** |

### 6.4 合計計算時間（推定）

| フェーズ | GPU時間 | CPU時間 |
|---------|--------|--------|
| Phase A (学習+推論) | 約48-72時間 | 約200時間（PathSeq） |
| Phase B (学習+解析) | 約12-24時間 | 約50時間（DESeq2/WGCNA） |
| 検証・再実験 | 約24-48時間 | 約50時間 |
| **合計** | **約84-144 GPU時間** | **約300 CPU時間** |

---

## 7. 研究スケジュール（180日間）

| 期間 | マイルストーン | 主要タスク |
|------|-------------|-----------|
| Month 1 (Day 1-30) | **環境構築・データ準備** | Azure ML環境構築、TCGA OSCCデータ取得・前処理、Fnリファレンスデータベース構築、PathSeqパイプライン構築・検証 |
| Month 2 (Day 31-60) | **Phase A: Transformer分類器開発** | シミュレーションデータ生成、Transformer分類器の設計・学習・評価、ハイパーパラメータチューニング |
| Month 3 (Day 61-90) | **Phase A: 大規模適用・検証** | TCGA全300検体へのパイプライン適用、Fn検出結果の検証（既知データとの比較）、感度・特異度評価 |
| Month 4 (Day 91-120) | **Phase B: 統合解析モデル構築** | DESeq2差次発現解析、WGCNAモジュール抽出、異種グラフ構築、HAN設計・初期学習 |
| Month 5 (Day 121-150) | **Phase B: 因果解析・検証** | HAN本学習・評価、SHAP値解析、EMT/免疫関連パスウェイの因果経路同定、生物学的妥当性検証 |
| Month 6 (Day 151-180) | **統合・論文準備** | 結果統合・可視化、手法の汎用性検証（他の口腔細菌への適用テスト）、論文草稿執筆、成果報告書作成 |

---

## 8. 新規性・革新性

### 8.1 新規性

1. **種レベルAI同定**: 従来の属レベル解析を超え、Transformer分類器によるFn亜種レベルの高精度同定を実現する初の試み
2. **GNNベース因果解析**: 宿主-微生物相互作用をグラフ構造として捉え、Heterogeneous GAT（HAN）により因果的分子経路を同定する新しいアプローチ
3. **OSCCへの特化**: 大腸癌で主に研究されてきたFn-腫瘍相互作用を、OSCCに特化した包括的AI解析パイプラインとして初めて体系化

### 8.2 革新性

1. **"見えない感染"の可視化パラダイム**: RNA-seqデータから微量微生物シグナルをAIで抽出するパラダイムは、口腔癌に限らず、あらゆる腫瘍における微生物-腫瘍相互作用研究に適用可能
2. **因果推論の統合**: 単なる相関解析ではなく、GNNのAttention機構とSHAPを組み合わせた因果推論により、治療標的候補の同定まで繋げる
3. **臨床応用への橋渡し**: Fn感染の定量的スコアリングと関連遺伝子パスウェイの同定は、OSCCの診断バイオマーカーおよび個別化治療戦略の開発に直接貢献

---

## 9. 技術的制約とリスク

| リスク | 対策 |
|--------|------|
| Fnリード量が極めて少なく検出不能 | シミュレーションデータで最小検出閾値を事前評価。PathSeq前処理の最適化 |
| Transformer分類器の過学習 | クロスバリデーション、ドロップアウト、データ拡張（リードのランダム断片化）の適用 |
| GNNの解釈困難性 | SHAP + Attention重みの二重検証。既知パスウェイ（Wnt, NF-κB等）との整合性確認 |
| TCGA OSCCデータの不均一性 | バッチ効果補正（DEBIAS-Mの適用検討）、サンプルQC基準の厳格化 |
| GPU計算時間の超過 | 段階的な検体数スケーリング。混合精度演算（AMP）の活用 |

---

## 10. 使用フレームワーク・ツール

| カテゴリ | ツール/フレームワーク | 用途 |
|---------|-------|------|
| 前処理 | GATK PathSeq | ヒトリード除去・微生物リード抽出 |
| 配列解析 | BWA-MEM2, SAMtools, BEDtools | アライメント・BAM操作 |
| 深層学習 | PyTorch + Hugging Face Transformers | Transformer分類器の構築 |
| グラフNN | PyTorch Geometric (PyG) | HAN構築・学習 |
| 差次発現 | DESeq2 (R/Bioconductor) | 差次発現解析 |
| ネットワーク | WGCNA (R) | 共発現ネットワーク解析 |
| モデル解釈 | SHAP, Captum | Attention重み・SHAP値解析 |
| クラウド基盤 | Azure Machine Learning | GPU計算環境、MLパイプライン管理 |
| データ管理 | Azure Blob Storage | 大規模データストレージ |
| 実験管理 | MLflow (Azure ML統合) | 実験トラッキング・モデル管理 |

---

> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
