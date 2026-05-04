---
name: spread1000-proposal-writer
description: |
  Draft the SPReAD proposal (research plan document). Integrate the research plan, Azure architecture
  design, and cost estimate to generate a proposal aligned with the 公募要領 requirements.
  Use when writing the proposal, finalizing the research plan document, or preparing submission documents.
---

# Proposal Writer

Integrate the research plan, Azure architecture design, and cost estimate to generate a proposal aligned with SPReAD 公募要領 requirements.

## Use This Skill When

- Research plan, Azure architecture, and cost estimate are ready, and it is time to draft the proposal
- Finalizing the research plan document (研究計画書) per SPReAD 公募要領
- Performing quality checks or refining the proposal

## Required Inputs

- `output/{project-name}/phase0-research-plan.md` (research plan)
- `output/{project-name}/phase1-azure-architecture.md` (Azure architecture design)
- `output/{project-name}/phase2-cost-estimate.md` (cost estimate)
- Principal investigator / co-investigator information
- Affiliated institution information
- Research period: from the grant decision date to January 6, Reiwa 9 (~180 days)

## Workflow

1. **Prerequisite check (MANDATORY)**:
   - Confirm that `output/{project-name}/phase2-cost-estimate.md` exists
   - If it does not exist, **run `spread1000-cost-estimator` first to generate the cost estimate before proceeding with proposal drafting**
   - If Phase 2 is in "Draft (prices unverified)" state, display a bold warning `⚠️ 価格未検証（推定値）` in the expense section
   - **Do NOT fill expense figures using LLM memory/estimated values. Always use the retrieved unit prices from Phase 2**
2. **Input integration**: Read and integrate deliverables from Phases 0–2
2. **Review 公募要領 requirements**: Confirm SPReAD 公募要領 requirements
   - Read `references/proposal-guidelines.md` when checking requirements
3. **Proposal structure** (mapped to 様式1 sections; strictly observe character limits):
   - **I. 研究目的** (80–400 characters) — Purpose of the research, target phenomena/challenges
   - **II. 研究方法** (160–800 characters) — AI application per work phase, data, evaluation metrics, validation methods
   - **III. AI利活用の妥当性・実現可能性** (160–800 characters) — Limitations of conventional methods, significance of AI adoption
   - **IV. 達成目標** (100–500 characters) — マイルストーン at mid-term / 中間（3ヶ月後）and final / 最終（6ヶ月後）
   - **V. AI利活用のノウハウ抽出・共有の実現計画** (60–300 characters) — Community sharing and cross-domain expansion
     - Reuse `assets/knowhow-sharing-template.md` when producing the know-how sharing section
   - **Reference: Figure attachment** (max 1 figure) — Select from Phase 1b draw.io architecture diagrams
   - **VI. 研究業績等** (max 5 items) — Bullet list of journal papers, conference presentations, and books
   - Research infrastructure plan (Azure architecture)
   - Expense plan and 積算根拠 / cost justification (直接経費 ≤ ¥5M)
4. **Generate proposal**: Save as `output/{project-name}/phase3-proposal.md`
   - Reuse `assets/proposal-template.md` when producing the proposal
5. **Quality review**: Verify alignment with 公募要領 requirements and logical consistency

## Deliverables

- `output/{project-name}/phase3-proposal.md`: SPReAD proposal (complete version)

## Quality Gates

- [ ] All mandatory items in the 公募要領 are covered
- [ ] Innovativeness as "AI for Science" is clearly articulated
- [ ] Research plan and Azure architecture are consistent
- [ ] Expense plan justification matches the cost estimate document
- [ ] Research schedule includes milestones
- [ ] The Japanese text reads naturally and clearly

## Gotchas

- **🚫 Do NOT fill expense figures using LLM training data or estimated values.** Cost justification must be based on Azure Retail Prices API-retrieved unit prices from `output/{project-name}/phase2-cost-estimate.md`. If Phase 2 does not exist, run `spread1000-cost-estimator` first
- SPReAD's core theme is "innovating scientific research through AI." Emphasize research approaches that are only possible with AI, rather than simple replacements of existing methods
- Adjust the cost estimate so the expense plan stays within the SPReAD budget ceiling (直接経費 ≤ ¥5M)
- Do not forget to address research ethics and data management policies
  - Read `references/dmp-guide.md` when producing data management sections
- Strictly observe the character limits for each section (Japanese/English character ranges are specified per section)
- 様式1 must be submitted as Excel (PDF conversion is not allowed). Count characters in the template and keep within limits
- Maximum 1 figure. Select the most appropriate diagram from the Phase 1b draw.io architecture diagrams

## Security Guardrails

- Do not include actual patient data, personally identifiable information, or confidential data in the proposal. Data examples must be anonymized or use dummy data
- References to IRB (research ethics review) and DMP (data management plan) are mandatory
- For research handling medical data, explicitly state compliance with data protection regulations (個人情報保護法, HIPAA, etc.)

## Validation Loop

1. Generate the proposal
2. Check:
   - Are all 公募要領 items covered?
   - Is the proposal consistent with Phase 0–2 deliverables?
   - Is the text logically coherent?
3. If any check fails:
   - Add missing items
   - Fix inconsistencies
   - Refine the text
4. Finalize the deliverable only after all gates pass
