# AI 活用研究プラン

## 1. 研究概要

### 研究テーマ
臨床倫理ラウンドインタビューデータに対するAI質的分析（大規模言語モデル・Microsoft Azure AI Foundry）の有用性と限界の探索的検討：従来手法（NVivo主題分析）との体系的比較

### 研究分野
医療倫理学・質的研究方法論（人文・社会科学）

### 研究代表者
<!-- 氏名・所属・職位 -->

---

## 2. 研究背景と課題

### 現状の研究手法
医療倫理分野の質的研究では、臨床倫理ラウンドや倫理コンサルテーションに参加した医療従事者・患者・家族へのインタビューデータをもとに、NVivo等のQDA（Qualitative Data Analysis）ソフトウェアを活用した主題分析（Thematic Analysis）が標準的手法として用いられてきた。従来の主題分析プロセスは（1）データへの親しみ（Familiarization）、（2）初期コードの生成、（3）テーマの検索、（4）テーマのレビュー、（5）テーマの定義と命名、（6）報告書の作成という6段階で実施される（Braun & Clarke 2006）。

### 解決すべき課題
- **時間・人的コストの高さ**: NVivoを用いた手動コーディングは熟練研究者でも数十時間の作業を要し、大量のインタビューデータへの対応が困難
- **主観性・再現性の問題**: 研究者のバックグラウンドにより主題の抽出結果が異なり、コーダー間信頼性（Inter-rater Reliability）の確保に労力を要する
- **AI活用知見の欠如**: 医療倫理研究においてAI（LLM）を用いた質的分析の有用性と限界を体系的に評価した先行研究は極めて少なく、実践的な方法論ガイダンスが存在しない
- **汎文理融合知の不足**: AI for Scienceの恩恵を受けにくいとされてきた人文・社会系研究への波及効果を実証的に示す研究が不足している

### AI活用の動機
大規模言語モデル（GPT-4o等）は文書要約・テーマ抽出・コーディングにおいて人間専門家と高い一致率（80%以上）を示すことが近年の研究で報告されており（Qiao et al. 2024; Liu et al. 2025）、医療倫理インタビューデータという文脈依存性の高いテキストに対してどの程度有効であるかを検証することは学術的・実践的意義が大きい。またMicrosoft Azure AI Foundry上のGPT-4oおよびCohere Embed v3 multilingual等の多言語埋め込みモデルを活用することで、日本語インタビューデータの処理も可能となる。

---

## 3. AI 活用方針

### 適用する AI/ML 手法

| 研究フェーズ | AI/ML 手法 | 目的 | 期待効果 |
|-------------|-----------|------|---------|
| データ前処理 | Azure AI Language Services（テキスト匿名化・固有表現認識） | 個人情報除去・テキスト正規化 | 手動匿名化の90%自動化 |
| 分析・モデリング（帰納的） | GPT-4o（Azure OpenAI）プロンプトエンジニアリング | 自由記述テキストからの帰納的テーマ抽出 | 従来比60%の工数削減見込み |
| 分析・モデリング（演繹的） | GPT-4o + コードブック提供（RAG） | 事前定義コードへのデータ割り当て | コーダー間信頼性の定量的評価 |
| セマンティック類似度分析 | Cohere Embed v3 multilingual（Azure AI Foundry） | AIコードと人間コードのベクトル類似度算出 | NVivo結果との定量的差異可視化 |
| トピックモデリング | BERTopic（Hugging Face） | データドリブンのクラスター発見 | 研究者が事前に気づかないテーマの発見 |
| 結果解釈・比較評価 | GPT-4o + 人間専門家ハイブリッド | AI生成テーマの倫理的妥当性評価 | 方法論的トライアンギュレーション |

### 利用予定のフレームワーク・ツール

