# ---------- Stage 1: build the frontend ----------
FROM node:20-slim AS client-build
ARG CACHEBUST=1
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN echo "build-${CACHEBUST}" && npm run build

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
# migrate deploy is authoritative; on a pre-existing db push schema it falls back
# to a non-destructive db push (no --accept-data-loss) so startup never destroys data.
# One-time follow-up on prod: npx prisma migrate resolve --applied 20260906120000_init
CMD ["sh", "-c", "echo '[boot] applying migrations...' && (npx prisma migrate deploy || (echo '[boot] migrate deploy skipped (existing schema); non-destructive sync' && npx prisma db push --skip-generate)) && echo '[boot] starting server...' && node src/index.js"]
