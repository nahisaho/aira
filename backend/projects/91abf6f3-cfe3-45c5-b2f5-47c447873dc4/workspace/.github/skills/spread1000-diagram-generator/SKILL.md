---
name: spread1000-diagram-generator
description: |
  Generate Azure research infrastructure system architecture diagrams, data flow diagrams, and
  network diagrams in draw.io format using the draw.io MCP Server (simonkurtz-MSFT).
  700+ official Azure icons are built in and can be retrieved via fuzzy search with search-shapes.
  Automatically creates visual architecture diagrams from the Phase 1 (azure-architect) design document.
  Use when you want to create system architecture diagrams, draw.io architecture diagrams,
  Azure configuration diagrams, or data flow diagrams.
---

# Diagram Generator

Generate professional system architecture diagrams for Azure research infrastructure using the [draw.io MCP Server (simonkurtz-MSFT)](https://github.com/simonkurtz-MSFT/drawio-mcp-server). 700+ official Azure icons built in, no browser required.

## Use This Skill When

- You want to create a system architecture diagram from the Azure configuration design document (Phase 1)
- You want to create an architecture diagram in draw.io format for the proposal
- You need data flow diagrams or network configuration diagrams
- You need detailed diagrams that Mermaid cannot fully express

## Required Inputs

- `output/{project-name}/phase1-azure-architecture.md` (Azure configuration design document)
- Diagram type specification (system architecture / data flow / network / security)

## Prerequisites

### Setting Up the draw.io MCP Server

Set up [simonkurtz-MSFT/drawio-mcp-server](https://github.com/simonkurtz-MSFT/drawio-mcp-server) using one of the following methods:

#### Method 1: Docker (Recommended)

```bash
docker pull simonkurtzmsft/drawio-mcp-server:latest
docker run -d --name drawio-mcp-server -p 8080:8080 simonkurtzmsft/drawio-mcp-server:latest
```

Add to VS Code `.vscode/mcp.json`:

```json
{
  "servers": {
    "drawio": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

#### Method 2: Run from Source (Deno v2.3+ required)

```bash
git clone https://github.com/simonkurtz-MSFT/drawio-mcp-server.git
cd drawio-mcp-server
deno run --allow-net --allow-read --allow-env src/index.ts
```

Add to VS Code `.vscode/mcp.json`:

```json
{
  "servers": {
    "drawio": {
      "command": "deno",
      "args": [
        "run", "--allow-net", "--allow-read", "--allow-env",
        "/path/to/drawio-mcp-server/src/index.ts"
      ]
    }
  }
}
```

## MCP Tools

### Shape Search

| Tool | Purpose |
|------|---------|
| `search-shapes` | Fuzzy search 700+ official Azure icons and retrieve exact style strings |
| `get-shape-categories` | Get shape category list (General, Flowchart, Azure categories) |
| `get-shapes-in-category` | Get all shapes in a category |
| `get-style-presets` | Get built-in style presets for Azure/flowchart etc. |

### Diagram Operations

| Tool | Purpose |
|------|---------|
| `add-cells` | Batch-add vertices and edges. Icon resolution via `shape_name`, intra-batch references via `temp_id` |
| `edit-cells` | Update cell properties (position, size, text, style) |
| `edit-edges` | Update edge properties (text, connections, style) |
| `delete-cell-by-id` | Delete a cell by ID (connected edges are auto-deleted for vertices) |
| `create-groups` | Create groups/containers (VNet, Subnet, Resource Group, etc.) |
| `add-cells-to-group` | Add cells to a group |
| `remove-cell-from-group` | Remove a cell from a group |

### Diagram Export & Management

| Tool | Purpose |
|------|---------|
| `export-diagram` | Export as draw.io XML |
| `import-diagram` | Import draw.io XML (replaces current diagram) |
| `clear-diagram` | Clear all cells and reset |
| `list-paged-model` | Paginated view of all cells |
| `get-diagram-stats` | Statistics on cell count, bounds, layer distribution |

### Layer & Page Management

| Tool | Purpose |
|------|---------|
| `create-layer` / `list-layers` | Create and list layers |
| `create-page` / `list-pages` | Multi-page management |

> ⚠️ **Performance Tips**: `add-cells` accepts arrays. Add all cells in **a single call**. Calling the tool repeatedly is inefficient.

## Workflow

### Step 1: Parse the Configuration Design Document

Extract the following from `output/{project-name}/phase1-azure-architecture.md`:

- All Azure resources and their types (VM, Storage, VNet, Key Vault, etc.)
- Connections and dependencies between resources
- Network configuration (VNet, Subnet, NSG, Private Endpoint)
- Data flow (input → processing → output)

### Step 2: Retrieve Azure Icons

Use the `search-shapes` tool to retrieve official Azure icon style strings.

```
# Search examples (fuzzy search supported)
search-shapes(queries: ["Azure Virtual Machine", "Azure Blob Storage", "Azure Key Vault", "Azure Machine Learning", "Azure Virtual Network", "Azure AI"])
```

> ⚠️ For Azure architecture diagrams, **always use `search-shapes`** to retrieve official icons.
> Do not substitute with generic rectangles. Icon resolution is also available via the `shape_name` parameter in `add-cells`.

### Step 3: Select Diagram Type and Generate

Diagram types needed for research infrastructure:

#### 3a. System Architecture Diagram (Main)

An overview diagram of all Azure resources and their relationships. Attached to proposal §4「研究基盤計画」.

Components:
- Resource Group (container)
- VNet / Subnet (nested containers)
- Compute (GPU VM, HPC VM, Azure ML)
- Storage (Blob, Managed Lustre)
- Security (Key Vault, NSG)
- AI Services (AI Foundry, OpenAI)
- Monitoring (Log Analytics, App Insights)

#### 3b. Data Flow Diagram

A diagram showing the flow of research data. Attached to proposal §3「研究計画・方法論」.

```
データ取得 → 前処理 → 学習 → 推論 → 結果保存 → 可視化
```

#### 3c. Network & Security Diagram

A diagram showing network isolation and access control within the VNet.

#### 3d. CI/CD Pipeline Diagram

A diagram showing the Bicep deployment flow from Phase 5 (iac-deployer).

### Step 4: Build the Diagram

Build the diagram following these steps:

1. **Create groups/containers**: Use `create-groups` to create nested structures: Resource Group → VNet → Subnet
2. **Batch-add cells**: Use `add-cells` to add all resource nodes and edges in a single call
   - Specify Azure icons directly via the `shape_name` parameter
   - Use `temp_id` for intra-batch cell references
3. **Place into groups**: Use `add-cells-to-group` to place cells into appropriate containers
4. **Adjust**: Use `edit-cells` / `edit-edges` to adjust position and style as needed

- Read `references/drawio-xml-guide.md` when building diagrams
- Follow a rigid grid: x = col × 180 + 40, y = row × 120 + 40
- Represent containers (VNet, Subnet, Resource Group) as nested structures

### Step 5: Export the Diagram

Use the `export-diagram` tool to retrieve the draw.io XML and save it as a file in `output/{project-name}/diagrams/`.

## Deliverables

| File | Content |
|------|---------|
| `output/{project-name}/diagrams/system-architecture.drawio` | System architecture diagram (main) |
| `output/{project-name}/diagrams/data-flow.drawio` | Data flow diagram |
| `output/{project-name}/diagrams/network-security.drawio` | Network & security diagram |
| `output/{project-name}/diagrams/cicd-pipeline.drawio` | CI/CD pipeline diagram |

> Diagrams can be opened and edited in draw.io Desktop or at https://app.diagrams.net.

## Quality Gates

- [ ] All Azure resources match the configuration design document (Phase 1)
- [ ] Official Azure icons are retrieved via `search-shapes` and used
- [ ] Connections between resources are accurately drawn
- [ ] VNet / Subnet network isolation is correctly represented
- [ ] Diagram labels are written in Japanese
- [ ] draw.io XML is well-formed (no syntax errors)
- [ ] Diagram files are saved in `output/{project-name}/diagrams/`

## Diagram Templates

### Azure Research Infrastructure — Construction Procedure Template

#### 1. Create Groups/Containers

```json
// create-groups
{
  "groups": [
    {
      "temp_id": "rg",
      "text": "rg-research-prod",
      "x": 20, "y": 20, "width": 900, "height": 600,
      "style": "rounded=1;fillColor=#F5F5F5;strokeColor=#666666;fontSize=14;fontStyle=1;"
    },
    {
      "temp_id": "vnet",
      "text": "VNet (10.0.0.0/16)",
      "x": 40, "y": 70, "width": 860, "height": 500,
      "parent_id": "rg",
      "style": "rounded=1;fillColor=#E8F5E9;strokeColor=#4CAF50;strokeWidth=2;dashed=1;"
    }
  ]
}
```

#### 2. Batch-Add Cells

```json
// add-cells
{
  "cells": [
    {
      "type": "vertex",
      "temp_id": "gpu-vm",
      "x": 100, "y": 140,
      "width": 60, "height": 60,
      "text": "GPU VM\nNC24ads A100",
      "shape_name": "Azure Virtual Machine"
    },
    {
      "type": "vertex",
      "temp_id": "blob",
      "x": 280, "y": 140,
      "width": 60, "height": 60,
      "text": "Blob Storage",
      "shape_name": "Azure Blob Storage"
    },
    {
      "type": "edge",
      "source_id": "gpu-vm",
      "target_id": "blob",
      "text": "データ読み書き"
    }
  ]
}
```

#### 3. Place into Groups

```json
// add-cells-to-group
{
  "group_id": "vnet",
  "cell_ids": ["gpu-vm", "blob"]
}
```

## Gotchas

- `search-shapes` can fuzzy search 700+ Azure icons. Search by service name like `"Azure Virtual Machine"`
- `add-cells` accepts arrays — add all cells in a single call, do not call the tool repeatedly
- When including HTML tags in the draw.io XML `value` attribute, add `html=1` to the style and escape characters like `<` → `&lt;`
- Nodes inside containers must be added to the group via `add-cells-to-group`
- If draw.io Desktop is not available, `.drawio` files can be opened at https://app.diagrams.net
- If PNG/SVG/PDF conversion is needed, use jgraph's `skill-cli`: https://github.com/jgraph/drawio-mcp/blob/main/skill-cli/README.md

## Security Guardrails

- Do not include actual IP addresses, subscription IDs, or secrets in diagrams. Use placeholders
- Generalize paths for sensitive research data

## Validation Loop

1. Generate the draw.io XML
2. Check:
   - Is the XML well-formed (parseable)?
   - Are all resources included in the Phase 1 configuration design document?
   - Are Azure icons used correctly?
   - Is the container nesting structure correct?
3. If any check fails:
   - Fix the XML and regenerate
   - Re-retrieve the correct shape via `search_shapes`
   - Re-validate
4. Finalize deliverables only after all gates pass
