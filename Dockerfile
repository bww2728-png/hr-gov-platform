# ---------- Stage 1: build the frontend ----------
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---------- Stage 2: server runtime ----------
FROM node:20-alpine AS server
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV JWT_SECRET=render-deploy-secret-please-override-via-env
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/ ./
COPY --from=client-build /app/client/dist ../client/dist

EXPOSE 4000
# DATABASE_URL must be provided via Render env. Migrations + seed run at startup.
CMD ["sh", "-c", "npx prisma db push --skip-generate && (node prisma/seed.js || true) && node src/index.js"]
