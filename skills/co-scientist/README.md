# co-scientist

Harness-optimized collaborative research partner suite with 202 specialized sub-skills, 2 Custom Agents, and full Orchestrator routing.

- **Source path**: `co-scientist`
- **Version**: v1.0.0
- **Sub-skills**: 202
- **Custom Agents**: 2 (research-lead, methods-auditor)

## Harness Optimization

Built on the [Harness 7-axis framework](https://qiita.com/hisaho/items/b3abdbf1df498c4244db):

| Axis | Implementation |
|------|---------------|
| Tool Coverage | WHEN/DO Orchestrator + 9 skills + 2 agents |
| Context Efficiency | Progressive Disclosure, <100 lines per skill, conditional references |
| Quality Gates | Verification loop (PLAN→EXECUTE→VERIFY→REPORT→LOG) in every skill |
| Memory Persistence | Gotchas sections + learning-capture skill |
| Eval Coverage | Validation loops with failure recovery in every skill |
| Security Guardrails | Data handling rules, prohibited operations |
| Cost Efficiency | Description keyword separation, compact skills |

## Research Lifecycle Coverage

```
Phase 0: Research Planning     → co-scientist-research-planning
Phase 1: Literature Review     → co-scientist-literature-review
Phase 2: Experimental Design   → co-scientist-experimental-design
Phase 3: Data Analysis         → co-scientist-data-analysis
Phase 4: Academic Writing      → co-scientist-academic-writing
Phase 5: Peer Review           → co-scientist-peer-review
Phase 6: Reproducibility       → co-scientist-reproducibility
Phase 7: Presentation          → co-scientist-presentation
Cross-cutting: Learning Capture → co-scientist-learning-capture
```

## ディレクトリ構成（デプロイ時）

```
<project-folder>/.github/
├── AGENTS.md              ← co-scientist/AGENTS.md をコピー
├── copilot-instructions.md ← co-scientist/copilot-instructions.md をコピー
├── agents/                ← co-scientist/agents/ をコピー
│   ├── research-lead.md
│   ├── methods-auditor.md
│   ├── statistician.md
│   ├── data-steward.md
│   └── writing-coach.md
└── skills/                ← co-scientist/skills/ をコピー
    ├── co-scientist-research-planning/SKILL.md
    ├── co-scientist-literature-review/SKILL.md
    └── ...（202 sub-skills）
```

| Aspect | scientist | co-scientist |
|--------|-----------|-------------|
| Sub-skills | 195 domain-specific | 9 lifecycle-oriented |
| Orchestrator | Embedded in root SKILL.md | WHEN/DO routing with phase gates |
| Custom Agents | None | 2 (research-lead, methods-auditor) |
| Gotchas | None | 3+ items per skill |
| Validation loops | Basic quality gates | Full loops with failure recovery |
| Memory Persistence | None | learning-capture skill |
| Description quality | Generic templates | Keyword-separated for routing precision |
