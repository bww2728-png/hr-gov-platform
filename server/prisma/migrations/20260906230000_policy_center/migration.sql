-- مركز قواعد وسياسات العمل: معايير السياسات + نسخها (Append-only) + شجرة المعادلات + snapshot المسير

-- CreateTable
CREATE TABLE "policy_parameters" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "description_ar" TEXT,
    "value_type" TEXT NOT NULL DEFAULT 'number',
    "unit_ar" TEXT,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "owner_roles" JSONB NOT NULL,
    "approver_roles" JSONB NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_parameter_versions" (
    "id" SERIAL NOT NULL,
    "parameter_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value_json" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "change_request_id" INTEGER,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_parameter_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_revisions" (
    "id" SERIAL NOT NULL,
    "formula_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "logic_json" JSONB,
    "expression_ar" TEXT,
    "reason" TEXT,
    "change_request_id" INTEGER,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_parameters_code_key" ON "policy_parameters"("code");

-- CreateIndex
CREATE INDEX "policy_parameters_category_idx" ON "policy_parameters"("category");

-- CreateIndex
CREATE UNIQUE INDEX "policy_parameter_versions_parameter_code_version_key" ON "policy_parameter_versions"("parameter_code", "version");

-- CreateIndex
CREATE INDEX "policy_parameter_versions_parameter_code_effective_from_idx" ON "policy_parameter_versions"("parameter_code", "effective_from");

-- CreateIndex
CREATE INDEX "formula_revisions_formula_code_idx" ON "formula_revisions"("formula_code");

-- AddForeignKey
ALTER TABLE "policy_parameter_versions" ADD CONSTRAINT "policy_parameter_versions_parameter_code_fkey" FOREIGN KEY ("parameter_code") REFERENCES "policy_parameters"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Columns على الجداول القائمة
ALTER TABLE "formula_definitions" ADD COLUMN "logic_json" JSONB;
ALTER TABLE "payroll_runs" ADD COLUMN "params_snapshot_json" JSONB;
