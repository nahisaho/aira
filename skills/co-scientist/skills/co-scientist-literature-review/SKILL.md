---
name: co-scientist-literature-review
description: |
  Systematic literature review and synthesis skill. PRISMA-compliant screening,
  source evaluation, gap identification, and evidence synthesis from multiple databases.
  Use when COLLECTING prior research, searching databases, screening papers,
  synthesizing findings, or identifying research gaps in existing literature.
tu_tools:
  - key: pubmed
    name: PubMed
  - key: semantic_scholar
    name: Semantic Scholar
  - key: crossref
    name: Crossref
---

# Literature Review

Systematic literature search, screening, and evidence synthesis.

## Use This Skill When

- Searching for prior research on a topic.
- Conducting a PRISMA-compliant systematic review.
- Screening and evaluating source quality.
- Synthesizing findings across multiple studies.
- Identifying research gaps.

## Workflow

1. Define search strategy:
   - Keywords and Boolean operators
   - Target databases (PubMed, Scopus, Web of Science, Google Scholar)
   - Inclusion/exclusion criteria
   - Date range and language filters

2. Execute search and screen results:
   - Title/abstract screening
   - Full-text screening
   - Quality assessment (risk of bias)

3. Extract and synthesize:
   - Data extraction table
   - Thematic analysis or narrative synthesis
   - Gap identification

4. Generate PRISMA flow diagram data

5. Save all outputs to files

## Deliverables

- `report.md`: synthesis narrative with key findings.
- `results/search-strategy.md`: documented search methodology.
- `results/screening-table.csv`: inclusion/exclusion decisions.
- `results/extraction-table.csv`: extracted data from included studies.
- `figures/prisma-flow.md`: PRISMA flow diagram data.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| PubMed | `PubMed_search` | PubMed API |
| PubMed | `PubMed_get_article` | PubMed API |
| Semantic Scholar | `SemanticScholar_search` | Semantic Scholar API |
| Semantic Scholar | `SemanticScholar_get_paper` | Semantic Scholar API |
| Crossref | `Crossref_search_works` | Crossref API |

- Read `references/prisma-guide.md` when conducting PRISMA-compliant systematic reviews.

## Quality Gates

- [ ] Search strategy is documented and reproducible.
- [ ] Inclusion/exclusion criteria are explicit.
- [ ] At least 3 sources are cross-validated for key claims.
- [ ] Single-source findings are marked with ⚠️.
- [ ] Research gaps are identified with supporting evidence.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Google Scholar の検索結果は網羅性が低い。必ず PubMed/Scopus と併用すること
- 単一ソースの情報は ⚠️ マークを付け、断定的な結論に使用しないこと
- プレプリント（bioRxiv, arXiv）は査読前であることを明記すること
- 検索語の日英バイリンガル展開を行うと、非英語圏の重要な研究を見落とさない
- スクリーニング結果は逐次ファイルに保存すること。コンパクションで中間結果が消失する

## Validation Loop

1. 検索戦略とスクリーニング結果を生成
2. チェック:
   - 検索語が研究目的をカバーしているか
   - 2つ以上のデータベースを使用しているか
   - 単一ソースの主張に ⚠️ が付いているか
3. 不合格なら検索戦略を修正して再実行
4. 合格後のみ合成フェーズへ進む
