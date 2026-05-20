# AIRA 品質評価プロンプト集 第6版（v2.1.0）

第6版: 機械学習ワークフロー、統計解析、可視化品質、科学技術計算。

---

## QE-101: 表形式データ分類ベンチマーク

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
顧客離反予測を題材にした分類ベンチマークの成果物を作成してください。

生成するファイル:
1. ml/train_classifier.py
2. ml/evaluate_classifier.py
3. ml/feature_report.md
4. ml/confusion_matrix.png
5. ml/roc_curve.png

要件:
- Logistic Regression と Random Forest を比較
- データ分割、学習、評価の流れをスクリプトで表現
- feature_report.md に特徴量重要度と考察を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 学習・評価・可視化の役割が分離されている
  - report にモデル比較と解釈が含まれる
- **判定ポイント**: ML ワークフローの完結性、可視化の妥当性、比較観点の明瞭さ

---

## QE-102: 時系列予測とバックテスト

- **評価軸**: F（E2E自動化）, A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
売上時系列を予測するサンプル資材を作成してください。

生成するファイル:
1. timeseries/forecast.py
2. timeseries/predictions.csv
3. timeseries/forecast_plot.png
4. timeseries/backtest_metrics.json
5. timeseries/forecast_report.md

要件:
- 学習期間と検証期間を分ける
- 移動平均ベースラインと単純回帰モデルを比較
- report に MAPE と RMSE を記載する
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - predictions.csv、metrics、plot の内容が整合する
  - forecast_report.md にバックテスト結果と限界が書かれる
- **判定ポイント**: 時系列評価の正確性、ファイル間整合性、考察の具体性

---

## QE-103: A/B テスト統計解析パック

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
コンバージョン改善施策の A/B テストを解析する成果物を作成してください。

生成するファイル:
1. stats/ab_test_analysis.py
2. stats/experiment_data.csv
3. stats/results.json
4. stats/analysis_report.md
5. stats/power_note.md

要件:
- A 群 / B 群の訪問数とコンバージョン数を含むサンプルデータを用意
- 比率差の検定結果を report に記載
- power_note.md にサンプルサイズ不足時の注意点を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - データ、解析結果、レポートの結論が一致する
  - 統計的有意性と実務的有意性が区別されている
- **判定ポイント**: 統計解析の正確さ、レポートの解釈品質、入力前提の明確さ

---

## QE-104: 検出力分析と必要サンプル数試算

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★☆
- **プロンプト**:
```
2群比較の検出力分析を説明する資材を作成してください。

生成するファイル:
1. stats/power_analysis.py
2. stats/sample_size_table.csv
3. stats/sensitivity_plot.png
4. stats/assumptions.md

要件:
- 効果量、検出力、有意水準の関係を説明
- sample_size_table.csv には少なくとも 5 パターンの前提を含める
- assumptions.md に前提条件と解釈上の注意をまとめる
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 表・図・説明文が同じ前提で作られている
  - 実務での利用上の注意点が書かれている
- **判定ポイント**: 統計前提の一貫性、可視化の分かりやすさ、説明の実用性

---

## QE-105: PCA とクラスタリング可視化

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
多次元データを次元圧縮してクラスタ可視化する成果物を作成してください。

生成するファイル:
1. analysis/pca_cluster.py
2. analysis/pca_scatter.png
3. analysis/loadings.csv
4. analysis/silhouette_scores.json
5. analysis/cluster_report.md

要件:
- PCA で 2 次元へ圧縮
- k=2〜5 のクラスタ候補を比較
- report に採用クラスタ数の理由を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - silhouette_scores.json と report の結論が一致する
  - loadings.csv に主成分の解釈材料が含まれる
- **判定ポイント**: 可視化品質、モデル選択理由の妥当性、解釈可能性

---

## QE-106: 回帰診断と残差解析

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
線形回帰モデルの診断資材を作成してください。

生成するファイル:
1. regression/regression_diagnostics.py
2. regression/residuals.png
3. regression/qqplot.png
4. regression/vif_table.csv
5. regression/diagnostics_report.md

要件:
- 多重共線性、残差の正規性、外れ値の観点を扱う
- diagnostics_report.md に改善案を 3 つ以上書く
- vif_table.csv は特徴量ごとの VIF を示す
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 図表とレポートの診断結果が整合する
  - 改善案が一般論ではなく診断結果に基づいている
- **判定ポイント**: 統計診断の妥当性、改善提案の具体性、可視化の読みやすさ

---

## QE-107: ブートストラップ信頼区間の推定

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★☆
- **プロンプト**:
```
平均値の信頼区間をブートストラップで推定する資材を作成してください。

