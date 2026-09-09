-- Add credential vault fields for auto-generated initial passwords (encrypted at rest)
ALTER TABLE "users" ADD COLUMN "initial_password_enc" TEXT;
ALTER TABLE "users" ADD COLUMN "password_issued_at" TIMESTAMP(3);
