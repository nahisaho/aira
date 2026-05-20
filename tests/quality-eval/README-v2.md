# AIRA 品質評価プロンプト集 第2版（v2.1.0）

第1版（README.md）で発見した6件の問題を修正後、新たな視点で設計した
**20本の品質評価プロンプト**です。第1版と重複しないシナリオを選定しています。

## 追加評価軸

第1版の8軸に加え、以下を追加:

| # | 評価軸 | 説明 |
|---|--------|------|
| I | **ファイル更新・上書き** | 既存ファイルの編集・差分適用の正確性 |
| J | **ディレクトリ構造** | ネストされたディレクトリ作成・管理 |
| K | **並行安全性** | 複数プロジェクト/同時実行時のリソース分離 |
| L | **入力バリデーション** | 異常入力・境界値への堅牢性 |

## 判定基準

第1版と同一（Pass / Partial / Fail の3段階）

---

## QE-21: ファイル上書き検出

- **評価軸**: I（ファイル更新）、C（ファイル検出）
- **難易度**: ★★☆
- **プロンプト（2ターン）**:
```
ターン1: 「config.yaml を作成してください。内容: server.port=3000, db.host=localhost」
ターン2: 「config.yaml のポートを 8080 に変更し、db.host を db.example.com に変更してください」
```
- **期待成果**:
  - ターン1で config.yaml が新規作成される
  - ターン2で config.yaml が上書き（edit）される
  - ファイル一覧で最新版が反映される
  - ファイルハッシュが更新される
- **判定ポイント**: edit ツールによる変更がファイル検出に正しく反映されるか

---

## QE-22: 深いネストディレクトリ

- **評価軸**: J（ディレクトリ構造）、C（ファイル検出）
- **難易度**: ★★★
- **プロンプト**:
```
以下のディレクトリ構造でプロジェクトを作成してください:

src/
  domain/
    entities/
      user.ts
      product.ts
    repositories/
      user-repository.ts
      product-repository.ts
  application/
    use-cases/
      create-user.ts
      list-products.ts
  infrastructure/
    database/
      prisma-client.ts
  index.ts

各ファイルには適切なTypeScriptコードを含めてください。
Clean Architecture パターンに従ってください。
```
- **期待成果**:
  - 8ファイルすべてが正しいパスに生成される
  - 3階層のネストが正しく作成される
  - import パスが正しく設定される
- **判定ポイント**: 深いディレクトリ構造でのファイル検出完全性

---

## QE-23: コードリファクタリング（複数ファイル同時編集）

- **評価軸**: I（ファイル更新）、E（デバッグ）
- **難易度**: ★★★
- **プロンプト（2ターン）**:
```
ターン1: 以下の2ファイルを作成してください:
- calculator.py: add, subtract, multiply, divide 関数
- main.py: calculator を import して使うスクリプト

ターン2: calculator.py の全関数にログ出力を追加し、main.py のインポートパスを
calculator モジュールからのインポートに変更してください。
変更前後の差分も表示してください。
```
- **期待成果**:
  - ターン1で2ファイル作成
  - ターン2で両ファイルが適切に編集される
  - 差分が表示される
- **判定ポイント**: multi_edit ツールの正確性

---

## QE-24: 特殊文字を含むプロンプト

- **評価軸**: L（入力バリデーション）
- **難易度**: ★★☆
- **プロンプト**:
```
以下の特殊文字を含むデータを処理するPythonスクリプトを作成してください:

data = {
    "名前": "田中太郎（仮名）",
    "email": "user+test@example.com",
    "path": "C:\\Users\\test\\file.txt",
    "query": "SELECT * FROM users WHERE name='O'Brien'",
    "emoji": "🎉🚀💻",
    "newline": "行1\n行2\n行3"
}

各フィールドを安全にJSON出力するスクリプトを data_handler.py として保存してください。
```
- **期待成果**:
  - 特殊文字がエスケープされず正しく処理される
  - data_handler.py が生成される
  - SQLインジェクション等の注意点が言及される
- **判定ポイント**: 特殊文字のパーススルー安全性

---

## QE-25: 5ターン連続会話

