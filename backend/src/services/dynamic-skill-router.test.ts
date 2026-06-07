import { describe, it, expect } from 'vitest';
import { classifyDomains, selectRelevantSkills } from './dynamic-skill-router.js';

describe('dynamic-skill-router', () => {
  describe('classifyDomains', () => {
    it('classifies a genomics prompt', () => {
      expect(classifyDomains('Run a GWAS on this genome variant dataset')).toContain('genomics');
    });

    it('classifies a protein prompt', () => {
      expect(classifyDomains('Predict the protein folding structure with AlphaFold')).toContain('protein');
    });

    it('matches Japanese keywords', () => {
      expect(classifyDomains('ゲノムの遺伝子発現を解析する')).toContain('genomics');
      expect(classifyDomains('タンパク質の構造を予測')).toContain('protein');
    });

    it('is multi-domain — returns every matched domain, strongest first', () => {
      // mentions protein (structure/folding) AND molecular (drug/docking/ligand)
      const domains = classifyDomains('dock this drug ligand against the protein binding site to design an inhibitor');
      expect(domains).toContain('protein');
      expect(domains).toContain('molecular');
    });

    it('falls back to general-science when nothing matches', () => {
      expect(classifyDomains('Summarize quarterly sales trends')).toEqual(['general-science']);
    });
  });

  describe('selectRelevantSkills', () => {
    it('always includes the mandatory skills', () => {
      const { skills } = selectRelevantSkills('anything at all');
      for (const s of ['co-scientist-academic-writing', 'co-scientist-citation-checker', 'co-scientist-statistical-testing']) {
        expect(skills.has(s)).toBe(true);
      }
    });

    it('includes domain-specific skills for the matched domain', () => {
      const { domains, skills } = selectRelevantSkills('single-cell RNA-seq transcriptomics analysis');
      expect(domains).toContain('genomics');
      expect(skills.has('co-scientist-gene-expression-transcriptomics')).toBe(true);
    });

    it('unions skills from multiple matched domains', () => {
      const { skills } = selectRelevantSkills('design a drug ligand that binds the protein kinase');
      expect(skills.has('co-scientist-molecular-docking')).toBe(true);   // molecular
      expect(skills.has('co-scientist-protein-design')).toBe(true);       // protein
    });

    it('selects far fewer than the full 202-skill catalogue', () => {
      const { skills } = selectRelevantSkills('genome variant analysis');
      // mandatory (10) + genomics (10) + general-science baseline (7), deduped
      expect(skills.size).toBeGreaterThan(10);
      expect(skills.size).toBeLessThan(40);
    });
  });
});
