# AIRA 品質評価プロンプト集 第5版（v2.1.0）

第5版: Infrastructure/DevOps（Terraform、Kubernetes、監視）、ドキュメント品質、API テスト、データシリアライズ。

---

## QE-81: Terraform による3層Web基盤の分割設計

- **評価軸**: A（応答品質）, J（ディレクトリ構造）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
中規模Webアプリ向けの Terraform 構成を作成してください。要件は以下です。

- VPC / サブネット / ルートを含む network モジュール
- アプリケーション実行基盤を表す compute モジュール
- マネージドDBを表す database モジュール
- dev 環境用のルートモジュール
- 変数と出力を明示

生成するファイル:
1. infra/terraform/modules/network/main.tf
2. infra/terraform/modules/network/variables.tf
3. infra/terraform/modules/network/outputs.tf
4. infra/terraform/modules/compute/main.tf
5. infra/terraform/modules/compute/variables.tf
6. infra/terraform/modules/compute/outputs.tf
7. infra/terraform/modules/database/main.tf
8. infra/terraform/modules/database/variables.tf
9. infra/terraform/envs/dev/main.tf
10. infra/terraform/README.md

実クラウドに依存しない汎用的な記述にし、README には `terraform init/plan/apply` の手順も含めてください。
```
- **期待成果**:
  - 10ファイルすべてが指定パスに生成される
  - modules と envs の責務分離が明確である
  - README に初期化・plan・apply・変数の説明が含まれる
- **判定ポイント**: Terraform 構成の実務性、ディレクトリ構造の正確性、説明文書の完成度

---

## QE-82: Kubernetes 本番向けマニフェスト一式

- **評価軸**: C（ファイル生成・検出）, F（E2E自動化）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
`payment-api` というサービスを Kubernetes にデプロイする前提で、以下のマニフェストを生成してください。

1. k8s/namespace.yaml
2. k8s/deployment.yaml
3. k8s/service.yaml
4. k8s/ingress.yaml
5. k8s/configmap.yaml
6. k8s/secret.example.yaml
7. k8s/hpa.yaml
8. k8s/networkpolicy.yaml

要件:
- コンテナポートは 8080
- `/health` ヘルスチェックを使用
- RollingUpdate を有効化
- Ingress は `/api/payments` をルーティング
- ConfigMap と Secret の責務を分離
- HPA は CPU 使用率 70% を閾値にする
```
- **期待成果**:
  - 8ファイルすべてが生成される
  - Deployment / Service / Ingress のポート・パス整合性が取れている
  - 運用に必要な HPA・NetworkPolicy・ヘルスチェックが含まれる
- **判定ポイント**: Kubernetes オブジェクト間の整合性と本番運用を意識した設定の妥当性

---

## QE-83: Helm チャートのテンプレート化

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, J（ディレクトリ構造）
- **難易度**: ★★★
- **プロンプト**:
```
Kubernetes で配布する `inventory-service` 用の Helm チャートを作成してください。

生成するファイル:
1. charts/inventory-service/Chart.yaml
2. charts/inventory-service/values.yaml
3. charts/inventory-service/templates/_helpers.tpl
4. charts/inventory-service/templates/deployment.yaml
5. charts/inventory-service/templates/service.yaml
6. charts/inventory-service/templates/ingress.yaml
7. charts/inventory-service/templates/hpa.yaml

要件:
- replicas, image tag, ingress host, resources を values.yaml から切り替え可能
- ラベルと fullname の helper を使う
- HPA と Ingress は values で有効/無効を切り替え可能
```
- **期待成果**:
  - 7ファイルすべてが Helm チャート構造で生成される
  - テンプレート変数が values.yaml と対応している
  - 再利用可能な helper と条件分岐が使われている
- **判定ポイント**: Helm チャートとしての再利用性、テンプレート品質、構造の正確性

---

## QE-84: Prometheus / Grafana 監視パックの作成

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
API サービスの監視パックを作成してください。

