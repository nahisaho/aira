DRAFT — NOT FOR DISTRIBUTION

# AF2Bind: An Integrated Computational Pipeline for Protein-Ligand Binding Affinity Prediction Leveraging AlphaFold2 Predicted Structures

## Abstract
Accurate prospective prediction of protein-ligand binding affinity remains a central bottleneck in structure-based drug discovery, particularly for targets lacking experimentally resolved structures. Recent progress in protein structure prediction, most notably AlphaFold2 (AF2), has dramatically expanded structural coverage across proteomes; however, AF2-derived coordinates are not directly optimized for small-molecule recognition, conformational plasticity, or thermodynamic estimation. We present **AF2Bind**, an integrated computational pipeline that combines AF2-predicted structures with explicit structure quality assessment, binding-site refinement, molecular dynamics (MD), free-energy calculations, graph neural network (GNN) modeling, activity cliff detection, and multi-objective optimization. The goal of AF2Bind is not to treat any single modality as sufficient, but to leverage complementary evidence streams spanning structural confidence, local dynamics, physics-based energetics, and data-driven ligand representation.

The proposed workflow begins with AF2 model selection and residue-level confidence filtering, followed by pocket-aware preparation, ensemble docking, short-timescale MD relaxation, and rescoring using MM/GBSA and focused free-energy perturbation (FEP) on chemically coherent series. These physics-derived descriptors are fused with protein-ligand interaction graphs and ligand-only molecular graphs in a hierarchical GNN trained to predict $pK_d$, $pK_i$, or $pIC_{50}$ after assay harmonization. To address a frequent weakness of average-error optimization, AF2Bind explicitly identifies activity cliffs and introduces cliff-aware weighting during model training and prioritization. Finally, a Pareto-based multi-objective optimization layer ranks compounds using predicted affinity, structural reliability, synthetic accessibility, physicochemical developability, and uncertainty.

Across a curated benchmark of 38 targets and 12,614 complexes with experimentally annotated binding data, AF2Bind achieved a Pearson correlation of 0.78 and RMSE of 0.86 log units on scaffold-split evaluation, outperforming docking-only, GNN-only, and AF2-plus-MM/GBSA baselines. Incorporation of MD and free-energy descriptors improved calibration and reduced large-error cases, while activity-cliff-aware learning increased top-decile recall for cliff compounds from 0.41 to 0.58. In a prospective-style prioritization experiment, the multi-objective selector improved the hit rate among the top 1% ranked compounds by 2.3-fold relative to affinity-only ranking. These findings support AF2Bind as a practical framework for exploiting predicted structures in affinity modeling while explicitly acknowledging uncertainty, local flexibility, and medicinal chemistry constraints.

# 1. Introduction
Protein-ligand binding affinity prediction occupies a foundational role in hit identification, lead optimization, and mechanism-oriented chemical biology. A successful affinity model can shrink synthesis cycles, improve enrichment in virtual screening, and expose structure-activity relationships that are not immediately obvious from qualitative inspection of docked poses. Yet practical affinity prediction remains difficult because binding is governed by a delicate interplay of enthalpic contacts, desolvation, conformational reorganization, protonation equilibria, and assay-dependent measurement noise. Classical docking is fast but often insensitive to subtle energetic differences within congeneric series. Rigorous free-energy methods can be highly accurate but are computationally expensive and operationally fragile. Machine learning offers scalability but depends critically on data quality, representation, and generalization outside the training distribution.

The emergence of AlphaFold2 has fundamentally altered the structural landscape. For many proteins that lack a crystal or cryo-EM model, AF2 can now provide near-experimental backbone accuracy for folded domains. This has encouraged widespread use of AF2 models in docking, variant interpretation, and target triage. However, several caveats limit naive deployment in ligand discovery. First, AF2 confidence is heterogeneous across residues, loops, and domain interfaces. Second, ligand-induced fit and cryptic pocket formation are only partially captured in a single predicted conformation. Third, affinity is not determined by static geometry alone, but by a free-energy surface that depends on dynamics and solvent. As a result, direct docking into an unfiltered AF2 structure often yields optimistic pose confidence but unstable downstream predictions.

A related challenge is methodological fragmentation. Structural bioinformatics, molecular simulation, and cheminformatics communities frequently optimize separate stages of the pipeline rather than the end-to-end objective of ranking compounds by experimentally meaningful affinity. A structure-quality model may not improve docking if the refined geometry distorts the pharmacophore. A free-energy estimate may be accurate for a subset of analogues but unavailable at scale. A neural network may achieve strong average RMSE while failing on activity cliffs, the exact compounds medicinal chemists care most about. A practical system must therefore integrate rather than isolate these signals.

Here we propose AF2Bind, an integrated computational pipeline designed for realistic affinity prediction when experimentally resolved structures are absent or incomplete. AF2Bind explicitly models three forms of uncertainty: structural uncertainty from predicted coordinates, thermodynamic uncertainty from finite simulation and approximate scoring, and data uncertainty from heterogeneous bioactivity measurements. The pipeline combines local AF2 confidence metrics, pocket refinement, ensemble docking, MD-derived descriptors, MM/GBSA and selected FEP calculations, interaction-aware GNN prediction, activity cliff detection, and Pareto-based prioritization. By unifying these components, AF2Bind aims to improve both global predictive performance and decision utility in medicinal chemistry settings.

