---
name: co-scientist
description: |
  Harness-optimized collaborative research partner suite with 202 specialized sub-skills.
  Covers research planning, literature review, experimental design, data analysis,
  academic writing, peer review, reproducibility, and presentation.
  Use when conducting scientific research, writing papers, designing experiments,
  or managing the full research lifecycle from hypothesis to publication.
---

# Co-Scientist v1.0.0

Collaborative research partner with 202 specialized sub-skills. Route work to the narrowest sub-skill, save all outputs as files, and leave a complete execution trace.

## Core Rules

- Write `report.md` in the same language as the user's input.
- Keep all figure, chart, axis, legend, and annotation text in English.
- Save every artifact to files. Do not leave analysis, code, tables, or figures only in chat.
- Prefer the narrowest matching sub-skill instead of loading broad context.
- Final chat output should summarize saved files, not reproduce the full analysis.

## Data Acquisition (MCP / ToolUniverse)

89 sub-skills integrate with [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) via MCP server for access to 100+ scientific database APIs.

### MCP Configuration

MCP server config: `.mcp.json` in this directory.

### Tool Usage Rules

- Use MCP tools when available for database queries (PubMed, ChEMBL, Ensembl, UniProt, etc.).
- Fall back to Python `requests` + public REST APIs when MCP server is unavailable.
- Each sub-skill's `tu_tools` frontmatter lists its available MCP tools.
- Each sub-skill's "Available Tools (MCP)" section documents tool names and sources.
- Do not enable more than 10 MCP servers simultaneously (Context Efficiency).
- Record all tool invocations in `logs/process-log.jsonl`.

## Routing Rules

### WHEN/DO Dispatch

WHEN: ユーザーが研究テーマの設定、スコープ定義、方法論選択を依頼
DO: → `co-scientist-research-planning`

WHEN: ユーザーが文献調査、先行研究レビュー、システマティックレビューを依頼
DO: → `co-scientist-literature-review`

WHEN: ユーザーが実験計画、サンプルサイズ、検出力分析、プロトコル設計を依頼
DO: → `co-scientist-experimental-design`

WHEN: ユーザーがデータ分析、統計解析、可視化、結果解釈を依頼
DO: → `co-scientist-data-analysis`

WHEN: ユーザーが論文執筆、IMRaD構成、ジャーナル投稿準備を依頼
DO: → `co-scientist-academic-writing`

WHEN: ユーザーが査読対応、リバイズ、査読コメントへの回答を依頼
DO: → `co-scientist-peer-review`

WHEN: ユーザーが再現性確保、データ管理、コード整備、アーカイブを依頼
DO: → `co-scientist-reproducibility`

WHEN: ユーザーが学会発表、ポスター作成、プレゼン準備を依頼
DO: → `co-scientist-presentation`

### Task Classification

1. 外部文献の探索が必要か？
   - YES → `co-scientist-literature-review`
   - NO → 次へ
2. 実験やデータ収集の計画が必要か？
   - YES → `co-scientist-experimental-design`
   - NO → 次へ
3. 既存データの分析が必要か？
   - YES → `co-scientist-data-analysis`
   - NO → 次へ
4. 文書作成が必要か？
   - YES → 論文なら `co-scientist-academic-writing` / 発表なら `co-scientist-presentation`
   - NO → 次へ
5. 査読対応か？
   - YES → `co-scientist-peer-review`
   - NO → `co-scientist-research-planning` で要件整理から開始

### Full Lifecycle Workflow

Phase 0 → `co-scientist-research-planning`: 研究計画 ⏸️ ユーザー承認
Phase 1 → `co-scientist-literature-review`: 文献調査
Phase 2 → `co-scientist-experimental-design`: 実験計画 ⏸️ ユーザー承認
Phase 3 → `co-scientist-data-analysis`: データ分析
Phase 4 → `co-scientist-academic-writing`: 論文執筆
Phase 5 → `co-scientist-peer-review`: 査読対応
Phase 6 → `co-scientist-reproducibility`: 再現性確保
Phase 7 → `co-scientist-presentation`: 発表準備 ⏸️ ユーザー承認

## Required Output Layout

```text
workspace/
├── report.md
├── figures/
├── results/
├── data/
└── logs/
    └── process-log.jsonl
```

## Verification Loop

Every execution follows: PLAN → EXECUTE → VERIFY → REPORT → LOG

1. **PLAN**: define objective, constraints, target outputs, candidate sub-skills.
2. **EXECUTE**: run selected pipeline, save intermediate artifacts.
3. **VERIFY**: check outputs against quality gates.
4. **REPORT**: write `report.md` in user's language.
5. **LOG**: finalize `logs/process-log.jsonl`.

## Quality Gates

- [ ] Sub-skill routing matches the user's actual request.
- [ ] Figures saved to `figures/` and referenced from `report.md`.
- [ ] Numeric outputs saved under `results/`.
- [ ] `report.md` includes timestamp, methods, results, discussion, file inventory.
- [ ] `logs/process-log.jsonl` records sub-skill usage, handoff I/O, files written.
- [ ] No essential result remains chat-only.

## Prohibited Operations

- Phase をスキップしてはならない（Phase 0 → Phase 3 への直接遷移は禁止）
- ⏸️ 承認ポイントをスキップしてはならない
- 生データを加工せずに最終レポートに含めてはならない
- 単一ソースのみに基づく結論を断定的に述べてはならない

## Data Handling & Confidentiality

- Research data containing patient info, proprietary datasets, or unpublished results is confidential.
- Use "[Subject A]", "[Dataset X]" placeholders. Do not include real identifiers.
- Do not store credentials or access keys in generated files.
- Mark draft manuscripts as "DRAFT — NOT FOR DISTRIBUTION".
- Cite only published or authorized sources for claims.

## Cost Efficiency Rules

- Do not enable more than 10 MCP servers simultaneously.
- Default to Python requests for API calls; use ToolUniverse MCP only when it adds material value.
- Prefer the narrowest sub-skill. Do not load broad context.

## Gotchas

- 複数 Phase にまたがるタスクでは、Phase 間の引き継ぎ情報を必ずファイルに保存すること。コンパクションで中間結果が消失する
- `co-scientist-literature-review` と `co-scientist-research-planning` は起動条件が近い。研究テーマが未定なら planning、テーマ決定済みで先行研究を調べるなら literature-review
- process-log.jsonl への記録を忘れると、後続 Phase でどのスキルが何を行ったか追跡不能になる
