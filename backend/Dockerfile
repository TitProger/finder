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
COPY --from=builder /app/seeds ./seeds
COPY --from=builder /app/seed-media ./seed-media
COPY --from=builder /app/scripts/run-seed.mjs ./scripts/run-seed.mjs

# Каталог логов принадлежит runtime-пользователю до USER.
# Пустой том Docker наследует владельца этого каталога из образа.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 \
 && mkdir -p /app/logs /app/storage \
 && chown nodejs:nodejs /app/logs /app/storage
USER nodejs

# Открываем порт приложения
EXPOSE 8080

# Переменные окружения по умолчанию (можно переопределить при запуске)
ENV NODE_ENV=production
ENV APP_PORT=8080
ENV LOG_DIR=/app/logs

# Запускаем приложение
CMD ["node", "dist/src/main.js"]