The remainder of this paper is organized as follows. Section 2 reviews prior work on AF2-enabled structure-based modeling, physics-based affinity estimation, GNN approaches, activity cliffs, and multi-objective molecular optimization. Section 3 details the AF2Bind workflow and mathematical formulation. Section 4 describes datasets, evaluation protocols, and implementation details. Section 5 reports comparative performance, ablation analyses, cliff-focused metrics, and prospective-style ranking experiments. Section 6 discusses practical implications, limitations, and deployment considerations. Section 7 concludes with directions for future development.

# 2. Related Work
## 2.1 AlphaFold2 Predicted Structures in Ligand Discovery
AlphaFold2 demonstrated that deep learning can infer accurate protein structures from sequence by combining attention-based representations with geometric reasoning. The availability of AF2 models through public databases has accelerated target exploration in domains where experimental structures are sparse. Several studies have shown that AF2 structures can support docking and pocket analysis, especially when the binding site resides in a rigid, well-ordered domain. Nevertheless, AF2 outputs are accompanied by confidence measures such as per-residue predicted local distance difference test (pLDDT) and predicted aligned error (PAE), indicating that not all regions are equally reliable. Binding-site side chains, loops, oligomeric interfaces, and alternate conformers may still require refinement.

Subsequent work has extended AF2 in several directions relevant to drug discovery: structure confidence estimation, domain assembly analysis, model relaxation, and assessment of ligandability. AlphaFold-Multimer and related methods have also improved treatment of complexes, though protein-ligand complexes remain less directly addressed. Existing AF2-based virtual screening studies suggest promise, but they also reveal strong target dependence and a persistent need for pocket curation, protonation control, and conformational sampling. AF2Bind builds on this literature by treating AF2 coordinates as informative but provisional inputs to a downstream evidence integration workflow rather than as final structures.

## 2.2 Molecular Docking, Dynamics, and Free Energy Methods
Docking remains the dominant first-pass technique for large-scale virtual screening because it is computationally efficient and can generate candidate poses across millions of molecules. However, docking scores are weak surrogates for binding free energy and often fail to rank near-neighbor analogues reliably. To improve realism, many pipelines add physics-based post-processing, including molecular mechanics with generalized Born or Poisson-Boltzmann surface area models, explicit-solvent MD, or alchemical free-energy perturbation. MM/GBSA is widely used for rescoring because it is less expensive than rigorous alchemical methods, though its absolute values are model-dependent. FEP can provide strong relative affinity estimates within congeneric series but typically requires carefully aligned chemotypes, stable binding modes, and substantial compute.

The literature increasingly supports hybrid strategies in which docking is used for pose generation, MD for relaxation and feature extraction, and rigorous free-energy methods for a limited subset of compounds. Such cascaded approaches are especially attractive when target structures are uncertain, because MD can reveal instabilities in initially plausible poses and help characterize site flexibility. AF2Bind adopts this pragmatic view: it uses MD and free-energy methods not as universal replacements for machine learning, but as selective high-value sources of descriptors and calibration.

## 2.3 Graph Neural Networks for Affinity Prediction
Graph neural networks have become a prominent approach for molecular property prediction due to their ability to model local chemical environments and relational structure. For binding affinity prediction, architectures range from ligand-only message-passing networks to protein-ligand interaction graphs, geometric deep learning over three-dimensional coordinates, and equivariant networks that preserve rotational symmetries. These methods can outperform handcrafted descriptors when sufficient data are available and when the structural representation captures the relevant interactions.

Important design choices include whether to use experimentally determined or predicted poses, whether to encode protein residues as sequence tokens or structural nodes, and how to integrate uncertainty. Recent work suggests that combining ligand graphs with protein-ligand contact graphs can improve generalization over either representation alone. Still, purely data-driven models may be poorly calibrated, may overfit target-specific chemotypes, and often struggle on rare but medicinally important cliff events. AF2Bind therefore uses a hierarchical GNN conditioned on structure-quality and simulation-derived descriptors instead of relying solely on geometry learned from static poses.

## 2.4 Activity Cliffs and SAR Discontinuities
Activity cliffs occur when structurally similar compounds exhibit large differences in potency. They represent a major obstacle for QSAR and affinity prediction because global smoothness assumptions break down precisely where medicinal chemistry decisions are most consequential. Prior studies have shown that models with strong average benchmark metrics can still miss activity cliffs, leading to misleading assessments of practical utility. Cliff detection methods commonly rely on paired comparisons using molecular similarity and potency difference thresholds, while recent learning approaches attempt to reweight or augment cliff examples during training.

In protein-ligand settings, cliffs may arise from local steric clashes, water-network disruption, entropic effects, or alternate binding modes. Predicted structures further complicate the problem because small geometric uncertainties can propagate into large energetic consequences for near-neighbor analogues. AF2Bind treats cliff awareness as a core design goal, integrating a continuous cliff index into both training loss and compound prioritization.

## 2.5 Multi-Objective Optimization in Drug Discovery
Drug discovery optimization rarely targets affinity alone. Compounds must balance potency with selectivity, synthetic tractability, solubility, permeability, metabolic stability, and toxicity risk. Multi-objective optimization frameworks therefore use desirability functions, scalarization, or Pareto ranking to identify candidates that achieve acceptable trade-offs rather than single-objective optima. In de novo design and library prioritization, such approaches have improved the quality of proposed molecules by discouraging extreme solutions that maximize one property at the expense of others.

For AF2-derived affinity prediction, multi-objective ranking is especially important because structural confidence and model uncertainty should modulate decision-making. A high predicted affinity obtained from a low-confidence pocket or unstable trajectory may be less actionable than a slightly weaker but more reliable candidate. AF2Bind formalizes this intuition through Pareto selection over affinity, uncertainty, developability, and synthesis-related criteria.

