---
name: spread1000-submission-guide
description: |
  Guide the entire SPReAD submission process. Covers AI interview preparation and execution,
  e-Rad registration and submission procedures, eligibility and overlap restriction checks,
  and completeness verification of submission documents (様式0–4).
  Use when preparing for the AI interview, learning e-Rad procedures, checking eligibility,
  checking overlap restrictions, learning student application procedures, or assembling submission documents.
---

# Submission Guide

Provide unified guidance on all procedures required for SPReAD submission (AI interview, e-Rad, submission documents).

## Use This Skill When

- Preparing for or learning the AIインタビュー (AI interview) procedure
- Confirming e-Rad registration and submission procedures
- Checking eligibility requirements
- Checking overlap restrictions (e.g., with ARiSE)
- 学生応募の手続き / Learning student-specific application procedures
- 研究インテグリティ誓約の確認 / Verifying research integrity pledge
- Assembling the full document set (様式0–4)

## Required Inputs

- Applicant attributes (affiliated institution, position, whether a student)
- Status of other competitive research fund applications/awards (for overlap restriction checks)

## Workflow

1. **Eligibility check** — Determine whether the applicant meets all eligibility requirements
   - Read `references/eligibility-rules.md` when checking eligibility
2. **Overlap restriction check** — Verify restrictions with ARiSE and other programs
3. **AI interview preparation guide** — Walk through the process from registration to completion certificate
   - Read `references/ai-interview-guide.md` when guiding AI interview
4. **e-Rad submission guide** — Registration confirmation, research integrity pledge, submission steps
5. **Generate submission document checklist** — Completeness check for 様式0–4 and attachments
6. **Output guide report** — Save as `output/{project-name}/submission-checklist.md`
   - Reuse `assets/submission-checklist-template.md` when producing the checklist

## Deliverables

- `output/{project-name}/submission-checklist.md`: Submission procedure checklist (complete version)

## Quality Gates

- [ ] All eligibility requirements have been verified
- [ ] Overlap restrictions (including ARiSE) have been checked
- [ ] Full AI interview procedure (registration → completion certificate) has been covered
- [ ] e-Rad registration and research integrity pledge confirmation are included
- [ ] Completeness of submission documents (様式0–4) has been checked
- [ ] For student applicants, 様式3 and 様式4 requirements have been added

## Gotchas

- The AI interview is limited to one attempt per person. If interrupted, it can be resumed via the link within 48 hours
- If the email address used for AI interview registration does not match the one in the 研究計画調書, the application will be rejected
- If the research integrity pledge on e-Rad is not registered, the application will be rejected
- When a student applies using their supervisor's researcher number, e-Rad individual fields must still be filled with the student's own information (effort rate: 1%)
- Disclosing AI interview content on social media or to third parties may result in rejection

## Security Guardrails

- Do not disclose AI interview questions or content externally
- Do not include e-Rad login credentials or researcher numbers in deliverable files
- Mask personal information (email addresses, etc.) in the checklist

## Validation Loop

1. Generate the checklist based on applicant attributes
2. Check:
   - Do all eligibility requirements pass?
   - Are there no overlap restriction violations?
   - Can AI interview completion be confirmed?
   - Are all submission documents assembled?
3. If any check fails:
   - Identify the deficient item and guide the required corrective steps
4. Finalize the checklist only after all gates pass