| ツール/サービス | 用途 |
|---------------|------|
| [Azure OpenAI Service (GPT-4o)](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/) | 主題分析・コーディング・要約 |
| [Azure AI Foundry](https://ai.azure.com/) | モデルデプロイ・パイプライン管理 |
| [Cohere Embed v3 multilingual](https://ai.azure.com/explore/models/Cohere-embed-v3-multilingual/version/3/registry/azureml-cohere) | 日本語テキスト埋め込み・類似度計算 |
| [Azure AI Language（De-identification）](https://learn.microsoft.com/ja-jp/azure/ai-services/language-service/) | 個人識別情報の自動除去 |
| [BERTopic](https://maartengr.github.io/BERTopic/) | トピックモデリング（探索的分析） |
| [LangChain](https://www.langchain.com/) | RAGパイプライン構築（コードブック注入） |
| NVivo 15 | 従来手法（主題分析）の実施・比較基準 |
| Python (pandas, scikit-learn) | コーダー間信頼性指標算出（Cohen's κ, Krippendorff's α） |

### データセット

| 項目 | 内容 |
|------|------|
| データ種別 | 臨床倫理ラウンド参加者への半構造化インタビュー録音・転写テキスト（日本語） |
| 対象者 | 医師・看護師・医療ソーシャルワーカー・臨床倫理専門家等 |
| 想定件数 | 20〜40名（サチュレーション到達まで逐次追加） |
| 1件あたりの長さ | 30〜60分（文字起こし後 3,000〜6,000字/件） |
| 総データ量 | 約60,000〜240,000字（推定） |
| データ入手 | 所属機関倫理委員会承認後、同意取得のうえ収集済み or 本研究期間内に収集 |
| 機密保護 | Azure Health Data Services（De-identification Service）による自動PHI除去 + 手動確認 |

---

## 4. 文献調査（ToolUniverse MCP）

> ⚠️ **ToolUniverse MCP 利用状況**: 本研究計画策定時において `tooluniverse` MCPサーバーは利用不可の状態であった（`grep_tools` コマンド実行時に "ToolUniverse MCP not available" を返却）。このため、Section 4 の文献はWeb検索（Bing/Google Scholar相当）および公開データベースから収集した。各エントリにはURL・取得元を明記する。Section 5 の関連事例も同文献リストから選択している。

### ToolUniverse クエリ記録

| ツール名 | クエリ | 取得件数 | 実行日 |
|---------|-------|---------|-------|
| （利用不可） | — | — | 2026-05-04 |
| Web検索（代替） | "LLM AI qualitative research thematic analysis NVivo comparison 2024 2025" | 複数 | 2026-05-04 |
| Web検索（代替） | "AI qualitative analysis clinical ethics bioethics interview 2024" | 複数 | 2026-05-04 |
| Web検索（代替） | "GPT-4 thematic analysis interview qualitative coding validation DOI 2024" | 複数 | 2026-05-04 |
| Web検索（代替） | "LLM qualitative coding healthcare ethics consultation interviews 2024" | 複数 | 2026-05-04 |

### 取得文献リスト

| # | タイトル | 著者 | 雑誌/会議 | 年 | DOI / URL | 取得元 |
|---|---------|------|----------|---|-----------|--------|
| 1 | Thematic analysis of interview data with ChatGPT: designing and testing a reliable research protocol for qualitative research | Goyanes, M., Lopezosa, C., & Jordá, B. | Quality & Quantity | 2025 | [10.1007/s11135-025-02199-3](https://doi.org/10.1007/s11135-025-02199-3) | Web検索 |
| 2 | Using ChatGPT for Thematic Analysis | Turobov, A., Coyle, D., & Harding, V. | arXiv (Bennett Institute, Univ. Cambridge) | 2024 | [10.48550/arXiv.2405.08828](https://doi.org/10.48550/arXiv.2405.08828) | Web検索 |
| 3 | Qualitative Coding with GPT-4: Where it Works Better | Liu, X. et al. | Journal of Learning Analytics | 2025 | [10.18608/jla.2025.8575](https://doi.org/10.18608/jla.2025.8575) | Web検索 |
| 4 | A mixed-methods study comparing human-led and ChatGPT-driven qualitative analysis in medical education research | Kondo, T., Miyachi, J., Jönsson, A., & Nishigori, H. | Nagoya Journal of Medical Science | 2024 | [10.18999/nagjms.86.4.620](https://doi.org/10.18999/nagjms.86.4.620) | Web検索 |
| 5 | Generative AI for Thematic Analysis in a Maternal Health Study: Coding Semi-structured Interviews using Large Language Models | Qiao, S. et al. | medRxiv (preprint) | 2024 | [10.1101/2024.09.16.24313707](https://doi.org/10.1101/2024.09.16.24313707) | Web検索 |
| 6 | Clinician voices on ethics of LLM integration in healthcare: a thematic analysis of ethical concerns and implications | （著者名未確認） | BMC Medical Informatics and Decision Making | 2024 | [10.1186/s12911-024-02656-3](https://doi.org/10.1186/s12911-024-02656-3) | Web検索 |
| 7 | An Examination of the Use of Large Language Models to Aid Analysis of Textual Data | （著者名未確認） | International Journal of Qualitative Methods | 2024 | [10.1177/16094069241231168](https://doi.org/10.1177/16094069241231168) | Web検索 |
| 8 | Exploring the potential utility of AI large language models for medical ethics: an expert panel evaluation of GPT-4 | （著者名未確認） | Journal of Medical Ethics | 2024 | [10.1136/jme-2023-109549](https://doi.org/10.1136/jme-2023-109549) | Web検索 |
| 9 | Advancing AI-driven thematic analysis in qualitative research: a generative model comparison | （著者名未確認） | BMC Medical Informatics and Decision Making | 2025 | [https://link.springer.com/article/10.1186/s12911-025-02961-5](https://link.springer.com/article/10.1186/s12911-025-02961-5) | Web検索 |
| 10 | Large Language Models for Thematic Summarization in Healthcare Research | （著者名未確認） | JMIR AI | 2025 | [https://ai.jmir.org/2025/1/e64447](https://ai.jmir.org/2025/1/e64447) | Web検索 |

---

## 5. 関連事例・先行研究

> 上記 Web 検索取得文献から本研究に最も関連する 4 件を選択し、関連性を記述する。

### 事例 1
- **タイトル**: A mixed-methods study comparing human-led and ChatGPT-driven qualitative analysis in medical education research
- **DOI / URL**: [https://doi.org/10.18999/nagjms.86.4.620](https://doi.org/10.18999/nagjms.86.4.620)
- **取得元**: Web検索 (PubMed Central)
- **概要**: 医学教育研究のインタビューデータを対象として、人間研究者主導の質的分析とGPT-4によるAI駆動分析を混合研究法で比較した。GPT-4は主要テーマの抽出で一定の精度を示したが、「濃密記述（thick description）」や理論的に複雑な分析では劣ることが明らかとなった。日本語を母語とする研究者（近藤ら）による研究であり日本の医療文脈との類似性が高い。
- **本研究との関連性**: 本研究と同様に医療系インタビューデータを対象としたAI vs 人間分析の比較を行っており、比較デザインおよび評価指標の参考となる。特に医療文脈特有の倫理的ニュアンスに対するAIの限界を検討する上で重要な示唆を提供する。

### 事例 2
- **タイトル**: Thematic analysis of interview data with ChatGPT: designing and testing a reliable research protocol for qualitative research
- **DOI / URL**: [https://doi.org/10.1007/s11135-025-02199-3](https://doi.org/10.1007/s11135-025-02199-3)
- **取得元**: Web検索 (ResearchGate / Springer)
- **概要**: ChatGPTを用いた主題分析のための体系的な研究プロトコル（準備→コーディング→反復的レビュー→検証の4段階）を設計・検証した。大規模データセットや初期コーディング段階での効率性は高いが、人間の洞察を完全に代替することはできないと結論づけている。
- **本研究との関連性**: AI質的分析の「信頼性のある研究プロトコル」設計という本研究の核心課題に直接対応する。本研究ではこのプロトコルを医療倫理データへ適用・改良する。

### 事例 3
- **タイトル**: Exploring the potential utility of AI large language models for medical ethics: an expert panel evaluation of GPT-4
- **DOI / URL**: [https://doi.org/10.1136/jme-2023-109549](https://doi.org/10.1136/jme-2023-109549)
- **取得元**: Web検索 (PubMed)
- **概要**: GPT-4の回答を臨床倫理のビネット（事例提示）に対して専門家パネルが評価した。技術的明瞭性や情報の正確さでは高評価だったが、文脈依存的な倫理的推論の深さや微妙なニュアンスへの対応では人間の倫理専門家に劣ることが示された。
- **本研究との関連性**: 医療倫理文脈でのGPT-4の限界を実証的に示した先行研究として不可欠。本研究はビネット評価ではなく実際のインタビューデータ分析に焦点を当てており、エコロジカル妥当性の高いアプローチで先行研究の知見を補完する。

### 事例 4
- **タイトル**: Generative AI for Thematic Analysis in a Maternal Health Study: Coding Semi-structured Interviews using Large Language Models
- **DOI / URL**: [https://doi.org/10.1101/2024.09.16.24313707](https://doi.org/10.1101/2024.09.16.24313707)
- **取得元**: Web検索 (medRxiv)
- **概要**: 母子保健研究の半構造化インタビュートランスクリプトに対してChatGPTによる帰納的コーディングを実施。手動コーディングに対して80%以上の精度で一致し、コーディング時間を81%削減。体系的バイアスやプライバシー上の課題も詳細に報告している。
- **本研究との関連性**: 医療系半構造化インタビューの分析という本研究の設定と近接しており、コーディング精度（80%以上一致）・工数削減（81%）という定量的ベンチマークは本研究の評価指標設計の参考となる。

---

## 6. 必要な計算リソース

本研究は事前学習済みLLMをAPIで利用する形態を主体とするため、GPUクラスターによる大規模モデル学習は不要。計算リソースは主にAPI呼び出しと軽量後処理に集中する。

| リソース | 仕様 | 数量 | 利用期間 |
|---------|------|------|---------|
| Azure OpenAI Service（GPT-4o） | Standard Tier, 128K context | 推定 200万トークン/月 | 研究期間全体（6ヶ月） |
| Azure AI Foundry（Cohere Embed v3 multilingual） | 埋め込み生成API | 推定 50万トークン/月 | 分析フェーズ（3ヶ月） |
| Azure AI Language（De-identification） | Standard Tier | テキスト総量 300万文字 | データ前処理フェーズ（1ヶ月） |
| Azure Blob Storage | LRS, Hot Tier | 10 GB | 研究期間全体 |
| Azure Machine Learning（Compute Instance） | Standard_DS3_v2（4vCPU, 14GB RAM） | 1台 | BERTopic実行時（2ヶ月相当） |
| NVivo 15 ライセンス | 1ユーザー年間ライセンス | 1本 | 研究期間全体 |

### 計算量の見積もり根拠
- **データ量**: 想定40件のインタビュー × 平均5,000字 = 約200,000字 ≒ 250,000トークン（日本語は1文字≒1.2トークンで換算）
- **GPT-4o呼び出し**: プロンプト設計の試行・改善を含めた反復実行を考慮し、実データ量の8倍（200万トークン/月）を計上
- **埋め込み**: 全テキストのチャンキング後のベクトル化で50万トークン/月以内
- **BERTopic**: CPU処理で十分対応可能（埋め込みはAPIから取得）
- **合計ストレージ**: 音声データ（原本）+ テキスト + モデル出力 + コードブックで10GB以内

---

## 7. 研究スケジュール

研究期間: 交付決定日〜約180日（最長2027年1月6日）

| フェーズ | 期間（目安） | 内容 | マイルストーン |
|---------|------|------|-------------|
| Phase 1: 準備・データ収集 | 1〜2ヶ月目 | 倫理審査書類整備・追加インタビュー収集（必要時）・NVivo基礎コーディング開始 | インタビューデータ確定・倫理審査承認 |
| Phase 2: 従来手法分析 | 2〜3ヶ月目 | NVivoを用いた主題分析の完全実施・コーダー間信頼性算出（2名体制）・分析結果文書化 | NVivo主題分析レポート完成・κ係数算出 |
| Phase 3: AI分析 | 3〜4ヶ月目 | Azure AI Foundry環境構築・GPT-4oによる帰納的/演繹的分析・BERTopic実施・AIコード体系確定 | AI分析レポート完成 |
| Phase 4: 比較評価 | 4〜5ヶ月目 | NVivo vs AI の定量的比較（κ, Krippendorff's α, コサイン類似度）・質的比較（見落とし・誤コード分析）・有用性・限界の体系的整理 | 比較評価レポート・方法論ガイドライン草案 |
| Phase 5: 成果発表 | 5〜6ヶ月目 | 論文執筆・学会発表準備・方法論ガイドラインの公開 | 国際誌投稿 / 学会発表 |

---

## 8. 期待される成果

### 学術的成果
- **論文**: 医療倫理・質的研究方法論・AI for Science の3分野の国際査読誌への投稿（例: *Journal of Medical Ethics*, *Quality & Quantity*, *BMC Medical Informatics and Decision Making*）
- **方法論的貢献**: 医療倫理インタビューデータに対するAI質的分析プロトコルの確立。評価指標（Cohen's κ, Krippendorff's α, コサイン類似度）を用いた定量的有用性評価フレームワークの提案
- **ガイドライン**: 人文・社会系研究者向けの「AI質的分析導入ガイドライン」（日本語）の公開

### 社会的インパクト
- 医療倫理研究の効率化・スケールアップ（インタビュー件数の拡大が可能となり、多施設研究が現実的になる）
- 質的研究における再現性・透明性の向上（AIを用いた手順の明示化）
- AIに不慣れな人文・社会科学研究者への実践的入門モデルの提供

### AI for Science への貢献
本研究は自然科学以外の分野（医療倫理学・人文・社会科学）におけるAI for Science実践の先駆的事例となる。AI質的分析の有用性と限界を実証的に示すことで、質的研究一般（教育学・社会学・人類学・法学等）への波及効果が期待される。特に「人間専門家とAIのハイブリッド質的分析」という新しい研究パラダイムの標準化に貢献し、SPReADが掲げる「AI for Scienceの裾野拡大」に直接的に寄与する。

---
> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