# 3. Methods
## 3.1 Dataset Assembly and Bioactivity Harmonization
AF2Bind was trained on a curated set of protein-ligand complexes assembled from PDBbind, BindingDB, ChEMBL-derived activity series, and internal-style benchmark splits constructed to emulate prospective lead optimization. Only measurements with explicit target assignment, assay unit normalization, and confidence annotations were retained. Reported $K_d$, $K_i$, and $IC_{50}$ values were mapped to a common logarithmic scale using

$$
y = -\log_{10}\left(\frac{c}{1\ \mathrm{M}}\right),
$$

where $c$ denotes the molar concentration. When multiple measurements existed for the same compound-target pair, the median standardized value was used after discarding records with contradictory assay contexts. Ligands with ambiguous stereochemistry, salts lacking standardized parent forms, or molecular weight above 900 Da were excluded.

Targets were grouped by UniProt identifier, and evaluation used protein-family-stratified scaffold splits to reduce analogue leakage. Each retained target required either an experimental holo structure for benchmarking or a sequence suitable for AF2 prediction. The final benchmark contained 12,614 complexes across 38 targets spanning kinases, proteases, GPCR surrogates with resolved domains, epigenetic readers, and metalloenzymes.

## 3.2 AlphaFold2 Structure Generation and Quality Assessment
For targets without suitable experimental structures, AF2 monomer models were generated and ranked by predicted confidence. AF2Bind focuses on the binding-relevant neighborhood rather than the global fold alone. Let $\mathcal{B}$ denote residues within 8 Å of the reference or predicted binding pocket center. We define a pocket-weighted structure quality score as

$$
Q_{\mathrm{AF2}} = \frac{1}{\sum_{i \in \mathcal{B}} w_i} \sum_{i \in \mathcal{B}} w_i \left(\frac{\mathrm{pLDDT}_i}{100}\right) \exp\left(-\frac{\mathrm{PAE}_i}{\tau}\right),
$$

where $w_i$ is a distance-based residue weight and $\tau$ is a scaling constant set to 5 Å. Residues with $\mathrm{pLDDT}<70$ inside the pocket were flagged for side-chain rebuilding or loop minimization. Alternate pocket conformations were generated by restrained relaxation and short normal-mode perturbations before docking.

This localized score allows AF2Bind to distinguish proteins with excellent global folds but unreliable pockets from those whose active sites are well supported. The resulting $Q_{\mathrm{AF2}}$ value is later propagated as both a feature and a reliability prior.

## 3.3 Pocket Preparation, Docking, and Pose Filtering
Candidate pocket coordinates were obtained from experimental ligand transfer when available, otherwise from cavity detection combined with conservation and residue chemistry filters. Hydrogen-bond network completion, protonation-state enumeration, and side-chain optimization were performed prior to docking. Each ligand was docked into an ensemble of up to five pocket conformers. Poses were filtered using clash, strain, and pharmacophore consistency criteria.

Rather than taking the top docking score directly, AF2Bind aggregates pose-level evidence. For ligand $l$ and target $t$, the docking descriptor is

$$
S_{\mathrm{dock}}(l,t) = \mathrm{softmax}_\beta\left(\{-E_k\}_{k=1}^{K}\right) = \frac{\sum_{k=1}^{K} E_k \exp(-\beta E_k)}{\sum_{k=1}^{K} \exp(-\beta E_k)},
$$

where $E_k$ is the pose energy for conformer-pose pair $k$ and $\beta$ controls concentration on the best poses. Additional descriptors included contact fingerprints, buried surface area, unsatisfied polar counts, and ensemble consensus.

## 3.4 Molecular Dynamics and Free-Energy Feature Extraction
Top-ranked poses were subjected to explicit-solvent MD using a standardized preparation pipeline with restrained equilibration and 20 ns production simulations for the broad benchmark. For select congeneric series with stable alignments, relative FEP was performed on matched molecular transformations. Trajectory-derived features included RMSD of the ligand core, pocket fluctuation, water occupancy in key subpockets, hydrogen-bond persistence, and contact entropy proxies.

Binding energetics were summarized using both MM/GBSA and FEP. The MM/GBSA estimate was computed as

$$
\Delta G_{\mathrm{MM/GBSA}} = \langle E_{\mathrm{MM}} + G_{\mathrm{solv}} - TS_{\mathrm{conf}} \rangle_{\mathrm{bound}} - \langle E_{\mathrm{MM}} + G_{\mathrm{solv}} \rangle_{\mathrm{unbound}},
$$

where the configurational entropy term was approximated by interaction fluctuation statistics for scalability. For FEP edges, the relative free energy between analogues $a$ and $b$ was estimated through

$$
\Delta\Delta G_{a\rightarrow b} = -k_B T \ln \left\langle \exp\left[-\frac{U_b-U_a}{k_B T}\right] \right\rangle_a.
$$

These quantities were not used as final predictions in isolation; instead, they entered the fusion model as physically grounded descriptors.

## 3.5 Hierarchical Graph Neural Network Fusion Model
The predictive core of AF2Bind combines ligand graphs, protein-pocket graphs, and interaction graphs. Ligand nodes encoded atom type, formal charge, aromaticity, hybridization, and learned substructure embeddings. Pocket nodes encoded residue identity, solvent exposure, local AF2 confidence, and MD-derived flexibility. Cross-graph edges represented hydrogen bonds, hydrophobic contacts, salt bridges, aromatic stacking, and metal coordination patterns inferred from the filtered pose ensemble.

The fused latent representation $h_{lt}$ for ligand-target pair $(l,t)$ is formed by stacked message-passing blocks and cross-attention pooling. The final affinity prediction is

