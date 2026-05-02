---
name: co-scientist-reproducibility
description: |
  Research reproducibility and data management skill. Code packaging, data archiving,
  environment documentation, workflow automation, and FAIR data principles.
  Use when ENSURING reproducibility, packaging code for sharing, documenting environments,
  archiving datasets, or applying FAIR data principles to research outputs.
---

# Reproducibility

Code packaging, data management, and reproducibility assurance.

## Use This Skill When

- Packaging analysis code for sharing or archiving.
- Documenting computational environments (dependencies, versions).
- Archiving datasets with metadata (FAIR principles).
- Creating reproducible workflow pipelines.
- Preparing supplementary materials for publication.

## Workflow

1. Code reproducibility:
   - Create `requirements.txt` / `environment.yml` with pinned versions
   - Write a `README.md` with setup and execution instructions
   - Add seed values for random processes
   - Verify the pipeline runs from scratch

2. Data management:
   - Document data provenance and preprocessing steps
   - Create data dictionary with variable descriptions
   - Apply FAIR principles (Findable, Accessible, Interoperable, Reusable)
   - Generate checksums for data integrity

3. Workflow automation:
   - Create Makefile or shell scripts for end-to-end execution
   - Document expected outputs and intermediate checkpoints
   - Add validation steps between pipeline stages

4. Archiving:
   - Prepare for repository deposit (Zenodo, Figshare, Dryad)
   - Generate DOI-ready metadata
   - Create a LICENSE file

## Deliverables

- `report.md`: reproducibility assessment summary.
- `results/reproducibility-checklist.md`: item-by-item evaluation.
- `results/environment-spec.md`: environment documentation.
- `results/data-dictionary.md`: variable descriptions and metadata.

## Quality Gates

- [ ] All dependencies are pinned to specific versions.
- [ ] Random seeds are set and documented.
- [ ] Pipeline runs from a clean environment without manual intervention.
- [ ] Data provenance is documented from raw to processed.
- [ ] A README explains how to reproduce the analysis.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- `pip freeze` の出力をそのまま使わないこと。直接依存のみを `requirements.txt` に書き、間接依存は `pip freeze > requirements-lock.txt` で分離する
- Jupyter Notebook は再現性が低い（セル実行順序依存）。必ず `.py` スクリプトに変換するか、`nbconvert --execute` で通しテストすること
- ランダムシードは numpy, random, torch 等のライブラリごとに個別に設定が必要
- データサイズが大きい場合（>100MB）はリポジトリに含めず、ダウンロードスクリプトを提供すること

## Validation Loop

1. 再現性パッケージを生成
2. チェック:
   - 依存関係がバージョン固定されているか
   - ランダムシードが全ライブラリで設定されているか
   - クリーン環境からの実行手順が README に記載されているか
   - データの出所と加工手順が文書化されているか
3. 不合格なら修正
4. 可能であればクリーン環境でテスト実行して検証