生成するファイル:
1. stats/bootstrap_ci.py
2. stats/bootstrap_distribution.png
3. stats/ci_summary.json
4. stats/ci_report.md

要件:
- 少なくとも 1,000 回の再標本化を前提に説明
- ci_summary.json には下限、上限、推定平均を含める
- report にパラメトリック法との違いを簡潔に書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 図、JSON、レポートの信頼区間が一致する
  - ブートストラップ法の前提と利点が説明される
- **判定ポイント**: 信頼区間説明の正確性、成果物間整合性、再現性の高さ

---

## QE-108: モンテカルロ法によるリスク評価

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
在庫コストの不確実性を評価するモンテカルロシミュレーション資材を作成してください。

生成するファイル:
1. simulation/monte_carlo.py
2. simulation/scenario_config.yaml
3. simulation/percentile_table.csv
4. simulation/simulation_hist.png
5. simulation/risk_report.md

要件:
- 需要、仕入れ価格、欠品コストを乱数で扱う
- P50 / P90 / P95 を percentile_table.csv に出す
- report にリスク低減策を 2 つ以上書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - scenario_config.yaml の前提がレポートに反映される
  - percentile_table.csv とヒストグラムの説明が整合する
- **判定ポイント**: シミュレーション設計の妥当性、結果解釈の明快さ、可視化品質

---

## QE-109: センサーデータ異常検知ワークフロー

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
温度センサーデータの異常検知ワークフローを作成してください。

生成するファイル:
1. anomaly/anomaly_detection.py
2. anomaly/anomalies.csv
3. anomaly/anomaly_plot.png
4. anomaly/thresholds.yaml
5. anomaly/anomaly_report.md

要件:
- 正常値の範囲と異常値判定ルールを thresholds.yaml に記載
- anomalies.csv には検出時刻とスコアを含める
- report に誤検知リスクと改善案を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 閾値定義、検出結果、可視化説明が一致する
  - 運用上の注意点が report に含まれる
- **判定ポイント**: 異常検知フローの具体性、しきい値設計の妥当性、考察の深さ

---

## QE-110: ベイズ更新の可視化レポート

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★☆
- **プロンプト**:
```
成功率推定のベイズ更新を説明する成果物を作成してください。

生成するファイル:
1. bayes/bayesian_update.py
2. bayes/posterior_plot.png
3. bayes/posterior_summary.json
4. bayes/bayes_report.md

要件:
- 事前分布、観測データ、事後分布を区別して説明
- posterior_summary.json に平均、95% 区間、MAP 推定値を含める
- report に頻度論的解釈との違いを簡潔に記載
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 図と JSON の要約値が report の説明と一致する
  - ベイズ更新の流れが初心者にも追える形で整理される
- **判定ポイント**: 統計説明の正確さ、可視化の分かりやすさ、レポート品質

---

## QE-111: 数値積分アルゴリズム比較

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★☆
- **プロンプト**:
```
数値積分手法を比較する科学技術計算の成果物を作成してください。

生成するファイル:
1. scientific/integrate.py
2. scientific/benchmark.csv
3. scientific/convergence_plot.png
4. scientific/integration_report.md

要件:
- 台形則、Simpson 則、モンテカルロ積分を比較
- benchmark.csv に積分値と誤差と計算時間を含める
- report に各手法の向き不向きをまとめる
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 比較軸が数値・図・レポートで揃っている
  - アルゴリズムごとの特徴が正しく説明される
- **判定ポイント**: 科学計算の説明精度、比較表の有用性、収束可視化の妥当性

---

## QE-112: 常微分方程式シミュレーション

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
ロジスティック成長モデルの常微分方程式シミュレーション資材を作成してください。

