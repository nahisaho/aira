---
name: co-scientist-learning-capture
description: |
  Research learning capture and knowledge persistence skill. Records discoveries,
  edge cases, and methodological insights from completed research tasks.
  Use when FINISHING a research task, discovering a methodological pitfall,
  resolving an analysis error, or recording lessons for future research sessions.
---

# Learning Capture

Research learnings, methodological insights, and Gotchas maintenance.

## Use This Skill When

- Completing a research task and recording lessons learned.
- Discovering a methodological pitfall or edge case.
- Resolving an analysis error that others should avoid.
- Updating Gotchas in related co-scientist skills.

## Workflow

1. Identify learning event:
   - Analysis error that was corrected
   - Methodological shortcut that worked well
   - Assumption that proved incorrect
   - Tool or library behavior that was unexpected

2. Structure the learning:
   - **WHAT**: Specific situation description
   - **WHY**: Why it matters (impact, frequency)
   - **HOW**: Concrete prevention or best practice
   - **WHERE**: Which co-scientist skill should be updated

3. Generate Gotcha entry:
   - 1-2 lines, concrete, actionable
   - Include specific commands, settings, or thresholds
   - Avoid generic advice

4. Update target skill's Gotchas section

5. Record in `logs/learnings-log.jsonl`:
   ```json
   {"timestamp":"...","skill":"co-scientist-data-analysis","learning":"多重比較でBonferroni補正を忘れた","action":"Gotchas追記","severity":"high"}
   ```

## Deliverables

- Updated Gotchas in target skill's SKILL.md.
- `logs/learnings-log.jsonl`: timestamped learning record.

## Quality Gates

- [ ] Learning is specific (not generic advice).
- [ ] Gotcha entry is 1-2 lines and actionable.
- [ ] No duplicate with existing Gotchas.
- [ ] Target skill remains under 500 lines after addition.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- 学びの記録は「ミス発生直後」に行うこと。時間が経つと詳細を忘れる
- 汎用的な助言（「テストを書こう」）は価値が低い。プロジェクト固有の具体的な知見を書くこと
- Gotchas が 10 項目を超えたら、カテゴリ分けを検討すること
- 同じ学びを複数スキルに重複記載しないこと。最も関連性の高い 1 箇所に書く

## Validation Loop

1. Gotcha エントリを生成
2. チェック:
   - 具体的なコマンド・設定値・閾値が含まれるか
   - 既存 Gotchas と重複していないか
   - 追記後のスキルが 500 行以内か
3. 不合格なら修正
4. 合格後に追記実行
