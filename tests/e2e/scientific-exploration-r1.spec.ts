/**
 * Scientific Exploration E2E Evaluation
 *
 * Based on SATORI E2E pipeline testing methodology (P-01~P-50).
 * Each prompt exercises a genuine scientific research workflow:
 *   - Hypothesis formulation & experimental design
 *   - Data generation, statistical analysis, visualization
 *   - Multi-step scientific pipelines
 *   - Research documentation (IMRaD, reports)
 *
 * Round 1: 5 scientific prompts adapted from SATORI patterns
 * Evaluation: status, response quality, file creation, pipeline integrity
 */

import { test, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';

const API = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

test.setTimeout(360_000);

// ── Helpers ─────────────────────────────────────────────────────────

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/csrf-token`);
  return (await res.json()).token;
}

async function createProject(page: Page, name: string): Promise<string> {
  const token = await csrf(page);
  const res = await page.request.post(`${API}/projects`, {
    headers: { 'X-AIRA-Token': token },
    data: { name },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

async function deleteProject(page: Page, id: string): Promise<void> {
  const token = await csrf(page);
  await page.request.delete(`${API}/projects/${id}`, {
    headers: { 'X-AIRA-Token': token },
  });
}

async function assignCoScientist(page: Page, projectId: string): Promise<void> {
  const skillsRes = await page.request.get(`${API}/skills`);
  const skills = await skillsRes.json();
  const cs = skills.find((s: { name: string }) => s.name === 'co-scientist');
  if (!cs) return;
  const token = await csrf(page);
  await page.request.post(`${API}/projects/${projectId}/skills/${cs.id}`, {
    headers: { 'X-AIRA-Token': token },
  });
}

interface WSResult {
  chunks: string[];
  fullText: string;
  status: string | null;
  runId: string | null;
  error: string | null;
  progressMessages: string[];
  durationMs: number;
}

function sendChat(projectId: string, content: string, timeoutMs = 300_000): Promise<WSResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}/chat`, {
      headers: { Origin: 'http://localhost:3000' },
    });

    const result: WSResult = {
      chunks: [], fullText: '', status: null, runId: null,
      error: null, progressMessages: [], durationMs: 0,
    };

    const timer = setTimeout(() => {
      result.durationMs = Date.now() - start;
      ws.close();
      reject(new Error(
        `Timeout ${timeoutMs}ms. chunks=${result.chunks.length} ` +
        `text="${result.fullText.slice(0, 300)}"`,
      ));
    }, timeoutMs);

    ws.on('open', () => {
      console.log(`  [WS] connected to ${WS_BASE}/ws/projects/${projectId}/chat`);
      ws.send(JSON.stringify({ type: 'chat', content }));
      console.log(`  [WS] sent chat message (${content.length} chars)`);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'chunk' && msg.content) {
          result.chunks.push(msg.content);
          result.fullText += msg.content;
        }
        if (msg.type === 'progress' && msg.message)
          result.progressMessages.push(msg.message);
        if (msg.type === 'status') {
          result.status = msg.status;
          result.runId = msg.runId ?? null;
          if (['completed', 'error', 'cancelled', 'timeout', 'failed'].includes(msg.status)) {
            result.durationMs = Date.now() - start;
            clearTimeout(timer);
            ws.close();
            resolve(result);
          }
        }
        if (msg.type === 'error')
          result.error = msg.message ?? msg.content ?? 'unknown error';
      } catch { /* ignore parse errors */ }
    });

    ws.on('error', (err) => {
      console.log(`  [WS] error: ${err.message}`);
      result.durationMs = Date.now() - start;
      clearTimeout(timer);
      reject(new Error(`WS error: ${err.message}`));
    });

    ws.on('close', (code, reason) => {
      console.log(`  [WS] closed: code=${code} reason=${reason?.toString()}`);
      result.durationMs = Date.now() - start;
      clearTimeout(timer);
      if (!result.status) { result.status = 'disconnected'; resolve(result); }
    });
  });
}

// ── Scientific Prompts — Round 1 ────────────────────────────────────
// Modeled after SATORI P-01~P-50 patterns.
// Each prompt defines a genuine scientific research workflow but uses
// only Python standard library + numpy/scipy/matplotlib (pre-installed),
// so Copilot CLI can execute them reliably within timeout.

