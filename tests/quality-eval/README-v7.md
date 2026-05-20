# AIRA 品質評価プロンプト集 第7版（v2.1.0）

第7版: フロントエンド開発（React、CSS、アクセシビリティ）、UI コンポーネントライブラリ、レスポンシブ設計、状態管理。

---

## QE-121: アクセシブルなフォーム部品セット

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
React + TypeScript で再利用可能なフォーム部品セットを作成してください。

生成するファイル:
1. ui/forms/FormField.tsx
2. ui/forms/TextInput.tsx
3. ui/forms/SelectField.tsx
4. ui/forms/CheckboxField.tsx
5. ui/forms/FormDemo.tsx
6. ui/forms/accessibility-notes.md

要件:
- label と input の関連付けを明示
- 必須項目、エラーメッセージ、補足文を扱えるようにする
- aria-invalid, aria-describedby などの属性を適切に使う
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - 各コンポーネントでアクセシビリティ属性が一貫している
  - accessibility-notes.md にキーボード操作とスクリーンリーダー配慮が記載される
- **判定ポイント**: アクセシビリティ実装の正確性、部品の再利用性、説明文書の具体性

---

## QE-122: レスポンシブな管理ダッシュボード

- **評価軸**: C（ファイル生成・検出）, A（応答品質）, J（ディレクトリ構造）
- **難易度**: ★★★
- **プロンプト**:
```
管理画面向けのレスポンシブダッシュボード UI を作成してください。

生成するファイル:
1. frontend/pages/Dashboard.tsx
2. frontend/components/StatCard.tsx
3. frontend/components/ChartPanel.tsx
4. frontend/styles/dashboard.css
5. frontend/breakpoint-notes.md

要件:
- PC では 3 カラム、タブレットでは 2 カラム、モバイルでは 1 カラム
- KPI カード、グラフ領域、アクティビティ一覧を含める
- breakpoint-notes.md にレイアウト変化を記載
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - CSS とコンポーネント構成がレスポンシブ要件に沿う
  - breakpoint-notes.md に具体的なブレークポイント説明がある
- **判定ポイント**: レスポンシブ設計の具体性、CSS 品質、画面構成の分かりやすさ

---

## QE-123: ダーク/ライトテーマ切り替え基盤

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★☆
- **プロンプト**:
```
React アプリで使えるテーマ切り替え基盤を作成してください。

生成するファイル:
1. frontend/theme/tokens.css
2. frontend/theme/ThemeProvider.tsx
3. frontend/components/ThemeToggle.tsx
4. frontend/theme-preview.tsx

要件:
- CSS 変数で色と spacing を管理
- localStorage へ theme を保存する前提の実装にする
- prefers-color-scheme も考慮する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - tokens.css と ThemeProvider のキーが一致する
  - トグル部品とプレビュー画面でテーマ反映が分かる
- **判定ポイント**: テーマ基盤の拡張性、状態保持の設計、CSS 変数の整理品質

---

## QE-124: 汎用データテーブル部品

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
並び替え・フィルタ・ページングを備えた汎用 DataTable を作成してください。

生成するファイル:
1. frontend/components/table/DataTable.tsx
2. frontend/components/table/useDataTable.ts
3. frontend/components/table/table-styles.css
4. frontend/components/table/TableDemo.tsx
5. frontend/components/table/table-tests.md

要件:
- columns 定義を props で受け取る
- client-side pagination を実装
- 空データ、ロード中、エラーの状態も扱う
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - Hook と Component の責務が分離されている
  - table-tests.md に少なくとも 8 個の確認観点がある
- **判定ポイント**: コンポーネント API 設計の明確さ、状態処理の網羅性、テスト観点の具体性

---

## QE-125: キーボード操作可能な Modal / Drawer

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
アクセシブルな Modal と Drawer のコンポーネントを作成してください。

