---
name: co-scientist-critical-review
description: |
  Critical review skill. Systematic assessment of research quality, experimental rigor evaluation, statistical claim verification, and comprehensive peer review analysis.
  Use when working with systematic assessment of research quality, experimental rigor evaluation, statistical claim verification.
---

# Critical review

Critical review skill. Systematic assessment of research quality, experimental rigor evaluation, statistical claim verification, and comprehensive peer review analysis.

## Use This Skill When

- Systematic assessment of research quality.
- Experimental rigor evaluation.
- Statistical claim verification.
- Comprehensive peer review analysis.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. 主張-証拠マッピング:
   - Discussion/Conclusionの各主張を抽出
   - 各主張に対応するResults内の証拠を特定
   - 証拠の強度を評価（統計検定あり/なし、効果量、サンプルサイズ）

2. 過大主張チェック:
   - Claim Calibration Rules（`co-scientist-academic-writing` 参照）に照らして表現を検証
   - 実験条件の限定性と主張の一般性の不一致を検出
   - "our method" vs "the proposed approach" — 客観性の確認

3. 論理的整合性:
   - Introduction の問題設定 → Methods の解決策 → Results の証拠 → Conclusion の主張
   - この鎖が途切れていないか検証

4. 限界の適切な記述:
   - Limitations セクションが「形式的」でないか（実質的な限界を述べているか）
   - 合成データのみの場合: 外的妥当性の限界が明記されているか
   - 単一ドメインの場合: 一般化可能性への注意が記載されているか

5. 統計的妥当性:
   - 全ての定量的結果に不確実性指標があるか
   - 性能比較に統計検定が伴っているか
   - 効果量が報告されているか

6. Save review findings to `results/critical-review.md` and append to `logs/process-log.jsonl`.

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

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
