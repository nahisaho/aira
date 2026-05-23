---
name: co-scientist-critical-review
description: |
  Critical review skill. Systematic assessment of research quality, experimental rigor evaluation, statistical claim verification, and comprehensive peer review analysis.
  Phase Gate reviews at each research lifecycle stage. Deep Review for paper drafts.
  Use when working with systematic assessment of research quality, experimental rigor evaluation, statistical claim verification.
---

# Critical Review

Systematic assessment of research quality, experimental rigor evaluation, statistical claim verification, and phase-gate quality assurance.

## Use This Skill When

- Systematic assessment of research quality.
- Experimental rigor evaluation.
- Statistical claim verification.
- Comprehensive peer review analysis.
- **Phase Gate Review**: 各研究フェーズ完了時の品質検証（AGENTS.md の 🦆 Review ポイント）.
- **Deep Review**: 論文ドラフトの包括的批判的レビュー.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.
- **Review mode**: Phase Gate (with checklist name) or Deep Review.

## Review Modes

### Mode 1: Phase Gate Review (自動)
各フェーズ完了時に自動的に呼び出される。
チェックリストに基づく機械的な検証。
結果を `results/review-{phase}.md` に保存。

### Mode 2: Deep Review (Phase 4 後のみ)
論文ドラフトに対する包括的な批判的レビュー。
学術査読者の視点で問題を指摘。
結果を `results/review-paper.md` に保存。

### Review 結果のフォーマット

| チェック項目 | 結果 | 指摘 | 修正案 |
|------------|------|------|-------|
| 不確実性指標 | ❌ FAIL | Table 2 の accuracy に CI なし | "0.93 ± 0.02 (5-fold CV)" に修正 |
| 過大主張 | ❌ FAIL | L.145 "novel framework" | "proposed framework" に修正 |
| Limitations | ✅ PASS | — | — |

## Workflow

1. Review Mode の判定:
   - AGENTS.md から呼び出された場合: 指定された Mode と Checklist を使用
   - 直接呼び出された場合: 対象ファイルに基づき自動判定

2. 主張-証拠マッピング:
   - Discussion/Conclusionの各主張を抽出
   - 各主張に対応するResults内の証拠を特定
   - 証拠の強度を評価（統計検定あり/なし、効果量、サンプルサイズ）

3. 過大主張チェック:
   - Claim Calibration Rules（`co-scientist-academic-writing` 参照）に照らして表現を検証
   - 実験条件の限定性と主張の一般性の不一致を検出
   - "our method" vs "the proposed approach" — 客観性の確認

4. 論理的整合性:
   - Introduction の問題設定 → Methods の解決策 → Results の証拠 → Conclusion の主張
   - この鎖が途切れていないか検証

5. 限界の適切な記述:
   - Limitations セクションが「形式的」でないか（実質的な限界を述べているか）
   - 合成データのみの場合: 外的妥当性の限界が明記されているか
   - 単一ドメインの場合: 一般化可能性への注意が記載されているか

6. 統計的妥当性:
   - 全ての定量的結果に不確実性指標があるか
   - 性能比較に統計検定が伴っているか
   - 効果量が報告されているか

7. Save review findings to `results/review-{phase}.md` or `results/review-paper.md` and append to `logs/process-log.jsonl`.

## Phase Gate Checklists

### 🦆 Review 1: 研究計画レビュー（Phase 0 → 1 間）

対象: `results/research-plan.md`

- [ ] 研究課題が明確に定義されている（曖昧な "explore" ではなく具体的な仮説）
- [ ] スコープが適切（広すぎる "unified framework" でないか）
- [ ] 新規性の主張に先行研究の根拠がある
- [ ] 実現可能性（単一ターンで完遂可能な範囲か）

検出すべきパターン:
- ❌ "propose a comprehensive unified framework for X, Y, and Z"
  → ✅ "investigate whether technique X improves performance on task Y"
- ❌ 5つ以上のコンポーネントを統合する計画
  → ✅ 1-2の核心的手法に焦点を絞る

発見した問題への対応:
- MINOR: 指摘をコメントとして付与し、次フェーズに進む
- MAJOR: 研究計画を修正してから次フェーズに進む

### 🦆 Review 2: 実験設計レビュー（Phase 2 → 3 間）

対象: `results/experimental-design.md`

