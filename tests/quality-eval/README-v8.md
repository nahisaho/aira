# AIRA 品質評価プロンプト集 第8版（v2.1.0）

第8版: システム設計、アーキテクチャ文書、マイクロサービス、イベント駆動、CQRS、ドメインモデリング。

---

## QE-141: C4 モデルによる全体アーキテクチャ文書

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, J（ディレクトリ構造）
- **難易度**: ★★★
- **プロンプト**:
```
EC プラットフォームを題材に、C4 モデルのアーキテクチャ文書一式を作成してください。

生成するファイル:
1. architecture/context.md
2. architecture/container.mmd
3. architecture/component.mmd
4. architecture/deployment.mmd
5. architecture/adr-001-overview.md

要件:
- 利用者、外部決済、在庫システムを登場させる
- Context/Container/Component/Deployment の粒度を分ける
- ADR には主要な設計判断を簡潔にまとめる
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - C4 各レベルの記述粒度が適切に分かれている
  - ADR にアーキテクチャ選定理由が含まれる
- **判定ポイント**: アーキテクチャ文書の体系性、図と文章の整合性、判断理由の明確さ

---

## QE-142: 境界づけられたコンテキストの定義

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
サブスクリプション SaaS を題材に、ドメイン境界を整理してください。

生成するファイル:
1. ddd/context-map.md
2. ddd/context-map.mmd
3. ddd/domain-glossary.md
4. ddd/integrations.yaml

要件:
- Billing, Identity, Tenant Management, Analytics の 4 コンテキストを含める
- Shared Kernel / Customer-Supplier など関係性を図で表す
- glossary には同音異義語になりやすい語を 8 件以上整理する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 文書と図でコンテキスト関係が一致する
  - glossary が境界の違いを説明できている
- **判定ポイント**: DDD 文脈整理の妥当性、用語定義の明確さ、図表の分かりやすさ

---

## QE-143: イベントストーミング成果物の作成

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
注文処理ドメインのイベントストーミング成果物を作成してください。

生成するファイル:
1. event-storming/event-storming.md
2. event-storming/events.json
3. event-storming/commands.json
4. event-storming/policies.md

要件:
- 注文作成から配送完了までの主要イベントを時系列で並べる
- command と event の責務を分ける
- policies.md に自動化ルールと人手判断を分けて記載
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - イベント、コマンド、ポリシーの関係が明確である
  - 時系列フローが文書から追跡できる
- **判定ポイント**: イベントストーミングの整理品質、役割分離、実務で使える粒度

---

## QE-144: モノリス分割のサービス候補分析

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
既存モノリスをマイクロサービスへ分割する前提で、分析成果物を作成してください。

生成するファイル:
1. decomposition/decomposition.md
2. decomposition/service-catalog.yaml
3. decomposition/seams-analysis.md
4. decomposition/api-boundaries.mmd

要件:
- Catalog, Checkout, Payments, Notifications の候補サービスを含める
- seams-analysis.md に「今は分割しない領域」も書く
- API 境界図では同期通信と非同期通信を区別する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - サービス候補と境界図の分割方針が一致する
  - 分割しない判断の理由が明記される
- **判定ポイント**: 分割戦略の現実性、境界設計の明確さ、判断理由の説得力

---

## QE-145: API Gateway と BFF の設計比較

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
Web と Mobile の両クライアントを持つ前提で、Gateway / BFF 設計資料を作成してください。

生成するファイル:
1. gateway/gateway-architecture.md
2. gateway/bff-web.yaml
3. gateway/bff-mobile.yaml
4. gateway/request-flow.mmd

要件:
- 認証、集約、レスポンス最適化の責務を整理
- Web と Mobile でレスポンス最適化方針を変える
- Mermaid 図でリクエストフローを表現
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 2 つの BFF 仕様差分が明確である
  - アーキテクチャ文書とフロー図の責務分担が一致する
- **判定ポイント**: BFF 設計の妥当性、クライアント別最適化の具体性、API 境界の明確さ

---

## QE-146: CQRS 注文サービスの読み書き分離

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
注文サービスを CQRS で設計した成果物を作成してください。

生成するファイル:
1. cqrs/cqrs-overview.md
2. cqrs/command-model.ts
3. cqrs/read-model.json
4. cqrs/event-flow.mmd
5. cqrs/api-contract.yaml

要件:
- Command 側は CreateOrder / CancelOrder を扱う
- Read 側は注文一覧と詳細表示を想定する
- eventual consistency の説明を overview に含める
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - command model と read model の責務が分離されている
  - イベントフローと API contract が整合する
- **判定ポイント**: CQRS 理解の正確性、読み書き分離の明快さ、ファイル間整合性

---

## QE-147: Saga オーケストレーション設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
注文・決済・在庫サービスをまたぐ Saga オーケストレーション設計を作成してください。

生成するファイル:
1. saga/saga-design.md
2. saga/orchestrator-state-machine.mmd
3. saga/compensation-matrix.md
4. saga/message-contracts.yaml

要件:
- 正常系と補償トランザクションを両方扱う
- compensation-matrix.md に失敗箇所ごとの巻き戻し策を書く
- message-contracts.yaml にコマンドとイベントの一覧をまとめる
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 状態機械と補償表の内容が一致する
  - メッセージ契約が Saga 設計に沿っている
- **判定ポイント**: 分散トランザクション設計の妥当性、補償戦略の具体性、文書整合性

---

## QE-148: Outbox / Inbox パターンの導入資料

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, K（並行安全性）
- **難易度**: ★★★
- **プロンプト**:
```
イベント重複配信に備える Outbox / Inbox パターンの資料を作成してください。