生成するファイル:
1. ode/ode_simulation.py
2. ode/solution.csv
3. ode/phase_plot.png
4. ode/ode_report.md

要件:
- 初期値と成長率をパラメータとして扱う
- CSV には時刻と状態量を出力
- report に安定点とパラメータ感度の説明を入れる
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 数値解、図、レポートが同じモデル設定で説明される
  - シミュレーション結果の物理的意味が整理される
- **判定ポイント**: モデル理解の正確性、可視化品質、科学的説明の一貫性

---

## QE-113: FFT による周波数解析

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
周期信号の周波数解析を行う成果物を作成してください。

生成するファイル:
1. signal/fft_analysis.py
2. signal/synthetic_signal.csv
3. signal/spectrum.png
4. signal/dominant_frequencies.csv
5. signal/signal_report.md

要件:
- 複数周波数を含む合成信号を使う
- dominant_frequencies.csv に振幅上位 5 件を出す
- report にサンプリング周波数とエイリアシングの注意点を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 合成信号の設定と FFT 結果が対応している
  - 周波数解析の注意点が技術的に正しい
- **判定ポイント**: 信号処理の正確性、可視化の読みやすさ、レポートの技術品質

---

## QE-114: ハイパーパラメータ探索結果の整理

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
分類モデルのハイパーパラメータ探索結果を整理する成果物を作成してください。

生成するファイル:
1. tuning/search.py
2. tuning/search_results.csv
3. tuning/parallel_coordinates.json
4. tuning/best_model_config.yaml
5. tuning/search_report.md

要件:
- Grid Search と Random Search の比較観点を入れる
- search_results.csv に少なくとも 8 試行分の結果を含める
- report に探索コストと再現性の観点を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - best_model_config.yaml が結果表の最良設定と一致する
  - 探索手法の違いが report に具体的に記載される
- **判定ポイント**: 探索結果の整理力、再現性の確保、可視化データの有用性

---

## QE-115: 確率予測のキャリブレーション評価

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
分類モデルの確率出力を評価するキャリブレーション資材を作成してください。

生成するファイル:
1. calibration/calibration_eval.py
2. calibration/calibration_curve.png
3. calibration/reliability_table.csv
4. calibration/brier_scores.json
5. calibration/calibration_report.md

要件:
- 2 つのモデルの Brier score を比較
- reliability_table.csv には bin ごとの平均予測確率と実測率を入れる
- report に運用上どちらを採用するか判断を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 表・図・JSON の評価値が一致する
  - キャリブレーションの重要性が report に説明される
- **判定ポイント**: 確率予測評価の正確性、判断理由の妥当性、成果物整合性

---

## QE-116: データドリフト検知レポート

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
学習データと本番データの差分を検知する成果物を作成してください。

生成するファイル:
1. drift/drift_analysis.py
2. drift/baseline_stats.json
3. drift/current_stats.json
4. drift/drift_plot.png
5. drift/drift_report.md

要件:
- 数値列とカテゴリ列の両方について差分を評価
- report に要注意特徴量を 3 つ以上挙げる
- drift の影響が大きい場合の対処案を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - baseline/current の統計と report の指摘が一致する
  - 運用上のアクションが具体的である
- **判定ポイント**: ドリフト検知観点の妥当性、説明の具体性、継続運用への接続

---