- **評価軸**: H（セッション継続性）、A（応答品質）
- **難易度**: ★★★
- **プロンプト（5ターン）**:
```
ターン1: 「チェスのナイトの動きをシミュレートするクラスを Python で作ってください」
ターン2: 「ナイトツアー問題を解くメソッドを追加してください（バックトラッキング法）」
ターン3: 「5x5 盤面でのナイトツアーを実行し、結果を表示してください」
ターン4: 「実行結果を chess_knight_tour.md に保存してください」
ターン5: 「ここまでのコード全体を knight_tour.py としてまとめ直してください」
```
- **期待成果**:
  - 5ターンを通じてクラスが段階的に拡張される
  - 前ターンのコードが失われない
  - 最終ファイル (knight_tour.py, chess_knight_tour.md) が生成される
- **判定ポイント**: 長い会話でのコンテキスト維持と一貫性

---

## QE-26: 設定ファイル群の一括生成

- **評価軸**: C（ファイル生成）、F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
Node.js プロジェクトの設定ファイルを一括生成してください:
1. package.json — name: "my-api", TypeScript + Express 依存
2. tsconfig.json — strict mode, ES2022 target
3. .eslintrc.json — TypeScript 用ルール
4. .prettierrc — singleQuote, semi: false
5. Dockerfile — Node 20 Alpine, multi-stage build
6. docker-compose.yml — app + PostgreSQL + Redis
7. .env.example — 必要な環境変数のテンプレート
8. .gitignore — Node.js + TypeScript 用

8ファイルすべてを生成してください。
```
- **期待成果**:
  - 8ファイルすべてが生成される
  - 各ファイルのフォーマットが正しい（JSON, YAML, TOML 等）
  - ファイル間の整合性（package.json と tsconfig.json の矛盾なし等）
- **判定ポイント**: 多フォーマット設定ファイルの生成完全性

---

## QE-27: エラーを含むコードの段階的修正

- **評価軸**: E（デバッグ・自己修復）、I（ファイル更新）
- **難易度**: ★★★
- **プロンプト**:
```
以下のバグを含む Python コードを buggy.py として保存し、
バグを1つずつ修正して最終的に動作するコードにしてください。
修正ごとにどのバグを直したか説明してください。

class UserManager:
    def __init__(self):
        self.users = {}

    def add_user(self, name, age):
        self.users[name] = {"name": name, "age": age}
        return True

    def get_user(self, name):
        return self.users[name]  # Bug 1: KeyError if not found

    def delete_user(self, name):
        del self.users[name]  # Bug 2: KeyError if not found
        return True

    def get_average_age(self):
        total = sum(u["age"] for u in self.users.values())
        return total / len(self.users)  # Bug 3: ZeroDivisionError

    def find_users_by_age(self, min_age, max_age):
        return [u for u in self.users if u["age"] >= min_age]  # Bug 4: iterating keys not values
```
- **期待成果**:
  - 4つのバグすべてが特定される
  - 段階的な修正が行われる
  - 最終的に正しく動作するコード
- **判定ポイント**: バグの正確な特定と安全な修正

---

## QE-28: 大量データ生成と処理

- **評価軸**: C（ファイル生成）、F（E2E自動化）
- **難易度**: ★★★
- **プロンプト**:
```
以下の一連の処理を実行してください:

1. generate_data.py を作成: 10,000件のダミー顧客データ（名前, 年齢, 都道府県, 購入金額）をCSV出力
2. analyze_data.py を作成: CSVを読み込み以下を計算
   - 都道府県別の平均購入金額トップ5
   - 年齢層別（10代〜60代）の購入傾向
   - 外れ値の検出（IQR法）
3. visualize_data.py を作成: 分析結果を3つのグラフ（棒, 箱ひげ, ヒストグラム）でPNG出力
4. report.md を作成: 分析結果のまとめ