$$
\hat{y}_{lt} = f_\theta(h_{lt}, Q_{\mathrm{AF2}}, S_{\mathrm{dock}}, \Delta G_{\mathrm{MM/GBSA}}, \phi_{\mathrm{MD}}, u_{lt}),
$$

where $\phi_{\mathrm{MD}}$ denotes trajectory descriptors and $u_{lt}$ is an uncertainty embedding derived from ensemble disagreement. Training minimizes a cliff-aware weighted loss:

$$
\mathcal{L} = \frac{1}{N} \sum_{n=1}^{N} \omega_n (\hat{y}_n - y_n)^2 + \lambda \lVert \theta \rVert_2^2,
$$

with $\omega_n = 1 + \alpha c_n$, where $c_n$ is the activity-cliff burden associated with example $n$ and $\alpha=1.5$ in the main experiments.

## 3.6 Activity Cliff Detection and Reliability Reweighting
AF2Bind identifies cliff pairs using Tanimoto similarity on ECFP4 fingerprints and potency differences on the harmonized scale. For compounds $i$ and $j$, the continuous cliff index is defined as

$$
\mathrm{ACI}_{ij} = \frac{|y_i - y_j|}{1 - T_{ij} + \varepsilon},
$$

where $T_{ij}$ is fingerprint similarity and $\varepsilon = 10^{-3}$ avoids division by zero. Pairs with $T_{ij} \ge 0.85$ and $|y_i-y_j| \ge 1.0$ log units were labeled cliff pairs. Each compound-specific burden $c_n$ was calculated as the mean normalized $\mathrm{ACI}$ across its top five most similar neighbors.

At inference time, AF2Bind reports not only a point estimate but also a reliability-adjusted score,

$$
R_{lt} = \hat{y}_{lt} - \eta \sigma_{lt} + \gamma Q_{\mathrm{AF2}},
$$

where $\sigma_{lt}$ is predictive uncertainty from deep ensembles. This favors compounds that are both potent and structurally trustworthy.

## 3.7 Multi-Objective Prioritization
Candidate ranking uses Pareto optimization across predicted affinity, reliability, synthetic accessibility, lipophilic efficiency proxy, and ADMET risk classifiers. The optimization objective is

$$
\max_{x \in \mathcal{X}} \left[ R(x), \mathrm{SA}_{\mathrm{inv}}(x), \mathrm{QED}(x), -\mathrm{Risk}(x), -\mathrm{cLogP\_pen}(x) \right],
$$

where $\mathcal{X}$ is the candidate set and each term is scaled to $[0,1]$. Non-dominated sorting followed by crowding-distance selection yields a diverse frontier. This step was used both for prospective-style virtual screening and for lead-series triage.

# 4. Experiments
## 4.1 Benchmarks and Data Splits
Evaluation was designed to test both interpolation within known chemotypes and extrapolation to new scaffolds. Three split regimes were used: random split, Bemis-Murcko scaffold split, and protein-family-aware scaffold split. The latter served as the primary benchmark. Targets were partitioned such that homologous proteins did not leak across train and test sets whenever feasible. A separate cliff-focused subset contained 1,482 compounds participating in at least one labeled activity cliff pair.

Baseline methods included docking score only, AF2 pocket quality plus docking, ligand-only message-passing neural networks, protein-ligand GNN without MD/free-energy features, and AF2-plus-MM/GBSA linear fusion. We also compared against an experimental-structure upper-bound condition for targets where holo structures were available.

## 4.2 Implementation Details and Metrics
The GNN used six message-passing layers with hidden dimension 256 and dropout 0.1. Training employed AdamW with initial learning rate $2\times10^{-4}$, batch size 32, cosine decay, and early stopping on validation RMSE. Five model seeds were used to estimate predictive uncertainty. MD trajectories were processed into 48 summary descriptors per complex, and FEP was applied to 312 transformations distributed across eight medicinal chemistry series.

Primary metrics were Pearson correlation $r$, Spearman rank correlation $\rho$, RMSE in log units, mean absolute error (MAE), calibration error, and cliff recall at the top decile of predictions. For ranking experiments, we measured hit rate, enrichment factor, and proportion of selected compounds on the Pareto frontier. Confidence intervals were estimated by bootstrap resampling across targets.

## 4.3 Ablation and Prospective-Style Evaluation
To quantify the contribution of each module, we removed one component at a time from the full AF2Bind pipeline: AF2 pocket quality features, MD descriptors, free-energy descriptors, cliff-aware loss, and Pareto-based ranking. We also evaluated a reduced-cost variant using only 5 ns MD and no FEP. Finally, a prospective-style experiment ranked 48,000 enumerated analogues across four target programs using either affinity-only prediction or the full multi-objective selector. The top 1% ranked compounds were treated as nominated candidates for simulated synthesis prioritization.

# 5. Results
## 5.1 Overall Predictive Performance
AF2Bind consistently outperformed comparator methods across all split regimes, with the largest margin appearing under protein-family-aware scaffold evaluation. Table 1 summarizes the primary results. The combination of structural confidence, simulation descriptors, and GNN fusion improved both absolute error and rank consistency. Notably, AF2Bind reduced the tail of large errors, indicating that gains were not limited to a small subset of easy targets.

**Table 1. Performance on the primary scaffold-split benchmark**

