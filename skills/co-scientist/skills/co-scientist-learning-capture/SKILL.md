---
name: co-scientist-learning-capture
description: |
  Research learning capture and knowledge persistence skill. Records discoveries,
  edge cases, and methodological insights from completed research tasks.
  Use when FINISHING a research task, discovering a methodological pitfall,
  resolving an analysis error, or recording lessons for future research sessions.
---

# Learning Capture

Research learnings, methodological insights, and Gotchas maintenance.

## Use This Skill When

- Completing a research task and recording lessons learned.
- Discovering a methodological pitfall or edge case.
- Resolving an analysis error that others should avoid.
- Updating Gotchas in related co-scientist skills.

## Workflow

1. Identify learning event:
   - Analysis error that was corrected
   - Methodological shortcut that worked well
   - Assumption that proved incorrect
   - Tool or library behavior that was unexpected

2. Structure the learning:
   - **WHAT**: Specific situation description
   - **WHY**: Why it matters (impact, frequency)
   - **HOW**: Concrete prevention or best practice
   - **WHERE**: Which co-scientist skill should be updated

3. Generate Gotcha entry:
   - 1-2 lines, concrete, actionable
   - Include specific commands, settings, or thresholds
   - Avoid generic advice

4. Update target skill's Gotchas section

5. Record in `logs/learnings-log.jsonl`:
   ```json
   {"timestamp":"...","skill":"co-scientist-data-analysis","learning":"Forgot Bonferroni correction for multiple comparisons","action":"Added to Gotchas","severity":"high"}
   ```

## Deliverables

- Updated Gotchas in target skill's SKILL.md.
- `logs/learnings-log.jsonl`: timestamped learning record.

## Quality Gates

- [ ] Learning is specific (not generic advice).
- [ ] Gotcha entry is 1-2 lines and actionable.
- [ ] No duplicate with existing Gotchas.
- [ ] Target skill remains under 500 lines after addition.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Record learnings immediately after a mistake occurs. Details fade over time
- Generic advice ("write tests") has low value. Write project-specific concrete insights
- If Gotchas exceeds 10 items, consider categorizing them
- Do not duplicate the same learning across multiple skills. Write it in the single most relevant place

## Validation Loop

1. Generate the gotcha entry
2. Check:
   - Does it include specific commands, settings, or thresholds?
   - Does it duplicate existing Gotchas?
   - Does the skill remain within 500 lines after the addition?
3. If it fails, revise it
4. Append only after passing
