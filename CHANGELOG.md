# Changelog

All notable changes to AIRA are documented in this file.

## [v3.4.5] — 2026-06-04 — Format Equivalence + Tooling Guidance

Round 12 (v3.4.4) で成功率 100% / 引用密度 +4.3% / 初回 `vm=0` 件数 22→28 を達成した一方、`value_mismatches` 平均が 20.1→30.7 に増加(特に `vm≥50` が 8→21)。原因は v3.4.4 の Pillar B(% / 指数)で未カバーの表記(**カンマ区切り**、**leading-dot decimal**)が修復時の追加引用で露呈したこと。同時に Round 12 では NatureLM / GALACTICA 系 scientific LLM への試行が引き続き観測され、これらは AIRA 環境では利用不可のため Skill 側で全面禁止する。

### Changed — Pillar A: Format normalisation 拡張 (provenance-validator.ts)

- **`extractNumericCandidates(text)` を拡張**:
  - **千の位カンマ区切り**: `1,234` / `12,345,678` / `1,234.5` を正しく単一の数値として候補化
  - **leading-dot decimal**: `.83` を `0.83` として候補化(numpy stringify などで頻出)
  - カンマ区切り + 直後 `%` の組み合わせも `/100` variant を emit(`1,500%` → 1500 と 15)
- 実装メモ: カンマ規則を **最初に** スキャン、マッチ範囲を空白でマスクしてから decimal regex を走らせる。これにより `1,234` が `1` と `234` の 2 候補に分解されるバグを構造的に防ぐ。
- backward-compatible: 公開 API シグネチャ不変。

### Skill — Co-Scientist v4.11.0 → v4.12.0 (Pillar B)

- **NatureLM / GALACTICA / 全 scientific LLM への試行を全面禁止**(ユーザー直接指示):
  - 旧「Where to actually call NatureLM / GALACTICA / scientific LLMs」セクションを削除(ToolUniverse 経路 / dedicated MCP 経路 / HuggingFace direct-load 経路、全て撤回)
  - 新セクション「NatureLM / GALACTICA in the AIRA environment (v4.12.0)」: これらは AIRA 環境では一切利用不可、と明示。失敗試行が repair iteration を浪費するため、最初から試行禁止
  - **代替: 文献値検証パターン**を必須化 — ToolUniverse (PubMed/arXiv/EuropePMC) で公表値を引用、ローカル計算は classical baseline / smaller statistical model で代替
  - **試行記録の必須化**: `report.md` Methods / Results + `paper.md` Methods / Results の両方に試行 + フォールバックを記録するテンプレを提供
- **figure_orphans 双方向ルール (refined v4.12.0)**: Round 12 で ファイル数 +84% に伴い orphan も 3.6→4.5 に増加。「生成した図は本文で必ず引用する」を明文化、`/validate` 直前に `figures/` ディレクトリと本文の cross-check を指示
- `copilot-instructions.md` / `AGENTS.md` のトップレベル version を v4.12.0 にバンプ

### Deferred (本リリース範囲外)

- **Validation API の高負荷時 0/4 異常**: Round 11 / 12 で再現したが、サーバー負荷に起因する一過性問題。コード変更ではなく並列度オペレーション側の課題として分離
- **4 並列推奨**: 運用設定変更であり、ドキュメント側で別途記載予定

### Tests

- `extractNumericCandidates` のカンマ区切り(integer / multi-group / 千の位非分解の regression / `%` 組み合わせ)+ leading-dot を網羅(計 5 ケース)
- `valueAppearsInCellOutputs` の end-to-end(`text_output: "1,234"` で claim 1234 一致、`text_output: "12,345,678"` で claim 12345678 一致、stdout 最終行 `.83` で claim 0.83 一致)(計 4 ケース)
- 全 63 tests グリーン(+9 from v3.4.4)

### Notes

- v3.4.0 で導入された `value_mismatches` の意味は変わらず、本リリースは「等価とみなす表記範囲」の拡張のみ。`ValidationReport` 構造不変。
- Round 13 で `vm≥50` 件数が下がっていれば本変更の効果が確認できる想定。

## [v3.4.4] — 2026-05-29 — Value Match Precision

Round 11 (v3.4.3) telemetry showed 100% gate pass / 97.6% citation coverage を達成した一方で、informational な **`value_mismatches` が 88% の実験で発生(平均 20.1件/実験)** という新しい問題が表面化した。根本原因は false positive — cell 中間 `print()` との誤一致、`%` ↔ 小数表記差、指数表記、再実行値ドリフト。本リリースは検出を **cell の最終出力位置に絞り、表記を正規化** することで、警告の信号性を高める。

### Changed — Pillar A: Last-output bias

- **`valueAppearsInCellOutputs(claimedValue, precision, cell)` を新規追加** し `validateProject()` の value-match 経路を切替:
  - **Priority 1**: `text_output` (Jupyter の `execute_result` + `display_data` を結合した値) を最優先で照合
  - **Priority 2**: `stdout` の **最終非空行のみ** を照合
  - **意図的に Priority 3 を持たない** — stdout 全文走査(従来挙動)を廃止し、cell 中間 `print()` との誤一致を構造的に排除
- これにより `print(0.50); print(0.60); print(0.83)` のような cell に対し、レポートが `AUROC=0.50 [cell:X]` と書いていれば(従来は通っていた)正しく不一致が検出される。逆に `AUROC=0.83 [cell:X]` であれば通過する。

### Changed — Pillar B: Format normalisation

- **`extractNumericCandidates(text)` を新規 export** し `valueAppearsInOutputs` を delegate に refactor:
  - 通常小数(`0.83`)に加え、直後が `%` であれば `value / 100` も候補化 (`83.0%` → 83 と 0.83 の両方)
  - 指数表記(`8.316e-1`)を独立に抽出
- これにより report 側が `0.83` と書いていても、cell 出力が `83.0%` / `8.3e-1` / `0.8316` のいずれでも tolerance 内で一致する。
- backward-compatible: 既存の `valueAppearsInOutputs(value, precision, text)` 公開 API は維持。

### Skill — Co-Scientist v4.10.0 → v4.11.0 (Pillar C)

- 「Self-check for citation correctness」を v4.11.0 に更新:
  - validator が **`text_output` と stdout 最終行のみ** を見ることを明示。中間 `print()` の値を引用する場合は cell を分割するか、最終 print に持ってくるよう指示。
  - **format equivalence** (% / 指数) が validator 側で自動処理されることを明示。
  - `value_mismatches` は **informational であり repair iteration を消費しない**(blocking gate / uncited claims / unknown citations を優先)— 1 回の repair で残った場合は受容 + Limitations 記述、を明文化。
- top-level version header と `copilot-instructions.md` を v4.11.0 にバンプ。

### Tests

- `extractNumericCandidates` の decimal / `%` 二系統 / 指数 を網羅(3 ケース)
- `valueAppearsInCellOutputs` の text_output 優先 / stdout 最終行マッチ / **中間 stdout 値の非マッチ(回帰防止の核)** / text_output が stdout を上書きする priority / 末尾空白行スキップ(計 5 ケース)
- `%` 正規化の end-to-end(`text_output: "83.0%"` で `AUROC=0.83` が一致)(2 ケース)
- 全 54 tests グリーン。

### Notes

- v3.4.0 で導入された `value_mismatches` の **意味は変わっていない**(precision-aware tolerance + 1e-10 FP epsilon)。本リリースは「どこを見るか」と「何を等価とみなすか」の改善のみで、レポート構造 (`ValidationReport`) は不変。
- Round 12 (v3.4.4) で `value_mismatches` 発生率が大幅に下がっていれば本変更の効果が確認できる想定。

## [v3.4.3] — 2026-06-02

### Fixed
- **CI で Windows runner のテストが失敗していた問題**(v3.4.2 で導入):
  - Postmortem テストでパス比較に forward-slash regex を使っていたが、Windows の `path.join` は backslash を返す。テスト内で `.replace(/\\/g, '/')` で正規化し、ファイル読み込みも `path.join` 経由に。
  - `notebook-trace.test.ts` / `provenance-validator.test.ts` の fs-heavy 統合テストが Windows で 5s timeout を超えていた。`vitest.config.ts` の `testTimeout` を default 5s → **15s に引き上げ**。fs latency 差吸収。
- 機能・API 変更なし。

## [v3.4.2] — 2026-06-02 — Provenance Carry-overs

v3.4.0 で「v3.5+ 候補」と書いた残課題 4 つをすべて消化。Round 10 で 1 件だけ全 gate 失敗した SCI-073 の corner case を構造化検出、figure 引用の出自検査、3 回 repair でも通らないケースの自動 postmortem、time-budget guard を導入。

