---
name: co-scientist-peer-review
description: |
  Peer review response and revision management skill. Self-review checklists,
  reviewer comment analysis, point-by-point response drafting, and revision tracking.
  Use when RESPONDING to peer review comments, preparing revision letters,
  conducting self-review before submission, or tracking manuscript revisions.
---

# Peer Review

Self-review, reviewer response, and revision management.

## Use This Skill When

- Responding to peer reviewer comments.
- Drafting a point-by-point response letter.
- Conducting a self-review before submission.
- Tracking changes between manuscript versions.

## Workflow

1. Parse reviewer comments:
   - Categorize: Major revision / Minor revision / Clarification / Editorial
   - Prioritize by impact on manuscript

2. Draft point-by-point response:
   - Address each comment individually
   - Quote the original comment
   - State the action taken
   - Reference specific manuscript changes (page, line, section)

3. Apply revisions to manuscript:
   - Track all changes with before/after references
   - Ensure consistency across sections

4. Self-review checklist (pre-submission):
   - Logical flow from Introduction to Discussion
   - All figures and tables referenced
   - Statistical reporting completeness
   - Citation accuracy

## Deliverables

- `report.md`: revision summary.
- `results/response-letter.md`: point-by-point response.
- `results/revision-log.md`: change tracking table.
- `results/self-review-checklist.md`: pre-submission checklist.

## Output Template (Response Letter)

```markdown
# Response to Reviewers

## Reviewer 1

### Comment 1.1 [Major]
> [Original reviewer comment]

**Response**: [Detailed response]
**Action**: [Specific changes made]
**Location**: [Section/Page/Line]

### Comment 1.2 [Minor]
> [Original reviewer comment]

**Response**: [Detailed response]
**Action**: [Specific changes made]
**Location**: [Section/Page/Line]
```

## Quality Gates

- [ ] Every reviewer comment is addressed individually.
- [ ] Response distinguishes between agreement, partial agreement, and respectful disagreement.
- [ ] Each response references specific manuscript changes.
- [ ] Revision log tracks all changes with before/after.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Even when rebutting reviewer comments, first express appreciation and then present evidence. Aggressive responses can lead to rejection
- "We revised it" alone is insufficient. Describe specifically what was changed and how
- If there are conflicting comments between reviewers, present a response strategy that is consistent for both
- If major additional experiments or analyses are requested, confirm feasibility before committing

## Validation Loop

1. Generate the response letter
2. Check:
   - Is there an individual response to every comment?
   - Does each response include specific changes made?
   - Are manuscript changes identified (section/line numbers)?
   - Are there no contradictory responses?
3. Revise if it fails
4. Submit only after passing
