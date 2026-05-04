# Azure Well-Architected Framework (WAF) Checklist — Research Infrastructure

WAF 5-pillar checklist for validating best-practice compliance of Azure architecture design documents.
Each item includes the corresponding Microsoft Learn service guide URL.

## WAF Service Guides to Reference

Refer to the following WAF Service Guides for each Azure service adopted in the design:

| Service | WAF Service Guide URL |
|---------|----------------------|
| Azure Machine Learning | https://learn.microsoft.com/azure/well-architected/service-guides/azure-machine-learning |
| Azure Blob Storage | https://learn.microsoft.com/azure/well-architected/service-guides/azure-blob-storage |
| Azure Key Vault | https://learn.microsoft.com/azure/well-architected/service-guides/azure-key-vault |
| Azure Virtual Network | https://learn.microsoft.com/azure/well-architected/service-guides/azure-virtual-network |
| Azure Batch | https://learn.microsoft.com/azure/well-architected/service-guides/azure-batch |
| Azure Kubernetes Service | https://learn.microsoft.com/azure/well-architected/service-guides/azure-kubernetes-service |

> **When Microsoft Learn MCP is available**: Use `fetch` to retrieve the URLs above and reference the latest checklist items and configuration recommendations.

---

## 1. Reliability

> Reference: https://learn.microsoft.com/azure/well-architected/reliability/checklist

### Research Infrastructure Checklist

- [ ] **Availability Zones**: Compute resources are distributed across availability zones
- [ ] **Checkpointing**: Checkpointing (PyTorch / TensorFlow) is included in the design for large-scale model training
- [ ] **Recovery Strategy**: Recovery strategy is defined for the AML workspace and dependent resources (Key Vault, Storage, ACR)
- [ ] **Data Redundancy**: Storage redundancy configuration (LRS/ZRS/GRS/GZRS) is appropriate for the criticality of research data
- [ ] **Experiment/Production Separation**: Experiment workspace and production workspace are separated
- [ ] **Soft Delete**: Blob Storage soft delete / versioning / point-in-time restore is enabled

### Configuration Recommendations

| Recommendation | Rationale |
|---------------|-----------|
| Use Dedicated VM tier for batch inference | Low-priority VMs may be preempted |
| Enable training checkpoints | Enables recovery from interruptions |
| Configure Storage with ZRS or higher | Data protection against AZ failures |

---

## 2. Security

> Reference: https://learn.microsoft.com/azure/well-architected/security/checklist

### Research Infrastructure Checklist

- [ ] **Network Isolation**: AML workspace access is restricted within a VNet
- [ ] **Private Endpoint**: Private Endpoints are configured for Storage / Key Vault / ACR
- [ ] **Managed Identity**: Managed Identity is used for inter-service authentication with no hardcoded connection strings
- [ ] **RBAC Least Privilege**: RBAC for workspace / storage follows the principle of least privilege
- [ ] **Data Exfiltration Prevention**: AML workspace outbound mode is set to "Allow only approved outbound"
- [ ] **Public SSH Port Disabled**: SSH ports on compute clusters are disabled
- [ ] **No Public IP**: Compute has `enableNodePublicIp: false` set
- [ ] **Local Auth Disabled**: Local authentication on compute is disabled
- [ ] **Encryption**: Encryption at rest (SSE) + TLS 1.2+. CMK requirement is explicitly stated
- [ ] **Storage Anonymous Access Disabled**: Anonymous read access on blob containers is disabled
- [ ] **Storage Shared Key Disabled**: Shared Key authentication is disabled

### Configuration Recommendations

| Recommendation | Rationale |
|---------------|-----------|
| Configure Managed VNet Isolation | Network isolation of the workspace |
| Disable Storage public endpoint | Minimize attack surface |
| Enable Microsoft Defender for Storage | Threat detection for anomalous activity |
| Apply Resource Manager locks | Protection against accidental deletion |

---

## 3. Cost Optimization

> Reference: https://learn.microsoft.com/azure/well-architected/cost-optimization/checklist

### Research Infrastructure Checklist