生成するファイル:
1. observability/prometheus.yml
2. observability/alert_rules.yml
3. observability/grafana-dashboard.json
4. observability/blackbox.yml
5. observability/README.md

要件:
- API のレイテンシ、エラー率、CPU 使用率を監視
- 5xx 増加時のアラートルールを追加
- Blackbox Exporter で `/health` を監視
- README にメトリクス一覧としきい値の説明を記載
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - Prometheus 設定・アラート・Grafana ダッシュボードの観点が揃っている
  - README に監視対象と想定運用が整理されている
- **判定ポイント**: 監視設計の網羅性、設定ファイル同士の整合性、運用ドキュメントの明瞭さ

---

## QE-85: OpenAPI 仕様からの API テスト資材生成

- **評価軸**: M（API整合性）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
以下の API 要件をもとに、OpenAPI 仕様と HTTP テスト資材を生成してください。

API:
- GET /users
- POST /users
- GET /users/{id}
- DELETE /users/{id}

生成するファイル:
1. api/openapi.yaml
2. api/tests/users.http
3. api/tests/users-negative.http
4. api/README.md

要件:
- OpenAPI には requestBody / response / error response を明記
- `.http` ファイルには正常系と異常系の具体例を含める
- README にテスト実行順と確認ポイントを書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - OpenAPI と HTTP テスト例のエンドポイント・スキーマが一致する
  - 正常系と異常系の検証観点が README に整理される
- **判定ポイント**: 仕様とテストケースの一致、API ドキュメントの実用性、異常系の具体性

---

## QE-86: REST API のエラー契約テスト設計

- **評価軸**: M（API整合性）, A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★☆
- **プロンプト**:
```
`/orders` API のエラー契約を検証する成果物を作成してください。

生成するファイル:
1. api/error_contract.json
2. api/error-cases.md
3. api/test_error_responses.py

要件:
- 400 / 401 / 404 / 409 / 422 / 500 のレスポンス例を定義
- error code, message, traceId のフィールドを統一
- Python テストではステータスコードと JSON キーを検証
```
- **期待成果**:
  - 3ファイルすべてが生成される
  - 主要エラーケースが重複なく整理される
  - レスポンス契約とテストコードの検証項目が一致する
- **判定ポイント**: エラー設計の一貫性、テスト可能性、契約定義の明確さ

---

## QE-87: Postman / Newman 回帰テストセット

- **評価軸**: F（E2E自動化）, M（API整合性）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
会員管理 API 向けの回帰テストセットを生成してください。

生成するファイル:
1. postman/member-api.collection.json
2. postman/local.environment.json
3. postman/run-newman.sh
4. postman/README.md

要件:
- create / get / update / delete の 4 操作を含める
- 環境変数で baseUrl と token を切り替えられるようにする
- Newman 実行例と期待終了コードを README に記載する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - Collection と environment の変数名が整合している
  - README に手順と回帰観点が具体的に記載される
- **判定ポイント**: API 回帰テストとしての実用性、変数設計の妥当性、実行手順の明快さ

---

## QE-88: YAML/JSON/TOML/CSV シリアライズ往復検証

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
同一データを複数フォーマットへ変換し、往復整合性を検証する資材を作成してください。

元データ項目:
- serviceName
- owner
- replicas
- enabledFeatures（配列）
- thresholds（warning / critical）

生成するファイル:
1. serialization/input.yaml
2. serialization/serialize.py
3. serialization/output.json
4. serialization/output.toml
5. serialization/output.csv
6. serialization/roundtrip-report.md

README ではなく roundtrip-report.md に、各形式で表現しにくい点も整理してください。
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - 各フォーマットで主要フィールドが欠落なく表現される
  - roundtrip-report.md に差異・制約・検証観点が記載される
- **判定ポイント**: シリアライズ変換の正確性、形式差の理解、検証レポートの具体性

