# draw.io Diagram Generation Guide

Rules for diagram generation using [simonkurtz-MSFT/drawio-mcp-server](https://github.com/simonkurtz-MSFT/drawio-mcp-server).

## Rigid Grid

Use the following grid for all node placement:

- x = `col_index * 180 + 40` (col 0 = 40, col 1 = 220, col 2 = 400, …)
- y = `row_index * 120 + 40` (row 0 = 40, row 1 = 160, row 2 = 280, …)

### Node Sizes

| Shape | width × height |
|-------|---------------|
| Rectangle | 140 × 60 |
| Diamond | 140 × 80 |
| Circle | 60 × 60 |
| Document | 120 × 80 |
| Cylinder | 100 × 70 |
| Azure icon | 60 × 60 (follow `search-shapes` results) |

## Azure Architecture Diagram Patterns

### Container Nesting Structure

```
Resource Group (outermost)
  └── VNet
       ├── Subnet: Compute
       │    ├── GPU VM (NC24ads_A100_v4)
       │    └── CPU VM (D16s_v5)
       ├── Subnet: Storage
       │    ├── Blob Storage
       │    └── Managed Lustre
       ├── Subnet: AI Services
       │    └── AI Foundry
       └── Subnet: Management
            ├── Key Vault
            └── Log Analytics
```

### Color Coding Rules

| Layer | fillColor | strokeColor | Purpose |
|-------|-----------|-------------|---------|
| Resource Group | #F5F5F5 | #666666 | Outermost container |
| VNet | #E8F5E9 | #4CAF50 | Network boundary |
| Subnet: Compute | #E3F2FD | #2196F3 | Compute resources |
| Subnet: Storage | #FFF3E0 | #FF9800 | Storage resources |
| Subnet: AI | #F3E5F5 | #9C27B0 | AI services |
| Subnet: Management | #ECEFF1 | #607D8B | Management / monitoring |

### Edge (Arrow) Types

| Arrow Type | Style | Purpose |
|-----------|-------|---------|
| Solid arrow | `edgeStyle=orthogonalEdgeStyle` | Data flow |
| Dashed arrow | `edgeStyle=orthogonalEdgeStyle;dashed=1` | Management / monitoring |
| Bold arrow | `edgeStyle=orthogonalEdgeStyle;strokeWidth=2` | Primary data path |

## search-shapes Keywords (Azure)

| Azure Service | Search Keyword |
|--------------|----------------|
| Virtual Machines | `Azure Virtual Machine` |
| Blob Storage | `Azure Blob Storage` |
| Key Vault | `Azure Key Vault` |
| Virtual Network | `Azure Virtual Network` |
| Machine Learning | `Azure Machine Learning` |
| AI Foundry | `Azure AI` |
| Log Analytics | `Azure Monitor` |
| Application Insights | `Azure Application Insights` |
| Cosmos DB | `Azure Cosmos DB` |
| AI Search | `Azure Cognitive Search` |
| Container Registry | `Azure Container Registry` |
| Managed Lustre | `Azure Managed Lustre` or `Azure Storage` |
| Batch | `Azure Batch` |
| NSG | `Azure Network Security Group` |

> Fuzzy search supported: partial matches work. Passing an array to the `queries` parameter of `search-shapes` is more efficient.

## Diagram Construction Notes

- `add-cells` accepts arrays — add all cells in **a single call**
- `temp_id` allows intra-batch cell references (edge source/target)
- `shape_name` parameter can directly specify Azure icons (no need for `search-shapes`)
- Create groups/containers with `create-groups`, then place cells with `add-cells-to-group`
- Use `export-diagram` to obtain the final draw.io XML and save to file
- Use `import-diagram` to load existing draw.io XML for continued editing
