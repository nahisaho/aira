# Post-Deployment Verification Guide

Detailed verification procedures to execute after Bicep deployment completion.

## 1. Resource Provisioning State Check

```bash
# List all resources in the resource group
az resource list \
  --resource-group rg-${projectName}-${environment} \
  --output table

# Check deployment result details
az deployment group show \
  --resource-group rg-${projectName}-${environment} \
  --name <deployment-name> \
  --query "properties.{State:provisioningState, Duration:duration, Outputs:outputs}"
```

### Expected State

- All resources have `provisioningState` of `Succeeded`
- Deployment `state` is `Succeeded`

## 2. Tag Verification

```bash
# Bulk tag check
az resource list \
  --resource-group rg-${projectName}-${environment} \
  --query "[].{Name:name, Type:type, Tags:tags}" \
  --output table
```

### Required Tags

| Tag Key | Expected Value |
|---------|---------------|
| Project | Project name |
| Environment | dev / staging / prod |
| Owner | Owner name |
| Program | SPReAD1000 |
| ManagedBy | Bicep |

## 3. Network Isolation Verification

```bash
# Check Private Endpoint connection status
az network private-endpoint list \
  --resource-group rg-${projectName}-${environment} \
  --query "[].{Name:name, State:privateLinkServiceConnections[0].properties.privateLinkServiceConnectionState.status}" \
  --output table

# Check Private DNS Zones
az network private-dns zone list \
  --resource-group rg-${projectName}-${environment} \
  --output table

# Check NSG rules
az network nsg list \
  --resource-group rg-${projectName}-${environment} \
  --query "[].{Name:name, Rules:securityRules[].{Name:name, Direction:direction, Access:access, Priority:priority}}" \
  --output json
```

### Expected State

- Private Endpoint connection status is `Approved`
- Private DNS Zones are associated with linked VNets
- No resources have public IP addresses (unless explicitly allowed)

## 4. Key Vault Access Verification

```bash
# Check Key Vault configuration
az keyvault show \
  --name kv-${projectName}-${environment} \
  --query "{Name:name, EnableRbacAuth:properties.enableRbacAuthorization, SoftDelete:properties.enableSoftDelete, PurgeProtection:properties.enablePurgeProtection}"

# Check Managed Identity role assignments
az role assignment list \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-${projectName}-${environment}/providers/Microsoft.KeyVault/vaults/kv-${projectName}-${environment}" \
  --output table
```

### Expected State

- RBAC authorization is enabled (`enableRbacAuthorization: true`)
- Soft delete is enabled
- Managed Identity has appropriate roles assigned (e.g., Key Vault Secrets User)

## 5. Azure Machine Learning Workspace Verification

```bash
# Check workspace status
az ml workspace show \
  --name mlw-${projectName}-${environment} \
  --resource-group rg-${projectName}-${environment} \
  --query "{Name:name, State:provisioning_state, StorageAccount:storage_account, KeyVault:key_vault}"

# Check Compute Clusters
az ml compute list \
  --workspace-name mlw-${projectName}-${environment} \
  --resource-group rg-${projectName}-${environment} \
  --output table

# Compute Cluster details (scale settings)
az ml compute show \
  --name <compute-name> \
  --workspace-name mlw-${projectName}-${environment} \
  --resource-group rg-${projectName}-${environment} \
  --query "{Name:name, VMSize:size, MinInstances:min_instances, MaxInstances:max_instances, IdleTimeout:idle_time_before_scale_down}"
```

### Expected State

- Workspace `provisioning_state` is `Succeeded`
- Dependent resources (Storage, Key Vault, App Insights) are correctly linked
- Compute Cluster `min_instances` is `0` (cost optimization)
- `idle_time_before_scale_down` is appropriately set (recommended: 15–30 minutes)

## 6. Storage Account Verification

```bash
# Check storage account configuration
az storage account show \
  --name st${projectName}${environment} \
  --resource-group rg-${projectName}-${environment} \
  --query "{Name:name, Sku:sku.name, Kind:kind, HttpsOnly:enableHttpsTrafficOnly, MinTls:minimumTlsVersion, PublicAccess:allowBlobPublicAccess}"
```

### Expected State

- HTTPS only enabled (`enableHttpsTrafficOnly: true`)
- TLS 1.2 or higher (`minimumTlsVersion: TLS1_2`)
- Public blob access disabled (`allowBlobPublicAccess: false`)

## 7. Cost Monitoring Configuration Check

```bash
# Check budget alerts (if configured)
az consumption budget list \
  --resource-group rg-${projectName}-${environment} \
  --output table
```

## Verification Result Criteria

| Verdict | Condition |
|---------|-----------|
| ✅ Pass | All resources Succeeded + tags complete + network isolation OK + access control OK |
| ⚠️ Warning | Minor issues (missing tags, recommended settings not applied) — can be fixed manually |
| ❌ Fail | Resource failure, network isolation gap, authentication error — redeployment or rollback required |
