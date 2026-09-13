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

# Production bundle yaratish (TypeScript + Vite)
RUN npm run build

# 2. RUNNER STAGE (Nginx Alpine)
FROM nginx:alpine AS runner

# Nginx konfiguratsiyasini o‘rnatish
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Yig‘ilgan static fayllarni nusxalash
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx ni ishga tushirish
CMD ["nginx", "-g", "daemon off;"]
