---
name: co-scientist-experimental-design
description: |
  Experimental design and protocol skill. DOE (Design of Experiments), power analysis,
  sample size calculation, randomization, control design, and protocol documentation.
  Use when DESIGNING experiments, calculating sample sizes, choosing factorial designs,
  planning randomization, or writing experimental protocols.
---

# Experimental Design

DOE, power analysis, sample size calculation, and protocol design.

## Use This Skill When

- Designing a new experiment or study.
- Calculating required sample size or statistical power.
- Choosing between factorial, fractional-factorial, or response surface designs.
- Designing controls and randomization strategies.
- Writing a formal experimental protocol.

## Workflow

1. Define experimental parameters:
   - Independent variables (factors) and levels
   - Dependent variables (responses)
   - Expected effect size and variance
   - Significance level (α) and power (1-β)

2. Select design type:
   - Full factorial / Fractional factorial / Plackett-Burman
   - Response surface (CCD, Box-Behnken)
   - Randomized block / Latin square
   - Sequential / Adaptive design

3. Calculate sample size and power

4. Generate protocol document:
   - Materials and equipment
   - Step-by-step procedure
   - Randomization plan
   - Data collection template
   - Safety considerations

5. Save design matrix and protocol to files

6. Design validation strategy:
   - Design internal validation (k-fold CV or hold-out)
   - Plan external validation if applicable
   - Design ablation study if ≥2 components

7. Synthetic data:
   - Document synthetic data assumptions and list limitations

Additional planning notes:
- Design appropriate validation strategy (internal + external if applicable).
- If ≥2 components, plan ablation study to measure each component's contribution.
- Record random seeds and data splits. Use consistent seeds across phases.
- If ablation is infeasible, perform sensitivity analysis (parameter perturbation, seed variation).

## Deliverables

- `report.md`: design summary and rationale.
- `results/design-matrix.csv`: experimental design matrix.
- `results/power-analysis.md`: sample size and power calculations.
- `results/protocol.md`: formal experimental protocol.
- Optional: `results/seed-config.md`: reproducibility configuration (seeds, splits, hardware).
- Optional: `results/validation-plan.md`: validation strategy notes.
- Optional: `results/ablation-variants.md`: ablation variant list.
- Optional: `results/sensitivity-analysis.md`: fallback robustness analysis when ablation is infeasible.

## Quality Gates

- [ ] Design type matches the research question.
- [ ] Randomization and control strategy documented.
- [ ] Validation strategy specified (internal validation at minimum).

## Gotchas

- Default to α=0.05 and power=0.80 unless the target field uses a different convention.
- Full factorial designs scale poorly; for 4+ factors, consider fractional designs.
- Do not propose an experiment without appropriate controls.
- If sample size is too small, revisit the detectable effect size rather than proceeding with an underpowered design.
