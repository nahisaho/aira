---
name: spread1000-iac-deployer
description: |
  Generate Bicep templates and GitHub Actions CI/CD pipelines based on the Azure configuration
  design document. Manage research infrastructure as code and enable reproducible deployments.
  Use when you want to generate Bicep templates, build CI/CD, or set up IaC.
---

# IaC Deployer

Generate Bicep templates and CI/CD pipelines from the Azure configuration design document to codify research infrastructure.

## Use This Skill When

- Azure configuration design is complete and ready to codify infrastructure
- You want to generate Bicep templates to deploy Azure resources
- You want to build CI/CD pipelines with GitHub Actions

## Required Inputs

- `output/{project-name}/phase1-azure-architecture.md` (Azure configuration design document)
- Azure subscription ID (at deployment time)
- Target deployment region

## Workflow

1. **Parse the configuration design document**: Extract the list of resources to deploy
2. **Generate Bicep templates**:
   - Read `references/bicep-patterns.md` when generating templates
   - `main.bicep`: Entry point
   - `modules/`: Modules organized by resource type
   - `parameters/`: Environment-specific parameter files
3. **Generate CI/CD pipelines**:
   - Read `references/cicd-patterns.md` when generating pipelines
   - `.github/workflows/deploy.yml`: Deployment workflow
   - `.github/workflows/validate.yml`: Bicep validation workflow
4. **Output deliverables**: Save to `output/{project-name}/phase4-iac/` directory
   - Reuse `assets/bicep-main-template.bicep` as starting point
5. **Validation**: Present steps for Bicep lint and what-if execution

## Deliverables

- `output/{project-name}/phase4-iac/main.bicep`: Main Bicep template
- `output/{project-name}/phase4-iac/modules/`: Resource-specific Bicep modules
- `output/{project-name}/phase4-iac/parameters/`: Environment-specific parameters
- `output/{project-name}/phase4-iac/.github/workflows/deploy.yml`: Deployment pipeline
- `output/{project-name}/phase4-iac/.github/workflows/validate.yml`: Validation pipeline

## Quality Gates

- [ ] Bicep templates pass lint without errors
- [ ] All resources are modularized (1 module = 1 resource type)
- [ ] Parameter files absorb environment-specific differences
- [ ] CI/CD pipeline includes a what-if step
- [ ] Secrets (connection strings, keys) are not hardcoded
- [ ] Tagging policy (Project, Owner, Environment) is applied

## Gotchas

- Bicep module reference paths are relative to the deployment execution directory. Be mindful of directory structure
- Azure Machine Learning workspaces have many dependent resources (Storage, Key Vault, Application Insights, Container Registry). Pay attention to deployment order
- For GitHub Actions workflows deploying to Azure, OpenID Connect (OIDC) federated credentials are recommended. Avoid secret-based authentication
- Be aware of GPU VM (NC/ND series) quota limits. Incorporate a quota check step before deployment

## Security Guardrails

- Never embed secrets or tokens in Bicep templates. Use Key Vault references or the `@secure()` decorator
- Azure authentication in GitHub Actions must use OIDC federation. Do not generate `AZURE_CREDENTIALS` secrets
- Resource deployment follows the principle of least privilege. Default to Managed Identity + RBAC role assignments
- Network isolation: Design with VNet + Private Endpoint by default. Do not use public endpoints without explicit justification

## Validation Loop

1. Generate Bicep templates
2. Check:
   - No compilation errors with `az bicep build`
   - Expected resources are created with `az deployment group what-if`
   - CI/CD pipeline YAML syntax is correct
3. If any check fails:
   - Fix errors and recompile
   - Review dependency ordering
   - Re-validate
4. Finalize deliverables only after all gates pass
