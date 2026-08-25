FROM node:22-bookworm-slim

# Chrome/headless-render dependencies — per Remotion's official Docker guide
# (remotion.dev/docs/docker), required for @remotion/renderer to actually
# render frames in a container.
RUN apt-get update && apt-get install -y \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libgbm-dev \
  libasound2 \
  libxrandr2 \
  libxkbcommon-dev \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libatk-bridge2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Headless Chrome is downloaded lazily by @remotion/renderer on first use
# (no @remotion/cli here — deliberately avoided elsewhere in this project
# due to install hangs from its own bundled Studio download) — the first
# render after a fresh deploy is a little slower while it fetches once.

EXPOSE 3001
CMD ["node", "server.mjs"]
