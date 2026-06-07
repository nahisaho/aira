/**
 * Dynamic Skill Router — v3.6.1
 *
 * Selects a subset of a large sub-skill catalogue (the Co-Scientist suite has
 * 202 sub-skills) relevant to the user's prompt, instead of syncing all of them
 * into the workspace on every run.
 *
 * Motivation (Round 11–30 benchmark analysis, surfaced via the v3.6.0 skill
 * routing log):
 *   - 202 sub-skills consume a large slice of the CLI context window
 *   - the [cell:] citation "golden rules" get buried under skill context
 *   - R26 (no skills):  96.5 citations/paper, 3.17% density
 *   - R29 (all skills): 69.2 citations/paper, 1.76% density  (-44%)
 *   - dynamic selection aims to keep research depth AND citation density.
 *
 * This is the corrected successor to the dead-code prototype in PR #2:
 *   - the prompt is actually threaded through to syncSkillFiles (see exec-context)
 *   - filtering is scoped to LARGE skill sets only, so small skills (e.g.
 *     spread1000-assistant, 13 sub-skills) are never silently disabled
 *   - classification is multi-domain (a genomics+protein prompt gets both)
 *   - the selected set is intersected with skills that actually exist on disk,
 *     with a sync-all fallback if a curated name drifts and the match is empty.
 *
 * The curated lists are a pragmatic, verified mapping. A future iteration could
 * derive relevance from each SKILL.md description instead of hard-coded names.
 */

/** Domain → relevant Co-Scientist sub-skill directory names. */
const DOMAIN_SKILLS: Record<string, string[]> = {
  genomics: [
    'co-scientist-bioinformatics',
    'co-scientist-gene-expression-transcriptomics',
    'co-scientist-cancer-genomics',
    'co-scientist-single-cell-genomics',
    'co-scientist-population-genetics',
    'co-scientist-gwas-catalog',
    'co-scientist-ensembl-genomics',
    'co-scientist-variant-effect-prediction',
    'co-scientist-epigenomics-chromatin',
    'co-scientist-sequence-analysis',
  ],
  molecular: [
    'co-scientist-cheminformatics',
    'co-scientist-molecular-docking',
    'co-scientist-deep-chemistry',
    'co-scientist-compound-screening',
    'co-scientist-drug-repurposing',
    'co-scientist-admet-pharmacokinetics',
    'co-scientist-protein-structure-analysis',
    'co-scientist-protein-design',
  ],
  protein: [
    'co-scientist-protein-structure-analysis',
    'co-scientist-protein-design',
    'co-scientist-protein-domain-family',
    'co-scientist-protein-interaction-network',
    'co-scientist-alphafold-structures',
    'co-scientist-proteomics-mass-spectrometry',
    'co-scientist-structural-proteomics',
  ],
  materials: [
    'co-scientist-computational-materials',
    'co-scientist-materials-characterization',
    'co-scientist-process-optimization',
    'co-scientist-spectral-signal',
  ],
  'general-science': [
    'co-scientist-bayesian-statistics',
    'co-scientist-causal-inference',
    'co-scientist-time-series',
    'co-scientist-network-analysis',
    'co-scientist-meta-analysis',
    'co-scientist-geospatial-analysis',
    'co-scientist-environmental-ecology',
  ],
};

/** Always included regardless of domain — critical for paper quality. */
const MANDATORY_SKILLS = [
  'co-scientist-prompt-generator',
  'co-scientist-academic-writing',
  'co-scientist-citation-checker',
  'co-scientist-data-analysis',
  'co-scientist-deep-learning',
  'co-scientist-ml-classification',
  'co-scientist-statistical-testing',
  'co-scientist-publication-figures',
  'co-scientist-reproducibility',
  'co-scientist-literature-review',
  'co-scientist-data-preprocessing',
];

/** Keyword → domain mapping. English + Japanese, lower-cased match. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  genomics: ['genome', 'genomic', 'gwas', 'snp', 'variant', 'allele', 'transcriptom',
             'rna-seq', 'scrna', 'single-cell', 'epigenom', 'methylat', 'chromatin',
             'gene expression', 'ゲノム', '遺伝子', '転写', 'シーケンス'],
  molecular: ['molecule', 'molecular', 'drug', 'compound', 'docking', 'smiles', 'logp',
              'pharmacophore', 'ligand', 'binding', 'inhibitor', '分子', '薬物', '阻害剤',
              'chembl', 'rdkit'],
  protein: ['protein', 'amino acid', 'folding', 'structure', 'pdb', 'alphafold',
            'antibody', 'peptide', 'kinase', 'enzyme', 'タンパク質', '酵素'],
  materials: ['material', 'alloy', 'crystal', 'polymer', 'ceramic', 'battery',
              'catalyst', 'surface', 'thin film', '材料', '合金', '触媒'],
};

/**
 * Classify a prompt into ZERO OR MORE domains (multi-domain aware). Every domain
 * with at least one keyword hit is returned, ordered by descending hit count so
 * the strongest domain is first. When nothing matches, falls back to
 * `['general-science']` so the caller always gets a usable selection.
 */
export function classifyDomains(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const scored: Array<{ domain: string; score: number }> = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > 0) scored.push({ domain, score });
  }

  if (scored.length === 0) return ['general-science'];
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.domain);
}

export interface SkillSelection {
  /** Domains the prompt classified into (strongest first). */
  domains: string[];
  /** Sub-skill directory names that should be synced. */
  skills: Set<string>;
}

/**
 * Select sub-skills relevant to the prompt: the mandatory set plus the sub-skills
 * of every matched domain. Returns both the chosen domains (for the routing log)
 * and the skill-name set used for filtering.
 */
export function selectRelevantSkills(prompt: string): SkillSelection {
  const domains = classifyDomains(prompt);
  const skills = new Set<string>(MANDATORY_SKILLS);
  for (const domain of domains) {
    for (const s of DOMAIN_SKILLS[domain] ?? []) skills.add(s);
  }
  // 'general-science' is a useful baseline even when a specific domain matched —
  // its stats/causal-inference skills apply broadly.
  for (const s of DOMAIN_SKILLS['general-science']!) skills.add(s);
  return { domains, skills };
}
