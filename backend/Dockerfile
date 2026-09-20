# ===================================================
# UWMS Backend Production Multi-Stage Dockerfile
# ===================================================

# 1. BUILDER STAGE
FROM node:20-alpine AS builder

WORKDIR /app

# Paket menejeri fayllarini nusxalash
COPY package*.json ./
COPY prisma ./prisma/

# Bog‘liqliklarni o‘rnatish
RUN npm ci

# Manba kodlarini nusxalash
COPY . .

# Prisma clientini generatsiya qilish va NestJS loyihasini yig‘ish
RUN npx prisma generate
RUN npm run build

# 2. RUNNER STAGE (Production)
FROM node:20-alpine AS runner

# Zaxira va tiklash (pg_dump va pg_restore) ishlashi uchun postgresql-client o‘rnatamiz
RUN apk add --no-cache postgresql-client

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Faqat ishlab chiqarish bog‘liqliklarini o‘rnatish
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

# Builder bosqichidan dist yig‘ilgan kodni nusxalash
COPY --from=builder /app/dist ./dist

# Zaxiralar saqlanadigan jildni yaratish
RUN mkdir -p /app/backups

EXPOSE 4000

# Ishga tushirish buyrug‘i (Baza sxemasini avtomatik sinxronlashtirish va serverni ishga tushirish)
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
