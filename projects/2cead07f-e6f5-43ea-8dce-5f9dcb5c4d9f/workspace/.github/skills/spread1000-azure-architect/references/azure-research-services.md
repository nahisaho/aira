# Azure Research Infrastructure Service Reference

Reference for Azure service selection. Lists research-oriented services and recommended configurations.

## Compute

### GPU VM Series (ML/DL Training)

| Series | GPU | VRAM | Use Case |
|--------|-----|------|----------|
| NC A100 v4 | NVIDIA A100 | 80GB | Large-scale model training |
| ND H100 v5 | NVIDIA H100 | 80GB | Very-large-scale model training |
| NC T4 v3 | NVIDIA T4 | 16GB | Inference / small-scale training |
| NV v3 | NVIDIA M60 | 8GB | Visualization / lightweight inference |

### HPC VM Series (MPI / Simulation)

| Series | CPU | InfiniBand | Use Case |
|--------|-----|------------|----------|
| HB v4 | AMD EPYC 9V74 | 400 Gb/s NDR | Large-scale MPI parallel computing, weather simulation |
| HX v4 | AMD EPYC 9V74 | 400 Gb/s NDR | Memory-intensive HPC (DFT, molecular dynamics) |
| HB v3 | AMD EPYC 7V73X | 200 Gb/s HDR | CFD / structural simulation |

### Compute Services

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Azure Machine Learning | End-to-end ML workflow | Experiment tracking, model training, deployment |
| Azure Batch | Large-scale batch processing | Parameter sweeps, simulation jobs |
| Azure CycleCloud | HPC cluster management | MPI parallel computing, traditional HPC |
| Azure Kubernetes Service | Container orchestration | Microservice-based ML pipelines |

## Storage

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Azure Blob Storage | Object storage | Training data, model artifacts |
| Azure Data Lake Storage Gen2 | Hierarchical storage | Large-scale data lake |
| Azure NetApp Files | NFS shared storage | Shared data across HPC nodes |
| Azure Managed Lustre | High-performance parallel file system | Ultra-large-scale parallel I/O |

## AI Services

### Azure AI Foundry Platform

Azure AI Foundry is the unified AI platform for building, deploying, and managing AI models. **When AI Foundry provides a capability, always prefer it over raw GPU VMs.**

| Capability | Description | Use Instead Of |
|-----------|-------------|----------------|
| Model Catalog | 1,900+ pre-built models (OpenAI, Meta Llama, Mistral, Phi, etc.) | Self-hosting OSS models on GPU VM |
| Serverless API (MaaS) | Pay-per-token inference, no GPU management required | GPU VM for inference of catalog models |
| Managed Online Endpoints | Deploy any model with managed compute, auto-scaling | Self-managed GPU VM inference servers |
| Managed Fine-tuning | Fine-tune supported models without managing compute | GPU VM fine-tuning of supported models |
| Prompt Flow | LLM orchestration and evaluation | Custom inference pipeline on GPU VM |
| AI for Science Models | Domain-specific foundation models (see below) | Training equivalent models from scratch |

#### AI Foundry vs GPU VM 判定マトリクス

| Scenario | Use AI Foundry | Use GPU VM |
|----------|---------------|------------|
| Pre-trained model inference (LLM, vision, etc.) | ✅ Serverless API or Managed Endpoint | ❌ |
| Fine-tuning a model available in Foundry catalog | ✅ Managed Fine-tuning | ❌ |
| AI for Science foundation model (Aurora, MatterGen, etc.) | ✅ Model Catalog deployment | ❌ |
| Custom model training from scratch | ❌ | ✅ AML Compute Cluster |
| Fine-tuning a model NOT in Foundry catalog | ❌ | ✅ AML Compute Cluster |
| Traditional HPC simulation (MPI, CFD, DFT) | ❌ | ✅ HPC VM (HB/HX series) |
| NVIDIA domain framework (BioNeMo, Modulus, Clara) | ❌ | ✅ GPU VM with framework |
| Custom distributed training (DDP, DeepSpeed, FSDP) | ❌ | ✅ AML Compute Cluster |

> **❗ 重要ルール**: AI Foundry のモデルカタログに存在するモデルを GPU VM 上でセルフホスティングする設計は禁止。サーバーレス API または Managed Endpoint を使用すること。

