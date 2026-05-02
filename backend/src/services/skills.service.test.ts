import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, InvalidGitHubUrlError } from './skills.service.js';

describe('SkillsService', () => {
  describe('parseGitHubUrl', () => {
    it('should parse basic GitHub URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', subpath: undefined });
    });

    it('should strip .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', subpath: undefined });
    });

    it('should parse URL with tree subpath', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main/src/skills');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', subpath: 'main/src/skills' });
    });

    it('should reject non-github.com hosts', () => {
      expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(InvalidGitHubUrlError);
    });

    it('should reject non-https URLs', () => {
      expect(() => parseGitHubUrl('http://github.com/owner/repo')).toThrow(InvalidGitHubUrlError);
    });

    it('should reject URLs without owner/repo', () => {
      expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(InvalidGitHubUrlError);
    });

    it('should reject invalid URLs', () => {
      expect(() => parseGitHubUrl('not-a-url')).toThrow(InvalidGitHubUrlError);
    });
  });
});
