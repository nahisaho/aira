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

LABEL org.opencontainers.image.source="https://github.com/nahisaho/aira"
LABEL org.opencontainers.image.description="AIRA – AI Research Assistant"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# System dependencies for MCP servers, Copilot CLI, and the v3.0.0 Python
# compute layer (Jupyter Server + jupyter-mcp-server + scipy stack).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates python3 python3-pip python3-venv \
      python3-dev gcc g++ gfortran \
      libopenblas-dev liblapack-dev \
      pkg-config \
    && rm -rf /var/lib/apt/lists/*

# ── Python packages (single layer, no pip cache, no compile artefacts) ──
#
# Grouped by purpose so layer cache invalidation is targeted:
#   1. Existing MCP server: tooluniverse
#   2. v3.0.0 Jupyter compute layer: jupyter-server + ipykernel +
#      jupyter-mcp-server (Datalayer)
#   3. Scientific stack (CRUD pandas / numerical / ML / plotting / symbolic)
#
# --no-cache-dir keeps the image lean; --break-system-packages is required on
# Debian-based slim images that mark the system Python as PEP 668 managed.
RUN pip install --no-cache-dir --break-system-packages \
      tooluniverse \
      jupyter-server ipykernel jupyter-mcp-server \
      numpy pandas scipy scikit-learn \
      matplotlib seaborn sympy \
    && rm -rf /root/.cache/pip /tmp/pip-* \
    && python3 -m ipykernel install --sys-prefix --name=python3 --display-name="Python 3"

# Wrapper script: tooluniverse outputs banners on stdout that corrupt JSON-RPC.
# Filter them so only JSON lines pass through.
RUN printf '#!/bin/sh\nexec tooluniverse-smcp "$@" 2>/dev/null | grep --line-buffered "^{"\n' > /usr/local/bin/tooluniverse-stdio \
    && chmod +x /usr/local/bin/tooluniverse-stdio

# Install GitHub Copilot CLI into a mountable prefix so updates survive
# container recreation when /app/.npm-global is volume-mounted.
ENV NPM_CONFIG_PREFIX=/app/.npm-global
ENV PATH="/app/.npm-global/bin:${PATH}"
RUN mkdir -p /app/.npm-global \
    && npm install -g @github/copilot && npm cache clean --force

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
RUN mkdir -p data projects /home/node/.copilot/session-state && chown -R node:node /app /home/node/.copilot /app/.npm-global

# Use root for entrypoint to fix volume permissions, then drop to node
# Exit code 42 from the backend signals a restart request.
COPY --chmod=755 <<'EOF' /entrypoint.sh
#!/bin/sh
chown -R node:node /home/node/.copilot 2>/dev/null
# If .npm-global is volume-mounted but empty (first run), bootstrap copilot
if [ ! -x /app/.npm-global/bin/copilot ]; then
  echo "[AIRA] Copilot CLI not found in .npm-global, installing..."
  npm install -g @github/copilot 2>/dev/null && npm cache clean --force 2>/dev/null
  chown -R node:node /app/.npm-global 2>/dev/null
fi
while true; do
  su -s /bin/sh node -c "exec node backend/dist/server.js"
  rc=$?
  if [ "$rc" -ne 42 ]; then
    exit $rc
  fi
  echo "[AIRA] Restarting... (exit code 42)"
  sleep 1
done
EOF

ENV NODE_ENV=production
ENV AIRA_PORT=3000
ENV AIRA_SERVE_FRONTEND=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
