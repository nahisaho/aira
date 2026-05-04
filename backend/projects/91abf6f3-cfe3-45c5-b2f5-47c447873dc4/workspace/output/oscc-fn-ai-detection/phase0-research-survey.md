# 文献調査・データベースリサーチ結果サマリー

**プロジェクト名**: oscc-fn-ai-detection
**調査日**: 2026-05-04
**調査対象**: 口腔扁平上皮癌（OSCC）におけるFusobacterium nucleatum検出のためのAI活用

---

## 1. Web検索による調査結果

### 1.1 Fusobacterium nucleatum × OSCC × RNA-seq × AI

| # | タイトル | URL | 主要知見 |
|---|---------|-----|---------|
| 1 | Porphyromonas gingivalis and Fusobacterium nucleatum synergistically promote OSCC | https://link.springer.com/article/10.1186/s13027-025-00689-5 | Pg・Fn共感染が増殖・遊走・炎症・免疫回避経路を増幅。RNA-seqによるトランスクリプトーム解析で検証 |
| 2 | Host-microbe computational proteomic landscape in oral cancer | https://www.nature.com/articles/s41368-024-00326-8 | Fnペプチド・代謝酵素がOSCCで豊富。アミノ酸代謝の撹乱とEMT促進を計算プロテオミクスで解明 |
| 3 | F. nucleatum facilitates OSCC progression via GLUT1 | https://www.thelancet.com/journals/ebiom/article/PIIS2352-3964(23)00009-9/fulltext | Fn感染がGLUT1経路を介してOSCC進行を促進。AI/DLによるomicsデータ統合の重要性を指摘 |

### 1.2 AI/ML × 腫瘍マイクロバイオーム × RNA-seq解析手法

| # | タイトル | URL | 主要知見 |
|---|---------|-----|---------|
| 1 | ASD-cancer: DL framework for microbial-host transcriptome integration | https://journals.asm.org/doi/abs/10.1128/msystems.01395-24 | 深層学習による腫瘍マイクロバイオームと宿主トランスクリプトームの統合。生存予測でPCAベースを凌駕 |
| 2 | MicroAIbiome: Explainable ML for multi-cancer classification | https://www.mdpi.com/2076-2607/13/9/2210 | CLR変換+SHAP値による微生物プロファイル解釈。属レベル微生物量からの癌分類パイプライン |
| 3 | DEBIAS-M: Batch correction for microbiome studies | https://www.cancer.columbia.edu/news/new-machine-learning-model-handles-technical-variability-accelerate-microbiome-based-cancer-detection | ドメイン適応によるバッチ効果補正。異種データ統合の一般化を実現 |
| 4 | Unmapped RNA-seq reads for spatial tumor microbiome | https://www.biorxiv.org/content/10.1101/2024.06.09.598160v1 | Unmappedリードから微生物RNAを種レベルで検出。空間トランスクリプトミクスへの拡張 |
| 5 | Specificity diversity framework for cancer microbiome networks | https://www.medrxiv.org/content/10.1101/2024.03.23.24304768.pdf | TCGA RNA-seqデータの再解析による20以上の癌種横断的微生物ネットワーク構築 |
| 6 | AI-empowered human microbiome research (Gut, 2025) | https://gut.bmj.com/content/early/2025/09/22/gutjnl-2025-335946 | AI/マイクロバイオーム研究の包括的レビュー。標準化・ベンチマークデータセットの必要性 |
| 7 | AI for Microbiology and Microbiome Research (arXiv, 2024) | https://arxiv.org/html/2411.01098v1 | ML/DL手法の選択ガイド。high-dimensional, small-n問題への対応戦略 |

### 1.3 Fusobacterium nucleatum の分子メカニズム

| # | タイトル | URL | 主要知見 |
|---|---------|-----|---------|
| 1 | Fn in CRC: Immune evasion, EMT, chemoresistance | https://pmc.ncbi.nlm.nih.gov/articles/PMC12525060/ | FadA/Fap2による免疫抑制、Wnt/β-catenin・NF-κB・TGF-β経路を介したEMT誘導 |
| 2 | Fn: transboundary pathogen in host-microbe interactions | https://link.springer.com/article/10.1186/s13099-025-00775-4 | 上皮バリア破壊、慢性炎症によるEMT維持、腫瘍進行促進の包括的メカニズム |
| 3 | Fn in tumor microenvironment (FEMS Microbes, 2024) | https://academic.oup.com/femsmicrobes/article/doi/10.1093/femsmc/xtag002/8419685 | 免疫回避と腫瘍浸潤の連関。オートファジー誘導・フェロトーシス阻害による治療抵抗性 |

### 1.4 GNN × マルチオミクス × 宿主-微生物相互作用

| # | 参考文献・ツール | URL | 主要知見 |
|---|----------------|-----|---------|
| 1 | Graph-based integration of multi-omics (Briefings in Bioinformatics, 2023) | — | 異種グラフによるマルチオミクス統合の包括的レビュー |
| 2 | DeepMOCCA: GNN-based multi-omics cancer classification | — | GNNによるマルチオミクスデータの癌分類・特徴選択フレームワーク |
| 3 | PyTorch Geometric / DGL | https://pytorch-geometric.readthedocs.io / https://www.dgl.ai | GNN実装のための主要ライブラリ |

### 1.5 TCMA の限界

- ホストシーケンシングデータ（WGS/RNA-seq）からの微生物同定であり、専用微生物シーケンシングではない
- 微生物リードが極めて低量のため、種レベル同定は信頼性が低い
- ショートリードでは種特異的領域を十分にカバーできず、属レベルにとどまる
- リファレンスデータベースの網羅性に依存
- 低バイオマス検体ではコンタミネーションリスクが高い

### 1.6 SPReAD 2026年度公募情報

- **公募期間**: 2026年4月17日（金）〜5月18日（月）正午
- **採択規模**: 年間約1,000件
- **助成額**: 1課題あたり最大500万円（直接経費）+ 間接経費30%
- **研究期間**: 交付決定日〜2027年1月6日
- **公式ページ**: https://www.mext.go.jp/aifors_spread/

## 2. ToolUniverse MCP 利用状況

⚠️ ToolUniverse MCP サーバーは本環境で利用不可のため、Web検索によるフォールバック調査を実施した。
上記の文献リストはすべてWeb検索（Bing経由）から取得したものである。

---

> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
