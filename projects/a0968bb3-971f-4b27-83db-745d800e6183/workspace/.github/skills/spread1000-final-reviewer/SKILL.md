---
name: spread1000-final-reviewer
description: |
  Perform a comprehensive final review of the SPReAD proposal before submission.
  Cross-validate all phase deliverables (research plan, Azure architecture, cost estimate,
  proposal, diagrams) for consistency, score against the 6 peer review criteria with
  actionable improvement suggestions, validate character limits and mandatory items,
  and generate a submission-readiness report.
  Use when performing a final check before submission, validating cross-document consistency,
  running a mock peer review, or checking submission readiness.
---

# Final Reviewer

SPReAD 提出前の最終レビューを実施する。全フェーズ成果物の横断検証、6審査観点スコアリング、改善提案、提出準備度判定を行い、提出可否を総合判定する。

## Use This Skill When

- 申請書を提出する前に最終チェックを行いたい
- 全フェーズの成果物間の整合性を検証したい
- 6審査観点に基づく模擬ピアレビューを受けたい
- 提出準備が整っているか総合判定したい
- 前回のレビュー指摘事項が修正されたか確認したい

## Required Inputs

- `output/{project-name}/phase3-proposal.md`（申請書 — 必須）
- `output/{project-name}/phase0-research-plan.md`（研究プラン — 推奨）
- `output/{project-name}/phase1-azure-architecture.md`（Azure構成設計書 — 推奨）
- `output/{project-name}/phase2-cost-estimate.md`（コスト見積もり — 必須）
- `output/{project-name}/diagrams/`（構成図 — 推奨）

## Workflow

### Step 1: 入力成果物の存在確認

以下の成果物の存在を確認し、欠落があれば警告する。

| # | ファイル | 必須 | 不在時の対応 |
|---|---------|------|-----------|
| 1 | `output/{project-name}/phase3-proposal.md` | ◎ 必須 | レビュー不可。先に `spread1000-proposal-writer` を実行 |
| 2 | `output/{project-name}/phase2-cost-estimate.md` | ◎ 必須 | 予算セクションの検証不可 |
| 3 | `output/{project-name}/phase0-research-plan.md` | ○ 推奨 | 研究プランとの整合性検証をスキップ |
| 4 | `output/{project-name}/phase1-azure-architecture.md` | ○ 推奨 | Azure構成との整合性検証をスキップ |
| 5 | `output/{project-name}/diagrams/` | △ 任意 | 図面の品質検証をスキップ |

### Step 2: 必須記載事項チェック（10項目）

研究計画調書の必須記載事項（I〜X）を1項目ずつ検証する。
Read `references/mandatory-items-checklist.md` when performing this check.

| # | 項目 | 検証内容 | 判定 |
|---|------|---------|------|
| I | 研究目的・研究方法 | 具体的なAI適用工程、データの種類・出所・取得方法 | |
| II | AI利活用の妥当性・実現可能性 | 従来手法の限界とAI解決の具体的記載 | |
| III | 達成目標 | 中間（3ヶ月）・最終（6ヶ月）の区分記載 | |
| IV | ノウハウ抽出・共有計画 | 整理・抽出・共有・展開の具体的計画 | |
| V | 研究業績 | 5件以内、箇条書き、著者に下線 | |
| VI | AIインタビュー完了確認 | 完了メール貼付、メールアドレス一致 | |
| VII | 計算資源確保計画 | 調達方法・時期・期間・規模 | |
| VIII | 他の研究費の応募・受入状況 | e-Rad申告、重複計上なし | |
| IX | 研究インテグリティ | e-Rad誓約登録 | |
| X | 研究計画の変更対応 | 早期達成時の深化・高度化方針 | |

### Step 3: 文字数制限チェック

各セクションの文字数が制限範囲内かを検証する。

