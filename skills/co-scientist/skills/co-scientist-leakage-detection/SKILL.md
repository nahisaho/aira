---
name: co-scientist-leakage-detection
description: |
  Anomaly-first leakage detection skill. Treats near-perfect performance
  (AUROC / accuracy / F1 ≥ 0.99) as a symptom to investigate, not a result to
  celebrate, and runs a codified data-leakage audit covering feature-label
  circularity, train/test contamination, source-DB bias, temporal leakage, and
  feature proxies (Kapoor & Narayanan 2023).
  Use when a model scores suspiciously high, before reporting any classification
  or prediction metric, or when validating that an evaluation is trustworthy.
---

# Leakage Detection (Anomaly Detection First)

A skeptical, "non-sycophantic" review of model performance. A score that looks
too good is the single most common surface symptom of **data leakage** or a
**circular feature-label design** — audit it before you trust it.

## Use This Skill When

- A classifier / regressor reports AUROC, accuracy, F1, R², etc. **≥ 0.99**.
- Before writing any performance metric into `report.md` / `paper.md`.
- A reviewer or the provenance validator raised an *anomaly-first* advisory.
- Per-source positive rates look uneven, or features may encode the label.

## Principle ①: Anomaly Detection First

> High performance is a hypothesis to falsify, not a conclusion to report.

Apply these red-flag thresholds immediately after evaluation:

- **AUROC / AUPRC / accuracy / F1 ≥ 0.99** → suspect leakage or circular design.
- **Any single feature with |correlation to label| ≥ 0.95** → suspect a proxy.
- **Per-data-source positive rate > 0.95** → suspect source-DB bias (the model
  may be learning the *source*, not the *signal*).

When any red flag fires, **stop and run the leakage audit below** before
reporting the number.

## Principle ④: Codified Leakage Checklist (Kapoor & Narayanan 2023)

Check all five patterns. Each has a detection method and a worked example.

| # | Pattern | Detection method | Example |
|---|---------|------------------|---------|
| 1 | **Feature–label circularity** | Test feature⊥label independence; inspect whether a feature is derived from the label or its source | A "diagnosis_code" feature that was assigned *because of* the outcome |
| 2 | **Train/test contamination** | Verify split happens *before* any fit/scale/impute/feature-selection; check for duplicate rows across splits | `StandardScaler` fit on the full dataset before splitting |
| 3 | **Source-DB bias** | Per-source positive rate; stratified evaluation by source | Positives all drawn from DB-A, negatives from DB-B → model learns the DB |
| 4 | **Temporal leakage** | Confirm all features are knowable at prediction time; use time-ordered splits | Using a lab value recorded *after* the event being predicted |
| 5 | **Feature proxy** | Rank single-feature performance; flag any feature that alone reaches near-ceiling AUC | A near-perfect predictor that is really an ID or a post-hoc field |

## The Leakage Audit Cell

Produce one auditable cell. Its presence (and a passing run) is what clears the
anomaly-first advisory. Cite it next to the metric: `AUROC = 0.997 [cell:leakage-audit]`.

```python
# [cell:leakage-audit]
# Anomaly-first leakage audit. Run BEFORE trusting any metric >= 0.99.
import numpy as np, pandas as pd

LEAKAGE_FINDINGS = []  # (pattern, status, evidence)

# (1) Feature-label circularity / (5) feature proxy:
#     no single feature should solo-predict the label near-ceiling.
from sklearn.metrics import roc_auc_score
for col in X_train.columns:
    try:
        solo = roc_auc_score(y_train, X_train[col])
        if max(solo, 1 - solo) >= 0.95:
            LEAKAGE_FINDINGS.append(("feature_proxy", "FLAG", f"{col} solo AUC={solo:.3f}"))
    except Exception:
        pass

# (2) Train/test contamination: no row overlap across splits.
overlap = len(pd.merge(X_train, X_test, how="inner"))
LEAKAGE_FINDINGS.append(("train_test_overlap", "FLAG" if overlap else "OK", f"{overlap} shared rows"))

# (3) Source-DB bias: per-source positive rate should not be ~1.0.
if "source" in X_train.columns:
    rates = y_train.groupby(X_train["source"]).mean()
    biased = rates[rates > 0.95]
    LEAKAGE_FINDINGS.append(("source_bias", "FLAG" if len(biased) else "OK", rates.to_dict()))

# (4) Temporal leakage: assert every feature is knowable at prediction time.
#     Replace with the real check for this dataset.
LEAKAGE_FINDINGS.append(("temporal", "OK", "features confirmed pre-event"))

for pattern, status, evidence in LEAKAGE_FINDINGS:
    print(f"[{status}] {pattern}: {evidence}")
flags = [f for f in LEAKAGE_FINDINGS if f[1] == "FLAG"]
print("Leakage audit OK" if not flags else f"Leakage audit FOUND {len(flags)} issue(s)")
```

## Workflow

1. After evaluation, check the Principle ① red-flag thresholds.
2. If any fires, create and run `[cell:leakage-audit]` covering all five patterns.
3. Classify each pattern as OK / FLAG with concrete evidence.
4. For every FLAG: fix the design (re-split, drop the proxy, time-order, stratify) and re-evaluate — do **not** just relabel it as fine.
5. If the audit is genuinely clean, keep the cell and add a Limitations sentence stating which leakage classes were checked and why none apply.
6. Cite `[cell:leakage-audit]` next to every metric the audit covers.

## Deliverables

- `[cell:leakage-audit]` executed in the notebook with printed OK/FLAG lines.
- `results/leakage-audit.md` — the five-pattern table with status + evidence.
- A Limitations sentence naming the leakage classes checked.

## Quality Gates

- [ ] Every metric ≥ 0.99 has an accompanying `[cell:leakage-audit]` citation.
- [ ] All five patterns are marked OK or FLAG with evidence (none skipped).
- [ ] Every FLAG was fixed at the design level and the metric re-derived.
- [ ] Limitations states which leakage classes were audited.

## Gotchas

- A clean audit is not a guarantee — state the classes you checked, not "no leakage".
- Fixing a FLAG means changing the pipeline, not lowering the threshold.
- Do not optimise for "zero flags"; one honestly-documented residual risk beats a hidden one.
- Synthetic data can still leak (generator reuses the label) — audit it too.
