/**
 * Adversarial paper review + revision pass — v3.12.0.
 *
 * The "critical-review" sub-skill is rarely invoked in-band (the model prefers to
 * work directly). So AIRA drives the review itself: it injects a focused reviewer
 * prompt through the normal chat path (one CLI turn). A single, narrow instruction
 * like this runs reliably — unlike depending on the model to invoke a skill.
 *
 * The reviewer attacks scientific VALUE, not form (the validator already enforces
 * provenance/word-counts/refs): data realism, genuine contribution, claim support
 * vs over-claiming, baseline quality, statistical validity, literature integration.
 * It then revises `paper.md` ONCE to fix the issues — chiefly removing over-claims
 * and foregrounding synthetic-data limits — while keeping `[cell:]` provenance.
 */
export function buildReviewerPrompt(): string {
  return [
    '🦆 **Critical Peer Review + Revision（敵対的査読・改稿）**',
    '',
    'いまワークスペースにある `paper.md` と `report.md`、ノートブックのセル出力を読み、',
    '**辛口の査読者**として科学的価値を批判し、その場で `paper.md` を1回改稿してください。',
    '形式（引用・語数・参考文献）は検証器が見るので、ここでは**中身の価値**だけを攻めること。',
    '',
    '## 査読の観点（各項目を paper の言語で批判）',
    '1. **データの実在性**: 実データか、合成/トイデータか。合成なら、それを Limitations で前面化し、結論を相応に抑えているか。合成データの統計的有意性を実世界の所見のように語っていないか。',
    '2. **新規性・貢献**: 真の貢献があるか、それとも標準的パイプラインの報告に留まるか。「何が新しいのか」を1文で言えるか。',
    '3. **主張の支持**: Discussion / Conclusion の各主張は Results に**実際に支持**されているか。データを超えた飛躍・過大主張はどれか。',
    '4. **ベースライン**: 比較対象は実質的か、形だけか。提案手法の優位は ablation / baseline で示されているか。',
    '5. **統計の妥当性**: 効果量・CI・多重比較補正・前提検定。有意性の主張はデータ規模に照らして意味があるか。',
    '6. **文献の統合**: 参考文献は論証に統合されているか、並べただけか。',
    '',
    '## 手順',
    '1. `review.md` に構造化した査読所見を書く（各観点ごとに **重大度 [High/Med/Low]** と具体的な指摘・根拠の cell/箇所）。',
    '2. その所見に基づき **`paper.md` を1回だけ改稿**する。最優先は: 過大主張の削除、合成データ限界の前面化、結論を支持される範囲へ縮小、ベースライン/新規性の明確化。',
    '3. 改稿で数値を動かしたら `[cell:]` 引用を保つこと。**虚偽の補強（やっていない分析を「やった」と書く）は禁止** — 不足は Limitations に正直に書く。',
    '4. 改稿後に `POST /api/projects/:id/validate` を呼び、provenance が維持されていることを確認（壊れていれば single-batch で修復）。',
    '',
    '改稿は1回でよい。最後に、最も重大だった指摘トップ3と、それぞれをどう反映したかを簡潔に報告してください。',
  ].join('\n');
}
