---
name: spread1000-post-award
description: |
  Support post-award research management and reporting for SPReAD. Guide grant application
  procedures, interim progress review (3 months), final outcome report (6 months), accounting
  report preparation, budget reallocation between expense categories, research plan change
  approval requests, publication acknowledgment templates, and research data management implementation.
  Use when you want to know post-award procedures, write an interim report, create a final report,
  change budget allocations, reallocate between expense categories, change research plans,
  or learn how to write publication acknowledgments.
---

# Post-Award Manager

Provide end-to-end guidance from grant application after SPReAD award to submission of the research outcome report.

## Use This Skill When

- You want to know the procedures after receiving the award notification
- You want to confirm how to proceed with the grant application
- You want to create an interim progress report (at the 3-month mark)
- You want to create a final outcome report (at the 6-month mark)
- You want to create an accounting report
- You need to reallocate budget between expense categories or change cost allocation
- You want to change the research plan
- You want to write an acknowledgment for a publication
- You want to check the implementation status of the research data management plan
- You want to know the response when objectives are achieved early

## Required Inputs

- Awarded project title and e-Rad project number
- Grant decision date (starting point of the research period)
- Principal investigator information (name, affiliated institution)
- Latest version of the research plan (reference `output/{project-name}/phase3-proposal.md` if available)

## Workflow

### Step 1: Generate Post-Award Roadmap

Generate a 180-day management schedule starting from the grant decision date and save to `output/{project-name}/post-award-roadmap.md`.

```
■ 採択後ロードマップ（180日間）

交付決定日      : YYYY-MM-DD
研究期間終了日  : 令和9年1月6日

【交付申請フェーズ】（交付決定後 速やかに）
  □ 交付申請書の提出（機関等経由）
  □ 研究倫理教育・コンプライアンス教育の受講確認
  □ 研究データマネジメントプラン及びチェックリストの提出
  □ 機関等向け AI利活用に係る研究データ取扱いチェックリストの提出

【中間マイルストーン】（3ヶ月時点: YYYY-MM-DD 頃）
  □ 中間目標の達成状況を自己点検
  □ 中間進捗メモの作成
  □ 予算執行状況の確認（費目間流用の必要性判断）
  □ 早期達成時: 研究の深化・高度化方針を検討

【最終報告フェーズ】（6ヶ月時点: 令和9年1月6日）
  □ 最終目標の達成状況を整理
  □ 研究成果報告書の作成
  □ 会計実績報告書の作成
  □ 研究データマネジメントプランの最終更新
  □ メタデータの付与・登録（NII Research Data Cloud 等）

【提出期限】
  □ 会計実績報告書・研究成果報告書: 令和9年2月上旬（予定）
  □ 間接経費使用実績: 令和9年6月30日までに（機関等がe-Radで報告）
```

### Step 2: Grant Application Procedure Guide

Guide the required procedures after the award notification. Save the following mandatory tasks to `output/{project-name}/grant-application-checklist.md`:

| # | Task | Responsible | Submission To | Notes |
|---|------|-------------|---------------|-------|
| 1 | Prepare and submit the grant application | Institution | MEXT | By the deadline stated in the award notification |
| 2 | Proof of research ethics training completion | Principal Investigator | Institution | Must be completed by grant application time |
| 3 | Proof of compliance training completion | Principal Investigator | Institution | Must be completed by grant application time |
| 4 | Research data management plan and checklist | Principal Investigator | MEXT (via institution) | Based on FAIR principles |
| 5 | AI utilization research data handling checklist | Institution | MEXT | Institution-specific form |
| 6 | Update researchmap registration information | Principal Investigator | researchmap | Active registration encouraged |

### Step 3: Interim Progress Review (3-Month Mark)

Create an interim progress memo at approximately 3 months from research start and save to `output/{project-name}/progress-report-interim.md`:

