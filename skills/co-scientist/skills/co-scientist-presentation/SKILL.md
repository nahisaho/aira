---
name: co-scientist-presentation
description: |
  Research presentation and visual communication skill. Conference talk structure,
  poster layout, slide design, visual storytelling, and audience adaptation.
  Use when PRESENTING research at conferences, creating poster layouts,
  designing slides for talks, or adapting research content for different audiences.
---

# Presentation

Conference talks, poster design, and visual storytelling.

## Use This Skill When

- Preparing a conference talk (oral presentation).
- Designing a research poster.
- Creating slides for a seminar or defense.
- Adapting research for a non-specialist audience.

## Workflow

1. Audience analysis:
   - Specialist / General academic / Public / Industry
   - Expected background knowledge
   - Key takeaway message (1 sentence)

2. Structure design:
   - Talk: Hook → Problem → Approach → Results → Impact → Call to action
   - Poster: Visual abstract → Key findings → Methods → Conclusion
   - Time allocation per section

3. Visual design principles:
   - One idea per slide
   - Figure-heavy, text-light
   - Consistent color scheme (colorblind-friendly)
   - High-contrast for projected environments

4. Generate presentation outline and speaker notes

## Deliverables

- `report.md`: presentation strategy summary.
- `results/presentation-outline.md`: section-by-section outline.
- `results/speaker-notes.md`: talking points per section.
- `figures/`: presentation-optimized figures.

## Quality Gates

- [ ] Key takeaway is stated in 1 sentence.
- [ ] Time allocation covers all sections within the limit.
- [ ] Maximum 1 main idea per slide.
- [ ] Figures use colorblind-friendly palettes and high contrast.
- [ ] Speaker notes match the slide content.

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Resist the urge to show every result in a conference presentation. Select only the results needed for the story
- For posters, specify font sizes readable from 1.5 m away (title: at least 72 pt, body: at least 24 pt)
- Even for Japanese presentations, create figures in English. They can be reused for international conferences
- Target 80% of the allotted time for the presentation. A buffer is needed for Q&A and technical issues

## Validation Loop

1. Generate the presentation materials
2. Check:
   - Can the key message be stated in one sentence?
   - Is slide count × average time ≤ 80% of the allotted time?
   - Does it follow the one-slide-one-idea principle?
   - Are figures high-contrast and colorblind-friendly?
3. If it fails, revise the structure
4. Finalize the speaker notes only after passing