4つのPyファイル + 3つのPNG + 1つのCSV + 1つのMDファイルを生成してください。
```
- **期待成果**:
  - 合計9ファイル以上が生成される
  - スクリプト間のデータフローが一貫
  - AIRA のファイル一覧に全ファイル表示
- **判定ポイント**: 大量ファイル生成と相互依存の解決

---

## QE-29: Markdown テーブルの複雑な生成

- **評価軸**: A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
以下の3つの表を Markdown で作成してください:

1. 日本の政令指定都市20市の人口・面積・人口密度の比較表（推定値で可）
2. 主要プログラミング言語10言語の比較表（型システム, パラダイム, 用途, 学習コスト）
3. AWS vs Azure vs GCP のサービス比較表（コンピュート, ストレージ, DB, ML, 価格帯）

3つの表を comparison_tables.md として保存してください。
```
- **期待成果**:
  - 3つの表すべてが正しい Markdown テーブル構文
  - データが概ね正確
  - comparison_tables.md が生成される
- **判定ポイント**: 複雑なテーブル生成の正確性

---

## QE-30: シェルコマンド実行とファイル検出

- **評価軸**: C（ファイル検出）、E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
bash コマンドで以下を実行してください:

1. mkdir -p output/reports
2. echo "# Project Report" > output/reports/report.md
3. date >> output/reports/report.md
4. ls -la > output/reports/directory_listing.txt
5. python3 -c "import json; json.dump({'status': 'ok', 'timestamp': '2024-01-01'}, open('output/reports/status.json', 'w'), indent=2)"

その後、output/reports/ ディレクトリの全ファイルをリストアップしてください。
```
- **期待成果**:
  - シェルコマンドが正常に実行される
  - 3ファイル (report.md, directory_listing.txt, status.json) が作成される
  - シェルで作成されたファイルも post-run scan で検出される
- **判定ポイント**: tool.execution_complete 以外の方法で作成されたファイルの検出

---

## QE-31: RAG コンテキストの精度検証

- **評価軸**: G（RAGコンテキスト）、A（応答品質）
- **難易度**: ★★★
- **プロンプト（3ターン）**:
```
ターン1: 「プロジェクトのコーディング規約: 変数名はcamelCase、関数はsnake_case、
クラスはPascalCase。インデントは4スペース。行の最大長は120文字。
コメントは日本語で書く。テストフレームワークはpytest。
CI/CDはGitHub Actionsを使用。ブランチ戦略はGit Flow。」

ターン2: 「新しいユーティリティモジュール utils.py を作成してください」

ターン3: 「テストファイル test_utils.py も作成してください」
```
- **期待成果**:
  - ターン2-3で RAG から規約情報が注入される
  - 変数名が camelCase、関数が snake_case に従う
  - テストフレームワークが pytest
  - コメントが日本語
- **判定ポイント**: RAG の知識が実際のコード生成に反映されるか

---

## QE-32: 非常に長いプロンプト

- **評価軸**: L（入力バリデーション）、A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
以下の50項目のチェックリストを checklist.md として保存してください:

1. プロジェクト計画書の作成
2. 要件定義書のレビュー
3. システムアーキテクチャの設計
4. データベーススキーマの設計
5. API仕様書の作成
6. フロントエンド画面設計
7. バックエンドモジュール設計
8. 認証・認可方式の決定
9. エラーハンドリング方針の策定
10. ログ出力方針の策定
11. セキュリティ要件の確認
12. パフォーマンス要件の確認
13. テスト計画の作成
14. 単体テストの実装
15. 結合テストの実装
16. E2Eテストの実装
17. CI/CDパイプラインの構築
18. ステージング環境の構築
19. 本番環境の構築
20. 監視・アラートの設定
21. バックアップ方針の策定
22. 障害復旧手順の作成
23. 運用手順書の作成
24. ユーザーマニュアルの作成
25. API ドキュメントの整備
26. コードレビュー規約の策定
27. ブランチ戦略の決定
28. リリース手順の策定
29. ホットフィックス手順の策定
30. 依存ライブラリの選定
31. ライセンス確認
32. 脆弱性スキャンの設定
33. アクセシビリティ対応
34. 多言語対応方針の策定
35. レスポンシブデザインの確認
36. ブラウザ互換性テスト
37. モバイル対応テスト
38. 負荷テストの実施
39. セキュリティテストの実施
40. コード品質メトリクスの設定
41. 技術的負債の棚卸し
42. チーム開発環境の統一
43. オンボーディング文書の作成
44. ナレッジベースの構築
45. 振り返り（レトロスペクティブ）の実施
46. KPIの設定
47. SLAの定義
48. データ移行計画の作成
49. カットオーバー計画の作成
50. プロジェクト完了報告書の作成

各項目に状態列（未着手/進行中/完了）とメモ列を追加してください。
```
- **期待成果**:
  - 50項目すべてが含まれるチェックリスト
  - Markdown テーブルフォーマット
  - checklist.md が生成される
  - プロンプトが途中で切れない
