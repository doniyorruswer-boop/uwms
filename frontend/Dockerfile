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

WORKDIR /app

# Nginx konfiguratsiyasini to'g'ridan-to'g'ri nusxalash (envsubst kerak emas)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Yig'ilgan static fayllarni nusxalash
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