### Added — Pillar 2: Figure provenance

- **`extractFigureReferences(md)`**: report.md / paper.md から `figures/<name>.<ext>` (png/jpg/jpeg/svg/pdf/webp/gif) のパスを重複排除して抽出
- **`figureHasProducerCell(figPath, cells)`**: 各 figure path に対し、cell source に `savefig` / `to_image` / `write_image` / `imsave` / `imwrite` / `Image.save` / `fig.write_image` / `joblib.dump` のいずれかと、figure path or basename が含まれるか検査
- `ValidationReport.figure_orphans: FigureOrphan[]` を追加(informational)
- repair prompt に "Figure orphans" セクションを追加

### Added — Pillar 4: Auto-postmortem

- **新規 endpoint `POST /api/projects/:id/validate/postmortem`**
- `buildPostmortemReport()` が以下を生成:
  - 残った failed gates / unknown_citations / uncited_claims / value_mismatches / figure_orphans / report_thinness の構造化サマリ
  - trace snapshot 数と直近 5 件のタイムスタンプ
  - **markdown_summary** — agent が `report.md` Limitations / `paper.md` Limitations に貼り付ける用
- `workspace/.trace/postmortem-<ISO>.json` に永続化

### Added — Time-budget guard

- backend: `ValidationReport.report_thinness: ReportThinness[]` を追加(`missing` / `tiny` (<800 bytes) / `no_claims`)
- repair prompt の "Report thinness" セクションは **最優先で対処** と明示(urgent)
- skill: 「first `/validate` 時点で report.md と paper.md 両方が骨格付きで存在すること」を必須化、paper.md 未生成のまま time cap を迎える経路を遮断

### Added — SCI-073 corner case defence

- 上記 `report_thinness` の `no_claims` レベル (report は size あるが numeric claim 0 件) — Round 10 で SCI-073 が陥った可能性のあるパターンを構造化検出
- repair prompt 経路で agent に明示的に通知

### Changed — Co-Scientist v4.9.0 → v4.10.0

- AGENTS.md に 3 つの新セクション追加:
  - "Figure provenance" — 引用した figure path には必ず producer cell が必要
  - "Time-budget guard" — `/validate` を呼ぶ時点で paper.md は既に骨格付きで存在せよ。`report_thinness` を最優先で対処
  - "Auto-postmortem on 3-iteration failure" — 3 回失敗時は `/validate/postmortem` → markdown_summary を Limitations に逐語貼付
- copilot-instructions.md に凝縮版で同じ要旨
- skill.json + 各ヘッダ version を v4.10.0 に bump

### API 変更(完全後方互換)
- `ValidationReport.figure_orphans: FigureOrphan[]` 追加
- `ValidationReport.report_thinness: ReportThinness[]` 追加
- `RepairPayload.violations[i].issue` ユニオンに `'figure_orphan'` / `'report_thin'` 追加
- 新規 endpoint `POST /api/projects/:id/validate/postmortem`(冪等、副作用は `.trace/` への write のみ)

### Tests
- 新規 backend 12 ケース:
  - `extractFigureReferences` — markdown image / 重複除去
  - `figureHasProducerCell` — savefig 一致 / basename 一致 / save 呼び出し無し
  - `figure_orphans` の report 反映 — orphan あり / 全 figure 解決時
  - `report_thinness` — missing / tiny / no_claims の 3 レベル
  - `buildPostmortemReport` — trace 未取得時 / 生成時にファイル書き出し + markdown_summary
- **24 backend test files / 269 tests + 21 frontend tests all green**

### Migration
- 完全後方互換。新規フィールド・新規 endpoint の追加のみ。
- skill 文書のみで agent 行動が変わる(Docker image rebuild で反映)。
- v3.5+ で持ち越し: 大規模な改修なし、本リリースで Round 10 の残課題を完全消化。

## [v3.4.1] — 2026-06-02

### Fixed
- **CI で TS2741 (`value_mismatches missing in ValidationReport`)**: v3.4.0 で `ValidationReport` 型に `value_mismatches` を追加したが、`validateProject` の early-return path (snapshot 不在時)で当該フィールドを設定していなかった。tsc strict mode で macos runner が build failure。`value_mismatches: []` を補完。

## [v3.4.0] — 2026-06-02 — Semantic Verification

Round 10 (v3.3.0 × 100 実験) で **citation coverage 96.5%、env_capture 99%、全 4 ゲート 99/100 通過** を達成。「数値が引用付きで報告される」状態は保証されたが、次の論点 **「引用先の cell が実際にその値を出力したか」** が未検査だった。v3.4.0 は Semantic Verification を導入してこのギャップを埋める + repair の時間コストを削減する(Round 10 で +56%)。

### Added — Pillar 1: Value Presence check(informational signal)

- **新規 `valueAppearsInOutputs()`**: 引用付き claim から数値と precision を抽出し、引用 cell の `stdout` / `text_output` に precision-aware tolerance (`0.5 × 10^-precision + 1e-10` FP epsilon) で含まれるか検査
- 例: `AUROC = 0.83 [cell:cv]` で `cv` cell の出力が `0.8316` → 一致(0.83 に丸まる範囲)
- 例: `AUROC = 0.83 [cell:cv]` で `cv` cell が `0.92` → **mismatch**
- ValidationReport に新フィールド `value_mismatches: ValueMismatch[]` を追加
- 不一致は **informational(gate 不通過扱いしない)** — false positive(中間値 vs 最終値、formatting 差等)が起こりうるため。pass 判定は変更なし。
- repair プロンプトにも "Value-presence warnings" セクションを追加して agent に通知

### Changed — Pillar 3: Repair の single-batch 化

- `formatRepairPrompt` を全面書き換え:
  - 強い preamble: "**Apply ALL Fixes in ONE Pass**" / "Do NOT call `/validate` again until you have applied every fix below"
  - 重複 remediation hint を行内に圧縮(per-violation の冗長な指示を排除)
  - フラットセクション構造: Failed gates → Uncited claims → Unknown citations → Value-presence warnings → Available cell ids
- 期待効果(Round 11):
  - 平均 repair 反復: 1.10 → 1.02 程度に改善
  - 平均所要時間: 24.4 分 → 18-20 分(Pillar 3 単体で約 −5 分/件)
  - 100 件総計: 40.6h → 30-33h

### Changed — Pillar 5: Co-Scientist v4.8.1 → v4.9.0

- **AGENTS.md / copilot-instructions.md の Mandatory second-pass loop を single-batch 前提に書き換え**
  - 「ALL fixes を 1 turn で適用してから `/validate` を再呼出」を明示
  - **`[cell:aira-env]` / `[cell:aira-seed]` を序盤に必ず実行する** ことを step 1 として明示(Round 10 の paper.md 欠 2 件 / seed_presence 100→99% 退行への対策)
- **新セクション "Self-check for citation correctness"** を追加: agent が `metric = X [cell:N]` を書く前に cell N の出力を確認、X が無ければ修正 → 1 iteration 節約
- skill.json + 各ヘッダ version を v4.9.0 に bump

### API 変更(後方互換)
- `ValidationReport` に `value_mismatches` フィールド追加(既存 client は無視可能)
- `RepairPayload.violations` の `issue` ユニオンに `'value_mismatch'` 追加(同上)

### Tests
- 新規 backend 7 ケース:
  - `extractClaimValue` の精度抽出(metric-assignment / p-value / sample-size / 負値 / 数値なし)
  - `valueAppearsInOutputs` の tolerance(decimal precision 2/3、整数 exact、FP boundary)
  - value_mismatches の report 反映(citation 先に値が無ければ列挙、あれば 0、pass=true 維持)
  - repair prompt が value mismatches を informational として surface
  - single-batch prompt の文言("ONE Pass", "Do NOT call", 4 セクション構造)
- **24 backend test files / 257 tests + 21 frontend tests all green**

### Migration
- 完全後方互換。新規フィールド追加のみ、API 既存路もすべて動作。
- Co-Scientist の skill 文書のみの行動変化(Docker image rebuild で反映、現行 container には未反映)

### v3.4.0 で未着手 / 残課題(v3.5+ 候補)
- **Pillar 2 (figure provenance)**: `[cell:viz-roc]` 引用先で `plt.savefig` が実行されたかの突合
- **Pillar 4 (auto-postmortem)**: 3 回 repair で通らないケースの構造化失敗ログ
- **time-budget guard**: repair が paper.md 生成時間を食い潰さないようにする保護
- **SCI-073 root cause**: Round 10 で 1 件だけ全ゲート失敗したケースの解析

