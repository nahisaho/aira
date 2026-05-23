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

4. DOI 付与・書誌情報検証:
   - 参考文献リストの各エントリに対し:
     1. Crossref API (`https://api.crossref.org/works?query=TITLE`) でタイトル検索
     2. 一致する論文が見つかった場合: DOI を付与し、巻号・ページ番号を正確な値に更新
     3. 一致しない場合: Semantic Scholar API でフォールバック検索
     4. どちらでも見つからない場合: ⚠️ マークを付与

5. メタデータ正規化:
   - 著者名: "Last, F.M." 形式に統一
   - 年: 括弧内に統一 "(2020)"
   - ジャーナル: イタリック体 "*Journal Name*"
   - DOI: 末尾に `https://doi.org/...` を追加

6. 検証不能率チェック:
   - 検証不能率 > 20%: Quality Gate FAIL
   - 検証不能率 > 10%: WARNING（手動確認推奨）

7. レポート生成:
   - 各引用の検証ステータス（verified / unverified / suspicious）
   - 意味的対応の問題箇所リスト
   - DOI 付与率と書誌情報修正箇所
   - `results/citation-report.md` に保存

8. Append citation check results to `logs/process-log.jsonl`.

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

- [ ] 本文中の全 [N] が References に対応している
- [ ] References の全エントリが本文中で引用されている
- [ ] バルク引用 [N-M] がない（各引用に個別の説明がある）
- [ ] 検証不能率が 20% 以下である
- [ ] DOI が付与可能な全参考文献に DOI が付与されている
- [ ] 書誌メタデータ（著者名、年、巻号）が正規化されている
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts
- [ ] No essential result remains chat-only

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Citation style varies by journal (author-year vs numbered). Confirm target format before writing
- Claims in Discussion must trace back to specific Results. Do not introduce new data in Discussion
- Supplementary materials must be self-contained with their own figure/table numbering
- **DOI が不明な場合は巻号・ページ番号を省略し、タイトルと著者のみ記載すること。不正確なメタデータを推測して記載するより、省略する方が望ましい**
- **Crossref API はレート制限あり（polite pool: mailto ヘッダー付きで50req/s）。バッチ処理時は適切な間隔を設けること**

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