- **判定ポイント**: 長大プロンプトの完全な処理

---

## QE-33: テンプレートエンジン風生成

- **評価軸**: A（応答品質）、C（ファイル生成）
- **難易度**: ★★★
- **プロンプト**:
```
以下のテンプレートを使い、3つのマイクロサービスのボイラープレートを生成してください:

サービス一覧:
1. user-service (ポート: 3001)
2. order-service (ポート: 3002)
3. notification-service (ポート: 3003)

各サービスに以下のファイルを作成:
- {service}/src/index.ts — Express サーバー起動
- {service}/src/routes.ts — CRUD ルート定義
- {service}/package.json — サービス名とポート設定

合計9ファイルを生成してください。
```
- **期待成果**:
  - 9ファイルすべてが生成される
  - 各サービスのポート番号が正しい
  - package.json の name が各サービス名と一致
- **判定ポイント**: テンプレート展開の正確性と9ファイルの完全検出

---

## QE-34: コード変換（言語間トランスパイル）

- **評価軸**: A（応答品質）、I（ファイル更新）
- **難易度**: ★★★
- **プロンプト（2ターン）**:
```
ターン1: 以下の Python コードを python_version.py として保存してください:

class Stack:
    def __init__(self):
        self._items = []
    
    def push(self, item):
        self._items.append(item)
    
    def pop(self):
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items.pop()
    
    def peek(self):
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items[-1]
    
    def is_empty(self):
        return len(self._items) == 0
    
    def size(self):
        return len(self._items)

ターン2: この Stack クラスを TypeScript に変換して typescript_version.ts として保存してください。
ジェネリクスを使用し、テストコードも stack.test.ts として作成してください。
```
- **期待成果**:
  - python_version.py が正確に保存される
  - typescript_version.ts がジェネリクス版 Stack を含む
  - stack.test.ts にテストケース
  - 3ファイルが検出される
- **判定ポイント**: 言語変換の正確性と型安全性

---

## QE-35: 日本語のみの技術文書生成

- **評価軸**: A（応答品質）、F（E2E自動化）
- **難易度**: ★★☆
- **プロンプト**:
```
以下の技術文書を完全に日本語で作成してください:

1. architecture.md — システムアーキテクチャ文書
   - 概要（200字程度）
   - 構成図（Mermaid記法）
   - 各コンポーネントの責務
   - データフロー

2. api-spec.md — API仕様書
   - エンドポイント一覧（5件以上）
   - リクエスト/レスポンス例
   - エラーコード一覧

テーマ: オンライン書店システム
```
- **期待成果**:
  - 2ファイルが日本語で作成される
  - Mermaid 記法が含まれる
  - API 仕様が正しい JSON 例を含む
- **判定ポイント**: 日本語技術文書の品質と構成の完全性

---

## QE-36: 条件分岐を含む複雑な指示

- **評価軸**: A（応答品質）、E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
Python で以下の条件を満たすバリデーションライブラリを作成してください:

validate.py:
- validate_email(s): RFC 5322 準拠のメールアドレス検証
- validate_phone(s, country='JP'): 日本の電話番号 (080/090/070) を検証
- validate_password(s): 8文字以上、大小英字+数字+記号を含む
- validate_url(s): http/https のURL検証
- validate_date(s, fmt='%Y-%m-%d'): 日付文字列の検証

test_validate.py:
- 各関数に対して正常系3件 + 異常系3件のテスト（合計30テスト以上）