## [v3.3.1] — 2026-06-01

### Fixed
- **agent が NatureLM/GALACTICA を ToolUniverse 経由で扱おうとして "tools not registered in ToolUniverse" で終わらせてしまう挙動を修正**: Round 10 観測。v3.1.4 で「これらは存在しない」と書いたのが過剰修正で、実際には `nature-mcp` / `galactica-mcp` が **独立の MCP サーバ** として AIRA に設定されているケースを想定できていなかった。agent は ToolUniverse で見つからないと処理を諦めていた。
- **Co-Scientist v4.8.0 → v4.8.1**: AGENTS.md / copilot-instructions.md を以下に書き換え:
  - 「Path 1: 独立 MCP サーバ(`mcp__naturelm__*` / `mcp__galactica__*` 等)があれば直接呼ぶ」
  - 「Path 2: 無ければ Jupyter kernel で `transformers` から fallback でロード」
  - **「`tools not registered in ToolUniverse` を最終結論にしない」** を Forbidden pattern として明示
  - 決定フローチャートを追加(MCP リストを確認 → 該当 MCP があれば Path 1、無ければ Path 2)
  - PubMedBERT / SciBERT / BioBERT / ESM-2 / MolFormer / ChemBERTa の HuggingFace ID も明記
- skill.json + 各ヘッダの version を v4.8.1 に bump。

### Migration
- skill 文書の変更のみ。バックエンドコード変更なし、API 完全後方互換。
- 既存実験中の agent には反映されない(image を v3.3.1 に差し替え + 再起動が必要)。

## [v3.3.0] — 2026-06-01 — Provenance Enforcement

