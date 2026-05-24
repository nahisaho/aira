---
name: co-scientist
description: |
  Harness-optimized collaborative research partner suite v3.0.0 with 202 specialized sub-skills.
  Covers research planning, literature review, experimental design, data analysis,
  academic writing, peer review, reproducibility, and presentation.
  Use when conducting scientific research, writing papers, designing experiments,
  or managing the full research lifecycle from hypothesis to publication.
---

# Co-Scientist v3.0.0

Collaborative research partner with 202 specialized sub-skills. Route work to the narrowest sub-skill, save all outputs as files, and leave a complete execution trace.

## Core Rules

- Write `report.md` in the same language as the user's input.
- Keep all figure, chart, axis, legend, and annotation text in English.
- Save every artifact to files. Do not leave analysis, code, tables, or figures only in chat.
- Prefer the narrowest matching sub-skill instead of loading broad context.
- Final chat output should summarize saved files, not reproduce the full analysis.
- **深さ優先原則**: 1つの核心的手法を深く検証することを、複数手法の表面的統合より優先する。
  - 手法が3つ以上の場合: 必ず ablation study で各手法の個別寄与を定量化
  - "unified framework" を提案する場合: フレームワークなしの単独手法ベースラインとの比較が必須
  - 各コンポーネントの必要性を実験的に示せない場合、そのコンポーネントを削除すること

## Context Sufficiency Check

Before starting any work, assess whether the user's request provides enough context:

- **Insufficient context** (research topic unclear, scope undefined, key parameters missing):
  - Do NOT proceed with execution.
  - Output a numbered list of specific clarifying questions in the user's language.
  - End with: "上記の質問にお答えください。回答をいただければ作業を開始します。" (or equivalent in user's language).
  - Do NOT create any files or run any tools.
- **Sufficient context** (topic clear, scope defined, enough to begin):
  - State any assumptions explicitly, then proceed with the appropriate sub-skill.

## Data Acquisition (MCP / ToolUniverse)

89 sub-skills integrate with [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) via MCP server for access to 100+ scientific database APIs.

### MCP Configuration

MCP server config: `.mcp.json` in this directory.  
Command: `tooluniverse-smcp --compact-mode` (stdio transport, compact mode loads core discovery tools).

### Tool Usage Rules

- Use MCP tools when available for database queries (PubMed, ChEMBL, Ensembl, UniProt, etc.).
- Fall back to Python `requests` + public REST APIs when MCP server is unavailable.
- Fall back to `web_search` as a secondary option.
- Each sub-skill's `tu_tools` frontmatter lists its available MCP tools.
- Each sub-skill's "Available Tools (MCP)" section documents tool names and sources.
- Do not enable more than 10 MCP servers simultaneously.
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

## Research Lifecycle

Phase 0 → `co-scientist-research-planning`: 研究計画

Phase 1 → `co-scientist-literature-review`: 文献調査

Phase 2 → `co-scientist-experimental-design`: 実験計画

Phase 3 → `co-scientist-data-analysis`: 実行・解析

Phase 4 → `co-scientist-academic-writing`: 論文執筆
  → 🦆 `co-scientist-critical-review` (Mode: Deep Review, 1回のみ)
  → 問題があれば1回だけ修正して反映

Phase 4.5 → `co-scientist-citation-checker`: 引用検証

Phase 5 → `co-scientist-peer-review`: 査読対応

Phase 6 → `co-scientist-reproducibility`: 再現性確保

Phase 7 → `co-scientist-presentation`: 発表準備

### Single-Turn Execution Mode

単一プロンプトで全工程を依頼された場合でも、内部では上記 Phase を順に実行すること。
Deep Review は Phase 4 の後に1回だけ実施し、問題があれば1回だけ修正すること。

## Quality Gates

- [ ] `report.md` に `## Limitations and Future Work` が存在し、200語以上ある。
- [ ] `report.md` は 1,000語以上である。
- [ ] 主要な定量結果に CI / ± / p値などの不確実性指標が含まれる。

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

Every execution follows: PLAN → EXECUTE → VERIFY → REPORT → LOG.

1. **PLAN**: define objective, constraints, and target outputs.
2. **EXECUTE**: run the selected sub-skill pipeline and save artifacts.
3. **VERIFY**: check the three quality gates.
4. **REPORT**: write `report.md` in the user's language.
5. **LOG**: finalize `logs/process-log.jsonl`.

## Data Handling & Confidentiality

- Research data containing patient info, proprietary datasets, or unpublished results is confidential.
- Use placeholders such as "[Subject A]" and "[Dataset X]" instead of real identifiers.
- Do not store credentials, tokens, or access keys in generated files.
- Mark draft manuscripts as "DRAFT — NOT FOR DISTRIBUTION" when appropriate.
- Cite only published or authorized sources for claims.

## Cost Efficiency Rules

- Do not enable more than 10 MCP servers simultaneously.
- Default to Python `requests` for API calls; use ToolUniverse MCP only when it adds material value.
- Prefer the narrowest sub-skill. Do not load broad context.

## Gotchas

- 複数 Phase にまたがるタスクでは、Phase 間の引き継ぎ情報を必ずファイルに保存すること。
- `co-scientist-literature-review` と `co-scientist-research-planning` は起動条件が近い。テーマ未定なら planning、テーマ決定済みで先行研究探索なら literature-review。
- `logs/process-log.jsonl` への記録を忘れると、後続 Phase で追跡不能になる。
- Deep Review は Phase 4 の後に1回だけ実施し、修正も1回だけに留めること。
