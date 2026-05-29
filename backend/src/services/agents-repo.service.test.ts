import { describe, it, expect, afterEach } from 'vitest';
import { isAllowedTokenHost } from './agents-repo.service.js';

describe('isAllowedTokenHost', () => {
  afterEach(() => {
    delete process.env.AIRA_GITHUB_HOSTS;
  });

  it('accepts github.com', () => {
    expect(isAllowedTokenHost('github.com')).toBe(true);
  });

  it('accepts subdomains of github.com', () => {
    expect(isAllowedTokenHost('api.github.com')).toBe(true);
    expect(isAllowedTokenHost('raw.github.com')).toBe(true);
  });

  it('rejects attacker hostnames that merely contain "github.com"', () => {
    expect(isAllowedTokenHost('evil.com')).toBe(false);
    expect(isAllowedTokenHost('github.com.evil.com')).toBe(false);
    expect(isAllowedTokenHost('notgithub.com')).toBe(false);
  });

  it('rejects unrelated git hosts by default', () => {
    expect(isAllowedTokenHost('gitlab.com')).toBe(false);
    expect(isAllowedTokenHost('bitbucket.org')).toBe(false);
  });

  it('honours AIRA_GITHUB_HOSTS for GHE', () => {
    process.env.AIRA_GITHUB_HOSTS = 'github.mycorp.com';
    expect(isAllowedTokenHost('github.mycorp.com')).toBe(true);
    expect(isAllowedTokenHost('api.github.mycorp.com')).toBe(true);
    expect(isAllowedTokenHost('github.com')).toBe(true); // still default
  });

  it('is case-insensitive for hostnames', () => {
    expect(isAllowedTokenHost('GitHub.com')).toBe(true);
    expect(isAllowedTokenHost('API.GITHUB.COM')).toBe(true);
  });

  it('handles whitespace in AIRA_GITHUB_HOSTS', () => {
    process.env.AIRA_GITHUB_HOSTS = '  github.mycorp.com  ,  gitea.local  ';
    expect(isAllowedTokenHost('github.mycorp.com')).toBe(true);
    expect(isAllowedTokenHost('gitea.local')).toBe(true);
  });
});