## QE-117: 再現可能な実験テンプレート

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★☆
- **プロンプト**:
```
機械学習実験の再現性を高めるテンプレート一式を作成してください。

生成するファイル:
1. reproducibility/config.yaml
2. reproducibility/run_experiment.py
3. reproducibility/metadata.json
4. reproducibility/requirements.txt
5. reproducibility/README.md

要件:
- random seed とデータバージョンを config で管理
- metadata.json に実行日時、パラメータ、評価指標の保存例を含める
- README に再現手順を 5 ステップ以上で説明
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - config, script, metadata のキー名が整合する
  - README の再現手順が具体的で追試しやすい
- **判定ポイント**: 再現性設計の丁寧さ、メタデータの有用性、手順書の品質

---

## QE-118: Notebook とスクリプトの同内容化

- **評価軸**: C（ファイル生成・検出）, I（ファイル更新）, A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
同じ分析内容を Notebook と Python スクリプトの両方で提供する成果物を作成してください。

生成するファイル:
1. notebook/analysis.ipynb
2. notebook/analysis.py
3. notebook/sample_data.csv
4. notebook/parity_report.md

要件:
- Notebook とスクリプトで同じ処理順を保つ
- parity_report.md に「Notebook と script の差異」を整理する
- sample_data.csv は 20 行以上にする
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - Notebook と script の分析手順が対応している
  - parity_report.md に差異と使い分けが明記される
- **判定ポイント**: 成果物間の整合性、Notebook 化の丁寧さ、比較レポートの有用性

---

## QE-119: 有限差分による熱拡散シミュレーション

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
1次元熱拡散方程式を有限差分で解く科学計算の成果物を作成してください。

生成するファイル:
1. pde/heat_diffusion.py
2. pde/temperature_grid.csv
3. pde/heatmap.png
4. pde/stability_notes.md

要件:
- 初期温度分布と境界条件を明記
- stability_notes.md に時間刻みと空間刻みの制約を書く
- CSV には複数時刻の温度分布を保存する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 数値計算条件と安定性メモの説明が一致する
  - heatmap と CSV の内容が対応している
- **判定ポイント**: 科学計算の妥当性、安定性説明の正確さ、可視化品質

---

## QE-120: 不確実性伝播の可視化

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★☆
- **プロンプト**:
```
入力誤差が出力に与える影響を評価する不確実性伝播の成果物を作成してください。

生成するファイル:
1. uncertainty/uncertainty_propagation.py
2. uncertainty/propagated_stats.json
3. uncertainty/tornado_chart.png
4. uncertainty/uncertainty_report.md

要件:
- 少なくとも 3 つの入力変数の不確実性を扱う
- JSON に平均、標準偏差、95% 区間を含める
- report に感度の高い変数と改善案を記載する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - tornado_chart と report の感度順位が一致する
  - 統計要約値が JSON とレポートで整合する
- **判定ポイント**: 不確実性解析の実務性、可視化の分かりやすさ、結論の妥当性

---

## 評価結果テンプレート

| # | プロンプト | 評価軸 | 判定 | ファイル数 (期待/実際) | 備考 |
|---|-----------|--------|------|----------------------|------|
| QE-101 | 表形式データ分類ベンチマーク | F,C,A | | 5 / | |
| QE-102 | 時系列予測とバックテスト | F,A,C | | 5 / | |
| QE-103 | A/B テスト統計解析パック | A,C,L | | 5 / | |
| QE-104 | 検出力分析と必要サンプル数試算 | A,C | | 4 / | |
| QE-105 | PCA とクラスタリング可視化 | F,C,A | | 5 / | |
| QE-106 | 回帰診断と残差解析 | A,C,E | | 5 / | |
| QE-107 | ブートストラップ信頼区間の推定 | A,C,F | | 4 / | |
| QE-108 | モンテカルロ法によるリスク評価 | F,C,A | | 5 / | |
| QE-109 | センサーデータ異常検知ワークフロー | F,C,E | | 5 / | |
| QE-110 | ベイズ更新の可視化レポート | A,C | | 4 / | |
| QE-111 | 数値積分アルゴリズム比較 | A,C,F | | 4 / | |
| QE-112 | 常微分方程式シミュレーション | F,C,A | | 4 / | |
| QE-113 | FFT による周波数解析 | A,C,F | | 5 / | |
| QE-114 | ハイパーパラメータ探索結果の整理 | F,C,A | | 5 / | |
| QE-115 | 確率予測のキャリブレーション評価 | A,C,M | | 5 / | |
| QE-116 | データドリフト検知レポート | F,C,E | | 5 / | |
| QE-117 | 再現可能な実験テンプレート | F,C,H | | 5 / | |
| QE-118 | Notebook とスクリプトの同内容化 | C,I,A | | 4 / | |
| QE-119 | 有限差分による熱拡散シミュレーション | F,C,A | | 4 / | |
| QE-120 | 不確実性伝播の可視化 | A,C,F | | 4 / | |
