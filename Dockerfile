# ── Guideon application image ───────────────────────────────────────────────
# Runs the Node.js/Express app. Designed for an Ubuntu VPS (e.g. Oman Data Park)
# behind a reverse proxy (Nginx) that terminates TLS.
FROM node:22-slim

# System deps: sharp libs + Chromium and Arabic/emoji fonts for HTML→PDF
# invoices (Puppeteer renders bilingual documents the browser way).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget \
    chromium fonts-noto-core fonts-noto-color-emoji fonts-kacst fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer: use the distro Chromium instead of downloading its own copy.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

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