2ファイルを生成してください。
```
- **期待成果**:
  - validate.py に5つのバリデーション関数
  - test_validate.py に30テスト以上
  - エッジケースが適切にハンドリングされる
- **判定ポイント**: 複雑な仕様の正確な実装

---

## QE-37: 既存ファイルの分析と改善提案

- **評価軸**: E（デバッグ）、A（応答品質）
- **難易度**: ★★★
- **プロンプト（2ターン）**:
```
ターン1: 以下のコードを legacy_code.py として保存してください:

import os, sys, json, csv
def proc(f,o,m='json'):
 d=open(f).read()
 if m=='json':
  r=json.loads(d)
  for i in r:
   if i.get('active')==True:
    print(i['name'],i['score'])
 elif m=='csv':
  r=csv.reader(open(f))
  for i in r:
   print(i[0],i[2])
 with open(o,'w') as fp:
  fp.write(str(r))

ターン2: このコードをリファクタリングしてください。
改善点を一覧にし、リファクタリング後のコードを improved_code.py として保存してください。
```
- **期待成果**:
  - legacy_code.py が正確に保存される
  - 改善点リスト（命名、型ヒント、エラーハンドリング、リソース管理等）
  - improved_code.py が PEP 8 準拠
- **判定ポイント**: コード品質改善の提案と実装の質

---

## QE-38: 数学的な推論チェーン

- **評価軸**: A（応答品質）
- **難易度**: ★★★
- **プロンプト**:
```
以下の問題を段階的に解いてください。途中の計算過程もすべて示してください。

問題: ある工場で3種類の製品 A, B, C を生産しています。
- 製品Aは1個あたり材料2kg、作業時間3時間、利益5万円
- 製品Bは1個あたり材料3kg、作業時間2時間、利益4万円
- 製品Cは1個あたり材料1kg、作業時間4時間、利益6万円
- 利用可能な材料: 120kg
- 利用可能な作業時間: 160時間
- 各製品の最大生産数: 30個

利益を最大化する生産計画を線形計画法で求めてください。
Python (scipy.optimize.linprog) で解を検証し、結果を optimization_result.md に保存してください。
```
- **期待成果**:
  - 数学的な定式化が正しい
  - Python による数値解が正確
  - 最適解と最大利益が明示される
  - optimization_result.md が生成される
- **判定ポイント**: 推論チェーンの正確性と数値検証

---

## QE-39: Git ワークフローの説明と実装

- **評価軸**: A（応答品質）、C（ファイル生成）
- **難易度**: ★★☆
- **プロンプト**:
```
GitHub Actions のCI/CDワークフローを以下の要件で作成してください:

1. .github/workflows/ci.yml:
   - Node.js 18/20 のマトリクスビルド
   - npm ci → lint → test → build
   - PR 時とmain pushで実行

2. .github/workflows/deploy.yml:
   - main ブランチへのpush時のみ
   - Docker イメージビルド & ECR push
   - ECS サービス更新

3. .github/workflows/release.yml:
   - タグ push 時のみ
   - Changelog 自動生成
   - GitHub Release 作成

3ファイルを生成してください。
```
- **期待成果**:
  - 3つの YAML ワークフローファイル
  - 正しい YAML 構文と GitHub Actions 記法
  - トリガー条件が正確
- **判定ポイント**: CI/CD 設定の正確性と実用性

---

## QE-40: API レスポンスのモック生成

- **評価軸**: C（ファイル生成）、A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
以下の REST API のモックデータを JSON ファイルとして生成してください:

1. mocks/users.json — ユーザー10名分（id, name, email, role, created_at）
2. mocks/products.json — 商品20件分（id, name, price, category, stock, description）
3. mocks/orders.json — 注文15件分（id, user_id, items[], total, status, ordered_at）

注意事項:
- user_id は users.json の id と整合させる
- items[] は products.json の id を参照する
- total は items の合計金額と一致させる
- 日付は ISO 8601 形式
- 日本語のデータを含める
```
- **期待成果**:
  - 3つの JSON ファイル
  - ファイル間のリレーションが正しい
  - データの整合性（合計金額等）
