import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import {
  setBaseDir,
  getBaseDir,
  getDataDir,
  getProjectsDir,
  getWorkspaceDir,
  getNotebookPath,
  getTmpDir,
} from './paths.js';

const original = getBaseDir();

describe('paths config', () => {
  afterEach(() => {
    setBaseDir(original);
  });

  it('getNotebookPath returns workspace/notebook.ipynb under project', () => {
    setBaseDir('/tmp/aira-test');
    const nbPath = getNotebookPath('abc-123');
    expect(nbPath).toBe(path.join('/tmp/aira-test', 'projects', 'abc-123', 'workspace', 'notebook.ipynb'));
  });

  it('getNotebookPath is consistent with getWorkspaceDir', () => {
    setBaseDir('/tmp/aira-test');
    const nbPath = getNotebookPath('xyz');
    const wsDir = getWorkspaceDir('xyz');
    expect(path.dirname(nbPath)).toBe(wsDir);
    expect(path.basename(nbPath)).toBe('notebook.ipynb');
  });

  it('other path helpers remain stable', () => {
    setBaseDir('/srv/aira');
    // Use path.join on the expected side too so the assertion is platform-
    // agnostic (Windows uses backslash separators).
    expect(getDataDir()).toBe(path.join('/srv/aira', 'data'));
    expect(getProjectsDir()).toBe(path.join('/srv/aira', 'projects'));
    expect(getTmpDir()).toBe(path.join('/srv/aira', 'data', '.tmp'));
  });
});