生成するファイル:
1. reliability/outbox-pattern.md
2. reliability/schemas.sql
3. reliability/consumer-idempotency.md
4. reliability/sequence.mmd

要件:
- DB トランザクションとイベント送信の整合性を説明
- schemas.sql に outbox と inbox テーブルを含める
- consumer-idempotency.md に重複処理防止のキー設計を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - SQL スキーマと文書の用語が一致する
  - 重複配信対策が具体的に説明される
- **判定ポイント**: メッセージ信頼性設計の理解、冪等性説明の具体性、図と文書の整合性

---

## QE-149: 集約設計と不変条件の整理

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
EC ドメインの Aggregate 設計を整理してください。

生成するファイル:
1. domain/aggregates.md
2. domain/order-aggregate.ts
3. domain/inventory-aggregate.ts
4. domain/invariants-checklist.md

要件:
- Order と Inventory の責務を分ける
- 不変条件を checklist に 10 項目以上書く
- TypeScript ではメソッド名から業務操作が分かるようにする
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 文書と TypeScript サンプルで集約境界が一致する
  - 不変条件が具体的で検証可能である
- **判定ポイント**: ドメインモデリングの正確性、不変条件の明確さ、サンプルコードの妥当性

---

## QE-150: アーキテクチャ決定記録（ADR）セット

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★☆
- **プロンプト**:
```
新規サービス基盤の ADR セットを作成してください。

生成するファイル:
1. adr/adr-001-postgres.md
2. adr/adr-002-kafka.md
3. adr/adr-003-redis.md
4. adr/decision-summary.md

要件:
- 各 ADR に Context / Decision / Consequences を含める
- summary では 3 つの決定間の関係を簡潔に説明
- トレードオフを明示する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - ADR フォーマットが統一されている
  - decision-summary.md に全体整合性が説明される
- **判定ポイント**: ADR 文書品質、トレードオフの明確さ、複数決定の整合性

---

## QE-151: 回復性を重視したサービス間通信設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
サービス間通信の回復性パターンを整理してください。

生成するファイル:
1. resilience/resilience.md
2. resilience/circuit-breaker-policy.yaml
3. resilience/retry-matrix.md
4. resilience/dependency-map.mmd

要件:
- timeout, retry, circuit breaker の適用方針を分ける
- retry-matrix.md に API ごとの再試行可否を整理
- dependency map に同期依存関係を示す
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 再試行方針と circuit breaker 条件が矛盾しない
  - 依存関係図からボトルネック候補が読み取れる
- **判定ポイント**: 回復性設計の実務性、ポリシー整合性、可視化の有用性

---

## QE-152: マルチテナント SaaS の分離戦略

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
マルチテナント SaaS のアーキテクチャ資料を作成してください。

生成するファイル:
1. tenancy/tenancy-model.md
2. tenancy/tenant-isolation.md
3. tenancy/schema-strategy.mmd
4. tenancy/provisioning-flow.md

要件:
- shared schema / separate schema の比較を入れる
- tenant isolation.md に認可とデータ隔離の両面を書く
- provisioning-flow.md にテナント作成から初期化までの流れを書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 分離戦略の比較軸が明確である
  - 認可とデータ隔離の説明が混同されていない
- **判定ポイント**: マルチテナント設計の理解、比較の明確さ、セキュリティ観点の具体性

---

## QE-153: 分散トレーシングを含む観測性設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
マイクロサービス環境向けの observability 設計資料を作成してください。

生成するファイル:
1. observability/architecture.md
2. observability/trace-propagation.mmd
3. observability/log-correlation.md
4. observability/telemetry-schema.json

要件:
- traceId / spanId の伝播を図で表す
- log correlation.md にログとトレースの関連付け方法を書く
- telemetry-schema.json に service, operation, duration_ms などを含める
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 図、スキーマ、説明文で観測データの流れが一致する
  - 分散トレーシングの利用目的が明確である
- **判定ポイント**: 観測性設計の一貫性、分散トレース理解、スキーマ品質

---

## QE-154: イベントスキーマのバージョニング戦略

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
イベント駆動基盤におけるスキーマバージョニング戦略を作成してください。

生成するファイル:
1. schema-versioning/schema-versioning.md
2. schema-versioning/event-v1.json
3. schema-versioning/event-v2.json
4. schema-versioning/compatibility-matrix.md

要件:
- v2 では新フィールド追加と deprecated 項目を含める
- compatibility-matrix.md に producer / consumer 組み合わせを整理
- migration 手順を schema-versioning.md に書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - v1/v2 の差分と互換性判断が明確である
  - 移行手順が consumer 影響を考慮している
- **判定ポイント**: イベント契約管理の理解、互換性説明の正確さ、移行戦略の実用性

---

## QE-155: マルチリージョン障害復旧計画

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
マルチリージョン構成の障害復旧計画を作成してください。

生成するファイル:
1. dr/dr-plan.md
2. dr/rto-rpo-table.md
3. dr/failover-sequence.mmd
4. dr/backup-topology.md

要件:
- RTO / RPO を表で明示
- フェイルオーバー手順を時系列で図示
- backup-topology.md にバックアップの保管場所と復元順を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - RTO/RPO と復旧手順が矛盾しない
  - 復旧フローが具体的で検証観点を持つ
- **判定ポイント**: DR 計画の現実性、数値目標の明確さ、運用手順の具体性

---

## QE-156: CDN とキャッシュ無効化設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★☆
- **プロンプト**:
```
Web サービスの CDN / Cache 設計資料を作成してください。