- **判定ポイント**: 相互参照を含むデータ生成の正確性

---

## 評価結果テンプレート

| # | プロンプト | 評価軸 | 判定 | ファイル数 (期待/実際) | 備考 |
|---|-----------|--------|------|----------------------|------|
| QE-21 | ファイル上書き検出 | I,C | | 1 / | |
| QE-22 | 深いネストディレクトリ | J,C | | 8 / | |
| QE-23 | コードリファクタリング | I,E | | 2 / | |
| QE-24 | 特殊文字プロンプト | L | | 1 / | |
| QE-25 | 5ターン連続会話 | H,A | | 2 / | |
| QE-26 | 設定ファイル一括生成 | C,F | | 8 / | |
| QE-27 | 段階的バグ修正 | E,I | | 1 / | |
| QE-28 | 大量データ生成 | C,F | | 9+ / | |
| QE-29 | 複雑テーブル生成 | A | | 1 / | |
| QE-30 | シェルコマンドファイル検出 | C,E | | 3 / | |
| QE-31 | RAGコンテキスト精度 | G,A | | 2 / | |
| QE-32 | 長大プロンプト | L,A | | 1 / | |
| QE-33 | テンプレート展開 | A,C | | 9 / | |
| QE-34 | 言語間変換 | A,I | | 3 / | |
| QE-35 | 日本語技術文書 | A,F | | 2 / | |
| QE-36 | 複雑なバリデーション | A,E | | 2 / | |
| QE-37 | レガシーコード改善 | E,A | | 2 / | |
| QE-38 | 数学的推論 | A | | 1 / | |
| QE-39 | GitHub Actions | A,C | | 3 / | |
| QE-40 | モックデータ相互参照 | C,A | | 3 / | |

---

## 静的コード解析による品質評価結果（第2版）

第1版の修正後、より深い解析を実施し新たな問題を発見・修正しました。

### 発見された問題と修正

| # | 問題 | 重要度 | 関連プロンプト | 状態 |
|---|------|--------|-------------|------|
| 1 | パストラバーサル脆弱性: `startsWith(workspaceDir)` がプレフィックス一致で `/ws/project-evil/` を許容 | 🔴 HIGH | QE-22, QE-30 | ✅ 修正済 |
| 2 | WS切断時にCLIプロセスが残存: WebSocket close/error でrunが停止されない | 🔴 HIGH | QE-25, QE-28 | ✅ 修正済 |
| 3 | Cold-startプロンプト無制限: 長い会話履歴がそのままCLIに送信 → トークン超過 | 🟡 MEDIUM | QE-25, QE-32 | ✅ 修正済 |
| 4 | MCPテンポラリファイル未回収: クラッシュ時にmcp-*.jsonが残存 | 🟡 MEDIUM | — | ✅ 修正済 |

### 修正内容

1. **`exec-context.ts`**: `path.relative()` + `startsWith('..')` による安全なパス境界チェック
2. **`ws.service.ts`**: WS close/error 時に最後のクライアント切断で `stopRun()` を呼出
3. **`exec-context.ts`**: cold-start プロンプトを 80K 文字（≒32K トークン）に制限、最新ターンから逆順で選択
4. **`lifecycle.ts` + `mcp.service.ts`**: 起動時に `scavengeStaleConfigs()` で残存 mcp-*.json を削除

### 第1版からの累計修正

| 版 | 修正数 | 内訳 |
|----|--------|------|
| 第1版 | 6件 | HIGH×1, MEDIUM×3, LOW×2 |
| 第2版 | 4件 | HIGH×2, MEDIUM×2 |
| **合計** | **10件** | HIGH×3, MEDIUM×5, LOW×2 |

### 既知の制限事項（修正対象外）

| # | 内容 | 理由 |
|---|------|------|
| 1 | sql.js は WAL モードなし（シングルプロセス前提） | アーキテクチャ上の制約、v2.2 以降で検討 |
| 2 | ファイル削除はreconcile時のみ検出 | リアルタイム削除検出はwatcher導入が必要 |
| 3 | シェルコマンドで作成されたファイルはリアルタイム検出不可 | post-run scan で補完 |