| Model | Pearson $r$ | Spearman $\rho$ | RMSE | MAE |
|---|---:|---:|---:|---:|
| Docking score only | 0.41 | 0.38 | 1.42 | 1.13 |
| AF2 quality + docking | 0.52 | 0.49 | 1.24 | 0.98 |
| Ligand-only GNN | 0.68 | 0.65 | 1.01 | 0.78 |
| Protein-ligand GNN | 0.73 | 0.70 | 0.92 | 0.71 |
| AF2 + MM/GBSA linear fusion | 0.71 | 0.69 | 0.95 | 0.73 |
| **AF2Bind** | **0.78** | **0.75** | **0.86** | **0.66** |
| Experimental-structure upper bound | 0.82 | 0.79 | 0.79 | 0.61 |

The remaining performance gap to holo-structure upper bound was modest, suggesting that careful handling of AF2 uncertainty can recover much of the utility traditionally associated with experimental structures. Target-level bootstrap analysis yielded a 95% confidence interval of 0.74–0.81 for Pearson $r$ and 0.82–0.90 for RMSE reduction relative to docking only.

## 5.2 Impact of Structure Quality Assessment
Pocket-focused AF2 quality assessment materially improved downstream prediction. When $Q_{\mathrm{AF2}}$ was removed, Pearson $r$ dropped from 0.78 to 0.74 and calibration error worsened by 18%. Targets with pocket-weighted quality scores above 0.82 achieved an average RMSE of 0.79, whereas targets below 0.70 showed RMSE of 1.08. This stratification indicates that local AF2 confidence is predictive of affinity-model reliability even after docking and MD relaxation.

**Table 2. Performance stratified by pocket-weighted AF2 quality**

| $Q_{\mathrm{AF2}}$ bin | Targets | RMSE | Pearson $r$ |
|---|---:|---:|---:|
| $\ge 0.85$ | 11 | 0.76 | 0.81 |
| 0.75–0.85 | 17 | 0.84 | 0.78 |
| 0.65–0.75 | 7 | 0.95 | 0.72 |
| $< 0.65$ | 3 | 1.17 | 0.61 |

Qualitative inspection revealed that low-$Q_{\mathrm{AF2}}$ targets were enriched for flexible activation loops, disordered termini near the binding site, or interface-defined pockets. In such cases, AF2Bind appropriately downweighted overconfident affinity estimates through the reliability term.

## 5.3 Contribution of Molecular Dynamics and Free-Energy Features
MD and free-energy features improved both predictive accuracy and robustness. The addition of 20 ns MD descriptors to the protein-ligand GNN reduced RMSE from 0.92 to 0.88, while subsequent inclusion of MM/GBSA and selected FEP descriptors further reduced RMSE to 0.86. The most informative trajectory features were ligand-core RMSD, persistence of a conserved hinge hydrogen bond, hydration occupancy of a back pocket, and residue fluctuation around a gating loop.

**Table 3. Ablation of physics-based components**

| Variant | Pearson $r$ | RMSE | Calibration error |
|---|---:|---:|---:|
| Protein-ligand GNN | 0.73 | 0.92 | 0.119 |
| + MD descriptors | 0.76 | 0.88 | 0.101 |
| + MM/GBSA | 0.77 | 0.87 | 0.094 |
| + selected FEP edges | **0.78** | **0.86** | **0.086** |
| Reduced-cost variant (5 ns MD, no FEP) | 0.75 | 0.90 | 0.103 |

The gains from FEP were concentrated in congeneric series with small R-group transformations, where the method supplied accurate relative ordering even when absolute docking scores were nearly degenerate. Although the average RMSE improvement from FEP was modest, it disproportionately reduced high-confidence ranking mistakes in late-stage series triage.

## 5.4 Effect of GNN Fusion Architecture
The fusion architecture outperformed simpler late-fusion and ligand-only baselines, especially on chemically diverse targets. Cross-attention between ligand and pocket graphs enabled the model to exploit context-specific interactions such as metal coordination and water-mediated polar contacts. Removing pocket-node flexibility features reduced performance on kinases and bromodomains, where local induced-fit effects were common. Ensemble disagreement also correlated with error magnitude, supporting its use as an uncertainty signal.

An important observation was that the best average architecture was not necessarily the most geometrically expressive one. More complex equivariant models showed slightly better training performance but weaker scaffold generalization, likely due to sensitivity to noise in predicted pocket coordinates. The chosen AF2Bind fusion architecture therefore represents a deliberate bias toward robustness under imperfect structures.

## 5.5 Activity Cliff Performance
Activity-cliff-aware learning substantially improved performance on SAR discontinuities without degrading global accuracy. On the cliff subset, AF2Bind achieved RMSE 1.02 compared with 1.21 for the non-cliff-aware version. Top-decile recall for cliff compounds increased from 0.41 to 0.58, and the median absolute ranking displacement for cliff pairs decreased by 27%.

**Table 4. Activity cliff performance**

| Model | Cliff subset RMSE | Cliff top-decile recall | Median pairwise rank displacement |
|---|---:|---:|---:|
| Ligand-only GNN | 1.34 | 0.29 | 118 |
| Protein-ligand GNN | 1.17 | 0.43 | 87 |
| AF2Bind without cliff-aware loss | 1.21 | 0.41 | 83 |
| **AF2Bind** | **1.02** | **0.58** | **61** |

Error analysis showed that residual cliff failures were typically associated with protonation ambiguities, alternate water networks, or series whose potency shifts depended on slow loop rearrangements outside the simulated timescale. Nonetheless, the observed gains suggest that explicit cliff modeling should be considered a first-class benchmark objective rather than an optional add-on.

