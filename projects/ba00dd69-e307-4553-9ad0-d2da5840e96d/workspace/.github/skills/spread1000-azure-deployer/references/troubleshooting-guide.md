# Deployment Troubleshooting Guide

Common errors and remediation steps when deploying Bicep templates.

## Basic Error Diagnosis Commands

```bash
# Show deployment error details
az deployment group show \
  --resource-group <rg> \
  --name <deployment-name> \
  --query "properties.error"

# List detailed deployment operations
az deployment operation group list \
  --resource-group <rg> \
  --name <deployment-name> \
  --query "[?properties.provisioningState=='Failed'].{Resource:properties.targetResource.resourceType, Error:properties.statusMessage.error.message}" \
  --output table

# Check activity log
az monitor activity-log list \
  --resource-group <rg> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --query "[?status.value=='Failed'].{Operation:operationName.localizedValue, Status:status.value, Message:properties.statusMessage}" \
  --output table
```

## Common Errors and Remediation

### 1. QuotaExceeded — Quota Exceeded

**Error Message**: `Operation could not be completed as it results in exceeding approved Total Regional Cores quota`

**Cause**: Insufficient regional vCPU quota for GPU VMs

**Remediation**:
```bash
# Check current usage
az vm list-usage --location japaneast --output table | grep -i "NC\|ND\|Total"

# Request quota increase
# Azure Portal → Subscriptions → Usage + quotas → Request increase
```

**Alternative**: If the quota increase cannot be obtained in time, switch to another available region

### 2. InvalidTemplate — Template Error

**Error Message**: `Deployment template validation failed`

**Remediation**:
```bash
# Compile-check the Bicep file
az bicep build --file main.bicep

# Validate the ARM template
az deployment group validate \
  --resource-group <rg> \
  --template-file main.bicep \
  --parameters parameters/${environment}.bicepparam
```

### 3. ResourceNotFound — Dependent Resource Not Found

**Error Message**: `The Resource 'Microsoft.xxx/yyy' under resource group 'zzz' was not found`

**Cause**: Dependencies between modules are not correctly defined

**Remediation**:
- Verify `dependsOn` in the Bicep template
- Check module `output` → `input` connections
- Try staged deployment (Network → Storage → ML Workspace)

### 4. AuthorizationFailed — Insufficient Permissions

**Error Message**: `The client does not have authorization to perform action`

**Remediation**:
```bash
# Check current role assignments
az role assignment list --assignee $(az account show --query user.name -o tsv) --output table

# Verify required role (Contributor or above)
az role assignment create \
  --assignee <principal-id> \
  --role "Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/<rg>"
```

### 5. SkuNotAvailable — SKU Unavailable

**Error Message**: `The requested VM size is not available in the current region`

**Remediation**:
```bash
# Check available VM sizes
az vm list-skus --location japaneast --resource-type virtualMachines \
  --query "[?name=='Standard_NC24ads_A100_v4'].{Name:name, Zones:locationInfo[0].zones, Restrictions:restrictions}" \
  --output table

# Search for available regions
az vm list-skus --resource-type virtualMachines \
  --query "[?name=='Standard_NC24ads_A100_v4' && length(restrictions)==\`0\`].{Location:locationInfo[0].location}" \
  --output table
```

### 6. Conflict — Resource Name Conflict

**Error Message**: `A resource with the same name already exists`

**Cause**: A resource with the same name exists in another resource group or subscription (for resources requiring globally unique names)

**Remediation**:
- Rename resources that require globally unique names (Storage Account, Key Vault, etc.)
- Use `uniqueString(resourceGroup().id)` to ensure uniqueness

### 7. PrivateEndpointCreationFailed — Private Endpoint Error

**Error Message**: `Private endpoint creation failed`

**Remediation**:
- Verify the subnet has sufficient IP address space
- Verify `privateEndpointNetworkPolicies` is set to `Disabled`
- Verify the `Microsoft.Network` resource provider is registered

```bash
# Check subnet settings
az network vnet subnet show \
  --resource-group <rg> \
  --vnet-name <vnet> \
  --name <subnet> \
  --query "{AddressPrefix:addressPrefix, PrivateEndpointPolicies:privateEndpointNetworkPolicies}"
```

### 8. DeploymentQuotaExceeded — Deployment History Limit

**Error Message**: `Creating the deployment would exceed the quota of 800`

**Remediation**:
```bash
# Delete old deployment history
az deployment group list \
  --resource-group <rg> \
  --query "sort_by([],&properties.timestamp)[0:100].name" \
  --output tsv | xargs -I {} az deployment group delete --resource-group <rg> --name {}
```

## AML-Specific Troubleshooting

### Compute Cluster Fails to Start

```bash
# Check node status
az ml compute show \
  --name <compute> \
  --workspace-name <workspace> \
  --resource-group <rg> \
  --query "{State:provisioning_state, Errors:provisioning_errors}"

# Check activity log
az monitor activity-log list \
  --resource-group <rg> \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --caller "Microsoft.MachineLearningServices" \
  --output table
```

### Container Registry Authentication Error

```bash
# If ACR admin authentication is disabled
az acr update --name <acr-name> --admin-enabled false
# → Switch to Managed Identity authentication
az role assignment create \
  --assignee <ml-identity-principal-id> \
  --role "AcrPull" \
  --scope <acr-resource-id>
```

## Redeployment Best Practices

1. Identify the error and fix the root cause before redeploying
2. For partial failures, only the failed module can be redeployed (Incremental mode)
3. For dependency errors, consider staged deployment
4. Re-run What-If to verify the fix before deploying
