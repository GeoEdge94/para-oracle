# syntax=docker/dockerfile:1.7

# ---------- deps : hydrate node_modules from lockfile ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

# ---------- builder : produce static bundle for prod ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Dev target : vite dev server, non-root, hot reload ----------
FROM node:20-alpine AS dev
RUN addgroup -S para && adduser -S -G para -u 10001 -h /home/para para \
 && mkdir -p /app && chown -R para:para /app
WORKDIR /app
COPY --from=deps --chown=para:para /app/node_modules ./node_modules
COPY --chown=para:para . .
USER para
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ---------- Prod target : nginx-unprivileged (non-root, port 8080) ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1
