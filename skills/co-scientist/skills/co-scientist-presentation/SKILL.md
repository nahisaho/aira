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

- 学会発表では「全部の結果を見せたい」衝動を抑えること。ストーリーに必要な結果だけを選択する
- ポスターは 1.5m 離れた距離から読めるフォントサイズ（タイトル: 72pt以上、本文: 24pt以上）を指定すること
- 日本語発表でも図表は英語で作成すること。国際学会で再利用できる
- 発表時間は持ち時間の 80% を目標にすること。質疑と技術トラブルのバッファが必要

## Validation Loop

1. プレゼン資料を生成
2. チェック:
   - キーメッセージが 1 文で述べられるか
   - スライド枚数 × 平均時間 ≤ 持ち時間の 80% か
   - 1 スライド 1 アイデアの原則を守っているか
   - 図が高コントラスト・colorblind-friendly か
3. 不合格なら構成を見直し
4. 合格後にスピーカーノートを確定
