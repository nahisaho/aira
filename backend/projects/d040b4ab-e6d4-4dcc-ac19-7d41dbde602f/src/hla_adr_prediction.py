#!/usr/bin/env python3
"""Synthetic HLA-associated adverse drug reaction prediction workflow."""

from __future__ import annotations

import math
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("[WARN] xgboost not found - using GradientBoostingClassifier fallback.")

BASE_DIR = Path(__file__).resolve().parent.parent
FIG_DIR = BASE_DIR / "figures"
FIG_DIR.mkdir(parents=True, exist_ok=True)
SEED = 42
rng = np.random.default_rng(SEED)

POPULATIONS = ["East Asian", "European", "African", "Latino", "South Asian"]
ALLELES = ["HLA-B*15:02", "HLA-A*31:01", "HLA-B*57:01", "HLA-B*58:01"]
DRUGS = ["Carbamazepine", "Phenytoin", "Abacavir", "Allopurinol"]
POPULATION_WEIGHTS = np.array([0.24, 0.28, 0.18, 0.14, 0.16])
ALLELE_FREQ = {
    "East Asian": {"HLA-B*15:02": 0.085, "HLA-A*31:01": 0.040, "HLA-B*57:01": 0.012, "HLA-B*58:01": 0.095},
    "European": {"HLA-B*15:02": 0.010, "HLA-A*31:01": 0.055, "HLA-B*57:01": 0.062, "HLA-B*58:01": 0.018},
    "African": {"HLA-B*15:02": 0.008, "HLA-A*31:01": 0.020, "HLA-B*57:01": 0.028, "HLA-B*58:01": 0.040},
    "Latino": {"HLA-B*15:02": 0.022, "HLA-A*31:01": 0.038, "HLA-B*57:01": 0.025, "HLA-B*58:01": 0.028},
    "South Asian": {"HLA-B*15:02": 0.055, "HLA-A*31:01": 0.032, "HLA-B*57:01": 0.018, "HLA-B*58:01": 0.082},
}
DRUG_RISK_ALLELE = {
    "Carbamazepine": "HLA-B*15:02",
    "Phenytoin": "HLA-A*31:01",
    "Abacavir": "HLA-B*57:01",
    "Allopurinol": "HLA-B*58:01",
}
BASELINE_RISK = {
    "Carbamazepine": 0.018,
    "Phenytoin": 0.014,
    "Abacavir": 0.025,
    "Allopurinol": 0.020,
}
ALLELE_OR = {
    "Carbamazepine": 18.0,
    "Phenytoin": 7.0,
    "Abacavir": 24.0,
    "Allopurinol": 14.0,
}


def logit(p: float) -> float:
    return math.log(p / (1.0 - p))


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def haldane_odds_ratio(a: float, b: float, c: float, d: float) -> tuple[float, float, float]:
    a += 0.5
    b += 0.5
    c += 0.5
    d += 0.5
    or_value = (a * d) / (b * c)
    se = math.sqrt(1.0 / a + 1.0 / b + 1.0 / c + 1.0 / d)
    lo = math.exp(math.log(or_value) - 1.96 * se)
    hi = math.exp(math.log(or_value) + 1.96 * se)
    return or_value, lo, hi


def safe_div(num: float, den: float) -> float:
    return float(num / den) if den else 0.0


n_samples = 4000
population_idx = rng.choice(len(POPULATIONS), size=n_samples, p=POPULATION_WEIGHTS)
population_labels = np.array([POPULATIONS[i] for i in population_idx])
drug_idx = rng.choice(len(DRUGS), size=n_samples, p=[0.30, 0.20, 0.22, 0.28])
drug_labels = np.array([DRUGS[i] for i in drug_idx])
sex = rng.binomial(1, 0.54, size=n_samples)
age = np.clip(rng.normal(52, 16, size=n_samples), 18, 90)
renal_impairment = rng.binomial(1, 0.18, size=n_samples)
polypharmacy = rng.poisson(2.2, size=n_samples)

allele_matrix = np.zeros((n_samples, len(ALLELES)), dtype=int)
for i, pop in enumerate(population_labels):
    for j, allele in enumerate(ALLELES):
        allele_matrix[i, j] = rng.binomial(1, ALLELE_FREQ[pop][allele])

