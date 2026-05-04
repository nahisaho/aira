---
name: spread1000-research-planner
description: |
  Formulates an AI for Science research plan. Proposes how to integrate AI into the
  researcher's domain through web research and literature survey, and generates a
  concrete 研究計画書 (research plan document).
  Use when user doesn't know how to apply AI to their 研究テーマ (research theme),
  wants to create a 研究プラン (research plan), or wants to learn about
  AI for Science latest trends (最新動向).
---

# Research Planner

Formulate the optimal AI-powered research plan for the researcher's domain.

## Use This Skill When

- The research theme is decided but the user doesn't know how to leverage AI
- The user wants to survey AI for Science success stories and latest trends
- The user wants to create a 研究計画書 for SPReAD application

## Required Inputs

- Researcher's domain (e.g., materials science, life science, meteorology)
- Research theme or problem overview
- Current research methods / data overview (optional)

## Workflow

1. **Hearing**: Confirm the researcher's field, theme, and current challenges
2. **Web Search (MCP: github-mcp-server)** (primary broad survey):
   Use the github-mcp-server search tools to gather a wide overview first:
   - Latest AI for Science trends and success cases in the researcher's domain
   - Azure AI Foundry model catalog (Aurora, MatterGen, BioEmu, Phi-4, etc.)
   - Microsoft Research AI for Science pages
   - JST site for latest SPReAD solicitation information
   - Key conferences / journals (NeurIPS, ICML, Nature, Science, etc.) for recent highlights
   > Record all URLs, titles, and key findings from Web Search results.
3. **ToolUniverse MCP Research** (detailed literature deep-dive — requires `tooluniverse` MCP server):
   Using keywords and gaps identified in Step 2, run targeted scientific database queries:
   ```
   # Discover relevant tools for the research domain
   find_tools("literature search AI for Science")
   find_tools("<researcher's domain> database")

   # Search literature for AI applications in the field
   execute_tool("PubMed_search_articles",
     {"query": "<domain> AI machine learning deep learning", "max_results": 10})
   execute_tool("ArXiv_search_papers",
     {"query": "<domain> AI for Science foundation model", "max_results": 10})
   execute_tool("BioRxiv_search",
     {"query": "<domain> AI", "max_results": 5})   # for life science
   execute_tool("SemanticScholar_search_papers",
     {"query": "AI for Science <domain> 2024 2025", "max_results": 10})

   # Domain-specific database tools (examples — discover with find_tools first)
   execute_tool("UniProt_search_proteins", ...)         # life science / structural biology
   execute_tool("ChEMBL_search_compounds", ...)         # chemistry / drug discovery
   execute_tool("PubChem_search", ...)                  # chemistry
   execute_tool("ClinicalTrials_search", ...)           # clinical research
   execute_tool("EuropePMC_search", ...)                # broader literature
   ```
   > If `tooluniverse` MCP is unavailable, document the reason and continue with Web Search results only.
4. **AI Strategy Formulation**:
   - Map AI methods to research challenges
   - Clarify expected outcomes and breakthroughs
   - Estimate required computational resources (GPU, storage, network, etc.)
5. **Research Plan Generation**: Save as `output/{project-name}/phase0-research-plan.md`
   - Reuse `assets/research-plan-template.md` when producing the research plan
   - **Section 4 (文献調査)**: Copy ToolUniverse execute_tool results verbatim — do NOT paraphrase or fill from memory
   - **Section 5 (関連事例)**: Select ≥3 papers from Section 4. Each entry must include DOI/URL and source tool name
6. **Review**: Verify technical feasibility of the research plan

## Deliverables

- `output/{project-name}/phase0-research-plan.md`: AI-powered research plan (complete)
  - Section 4「文献調査」: ToolUniverse クエリ記録 + 取得文献リスト（≥5 件、DOI/URL・取得元ツール必須）
  - Section 5「関連事例」: Section 4 から選択した ≥3 件の先行研究（DOI/URL と関連性を明記）
- `output/{project-name}/phase0-research-survey.md`: Literature & database research results summary
  (Include ToolUniverse query results: paper titles, DOIs, key findings from PubMed/ArXiv/etc.)

## Quality Gates

- [ ] ToolUniverse MCP was invoked and results are referenced (or fallback reason stated)
- [ ] Section 4「文献調査」のクエリ記録表が埋まっており、取得文献リストに ≥5 件記載されている
- [ ] 各文献エントリに DOI / URL と取得元ツール名が記載されている（LLM 補完禁止）
- [ ] Section 5「関連事例」が Section 4 の取得文献から ≥3 件選択されており、DOI/URL が一致している
- [ ] Mapping between research theme and AI methods is clearly described
- [ ] Required computational resources are quantitatively estimated
- [ ] Research schedule (milestones) is included
- [ ] Novelty and innovativeness in the AI for Science context is explained

## Gotchas

- AI method selection strongly depends on research data characteristics. Always confirm data format (images, time series, text, 3D structures, etc.)
- Do not reflect overblown expectations like "AI can do anything" in the research plan. Explicitly state technical constraints
- Compute resource estimates must be concretely calculated from training data size, model scale, and number of training iterations
- The appropriate framework (PyTorch/TensorFlow/JAX, etc.) varies by research field

## Validation Loop

1. Generate the research plan
2. Check:
   - Did ToolUniverse MCP return results? (If not, verify `tooluniverse` server is running)
   - Is the mapping between AI methods and research challenges logical?
   - Are compute resource estimates realistic?
   - Is the schedule feasible?
   - Are citations traceable (DOI / URL)?
3. If any check fails:
   - Identify and fix the relevant section
   - Obtain supplementary information via ToolUniverse or web research
   - Re-verify
4. Finalize deliverables only after all gates pass

## ToolUniverse MCP Availability Check

Before starting Step 2, verify the MCP server is reachable:
- Call `list_tools` or `grep_tools("PubMed")` to confirm ToolUniverse is active.
- If the call fails or the server is not configured, log a warning in the survey file
  and proceed with web research as fallback.
- Never silently skip ToolUniverse — always document whether it was used.
