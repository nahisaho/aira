# Bicep Pattern Reference

Pattern catalog for generating Bicep templates for research infrastructure.

## Directory Structure

```
infra/
├── main.bicep              # Entry point
├── modules/
│   ├── network.bicep       # VNet, NSG, Subnets
│   ├── storage.bicep       # Storage Account, Containers
│   ├── keyvault.bicep      # Key Vault
│   ├── monitoring.bicep    # Log Analytics, App Insights
│   ├── machinelearning.bicep  # AML Workspace, Compute
│   └── compute.bicep       # VM, Batch (when needed)
├── parameters/
│   ├── dev.bicepparam      # Development
│   ├── staging.bicepparam  # Staging
│   └── prod.bicepparam     # Production
└── bicepconfig.json        # Bicep configuration
```

## Naming Conventions

| Resource Type | Pattern | Example |
|--------------|---------|---------|
| Resource Group | rg-{project}-{env} | rg-myresearch-dev |
| Storage Account | st{project}{env} | stmyresearchdev |
| Key Vault | kv-{project}-{env} | kv-myresearch-dev |
| Virtual Network | vnet-{project}-{env} | vnet-myresearch-dev |
| ML Workspace | mlw-{project}-{env} | mlw-myresearch-dev |
| Compute Cluster | cc-{purpose} | cc-training |

## Module Design Principles

1. **1 module = 1 resource type**: Group related resources together
2. **Parameters absorb differences**: Manage per-environment variations via parameter files
3. **Connect via outputs**: Make inter-module dependencies explicit through output/input connections
4. **Unified tags**: Apply common tags to all resources

## Security Patterns

### Managed Identity
```bicep
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-identity'
  location: location
  tags: tags
}
```

### Private Endpoint
```bicep
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-pe-${serviceName}'
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: '${prefix}-plsc-${serviceName}'
        properties: {
          privateLinkServiceId: serviceResourceId
          groupIds: [groupId]
        }
      }
    ]
  }
}
```

## GPU Compute Cluster

```bicep
resource computeCluster 'Microsoft.MachineLearningServices/workspaces/computes@2024-04-01' = {
  parent: workspace
  name: 'gpu-cluster'
  location: location
  properties: {
    computeType: 'AmlCompute'
    properties: {
      vmSize: 'Standard_NC24ads_A100_v4'
      scaleSettings: {
        minNodeCount: 0
        maxNodeCount: 4
        nodeIdleTimeBeforeScaleDown: 'PT15M'
      }
      vmPriority: 'LowPriority' // Spot VM
      subnet: { id: subnetId }
    }
  }
}
```

## Parameter File Example

```bicepparam
using '../main.bicep'

param projectName = 'myresearch'
param environment = 'dev'
param ownerName = 'researcher@university.ac.jp'
param researchTopic = 'AI-driven materials discovery'
```
