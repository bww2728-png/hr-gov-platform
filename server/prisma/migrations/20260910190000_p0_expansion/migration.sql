-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "flexible_max_hours" INTEGER,
ADD COLUMN     "gosi_registration_date" TIMESTAMP(3),
ADD COLUMN     "gosi_subscription_wage" DECIMAL(12,2),
ADD COLUMN     "last_working_date" TIMESTAMP(3),
ADD COLUMN     "part_time_ratio" DECIMAL(4,2),
ADD COLUMN     "probation_days" INTEGER,
ADD COLUMN     "remote_location" TEXT,
ADD COLUMN     "work_tools_provided" BOOLEAN;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "wps_deadline" TIMESTAMP(3),
ADD COLUMN     "wps_file_generated_at" TIMESTAMP(3),
ADD COLUMN     "wps_status" TEXT DEFAULT 'pending',
ADD COLUMN     "wps_uploaded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payroll_ledger_entries" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "reversal_of_id" TEXT;

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "grace_in_mins" INTEGER NOT NULL DEFAULT 15,
    "early_leave_threshold_mins" INTEGER NOT NULL DEFAULT 15,
    "check_in_window_before_mins" INTEGER NOT NULL DEFAULT 60,
    "check_in_window_after_mins" INTEGER NOT NULL DEFAULT 120,
    "work_days" INTEGER[],
    "allow_holiday_check_in" BOOLEAN NOT NULL DEFAULT false,
    "late_deduction_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "weekly_hour_cap" INTEGER NOT NULL DEFAULT 45,
    "is_ramadan" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_adjustment_requests" (
    "id" SERIAL NOT NULL,
    "payroll_run_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "payload_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by_id" TEXT NOT NULL,
    "finance_decided_by_id" TEXT,
    "ceo_decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_adjustment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT,
    "requester_name" TEXT NOT NULL,
    "requester_contact" TEXT,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "due_date" TIMESTAMP(3) NOT NULL,
    "extended_due_date" TIMESTAMP(3),
    "resolution" TEXT,
    "decided_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ropa_entries" (
    "id" SERIAL NOT NULL,
    "activity_name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "legal_basis" TEXT NOT NULL,
    "data_categories" TEXT NOT NULL,
    "data_subject_categories" TEXT NOT NULL,
    "recipient_categories" TEXT NOT NULL,
    "retention_period" TEXT NOT NULL,
    "security_measures" TEXT NOT NULL,
    "international_transfer" BOOLEAN NOT NULL DEFAULT false,
    "transfer_destination" TEXT,
    "transfer_safeguards" TEXT,
    "dpo_owner_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ropa_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_breach_incidents" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affected_categories" TEXT,
    "containment_actions" TEXT,
    "sdaia_notified_at" TIMESTAMP(3),
    "subjects_notified_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reported_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_shifts_code_key" ON "work_shifts"("code");

-- CreateIndex
CREATE INDEX "shift_assignments_shift_id_idx" ON "shift_assignments"("shift_id");

-- CreateIndex
CREATE INDEX "shift_assignments_scope_ref_id_idx" ON "shift_assignments"("scope", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_scope_ref_id_start_date_key" ON "shift_assignments"("scope", "ref_id", "start_date");

-- CreateIndex
CREATE INDEX "period_adjustment_requests_payroll_run_id_idx" ON "period_adjustment_requests"("payroll_run_id");

-- CreateIndex
CREATE INDEX "dsar_requests_employee_id_idx" ON "dsar_requests"("employee_id");

-- CreateIndex
CREATE INDEX "dsar_requests_status_idx" ON "dsar_requests"("status");

-- CreateIndex
CREATE INDEX "data_breach_incidents_severity_idx" ON "data_breach_incidents"("severity");

-- AddForeignKey
ALTER TABLE "payroll_ledger_entries" ADD CONSTRAINT "payroll_ledger_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "payroll_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_adjustment_requests" ADD CONSTRAINT "period_adjustment_requests_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

