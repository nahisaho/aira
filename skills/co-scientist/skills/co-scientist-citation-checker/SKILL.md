---
name: co-scientist-citation-checker
description: |
  Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.
  Use when working with reference validation, doi verification, retraction detection.
tu_tools:
  - key: crossref
    name: Crossref
  - key: semantic_scholar
    name: Semantic Scholar
---

# Citation checking

Citation checking skill. Reference validation, DOI verification, retraction detection, citation consistency checking, and bibliography formatting compliance.

## Use This Skill When

- Reference validation.
- DOI verification.
- Retraction detection.
- Citation consistency checking.
- Bibliography formatting compliance.

## Required Inputs

- Research objective, decision target, or hypothesis.
- Available data, source constraints, and domain assumptions.
- Required outputs, success metrics, and deadline or reproducibility constraints.

## Workflow

1. 形式チェック:
   - 本文中の全 [N] が References に対応するか
   - References の全エントリが本文中で引用されているか
   - DOI があれば Crossref API で存在確認

2. 意味的対応チェック:
   - 各引用箇所で、引用が主張を裏付けているか検証
   - パターン検出:
     - ❌ "[1-5] have studied X" → 各文献の具体的貢献を記述すべき
     - ❌ "As shown in [3]" → 何が示されているか明記すべき
     - ✅ "Smith et al. [3] demonstrated that Y achieves Z% on dataset W"
   - 引用密度チェック: Introduction に引用が集中し Methods/Results に皆無は警告

3. ハルシネーション検出:
   - 著者名 + タイトル + 年 の組み合わせを Crossref/Semantic Scholar で検証
   - 検証不能な引用には ⚠️ マーク
   - 検証不能率が 20% を超えたら Quality Gate FAIL

4. DOI 付与・書誌情報検証:
   - 参考文献リストの各エントリに対し:
     1. Crossref API (`https://api.crossref.org/works?query=TITLE`) でタイトル検索
     2. 一致する論文が見つかった場合: DOI を付与し、巻号・ページ番号を正確な値に更新
     3. 一致しない場合: Semantic Scholar API でフォールバック検索
     4. どちらでも見つからない場合: ⚠️ マークを付与

5. メタデータ正規化:
   - 著者名: "Last, F.M." 形式に統一
   - 年: 括弧内に統一 "(2020)"
   - ジャーナル: イタリック体 "*Journal Name*"
   - DOI: 末尾に `https://doi.org/...` を追加

6. 検証不能率チェック:
   - 検証不能率 > 20%: Quality Gate FAIL
   - 検証不能率 > 10%: WARNING（手動確認推奨）

7. レポート生成:
   - 各引用の検証ステータス（verified / unverified / suspicious）
   - 意味的対応の問題箇所リスト
   - DOI 付与率と書誌情報修正箇所
   - `results/citation-report.md` に保存

8. Append citation check results to `logs/process-log.jsonl`.

## Bulk Citation Linter

### 検出対象

バルク引用パターン `[N-M]`（例: `[1-5]`, `[3–7]`）を検出し、個別引用に分解する。

### 検出 Regex

```text
\[(\d+)\s*[-–]\s*(\d+)\]
```

### 分解ルール

1. バルク引用を検出
2. 各引用番号に対応する参考文献を特定
3. 各文献の具体的貢献を1文で記述
4. 個別引用に置換

### 例

**Before（❌ バルク引用）**:
> Several studies [1-5] have explored deep learning for drug discovery.

**After（✅ 個別引用）**:
> Smith et al. [1] introduced graph neural networks for molecular property prediction, 
> while Jones et al. [2] extended this to multi-task learning. Chen et al. [3] proposed 
> attention-based mechanisms for compound-protein interaction, Lee et al. [4] demonstrated 
> transfer learning from large chemical databases, and Park et al. [5] provided a 
> comprehensive benchmark of molecular representation methods.

### 処理フロー

1. paper.md 内の全バルク引用を検出
2. 各引用の文脈を分析（Introduction, Methods, Discussion のどこで使われているか）
3. 該当する参考文献の主要貢献を特定
4. 個別引用への置換候補を生成
5. 置換結果を `results/citation-report.md` に記録

## DOI-Conditional Metadata Strategy

参考文献の書誌メタデータは、DOI の有無に基づいて詳細度を変える:

### DOI が取得できた場合（Full Metadata）