---

## QE-89: Protocol Buffers と JSON マッピング設計

- **評価軸**: M（API整合性）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
注文イベントを gRPC / JSON の両方で扱う前提で、以下を作成してください。

生成するファイル:
1. contracts/order_events.proto
2. contracts/sample-order-created.json
3. contracts/sample-order-cancelled.json
4. contracts/mapping.md

要件:
- OrderCreated と OrderCancelled の 2 イベントを定義
- proto には enum と repeated field を含める
- mapping.md に proto ↔ JSON の対応表と互換性上の注意点を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - proto 定義と JSON サンプルの項目が一致する
  - mapping.md に型対応と互換性の説明が含まれる
- **判定ポイント**: スキーマ設計の一貫性、サンプルデータの妥当性、説明文書の明瞭さ

---

## QE-90: Avro スキーマ進化の互換性チェック資料

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
イベントストリームで利用する Avro スキーマの進化例を作成してください。

生成するファイル:
1. schemas/customer-v1.avsc
2. schemas/customer-v2.avsc
3. schemas/sample-events.json
4. schemas/compatibility-matrix.md

要件:
- v2 では nullable な email フィールドを追加
- v1 と v2 の後方互換性について説明
- sample-events.json には v1 / v2 の両サンプルを含める
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - v1 と v2 の差分が明確である
  - compatibility-matrix.md に互換性判断と理由が記載される
- **判定ポイント**: スキーマ進化の理解、サンプルの具体性、互換性説明の正確さ

---

## QE-91: ローカル観測環境の Docker Compose 設計

- **評価軸**: J（ディレクトリ構造）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
ローカルで observability を試すための Docker Compose 構成を作成してください。

生成するファイル:
1. local-observability/docker-compose.yml
2. local-observability/otel-collector-config.yaml
3. local-observability/loki-config.yml
4. local-observability/promtail-config.yml
5. local-observability/README.md

要件:
- app / otel-collector / loki / promtail の 4 サービスを定義
- ログとトレースの流れを README に文章で説明
- ヘルスチェックと依存関係も記述する
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - docker-compose.yml と各設定ファイルのサービス名が整合している
  - README に起動順とデータフローが説明される
- **判定ポイント**: ローカル検証環境としての再現性、設定整合性、説明の分かりやすさ

---

## QE-92: SLO / SLI 文書パックの作成

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★☆
- **プロンプト**:
```
決済 API の運用品質を定義する文書パックを作成してください。

生成するファイル:
1. docs/slo.md
2. docs/error-budget-policy.md
3. docs/alerting-policy.md
4. docs/service-dashboard-spec.yaml

要件:
- 可用性、レイテンシ、成功率の SLI を定義
- 30日ウィンドウの SLO 目標値を書く
- エラーバジェット消費時の運用ルールを明記
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - SLI とアラートポリシーの指標名が一致する
  - ドキュメントに目標値・測定方法・運用判断が含まれる
- **判定ポイント**: SRE 文書としての具体性、指標定義の一貫性、運用判断の明確さ

---

## QE-93: 障害対応ランブックと事後分析テンプレート

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★☆
- **プロンプト**:
```
「CPU 高騰で API がタイムアウトする」という障害シナリオ向けに、運用ドキュメントを作成してください。

生成するファイル:
1. runbooks/high-cpu-timeout.md
2. runbooks/escalation-matrix.md
3. runbooks/incident-template.md
4. runbooks/postmortem-template.md

要件:
- 初動、切り分け、暫定対応、恒久対応の順で整理
- 役割分担と連絡先の placeholder を含める
- 事後分析テンプレートには再発防止欄を含める
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - ランブックの手順が時系列で追える
  - インシデント記録とポストモーテムのテンプレートが実務的である
- **判定ポイント**: 障害対応文書の具体性、再利用性、運用フローの明瞭さ

---

## QE-94: Kubernetes オートスケーリングと保護ポリシー

