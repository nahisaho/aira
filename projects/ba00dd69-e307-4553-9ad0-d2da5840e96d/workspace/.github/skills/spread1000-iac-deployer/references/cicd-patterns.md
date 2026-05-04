# CI/CD Pipeline Pattern Reference

Pattern catalog for Azure deployment CI/CD pipelines using GitHub Actions.

## Authentication Method

### Recommended: OpenID Connect (OIDC) Federation

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**Not recommended**: Service principal authentication via `AZURE_CREDENTIALS` secret

## Deployment Workflow

```yaml
name: Deploy Azure Infrastructure

on:
  push:
    branches: [main]
    paths: ['infra/**']
  pull_request:
    branches: [main]
    paths: ['infra/**']
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options: [dev, staging, prod]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Bicep Lint
        run: az bicep build --file infra/main.bicep
      - name: What-If
        run: |
          az deployment group what-if \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file infra/main.bicep \
            --parameters infra/parameters/${{ inputs.environment || 'dev' }}.bicepparam

  deploy:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy
        run: |
          az deployment group create \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file infra/main.bicep \
            --parameters infra/parameters/${{ inputs.environment || 'dev' }}.bicepparam
```

## Validation Workflow

```yaml
name: Validate Bicep

on:
  pull_request:
    paths: ['infra/**']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Bicep Lint
        run: az bicep build --file infra/main.bicep
      - name: Bicep Validate
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: |
          az deployment group validate \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file infra/main.bicep \
            --parameters infra/parameters/dev.bicepparam
```

## Required GitHub Secrets

| Secret Name | Description |
|-------------|-------------|
| AZURE_CLIENT_ID | Service principal client ID |
| AZURE_TENANT_ID | Azure AD tenant ID |
| AZURE_SUBSCRIPTION_ID | Azure subscription ID |

## Required GitHub Variables

| Variable Name | Description |
|---------------|-------------|
| RESOURCE_GROUP | Target resource group name |
