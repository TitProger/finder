# syntax=docker/dockerfile:1

# Этап 1: Сборка приложения
FROM node:24-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (включая dev для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Удаляем dev-зависимости
RUN npm prune --production

# Этап 2: Production образ
FROM node:24-alpine

WORKDIR /app

# Копируем package.json для метаданных
COPY package*.json ./

# Копируем production node_modules из builder
COPY --from=builder /app/node_modules ./node_modules

# Копируем скомпилированное приложение
COPY --from=builder /app/dist ./dist

# Копируем необходимые файлы для работы приложения
COPY --from=builder /app/api ./api

# Создаём пользователя для запуска приложения (не root)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Открываем порт приложения
EXPOSE 8080

# Переменные окружения по умолчанию (можно переопределить при запуске)
ENV NODE_ENV=production
ENV APP_PORT=8080

# Запускаем приложение
CMD ["node", "dist/src/main.js"]
