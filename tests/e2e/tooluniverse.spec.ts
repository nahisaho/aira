import { test, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';

/**
 * E2E Tests for ToolUniverse MCP integration via Co-Scientist skill.
 *
 * Tests advanced multi-step scientific workflows that require:
 *   - ToolUniverse MCP server (2200+ scientific database tools)
 *   - Co-Scientist skill routing to specialized sub-skills
 *   - Complex multi-tool orchestration (literature → analysis → report)
 *
 * Each test sends a scientifically meaningful prompt that triggers
 * ToolUniverse tool calls (PubMed, ChEMBL, UniProt, Ensembl, etc.)
 * and verifies the pipeline produces structured output files.
 */

const API = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

// ToolUniverse tests need long timeouts — MCP server startup + tool calls
test.setTimeout(600_000);

// ── Helpers ─────────────────────────────────────────────────────────

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/csrf-token`);
  return (await res.json()).token;
}

async function createProject(page: Page, name: string): Promise<string> {
  const token = await csrf(page);
  const res = await page.request.post(`${API}/projects`, {
    headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
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

async function assignSkill(page: Page, projectId: string, skillId: string): Promise<void> {
  const token = await csrf(page);
  const res = await page.request.post(`${API}/projects/${projectId}/skills/${skillId}`, {
    headers: { 'X-AIRA-Token': token },
  });
  expect(res.status()).toBe(200);
}

async function getCoScientistSkillId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/skills`);
  const skills = await res.json();
  const cs = skills.find((s: { name: string }) => s.name === 'co-scientist');
  expect(cs, 'Co-Scientist skill not found').toBeTruthy();
  return cs.id;
}

async function listFiles(page: Page, projectId: string): Promise<string[]> {
  const res = await page.request.get(`${API}/projects/${projectId}/files`);
  if (!res.ok()) return [];
  const data = await res.json();
  return (data.files ?? data ?? []).map((f: { name?: string; path?: string }) => f.path ?? f.name ?? '');
}

interface WSResult {
  chunks: string[];
  fullText: string;
  status: string | null;
  runId: string | null;
  error: string | null;
  progressMessages: string[];
}

function sendChat(projectId: string, content: string, timeoutMs = 480_000): Promise<WSResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}/chat`, {
      headers: { Origin: 'http://localhost:3000' },
    });

    const result: WSResult = {
      chunks: [],
      fullText: '',
      status: null,
      runId: null,
      error: null,
      progressMessages: [],
    };

    // Use activity-based timeout: reset timer on any message
    let timer: ReturnType<typeof setTimeout>;
    const IDLE_TIMEOUT = 300_000; // 5 min idle = dead
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        ws.close();
        reject(new Error(`WS idle timeout (${IDLE_TIMEOUT}ms no activity). chunks=${result.chunks.length}, text=${result.fullText.slice(0, 300)}`));
      }, IDLE_TIMEOUT);
    };

    // Also enforce absolute max
    const absTimer = setTimeout(() => {
      ws.close();
      reject(new Error(`WS absolute timeout (${timeoutMs}ms). chunks=${result.chunks.length}`));
    }, timeoutMs);

    ws.on('open', () => {
      console.log(`[WS] connected, sending prompt (${content.length} chars)`);
      ws.send(JSON.stringify({ type: 'chat', content }));
      resetTimer();
    });

    ws.on('message', (data) => {
      resetTimer(); // Any message resets idle timer
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'chunk' && msg.content) {
          result.chunks.push(msg.content);
          result.fullText += msg.content;
        }
        if (msg.type === 'progress' && msg.message) {
          result.progressMessages.push(msg.message);
        }
        if (msg.type === 'status') {
          result.status = msg.status;
          result.runId = msg.runId ?? null;
          if (['completed', 'error', 'cancelled', 'timeout'].includes(msg.status)) {
            clearTimeout(timer);
            clearTimeout(absTimer);
            ws.close();
            resolve(result);
          }
        }
        if (msg.type === 'error') {
          result.error = msg.message ?? msg.content ?? 'unknown error';
        }
      } catch { /* ignore */ }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      clearTimeout(absTimer);
      reject(new Error(`WS error: ${err.message}`));
    });

    ws.on('close', () => {
      clearTimeout(timer);
      clearTimeout(absTimer);
      if (!result.status) {
        result.status = 'disconnected';
        resolve(result);
      }
    });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

test.describe('ToolUniverse Advanced Workflows', () => {
  let projectId: string;
  let skillId: string;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    projectId = await createProject(page, `tu-test-${Date.now()}`);
    skillId = await getCoScientistSkillId(page);
    await assignSkill(page, projectId, skillId);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await deleteProject(page, projectId);
    await page.close();
  });

  // ── TU-01: Drug target profiling with ChEMBL + UniProt ──────────

  test('TU-01: JAK2 阻害剤のドラッグターゲットプロファイリング', async ({ page }) => {
    const prompt = `JAK2（Janus Kinase 2）を標的とした阻害剤の包括的プロファイリングを実施してください。

以下のステップで解析を行い、各結果をファイルに保存してください：

1. JAK2 タンパク質の基本情報（UniProt ID: P52333）の取得
2. JAK2 を標的とする既知の阻害剤リスト（ChEMBL から上位10化合物）
3. 各化合物の IC50/Ki 値とセレクティビティプロファイル
4. 臨床開発段階にある JAK2 阻害剤の一覧
5. 結果を report.md にまとめ、figures/ に構造活性相関の概要図を作成

