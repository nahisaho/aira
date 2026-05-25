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

- Do not use the output of `pip freeze` as-is. Put only direct dependencies in `requirements.txt`, and separate transitive dependencies with `pip freeze > requirements-lock.txt`
- Jupyter notebooks have low reproducibility due to cell execution order. Always convert them to `.py` scripts or run an end-to-end test with `nbconvert --execute`
- Random seeds must be set separately for each library such as numpy, random, and torch
- If the data is large (>100MB), do not include it in the repository; provide a download script instead

## Validation Loop

1. Generate the reproducibility package
2. Check:
   - Are dependencies version-pinned?
   - Are random seeds set across all libraries?
   - Are clean-environment execution steps documented in the README?
   - Are data provenance and preprocessing steps documented?
3. If it fails, revise it
4. If possible, verify by running tests in a clean environment