## 5.6 Multi-Objective Optimization Improves Practical Prioritization
In the prospective-style prioritization study, affinity-only ranking tended to concentrate on lipophilic, synthetically challenging compounds with elevated uncertainty. By contrast, Pareto-based selection retained high-affinity candidates while improving developability and reliability. Among the top 1% of ranked compounds, the full AF2Bind selector achieved a hit rate of 31.2%, compared with 13.6% for docking-only ranking and 21.7% for affinity-only AF2Bind ranking.

**Table 5. Prospective-style prioritization outcomes**

| Ranking strategy | Top 1% hit rate | Enrichment factor | Median synthetic accessibility | Mean uncertainty |
|---|---:|---:|---:|---:|
| Docking only | 13.6% | 4.2 | 4.1 | 0.31 |
| Affinity-only AF2Bind | 21.7% | 6.7 | 4.7 | 0.27 |
| **AF2Bind multi-objective** | **31.2%** | **9.8** | **3.6** | **0.19** |

This result corresponds to a 2.3-fold improvement in hit rate over docking-only selection and a 1.44-fold improvement over affinity-only AF2Bind ranking. The Pareto frontier also preserved scaffold diversity, reducing the number of near-duplicate nominations.

## 5.7 Case Studies and Failure Modes
AF2Bind performed particularly well on kinase hinge binders, bromodomain acetyl-lysine mimetics, and protease series with well-defined pockets. In one kinase program, the model correctly ranked a polar bicyclic analogue above a more lipophilic matched pair after MD revealed stable bridging interactions with a conserved lysine and ordered water occupancy. In a bromodomain series, activity cliff weighting helped identify a subtle methyl-to-cyclopropyl change that perturbed ZA-loop packing and shifted potency by 1.4 log units.

However, failures persisted for targets dominated by large conformational rearrangements or unresolved cofactors. GPCR extracellular binding sites modeled from truncated AF2 domains showed variable pocket geometry, and metalloenzymes with uncertain ion coordination remained challenging. These errors emphasize that AF2Bind improves but does not eliminate the structural limitations of predicted models.

# 6. Discussion
## 6.1 Why Integration Matters
The principal result of this study is not simply that AF2-derived structures can be used for affinity prediction, but that they become substantially more useful when embedded in an uncertainty-aware, multimodal pipeline. AF2 alone provides structural hypotheses; docking supplies candidate poses; MD and free-energy methods probe dynamic plausibility; GNNs learn nonlinear interaction patterns; cliff detection focuses the model on chemically important discontinuities; and multi-objective optimization converts raw predictions into actionable decisions. The performance gains observed here arise from the interaction of these modules rather than from any single component.

This perspective is important because many practical failures in computational drug discovery stem from overinterpreting one source of evidence. AF2Bind instead treats each modality as partially informative and fallible. Such a design philosophy is likely to generalize beyond AF2 to future structure predictors and multimodal foundation models.

## 6.2 Implications for Structure-Based Drug Discovery
For target classes where experimental structures are unavailable, AF2Bind offers a pragmatic path toward structure-enabled prioritization. The remaining gap to holo-structure upper bound was relatively small on the benchmark, suggesting that predicted structures need not be excluded from serious affinity modeling provided their local confidence is explicitly assessed. The pipeline is especially well suited to early-to-mid lead optimization, where medicinal chemists seek reliable relative ranking within evolving series rather than perfectly accurate absolute free energies.

The multi-objective selector is also operationally relevant. In medicinal chemistry, selecting compounds that are only potent on paper but synthetically intractable or highly uncertain can waste scarce synthesis bandwidth. By balancing potency with reliability and developability, AF2Bind better aligns computational outputs with real project constraints.

## 6.3 Limitations
Several limitations must be acknowledged. First, the benchmark, although diverse, remains biased toward targets with enough data to support supervised learning. Second, assay harmonization across $K_d$, $K_i$, and $IC_{50}$ introduces residual noise despite careful curation. Third, the MD protocol used here samples nanosecond-to-tens-of-nanoseconds timescales and therefore misses rare or slow conformational transitions. Fourth, FEP was applied selectively; its benefits would likely depend on implementation quality and chemical series coherence in real campaigns.

More fundamentally, AF2 structures may be systematically unreliable for binding sites formed by large-scale induced fit, oligomerization, cofactors, membrane context, or disordered regions. Under such conditions, the reliability score should be interpreted conservatively. AF2Bind is designed to mitigate, not abolish, uncertainty inherited from predicted structures.

## 6.4 Future Directions
Future work should explore three directions. First, pocket-conditioned structure prediction and diffusion-based ligand-complex modeling may provide better starting conformations than AF2 alone. Second, active learning could allocate MD and FEP resources adaptively to compounds whose ranking uncertainty most affects project decisions. Third, richer uncertainty quantification, including assay-noise models and Bayesian treatment of structure ensembles, may further improve decision calibration.

An additional opportunity lies in integrating generative design with the AF2Bind multi-objective frontier. Rather than merely ranking enumerated libraries, future systems could propose compounds expected to move the frontier outward while satisfying synthetic and pharmacokinetic constraints. Such coupling would transform AF2Bind from an evaluation pipeline into a closed-loop design engine.

# 7. Conclusion
AF2Bind presents a comprehensive framework for protein-ligand binding affinity prediction built around the practical realities of using AlphaFold2-predicted structures in drug discovery. By combining pocket-focused structure quality assessment, docking, molecular dynamics, free-energy features, hierarchical graph neural networks, activity cliff detection, and multi-objective optimization, the system achieves stronger predictive performance than representative single-modality baselines. The results show that AF2-derived structures can support competitive affinity modeling when structural uncertainty is explicitly modeled and when dynamic and physics-based information are used to augment static coordinates.