| セクション | 日本語 | English |
|-----------|--------|---------|
| I. 研究目的 | 80〜400文字 | 48〜240 words |
| II. 研究方法 | 160〜800文字 | 96〜480 words |
| III. AI利活用の妥当性・実現可能性 | 160〜800文字 | 96〜480 words |
| IV. 達成目標 | 100〜500文字 | 60〜300 words |
| V. ノウハウ抽出・共有の実現計画 | 60〜300文字 | 36〜180 words |

- 上限の90%以上を使用 → ✅ 情報量十分
- 下限ギリギリ → ⚠️ 内容の薄さを警告
- 上限超過 → ❌ 文字数削減が必要

### Step 4: 6審査観点スコアリング（模擬ピアレビュー）

Read `references/scoring-rubric.md` when performing peer review scoring.

各審査観点を4段階（◎/○/△/×）で評価し、スコアと改善提案を生成する。

| # | 審査観点 | スコア | 改善提案 |
|---|---------|--------|---------|
| 1 | AI利活用の妥当性・実現可能性 | | |
| 2 | 研究実績 | | |
| 3 | 実施計画・資金活用の妥当性 | | |
| 4 | 研究課題の優位性・新規性 | | |
| 5 | AI利活用のノウハウ抽出や共有の実現性 | | |
| 6 | 成果の波及可能性 | | |

**スコアリング基準**:
- ◎（優秀 = 3点）: 具体的かつ説得力のある記述。審査員に明確に伝わる
- ○（良好 = 2点）: 概ね十分だが、一部に具体性や深掘りが不足
- △（要改善 = 1点）: 記載はあるが抽象的で説得力に欠ける
- ×（不十分 = 0点）: 記載なしまたは大幅に不足

**総合スコア**: 18点満点（◎×6 = 18点）
- 15点以上 → 🟢 採択圏内（提出推奨）
- 10〜14点 → 🟡 改善推奨（指摘事項の修正後に再レビュー）
- 9点以下 → 🔴 大幅改善必要（提出前に根本的な見直しが必要）

### Step 5: フェーズ間整合性チェック

全フェーズの成果物を横断的に検証し、矛盾や不整合を検出する。

| # | チェック項目 | 比較対象 |
|---|------------|---------|
| 1 | 研究目的の一貫性 | Phase 0 ↔ Phase 3 |
| 2 | AI手法の一貫性 | Phase 0 の手法 ↔ Phase 3 の記述 |
| 3 | Azure構成の対応 | Phase 1 のリソース ↔ Phase 3 の計算資源計画 |
| 4 | コスト整合性 | Phase 2 の見積もり ↔ Phase 3 の経費計画 |
| 5 | 費目区分の適正性 | Phase 2 の費目 ↔ 府省共通経費取扱区分表 |
| 6 | 予算上限 | Phase 3 の直接経費 ≤ 500万円 |
| 7 | 間接経費 | Phase 3 の間接経費 = 直接経費 × 30% |
| 8 | VM仕様とモデル規模 | Phase 1 の GPU仕様 ↔ Phase 0 のモデルサイズ |
| 9 | 図と本文の整合性 | Phase 1b の図 ↔ Phase 3 の記述 |
| 10 | 研究期間 | 全フェーズで約180日間と一致 |

### Step 6: 予算妥当性の深掘り検証

| チェック項目 | 基準 |
|------------|------|
| 直接経費合計 | ≤ 500万円 |
| 間接経費 | = 直接経費 × 30% |
| 最低研究経費 | ≥ 10万円 |
| Azure利用費の積算根拠 | Azure Retail Prices API に基づく単価が明示されているか |
| HPCI利用の検討 | 記載されているか（利用しない場合もその旨を明記） |
| コスト最適化策 | スポットVM / リザーブドインスタンス / オートスケール等の記載 |
| 費目間バランス | 特定費目への極端な偏りがないか |
| 価格検証状態 | `⚠️ 価格未検証（推定値）` の警告が残っていないか |

### Step 7: 対象外研究の該当チェック

以下に該当する場合は **不採択リスク: 高** として警告する。

- [ ] 単に既製の研究機器の購入が目的ではないか
- [ ] 大型研究装置の製作が目的ではないか
- [ ] 商品・役務の開発・販売が直接の目的ではないか
- [ ] 業としての受託研究ではないか
- [ ] 研究経費が10万円未満ではないか