生成するファイル:
1. frontend/components/overlay/Modal.tsx
2. frontend/components/overlay/Drawer.tsx
3. frontend/components/overlay/overlay.css
4. frontend/components/overlay/Demo.tsx
5. frontend/components/overlay/focus-management.md

要件:
- Escape キーで閉じる
- フォーカストラップを考慮
- aria-modal, role="dialog" を適切に設定
- focus-management.md に開閉時のフォーカス遷移を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - Modal と Drawer で共通するアクセシビリティ要件が満たされる
  - ドキュメントにキーボード操作とフォーカス制御が説明される
- **判定ポイント**: オーバーレイ UI の安全性、アクセシビリティ実装、説明の具体性

---

## QE-126: Zustand による状態スライス設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★★
- **プロンプト**:
```
Zustand を用いたフロントエンド状態管理のサンプルを作成してください。

生成するファイル:
1. frontend/store/useAppStore.ts
2. frontend/store/slices/user.ts
3. frontend/store/slices/filters.ts
4. frontend/store/slices/cart.ts
5. frontend/store/Demo.tsx
6. frontend/store/persistence-notes.md

要件:
- user, filters, cart を分割した slice 構成
- 一部 state は永続化前提
- Demo.tsx で 3 slice を同時に利用する例を示す
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - slice 間の状態設計が破綻していない
  - persistence-notes.md に永続化対象と非対象の理由がある
- **判定ポイント**: 状態管理設計の分かりやすさ、拡張性、永続化方針の妥当性

---

## QE-127: 多段フォームウィザードの実装

- **評価軸**: F（E2E自動化）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★★
- **プロンプト**:
```
チェックアウト向けの多段フォームウィザードを作成してください。

生成するファイル:
1. frontend/wizard/CheckoutWizard.tsx
2. frontend/wizard/steps/ShippingStep.tsx
3. frontend/wizard/steps/BillingStep.tsx
4. frontend/wizard/steps/ConfirmStep.tsx
5. frontend/wizard/validation.ts
6. frontend/wizard/WizardDemo.tsx

要件:
- ステップ間で入力値を保持する
- 次へ進む前にステップ単位のバリデーションを行う
- 確認画面で全入力値を一覧表示する
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - ステップ遷移と入力保持の流れが明確である
  - validation.ts のルールが各ステップ UI に反映される
- **判定ポイント**: フォーム UX の一貫性、バリデーション設計、状態遷移の明瞭さ

---

## QE-128: Headless Tabs / Accordion ライブラリ

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, J（ディレクトリ構造）
- **難易度**: ★★★
- **プロンプト**:
```
スタイル非依存の Headless UI 部品として Tabs と Accordion を作成してください。

生成するファイル:
1. frontend/headless/useTabs.ts
2. frontend/headless/useAccordion.ts
3. frontend/headless/Tabs.tsx
4. frontend/headless/Accordion.tsx
5. frontend/headless/Demo.tsx
6. frontend/headless/accessibility.md

要件:
- 状態管理ロジックと表示を分離
- キーボード操作を考慮
- accessibility.md に WAI-ARIA の観点をまとめる
```
- **期待成果**:
  - 6ファイルすべてが生成される
  - Hook と UI ラッパーの責務が整理されている
  - アクセシビリティ観点が部品仕様に落ちている
- **判定ポイント**: Headless UI としての抽象化品質、再利用性、アクセシビリティ理解

---

## QE-129: レスポンシブ分析チャートカード

- **評価軸**: C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
ダッシュボード用のチャートカード群を作成してください。

生成するファイル:
1. frontend/charts/ResponsiveChartCard.tsx
2. frontend/charts/dashboard-grid.css
3. frontend/charts/chart-config.ts
4. frontend/charts/mockData.ts
5. frontend/charts/chart-guidelines.md

要件:
- 小画面では縦積み、大画面では 2 列配置
- ローディング/空データ時の表示方針も含める
- chart-guidelines.md に軸ラベル・凡例・色使いのガイドを書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 構成ファイルと mockData がコンポーネント利用例に対応する
  - 可視化ガイドラインが具体的で実装に結び付く
