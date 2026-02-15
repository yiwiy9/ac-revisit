FROM node:24-bookworm

# Minimal utilities that help with demos / scripting / debugging
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git ca-certificates curl jq ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Install Codex CLI
RUN npm install -g @openai/codex \
  && codex --version

WORKDIR /workspaces/ac-revisit
USER node
