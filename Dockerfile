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

# Create data directories
RUN mkdir -p data projects && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV AIRA_PORT=3000
ENV AIRA_SERVE_FRONTEND=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/server.js"]