生成するファイル:
1. cache/caching-architecture.md
2. cache/invalidation-flow.mmd
3. cache/cache-key-policy.md
4. cache/edge-config.yaml

要件:
- 静的資産と API レスポンスのキャッシュ戦略を分ける
- invalidation の起点と反映範囲を図にする
- cache-key-policy.md に vary 条件を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - キャッシュ戦略と edge 設定の整合性がある
  - 無効化フローが具体的で追跡可能である
- **判定ポイント**: キャッシュ設計の妥当性、フロー図の明確さ、API 整合性への配慮

---

## QE-157: Choreography と Orchestration の比較設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★★
- **プロンプト**:
```
イベント駆動システムでの Choreography と Orchestration の比較資料を作成してください。

生成するファイル:
1. patterns/comparison.md
2. patterns/choreography-flow.mmd
3. patterns/orchestration-flow.mmd
4. patterns/recommendation.md

要件:
- 同一ユースケース（注文処理）で 2 方式を比較
- comparison.md に利点/欠点/監視性/変更容易性の表を含める
- recommendation.md に採用案と理由を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 2 方式の差分が図と文章で一貫している
  - 推奨案の根拠が比較表に基づいている
- **判定ポイント**: アーキテクチャ比較の公平性、根拠の明確さ、図表品質

---

## QE-158: Anti-Corruption Layer 設計資料

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
レガシー受注システムと新ドメインモデルを接続する Anti-Corruption Layer の資料を作成してください。

生成するファイル:
1. acl/acl-design.md
2. acl/translation-rules.yaml
3. acl/legacy-to-domain-mapping.md
4. acl/sequence.mmd

要件:
- レガシー項目名と新ドメイン用語の差を明示
- translation-rules.yaml に変換規則を列挙
- sequence 図で ACL の責務を示す
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 変換規則と mapping 文書の用語対応が一致する
  - ACL の責務が過不足なく説明される
- **判定ポイント**: レガシー統合設計の明確さ、変換規則の具体性、API 境界の整理

---

## QE-159: 注文ライフサイクルのシーケンス設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★★
- **プロンプト**:
```
注文ライフサイクルを表す設計資料を作成してください。