```markdown
# SPReAD 中間進捗メモ

## 基本情報
- 課題名: {{課題名}}
- e-Rad課題番号: {{課題番号}}
- 研究代表者: {{氏名}}（{{所属機関}}）
- 報告時点: YYYY-MM-DD（研究開始から約90日目）

## 1. 中間目標の達成状況

| 中間目標（様式1に記載） | 達成度 | 根拠・エビデンス |
|--------------------------|--------|-----------------|
| {{目標1}} | ○達成 / △一部達成 / ×未達成 | {{根拠}} |
| {{目標2}} | ○ / △ / × | {{根拠}} |

## 2. 研究の進捗概要
（自由記述: 研究の進展、得られた知見、AI活用の成果、課題と対策）

## 3. 予算執行状況

| 費目 | 予算額 | 執行額 | 執行率 | 残額 | 備考 |
|------|--------|--------|--------|------|------|
| 設備備品費 | | | | | |
| 消耗品費 | | | | | |
| 旅費 | | | | | |
| その他 | | | | | |
| **直接経費合計** | | | | | |

> ⚠️ **SPReAD では人件費・謝金は支出不可です。** 費目に計上しないでください。

## 4. 後半期間の計画
（残り90日間の研究計画・スケジュール）

## 5. 費目間流用・計画変更の必要性
□ 費目間流用が必要（→ Step 5 参照）
□ 研究計画の変更が必要（→ Step 6 参照）
□ 変更不要
```

### Step 4: Final Outcome Report Preparation

Create the research outcome report at the end of the research period and save to `output/{project-name}/research-outcome-report.md`.
- Read `references/acknowledgment-guide.md` when producing the acknowledgment section

```markdown
# SPReAD 研究成果報告書

## 基本情報
- 課題名: {{課題名}}
- e-Rad課題番号: {{課題番号}}
- 体系的番号: JPMXP17{{e-Rad課題番号}}
- 研究代表者: {{氏名}}（{{所属機関}}）
- 研究期間: {{交付決定日}} 〜 令和9年1月6日（約180日間）

## 1. 研究目的
（様式1「研究目的」の要約）

## 2. 研究成果の概要

### 2.1 最終目標の達成状況

| 最終目標（様式1に記載） | 達成度 | エビデンス |
|--------------------------|--------|-----------|
| {{目標1}} | ○達成 / △一部 / ×未達成 | {{根拠}} |

### 2.2 AI活用による具体的成果
（AI for Scienceとしての成果: AI手法の適用結果、精度向上、新知見の発見等）

### 2.3 データ・モデル・コードの成果物
（公開リポジトリURL、データセット、学習済みモデル等）

## 3. 研究データマネジメントの実施状況
- メタデータ付与状況: {{NII Research Data Cloud / CiNii Research 等}}
- データ公開方針: オープン / 条件付き公開 / 非公開（理由: ）
- FAIR原則への適合: F({{状況}}) / A({{状況}}) / I({{状況}}) / R({{状況}})

## 4. 知見の共有・波及効果
- 論文発表: {{件数・掲載誌}}
- 学会発表: {{件数・学会名}}
- 他分野への波及可能性:

## 5. 今後の展望
（研究の継続・発展の方向性、社会実装の可能性）

## 6. 謝辞テンプレート（論文掲載用）

【英文】
This work was supported by MEXT Supporting Pioneering Research through AI for 1,000
Discovery challenges Program (SPReAD) Japan Grant Number JPMXP17{{e-Rad課題番号}}.

【和文】
本研究は、AI for Science萌芽的挑戦研究創出事業（SPReAD）JPMXP17{{e-Rad課題番号}}の
助成を受けたものです。
```

⚠️ **The research outcome report is compiled and submitted by the institution. Failure to submit may result in cancellation of the grant decision and an order to return the funds.**

### Step 5: Budget Change & Expense Category Reallocation Guide

Guide the procedures when budget reallocation between expense categories or cost allocation changes become necessary during budget execution. Save to `output/{project-name}/budget-change-guide.md`:

```markdown
# 予算変更・費目間流用ガイド

## 費目間流用（研究代表者判断で可能な範囲）

直接経費の各費目間での配分変更のうち、交付要綱に定める「費目間流用の範囲」内
であれば、研究代表者の判断で調整可能。

### 手続きフロー
1. 現在の予算配分と執行状況を確認
2. 流用額が「費目間流用の範囲内」か判定
3. 範囲内 → 研究代表者の責任で実施（事後的に会計実績報告で報告）
4. 範囲外 → 経費配分変更承認申請書を機関等経由で文部科学省に提出

## 経費配分変更承認申請（文部科学省の承認が必要）

以下のいずれかに該当する場合は、事前に承認申請が必要:
- 費目間流用の範囲を超える変更
- 研究計画の本質的な変更を伴う経費配分の見直し

### 必要書類
- 経費配分変更承認申請書
- 変更理由書（変更の必要性と研究への影響を記載）

### 提出先
機関等を通じて文部科学省へ提出

## 注意事項
- 間接経費（直接経費の30%）は変更不可
- 対象外経費への流用は不可（建物等施設、土地購入費、不動産取得税等）
- 変更後も補助上限500万円（直接経費）を超えないこと
```

