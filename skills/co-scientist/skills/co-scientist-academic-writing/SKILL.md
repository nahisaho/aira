---
name: co-scientist-academic-writing
description: |
  Academic paper writing and formatting skill. IMRaD structure, journal-specific formats
  (Nature, Science, ACS, IEEE, Elsevier), citation management, and abstract optimization.
  Use when WRITING research papers, drafting manuscripts, formatting for journal submission,
  structuring IMRaD sections, or optimizing abstracts and titles.
tu_tools:
  - key: crossref
    name: Crossref
---

# Academic Writing

Research paper drafting, journal formatting, and citation management.

## Use This Skill When

- Drafting a new research paper from analysis results.
- Structuring a manuscript in IMRaD format.
- Formatting for a specific journal (Nature, Science, ACS, IEEE, Elsevier).
- Writing or optimizing an abstract.
- Managing citations and references.

## Workflow

1. Determine target journal and format:
   - Identify journal guidelines (word limit, section structure, figure limits)
   - Select appropriate template

2. Draft sections in order:
   - Methods (most objective, draft first)
   - Results (present findings with figure references)
   - Introduction (frame the research question and significance)
   - Discussion (interpret results, limitations, future work)
   - Abstract (summarize after all sections complete)
   - Title (optimize for discoverability)

3. Citation integration:
   - Insert in-text citations in required format
   - Generate reference list
   - Verify all citations are referenced and vice versa

4. Quality review:
   - Check logical flow across sections
   - Verify figures and tables are referenced
   - Ensure claims are supported by results

## Deliverables

- `report.md`: writing progress summary.
- `results/manuscript.md`: complete manuscript draft.
- `results/abstract.md`: optimized abstract.
- `results/references.md`: formatted reference list.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |

- Reuse `assets/imrad-template.md` when writing IMRaD-format papers.

## Quality Gates

- [ ] Manuscript follows target journal's structure and guidelines.
- [ ] All claims in Discussion are supported by Results.
- [ ] Every figure and table is referenced in text.
- [ ] Abstract contains objective, methods, key results, and conclusion.
- [ ] Word count is within journal limits.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Methods セクションを最初に書くこと。最も客観的で、他セクションの基盤になる
- Discussion で Results に記載されていないデータを引用してはならない
- Abstract は全セクション完成後に書くこと。先に書くと内容との乖離が生じる
- 引用は「著者名+年」形式と「番号」形式でジャーナルごとに異なる。投稿先を確認してから書式を決定
- 図表の説明文（caption）は図を見ただけで内容が分かる自己完結型にすること

## Validation Loop

1. 原稿を生成
2. チェック:
   - ターゲットジャーナルの構造に合致しているか
   - Discussion の主張が全て Results に根拠があるか
   - 全図表がテキスト中で参照されているか
   - 語数がジャーナル制限以内か
3. 不合格なら該当セクションを修正
4. 合格後のみ投稿準備完了
