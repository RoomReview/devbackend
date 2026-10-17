FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm run audit:security
COPY . .
RUN npx prisma generate && npm run typecheck && npx tsdown

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm audit --omit=dev --audit-level=moderate
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 5000
CMD ["node", "dist/index.mjs"]