- **評価軸**: C（ファイル生成・検出）, A（応答品質）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
高負荷時にも安定して動かすための Kubernetes ポリシー群を作成してください。

生成するファイル:
1. k8s/pdb.yaml
2. k8s/hpa.yaml
3. k8s/resourcequota.yaml
4. k8s/limitrange.yaml
5. k8s/vpa-recommendation.md

要件:
- PodDisruptionBudget で最小稼働 Pod 数を定義
- HPA は CPU と memory の両方を考慮
- LimitRange / ResourceQuota で namespace の上限を管理
- VPA は YAML ではなく推奨方針を Markdown にまとめる
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - HPA と Resource 制限の設計意図が矛盾しない
  - VPA 推奨方針に適用時の注意点が書かれる
- **判定ポイント**: スケーリング設計の現実性、保護ポリシーの整合性、説明の妥当性

---

## QE-95: Terraform の環境分離と tfvars 管理

- **評価軸**: J（ディレクトリ構造）, I（ファイル更新）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
Terraform の dev / stg / prod を分離するための基本ファイルを作成してください。

生成するファイル:
1. infra/terraform/providers.tf
2. infra/terraform/backend.hcl.example
3. infra/terraform/envs/dev/terraform.tfvars
4. infra/terraform/envs/stg/terraform.tfvars
5. infra/terraform/envs/prod/terraform.tfvars
6. infra/terraform/ENVIRONMENTS.md

要件:
- 各環境で instance_count と domain_name を変える
- backend は example として記述
- ENVIRONMENTS.md に environment ごとの差異表を載せる
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - 環境別 tfvars の差分が分かりやすい
  - 運用時に誤適用しないための注意点が文書化される
- **判定ポイント**: 環境分離の分かりやすさ、設定差分の妥当性、ドキュメントの安全性

---

## QE-96: k6 による API 負荷試験スクリプト群

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
`/login` と `/orders` API を対象に、k6 の負荷試験スクリプト群を作成してください。

生成するファイル:
1. performance/smoke.js
2. performance/load.js
3. performance/stress.js
4. performance/thresholds.md

要件:
- smoke / load / stress の 3 段階で設定を変える
- しきい値として p95 latency と error rate を定義
- thresholds.md に各シナリオの目的と合格条件を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 各スクリプトの目的が重複せず段階的である
  - しきい値定義とスクリプト内の checks が整合する
- **判定ポイント**: 負荷試験設計の実務性、シナリオの切り分け、しきい値の明確さ

---

## QE-97: JSON Schema バリデーション一式

- **評価軸**: L（入力バリデーション）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
注文作成 API の入力検証用に、JSON Schema と検証資材を作成してください。

生成するファイル:
1. validation/order.schema.json
2. validation/valid-order.json
3. validation/invalid-order.json
4. validation/validate_order.py

要件:
- customerId, items, currency, totalAmount を必須にする
- items は 1 件以上必要
- invalid-order.json では複数のバリデーション違反を含める
- Python スクリプトでは valid / invalid の結果を出し分ける
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - Schema の制約がサンプルデータに正しく反映される
  - 検証スクリプトの判定結果が期待どおり説明される
- **判定ポイント**: 入力バリデーションの厳密さ、サンプルの妥当性、テスト可能性

---

## QE-98: バックアップ / リストア手順の自動化資料

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
PostgreSQL バックアップ運用の基本セットを作成してください。

生成するファイル:
1. ops/backup.sh
2. ops/restore.sh
3. ops/retention-policy.md
4. ops/backup-cronjob.yaml

要件:
- shell script には日付付きファイル名を使う
- restore.sh には事前確認事項をコメントで入れる
- retention-policy.md には日次・週次・月次の保持方針を書く
- CronJob は毎日 2:00 実行にする
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - バックアップとリストアの手順が対応している
  - 保持方針と CronJob 設定が矛盾しない