### General AI Services

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Azure OpenAI Service | LLM API | Text generation, summarization, classification |
| Azure AI Search | Vector search | Literature search, knowledge base |
| Azure AI Document Intelligence | Document analysis | Research paper PDF parsing, data extraction |
| [Microsoft GraphRAG](https://github.com/microsoft/graphrag) | Knowledge graph + RAG | Structured insight extraction from knowledge graphs, discovery of inter-literature relationships |

### AI for Science Foundation Models (Azure AI Foundry)

Models developed by Microsoft Research AI for Science, **deployed via [Azure AI Foundry](https://ai.azure.com/) model catalog**. Purpose-built for scientific research. **Always deploy these through AI Foundry — do NOT design GPU VM infrastructure to self-host them.**

| Model | Domain | Purpose | Recommended Scenario |
|-------|--------|---------|----------------------|
| [Aurora](https://ai.azure.com/explore/models/Aurora/version/4/registry/azureml) | Earth science / meteorology | Large-scale atmospheric foundation model | Weather forecasting, atmospheric simulation, climate change research |
| [BioEmu](https://ai.azure.com/explore/models/BioEmu/version/2/registry/azureml) | Life science | Biomolecular emulation | Protein dynamics simulation, drug discovery |
| [MatterGen](https://ai.azure.com/explore/models/MatterGen/version/1/registry/azureml-msr) | Materials science | Generative AI for novel material design | Generating new materials with desired properties, materials exploration |
| [MatterSim](https://ai.azure.com/explore/models/MatterSim/version/1/registry/azureml-msr) | Materials science | Materials property simulation | Physical property prediction, molecular dynamics simulation |
| [NatureLM](https://naturelm.github.io/) | Cross-domain (chemistry, life science, materials) | Natural-language-driven scientific entity generation | Drug discovery (ligand design, binding affinity optimization), protein design, materials design, RNA design |
| [TamGen](https://www.microsoft.com/en-us/research/blog/accelerating-drug-discovery-with-tamgen-a-generative-ai-approach-to-target-aware-molecule-generation/) | Chemistry / drug discovery | Target-aware molecule generation | Automated candidate molecule design from target protein 3D structure, lead compound exploration |
| [Skala (DFT)](https://www.microsoft.com/en-us/research/project/dft/use-skala/) | Computational chemistry / materials | Deep-learning-based exchange-correlation functional | Achieving chemical accuracy (~1 kcal/mol) in DFT calculations, improving prediction accuracy for molecular/materials design |
| [AI2BMD](https://www.microsoft.com/en-us/research/blog/from-static-prediction-to-dynamic-characterization-ai2bmd-advances-protein-dynamics-with-ab-initio-accuracy/) | Life science | Ab initio accuracy biomolecular dynamics | High-speed computation of protein dynamics at first-principles accuracy |

## Data Analytics Platform

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Microsoft Fabric | Unified data analytics platform | Centralized data lake, data warehouse, real-time analytics, and ML |
| Microsoft Fabric — Data Engineering | Spark-based large-scale data processing | Research data preprocessing, ETL, feature engineering |
| Microsoft Fabric — Data Science | Notebooks + MLflow experiment management | Model training, experiment tracking, model registry |
| Microsoft Fabric — Real-Time Intelligence | Streaming data analytics | IoT sensor data, real-time monitoring |
| Microsoft Fabric — Data Warehouse | T-SQL analytical queries | Structured research data aggregation and reporting |
| Microsoft Fabric — OneLake | Unified data lake storage | Centralized research data management (Delta Parquet format) |
| Azure Databricks | Apache Spark analytics | Large-scale data processing, ML pipelines, feature engineering |

## Domain-Specific Data Platforms

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Azure Health Data Services (DICOM) | Medical imaging storage and retrieval | AI analysis of CT/MRI/X-ray images |
| Azure Health Data Services (FHIR) | Clinical data standardization | Research use of patient records and lab results |
| De-identification service | Clinical text de-identification | PHI removal, HIPAA compliance |
| Microsoft Planetary Computer | Geospatial and environmental data analytics | Satellite imagery, climate, biodiversity data |
| Azure Trusted Research Environment | Secure research platform | Safe analysis of sensitive data (clinical, genomic, etc.) |

## Networking

| Service | Use Case |
|---------|----------|
| Azure Virtual Network | Network isolation |
| Azure Private Endpoint | Private connectivity |
| Azure Bastion | Secure VM access |
| Azure ExpressRoute | On-premises connectivity (university networks) |
| InfiniBand (NDR/HDR) | RDMA high-speed interconnect between HPC VMs (MPI parallel jobs) |

## Security & Governance

| Service | Use Case |
|---------|----------|
| Azure Key Vault | Secret management |
| Microsoft Entra ID | Identity management / RBAC |
| Azure Policy | Compliance |
| Microsoft Defender for Cloud | Security monitoring |

## NVIDIA Domain-Specific Frameworks (Run on Azure GPU VMs)

| Framework | Domain | Purpose | Recommended Scenario |
|-----------|--------|---------|----------------------|
| NVIDIA BioNeMo | Life science / drug discovery | Bio-AI model training platform | Training and fine-tuning ESM-2 (protein), MolMIM (molecule generation), DiffDock (docking) |
| NVIDIA Modulus | Physics simulation | Physics-informed AI | Accelerating CFD, thermal, and structural simulations with PINNs and FNOs |
| NVIDIA Clara | Medical AI | Medical imaging / genomics AI | Medical imaging workflows, genomic analysis, MONAI integration |
| MONAI | Medical imaging AI | Medical image segmentation / classification | CT/MRI segmentation, lesion detection, Azure ML integration |

## Additional AI for Science Services

| Service | Use Case | Recommended Scenario |
|---------|----------|----------------------|
| Azure AI Language | NLP text analytics | Sentiment analysis, named entity recognition, text classification (social science, humanities) |
| Azure AI Speech | Speech recognition / synthesis | Interview transcription, multilingual support (qualitative research) |
| Azure Quantum | Quantum computing | Quantum chemistry calculations, quantum optimization (materials science, physics) |
