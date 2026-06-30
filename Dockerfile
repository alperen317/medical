# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# MedPanel — production image (Next.js 16 standalone + Prisma 7 driver adapter)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
WORKDIR /app
# Prisma / Next bazı native modüller için gerekli
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# ── Bağımlılıklar ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client'ı üret (DB bağlantısı gerektirmez)
RUN npx prisma generate
# Build (DB'ye dokunan public sayfalar force-dynamic olduğu için DB gerekmez)
RUN npm run build

# ── Migrator: prisma migrate deploy için tam bağımlılıklı ince katman ─────────
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Runner: çalışan production sunucusu ──────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8060
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone çıktı: minimal server.js + izlenen node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# pdf-parse, DOMMatrix/ImageData/Path2D için @napi-rs/canvas'a ihtiyaç duyar.
# Native + dinamik require olduğundan trace'e bırakmadan açıkça kopyalanır
# (builder ile runner aynı taban: node:22-alpine → musl binary uyumlu).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Yüklenen belgeler için yazılabilir dizin (compose'da volume ile kalıcı)
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 8060
CMD ["node", "server.js"]