- **判定ポイント**: レスポンシブ可視化設計、表示状態の扱い、ガイドラインの有用性

---

## QE-130: デザイントークンとユーティリティ CSS

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, I（ファイル更新）
- **難易度**: ★★☆
- **プロンプト**:
```
小規模デザインシステムの基礎として、デザイントークンとユーティリティ CSS を作成してください。

生成するファイル:
1. design/tokens.json
2. design/utilities.css
3. design/button.css
4. design/card.css
5. design/usage-guide.md

要件:
- 色、spacing、radius、shadow を token 化
- utilities.css に spacing と layout の補助クラスを含める
- usage-guide.md に Button/Card への適用例を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - token 名と CSS 利用例が一致する
  - ガイドに実装ルールと拡張ルールが含まれる
- **判定ポイント**: デザインシステム基礎の整理、CSS 設計品質、ドキュメントの明快さ

---

## QE-131: フロントエンド i18n 切り替え UI

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★☆
- **プロンプト**:
```
日本語 / 英語を切り替えられるフロントエンド i18n サンプルを作成してください。

生成するファイル:
1. frontend/i18n/i18n.ts
2. frontend/i18n/LanguageSwitcher.tsx
3. frontend/i18n/locales/ja.json
4. frontend/i18n/locales/en.json
5. frontend/i18n/LocaleDemo.tsx

要件:
- 文言キーはネスト構造を含める
- 言語切り替え時に UI が再描画される前提の実装にする
- Demo に見出し、ボタン、エラーメッセージの翻訳を含める
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 翻訳キーと UI 利用箇所が一致する
  - ロケール切り替えの流れが Demo で確認できる
- **判定ポイント**: i18n 設計の実務性、翻訳キー管理の一貫性、UI 反映の明瞭さ

---

## QE-132: Kanban ボードの状態管理と操作設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, K（並行安全性）
- **難易度**: ★★★
- **プロンプト**:
```
Kanban ボード UI のサンプルを作成してください。

生成するファイル:
1. frontend/kanban/KanbanBoard.tsx
2. frontend/kanban/KanbanColumn.tsx
3. frontend/kanban/useKanbanState.ts
4. frontend/kanban/mockTasks.json
5. frontend/kanban/keyboard-shortcuts.md

要件:
- 列移動と並べ替えの state を表現
- マウス操作だけでなくキーボード操作方針も記述
- mockTasks.json に 12 件以上のサンプルを含める
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - state 管理と UI コンポーネントの責務が分かれている
  - keyboard-shortcuts.md に具体的な操作定義がある
- **判定ポイント**: 状態遷移設計、UI 分割、アクセシビリティ観点の具体性

---

## QE-133: 仮想スクロール付きリスト表示

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
大量データを扱う仮想スクロール UI のサンプルを作成してください。

生成するファイル:
1. frontend/list/VirtualList.tsx
2. frontend/list/useInfiniteScroll.ts
3. frontend/list/ListDemo.tsx
4. frontend/list/mock-items.json
5. frontend/list/performance-notes.md

要件:
- 1,000 件以上を想定した表示設計
- ローディング中と末尾到達時の挙動を考慮
- performance-notes.md に再レンダリング抑制策を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 大量件数前提の設計がコードと説明文に表れる
  - 性能上の注意点が具体的に整理される
- **判定ポイント**: パフォーマンス配慮、フック設計、説明の技術品質

---

## QE-134: Error Boundary と Suspense の組み合わせ

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, E（デバッグ）
- **難易度**: ★★★
- **プロンプト**:
```
読み込み失敗にも耐える React UI パターンを作成してください。

生成するファイル:
1. frontend/resilience/ErrorBoundary.tsx
2. frontend/resilience/AsyncSection.tsx
3. frontend/resilience/fallback.css
4. frontend/resilience/Demo.tsx
5. frontend/resilience/resilience-notes.md

