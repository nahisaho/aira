---
name: co-scientist-citation-checker
description: |
  Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.
  Use when working with reference validation, doi verification, retraction detection.
tu_tools:
  - key: crossref
    name: Crossref
  - key: semantic_scholar
    name: Semantic Scholar
---

# Citation checking

Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.

## Use This Skill When

- Reference validation.
- DOI verification.
- Retraction detection.
- Citation consistency checking.
- Bibliography formatting compliance.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. 形式チェック:
   - 本文中の全 [N] が References に対応するか
   - References の全エントリが本文中で引用されているか
   - DOI があれば Crossref API で存在確認

2. 意味的対応チェック:
   - 各引用箇所で、引用が主張を裏付けているか検証
   - パターン検出:
     - ❌ "[1-5] have studied X" → 各文献の具体的貢献を記述すべき
     - ❌ "As shown in [3]" → 何が示されているか明記すべき
     - ✅ "Smith et al. [3] demonstrated that Y achieves Z% on dataset W"
   - 引用密度チェック: Introduction に引用が集中し Methods/Results に皆無は警告

3. ハルシネーション検出:
   - 著者名 + タイトル + 年 の組み合わせを Crossref/Semantic Scholar で検証
   - 検証不能な引用には ⚠️ マーク
   - 検証不能率が 20% を超えたら Quality Gate FAIL

4. レポート生成:
   - 各引用の検証ステータス（verified / unverified / suspicious）
   - 意味的対応の問題箇所リスト
   - `results/citation-report.md` に保存

5. Append citation check results to `logs/process-log.jsonl`.

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |
| Semantic Scholar | `SemanticScholar_get_citations` | Semantic Scholar API |

## Quality Gates

- [ ] The selected method matches the scientific question and stated assumptions.
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions.
- [ ] Missing data, uncertainty, bias, and hard limits are made explicit.
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts.
- [ ] No essential result remains chat-only.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Citation style varies by journal (author-year vs numbered). Confirm target format before writing
- Claims in Discussion must trace back to specific Results. Do not introduce new data in Discussion
- Supplementary materials must be self-contained with their own figure/table numbering

## Validation Loop

1. Execute analysis and generate outputs
2. Check:
   - Method selection matches the research question and stated assumptions
   - All outputs are saved to files (no chat-only results)
   - Limitations and uncertainty are explicitly stated
   - `logs/process-log.jsonl` is updated with execution trace
3. If any check fails:
   - Identify the failing gate
   - Fix the specific issue
   - Re-run validation
4. Proceed only after all gates pass
