-- P0-B: عمود خصم التأخر النقدي في بنود المسير (idempotent — آمن على مخطط منحرف)
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "late_deduct" DECIMAL(12,2) NOT NULL DEFAULT 0;