要件:
- データ取得中のローディング表示を含める
- 例外発生時の fallback UI を定義
- resilience-notes.md に再試行導線とユーザー通知方針を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - ErrorBoundary と AsyncSection の役割が混在していない
  - エラー時の UX 方針が notes に整理される
- **判定ポイント**: 障害時 UI 設計の妥当性、責務分離、説明文書の具体性

---

## QE-135: SSR を意識したカスタム Hook 集

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★☆
- **プロンプト**:
```
SSR 環境でも破綻しにくいカスタム Hook 集を作成してください。

生成するファイル:
1. frontend/hooks/useMediaQuery.ts
2. frontend/hooks/useLocalStorage.ts
3. frontend/hooks/usePrefersReducedMotion.ts
4. frontend/hooks/HooksDemo.tsx
5. frontend/hooks/ssr-notes.md

要件:
- window 未定義時のガードを考慮
- reduced motion を UI へ反映する例を含める
- ssr-notes.md に hydration mismatch 回避の注意点を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 各 Hook が SSR 前提の安全策を持つ
  - Demo と notes の内容が一致する
- **判定ポイント**: SSR 配慮の正確性、Hook の再利用性、注意点の実務性

---

## QE-136: UI コンポーネント利用ドキュメント集

- **評価軸**: C（ファイル生成・検出）, A（応答品質）
- **難易度**: ★★☆
- **プロンプト**:
```
社内 UI ライブラリ向けの利用ドキュメントを Markdown で作成してください。

生成するファイル:
1. docs/components/button.md
2. docs/components/modal.md
3. docs/components/table.md
4. docs/components/theme.md

要件:
- 各文書に用途、props 例、Do / Don't、アクセシビリティ注意点を含める
- 4 文書で見出し構成を統一する
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - 各ドキュメントの構成が統一されている
  - 利用例と注意点が実装イメージに結び付いている
- **判定ポイント**: コンポーネントドキュメント品質、統一性、実務での使いやすさ

---

## QE-137: Reduced Motion 対応アニメーション設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, L（入力バリデーション）
- **難易度**: ★★☆
- **プロンプト**:
```
アクセシビリティを考慮したアニメーション設計のサンプルを作成してください。

生成するファイル:
1. frontend/motion/motion.css
2. frontend/motion/FadeIn.tsx
3. frontend/motion/SlidePanel.tsx
4. frontend/motion/MotionDemo.tsx
5. frontend/motion/accessibility-checklist.md

要件:
- prefers-reduced-motion を考慮
- motion.css に duration と easing の token を用意
- checklist に確認項目を 8 つ以上記載
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - アニメーション定義と reduced motion の分岐が明確である
  - checklist が検証しやすい粒度で書かれている
- **判定ポイント**: アニメーション設計の安全性、アクセシビリティ対応、検証観点の具体性

---

## QE-138: スキーマ駆動フォームレンダラー

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, M（API整合性）
- **難易度**: ★★★
- **プロンプト**:
```
JSON スキーマ風定義からフォームを描画するサンプルを作成してください。

生成するファイル:
1. frontend/form-builder/form-schema.json
2. frontend/form-builder/FormRenderer.tsx
3. frontend/form-builder/field-registry.tsx
4. frontend/form-builder/FormBuilderDemo.tsx
5. frontend/form-builder/validation-rules.md

要件:
- text, select, checkbox の 3 種類以上のフィールドに対応
- required や minLength などのルールを扱う
- validation-rules.md にスキーマ項目と UI 挙動の対応表を書く
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - schema と renderer の対応関係が明確である
  - validation-rules.md にルールと表示結果の関係が整理される
- **判定ポイント**: スキーマ駆動設計の実務性、拡張性、バリデーション整合性

---

## QE-139: ショッピングカートの状態機械設計

