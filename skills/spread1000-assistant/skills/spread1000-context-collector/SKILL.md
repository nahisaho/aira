---
name: spread1000-context-collector
description: |
  Collects missing context from the user via one-question-at-a-time dialogue,
  generates a 6-element meta-prompt, and passes it to downstream skills.
  Applies shikigami's interactive purpose-discovery pattern specialized for SPReAD.
  Use when user request is ambiguous (依頼が曖昧), research field is unknown (研究分野が不明),
  or required information is insufficient (必要情報が不足).
---

# Context Collector

Assess context sufficiency from the user's prompt, collect missing information
via one-question-at-a-time dialogue, and generate a 6-element meta-prompt
to maximize downstream phase accuracy.

## Use This Skill When

- The user's request is ambiguous and it is unclear which skill to route to
- Any of research field, theme, or purpose is unclear
- Required Inputs for downstream skills (e.g., research-planner) cannot be satisfied

## Context Sufficiency Check

Determine whether the following 6 elements can be extracted from the user's initial prompt.
If 3 or more elements are unknown, activate this skill.

**判定ルール（厳格）**: 各要素は、ユーザーが **明示的に記述** した場合のみ ✅ とする。研究テーマの記述から **推測・類推できる** 場合でも、ユーザーが直接言及していなければ ❌（不明）とする。

| Element | Meaning in SPReAD | ✅ の条件（厳格） | ❌ の例（推測不可） |
|---------|-------------------|------------------|-------------------|
| PURPOSE | Research goal / what to achieve with AI | 「〜を解明」「〜を予測」等の動作動詞を含む | （通常は記述される） |
| TARGET | Research subject / field | 具体的な学術分野・対象が明記されている | （通常は記述される） |
| SCOPE | Scope / scale of research | データ **規模**（件数・サンプル数）、対象 **地域**・**期間** が **数値付きで** 明記 | 「血液検査データ」だけでは ❌（規模不明） |
| TIMELINE | Research period | 180日間の研究期間内の **マイルストーン** や **段階的計画** が明記 | 言及なし → ❌ |
| CONSTRAINTS | Constraints | **予算額**・**人員数**・**設備制約**・**倫理制約** が具体的に明記 | 言及なし → ❌ |
| DELIVERABLES | Expected outputs | **論文**・**ソフトウェア**・**モデル**・**データセット** 等の成果物 **形態** が明記 | 「〜を可能にする」は目標であり成果物形態ではない → ❌ |

## Workflow

### Step 1: Context Sufficiency Assessment

Analyze the user's initial prompt and **必ずチャットに判定結果を出力する**（内部判定のみは禁止）。

**⚠️ 重要**: 判定は「推測できるか」ではなく「ユーザーが明示的に記述したか」で行う。
例えば、「血液検査データからFHを予測する」というプロンプトから SCOPE（データ規模）を推測してはならない。

```
必ず以下の形式で出力すること:

📋 コンテキスト充足度判定:
  PURPOSE:      ✅/❌ [根拠]
  TARGET:       ✅/❌ [根拠]
  SCOPE:        ✅/❌ [根拠]
  TIMELINE:     ✅/❌ [根拠]
  CONSTRAINTS:  ✅/❌ [根拠]
  DELIVERABLES: ✅/❌ [根拠]
  → 不足N要素 → [判定結果]
```

**判定後のアクション**:
- 不足3要素以上 → **即座に質問1つを出力して停止**（ツール呼び出し禁止）
- 不足2要素以下 → 仮定を明示して作業開始可

### Step 2: One-Question-at-a-Time Information Collection

