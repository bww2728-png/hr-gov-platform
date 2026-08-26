# ---------- Stage 1: build the frontend ----------
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---------- Stage 2: server runtime ----------
FROM node:20-slim AS server
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/ ./
COPY --from=client-build /app/client/dist ../client/dist

EXPOSE 4000
# DATABASE_URL/PORT/HOST/JWT_SECRET provided via Railway env vars.
CMD ["sh", "-c", "echo '[boot] prisma db push...' && npx prisma db push --skip-generate --accept-data-loss && echo '[boot] seeding...' && (node prisma/seed.js || echo '[boot] seed skipped') && echo '[boot] starting server...' && node src/index.js"]
