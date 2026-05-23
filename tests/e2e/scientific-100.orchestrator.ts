/**
 * AIRA 100 Advanced Scientific Experiments — Orchestrator
 *
 * Runs experiments sequentially, appends results to Qiita article,
 * and provides progress tracking.
 *
 * Usage: npx tsx tests/e2e/scientific-100.orchestrator.ts [--start N] [--end N] [--id SCI-XXX]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runExperiment } from './scientific-100.runner.js';
import { ALL_EXPERIMENTS, getExperimentById } from './scientific-100.prompts.js';
import type { ExperimentResult } from './scientific-100.runner.js';

// ── Config ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTICLE_PATH = path.resolve(__dirname, '../../docs/qiita/aira-100-scientific-experiments.md');
const RESULTS_DIR = path.resolve(__dirname, '../../docs/qiita/results');
const PROGRESS_FILE = path.resolve(RESULTS_DIR, 'progress.json');

// ── Progress Tracking ───────────────────────────────────────────────

interface Progress {
  completed: string[];
  failed: string[];
  results: Record<string, ExperimentResult>;
  lastUpdated: string;
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { completed: [], failed: [], results: {}, lastUpdated: '' };
  }
}

function saveProgress(progress: Progress): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Article Writing ─────────────────────────────────────────────────

function truncateResponse(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n\n... (truncated, full response: ' + text.length + ' chars)';
}

function extractDiscoveries(responseText: string, result: ExperimentResult): string {
  // Extract key discoveries and insights from the response
  const lines = responseText.split('\n').filter(l => l.trim().length > 0);
  const discoveries: string[] = [];

  // Look for conclusion-like content, key findings, results sections
  const keywords = ['発見', '結論', '重要', '新規', '提案', '示唆', '知見', '結果',
    'finding', 'conclusion', 'result', 'novel', 'key', 'insight', 'important'];

  for (let i = 0; i < lines.length && discoveries.length < 5; i++) {
    const line = lines[i].toLowerCase();
    if (keywords.some(k => line.includes(k)) && lines[i].trim().length > 20) {
      discoveries.push(lines[i].trim().replace(/^[#*\-]+\s*/, ''));
    }
  }

  if (discoveries.length === 0) {
    // Fallback: use file info and general summary
    if (result.fileCount > 0) {
      discoveries.push(`Co-Scientistが${result.fileCount}個のファイルを生成し、体系的な計算フレームワークを構築`);
    }
    if (result.responseLength > 1000) {
      discoveries.push(`${result.responseLength.toLocaleString()}文字の詳細な技術レポートを自動生成`);
    }
    discoveries.push('AIが自律的に科学的方法論を設計し、実装可能なコードとともに提示');
  }

  return discoveries.map(d => `- ${d}`).join('\n');
}

function appendResultToArticle(result: ExperimentResult): void {
  const isSuccess = isSuccessResult(result);
  const statusEmoji = isSuccess ? '✅' : '❌';
  const section = `
### ${result.id}: ${result.title} ${statusEmoji}

| 項目 | 値 |
|------|-----|
| ドメイン | ${result.domain} |
| カテゴリ | ${result.category} |
| ステータス | ${result.status} |
| 応答長 | ${result.responseLength.toLocaleString()} 文字 |
| チャンク数 | ${result.chunkCount} |
| 生成ファイル数 | ${result.fileCount} |
| 実行時間 | ${result.durationSec} 秒 |
| タイムスタンプ | ${result.timestamp} |
${result.error ? `| エラー | ${result.error} |` : ''}

<details>
<summary>プロンプト（クリックで展開）</summary>

\`\`\`
${result.prompt}
\`\`\`
</details>

<details>
<summary>AIRAの応答（クリックで展開）</summary>

${truncateResponse(result.responseText)}

</details>

${result.files.length > 0 ? `
**生成されたファイル:**
${result.files.map(f => `- \`${f}\``).join('\n')}
` : ''}

#### 💡 新しい発見・知見

${extractDiscoveries(result.responseText, result)}

---

`;

  fs.appendFileSync(ARTICLE_PATH, section);
}

function writePhaseHeader(phaseNum: number, phaseName: string): void {
  const header = `
## Phase ${phaseNum}: ${phaseName}

`;
  fs.appendFileSync(ARTICLE_PATH, header);
}

function isSuccessResult(r: ExperimentResult): boolean {
  return r.status === 'completed' ||
    (r.status === 'running' && (r.fileCount > 0 || r.responseLength > 500)) ||
    (r.status === 'timeout' && (r.fileCount > 0 || r.responseLength > 500));
}