- **判定ポイント**: 運用手順の実用性、スクリプト安全性、スケジュール設計の妥当性

---

## QE-99: API ドキュメント品質ガイドライン

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★☆
- **プロンプト**:
```
API ドキュメント品質を揃えるためのガイドラインを作成してください。

生成するファイル:
1. docs/api-guidelines.md
2. docs/pagination.md
3. docs/idempotency.md
4. docs/examples.http

要件:
- 命名規約、エラーレスポンス、サンプル記述ルールを api-guidelines.md にまとめる
- pagination.md では cursor と offset の使い分けを説明
- idempotency.md では POST 再送時の扱いを説明
- examples.http には 3 つ以上の具体例を入れる
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - ガイドライン、補足文書、HTTP 例が相互に矛盾しない
  - 例示が抽象論に留まらず具体的である
- **判定ポイント**: ドキュメント品質基準の明確さ、例の実用性、API 整合性の説明力

---

## QE-100: 構造化ログとアラート連携設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
アプリケーションログを監視基盤へ連携するための設計ファイルを作成してください。

生成するファイル:
1. logging/log-schema.json
2. logging/fluent-bit.conf
3. logging/alert-rules.yml
4. logging/observability-checklist.md

要件:
- log-schema.json には timestamp, level, service, traceId, message, metadata を含める
- fluent-bit.conf では JSON ログを取り込んで出力する前提とする
- alert-rules.yml では error level の急増を検知
- checklist には本番投入前チェックを 10 項目以上記載
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - ログスキーマ、収集設定、アラート条件が整合している
  - チェックリストが具体的で検証可能である
- **判定ポイント**: ログ基盤設計の一貫性、監視連携の妥当性、チェック項目の実用性

---

## 評価結果テンプレート

| # | プロンプト | 評価軸 | 判定 | ファイル数 (期待/実際) | 備考 |
|---|-----------|--------|------|----------------------|------|
| QE-81 | Terraform による3層Web基盤の分割設計 | A,J,C | | 10 / | |
| QE-82 | Kubernetes 本番向けマニフェスト一式 | C,F,M | | 8 / | |
| QE-83 | Helm チャートのテンプレート化 | A,C,J | | 7 / | |
| QE-84 | Prometheus / Grafana 監視パックの作成 | F,C,A | | 5 / | |
| QE-85 | OpenAPI 仕様からの API テスト資材生成 | M,C,F | | 4 / | |
| QE-86 | REST API のエラー契約テスト設計 | M,A,C | | 3 / | |
| QE-87 | Postman / Newman 回帰テストセット | F,M,C | | 4 / | |
| QE-88 | YAML/JSON/TOML/CSV シリアライズ往復検証 | A,C,L | | 6 / | |
| QE-89 | Protocol Buffers と JSON マッピング設計 | M,C,A | | 4 / | |
| QE-90 | Avro スキーマ進化の互換性チェック資料 | A,C,L | | 4 / | |
| QE-91 | ローカル観測環境の Docker Compose 設計 | J,C,F | | 5 / | |
| QE-92 | SLO / SLI 文書パックの作成 | A,C | | 4 / | |
| QE-93 | 障害対応ランブックと事後分析テンプレート | A,C,H | | 4 / | |
| QE-94 | Kubernetes オートスケーリングと保護ポリシー | C,A,L | | 5 / | |
| QE-95 | Terraform の環境分離と tfvars 管理 | J,I,C | | 6 / | |
| QE-96 | k6 による API 負荷試験スクリプト群 | F,C,M | | 4 / | |
| QE-97 | JSON Schema バリデーション一式 | L,C,A | | 4 / | |
| QE-98 | バックアップ / リストア手順の自動化資料 | F,C,A | | 4 / | |
| QE-99 | API ドキュメント品質ガイドライン | A,C,M | | 4 / | |
| QE-100 | 構造化ログとアラート連携設計 | A,C,F | | 4 / | |