- **評価軸**: A（応答品質）, C（ファイル生成・検出）, H（セッション継続性）
- **難易度**: ★★★
- **プロンプト**:
```
ショッピングカートの状態機械サンプルを React 向けに作成してください。

生成するファイル:
1. frontend/cart/cartMachine.ts
2. frontend/cart/useCartMachine.ts
3. frontend/cart/CartView.tsx
4. frontend/cart/cart-scenarios.json
5. frontend/cart/cart-machine.md

要件:
- empty / active / checkingOut / completed の状態を持つ
- イベント遷移表を markdown に書く
- scenarios.json に正常系と異常系を含める
```
- **期待成果**:
  - 5ファイルすべてが生成される
  - 状態遷移図とコードの遷移が一致する
  - 異常系シナリオが scenarios.json に含まれる
- **判定ポイント**: 状態機械の明確さ、UI 反映の分かりやすさ、異常系考慮の質

---

## QE-140: Container Query を使う適応型カード UI

- **評価軸**: A（応答品質）, C（ファイル生成・検出）
- **難易度**: ★★☆
- **プロンプト**:
```
Container Query を利用した適応型カード UI のサンプルを作成してください。

生成するファイル:
1. frontend/adaptive/AdaptiveCard.tsx
2. frontend/adaptive/cards.css
3. frontend/adaptive/CardGallery.tsx
4. frontend/adaptive/responsive-test-plan.md

要件:
- 親コンテナ幅に応じてカード内レイアウトを切り替える
- 画像、タイトル、メタ情報、アクションボタンを含める
- responsive-test-plan.md に 5 ケース以上の確認シナリオを書く
```
- **期待成果**:
  - 4ファイルすべてが生成される
  - Container Query の切り替え条件が CSS に明示される
  - テスト計画が具体的で検証しやすい
- **判定ポイント**: モダン CSS 活用の妥当性、コンポーネント品質、テスト観点の明確さ

---

## 評価結果テンプレート

| # | プロンプト | 評価軸 | 判定 | ファイル数 (期待/実際) | 備考 |
|---|-----------|--------|------|----------------------|------|
| QE-121 | アクセシブルなフォーム部品セット | A,C,L | | 6 / | |
| QE-122 | レスポンシブな管理ダッシュボード | C,A,J | | 5 / | |
| QE-123 | ダーク/ライトテーマ切り替え基盤 | A,C,H | | 4 / | |
| QE-124 | 汎用データテーブル部品 | A,C,M | | 5 / | |
| QE-125 | キーボード操作可能な Modal / Drawer | A,C,L | | 5 / | |
| QE-126 | Zustand による状態スライス設計 | A,C,H | | 6 / | |
| QE-127 | 多段フォームウィザードの実装 | F,C,L | | 6 / | |
| QE-128 | Headless Tabs / Accordion ライブラリ | A,C,J | | 6 / | |
| QE-129 | レスポンシブ分析チャートカード | C,A | | 5 / | |
| QE-130 | デザイントークンとユーティリティ CSS | A,C,I | | 5 / | |
| QE-131 | フロントエンド i18n 切り替え UI | A,C,H | | 5 / | |
| QE-132 | Kanban ボードの状態管理と操作設計 | A,C,K | | 5 / | |
| QE-133 | 仮想スクロール付きリスト表示 | A,C,E | | 5 / | |
| QE-134 | Error Boundary と Suspense の組み合わせ | A,C,E | | 5 / | |
| QE-135 | SSR を意識したカスタム Hook 集 | A,C,L | | 5 / | |
| QE-136 | UI コンポーネント利用ドキュメント集 | C,A | | 4 / | |
| QE-137 | Reduced Motion 対応アニメーション設計 | A,C,L | | 5 / | |
| QE-138 | スキーマ駆動フォームレンダラー | A,C,M | | 5 / | |
| QE-139 | ショッピングカートの状態機械設計 | A,C,H | | 5 / | |
| QE-140 | Container Query を使う適応型カード UI | A,C | | 4 / | |