- [ ] **Right-Sized Resources**: CPU vs GPU and SKU size are optimal for the research workload
- [ ] **Idle Shutdown**: Compute instances have idle shutdown configured
- [ ] **Autoscale**: Compute cluster minimum node count is set to 0
- [ ] **Spot VM Usage**: Low-priority / Spot VMs are used for interruption-tolerant batch workloads
- [ ] **Early Termination Policy**: Early termination policy is set for underperforming training runs
- [ ] **Storage Tiering**: Hot/Cool/Archive tiers are appropriately selected based on data access frequency
- [ ] **Lifecycle Management**: Storage lifecycle policy is configured
- [ ] **Budget Guardrails**: Cost caps are set via Azure Budget / Policy
- [ ] **SPReAD Budget Constraint**: Fits within the direct cost ceiling of ¥5M

### Configuration Recommendations

| Recommendation | Rationale |
|---------------|-----------|
| Training cluster minimum nodes = 0 | Eliminate cost when idle |
| Test training parallelization | Lower-cost SKU may meet requirements |
| Upload directly to target access tier | Avoid unnecessary tier change costs |

---

## 4. Operational Excellence

> Reference: https://learn.microsoft.com/azure/well-architected/operational-excellence/checklist

### Research Infrastructure Checklist

- [ ] **MLOps Pipeline**: Automated pipeline for data prep → training → scoring is planned
- [ ] **IaC**: AML workspace / compute / dependent resources are defined in Bicep / Terraform
- [ ] **Model Registry**: Model versioning and sharing is planned
- [ ] **Monitoring**: Performance monitoring and data drift detection for deployed models is planned
- [ ] **Application Insights**: Application Insights is enabled on online endpoints
- [ ] **Curated Environments**: AML pre-built environments (e.g., Azure Container for PyTorch) are leveraged
- [ ] **Storage Monitoring**: Storage Insights dashboard is planned
- [ ] **Resource Logs**: Diagnostic settings forward logs to Azure Monitor Logs

### Configuration Recommendations

| Recommendation | Rationale |
|---------------|-----------|
| Train with **scripts** rather than notebooks | Easier integration into automated pipelines |
| Minimize the number of workspaces | Reduce operational maintenance cost |
| Standardize configuration with IaC + Azure Policy | Prevent configuration drift |

---

## 5. Performance Efficiency

> Reference: https://learn.microsoft.com/azure/well-architected/performance-efficiency/checklist

### Research Infrastructure Checklist

- [ ] **Training Time Target**: Acceptable training time and retraining frequency are defined
- [ ] **Compute Selection**: CPU vs GPU selection rationale is clear and based on test results
- [ ] **Autoscale**: Deployment environment has autoscale capability
- [ ] **Region Optimization**: Storage and compute resources are co-located in the same region
- [ ] **GPU Utilization**: GPU memory / core utilization is included in the monitoring plan
- [ ] **Storage IOPS**: Storage IOPS / throughput meets data processing requirements
- [ ] **Infrastructure Monitoring**: CPU/GPU/memory usage monitoring is planned

### Configuration Recommendations

| Recommendation | Rationale |
|---------------|-----------|
| Use compute clusters rather than instances for training | Performance improvement via autoscale |
| Co-locate Storage and compute in the same region | Reduced latency + free intra-region transfer |
| Benchmark across multiple SKUs | Optimize cost-to-performance ratio |

---

## Governance Validation via Azure Policy

The following Azure Policy built-in definitions are recommended for automated checks:

| Policy | Validation Target |
|--------|-------------------|
| Disable public network on AML workspace | Enforce network isolation |
| Place AML compute in VNet | Compute network isolation |
| Disable local auth on AML | Authentication security |
| Require Private Link on AML workspace | Enforce Private Endpoint |
| Require CMK encryption on AML | Data protection |
| Require user-assigned Managed Identity on AML | Identity management |
| Require idle shutdown on AML compute | Cost optimization |
| Restrict AML registries | Allow only approved registries |
| Disable anonymous access on Storage | Security |
| Enforce HTTPS on Storage | Transport encryption |
| Storage firewall rules | Network restriction |

> Reference: https://learn.microsoft.com/azure/governance/policy/samples/built-in-policies#machine-learning

---

## How to Use

1. **After design completion**: Cross-check the architecture design document (`phase1-azure-architecture.md`) against this checklist
2. **Reference Microsoft Learn MCP**: Use `fetch` to retrieve each service's WAF Service Guide URL and review the latest checklist items
3. **Fix non-compliant items**: Revise the design for any items that fail the check
4. **Record validation results**: Append pass/fail status for each checklist item to the design document