### Step 8: レビューレポート生成

すべてのチェック結果を統合し、`output/{project-name}/final-review-report.md` に保存する。
Reuse `assets/review-report-template.md` when producing the report.

レポートには以下を含める:
1. **総合判定**（🟢提出推奨 / 🟡改善推奨 / 🔴大幅改善必要）
2. **6審査観点スコアリング結果**（スコア + 改善提案）
3. **必須記載事項チェック結果**（10項目の判定）
4. **文字数制限チェック結果**
5. **フェーズ間整合性チェック結果**
6. **予算妥当性検証結果**
7. **改善優先度付きアクションリスト**（High / Medium / Low）
8. **次のステップ**（再レビューまたは提出手続きへの案内）

### Step 9: 改善後の再レビュー対応

前回のレビューで指摘された事項が修正されたか確認する差分レビューモード:
1. `output/{project-name}/final-review-report.md` の過去版から指摘事項を抽出
2. 修正後の `output/{project-name}/phase3-proposal.md` と比較
3. 解決済み / 未解決 のステータスを更新
4. 新たに発見された問題があれば追記

## Deliverables

- `output/{project-name}/final-review-report.md`: 最終レビューレポート（総合判定・スコアリング・改善提案）

## Quality Gates

- [ ] 必須記載事項（I〜X）がすべて ✅ Pass
- [ ] 全セクションの文字数が制限範囲内
- [ ] 6審査観点の総合スコアが 10点以上（🟡以上）
- [ ] フェーズ間整合性チェックで ❌（不整合）が 0件
- [ ] 直接経費 ≤ 500万円、間接経費 = 直接経費 × 30%
- [ ] 対象外研究の該当なし
- [ ] `⚠️ 価格未検証（推定値）` の警告が残っていない
- [ ] レビューレポートがファイルに保存済み

## Gotchas

- `proposal-reviewer` エージェント（Phase 3b）は軽量な品質チェック。本スキルは提出前の**包括的な最終レビュー**として全フェーズを横断検証する。両者は補完関係にあり、Phase 3b → 修正 → 本スキル の順で使用するのが最適
- 文字数カウントは日本語と英語で基準が異なる。日本語の場合は全角1文字=1文字、英語の場合はワード数でカウントすること
- コスト見積もりの単価が Azure Retail Prices API から取得されたものか、LLM の推定値かを必ず区別すること。推定値が含まれている場合は提出推奨判定を出さない
- 6審査観点のスコアリングはあくまで模擬評価。実際のピアレビュー結果と異なる場合がある旨をレポートに明記すること
- 様式1 は Excel のまま提出する。文字数制限はセルの入力制限として設定されている場合があるため、超過すると入力不可になることがある

## Security Guardrails

- レビューレポートに個人情報（メールアドレス、研究者番号等）を含めないこと
- e-Rad のログイン情報をレビューレポートに記載しないこと
- 研究データの具体的な内容（患者データ、未公開データ等）をレポートに引用しないこと

## Validation Loop

1. 全入力成果物を読み込み
2. Step 2〜7 のチェックを順次実行
3. 各チェックで:
   - ✅ Pass → 次へ
   - ⚠️ Warning → 改善提案を記録し次へ
   - ❌ Fail → 重大指摘として記録し次へ
4. Step 8 でレポートを生成
5. 総合判定:
   - ❌ が 1件以上 → 🔴 大幅改善必要
   - ⚠️ が 3件以上 → 🟡 改善推奨
   - ⚠️ が 2件以下かつ ❌ なし → 🟢 提出推奨
6. 🟡/🔴 の場合 → 改善優先度付きアクションリストを提示
7. 修正後 → Step 9 の差分レビューで再検証

---
> **⚠️ 免責事項**: 本文書は AI（SPReAD Builder）が生成した参考資料です。内容の正確性・完全性は保証されません。公的機関への提出前に、応募者ご自身の責任で内容を精査・修正してください。
