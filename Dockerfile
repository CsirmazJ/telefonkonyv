# ── 1. fázis: Frontend build ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── 2. fázis: Backend függőségek (native modulok fordítása) ────────────────────
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production

# ── 3. fázis: Végleges image ───────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Backend
COPY --from=backend-builder /build/node_modules ./node_modules
COPY server.js .

# Frontend (build output)
COPY --from=frontend-builder /build/dist ./public

# Adatkönyvtár (SQLite volume mount pont)
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD wget -qO- http://localhost:3000/api/settings || exit 1

CMD ["node", "server.js"]
