FROM node:22-slim

WORKDIR /root

# Install system deps: git (needed by copilot CLI) + CA certs
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install GitHub Copilot CLI globally
RUN npm install -g @github/copilot@latest --omit=dev \
 && copilot --version

# Copy the agent-runner into the image
COPY agent-runner/package.json /app/package.json
COPY agent-runner/index.mjs    /app/index.mjs

WORKDIR /workspace

ENTRYPOINT ["node", "/app/index.mjs"]