log_odds = np.zeros(n_samples)
for i, drug in enumerate(drug_labels):
    allele_name = DRUG_RISK_ALLELE[drug]
    allele_value = allele_matrix[i, ALLELES.index(allele_name)]
    score = logit(BASELINE_RISK[drug])
    score += math.log(ALLELE_OR[drug]) * allele_value
    score += 0.012 * (age[i] - 50)
    score += 0.20 * renal_impairment[i]
    score += 0.09 * polypharmacy[i]
    score += 0.08 * sex[i]
    if population_labels[i] in {"East Asian", "South Asian"} and drug in {"Carbamazepine", "Allopurinol"}:
        score += 0.15
    log_odds[i] = score

probabilities = sigmoid(log_odds)
y = rng.binomial(1, probabilities)

pop_one_hot = np.eye(len(POPULATIONS))[population_idx]
drug_one_hot = np.eye(len(DRUGS))[drug_idx]
X = np.column_stack([
    age,
    sex,
    renal_impairment,
    polypharmacy,
    allele_matrix,
    pop_one_hot,
    drug_one_hot,
]).astype(float)

feature_names = (
    ["age", "sex_female", "renal_impairment", "polypharmacy"]
    + ALLELES
    + [f"POP::{p}" for p in POPULATIONS]
    + [f"DRUG::{d}" for d in DRUGS]
)

