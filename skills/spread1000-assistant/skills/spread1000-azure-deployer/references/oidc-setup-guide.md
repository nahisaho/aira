# OIDC Federation Setup Guide

Setup procedure for OIDC (OpenID Connect) federated authentication to deploy to Azure from GitHub Actions.

## Overview

OIDC federation authenticates to Azure using GitHub's ID token without service principal secrets. This eliminates the need for secret rotation and improves security.

## Step 1: Create Entra ID App Registration

```bash
# Create app registration
az ad app create --display-name "spread-${projectName}-github-deploy"

# Record the appId from the output
APP_ID=$(az ad app list --display-name "spread-${projectName}-github-deploy" --query "[0].appId" -o tsv)

# Create service principal
az ad sp create --id $APP_ID
```

## Step 2: Add Federated Credentials

```bash
# Add federated credential (for main branch)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-main-branch",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_ORG>/<GITHUB_REPO>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions - main branch deployment"
}'

# Add federated credential (for pull requests)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-pull-request",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_ORG>/<GITHUB_REPO>:pull_request",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions - PR validation"
}'
```

### Subject Field Patterns

| Scenario | Subject Value |
|----------|---------------|
| Specific branch | `repo:<org>/<repo>:ref:refs/heads/<branch>` |
| Tag | `repo:<org>/<repo>:ref:refs/tags/<tag>` |
| Pull Request | `repo:<org>/<repo>:pull_request` |
| Environment | `repo:<org>/<repo>:environment:<env-name>` |

## Step 3: RBAC Role Assignment

```bash
# Assign Contributor role at subscription scope
# ⚠️ In production, restrict to resource group scope
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

# Resource group scope (recommended)
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-${projectName}-${environment}"

# Key Vault management role (as needed)
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets Officer" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-${projectName}-${environment}"
```

## Step 4: Configure GitHub Repository Secrets/Variables

Configure the following in GitHub repository Settings → Secrets and variables → Actions:

### Secrets

| Name | Value |
|------|-------|
| `AZURE_CLIENT_ID` | App registration appId |
| `AZURE_TENANT_ID` | Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

### Variables

| Name | Value |
|------|-------|
| `RESOURCE_GROUP` | `rg-${projectName}-${environment}` |
| `LOCATION` | Deployment region (e.g., `japaneast`) |

### Commands to Retrieve Values

```bash
# Client ID
echo "AZURE_CLIENT_ID: $APP_ID"

# Tenant ID
az account show --query tenantId -o tsv

# Subscription ID
az account show --query id -o tsv
```

## Step 5: Usage in GitHub Actions Workflow

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

## Security Notes

- Do **not** generate client secrets for the service principal
- Restrict RBAC roles to resource group scope (avoid subscription scope)
- Set the GitHub repository to **Private**
- For production deployments, configure GitHub Environments protection rules (require review)