### Step 6: Research Plan Change Procedure Guide

Guide the procedures when plan changes become necessary as research progresses:

```
■ 研究計画変更のケースと対応

【ケース A: 早期目標達成】
→ 研究の深化・高度化に取り組む
→ 変更内容を記録し、最終報告書に反映

【ケース B: 研究方法・アプローチの変更】
→ 軽微な変更: 研究代表者の判断で実施、報告書に記載
→ 本質的変更: 研究計画変更承認申請書を機関等経由で文部科学省へ提出

【ケース C: 研究中止・辞退】
→ 速やかに機関等に連絡し、文部科学省へ届出
→ 既交付分の精算・返還手続き

必要書類: 研究計画変更承認申請書（変更理由・変更後の計画を記載）
```

### Step 7: Accounting Report Preparation

Save the accounting report template for after the research period ends to `output/{project-name}/accounting-report.md`:

```markdown
# 会計実績報告書

## 基本情報
- 課題名: {{課題名}}
- e-Rad課題番号: {{課題番号}}
- 研究代表者: {{氏名}}（{{所属機関}}）
- 研究期間: {{交付決定日}} 〜 令和9年1月6日

## 直接経費

| 費目 | 交付決定額 | 実支出額 | 差額 | 備考 |
|------|-----------|---------|------|------|
| 設備備品費 | | | | |
| 消耗品費 | | | | |
| 旅費 | | | | |
| その他 | | | | |
| **合計** | | | | |

> ⚠️ **SPReAD では人件費・謝金は支出不可です。** 費目に計上しないでください。

## 間接経費
- 交付決定額: 直接経費の30% = {{金額}}円
- 実支出額: {{金額}}円

## 費目間流用の実績
（流用を行った場合に記載）

| 流用元費目 | 流用先費目 | 流用額 | 理由 |
|-----------|-----------|--------|------|

## 未使用額
- 未使用額: {{金額}}円
- 未使用の理由:

⚠️ 提出期限: 令和9年2月上旬（予定）
⚠️ 間接経費使用実績: 機関等が令和9年6月30日までにe-Radで報告
```

## Deliverables

| File | Content |
|------|---------|
| `output/{project-name}/post-award-roadmap.md` | 180-day management schedule |
| `output/{project-name}/grant-application-checklist.md` | Grant application procedure checklist |
| `output/{project-name}/progress-report-interim.md` | Interim progress memo (3-month mark) |
| `output/{project-name}/research-outcome-report.md` | Research outcome report (final) |
| `output/{project-name}/budget-change-guide.md` | Budget change & expense reallocation guide |
| `output/{project-name}/accounting-report.md` | Accounting report |

## Quality Gates

- [ ] All tasks required for the grant application are documented in the checklist
- [ ] Interim progress memo includes budget execution rates
- [ ] Final report includes specific outcomes from AI utilization
- [ ] Publication acknowledgment systematic number (JPMXP17 + e-Rad project number) is correct
- [ ] Accounting report expense totals are within the grant decision amount
- [ ] Research data management FAIR principle compliance status is documented

## Gotchas

- Failure to submit the research outcome report may result in cancellation of the grant decision and an order to return the funds
- The "allowable range" for expense category reallocation is defined in the grant guidelines. The 公募要領 does not specify exact percentages, so check the grant decision notification
- 間接経費 (30%) is managed and reported by the institution, not the principal investigator
- Since this is implemented under the FY2025 supplementary budget, procedure schedules may differ from regular 科研費 etc.
- An incorrect systematic number in the publication acknowledgment will prevent research outcomes from being linked to this program
- For research data publication, non-disclosure is acceptable with legitimate reasons, considering the open-and-close strategy
- This program provides accompaniment support (information sharing, community building, dissemination of best practices). Cooperate with the institution's URA and participate smoothly

## Validation Loop

1. Generate each template (roadmap, reports, accounting)
2. Check:
   - Are the research period (180 days) and milestone dates consistent?
   - Are budget amounts within the grant decision amount?
   - Is the systematic number (JPMXP17 + e-Rad project number = 15 digits) correct?
   - Is FAIR principle compliance for research data management documented?
3. If any check fails:
   - Fix dates, amounts, or numbers
   - Re-validate
4. Finalize deliverables only after all gates pass
