/**
 * Dynamic Skill Router — v3.7.0
 *
 * Selects a subset of Co-Scientist sub-skills relevant to the user's prompt,
 * instead of loading all 202 sub-skills into the workspace.
 *
 * Motivation (from Round 11–30 benchmark analysis):
 *   - 202 sub-skills consume ~40% of the LLM context window
 *   - Golden Rules ([cell:] citation instructions) get buried under skill context
 *   - R26 (no skills): 96.5 citations/paper, 3.17% density
 *   - R29 (all skills): 69.2 citations/paper, 1.76% density  (-44%)
 *   - Dynamic selection (est. 15 skills): maintains research depth + citation density
 */

/** Domain → relevant sub-skill prefixes mapping. */
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

/**
 * Classify a prompt into a domain. Uses keyword matching.
 */
export function classifyDomain(prompt: string): string {
  const lower = prompt.toLowerCase();

  const domainKeywords: Record<string, string[]> = {
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

  let bestDomain = 'general-science';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

/**
 * Select sub-skills relevant to the prompt. Returns a Set of sub-skill
 * directory names that should be synced.
 *
 * @param prompt  The user's input prompt.
 * @returns Set of sub-skill names to include (e.g. 'co-scientist-bioinformatics').
 */
export function selectRelevantSkills(prompt: string): Set<string> {
  const domain = classifyDomain(prompt);
  const domainSpecific = DOMAIN_SKILLS[domain] ?? DOMAIN_SKILLS['general-science']!;

  const selected = new Set<string>([
    ...MANDATORY_SKILLS,
    ...domainSpecific,
  ]);

  return selected;
}

/**
 * Check if a sub-skill directory name should be included for the given prompt.
 */
export function shouldIncludeSkill(skillDirName: string, prompt: string): boolean {
  const selected = selectRelevantSkills(prompt);
  return selected.has(skillDirName);
}
