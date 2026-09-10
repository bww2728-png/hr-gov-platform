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
# كل الحسابات الزمنية (اليوم، بداية الدوام، المجدول) بتوقيت الرياض — السعودية بلا توقيت صيفي
ENV TZ=Asia/Riyadh
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/ ./
COPY --from=client-build /app/client/dist ../client/dist

EXPOSE 4000
# DATABASE_URL/PORT/HOST/JWT_SECRET provided via Railway env vars.
# الترحيل versioned فقط عبر scripts/migrate.js:
# قاعدة db push القديمة → baseline resolve ثم deploy؛ الجديدة → deploy مباشرة.
# لا db push إطلاقاً — لا تعديل تخريبي للمخطط عند الإقلاع.
CMD ["sh", "-c", "echo '[boot] applying versioned migrations...' && node scripts/migrate.js && echo '[boot] starting server...' && node src/index.js"]