Qiita 記事 [Round 9 で測定した v3.2.0 の効果と限界](https://qiita.com/hisaho/items/75ff865b4a0da03785a1) を踏まえた追加施策。`[cell:<id>]` 引用は 0→89% に増えたが、citation coverage は **15.7%(目標 80% 未達)**、`pip freeze` 実行率 **0%**、citation linter に **DOI 誤検出**が指摘された。v3.3.0 はこれを 4 Pillar で潰す:

### Added — Pillar A: Citation linter の精度向上

- **誤検出フィルタ**: DOI (`10.xxxx/...` / `doi.org/...`)、4 桁年号 (1900-2100)、section / figure / equation ラベル (`Section 3.1`, `Fig. 2.5`, `Eq. 1.2`)、reference citation (`(Smith et al., 2024)`) を numeric claim から除外。
- **CITE_NEAR を 200 → 400 chars に拡大**: Round 9 解析で「引用と claim が同じ段落だが 200 文字超」のケースが多発していたため。

### Added — Pillar B: Second-pass 修復エンドポイント

- **新規 `POST /api/projects/:id/validate/repair`**: validate の結果から「未引用 claim」「不正な citation」「失敗 gate」を構造化リストとして返す + agent 用の markdown 修復プロンプトも生成。
- プロンプトには: 各違反の説明 / 修正ヒント (`!pip freeze`, seed 設定 等) / **利用可能な cell ID のリスト** が含まれる。
- skill 側に「validate → fail → repair → 修正 → 再 validate → pass までループ」のワークフローを組み込み(最大 3 反復、超過時は失敗を明示記載)。

### Added — Pillar C: Pre-seeded notebook template

- 新規 project の `notebook.ipynb` に 3 cells を pre-insert:
  - `[cell:aira-header]` — markdown title + 引用規律のリマインダ
  - `[cell:aira-env]` — `!pip freeze > requirements.txt` (env_capture gate を default で pass)
  - `[cell:aira-seed]` — `random` / `numpy.random` / `torch` の seed 設定 (seed_presence gate を default で pass)
- Round 9 で 0% だった `pip freeze` 実行を **テンプレート埋め込みで強制的に可能化**。agent はこの 2 cell を実行するだけで 2/4 の gate を通せる。

### Changed — Pillar D: Co-Scientist v4.7.0 → v4.8.0

- **AGENTS.md / copilot-instructions.md に Mandatory second-pass repair loop を追加**: 完了前に必ず validate を呼び、fail なら repair を呼び、修復を適用し、再 validate するループ(最大 3 反復、超過時は失敗を最終応答に明示)。
- pre-seeded template (`[cell:aira-header/env/seed]`) の存在を前提とし、agent はこれを継承して analysis cell を追加する。
- citation の auto-exclusion (DOI / reference / section label) も明示し、不要な `[cell:...]` 付与を防止。
- skill.json + 各ヘッダの version を v4.8.0 に bump。

### Tests
- 新規 backend 11 ケース:
  - `provenance-validator.test.ts` (+6): DOI 除外 / doi.org 除外 / 年号除外 / section ラベル除外 / 真の metric は保持 / CITE_NEAR 400 chars
  - `provenance-validator.test.ts > buildRepairPayload` (+5): pass=true 時の空 payload / 未引用 claim 列挙 / unknown citation 列挙 / 失敗 gate と remediation hint / trace 未取得時
  - `routes/mcp.test.ts` (+1 更新): pre-seeded template の 3 cells を assert
- **24 backend test files / 250 tests + 21 frontend tests all green**、tsc + Vite build OK。

### 期待効果(Round 10 想定)
- env_capture gate 通過率: **0% → ~100%**(`[cell:aira-env]` 1 つ実行するだけ)
- seed_presence gate 通過率: **100% を維持** + 明示化
- citation_coverage: **15.7% → 80%+ を目標**(linter 誤検出減 + repair ループ + 距離拡大の合わせ技)
- DOI 誤検出件数: **0 件**

### Migration
- 既存 v3.2.x プロジェクトは `notebook.ipynb` が空のまま。新規プロジェクトのみ pre-seeded。手動で同等の cell を追加すれば既存 project でも gate を通せる。
- API は完全な後方互換。新規 endpoint `/validate/repair` を追加しただけ。

## [v3.2.1] — 2026-05-31

### Fixed
- **CI で TS6133 (`path is declared but its value is never read`) を解消**: v3.2.0 で `services/notebook-trace.ts` に未使用 import (`import path from 'node:path'`) が残っていた。tsc strict mode で macos-latest runner が build を fail させていた。import を削除。コードベース・テストへの影響なし。

## [v3.2.0] — 2026-05-31 — Computational Provenance

Qiita 記事「AIRA-γ: フィクションからノンフィクションへ」を受けた次世代設計。Jupyter MCP の同梱(v3.0)で「コードが書ける」ようになったが、**「数値が本当に計算結果に由来するか」は検証されていなかった**。v3.2.0 はこの trust gap を埋めるリリース。Pillar 1〜4 + 6 を実装(Pillar 5 figure provenance は v3.3 へ繰り延べ)。

### Added — Pillar 1: Notebook 実行トレースの自動キャプチャ

- **`services/notebook-trace.ts` 新規**: agent run の onDone で `notebook.ipynb` を parse し、cell ごとに source / exec_count / outputs / stdout / stderr / has_error / has_image / text_output を抽出。snapshot を `workspace/.trace/execution-trace.jsonl` に append。
- **env_hash 付き**: `python3 -m pip freeze` の sha256 を各 snapshot に含める(プロセスライフタイムでキャッシュ)。
- **読み出し API**: `GET /api/projects/:id/notebook/trace`(`?latest=1` で最新 snapshot のみ)。
- truncation で 1 cell 4KB cap、stdin/stderr 個別に保持。

### Added — Pillar 2: 数値 → `[cell:<id>]` 引用 linter

- **`services/provenance-validator.ts` 新規**: `report.md` / `paper.md` をスキャンし、`AUROC = 0.83`、`(p < 0.001)`、`F1 of 0.92`、`n = 1024` 等のパターンを抽出。同一スパンの重複検出を deduplicate。
- 各 claim に対し近傍 200 文字以内の `[cell:<id>]` 引用を収集し、trace の latest snapshot と cross-check。
- **`uncited_claims` と `unknown_citations`** を返す(後者は実在しない cell ID への引用)。

### Added — Pillar 3: 再現性ゲート 4 種

`POST /api/projects/:id/validate` で同時に走る:
1. **`seed_presence`** — `np.random.*` / `random.*` / `torch.*rand*` / `tf.random.*` 等を使う cell に seed 設定(in-cell or earlier)が無いものを検出
2. **`env_capture`** — `requirements.txt` または `pip freeze` / `pip list` cell の存在
3. **`no_error_in_cited`** — 引用された cell の stderr が非空 / error output 存在
4. **`citation_coverage`** — 数値 claim の 80% 以上に引用がある

soft mode(失敗してもブロックしない、報告のみ)。

### Added — Pillar 4: `data/raw/` 規約

- **`config/paths.ts`**: `getRawDataDir(projectId)` / `getDataSourcesPath(projectId)` 追加
- **`exec-context.ts:ensureDataConventions`**: workspace 確保時に `data/raw/` ディレクトリと `data/SOURCES.md` skeleton(`File / Source / SHA-256 / Size / Retrieved / License / Notes` のテーブル)を自動生成
- **Upload API 拡張**: `POST /api/projects/:id/files/upload` に `dest=data/raw` form フィールドを受け付ける(allowlist 方式、それ以外は 400)

### Added — Pillar 6: Co-Scientist v4.6.2 → v4.7.0

- **AGENTS.md に新セクション "Computational Provenance"**: `[cell:<id>]` 引用形式、reproducibility gates 4 種の説明、各 gate の修復手順、Required artifacts (`data/raw/`, `data/SOURCES.md`, `requirements.txt`, `workspace/.trace/`) を明示
- **copilot-instructions.md に凝縮版**を追加
- skill.json / 各ヘッダの version を v4.7.0 に bump

### Added — Frontend: Validate モーダル

- **`components/files/ValidationModal.tsx` 新規**: 4 gate の pass/fail、claim 数、uncited claims、unknown citations を一覧表示
- **RightPanel の Files タブ上部に 🔬 Validate ボタン**を追加
- i18n: `validate.*` キー追加 (ja/en)
- `api/client.ts` に `provenanceApi.validate()` 追加

### Tests
- 新規 backend 29 ケース:
  - `notebook-trace.test.ts` (+13): extractCells / capture / readLatest / readAll / malformed handling
  - `provenance-validator.test.ts` (+14): claim extraction / 4 gate / unknown citations
  - `routes/files.test.ts` (+2): `dest=data/raw` 受理 / 不正 dest 拒否
- **24 backend test files / 239 tests + 21 frontend tests all green**、両 workspace tsc + Vite production build 成功。

### 次のリリース予定
- **v3.3.0**: Pillar 5(figure provenance — `.meta.json` 自動生成、図のソース cell 追跡)
- **v4.0.0**: Trace タブ(notebook 実行履歴の可視化)、cell 引用の hover preview、validator が PASS してから "completed" にする hard mode

## [v3.1.4] — 2026-05-31

### Changed
- **Co-Scientist v4.6.1 → v4.6.2**: 「NatureLM / GALACTICA / その他のモデル inference 系を ToolUniverse 経由で呼ぼうとする幻覚」を防ぐ明示的なガードを追加。Round-8 実験で agent が `nature_lm_mcp` / `galactica_mcp` ツールが ToolUniverse 内に存在すると誤認して呼び出そうとする事例を受けて。
  - `AGENTS.md` の Data Acquisition セクションに **"What ToolUniverse is NOT for"** サブセクションを追加。存在しないツール名(`nature_lm`, `galactica_mcp`, `pubmedbert_inference`, `esm2_predict`, `alphafold_predict` 等)を ❌ 列挙。
  - 代替パターンとして **Jupyter MCP の kernel 内で `transformers` を使った直接呼び出し** をコード例付きで提示(GALACTICA / NatureLM / ESM-2 / MolFormer 等のテーブル)。
  - サイズ / ハードウェア現実チェック(1B→CPU可、7B→16GB RAM、13B+→GPU 必須)と、不可能な場合の処理(小型バリアント / cite-only / Limitations 明記)を規定。
  - `copilot-instructions.md` にも凝縮版で同じガードを追加。

### Migration
- Docker image を rebuild & redeploy が必要 (`skills/` がイメージに焼き込まれているため、現在動いている container には反映されない)。`gh run list` で Docker Publish 完走を待ってから新 image を pull → 再起動。
- 実行中の round-8 等で問題が発生している場合は: agent が `nature_lm_mcp not found` のような失敗を繰り返すなら、container を v3.1.4 image に差し替えて再実行が必要。

## [v3.1.3] — 2026-05-31

### Fixed
- **AIRA UI 内の JupyterLab iframe が `-p 3001:3000` 等の Docker publish パターンで blocked と表示される問題を修正**: v3.1.0 で書いた `jupyter-server.ts:frameAncestorOrigins()` がコンテナ内部の `AIRA_PORT` (= 3000) しか allowlist に入れていなかったため、ホスト側ポート 3001 でアクセスするブラウザ Origin (`http://localhost:3001`) が JupyterLab の `Content-Security-Policy: frame-ancestors` で蹴られていた。 default の frame-ancestors を **3000-3003 の一般的な publish ポート** に拡張し、`-p 3001:3000` / `-p 3002:3000` 等の典型パターンでは追加 env なしで iframe が通るようにした。

### Added
- **`AIRA_PUBLIC_URL` env を新設**: 「ブラウザから見える AIRA の URL」を単一値で指定するための env。LAN IP / カスタムホスト名 / reverse proxy 経由のアクセスで使う。指定すると:
  - JupyterLab の `frame-ancestors` allowlist に加わる(iframe 親として許可)
  - AIRA の CORS / CSRF Origin allowlist に加わる(API リクエスト元として許可)
  - URL の path/query は自動で剥がして `scheme://host` 形に正規化
- `AIRA_ALLOWED_ORIGINS` (CSV、複数 URL) と併用可。前者は単一 URL の宣言、後者は追加 origin の列挙。

### Tests
- 新規 8 ケース:
  - `jupyter-server.test.ts` (+6): `frameAncestorOrigins` を export してテスト可能化、default の 3000-3003 / Vite ポート / `AIRA_PUBLIC_URL` 反映 / URL 正規化 / `AIRA_ALLOWED_ORIGINS` 反映 / malformed URL のスキップ
  - `middleware/security.test.ts` (+2): `isOriginAllowed` での `AIRA_PUBLIC_URL` 受理 / path 付き URL の正規化
- 210 backend + 21 frontend tests all green。

### Migration
- **既に v3.1.2 で workaround として `AIRA_ALLOWED_ORIGINS=http://localhost:3001` 等を指定していたユーザ**は env を外して再起動するだけで動く(default に含まれるようになったため)。残したままでも動作変化なし。
- 非標準ホスト名 (LAN IP / カスタムドメイン / reverse proxy) で AIRA にアクセスしているユーザは `AIRA_PUBLIC_URL` を指定するのが推奨。

## [v3.1.2] — 2026-05-31

### Changed
- **サイドバー上部のタイトルを `AIRA-β` → `AIRA-γ` に変更** (`frontend/src/i18n.ts` の `sidebar.title`、ja/en 両方)。AIRA-γ は v3 系列(Jupyter MCP / JupyterLab GUI 同梱)のコードネーム。README / AGENTS.md はすでに整合済みだったが UI が β のままだったので追従。

### Added
- **Settings 画面に "バージョン情報" セクションを追加**。AIRA バージョン(`package.json` から runtime 読み取り、フォールバックは `unknown`)と Copilot CLI バージョン(`copilot --version` 実行結果、未インストール時は "未インストール" 表示)を表示。
- 新規 API `GET /api/settings/version` → `{ aira: string, copilotCli: string | null }`。

### Tests
- 機能追加に対する直接テストは未追加(UI 表示と既存 settings 構造に従う単純な追加のため)。既存 202 tests グリーンで回帰なし、tsc 両 workspace + Vite production build 成功。

## [v3.1.1] — 2026-05-31

### Fixed
- **Windows CI で paths.test.ts の "other path helpers remain stable" が失敗していた**: v3.1.0 で追加したテストで expected 値を `'/srv/aira/data'` のようにフォワードスラッシュ hardcode していたが、Windows の `path.join` はバックスラッシュを返すため `'\srv\aira\data'` と不一致。`path.join` を expected 側でも使うよう修正し、プラットフォーム非依存に。テスト本体は変更なし、機能変更なし。

## [v3.1.0] — 2026-05-31

エージェントが書いた Jupyter notebook を **AIRA UI 内の iframe で直接編集・実行** できるようにする GUI 統合。v3.0.0 で同梱した stateful Jupyter カーネルに対して、人間側のインタラクションを「別タブで JupyterLab を開く」レベルでなく **AIRA UI と一体化** させる。

### Added — JupyterLab UI 同梱と iframe 統合

- **Docker image に `jupyterlab` を同梱** (Dockerfile 1 行追加、+200〜300 MB)。`EXPOSE 8888` で iframe 用ポートを明示。
- **`jupyter-server.ts` を強化**:
  - `AIRA_JUPYTER_BIND` env (default 127.0.0.1) で bind 先を制御。iframe を有効にするには `0.0.0.0` を指定。
  - `AIRA_JUPYTER_TOKEN` env で auth token を固定可(default はランダム)。ブックマーク用。
  - `AIRA_JUPYTER_PUBLIC_URL` env で browser がアクセスする URL を明示(default は `http://localhost:<port>`)。reverse proxy / 非 localhost ホスト名運用に対応。
  - `--ServerApp.default_url=/lab` で JupyterLab UI をデフォルト landing に。
  - `--ServerApp.tornado_settings` で `Content-Security-Policy: frame-ancestors ...` を AIRA UI Origin の allowlist に絞り、`X-Frame-Options` を削除。AIRA UI からだけ iframe 可能。
  - `--ServerApp.allow_origin_pat` で localhost 系 Origin の AJAX を許可。
  - `getJupyterPublicUrl()` / `isJupyterPubliclyReachable()` を新規 export。
- **CSP frame-src を追加** (`middleware/security.ts`): AIRA UI から JupyterLab を iframe で読み込めるよう、`localhost:8888` / `127.0.0.1:8888` + `AIRA_JUPYTER_PUBLIC_URL` を frame-src に追加。
- **新規 API `GET /api/settings/jupyter`**: 状態を `{ available: 'ready' | 'loopback' | 'down', publicUrl?, token? }` で返す。frontend が iframe URL を組み立てる用。`available` の 3 状態でユーザに対する案内も変える。
- **Frontend `NotebookPane` 新規作成** (`components/files/NotebookPane.tsx`):
  - mount 時に `jupyterApi.getSettings()` で状態取得
  - `ready` → iframe で `<publicUrl>/lab/tree/projects/<id>/workspace/notebook.ipynb?token=<token>` を直接 deep-link
  - `loopback` → docker run の正しいオプション (`-p 8888:8888 -e AIRA_JUPYTER_BIND=0.0.0.0`) を表示
  - `down` → AIRA ログ参照を案内
  - 「別タブで開く」ボタンで iframe を回避してフォールバック可
- **`RightPanel` をタブ化**: 上部に `[ファイル] [ノートブック]` の 2 タブを追加。Notebook タブ選択時は `NotebookPane` がパネル全幅 + 全高で表示される(ResizablePanel で幅を広げて使う想定)。

### Tests
- 新規 backend 9 ケース:
  - `jupyter-server.test.ts` (+6): `getJupyterPublicUrl` の default / env override / loopback 判定 (`127.0.0.1` / `localhost` は false、`0.0.0.0` は true) / 内部 URL は常に loopback
  - `routes/settings.test.ts` (+2): `/api/settings/jupyter` の down / loopback 応答
  - `middleware/security.test.ts` (+2): CSP `frame-src` に Jupyter port が含まれること、`AIRA_JUPYTER_PUBLIC_URL` env が反映されること
- **22 backend test files / 202 tests + 21 frontend tests all green**。Vite production build OK。

### Setup — iframe 統合を有効にする起動コマンド

```bash
docker run -d \
  -p 3001:3000 \
  -p 8888:8888 \
  -e AIRA_JUPYTER_BIND=0.0.0.0 \
  -e AIRA_JUPYTER_TOKEN=my-stable-jupyter-token \  # optional 但しブックマーク安定化
  -e GITHUB_TOKEN="ghp_xxx" \
  -v aira-data:/app/data \
  -v aira-projects:/app/projects \
  ghcr.io/nahisaho/aira:v3.1.0
```

`-p 8888:8888` と `-e AIRA_JUPYTER_BIND=0.0.0.0` の両方が必要。片方だけだとブラウザから JupyterLab に到達できず、UI が "loopback" 案内を表示する。

### Default behavior は v3.0.x と同じ

env を何も指定しなければ JupyterLab は `127.0.0.1:8888` bind のままで、外部から見えない(セキュリティ上の default-deny)。Notebook タブを開くと "loopback" 案内が出るが、エージェント経由の jupyter MCP は引き続き機能する。

### Migration
- 既存 v3.0.x ユーザに必要な action なし。iframe 機能を使いたい場合のみ起動オプション追加。
- Docker image size: +200〜300 MB (約 5 GB → 約 5.3 GB)。GitHub Actions の Docker Publish も少し時間が伸びる。
- DB スキーマ変更なし。

## [v3.0.2] — 2026-05-31

v3.0.0 で同梱した jupyter-mcp-server の CLI 引数 / env 名を私が誤って実装していたため、Docker イメージで Jupyter MCP が **正しく起動していなかった**。実機の jupyter-mcp-server v1.27.2 を JSON-RPC で probe して正確なツール名と env 名を確認、修正。

### Fixed
- **`mcp.service.ts:injectJupyterRuntime` の CLI 引数 / env 名を修正**: jupyter-mcp-server は `--notebook-path` を受け付けず unknown option として弾いていた。実 API に合わせて以下に置き換え:
  - **削除**: `--notebook-path <path>` arg、`JUPYTER_SERVER_URL` env、`JUPYTER_SERVER_TOKEN` env
  - **追加**: env `RUNTIME_URL` / `RUNTIME_TOKEN` (kernel runtime 接続用、CLI の `--runtime-url` / `--runtime-token` と同一)、env `DOCUMENT_URL` / `DOCUMENT_TOKEN` (document service 用、AIRA の embedded セットアップでは runtime と同じ値)、env `DOCUMENT_ID` (notebook 自動 activate)
- args は `['--transport', 'stdio']` のままで、接続情報は env 経由になる。

### Changed
- **Co-Scientist v4.6.0 → v4.6.1**: jupyter-mcp-server の実 API に合わせ、`use_notebook("notebook.ipynb")` を **最初に必ず呼ぶ** ことを明示。これを忘れると以降の cell 操作がすべて "no active notebook" で失敗するため、first-call で確実に成功させるためのガード。
  - `AGENTS.md`: Stateful Python Compute セクションに "First-call requirement" を新設、Recommended pattern に step 0 として `use_notebook` を追加。
  - `copilot-instructions.md`: Workflow 行の先頭に "first call must be `use_notebook(...)`" を追加。
  - 代表サブスキル 3 個 (`co-scientist-eda-correlation` / `co-scientist-statistical-testing` / `co-scientist-data-preprocessing`): 各 Stateful Compute Pattern の冒頭 step 0 に `use_notebook("notebook.ipynb")` を追加。

### Tests
- **新規 regression テスト**: `routes/mcp.test.ts` に "does not inject the legacy --notebook-path arg or JUPYTER_SERVER_* env (regression for v3.0.2 fix)" を追加。
- 既存の injection テストは新しい env キーを assert する形に更新。
- 193 backend + 21 frontend tests all green。

### Background
- v3.0.0 リリース時、jupyter-mcp-server を私が **未検証のまま** 実装していた。今回 `pip install` + JSON-RPC `tools/list` で正確な API を確認した結果が下記の通り。
- ツール一覧 (v1.27.2): `use_notebook` / `list_notebooks` / `restart_notebook` / `unuse_notebook` / `connect_to_jupyter` / `insert_cell` / `insert_execute_code_cell` / `execute_cell` / `read_cell` / `read_notebook` / `delete_cell` / `move_cell` / `overwrite_cell_source` / `edit_cell_source` / `execute_code` / `list_files` / `list_kernels` の 17 個。
- `append_execute_code_cell` のような名前は存在せず、cell 追加は `insert_execute_code_cell(index, code)` で行う。

## [v3.0.1] — 2026-05-30

Co-Scientist スキル群を v3.0.0 で追加した Jupyter MCP に合わせて notebook-first に方針転換。広範な書き換えではなく、**トップ方針 + 代表サブスキル 3 個** に絞ることで agent の自発的選択を促す方式。残りの 199 サブスキルは未変更でも、トップ方針が効くため大半のケースで jupyter MCP が選ばれる想定。

### Changed
- **Co-Scientist v4.5.0 → v4.6.0**:
  - `skills/co-scientist/AGENTS.md`: 新規セクション **"Stateful Python Compute (Jupyter MCP)"** を Code Quality Standards 直後に追加。jupyter MCP を使うべき場面 / `python script.py` を使うべき場面の判定基準、推奨ワークフロー(EXPLORE → REFACTOR → DRIVE → KEEP)、notebook 衛生(`*.ipynb_checkpoints/` を `.gitignore`、cell outputs は finalize 前にクリアしない)、fallback 規約を明文化。
  - `skills/co-scientist/copilot-instructions.md`: 同じ要旨を凝縮版で挿入。
  - `skills/co-scientist/skill.json`: version v4.0.2 → v4.6.0(AGENTS.md / copilot-instructions.md の表記と整合)。
- **代表サブスキル 3 個に "Stateful Compute Pattern" セクションを追加**:
  - `co-scientist-eda-correlation`: load → profile → distributions → correlation → multivariate → refactor の cell-by-cell パターン
  - `co-scientist-statistical-testing`: load + groups → assumption checks → test → correction → effect size + CI の段階パターン
  - `co-scientist-data-preprocessing`: profile missingness → outlier → imputation → scaling → validation の iterative パターン
- `report.md` / `paper.md` から **notebook cell ID を引用すること** を Article V (Traceability) の補強として明示。

### Rationale
- 202 サブスキル全部の書き換えは規模が大きすぎて v3.0.x の範囲を超える。トップ方針が効けば大半のサブスキルは agent の判断で自然に jupyter MCP を使う(routing は変えていない)。
- 代表 3 個は "load once, inspect many times" の典型パターンが分かりやすく、agent への学習素材として機能する。他サブスキルの段階的書き換えは v3.1+ で対応予定。

### Tests
- バックエンドコードに変更なし。192 backend + 21 frontend tests all green(回帰確認のみ)。

### Migration
- 既存ユーザに必要なアクションなし。スキル文書を読み直すだけで効く。
- v2.x プロジェクトで jupyter MCP を有効化していない場合は Settings → MCP → jupyter の Enabled トグル ON(v3.0.0 と同じ手順)。

## [v3.0.0] — 2026-05-30 — AIRA-γ

**v3 系列の最大の柱**: Python コード実行を stateless な `python script.py` から **stateful な Jupyter カーネル** に格上げ。AIRA は Docker イメージに JupyterLab + 科学計算スタックを同梱し、エージェントが MCP 経由で同じカーネルに接続し続けることで `df = pd.read_csv(...)` の状態が複数ターンに渡って保持される。

### Added — Jupyter MCP の Docker 同梱

- **Jupyter Server を AIRA 起動時に spawn**: `backend/src/services/jupyter-server.ts` を新規追加。127.0.0.1 にバインド、起動時にランダム 256-bit token を生成、子プロセスを管理。crash しても AIRA 本体は継続(Jupyter MCP のみ disabled 状態に)。終了時に SIGTERM → SIGKILL(grace 3s)で graceful 停止。
- **`jupyter` を 4 つ目のビルトイン MCP として配信**: `BUILTIN_MCP_CONFIGS` に追加。type=stdio、`jupyter-mcp-server --transport stdio --notebook-path <per-project>`。実行時に `mcp.service.ts:generateTempConfig` が JUPYTER_SERVER_URL / JUPYTER_SERVER_TOKEN env を注入し、`projects/<id>/workspace/notebook.ipynb` が無ければ空 notebook を自動生成。
- **Per-project notebook**: 各プロジェクトは独自の `notebook.ipynb` を持ち、Jupyter Server 側で project ごとに独立したカーネル状態を保つ。`paper.md` から cell ID を引用すれば Article V (Traceability) と整合。
- **科学計算スタックのプリインストール**: `numpy / pandas / scipy / scikit-learn / matplotlib / seaborn / sympy` を `pip install --no-cache-dir` で同梱。Dockerfile に `gfortran / libopenblas-dev / liblapack-dev` を追加(scipy / sklearn ビルド用)。image サイズ +1.5〜2 GB の想定。
- **新規 / 既存プロジェクトの差別化シード**: `seedBuiltinMcpForProject` に `isNewProject` オプションを追加。各 built-in に `enabledForExisting` フラグを追加し、`jupyter` のみ `enabledForExisting: false`。**既存 (v2.x) プロジェクトでは disabled で seed**、**v3.0.0 以降に作成されたプロジェクトでは enabled で seed**。これにより既存ワークフローへの突然の挙動変化を回避し、ユーザは明示的に有効化することで移行できる。
- **Preflight に jupyter / jupyter-mcp-server の存在チェックを追加**: 失敗時は warn ログのみで起動継続(Jupyter MCP が無効になるだけ)。

### Fixed
- (なし — 純機能追加)

### Tests
- 新規 backend 11 ケース:
  - `config/paths.test.ts` (3): `getNotebookPath` の戻り値 / `getWorkspaceDir` との一貫性 / 他 path helper の安定性
  - `services/jupyter-server.test.ts` (3): 起動前は url/token が null、test helper で state 設定、reset で clear
  - `routes/mcp.test.ts` (5): jupyter ビルトインが既存 project では disabled / 新規 project では enabled / 他 built-in は両方 enabled / Jupyter Server 停止時は temp config から jupyter エントリ省略 / Jupyter 起動時は env と --notebook-path が注入され notebook.ipynb が自動生成
- **22 backend test files / 192 tests + 21 frontend tests all green** (3 連続実行で flake なし)。

### Migration notes
- 既存 v2.x プロジェクトでは jupyter ビルトインが **disabled** で seed される。利用するには Settings → MCP → jupyter の "Enabled" トグルを ON にする。
- Docker image サイズが +1.5〜2 GB(現 3.21 GB → 約 5 GB)。registry / pull 帯域への影響注意。
- 既存 DB のスキーマ変更は無し(v2.6.0 で導入した CHECK 拡張のみ)。

### 次の v3.0.1 で予定
- Co-Scientist スキル文書を notebook-first に書き換え(現状は "Python script を書いて実行" パターンが残っている)
- カーネル idle stop / scavenge(現状は AIRA 終了時にしか止まらない)
- env allowlist の厳格化(セキュリティ監査 M3)— サブプロセスへの `process.env` 全継承をやめる

## [v2.7.2] — 2026-05-30

### Added
- **MCP サーバー設定の編集機能**: 一度作成した MCP config を Settings → MCP の各行から「Edit」できるようになった。name / command / args / url / description / env / headers が編集可能。type は固定(変更したい場合は再作成)。
  - 既存の secret(env / headers 値)はサーバから '***' でマスクされて返ってくるため、編集フォームでは placeholder="(未変更)" を表示し**入力欄を空のままにしたキーは PATCH に含めない** → サーバ側で既存値が保持される。
  - 各エントリは個別に値の差し替え / 削除(↶ で取り消し)/ 新規追加が可能。`***` を生で送ると `MaskedValueError` で 400 を返す。
  - ビルトイン MCP も Edit 可(env を後付けしたいケースで便利)。Delete は引き続き非ビルトインのみ。

### Fixed
- **新規 DB で MCP config の PATCH が常に 500 を返していたバグ**: `project_mcp_configs` テーブルの CREATE 文に `updated_at` カラムが無いのに `mcp.service.ts:update()` がそこへ書き込もうとしていた。`v2.6.0` のテーブル再作成パス(古い CHECK 制約のとき)を通る DB だけ偶然動いていた状態。
  - スキーマに `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` を追加。
  - 既存 DB 用に `ALTER TABLE ... ADD COLUMN updated_at` + `created_at` 値で backfill するマイグレーションを追加。
  - Edit UI を導入したことで初めて表面化したバグ(v2.7.1 までは UI から PATCH を叩く経路がなかった)。

### Tests
- 新規 backend 6 ケース: `routes/mcp.test.ts` の PATCH セクション(name 更新 / description 更新 / env の omit/null/string semantics / `***` 拒否 / headers semantics / enabled toggle)。
- 181 backend + 21 frontend tests all green。

## [v2.7.1] — 2026-05-29

### Fixed
- **プロジェクト削除時にプロジェクトフォルダ `projects/<id>/` が残る不具合を修正**: `ProjectService.delete()` が `projects/<id>/workspace/` のみ削除し親ディレクトリを残していたため、削除を繰り返すと `projects/` 以下に空の孤児ディレクトリが蓄積していた(検証環境では 635 個に達していた)。`projects/<id>/` ごと `rm -rf` するよう修正。`/api/settings/clean-projects` で既存の孤児ディレクトリを一括除去可能。
  - `backend/src/services/project.service.ts:96-108`: 削除対象を `getWorkspacePath(id)` から `path.join(getProjectsDir(), id)` に変更。EBUSY / EPERM / EACCES → `ProjectLockedError` のエラー処理は維持。
  - 新規統合テスト `project.service.delete.test.ts` (3 ケース): 親ディレクトリの完全消去 / ディレクトリ事前消失時の冪等性 / 兄弟プロジェクトに影響しないこと。

### Tests
- 175 backend + 21 frontend tests all green.

## [v2.7.0] — 2026-05-29

### Removed
- **モデル選択 UI を撤去し Copilot CLI のデフォルトルーティング(旧 "Auto")に一本化**: チャット入力欄の上にあったモデルセレクタを削除。Copilot CLI 1.0.54 にはモデル一覧を取得する公開 API が無く(`--list-models` / `models` 共に未提供)、フロントエンドが持っていた `LLM_MODELS` 配列は最新カタログから乖離していた(`o3` / `o4-mini` / `gpt-4.1-mini` は存在しない、`claude-opus-4.7` / `claude-sonnet-4.6` / `claude-haiku-4-5` / `gpt-5` 系などは欠落)。これ以降は CLI 側のプラン別ルーティングをそのまま尊重する。
  - `frontend/src/stores/preferences.ts`: `LLM_MODELS` 定数 / `LlmModelId` 型 / `model` / `setModel` / `loadModel` を削除。
  - `frontend/src/components/chat/ChatPane.tsx`: モデル `<select>` JSX と関連 state を削除。入力欄の縦スペースが確保される。
  - `frontend/src/stores/chat.ts`: WS メッセージから `model` フィールドを削除(常に `undefined` = `--model` フラグ無しで CLI を起動)。
  - 旧 localStorage キー `aira-model` は読まれなくなるだけで削除も migration も不要。
  - 特定モデル固定で運用したい場合は `COPILOT_MODEL` 環境変数で全体一律指定が引き続き可能。
- 正味 -50 行のリファクタ。テスト 172 backend + 21 frontend すべて green、Vite production build OK。

## [v2.6.0] — 2026-05-29

### Added

- **MCP の streamable HTTP transport (`type: "http"`) をサポート**: 既存の `stdio` / `sse` に加えて `http` を選べるようになり、Datalayer 製 jupyter-mcp-server のようなストリーマブル HTTP の MCP サーバーや HTTPS エンドポイントの外部 MCP に直接接続できる。
  - DB: `project_mcp_configs.type` の CHECK 制約に `'http'` を追加。既存 DB は起動時に `sqlite_master.sql` を見て自動マイグレーション(テーブル再作成 + 行コピー、`builtin` カラムの有無は両対応)。
  - Service / Route: 型ユニオンと zod enum を 3 値に拡張。MCP config の `headers` 値は引き続き `getSecretsForRedaction` の対象なのでログ漏れ防止が効く。
  - Frontend: Settings → MCP の Add フォームに `http` 選択肢を追加。URL 入力は `sse` と共通。
  - Copilot CLI 互換: `generateTempConfig` は `type: "http"` を素通しで MCP 設定 JSON に書き出し、CLI 側で streamable-HTTP transport として接続される。

### Tests
- 新規 9 ケース追加 (mcp.service +3 / routes/mcp +5 / db/migration +1)。マイグレーション往復(旧 DB → 新スキーマ → `http` 受理 + 旧データ保持)を含めて 172 backend + 21 frontend テストすべて green。

## [v2.5.1] — 2026-05-29

### Security

ベースラインセキュリティ監査で発見された High 級脆弱性 6 件をまとめて修正。

- **C1+H2 — Docker (serve-frontend) モードの CSRF / CSWSH 防御を強化**: 旧実装では `AIRA_SERVE_FRONTEND=true` 時に Origin 検証と CORS の allowlist を完全にバイパスしており、cross-origin 攻撃者が `/api/csrf-token` を読み出して任意の状態変更 API を叩けたほか、WebSocket への cross-origin 接続も可能だった。Origin allowlist に加えて **Same-Origin (Origin host == request Host)** 判定を導入し、ブラウザが偽造できない Host ヘッダと一致しない限り拒否。`isOriginAllowed` は WS Upgrade と共有。
- **H1 — Agents repo URL 経由のトークン漏洩を遮断**: 任意ホストの URL を登録すると `GITHUB_TOKEN` が basic-auth として送信されていた。`github.com` (+ サブドメイン) と `AIRA_GITHUB_HOSTS` env で明示されたホストのみ token を URL に埋め込む。
- **H4 — Credential proxy に共有シークレット認証を導入**: `127.0.0.1:3001` に listen していた proxy をローカル任意プロセスから濫用される問題を修正。起動時に 256-bit hex シークレットを生成し、`X-AIRA-Proxy-Auth` ヘッダを timing-safe 比較。サブプロセスには `AIRA_PROXY_AUTH` env で配布。
- **H3 — CSRF token の TTL と件数上限を導入**: 旧実装は `Set` に無期限・無上限で蓄積されていた。`Map<token, expiresAt>` に変更し TTL 24h / 最大 10,000 件、超過時は FIFO で 10% を evict。`AIRA_CSRF_TTL_MS` / `AIRA_CSRF_MAX_TOKENS` で上書き可。
- **H5 — `GET /runs/:runId/prompt` のテナントスコープ修正**: URL の `:id` (projectId) を SQL に渡しておらず、任意プロジェクト URL から任意 runId の prompt を取得可能だった。`WHERE id = ? AND project_id = ?` に修正。
- **H6 — Upload エンドポイントのサイズ上限**: 旧実装は無制限で `arrayBuffer()` をメモリに読み込んでおり、巨大ファイルで OOM 可能だった。`File.size` をディスク書き込み前に判定し、per-file 100MB / total 500MB を超えたら 413。`AIRA_MAX_UPLOAD_FILE_BYTES` / `AIRA_MAX_UPLOAD_TOTAL_BYTES` で調整可。

### Tests
- 新規 24 ケース追加 (security 9 + agents-repo 7 + credential-proxy 5 + runs 3 + files 4 — 後者 4 ファイルは新規 test ファイル)。合計 163 backend + 21 frontend テストすべて green。

## [v2.5.0] — 2026-05-29

### Fixed
- **Co-Scientist 長時間タスクのタイムアウト修正**: 30〜90分の研究タスクが途中で停止する問題を解決
  - Copilot CLI の `--max-autopilot-continues` をデフォルト5から200に引き上げ
  - Time Budget を20分→60分（最大90分）に拡大、フェーズ別配分を再設計
  - 「Completion over speed」ルール追加 — フェーズ・成果物のスキップを禁止
- **ストリーミング応答の文字重複修正**: チャット応答が5重に重複表示される問題を修正
  - チャンクをブロードキャスト→ユニキャストに変更（送信元クライアントのみに配信）
  - WebSocket ping/pong ハートビート追加（30秒間隔）で切断済み接続を検出・除去

## [v2.4.1] — 2026-05-28

### Fixed
- **Co-Scientist paper.md 生成強制化**: paper.md が約35%の実験で未生成だった構造的問題を修正
  - Time Budget: 15分→20分、Paper writing 配分を2分→5分に増加
  - Quality Gates: paper.md の存在チェック、語数チェック（≥1,500語）、IMRaD構造チェックを追加
  - Research Lifecycle Phase 4: paper.md 生成を必須と明記（Single-Turn Mode 含む）
  - Required Output Layout: paper.md をレイアウトに追加
  - Co-Scientist バージョン: v4.4.0 → v4.5.0

## [v2.4.0] — 2026-05-27

### Added
- **マルチアーキテクチャ Docker イメージ**: linux/amd64 + linux/arm64 の両アーキテクチャに対応
  - GitHub Actions で QEMU + Buildx によるマルチプラットフォームビルド
  - `docker pull` 時にホストのアーキテクチャに合ったイメージが自動選択

### Fixed
- **設定画面のトークン管理**: 環境変数管理時のエラーハンドリング改善
  - トークンソースの表示（「環境変数で管理」バッジ）
  - 環境変数設定時は削除ボタン非表示
  - 設定/削除失敗時のエラーメッセージ表示
- **Docker ボリュームマウントパス修正**: `/app/backend/data` → `/app/data`、`/app/backend/projects` → `/app/projects`
- **Copilot CLI 永続化**: npm グローバルプレフィックスを `/app/.npm-global` に変更し、ボリュームマウントで更新を永続化可能に

## [v2.3.0] — 2026-05-24

### Changed
- **Co-Scientist スキル v5.0「引き算の改善」（v3.0.0）**: v4.0 の過剰設計を是正し v3.0 品質水準への回復を目指す
  - **スキル総行数 60%削減**: ~2,250行 → ~900行（コンテキストウィンドウ圧迫の解消）
  - **カスタムエージェント全削除**: research-lead, methods-auditor, statistician, data-steward, writing-coach の5体を削除
  - **Review 5段階→1回**: Deep Review（Phase 4 後）のみ残し、問題があれば1回修正
  - **Mandatory Skill Chain 削除**: 4スキル順次呼び出しを自然なフローに変更
  - **テンプレート大幅削減**: Reproducibility Table, Seed Propagation, Validation Plan, Ablation Variants, Report 5セクション強制を削除
  - **Claim Calibration 簡素化**: 8行テーブル → 1行の置換ルール
  - **Paper Quality Lint 簡素化**: 8チェック → 3チェック（Limitations, 語数, バルク引用）
  - **Repair Prompt 簡素化**: 6テンプレート → 1テンプレート（Limitations 補完のみ）
  - **Quality Gates 厳選**: 各スキル3項目のみ（Limitations 200語以上, report.md 1,000語以上, 不確実性指標）
  - **効果実証済み機能は維持**: Limitations リテラルスケルトン（100%維持）, バルク引用 Lint（2%達成）, 深さ優先原則

## [v2.2.0] — 2026-05-24

### Changed
- **Co-Scientist スキル v4.0 品質改善（v2.0.0）**: 3 層アプローチによる論文品質の抜本的改善
  - **Layer 1 — プロンプト直接注入**:
    - CI/± 必須フォーマット + few-shot 例（statistical-testing, academic-writing）
    - Phrase blacklist を HARD CONSTRAINT に強化（advisory → 強制）
    - Limitations リテラルスケルトン（自由記述 → 穴埋め方式）
    - report.md 最低 1,000 語、External Validation Statement 必須化
  - **Layer 2 — Post-processing Lint + Repair**:
    - Paper Quality Lint（Mode 3）: 8 項目の regex ベース形式チェック（L1–L8）
    - Repair Prompt Templates（RP-1〜RP-6）: Limitations / CI / 過大主張 / report 拡張 / 外部検証 / バルク引用分解
    - Severity 分類: Critical（進行禁止）/ Major（修正試行）/ Minor（記録のみ）
    - バルク引用 `[N-M]` 分解 linter + DOI-conditional metadata 戦略
  - **Layer 3 — ワークフロー再設計**:
    - Closed-loop review: PASS/FAIL/RETRY state machine（最大 2 回リトライ）
    - Reproducibility artifact propagation（seed-config.md → analysis → writing）
    - Ablation variant 自動生成 + Sensitivity analysis 必須化
    - Multi-seed execution protocol（5+ シード + Bootstrap CI）

### Added
- **フロントエンド自動リロード**: タブ復帰時のデータ自動更新、実行完了後のメッセージ再取得、WS file_modified イベントによるファイルビューア自動更新

## [v2.1.2] — 2026-05-24

### Changed
- **Co-Scientist スキル v3.0 品質改善**: v2.0 の 100 本実験分析に基づく 9 問題の系統的修正
  - Limitations and Future Work セクションの必須化（問題 1）
  - Hard Quality Gates による統計的不確実性の強制チェック（問題 2）
  - Claim Calibration の Automated Filter 化 — 禁止語スキャン + 主張-証拠整合性チェック（問題 3）
  - Validation Strategy Template（Tier 1-3）の追加（問題 4）
  - DOI ベース書誌情報検証 + メタデータ正規化ワークフロー（問題 5）
  - Ablation Study Design テンプレートの追加（問題 6）
  - Reproducibility Checklist の追加（問題 7）
  - report.md 構造化テンプレート（最低 1,200 語）の追加（問題 8）
  - 🦆 Phase Gate Reviews（5 段階）+ Deep Review ワークフローの組み込み（問題 9）
  - Mandatory Skill Chain による統計検定・不確実性定量化のスキップ防止
  - IMRaD テンプレートの更新（Limitations セクション、再現性情報、Ablation study）

## [v2.1.1] — 2026-05-22

### Fixed
- **SVG ファイル表示**: ファイルビューアで SVG ファイルをインライン表示可能に（CSP ヘッダーによる XSS 防止付き）

## [v2.1.0] — 2026-05-21

### Added
- **Structured RAG**: プロジェクト単位の知識抽出・検索機能（[TypeAgent](https://github.com/microsoft/typeagent) 参考）
  - LLM による会話・ファイルからのエンティティ・アクション・トピック抽出
  - トークンベース転置インデックスによる高速検索（SQLite 内蔵）
  - `rag-context.md` による検索結果の自動コンテキスト注入
  - プロジェクトごとの RAG 有効/無効設定、最大コンテキスト文字数設定
  - 手動再インデックス API
- **品質評価フレームワーク**: 400 の評価シナリオによる網羅的品質検証（20 ラウンド × 20 プロンプト）

### Fixed
- **セキュリティ修正**（14 件 HIGH）:
  - 静的ファイル配信のパス走査攻撃防止
  - MCP 設定のプロトタイプ汚染防止（トップレベル + ネスト）
  - JSON.parse の安全なエラーハンドリング（4 箇所）
  - Content-Disposition ヘッダーインジェクション防止
  - CLI ストリームの parseLine クラッシュ防止
  - hashFile の大容量ファイルメモリスパイク防止
  - startRun のレース条件修正（プレースホルダー予約方式）
  - プロジェクト ID の UUID バリデーションミドルウェア追加
- **安定性修正**（28 件 MEDIUM）:
  - stderr / stdout バッファ上限設定（64KB / 1MB）
  - ストリームエラーハンドラー追加
  - extractTokens 入力サイズ上限（100KB）
  - credential proxy 30 秒タイムアウト
  - scanWorkspace 深度制限（50 階層）
  - ファイル表示 5MB サイズ制限
  - アップロードファイル名検証（パス走査拒否、200 バイト長制限）
  - reindexProject の clearIndex 原子性修正
  - DB 破損時のグレースフルリカバリ（バックアップ + 再作成）
  - その他バッファ・バリデーション・エラーハンドリング改善
- **軽微な修正**（8 件 LOW）:
  - JSON パースログのレート制限
  - アップロードファイル名エッジケース対応

### Changed
- DB エンジンを better-sqlite3 から sql.js（WASM）に変更
- テストフレームワークの依存を sql.js ベースに統一

## [v2.0.4] — 2026-05-08

### Fixed
- ファイル検出パイプラインの 3 つのバグを修正（サブディレクトリファイルの表示、AI 応答テキストの重複防止）

## [v2.0.3] — 2026-05-08

### Fixed
- reconcile files on list to show all subdirectory files
- prevent AI response text duplication by separating resume/cold-start prompts

## [v2.0.2] — 2026-05-07

### Added
- **メッセージ送信オプション**: 設定画面から送信キーを選択可能
  - Enter キー（デフォルト）: Enter で送信、Shift+Enter で改行
  - Ctrl+Enter キー: Ctrl+Enter で送信、Enter で改行

## [v2.0.0] — 2026-05-07

### Added
- **外部 Agents リポジトリ連携**: Settings から複数の GitHub リポジトリを登録し、`agents/` ディレクトリ内のエージェントを Agent Skills として自動取得
  - 複数リポジトリのサポート
  - 同期ボタンによる手動更新
  - サーバー起動時の自動同期
  - Private リポジトリ対応（GitHub Token 認証）
- 日本語エラーメッセージ（リポジトリ不在、認証エラー時）

### Changed
- タイトルを AIRA-α → AIRA-β に変更
- skills テーブルに `github-agents` source_type を追加（DB 自動マイグレーション対応）

## [v1.0.0] — 2026-05-06

### Added
- **チャット UI**: WebSocket ストリーミング、Markdown レンダリング、ファイル添付
- **プロジェクト管理**: 作成・削除・名前変更、プロジェクト単位の設定管理
- **Agent Skills**: プロジェクトごとにスキルを割り当て・切替
  - Co-Scientist（189 サブスキル）: 文献調査、実験設計、データ分析、論文作成
  - SPReAD-1000 Assistant（12 サブスキル）: SPReAD 公募申請支援
- **MCP サーバー連携**: プロジェクトごとに MCP サーバーを設定
  - ToolUniverse（89 科学 DB）、Azure MCP、Microsoft Learn MCP
- **ファイル管理**: 生成ファイルの表示・ダウンロード（ZIP 一括）、PDF / Excel / 画像ビューア
- **ファイルアップロード**: 入力データのアップロード
- **実行履歴**: パイプライン進捗の可視化、プロンプト保存
- **PDF ビューア**: 出力ファイルの PDF インラインプレビュー
- **サイドバー**: プロジェクト名の下に割り当て済みスキル名を表示
- **3 層メタプロンプト**: 事実/推定/制約による高品質 LLM 出力
- **Settings**: GitHub Token 管理、Copilot CLI アップデート、言語切替（日/英）、テーマ切替
- **Docker**: マルチステージビルド、GHCR 公開

### Technical
- React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand 5
- Node.js 22 + Hono + SQLite (better-sqlite3, WAL)
- GitHub Copilot CLI エージェントエンジン
