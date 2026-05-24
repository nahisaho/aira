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

5. 自己査読（Self-Review）:
   - `co-scientist-citation-checker` の意味的対応チェックを実施
   - 全ての定量的結果に不確実性指標（CI, SD, p値）が付与されているか確認

## Paper Structure Template (Mandatory Sections)

1. Abstract
2. Introduction
3. Methods / Proposed Approach
4. Results
5. Discussion
6. **Limitations and Future Work** ← 必須セクション
7. Conclusion
8. References

### Limitations and Future Work

```text
## Limitations and Future Work

### Data Limitations
[合成データのみか実データか。サンプルサイズ。既知のバイアス。ドメイン制約を記述]

### Methodological Limitations  
[仮定の妥当性。スケーラビリティ。計算コスト。手法固有の制約を記述]

### Evaluation Limitations
[評価指標の選択根拠と限界。ベースライン数。外部検証の有無を記述]

### Generalizability
[他のドメイン/データセットへの適用可能性。ドメインシフトの影響を記述]

### Future Directions
[具体的な改善策。短期（6ヶ月）と長期（1-2年）のロードマップを記述]
```

**合成データのみの場合の必須文**: 以下の文を Evaluation Limitations に必ず含めること:
> "External validation with independent real-world datasets is essential to confirm the generalizability of these findings beyond simulated conditions."

## Reference Rules

参考文献を記載する際は、可能な限り DOI を付与すること。
DOI が不明な場合は巻号・ページ番号を省略し、タイトルと著者のみ記載すること。
不正確なメタデータを推測して記載するより、省略する方が望ましい。

### Reference Quality Standards
- 文献調査を伴う論文では **≥10 件** の参考文献を目標とする。
- DOI 形式の検証: `10.XXXX/XXXXX` 形式であることを確認。形式が不正な DOI は削除する。
- 各参考文献は本文中で個別に引用すること。バルク引用 `[1-5]` は禁止。

## Claim Calibration

Avoid overclaiming: replace "novel"→"proposed", "state-of-the-art"→"competitive", "guarantees"→"is designed to" unless evidence supports the claim.
Use cautious phrasing when evidence is limited, especially for synthetic-only or single-benchmark studies.
Discussion and Conclusion must not make claims that Results do not support.

## Deliverables

- `report.md`: writing progress summary.
- `results/manuscript.md`: complete manuscript draft.
- `results/abstract.md`: optimized abstract.
- `results/references.md`: formatted reference list.

`report.md` は objectives, methods, results, and discussion を含む 1,000語以上とする。

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |

- Reuse `assets/imrad-template.md` when writing IMRaD-format papers.

## Quality Gates

- [ ] Limitations and Future Work section exists, ≥200 words
- [ ] report.md ≥ 1,000 words
- [ ] All quantitative results have uncertainty indicators (CI, ±SD, or p-value)

## Gotchas

- Methods セクションを最初に書くこと。最も客観的で、他セクションの基盤になる
- Discussion で Results に記載されていないデータを引用してはならない
- Abstract は全セクション完成後に書くこと。先に書くと内容との乖離が生じる
