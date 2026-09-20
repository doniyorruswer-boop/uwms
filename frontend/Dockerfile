# ===================================================
# UWMS Frontend Production Multi-Stage Dockerfile
# ===================================================

# 1. BUILDER STAGE
FROM node:20-alpine AS builder

WORKDIR /app

# Paket menejeri fayllarini nusxalash
COPY package*.json ./

# Bog‘liqliklarni o‘rnatish
RUN npm ci

# Manba kodlarini nusxalash
COPY . .

# API URL konfiguratsiyasi (brauzer faqat o‘z Nginx domeniga /api orqali murojaat qilishi uchun)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Production bundle yaratish (TypeScript + Vite)
RUN npm run build

# 2. RUNNER STAGE (Nginx Alpine)
FROM nginx:alpine AS runner

# gettext o'rnatish (envsubst uchun)
RUN apk add --no-cache gettext

# Nginx konfiguratsiyasini template sifatida saqlash
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# BACKEND_URL: Railway public URL (internal railway.internal ishlamayotganda ishonchli alternativ)
# Docker Compose da docker-compose.yml environment orqali http://backend:4000 beriladi
ENV BACKEND_URL=https://respectful-unity-production-b7fc.up.railway.app

# Yig'ilgan static fayllarni nusxalash
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Faqat ${BACKEND_URL} ni almashtirish (nginx o'z $uri, $host o'zgaruvchilarini buzmaslik uchun)
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