**Rules**:
- Ask **only 1 question** per message (simultaneous multiple questions are prohibited)
- Complete collection in a minimum of 3 and a maximum of 7 questions
- Attach a category label to each question
- If the user answers "わからない" (don't know), propose an estimated value and confirm

**Output Rules (CRITICAL)**:
- Output the question as **regular chat response text**. Do NOT rely on `ask_user` tool (it may not be available)
- After outputting a question, **STOP immediately**. **ALL tool calls are prohibited**:
  - No `web_search`, `bash`, `create`, `edit`
  - **No MCP tools** (`ToolUniverse-execute_tool`, `ToolUniverse-search_tools`, etc.)
  - No other tools of any kind
  - Only `report_intent` and `skill` are allowed
- The user's answer will arrive in their next message — wait for it
- Each question-answer exchange is a separate turn
- This restriction continues until the meta-prompt is generated and approved

**Question Categories and Order**:

| Order | Category | Example Question (SPReAD-specific) |
|-------|----------|-------------------------------------|
| 1 | WHY | この研究で AI を使って何を達成したいですか？ |
| 2 | TARGET | 研究対象の分野・物質・現象は何ですか？ |
| 3 | DATA | どのようなデータを扱いますか？（種類・規模・形式） |
| 4 | TIMELINE | SPReAD の研究期間は約180日間（6ヶ月）ですが、この期間で取り組む範囲として想定していることは何ですか？ |
| 5 | CONSTRAINT | 予算・設備・人員の制約はありますか？（SPReAD の予算上限は直接経費500万円です） |
| 6 | SUCCESS | どのような成果が得られれば成功ですか？ |
| 7 | EXISTING | 現在の研究手法で課題に感じていることは何ですか？ |

**Question Format**:

```markdown
## ❓ 質問 N/M
**カテゴリ**: WHY
この研究で AI を使って何を達成したいですか？
（例: 新規材料の候補を網羅的にスクリーニングしたい、気象シミュレーションの精度を向上させたい）
```

> ⚠️ In CONSTRAINT category questions, the example text **must** accurately state **SPReAD の予算上限は直接経費500万円（間接経費を含め最大650万円）**. Never state incorrect amounts such as 「1,000万円」.

### Step 3: Meta-Prompt Generation

Structure the collected information into a 6-element meta-prompt.
- Reuse `assets/meta-prompt-template.md` when producing the meta-prompt

**Meta-prompt Display Format**:

```markdown
## 📋 構造化メタプロンプト

| 要素 | 内容 |
|------|------|
| PURPOSE | [収集した目的] |
| TARGET | [研究対象・分野] |
| SCOPE | [範囲・規模] |
| TIMELINE | [期間（約180日間）] |
| CONSTRAINTS | [制約条件] |
| DELIVERABLES | [期待成果物] |

この内容で研究プラン策定を進めてよろしいですか？
修正があればお知らせください。
```

### Step 4: User Approval

- Display the meta-prompt and **always wait** for user approval / ユーザー承認
- If modifications are requested, update the relevant elements and re-display
- 承認を得た後 (after approval), save the meta-prompt to `output/{project-name}/meta-prompt.md`

### Step 5: Handoff to Downstream Skills

Based on the approved meta-prompt, hand off processing to the optimal skill
following the routing rules in AGENTS.md. The meta-prompt content becomes
the input context for the downstream skill as-is.

## Deliverables

- `output/{project-name}/meta-prompt.md`: Approved 6-element meta-prompt

## Quality Gates

- [ ] All 6 elements are filled (「不明」/「未定」 have been supplemented with estimated values)
- [ ] Meta-prompt is finalized only after obtaining user approval
- [ ] Multiple questions are never asked simultaneously in a single message
- [ ] A minimum of 3 dialogue turns have been conducted

## Gotchas

- Even if the user says 「全部お任せ」 (leave everything to you), explicitly confirm at least PURPOSE and TARGET. Proceeding on estimates alone causes major rework downstream
- Question order is not fixed. Skip elements already known from the user's initial prompt
- When receiving a 「わからない」 response, propose typical values for the research field and confirm
- **Never ask about the application deadline in TIMELINE questions.** The 公募期間 is fixed at 「令和8年4月17日～5月18日正午」. The research period is also fixed at ~180 days. TIMELINE confirms the scope and milestones for the 180-day period

## Validation Loop

1. Assess the sufficiency status of the 6 elements
2. Check:
   - All elements are filled with concrete values
   - User approval has been obtained
   - Required Inputs for downstream skills can be satisfied
3. If any check fails:
   - Ask additional questions for insufficient elements
   - Propose estimated values and confirm
4. Finalize the meta-prompt only after all gates pass
