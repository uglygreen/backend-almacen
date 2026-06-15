FROM node:22.11.0-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22.11.0-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3005
ENV SSL_ENABLED=false
ENV UPLOADS_ROOT=/app/uploads
ENV TZ=America/Mexico_City

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/logo-extendido.png ./logo-extendido.png

RUN mkdir -p /app/uploads/garantias /app/uploads/backups/biotime /app/secrets

EXPOSE 3005

CMD ["node", "dist/main.js"]