ToolUniverse MCP ツールを優先的に使用し、利用不可の場合は Python requests + REST API にフォールバックしてください。`;

    const result = await sendChat(projectId, prompt);

    expect(result.status).toBe('completed');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.fullText.length).toBeGreaterThan(100);

    // Verify files were created
    const files = await listFiles(page, projectId);
    console.log(`[TU-01] files: ${files.length} — ${files.join(', ')}`);
    expect(files.length).toBeGreaterThan(0);
  });

  // ── TU-02: Multi-omics disease pathway analysis ─────────────────

  test('TU-02: 乳がんのマルチオミクス経路解析', async ({ page }) => {
    const prompt = `乳がん（Breast Cancer）のマルチオミクス経路解析を実施してください。

解析手順：
1. BRCA1/BRCA2 関連の遺伝子変異情報を取得（ClinVar/gnomAD）
2. 乳がん関連のシグナル伝達経路を Reactome から取得
3. PI3K/AKT/mTOR 経路の主要遺伝子のタンパク質相互作用ネットワークを STRING DB で取得
4. 各遺伝子の組織別発現パターン（GTEx）を調査
5. 結果を統合し、治療標的候補を提案

Python で解析スクリプトを作成し、結果を results/ に保存、report.md に日本語でまとめてください。
MCP ToolUniverse ツールを活用してデータベースクエリを実行してください。`;

    const result = await sendChat(projectId, prompt);

    expect(result.status).toBe('completed');
    expect(result.fullText.length).toBeGreaterThan(100);

    const files = await listFiles(page, projectId);
    console.log(`[TU-02] files: ${files.length} — ${files.join(', ')}`);
    expect(files.length).toBeGreaterThan(0);
  });

  // ── TU-03: Pharmacogenomics variant interpretation ──────────────

  test('TU-03: CYP2D6 の薬理ゲノミクスバリアント解釈', async ({ page }) => {
    const prompt = `CYP2D6（Cytochrome P450 2D6）の薬理ゲノミクス解析を実施してください。

解析内容：
1. CYP2D6 の主要な機能喪失バリアント（*3, *4, *5, *6）の臨床的意義を PharmGKB から取得
2. CYP2D6 の代謝に影響する薬剤リスト（タモキシフェン、コデイン、フルオキセチン等）を取得
3. Poor Metabolizer (PM) / Intermediate Metabolizer (IM) / Ultra-rapid Metabolizer (UM) の
   臨床的影響と用量調整ガイドラインを整理
4. CYP2D6 バリアントの民族間頻度差をまとめる
5. 臨床意思決定支援のためのフローチャートを作成

results/ に解析データ、figures/ にフローチャート、report.md に総括レポートを保存してください。`;

    const result = await sendChat(projectId, prompt);

    expect(result.status).toBe('completed');
    expect(result.fullText.length).toBeGreaterThan(100);

    const files = await listFiles(page, projectId);
    console.log(`[TU-03] files: ${files.length} — ${files.join(', ')}`);
    expect(files.length).toBeGreaterThan(0);
  });

  // ── TU-04: Protein structure & docking analysis ─────────────────

  test('TU-04: EGFR タンパク質構造解析とドッキングシミュレーション設計', async ({ page }) => {
    const prompt = `EGFR（Epidermal Growth Factor Receptor）のタンパク質構造解析とドッキングシミュレーション計画を作成してください。

解析手順：
1. EGFR のキナーゼドメイン構造を PDB から検索（解像度 ≤ 2.5Å の構造をリスト化）
2. AlphaFold2 による予測構造との比較ポイントを整理
3. T790M 耐性変異が結合ポケットに与える構造的影響を分析
4. 第3世代 EGFR-TKI（オシメルチニブ等）の結合様式の文献的考察
5. Python でのドッキングシミュレーションプロトコル（AutoDock Vina 使用）を設計
6. 結果と考察を report.md に記載

PDB/UniProt/AlphaFold のデータ取得には MCP ToolUniverse ツールを使用してください。`;

    const result = await sendChat(projectId, prompt);

    expect(result.status).toBe('completed');
    expect(result.fullText.length).toBeGreaterThan(100);

    const files = await listFiles(page, projectId);
    console.log(`[TU-04] files: ${files.length} — ${files.join(', ')}`);
    expect(files.length).toBeGreaterThan(0);
  });

  // ── TU-05: Clinical trial analytics + literature review ─────────

  test('TU-05: GLP-1 受容体作動薬の臨床試験メタアナリシス設計', async ({ page }) => {
    const prompt = `GLP-1 受容体作動薬（セマグルチド、リラグルチド、チルゼパチド等）の
心血管アウトカム臨床試験のメタアナリシス設計を行ってください。

ステップ：
1. PubMed で "GLP-1 receptor agonist cardiovascular outcome trial" を検索し、
   主要な RCT（LEADER, SUSTAIN-6, PIONEER 6, SELECT, SURPASS-CVOT）をリスト化
2. 各試験の PICO（Patient, Intervention, Comparison, Outcome）を構造化して整理
3. 主要評価項目（MACE: Major Adverse Cardiovascular Events）のハザード比を収集
4. Forest plot 用のデータテーブルを作成
5. 異質性評価（I², Cochran Q）の計算方法と解釈基準を記述
6. PRISMA フローチャートのテンプレートを作成
7. Python でメタアナリシススクリプト（ランダム効果モデル）を実装

results/ にデータ、figures/ に Forest plot スクリプト、report.md に日本語レポートを保存。`;

    const result = await sendChat(projectId, prompt);

    expect(result.status).toBe('completed');
    expect(result.fullText.length).toBeGreaterThan(100);

    const files = await listFiles(page, projectId);
    console.log(`[TU-05] files: ${files.length} — ${files.join(', ')}`);
    expect(files.length).toBeGreaterThan(0);
  });
});
