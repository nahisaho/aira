# AI for Science 分野別 AI 活用パターン

本リファレンスは、研究プラン策定時に分野特化の AI 活用パターンを参照するために読む。

## Microsoft AI Foundry — AI for Science モデル一覧

Microsoft Research AI for Science が開発し、Azure AI Foundry のモデルカタログから利用可能な科学研究特化モデル。
SPReAD の研究計画において、これらのモデル活用を優先的に検討すること。

| モデル | 分野 | 用途 | 参照 |
|--------|------|------|------|
| [Aurora](https://ai.azure.com/explore/models/Aurora/version/4/registry/azureml) | 気象・大気科学 | 大規模大気基盤モデル。気象予測・大気汚染予測・気候影響評価 | [論文](https://www.nature.com/articles/s41586-025-08783-9) / [プロジェクト](https://www.microsoft.com/en-us/research/project/aurora-forecasting/) |
| [MatterGen](https://ai.azure.com/explore/models/MatterGen/version/1/registry/azureml-msr) | 材料科学 | 拡散モデルによる新規材料生成。化学組成・対称性・物性条件から材料構造を生成 | [Nature 論文](https://www.nature.com/articles/s41586-025-08628-5) / [GitHub](https://github.com/microsoft/mattergen) |
| [MatterSim](https://ai.azure.com/explore/models/MatterSim/version/1/registry/azureml) | 材料科学 | 材料シミュレーションの深層学習エミュレータ。DFT 計算の高速代替 | [ブログ](https://www.microsoft.com/en-us/research/blog/mattersim-a-deep-learning-model-for-materials-under-real-world-conditions/) |
| [BioEmu](https://ai.azure.com/explore/models/BioEmu/version/2/registry/azureml) | 生命科学 | 生体分子エミュレータ。タンパク質ダイナミクスシミュレーション | [プロジェクト](https://www.microsoft.com/en-us/research/project/biomolecules/) |
| [TamGen](https://www.microsoft.com/en-us/research/blog/accelerating-drug-discovery-with-tamgen-a-generative-ai-approach-to-target-aware-molecule-generation/) | 化学・創薬 | ターゲット認識型分子生成。標的タンパク質に対する候補分子の自動設計 | [ブログ](https://www.microsoft.com/en-us/research/blog/accelerating-drug-discovery-with-tamgen-a-generative-ai-approach-to-target-aware-molecule-generation/) |
| [NatureLM](https://arxiv.org/abs/2502.07527) | 分野横断 | 科学基盤モデル（1B/8B/46.7B パラメータ）。テキスト指示による低分子・タンパク質・RNA・材料の生成・最適化、およびクロスドメイン設計（タンパク質→分子、タンパク質→RNA 等） | [arXiv](https://arxiv.org/abs/2502.07527) |
| [Skala (DFT)](https://www.microsoft.com/en-us/research/project/dft/use-skala/) | 計算化学・材料 | 深層学習ベースの交換相関汎関数。DFT 計算精度を化学的精度（~1 kcal/mol）に引き上げ、分子・材料設計の予測精度を飛躍的に向上 | [論文](https://aka.ms/SkalaDFT) / [プロジェクト](https://www.microsoft.com/en-us/research/project/dft/) |
| [AI2BMD](https://www.microsoft.com/en-us/research/blog/from-static-prediction-to-dynamic-characterization-ai2bmd-advances-protein-dynamics-with-ab-initio-accuracy/) | 生命科学 | ab initio 精度の生体分子動力学シミュレーション。タンパク質の動的挙動を第一原理精度で高速計算 | [ブログ](https://www.microsoft.com/en-us/research/blog/from-static-prediction-to-dynamic-characterization-ai2bmd-advances-protein-dynamics-with-ab-initio-accuracy/) |

**利用方法**: Azure AI Foundry ポータル (`ai.azure.com`) のモデルカタログから上記モデルをデプロイし、Azure ML パイプラインに組み込む。

## 物理学・天文学

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| 深層学習 (CNN) | 画像分類・天体検出 | [PyTorch](https://pytorch.org/), [TensorFlow](https://www.tensorflow.org/) |
| [物理インフォームドNN (PINN)](https://en.wikipedia.org/wiki/Physics-informed_neural_networks) | 偏微分方程式のサロゲートモデル | [DeepXDE](https://deepxde.readthedocs.io/), [NVIDIA Modulus](https://developer.nvidia.com/modulus) |
| 生成モデル (GAN/Diffusion) | シミュレーションデータ拡張 | [PyTorch](https://pytorch.org/) |
| [強化学習](https://en.wikipedia.org/wiki/Reinforcement_learning) | 実験パラメータ最適化 | [Stable-Baselines3](https://stable-baselines3.readthedocs.io/) |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [Azure OpenAI (GPT-4o)](https://learn.microsoft.com/en-us/azure/ai-services/openai/) | 論文要約・実験結果の解釈支援 |
| [Phi-4-reasoning](https://ai.azure.com/explore/models/Phi-4-reasoning/version/3/registry/azureml) | 数式推論・物理法則の検証 |

## 材料科学

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| [グラフニューラルネットワーク (GNN)](https://en.wikipedia.org/wiki/Graph_neural_network) | 分子構造予測 | [PyG](https://pyg.org/), [DGL](https://www.dgl.ai/) |
| [ベイズ最適化](https://en.wikipedia.org/wiki/Bayesian_optimization) | 材料探索の効率化 | [BoTorch](https://botorch.org/), [Ax](https://ax.dev/) |
| [転移学習](https://en.wikipedia.org/wiki/Transfer_learning) | 少量データでの物性予測 | [PyTorch](https://pytorch.org/) |
| 大規模言語モデル | 論文マイニング・知識抽出 | [LangChain](https://www.langchain.com/), [OpenAI API](https://platform.openai.com/) |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [**MatterGen**](https://ai.azure.com/explore/models/MatterGen/version/1/registry/azureml-msr) | 目的の物性（体積弾性率・磁性・電子特性等）を条件として新規安定材料を生成。従来のスクリーニングを超える探索が可能 |
| [**MatterSim**](https://ai.azure.com/explore/models/MatterSim/version/1/registry/azureml) | DFT 計算のエミュレーションにより材料特性シミュレーションを桁違いに高速化。MatterGen と組み合わせて生成→検証のフライホイールを構築 |
| [**NatureLM**](https://arxiv.org/abs/2502.07527) | テキスト指示による材料構造の生成・最適化。クロスドメインで分子↔材料の統合設計が可能 |
| [**Skala (DFT)**](https://www.microsoft.com/en-us/research/project/dft/use-skala/) | 深層学習 XC 汎関数により、材料の電子構造計算を化学的精度で実行。従来の DFT 近似の精度限界を突破 |

## 生命科学・医学

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| [AlphaFold 型モデル](https://alphafold.ebi.ac.uk/) | タンパク質構造予測 | [AlphaFold](https://github.com/google-deepmind/alphafold), [ESMFold](https://github.com/facebookresearch/esm) |
| CNN/[ViT](https://arxiv.org/abs/2010.11929) | 医用画像解析 | [MONAI](https://monai.io/), [torchvision](https://pytorch.org/vision/) |
| RNN/[Transformer](https://arxiv.org/abs/1706.03762) | ゲノム配列解析 | [Enformer](https://github.com/google-deepmind/deepmind-research/tree/master/enformer), [DNABERT](https://github.com/jerryji1993/DNABERT) |
| GAN | 合成医用画像生成 | [StyleGAN](https://github.com/NVlabs/stylegan3), Diffusion |
| [NVIDIA BioNeMo](https://docs.nvidia.com/bionemo-framework/latest/) | タンパク質・分子・ゲノム AI モデル学習 | [BioNeMo Framework](https://docs.nvidia.com/bionemo-framework/latest/)（ESM-2, MolMIM, DiffDock 等のバイオ AI モデルの学習・ファインチューニング基盤。Azure GPU VM 上で実行） |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [**BioEmu**](https://ai.azure.com/explore/models/BioEmu/version/2/registry/azureml) | タンパク質の動的コンフォメーション変化をシミュレーション。従来の分子動力学計算を大幅に加速 |
| [**AI2BMD**](https://www.microsoft.com/en-us/research/blog/from-static-prediction-to-dynamic-characterization-ai2bmd-advances-protein-dynamics-with-ab-initio-accuracy/) | ab initio 精度のタンパク質動力学シミュレーション。BioEmu と相補的に、より高精度な動的解析が可能 |
| [**NatureLM**](https://arxiv.org/abs/2502.07527) | テキスト指示によるタンパク質・RNA の生成・最適化。タンパク質→分子やタンパク質→RNA のクロスドメイン設計にも対応 |
| [Azure OpenAI (GPT-4o)](https://learn.microsoft.com/en-us/azure/ai-services/openai/) | 生物医学文献のメタ解析・構造化データ抽出 |
| [Azure AI Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/) | 臨床論文PDF・実験レポートからのデータ自動抽出 |

### Azure Health Data Services — 医療データ基盤

医用画像・臨床データを扱う研究では、[Azure Health Data Services](https://learn.microsoft.com/en-us/azure/healthcare-apis/healthcare-apis-overview) を活用することで、データ管理・相互運用性・AI/ML パイプラインの構築が大幅に効率化される。

| サービス | 用途 | 参照 |
|---------|------|------|
| [DICOM service](https://learn.microsoft.com/en-us/azure/healthcare-apis/dicom/overview) | 医用画像（CT, MRI, X線等）の保存・検索・取得。DICOMweb 標準 API に準拠。ペタバイト規模のスケーラビリティ | [概要](https://learn.microsoft.com/en-us/azure/healthcare-apis/dicom/overview) |
| [DICOM + Data Lake Storage](https://learn.microsoft.com/en-us/azure/healthcare-apis/dicom/dicom-data-lake) | DICOM データを Azure Data Lake Storage Gen2 に直接保存。Azure Synapse / Databricks / ML / Microsoft Fabric と連携して画像データの分析・AI/ML が可能 | [デプロイ](https://learn.microsoft.com/en-us/azure/healthcare-apis/dicom/deploy-dicom-services-in-azure-data-lake) |
| [FHIR service](https://learn.microsoft.com/en-us/azure/healthcare-apis/fhir/overview) | 臨床データ（患者情報・検査結果・処方等）の標準化・交換。FHIR R4 準拠 | [概要](https://learn.microsoft.com/en-us/azure/healthcare-apis/fhir/overview) |
| [De-identification service](https://learn.microsoft.com/en-us/azure/healthcare-apis/deidentification/overview) | 臨床テキスト（カルテ・治験記録等）から PHI（保護医療情報）を自動タグ付け・匿名化。HIPAA 準拠 | [概要](https://learn.microsoft.com/en-us/azure/healthcare-apis/deidentification/overview) |

**医用画像 AI 研究の推奨アーキテクチャ**:

```
医用画像(DICOM) → DICOM service + Data Lake Storage Gen2
    → Microsoft Fabric / Azure Synapse（コホート構築・前処理）
    → Azure ML + MONAI（モデル学習: セグメンテーション・分類・検出）
    → FHIR service（推論結果を臨床データと統合）
```

**活用シナリオ**:
- 医用画像 AI（CT/MRI からの病変検出、臓器セグメンテーション）
- 臨床治験コホート構築（FHIR + DICOM のクロスモダリティ分析）
- リアルワールドデータ研究（匿名化済み臨床テキスト + 画像データの大規模解析）
- マルチモーダル医療 AI（画像 + 臨床テキスト + ゲノムデータの統合学習）

## 気象学・地球科学

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| [Transformer](https://arxiv.org/abs/1706.03762) | 気象予測 | [GraphCast](https://github.com/google-deepmind/graphcast), [Pangu-Weather](https://github.com/198808xc/Pangu-Weather) |
| [U-Net](https://arxiv.org/abs/1505.04597) | 衛星画像セグメンテーション | [PyTorch](https://pytorch.org/) |
| LSTM/GRU | 時系列予測 | [PyTorch](https://pytorch.org/), [TensorFlow](https://www.tensorflow.org/) |
| Physics-ML Hybrid | 気候シミュレーション高速化 | [JAX](https://github.com/jax-ml/jax) |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [**Aurora**](https://ai.azure.com/explore/models/Aurora/version/4/registry/azureml) | 大規模大気基盤モデル。高精度気象予測に加え、排出データなしで NO₂ 等の大気汚染物質の濃度予測が可能。従来の数値気象モデルに対して桁違いの計算速度 |

### Microsoft Planetary Computer — 地球環境データ基盤

[Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) は、ペタバイト規模の地球環境モニタリングデータ（衛星画像・気候・土地利用・生物多様性等）を分析可能な形式で提供するプラットフォーム。

| 機能 | 説明 | 参照 |
|------|------|------|
| データカタログ | Sentinel-2, Landsat, ERA5, MODIS 等のグローバル環境データセットを分析可能な形式で提供 | [カタログ](https://planetarycomputer.microsoft.com/catalog) |
| API | STAC (SpatioTemporal Asset Catalog) 準拠 API によるデータ検索・取得 | [ドキュメント](https://planetarycomputer.microsoft.com/docs) |
| Planetary Computer Pro | プライベート地理空間データに対する Planetary Computer の機能を提供 | [詳細](https://aka.ms/planetarycomputerpro) |
| 科学計算環境 | JupyterHub ベースの分析環境。Dask による分散処理に対応 | [ハブ](https://planetarycomputer.microsoft.com/docs/overview/environment/) |

## 社会科学・人文学

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| NLP/LLM | テキスト分析・文献調査 | [Hugging Face](https://huggingface.co/), [OpenAI](https://platform.openai.com/) |
| [トピックモデリング](https://en.wikipedia.org/wiki/Topic_model) | 大量文書のクラスタリング | [BERTopic](https://maartengr.github.io/BERTopic/), [Gensim](https://radimrehurek.com/gensim/) |
| ネットワーク分析 | 社会ネットワーク解析 | [NetworkX](https://networkx.org/), [igraph](https://igraph.org/) |
| [因果推論](https://en.wikipedia.org/wiki/Causal_inference) | 因果効果の推定 | [DoWhy](https://github.com/py-why/dowhy), [EconML](https://github.com/py-why/EconML) |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [Azure OpenAI (GPT-4o)](https://learn.microsoft.com/en-us/azure/ai-services/openai/) | 大量文書の要約・分類・感情分析 |
| [Phi-4-multimodal-instruct](https://ai.azure.com/explore/models/Phi-4-multimodal-instruct/version/3/registry/azureml) | テキスト＋画像＋音声のマルチモーダル分析 |
| [Cohere Embed v3 multilingual](https://ai.azure.com/explore/models/Cohere-embed-v3-multilingual/version/3/registry/azureml-cohere) | 多言語文書のベクトル化・類似度検索 |

## 化学・創薬

| 手法 | 用途 | 代表的ツール |
|------|------|-------------|
| VAE/Diffusion | 分子生成 | [RDKit](https://www.rdkit.org/), [MolGAN](https://github.com/nicola-decao/MolGAN) |
| [GNN](https://en.wikipedia.org/wiki/Graph_neural_network) | 分子物性予測 | [SchNet](https://github.com/atomistic-machine-learning/schnetpack), [DimeNet](https://github.com/gasteigerjo/dimenet) |
| [強化学習](https://en.wikipedia.org/wiki/Reinforcement_learning) | 合成経路探索 | [AiZynthFinder](https://github.com/MolecularAI/aizynthfinder) |
| ドッキングシミュレーション+ML | 仮想スクリーニング高速化 | [AutoDock](https://autodock.scripps.edu/) + ML |
| [NVIDIA BioNeMo](https://docs.nvidia.com/bionemo-framework/latest/) | 創薬 AI モデル学習基盤 | [BioNeMo Framework](https://docs.nvidia.com/bionemo-framework/latest/)（MolMIM, DiffDock 等の分子生成・ドッキング AI の学習。Azure ND シリーズ GPU VM 上で実行） |

| AI Foundry モデル | 活用例 |
|------------------|--------|
| [**TamGen**](https://www.microsoft.com/en-us/research/blog/accelerating-drug-discovery-with-tamgen-a-generative-ai-approach-to-target-aware-molecule-generation/) | 標的タンパク質の3D構造を入力として、結合親和性の高い候補分子を自動生成。創薬リード化合物の探索を加速 |
| [**NatureLM**](https://arxiv.org/abs/2502.07527) | テキスト指示による低分子の生成・ADMET 最適化・合成経路提案。タンパク質標的からの分子設計もクロスドメインで実行可能 |
| [**MatterSim**](https://ai.azure.com/explore/models/MatterSim/version/1/registry/azureml) | 分子間相互作用エネルギーの高速推定 |
| [**Skala (DFT)**](https://www.microsoft.com/en-us/research/project/dft/use-skala/) | 深層学習 XC 汎関数による高精度 DFT 計算。反応エネルギー・分子安定性の予測精度を化学的精度まで向上。[DFT REAP プログラム](https://aka.ms/DFT-REAP)で産学連携も可能 |
| [Azure OpenAI (GPT-4o)](https://learn.microsoft.com/en-us/azure/ai-services/openai/) | 化学文献の構造化マイニング・反応条件の抽出

## セキュアリサーチ環境 — Azure Trusted Research Environment (TRE)

機密性の高い研究データ（臨床データ・電子カルテ・個人ゲノム等）を扱う研究では、[Azure TRE](https://microsoft.github.io/AzureTRE/) を活用してセキュアなリサーチワークスペースを構築できる。Azure TRE は Microsoft が提供するオープンソースのソリューションアクセラレータであり、研究者にセキュリティ制御を維持しつつ生産性の高い分析環境を提供する。

| 機能 | 説明 |
|------|------|
| セルフサービスワークスペース | 管理者が TRE ワークスペースをデプロイ・構成。研究者は IT 部門に依存せず分析ツールをプロビジョニング |
| データ流出防御 | Restricted ワークスペーステンプレートによるデータ流出制御。ネットワーク分離・Private Endpoint |
| Airlock（データ入出口管理） | 研究データのインポート/エクスポートを承認ワークフローで制御 |
| 研究ツール統合 | AzureML（Jupyter, R Studio, VS Code）、ML Flow、Virtual Desktop（Windows/Linux）、Gitea |
| パッケージミラーリング | PyPI、R-CRAN、Apt 等のリポジトリミラーをセキュアネットワーク内で利用可能 |
| Microsoft Entra ID 統合 | RBAC による細粒度アクセス制御・認証 |
| コストレポート | ワークスペース単位のコスト可視化 |
| 拡張性 | Terraform ベースのテンプレートで独自サービスを追加可能 |

**参照リンク**:
- [Azure TRE ドキュメント](https://microsoft.github.io/AzureTRE/)
- [GitHub リポジトリ](https://github.com/microsoft/AzureTRE)

**SPReAD での推奨構成**:

```
Azure TRE
├── Restricted Workspace（機密データ研究用）
│   ├── AzureML（Jupyter / VS Code）— モデル学習・実験
│   ├── MONAI / PyTorch — 医用画像解析
│   ├── Airlock — 研究データのインポート（承認制）
│   └── PyPI / CRAN ミラー — パッケージ管理
├── Unrestricted Workspace（オープンデータ研究用）
│   └── 公開データセット・論文データの分析
└── データプラットフォーム連携
    ├── Azure Health Data Services（DICOM / FHIR）
    ├── ADLS Gen2（研究データレイク）
    └── Azure ML / Batch / CycleCloud（HPC 計算）
```

**適用シナリオ**:
- 臨床データ・電子カルテを用いた医学研究（データ流出防止が必須）
- 個人ゲノムデータの機密解析（倫理審査対応のデータガバナンス）
- 製薬企業との産学連携（治験データの共有基盤）
- 複数研究機関間のセキュアなデータ共有・共同研究

## Azure HPC・計算基盤 — 分野横断リファレンス

SPReAD の研究プランでは、大規模計算が必要なワークロードに対して以下の Azure HPC サービスを組み合わせて活用する。

### 計算サービス

| サービス | 用途 | 参照 |
|---------|------|------|
| [Azure Batch](https://learn.microsoft.com/en-us/azure/batch/batch-technical-overview) | 大規模並列・HPC バッチジョブの自動スケーリング実行。パラメータスイープ・シミュレーション並列化に最適 | [概要](https://learn.microsoft.com/en-us/azure/batch/) |
| [Azure CycleCloud](https://learn.microsoft.com/en-us/azure/cyclecloud/) | Slurm / PBS Pro / Grid Engine 等の既存ジョブスケジューラを使用した HPC クラスタ管理。オートスケーリング・ハイブリッド対応 | [概要](https://learn.microsoft.com/en-us/azure/cyclecloud/) |
| [GPU VM（NC/ND シリーズ）](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes-gpu) | NVIDIA A100/H100/H200 搭載の GPU VM。深層学習・分子シミュレーション・気象モデル等の GPU ワークロード | [サイズ一覧](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes-gpu) |
| [HPC VM（HB/HX シリーズ）](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes-hpc) | AMD EPYC 搭載の HPC 最適化 VM。InfiniBand 対応で MPI 並列処理に最適 | [サイズ一覧](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes-hpc) |
| [Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/) | コンテナベースの科学計算パイプラインオーケストレーション。GPU ノードプール対応。大規模アノテーション・推論パイプラインに最適 | [概要](https://learn.microsoft.com/en-us/azure/aks/) |

### 高速ストレージ

| サービス | 用途 | 参照 |
|---------|------|------|
| [Azure Managed Lustre](https://learn.microsoft.com/en-us/azure/azure-managed-lustre/amlfs-overview) | HPC 向け高性能並列ファイルシステム。低レイテンシ・高スループットで大規模シミュレーションの I/O ボトルネックを解消。Blob Storage 連携・AKS 対応 | [概要](https://learn.microsoft.com/en-us/azure/azure-managed-lustre/amlfs-overview) |
| [Azure NetApp Files](https://learn.microsoft.com/en-us/azure/azure-netapp-files/) | エンタープライズ NFS/SMB ファイルストレージ。研究データの共有・AI/ML ワークロードのデータパイプライン | [概要](https://learn.microsoft.com/en-us/azure/azure-netapp-files/) |
| [ADLS Gen2](https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction) | 研究データレイク。ペタバイト規模のデータ蓄積・Synapse / Fabric / Databricks との統合分析 | [概要](https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction) |

### ネットワーク

| 機能 | 説明 |
|------|------|
| [InfiniBand](https://learn.microsoft.com/en-us/azure/virtual-machines/setup-infiniband) | RDMA 対応の高速インターコネクト。MPI 並列ジョブのノード間通信を低レイテンシで実現 |
| [Azure ExpressRoute](https://learn.microsoft.com/en-us/azure/expressroute/) | オンプレミス HPC 環境とのハイブリッド接続。クラウドバースティング対応 |

### データ分析プラットフォーム

| サービス | 用途 | 参照 |
|---------|------|------|
| [Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/get-started/microsoft-fabric-overview) | 統合分析プラットフォーム。研究データの前処理・コホート構築・可視化。OneLake によるデータ統合 | [概要](https://learn.microsoft.com/en-us/fabric/) |
| [Azure Databricks](https://learn.microsoft.com/en-us/azure/databricks/) | Apache Spark ベースの大規模データ処理。ML パイプライン・特徴量エンジニアリング | [概要](https://learn.microsoft.com/en-us/azure/databricks/) |
| [Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/) | ML ライフサイクル管理。実験追跡・モデルレジストリ・マネージド推論エンドポイント | [概要](https://learn.microsoft.com/en-us/azure/machine-learning/) |

### NVIDIA ドメイン特化フレームワーク（Azure GPU VM 上で実行）

Microsoft Azure と NVIDIA のパートナーシップにより、Azure GPU VM（ND/NC シリーズ）上で NVIDIA のドメイン特化フレームワークを利用可能。

| フレームワーク | 分野 | 用途 | 参照 |
|--------------|------|------|------|
| [NVIDIA BioNeMo](https://docs.nvidia.com/bionemo-framework/latest/) | 生命科学・創薬 | タンパク質（ESM-2）、分子生成（MolMIM）、ドッキング（DiffDock）等のバイオ AI モデルの学習・ファインチューニング | [ドキュメント](https://docs.nvidia.com/bionemo-framework/latest/) |
| [NVIDIA Modulus](https://developer.nvidia.com/modulus) | 物理シミュレーション | 物理インフォームド AI（PINN, FNO 等）の構築。流体・熱・構造シミュレーションの高速化 | [ドキュメント](https://docs.nvidia.com/modulus/) |
| [NVIDIA Clara](https://developer.nvidia.com/clara) | 医療 AI | 医用画像解析・ゲノム解析・創薬の AI ワークフロー。MONAI と連携 | [ドキュメント](https://developer.nvidia.com/clara) |