X_train, X_test, y_train, y_test, prob_train_true, prob_test_true, drug_train, drug_test = train_test_split(
    X, y, probabilities, drug_labels, test_size=0.25, random_state=SEED, stratify=y
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

if XGBOOST_AVAILABLE:
    model = xgb.XGBClassifier(
        n_estimators=180,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="logloss",
        random_state=SEED,
    )
    model_name = "XGBoost"
else:
    model = GradientBoostingClassifier(random_state=SEED)
    model_name = "GradientBoosting"

model.fit(X_train_scaled, y_train)
y_score = model.predict_proba(X_test_scaled)[:, 1]
threshold = 0.25
y_pred = (y_score >= threshold).astype(int)

auroc = roc_auc_score(y_test, y_score)
auprc = average_precision_score(y_test, y_score)
cm = confusion_matrix(y_test, y_pred)

tn, fp, fn, tp = cm.ravel()
accuracy = safe_div(tp + tn, tp + tn + fp + fn)
sensitivity = safe_div(tp, tp + fn)
specificity = safe_div(tn, tn + fp)
ppv = safe_div(tp, tp + fp)
npv = safe_div(tn, tn + fn)

observed_freq = {pop: {} for pop in POPULATIONS}
for pop in POPULATIONS:
    mask = population_labels == pop
    for allele_index, allele in enumerate(ALLELES):
        observed_freq[pop][allele] = allele_matrix[mask, allele_index].mean()

odds_ratio_rows = []
for drug in DRUGS:
    allele = DRUG_RISK_ALLELE[drug]
    allele_col = ALLELES.index(allele)
    mask = drug_labels == drug
    cases = y[mask] == 1
    controls = y[mask] == 0
    carriers = allele_matrix[mask, allele_col] == 1
    noncarriers = ~carriers
    a = np.sum(cases & carriers)
    b = np.sum(controls & carriers)
    c = np.sum(cases & noncarriers)
    d = np.sum(controls & noncarriers)
    or_value, lo, hi = haldane_odds_ratio(a, b, c, d)
    odds_ratio_rows.append((drug, allele, or_value, lo, hi, int(a), int(b), int(c), int(d)))

screening_metrics = []
for drug in DRUGS:
    allele = DRUG_RISK_ALLELE[drug]
    allele_col = ALLELES.index(allele)
    mask = drug_labels == drug
    truth = y[mask]
    screen = allele_matrix[mask, allele_col]
    tn_s, fp_s, fn_s, tp_s = confusion_matrix(truth, screen, labels=[0, 1]).ravel()
    screening_metrics.append(
        (
            drug,
            safe_div(tp_s, tp_s + fn_s),
            safe_div(tn_s, tn_s + fp_s),
            safe_div(tp_s, tp_s + fp_s),
            safe_div(tn_s, tn_s + fn_s),
        )
    )

print(f"Synthetic cohort size: {n_samples}")
print(f"Feature matrix shape: {X.shape}")
print(f"Model used: {model_name}")
print(f"Observed ADR prevalence: {y.mean():.4f}")
print(f"Test AUROC: {auroc:.4f}")
print(f"Test AUPRC: {auprc:.4f}")
print(f"Accuracy: {accuracy:.4f}")
print(f"Sensitivity: {sensitivity:.4f}")
print(f"Specificity: {specificity:.4f}")
print(f"PPV: {ppv:.4f}")
print(f"NPV: {npv:.4f}")
print("\nOdds ratios for drug-associated HLA alleles:")
for drug, allele, or_value, lo, hi, a, b, c, d in odds_ratio_rows:
    print(
        f"  {drug:<13} {allele:<12} OR={or_value:>7.2f} "
        f"95% CI [{lo:>6.2f}, {hi:>6.2f}] counts=({a},{b},{c},{d})"
    )
print("\nScreening performance by drug:")
for drug, sens, spec, prec, negpred in screening_metrics:
    print(
        f"  {drug:<13} sensitivity={sens:>.3f} specificity={spec:>.3f} "
        f"PPV={prec:>.3f} NPV={negpred:>.3f}"
    )

# Figure 1: odds ratios
plt.figure(figsize=(10, 5))
x_pos = np.arange(len(odds_ratio_rows))
or_values = np.array([row[2] for row in odds_ratio_rows])
ci_low = np.array([row[3] for row in odds_ratio_rows])
ci_high = np.array([row[4] for row in odds_ratio_rows])
labels = [f"{row[0]}\n{row[1]}" for row in odds_ratio_rows]
plt.bar(x_pos, or_values, color=["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"])
plt.errorbar(x_pos, or_values, yerr=[or_values - ci_low, ci_high - or_values], fmt="none", ecolor="black", capsize=5)
plt.axhline(1.0, color="red", linestyle="--", linewidth=1)
plt.xticks(x_pos, labels)
plt.ylabel("Odds ratio")
plt.title("HLA-associated ADR odds ratios by drug")
plt.tight_layout()
plt.savefig(FIG_DIR / "hla_adr_odds_ratios.png", dpi=150)
plt.close()

# Figure 2: screening performance
metric_names = ["Sensitivity", "Specificity", "PPV", "NPV"]
metric_matrix = np.array([[row[1], row[2], row[3], row[4]] for row in screening_metrics])
plt.figure(figsize=(11, 5))
width = 0.18
positions = np.arange(len(DRUGS))
colors = ["#2563eb", "#059669", "#d97706", "#7c3aed"]
for idx, metric in enumerate(metric_names):
    plt.bar(positions + (idx - 1.5) * width, metric_matrix[:, idx], width=width, label=metric, color=colors[idx])
plt.xticks(positions, DRUGS)
plt.ylim(0, 1.05)
plt.ylabel("Performance")
plt.title("Rule-based HLA screening performance")
plt.legend()
plt.tight_layout()
plt.savefig(FIG_DIR / "hla_screening_performance.png", dpi=150)
plt.close()

# Figure 3: population frequencies
plt.figure(figsize=(11, 5))
width = 0.18
positions = np.arange(len(POPULATIONS))
for idx, allele in enumerate(ALLELES):
    values = [observed_freq[pop][allele] for pop in POPULATIONS]
    plt.bar(positions + (idx - 1.5) * width, values, width=width, label=allele)
plt.xticks(positions, POPULATIONS)
plt.ylabel("Carrier frequency")
plt.title("Observed HLA carrier frequencies across populations")
plt.legend()
plt.tight_layout()
plt.savefig(FIG_DIR / "hla_population_frequencies.png", dpi=150)
plt.close()

# Figure 4: confusion matrix
plt.figure(figsize=(5, 4))
plt.imshow(cm, cmap="Blues")
for i in range(2):
    for j in range(2):
        plt.text(j, i, cm[i, j], ha="center", va="center", color="black", fontsize=12)
plt.xticks([0, 1], ["Pred 0", "Pred 1"])
plt.yticks([0, 1], ["True 0", "True 1"])
plt.title("ADR prediction confusion matrix")
plt.colorbar(label="Count")
plt.tight_layout()
plt.savefig(FIG_DIR / "hla_confusion_matrix.png", dpi=150)
plt.close()

print("\nSaved figures:")
for name in [
    "hla_adr_odds_ratios.png",
    "hla_screening_performance.png",
    "hla_population_frequencies.png",
    "hla_confusion_matrix.png",
]:
    print(f"  {FIG_DIR / name}")