Equally important, AF2Bind improves the decision usefulness of computational rankings. The pipeline reduces large errors, improves cliff sensitivity, and prioritizes compounds that balance potency with reliability and developability. Although limitations remain for highly flexible or cofactor-dependent targets, the framework offers a practical and extensible foundation for structure-enabled medicinal chemistry in the absence of experimental holo structures.

# References
1. Jumper, J.; Evans, R.; Pritzel, A.; Green, T.; Figurnov, M.; Ronneberger, O.; Tunyasuvunakool, K.; Bates, R.; Žídek, A.; Potapenko, A.; et al. Highly Accurate Protein Structure Prediction with AlphaFold. *Nature* **2021**, *596*, 583-589.
2. Varadi, M.; Anyango, S.; Deshpande, M.; Nair, S.; Natassia, C.; Yordanova, G.; Yuan, D.; Stroe, O.; Wood, G.; Laydon, A.; et al. AlphaFold Protein Structure Database: Massively Expanding the Structural Coverage of Protein-Sequence Space with High-Accuracy Models. *Nucleic Acids Res.* **2022**, *50*, D439-D444.
3. Baek, M.; DiMaio, F.; Anishchenko, I.; Dauparas, J.; Ovchinnikov, S.; Lee, G. R.; Wang, J.; Cong, Q.; Kinch, L. N.; Schaeffer, R. D.; et al. Accurate Prediction of Protein Structures and Interactions Using a Three-Track Neural Network. *Science* **2021**, *373*, 871-876.
4. Evans, R.; O'Neill, M.; Pritzel, A.; Antropova, N.; Senior, A.; Green, T.; Žídek, A.; Bates, R.; Blackwell, S.; Yim, J.; et al. Protein Complex Prediction with AlphaFold-Multimer. *bioRxiv* **2022**, DOI:10.1101/2021.10.04.463034.
5. Wong, F.; de Groot, B. L.; Buel, G. R.; Varga, A.; Vreven, T.; Koes, D. R. Opportunities and Pitfalls in Using AlphaFold2 for Drug Discovery. *Curr. Opin. Struct. Biol.* **2024**, *84*, 102733.
6. Corso, G.; Stärk, H.; Jing, B.; Barzilay, R.; Jaakkola, T. DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking. *ICLR* **2023**.
7. Friesner, R. A.; Murphy, R. B.; Repasky, M. P.; Frye, L. L.; Greenwood, J. R.; Halgren, T. A.; Sanschagrin, P. C.; Mainz, D. T. Extra Precision Glide: Docking and Scoring Incorporating a Model of Hydrophobic Enclosure for Protein-Ligand Complexes. *J. Med. Chem.* **2006**, *49*, 6177-6196.
8. Warren, G. L.; Andrews, C. W.; Capelli, A.-M.; Clarke, B.; LaLonde, J.; Lambert, M. H.; Lindvall, M.; Nevins, N.; Semus, S. F.; Senger, S.; et al. A Critical Assessment of Docking Programs and Scoring Functions. *J. Med. Chem.* **2006**, *49*, 5912-5931.
9. Homeyer, N.; Gohlke, H. Free Energy Calculations by the Molecular Mechanics Poisson-Boltzmann Surface Area Method. *Mol. Inform.* **2012**, *31*, 114-122.
10. Genheden, S.; Ryde, U. The MM/PBSA and MM/GBSA Methods to Estimate Ligand-Binding Affinities. *Expert Opin. Drug Discov.* **2015**, *10*, 449-461.
11. Wang, L.; Wu, Y.; Deng, Y.; Kim, B.; LeBard, D. N.; Wandschneider, D.; Beachy, M.; Friesner, R. A.; Abel, R. Accurate and Reliable Prediction of Relative Ligand Binding Potency in Prospective Drug Discovery by Way of a Modern Free-Energy Calculation Protocol and Force Field. *J. Am. Chem. Soc.* **2015**, *137*, 2695-2703.
12. Abel, R.; Wang, L.; Harder, E. D.; Berne, B. J.; Friesner, R. A. Advancing Drug Discovery through Enhanced Free Energy Calculations. *Acc. Chem. Res.* **2017**, *50*, 1625-1632.
13. Mobley, D. L.; Gilson, M. K. Predicting Binding Free Energies: Frontiers and Benchmarks. *Annu. Rev. Biophys.* **2017**, *46*, 531-558.
14. Öztürk, H.; Özgür, A.; Ozkirimli, E. DeepDTA: Deep Drug-Target Binding Affinity Prediction. *Bioinformatics* **2018**, *34*, i821-i829.
15. Stepniewska-Dziubinska, M. M.; Zielenkiewicz, P.; Siedlecki, P. Development and Evaluation of a Deep Learning Model for Protein-Ligand Binding Affinity Prediction. *Bioinformatics* **2018**, *34*, 3666-3674.
16. Li, X.; Fourches, D. Inductive Transfer Learning for Molecular Activity Prediction: Next-Gen QSAR Models with MolPMoFiT. *J. Cheminform.* **2020**, *12*, 27.
17. Nguyen, T.; Le, H.; Quinn, T. P.; Nguyen, T.; Le, T. D.; Venkatesh, S. GraphDTA: Predicting Drug-Target Binding Affinity with Graph Neural Networks. *Bioinformatics* **2021**, *37*, 1140-1147.
18. Stärk, H.; Ganea, O.; Pattanaik, L.; Barzilay, R.; Jaakkola, T. EquiBind: Geometric Deep Learning for Drug Binding Structure Prediction. *ICML* **2022**.
19. Somnath, V. R.; Bunne, C.; Coley, C.; Krause, A.; Barzilay, R. Multi-Scale Geometric Deep Learning for Structure-Based Drug Design. *NeurIPS* **2021**.
20. Townshend, R. J. L.; Bedi, R.; Suriana, P.; Dror, R. O. End-to-End Learning on 3D Protein Structure for Interface Prediction. *NeurIPS* **2019**.
21. Schütt, K. T.; Kindermans, P.-J.; Sauceda, H. E.; Chmiela, S.; Tkatchenko, A.; Müller, K.-R. SchNet: A Continuous-Filter Convolutional Neural Network for Modeling Quantum Interactions. *NeurIPS* **2017**.
22. Gainza, P.; Sverrisson, F.; Monti, F.; Rodolà, E.; Boscaini, D.; Bronstein, M. M.; Correia, B. Geometric Deep Learning of Protein Molecular Surfaces. *Nat. Methods* **2020**, *17*, 184-192.
23. Stumpfe, D.; Bajorath, J. Exploring Activity Cliffs in Medicinal Chemistry. *J. Med. Chem.* **2012**, *55*, 2932-2942.
24. Hu, Y.; Stumpfe, D.; Bajorath, J. Advancing the Activity Cliff Concept. *F1000Research* **2013**, *2*, 199.
25. Cherkasov, A.; Muratov, E. N.; Fourches, D.; Varnek, A.; Baskin, I. I.; Cronin, M.; Dearden, J.; Gramatica, P.; Martin, Y. C.; Todeschini, R.; et al. QSAR Modeling: Where Have You Been? Where Are You Going To? *J. Med. Chem.* **2014**, *57*, 4977-5010.
26. Muratov, E. N.; Bajorath, J.; Sheridan, R. P.; Tetko, I. V.; Filimonov, D.; Poroikov, V.; Oprea, T. I.; Baskin, I. I.; Varnek, A.; Roitberg, A.; et al. QSAR without Borders. *Chem. Soc. Rev.* **2020**, *49*, 3525-3564.
27. Bickerton, G. R.; Paolini, G. V.; Besnard, J.; Muresan, S.; Hopkins, A. L. Quantifying the Chemical Beauty of Drugs. *Nat. Chem.* **2012**, *4*, 90-98.
28. Ertl, P.; Schuffenhauer, A. Estimation of Synthetic Accessibility Score of Drug-like Molecules Based on Molecular Complexity and Fragment Contributions. *J. Cheminform.* **2009**, *1*, 8.
29. Brown, N.; Fiscato, M.; Segler, M. H. S.; Vaucher, A. C. GuacaMol: Benchmarking Models for de Novo Molecular Design. *J. Chem. Inf. Model.* **2019**, *59*, 1096-1108.
30. Jin, W.; Barzilay, R.; Jaakkola, T. Junction Tree Variational Autoencoder for Molecular Graph Generation. *ICML* **2018**.
31. Trott, O.; Olson, A. J. AutoDock Vina: Improving the Speed and Accuracy of Docking with a New Scoring Function, Efficient Optimization, and Multithreading. *J. Comput. Chem.* **2010**, *31*, 455-461.
32. Eastman, P.; Swails, J.; Chodera, J. D.; McGibbon, R. T.; Zhao, Y.; Beauchamp, K. A.; Wang, L.-P.; Simmonett, A. C.; Harrigan, M. P.; Stern, C. D.; et al. OpenMM 7: Rapid Development of High Performance Algorithms for Molecular Dynamics. *PLoS Comput. Biol.* **2017**, *13*, e1005659.
33. Efron, B.; Tibshirani, R. J. *An Introduction to the Bootstrap*; Chapman & Hall: New York, 1993.
34. Rogers, D.; Hahn, M. Extended-Connectivity Fingerprints. *J. Chem. Inf. Model.* **2010**, *50*, 742-754.
35. Bemis, G. W.; Murcko, M. A. The Properties of Known Drugs. 1. Molecular Frameworks. *J. Med. Chem.* **1996**, *39*, 2887-2893.
36. Berman, H. M.; Westbrook, J.; Feng, Z.; Gilliland, G.; Bhat, T. N.; Weissig, H.; Shindyalov, I. N.; Bourne, P. E. The Protein Data Bank. *Nucleic Acids Res.* **2000**, *28*, 235-242.
37. Gaulton, A.; Hersey, A.; Nowotka, M.; Bento, A. P.; Chambers, J.; Mendez, D.; Mutowo, P.; Atkinson, F.; Bellis, L. J.; Cibrián-Uhalte, E.; et al. The ChEMBL Database in 2017. *Nucleic Acids Res.* **2017**, *45*, D945-D954.
38. Gilson, M. K.; Liu, T.; Baitaluk, M.; Nicola, G.; Hwang, L.; Chong, J. BindingDB in 2015: A Public Database for Medicinal Chemistry, Computational Chemistry and Systems Pharmacology. *Nucleic Acids Res.* **2016**, *44*, D1045-D1053.
39. Liu, Z.; Su, M.; Han, L.; Liu, J.; Yang, Q.; Li, Y.; Wang, R. Forging the Basis for Developing Protein-Ligand Interaction Scoring Functions. *Acc. Chem. Res.* **2017**, *50*, 302-309.
40. Volkamer, A.; Kuhn, D.; Rippmann, F.; Rarey, M. Do G-Protein-Coupled Receptor Crystal Structures Enable Structure-Based Virtual Screening? *Angew. Chem. Int. Ed.* **2012**, *51*, 5130-5134.

DRAFT — NOT FOR DISTRIBUTION