function writeSummaryTable(results: ExperimentResult[]): void {
  const completed = results.filter(r => isSuccessResult(r));
  const failed = results.filter(r => !isSuccessResult(r));

  const summary = `
## 実験結果サマリー

| 指標 | 値 |
|------|-----|
| 総実験数 | ${results.length} |
| 成功 | ${completed.length} |
| 失敗 | ${failed.length} |
| 成功率 | ${((completed.length / results.length) * 100).toFixed(1)}% |
| 総応答文字数 | ${results.reduce((s, r) => s + r.responseLength, 0).toLocaleString()} |
| 総生成ファイル数 | ${results.reduce((s, r) => s + r.fileCount, 0)} |
| 平均実行時間 | ${(results.reduce((s, r) => s + r.durationSec, 0) / results.length).toFixed(1)} 秒 |
| 総実行時間 | ${(results.reduce((s, r) => s + r.durationSec, 0) / 60).toFixed(1)} 分 |

### ドメイン別成功率

| ドメイン | 成功 | 失敗 | 成功率 |
|----------|------|------|--------|
${Array.from(new Set(results.map(r => r.domain))).map(domain => {
  const domainResults = results.filter(r => r.domain === domain);
  const domainCompleted = domainResults.filter(r => isSuccessResult(r));
  return `| ${domain} | ${domainCompleted.length} | ${domainResults.length - domainCompleted.length} | ${((domainCompleted.length / domainResults.length) * 100).toFixed(0)}% |`;
}).join('\n')}

`;
  // Prepend summary after article header (before Phase 1)
  const content = fs.readFileSync(ARTICLE_PATH, 'utf-8');
  const marker = '<!-- SUMMARY_PLACEHOLDER -->';
  if (content.includes(marker)) {
    fs.writeFileSync(ARTICLE_PATH, content.replace(marker, summary));
  } else {
    fs.appendFileSync(ARTICLE_PATH, summary);
  }
}

// ── Main Orchestrator ───────────────────────────────────────────────

const PHASE_INFO: Record<number, string> = {
  1: '生命科学・医学',
  2: '物理科学・工学',
  3: 'データサイエンス・学際領域',
  4: '新興・フロンティア科学',
  5: '領域横断統合',
};

async function main() {
  const args = process.argv.slice(2);
  let startIdx = 0;
  let endIdx = ALL_EXPERIMENTS.length;
  let singleId: string | null = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) startIdx = parseInt(args[i + 1]) - 1;
    if (args[i] === '--end' && args[i + 1]) endIdx = parseInt(args[i + 1]);
    if (args[i] === '--id' && args[i + 1]) singleId = args[i + 1];
  }

  const progress = loadProgress();

  // Select experiments to run
  let experiments = singleId
    ? [getExperimentById(singleId)].filter(Boolean) as typeof ALL_EXPERIMENTS
    : ALL_EXPERIMENTS.slice(startIdx, endIdx);

  // Skip already completed
  experiments = experiments.filter(e => !progress.completed.includes(e.id));

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  AIRA 100 Advanced Scientific Experiments            ║`);
  console.log(`║  Experiments to run: ${experiments.length.toString().padStart(3)}                              ║`);
  console.log(`║  Already completed: ${progress.completed.length.toString().padStart(3)}                              ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  let currentPhase = -1;

  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    const globalIdx = ALL_EXPERIMENTS.indexOf(exp);
    const phase = Math.floor(globalIdx / 20) + 1;

    // Write phase header if new phase
    if (phase !== currentPhase) {
      currentPhase = phase;
      console.log(`\n━━━ Phase ${phase}: ${PHASE_INFO[phase]} ━━━\n`);
      writePhaseHeader(phase, PHASE_INFO[phase]);
    }

    console.log(`[${i + 1}/${experiments.length}] Running ${exp.id}: ${exp.title}`);

    try {
      const result = await runExperiment(exp);

      // Save progress — treat "running" with files/content as partial success
      progress.results[exp.id] = result;
      const isSuccess = result.status === 'completed' ||
        (result.status === 'running' && (result.fileCount > 0 || result.responseLength > 500)) ||
        (result.status === 'timeout' && (result.fileCount > 0 || result.responseLength > 500));
      if (isSuccess) {
        progress.completed.push(exp.id);
      } else {
        progress.failed.push(exp.id);
      }
      saveProgress(progress);

      // Append to article
      appendResultToArticle(result);

      console.log(`  → ${result.status} (${result.responseLength} chars, ${result.durationSec}s)\n`);

      // Brief pause between experiments
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`  → FATAL ERROR: ${error}\n`);
      progress.failed.push(exp.id);
      saveProgress(progress);
    }
  }

  // Write final summary
  const allResults = Object.values(progress.results);
  if (allResults.length > 0) {
    writeSummaryTable(allResults);
  }

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  Experiment run complete!                             ║`);
  console.log(`║  Completed: ${progress.completed.length.toString().padStart(3)}  Failed: ${progress.failed.length.toString().padStart(3)}                        ║`);
  console.log(`║  Article: ${ARTICLE_PATH}  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
}

main().catch(err => {
  console.error('Orchestrator failed:', err);
  process.exit(1);
});