- [ ] 検証戦略が明確（内部検証 + 外部検証計画）
- [ ] 評価指標が適切（タスクに対して最低2種類）
- [ ] ベースライン手法が十分（最低2手法）
- [ ] Ablation study が設計されている（コンポーネント ≥ 2 の場合）
- [ ] データセット分割が明記されている
- [ ] ランダムシードの扱いが定義されている

検出すべきパターン:
- ❌ 評価指標が accuracy のみ
- ❌ ベースラインなし or 1手法のみとの比較
- ❌ 合成データのみで外部検証計画なし

### 🦆 Review 3: 結果レビュー（Phase 3 → 4 間）

対象: 実験結果（データ、図表）

- [ ] 全ての定量結果に不確実性指標がある（±σ, CI, p値）
- [ ] 統計検定が実施されている（性能比較がある場合）
- [ ] 結果が実験設計の全項目をカバーしている
- [ ] 異常値・外れ値が説明されている
- [ ] 図表が自己完結的（凡例、軸ラベル、単位）

検出すべきパターン:
- ❌ "accuracy 0.93" → 区間なし
- ❌ "outperforms baseline" → 有意差検定なし
- ❌ Ablation 設計済みだが結果に含まれていない

### 🦆 Review 4: 論文レビュー（Phase 4 → 4.5 間）【最重要 — Deep Review】

対象: `paper.md` (ドラフト)

#### 構造チェック
- [ ] 必須セクション完備（Abstract〜References + Limitations and Future Work）
- [ ] Limitations and Future Work セクションが 200語以上
- [ ] Abstract が目的・手法・結果・結論の4要素を含む

#### 過大主張チェック
- [ ] "novel" → 先行研究との差分が3点以上明記されている
- [ ] "state-of-the-art" → 3+最新手法との定量比較あり
- [ ] "guarantees" → 数学的証明あり
- [ ] "significant" → p値あり
- [ ] 各 Discussion/Conclusion の主張に Results の裏付けがある

#### 統計チェック
- [ ] 全定量結果に不確実性指標がある
- [ ] 性能比較に統計検定がある
- [ ] 合成データの場合、限界が明記されている

#### 再現性チェック
- [ ] ハイパーパラメータ表がある
- [ ] ランダムシードが記載されている
- [ ] データセット分割が明記されている

#### 引用チェック
- [ ] バルク引用 [1-5] がない（各引用に個別の説明）
- [ ] 全 [N] が References に対応
- [ ] 全 References が本文で引用されている

発見した問題への対応:
- 全項目を PASS/FAIL で判定
- FAIL 項目がある場合: 具体的な修正指示を生成し、論文を修正
- 修正後、再度 Review 4 を実行（最大2回リトライ）

### 🦆 Review 5: 最終レビュー（Phase 4.5 → 5 間）

対象: `paper.md` (最終版) + `report.md`

- [ ] Review 4 の全指摘が修正されている
- [ ] 参考文献の形式が統一されている
- [ ] paper.md と report.md の数値が一致している
- [ ] 図表番号が連続している
- [ ] report.md が 1,200語以上で構造化されている

最終判定:
- 全 PASS → 完了
- FAIL あり → Phase 4 に差し戻し

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/review-{phase}.md`: Phase Gate review results (Review 1-3, 5).
- `results/review-paper.md`: Deep Review results (Review 4).
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.

## Quality Gates

- [ ] The selected review mode matches the phase and stated purpose.
- [ ] All checklist items are evaluated as PASS or FAIL with justification.
- [ ] FAIL items include specific, actionable modification instructions.
- [ ] Review results are saved to files and traceable.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Phase Gate Review は機械的チェックであり、Deep Review ほど深い分析は行わない。Phase 4 後は必ず Deep Review を使用すること
- Review 4 の修正ループは最大2回。3回目以降は WARNING 付きで完了とする
- Citation style varies by journal (author-year vs numbered). Confirm target format before writing
- Claims in Discussion must trace back to specific Results. Do not introduce new data in Discussion

## Validation Loop

1. Review Mode に基づきチェックリストを選択
2. 対象ファイルを読み込み、各チェック項目を評価
3. 結果を PASS/FAIL で判定:
   - 全 PASS: 次フェーズに進行を許可
   - FAIL あり (MINOR): 指摘をコメントとして付与し、次フェーズに進行
   - FAIL あり (MAJOR): 修正指示を生成し、修正完了まで次フェーズに進行しない
4. Review 結果を `results/review-*.md` に保存
5. `logs/process-log.jsonl` に Review 実行ログを記録