生成するファイル:
1. lifecycle/order-lifecycle.mmd
2. lifecycle/state-machine.mmd
3. lifecycle/lifecycle-notes.md
4. lifecycle/event-catalog.yaml

要件:
- created / paid / packed / shipped / delivered / cancelled を扱う
- sequence と state machine の両方で整合性を取る
- event catalog に各イベントの発火条件を書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 状態遷移図とシーケンス図の流れが矛盾しない
  - event catalog が状態変化と対応している
- **判定ポイント**: ライフサイクル設計の一貫性、イベント整理の丁寧さ、図表の明瞭さ

---

## QE-160: REST 中心構成からイベント駆動への移行計画

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
既存の REST API 中心システムを段階的にイベント駆動へ移行する計画を作成してください。

生成するファイル:
1. migration/migration-roadmap.md
2. migration/phase-plan.yaml
3. migration/cutover-checklist.md
4. migration/risk-register.md

要件:
- フェーズを 3 段階以上に分ける
- 併存期間のデータ二重書き込みリスクを扱う
- cutover-checklist.md に Go / No-Go 判定項目を含める
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - roadmap、phase-plan、risk-register の内容が一致する
  - 移行リスクと判定基準が具体的に整理される
- **判定ポイント**: 移行計画の現実性、リスク管理の具体性、段階設計の明瞭さ

---

## 評価結果テンプレート

| # | プロンプト | 評価軸 | 判定 | ファイル数 (期待/実際) | 備考 |
|---|-----------|--------|------|----------------------|------|
| QE-141 | C4 モデルによる全体アーキテクチャ文書 | A,C,J | | 5 / | |
| QE-142 | 境界づけられたコンテキストの定義 | A,C | | 4 / | |
| QE-143 | イベントストーミング成果物の作成 | A,C,F | | 4 / | |
| QE-144 | モノリス分割のサービス候補分析 | A,C,E | | 4 / | |
| QE-145 | API Gateway と BFF の設計比較 | A,C,M | | 4 / | |
| QE-146 | CQRS 注文サービスの読み書き分離 | A,C,M | | 5 / | |
| QE-147 | Saga オーケストレーション設計 | A,C,F | | 4 / | |
| QE-148 | Outbox / Inbox パターンの導入資料 | A,C,K | | 4 / | |
| QE-149 | 集約設計と不変条件の整理 | A,C | | 4 / | |
| QE-150 | アーキテクチャ決定記録（ADR）セット | A,C,H | | 4 / | |
| QE-151 | 回復性を重視したサービス間通信設計 | A,C,E | | 4 / | |
| QE-152 | マルチテナント SaaS の分離戦略 | A,C,L | | 4 / | |
| QE-153 | 分散トレーシングを含む観測性設計 | A,C,F | | 4 / | |
| QE-154 | イベントスキーマのバージョニング戦略 | A,C,M | | 4 / | |
| QE-155 | マルチリージョン障害復旧計画 | A,C,F | | 4 / | |
| QE-156 | CDN とキャッシュ無効化設計 | A,C,M | | 4 / | |
| QE-157 | Choreography と Orchestration の比較設計 | A,C | | 4 / | |
| QE-158 | Anti-Corruption Layer 設計資料 | A,C,M | | 4 / | |
| QE-159 | 注文ライフサイクルのシーケンス設計 | A,C,H | | 4 / | |
| QE-160 | REST 中心構成からイベント駆動への移行計画 | A,C,F | | 4 / | |
