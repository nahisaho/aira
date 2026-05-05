# ── Stage 1: Build frontend ──
FROM node:22-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace=frontend
COPY frontend/ frontend/
RUN npm run build --workspace=frontend

# ── Stage 2: Build backend ──
FROM node:22-slim AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace=backend
COPY backend/ backend/
RUN npm run build --workspace=backend

# ── Stage 3: Production ──
FROM node:22-slim AS production
WORKDIR /app

# System dependencies for MCP servers and Copilot CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install ToolUniverse MCP server
RUN pip install --break-system-packages tooluniverse

# Install GitHub Copilot CLI globally
RUN npm install -g @github/copilot@1.0.41-0 && npm cache clean --force

# Install only production dependencies
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force

# Copy built artifacts
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=frontend-build /app/frontend/dist frontend/dist
COPY --from=backend-build /app/backend/src/config backend/src/config
COPY skills/ skills/

# Create data directories and ensure node user owns its home (for copilot CLI config)
RUN mkdir -p data projects /home/node/.copilot && chown -R node:node /app /home/node/.copilot

USER node

ENV NODE_ENV=production
ENV AIRA_PORT=3000
ENV AIRA_SERVE_FRONTEND=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/server.js"]
