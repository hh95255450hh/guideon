# ── Guideon application image ───────────────────────────────────────────────
# Runs the Node.js/Express app. Designed for an Ubuntu VPS (e.g. Oman Data Park)
# behind a reverse proxy (Nginx) that terminates TLS.
FROM node:20-slim

# System deps for sharp (image processing) — Debian slim is missing some libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Simple healthcheck against the health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
