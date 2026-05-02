---
name: co-scientist-peer-review
description: |
  Peer review response and revision management skill. Self-review checklists,
  reviewer comment analysis, point-by-point response drafting, and revision tracking.
  Use when RESPONDING to peer review comments, preparing revision letters,
  conducting self-review before submission, or tracking manuscript revisions.
---

# Peer Review

Self-review, reviewer response, and revision management.

## Use This Skill When

- Responding to peer reviewer comments.
- Drafting a point-by-point response letter.
- Conducting a self-review before submission.
- Tracking changes between manuscript versions.

## Workflow

1. Parse reviewer comments:
   - Categorize: Major revision / Minor revision / Clarification / Editorial
   - Prioritize by impact on manuscript

2. Draft point-by-point response:
   - Address each comment individually
   - Quote the original comment
   - State the action taken
   - Reference specific manuscript changes (page, line, section)

3. Apply revisions to manuscript:
   - Track all changes with before/after references
   - Ensure consistency across sections

4. Self-review checklist (pre-submission):
   - Logical flow from Introduction to Discussion
   - All figures and tables referenced
   - Statistical reporting completeness
   - Citation accuracy

## Deliverables

- `report.md`: revision summary.
- `results/response-letter.md`: point-by-point response.
- `results/revision-log.md`: change tracking table.
- `results/self-review-checklist.md`: pre-submission checklist.

## Output Template (Response Letter)

```markdown
# Response to Reviewers

## Reviewer 1

### Comment 1.1 [Major]
> [Original reviewer comment]

**Response**: [Detailed response]
**Action**: [Specific changes made]
**Location**: [Section/Page/Line]

### Comment 1.2 [Minor]
> [Original reviewer comment]

**Response**: [Detailed response]
**Action**: [Specific changes made]
**Location**: [Section/Page/Line]
```

## Quality Gates

- [ ] Every reviewer comment is addressed individually.
- [ ] Response distinguishes between agreement, partial agreement, and respectful disagreement.
- [ ] Each response references specific manuscript changes.
- [ ] Revision log tracks all changes with before/after.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- 査読者のコメントに反論する場合も、まず感謝を述べてから根拠を示すこと。攻撃的な応答はリジェクトにつながる
- 「修正しました」だけでは不十分。何をどう修正したか具体的に記述すること
- 査読者間で矛盾するコメントがある場合は、両者に対して整合的な対応方針を提示すること
- 大幅な追加実験・分析を要求された場合は、フィジビリティを確認してからコミットすること

## Validation Loop

1. レスポンスレターを生成
2. チェック:
   - 全コメントに個別回答があるか
   - 各回答に具体的な修正内容が含まれるか
   - 原稿の修正箇所が明示されているか（セクション/行番号）
   - 矛盾する対応がないか
3. 不合格なら修正
4. 合格後のみ投稿