const ROUND1 = [
  {
    id: 'SCI-01',
    title: '仮説駆動型統計検定パイプライン',
    prompt:
      '「腸内細菌叢の多様性低下が2型糖尿病の発症リスクを高める」という仮説を検証するPythonスクリプトを作成してください。\n' +
      '具体的には：\n' +
      '1. PICOフレームワーク（Patient/Intervention/Comparison/Outcome）で仮説を構造化し pico_hypothesis.json に保存\n' +
      '2. numpy で模擬OTUデータ（糖尿病群50名・健常群50名）を生成し data.csv に保存\n' +
      '3. Shannon多様性指数を算出\n' +
      '4. scipy.stats で Mann-Whitney U検定を実施し statistical_results.json に保存\n' +
      '5. 結果をIMRaD形式（Introduction/Methods/Results/Discussion）で research_report.md に論文化',
    minLen: 100,
  },
  {
    id: 'SCI-02',
    title: 'モンテカルロ法による数値積分の収束解析',
    prompt:
      'モンテカルロ法の収束性を科学的に検証するPythonプログラムを作成してください。\n' +
      '1. 研究目的：サンプルサイズNに対する推定誤差の収束速度を実証的に検証\n' +
      '2. 実験設計：円周率πの推定をN=100,1000,10000,100000で各30回反復\n' +
      '3. 統計解析：各Nでの推定値の平均・標準偏差・95%信頼区間を計算\n' +
      '4. 理論検証：実測標準偏差がO(1/√N)に従うことを対数回帰で確認\n' +
      '5. 出力ファイル：\n' +
      '   - monte_carlo_experiment.py（実験スクリプト）\n' +
      '   - experiment_results.json（全統計量）\n' +
      '   - convergence_report.md（結果の考察、中心極限定理との関連を議論）',
    minLen: 100,
  },
  {
    id: 'SCI-03',
    title: 'バリアント分類と薬理ゲノミクス解析',
    prompt:
      '遺伝子バリアント解釈の模擬パイプラインをPythonで作成してください。\n' +
      '1. 模擬バリアントリスト20件を生成（SNV/InDel混合、chr/pos/ref/alt/gene/consequence）\n' +
      '   → variant_list.json に保存\n' +
      '2. ACMG/AMP基準に基づく5段階分類ロジックを実装\n' +
      '   （集団頻度、機能予測、臨床報告の各エビデンス項目をスコアリング）\n' +
      '3. 各バリアントにClinVar/gnomADの模擬アノテーションを付与\n' +
      '4. アクショナブル変異を同定し、CYP代謝型別の投与量推奨を生成\n' +
      '5. 出力：variant_classification.csv、clinical_report.md',
    minLen: 100,
  },
  {
    id: 'SCI-04',
    title: '気候データ時系列解析と予測',
    prompt:
      '気温偏差データの時系列解析パイプラインをPythonで構築してください。\n' +
      '1. 模擬月次気温偏差データ600ヶ月分（50年間）を numpy で生成\n' +
      '   トレンド+季節成分+ノイズの合成信号として temperature_data.csv に保存\n' +
      '2. 線形回帰によるトレンド推定と移動平均による平滑化\n' +
      '3. 自己相関関数(ACF)の計算\n' +
      '4. 将来10年の線形外挿予測と信頼区間の推定\n' +
      '5. 出力：analysis_results.json（全統計量）、climate_report.md\n' +
      '   （IPCCシナリオとの定性的比較考察を含めること）',
    minLen: 100,
  },
  {
    id: 'SCI-05',
    title: '実験計画法による最適化探索',
    prompt:
      '実験計画法(DOE)を用いた化学反応最適化の模擬実験をPythonで設計・実行してください。\n' +
      '1. 3因子2水準の完全実施要因計画（2³=8条件）を設計\n' +
      '   因子：温度(60/80℃), 触媒量(1/5mol%), 反応時間(1/4h)\n' +
      '   応答変数：模擬収率(%) — 既知の応答曲面モデルからノイズ付きで生成\n' +
      '2. 主効果と交互作用効果の分散分析(ANOVA)を実施\n' +
      '3. 応答曲面モデルを線形回帰で構築し、最適条件を推定\n' +
      '4. 出力ファイル：\n' +
      '   - experimental_design.csv（実験条件と結果）\n' +
      '   - anova_results.json（分散分析結果）\n' +
      '   - optimization_report.md（最適条件の考察、工業応用への示唆）',
    minLen: 100,
  },
];

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Scientific Exploration — Round 1', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    projectId = await createProject(page, `sci-explore-r1-${Date.now()}`);
    console.log(`[beforeAll] projectId=${projectId}`);
    await assignCoScientist(page, projectId);
    console.log(`[beforeAll] co-scientist assigned`);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!projectId) return;
    const page = await browser.newPage();
    const token = await csrf(page);
    await page.request.post(`${API}/projects/${projectId}/runs/current/stop`, {
      headers: { 'X-AIRA-Token': token },
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await deleteProject(page, projectId).catch(() => {});
    await page.close();
  });

  for (const sp of ROUND1) {
    test(`${sp.id}: ${sp.title}`, async ({ page }) => {
      console.log(`\n  [DEBUG] ${sp.id} starting. projectId=${projectId}`);

      // Allow previous run to settle
      await new Promise(r => setTimeout(r, 3000));

      const result = await sendChat(projectId, sp.prompt);

      // ── Core Assertions ──

      // 1. Pipeline completed successfully
      expect(result.status, `${sp.id} pipeline should complete. Got: ${result.status}`)
        .toBe('completed');

      // 2. Response substance
      expect(result.chunks.length, `${sp.id} should produce response chunks`)
        .toBeGreaterThan(0);
      expect(result.fullText.length, `${sp.id} response too short (${result.fullText.length} chars)`)
        .toBeGreaterThanOrEqual(sp.minLen);

      // 3. No errors
      expect(result.error, `${sp.id} unexpected error: ${result.error}`)
        .toBeNull();

      // 4. Run recorded in DB
      const runsRes = await page.request.get(`${API}/projects/${projectId}/runs?limit=5`);
      const runs = await runsRes.json();
      expect(runs.length, `${sp.id} should have runs in DB`).toBeGreaterThan(0);
      const latestRun = runs[0];
      expect(latestRun.status).toBe('completed');

      // 5. Files created
      const filesRes = await page.request.get(`${API}/projects/${projectId}/files`);
      const files = await filesRes.json();
      const fileList = files.map((f: { file_path: string }) => f.file_path);

      console.log(
        `\n  ${sp.id} [${sp.title}]:\n` +
        `    Status: ${result.status}\n` +
        `    Chunks: ${result.chunks.length}, Length: ${result.fullText.length} chars\n` +
        `    Duration: ${(result.durationMs / 1000).toFixed(1)}s\n` +
        `    Files (${files.length}): ${fileList.join(', ')}\n` +
        `    Response preview: ${result.fullText.slice(0, 200).replace(/\n/g, ' ')}…`,
      );
    });
  }
});
