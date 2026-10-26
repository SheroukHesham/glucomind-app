FROM node:18 AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./

# ---- development (used by docker-compose) ----
FROM base AS dev
RUN npm install
COPY . .
CMD ["/wait-for-kafka.sh", "kafka", "npm", "run", "dev"]

# ---- compile ----
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---- production ----
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["/wait-for-kafka.sh", "kafka", "node", "dist/app.js"]