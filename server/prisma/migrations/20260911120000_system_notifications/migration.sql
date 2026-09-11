-- P0-D: جدول تنبيهات النظام (WPS/المواعيد) — idempotent
CREATE TABLE IF NOT EXISTS "system_notifications" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT,
  "role_key" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'wps',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "system_notifications_role_key_created_at_idx" ON "system_notifications"("role_key", "created_at");
CREATE INDEX IF NOT EXISTS "system_notifications_user_id_created_at_idx" ON "system_notifications"("user_id", "created_at");