Crossref API から正確なメタデータを取得し、以下を全て記載:
```text
[N] Authors. "Title." *Journal*, vol. X, no. Y, pp. A-B, Year. DOI: https://doi.org/...
```

### DOI が取得できなかった場合（Minimal Metadata）

巻号・ページ番号を**推測して記載しない**。以下の最小情報のみ記載:
```text
[N] Authors. "Title." Year. [DOI not available]
```

### DOI 検索フロー

```text
1. タイトルで Crossref API 検索
   → 一致 → DOI + Full Metadata を採用
   → 不一致 → Step 2 へ

2. Semantic Scholar API でフォールバック検索
   → 一致 → DOI + Full Metadata を採用  
   → 不一致 → Step 3 へ

3. Minimal Metadata で記載 + ⚠️ マーク
```

### 検証レポート

`results/citation-report.md` に以下を追記:

| # | Reference | DOI Status | Metadata Level | Notes |
|---|-----------|-----------|---------------|-------|
| [1] | Smith et al. 2020 | ✅ Verified | Full | Crossref match |
| [2] | Jones et al. 2019 | ✅ Verified | Full | Semantic Scholar match |
| [3] | Chen et al. 2021 | ❌ Not found | Minimal | Title mismatch |

## Deliverables

- `report.md`: concise method, results, interpretation, and file inventory in the user's language.
- `results/`: structured outputs, metrics, model artifacts, or extracted findings.
- `figures/`: English-only charts, diagrams, or panels when visual output is needed.
- `data/`: processed or derived datasets when transformation occurs.

## Available Tools (MCP)

> External tools available via [ToolUniverse](https://github.com/mims-harvard/ToolUniverse) MCP server.
> Falls back to Python `requests` + public REST APIs when MCP is unavailable.

| Source | Tool | Description |
|--------|------|-------------|
| Crossref | `Crossref_search_works` | Crossref API |
| Crossref | `Crossref_get_work` | Crossref API |
| Semantic Scholar | `SemanticScholar_get_citations` | Semantic Scholar API |

## Quality Gates

- [ ] 本文中の全 [N] が References に対応している
- [ ] References の全エントリが本文中で引用されている
- [ ] バルク引用 [N-M] がない（各引用に個別の説明がある）
- [ ] 検証不能率が 20% 以下である
- [ ] DOI が付与可能な全参考文献に DOI が付与されている
- [ ] 書誌メタデータ（著者名、年、巻号）が正規化されている
- [ ] **バルク引用 [N-M] が全て個別引用に分解されている**
- [ ] **DOI 付与率が 70% 以上である（検証可能な参考文献のうち）**
- [ ] **DOI が取得できない参考文献は Minimal Metadata で記載されている（巻号推測なし）**
- [ ] Outputs are reproducible, saved to files, and traceable from inputs to conclusions
- [ ] `report.md` and `logs/process-log.jsonl` reference the generated artifacts
- [ ] No essential result remains chat-only

If any gate fails: identify the specific failing check, fix the issue, and re-validate before proceeding.

## Gotchas

- Citation style varies by journal (author-year vs numbered). Confirm target format before writing
- Claims in Discussion must trace back to specific Results. Do not introduce new data in Discussion
- Supplementary materials must be self-contained with their own figure/table numbering
- **DOI が不明な場合は巻号・ページ番号を省略し、タイトルと著者のみ記載すること。不正確なメタデータを推測して記載するより、省略する方が望ましい**
- **バルク引用 [N-M] は査読で指摘される典型的な問題。各文献の個別の貢献を明記すること**
- **DOI が見つからない場合、巻号やページ番号を推測して記載してはならない。不正確なメタデータは省略より悪い**
- **Crossref API 検索は完全一致でなくても関連性スコアで判定する。スコアが低い場合は手動確認を推奨すること**
- **Crossref API はレート制限あり（polite pool: mailto ヘッダー付きで50req/s）。バッチ処理時は適切な間隔を設けること**

## Validation Loop

1. Execute analysis and generate outputs
2. Check:
   - Method selection matches the research question and stated assumptions
   - All outputs are saved to files (no chat-only results)
   - Limitations and uncertainty are explicitly stated
   - `logs/process-log.jsonl` is updated with execution trace
3. If any check fails:
   - Identify the failing gate
   - Fix the specific issue
   - Re-run validation
4. Proceed only after all gates pass
