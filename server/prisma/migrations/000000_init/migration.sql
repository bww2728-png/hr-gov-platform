-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'locked');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'notice_period', 'on_leave', 'terminated');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('full_time', 'part_time', 'contract', 'intern', 'consultant');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('running', 'approved', 'rejected', 'escalated', 'cancelled');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('open', 'in_progress', 'resolved', 'false_positive');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('identified', 'assessed', 'mitigated', 'accepted', 'closed');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('pending', 'in_progress', 'done', 'blocked', 'skipped');

-- CreateEnum
CREATE TYPE "KPIPeriod" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_catalog" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "full_name_ar" TEXT NOT NULL,
    "full_name_en" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "employee_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "initial_password_enc" TEXT,
    "password_issued_at" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "language_pref" TEXT NOT NULL DEFAULT 'ar',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scopes" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" INTEGER NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT true,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "region_id" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "working_hours" TEXT NOT NULL DEFAULT '08:00-17:00',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "parent_id" INTEGER,
    "head_employee_id" TEXT,
    "branch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "min_salary" DECIMAL(12,2),
    "max_salary" DECIMAL(12,2),
    "is_vacant" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "full_name_ar" TEXT NOT NULL,
    "full_name_en" TEXT,
    "national_id" TEXT,
    "nationality" TEXT,
    "resident_type" TEXT NOT NULL DEFAULT 'saudi',
    "gender" TEXT,
    "marital_status" TEXT,
    "dob_gregorian" TIMESTAMP(3),
    "dob_hijri" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "contract_end_date" TIMESTAMP(3),
    "contractType" "ContractType" NOT NULL DEFAULT 'full_time',
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active',
    "probation_end_date" TIMESTAMP(3),
    "branch_id" INTEGER NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "manager_id" TEXT,
    "salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "bank_account" TEXT,
    "bank_name" TEXT,
    "iban" TEXT,
    "profile_photo" TEXT,
    "notes" TEXT,
    "section_id" INTEGER,
    "sponsor_code" TEXT,
    "visa_type_code" TEXT,
    "job_category_code" TEXT,
    "qualification_code" TEXT,
    "housing_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transport_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "passport_number" TEXT,
    "iqama_number" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_history" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "approved_by_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description" TEXT,
    "branch_id" INTEGER,
    "dept_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "openings" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" SERIAL NOT NULL,
    "full_name_ar" TEXT NOT NULL,
    "full_name_en" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "resume_url" TEXT,
    "parsed_data" JSONB,
    "bias_flags" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "posting_id" INTEGER NOT NULL,
    "stage" "CandidateStage" NOT NULL DEFAULT 'applied',
    "score" DOUBLE PRECISION,
    "bias_score" DOUBLE PRECISION,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER NOT NULL DEFAULT 60,
    "panel_json" JSONB,
    "feedback_json" JSONB,
    "decision" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "salary" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "benefits" JSONB,
    "start_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "task_code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assignee_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_interviews" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "conducted_at" TIMESTAMP(3),
    "conducted_by_id" TEXT,
    "primary_reason" TEXT,
    "five_whys_json" JSONB,
    "knowledge_transfer" JSONB,
    "feedback_json" JSONB,
    "satisfaction_score" INTEGER,
    "rehire_eligible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT,
    "content_markdown" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "author_id" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_version_id" INTEGER,
    "related_decision_id" INTEGER,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_records" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "context_markdown" TEXT NOT NULL,
    "decision_markdown" TEXT NOT NULL,
    "consequences_markdown" TEXT,
    "decided_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "related_docs_json" JSONB,
    "previous_hash" TEXT,
    "current_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'SA',
    "effective_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "auto_renewal" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "definition_json" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" SERIAL NOT NULL,
    "definition_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "current_step" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "step_code" TEXT NOT NULL,
    "step_name_ar" TEXT NOT NULL,
    "assignee_id" TEXT,
    "decision" TEXT,
    "decided_at" TIMESTAMP(3),
    "comments" TEXT,
    "sla_minutes" INTEGER NOT NULL DEFAULT 60,
    "sla_deadline" TIMESTAMP(3) NOT NULL,
    "escalated_at" TIMESTAMP(3),
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rules" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'SA',
    "rule_json" JSONB NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'warning',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_violations" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "status" "ViolationStatus" NOT NULL DEFAULT 'open',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "details" JSONB,

    CONSTRAINT "compliance_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_expiries" (
    "id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_ref" TEXT,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "alert_30_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_7_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_0_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_expiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_kpis" (
    "id" SERIAL NOT NULL,
    "process_code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "target_value" DOUBLE PRECISION NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "measurement_unit" TEXT NOT NULL,
    "frequency" "KPIPeriod" NOT NULL DEFAULT 'monthly',
    "direction" TEXT NOT NULL DEFAULT 'higher_is_better',
    "gap_auto" DOUBLE PRECISION,
    "owner_id" TEXT,
    "last_measured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maturity_dimensions" (
    "id" SERIAL NOT NULL,
    "axis_id" INTEGER NOT NULL,
    "axis_name_ar" TEXT NOT NULL,
    "axis_name_en" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "maturity_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maturity_assessments" (
    "id" SERIAL NOT NULL,
    "dimension_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "evidence" TEXT,
    "target_score" INTEGER,
    "target_date" TIMESTAMP(3),
    "assessor_id" TEXT NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "maturity_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_whys_analyses" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "problem_desc" TEXT NOT NULL,
    "tree_json" JSONB NOT NULL,
    "root_cause" TEXT,
    "corrective_action" TEXT,
    "created_by_id" TEXT NOT NULL,
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "five_whys_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'low',
    "owner_id" TEXT,
    "mitigation_plan" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'identified',
    "review_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_items" (
    "id" SERIAL NOT NULL,
    "week_number" INTEGER NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT,
    "dependencies" JSONB NOT NULL DEFAULT '[]',
    "deliverable" TEXT,
    "kpi" TEXT,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'pending',
    "target_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "payload_json" JSONB,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_endpoints" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "auth_type" TEXT NOT NULL DEFAULT 'api_key',
    "health_status" TEXT NOT NULL DEFAULT 'unknown',
    "last_checked_at" TIMESTAMP(3),
    "config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" SERIAL NOT NULL,
    "endpoint_id" INTEGER NOT NULL,
    "request_id" TEXT NOT NULL,
    "request_body" JSONB,
    "response_body" JSONB,
    "status" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookups" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value_ar" TEXT NOT NULL,
    "value_en" TEXT NOT NULL,
    "parent_category" TEXT,
    "parent_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "rules_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carried" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "manager_id" TEXT,
    "manager_note" TEXT,
    "hr_approver_id" TEXT,
    "hr_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_holidays" (
    "id" SERIAL NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "official_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT 'manual',
    "late_mins" INTEGER NOT NULL DEFAULT 0,
    "early_mins" INTEGER NOT NULL DEFAULT 0,
    "worked_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'present',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "year_cap" INTEGER NOT NULL DEFAULT 720,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_incidents" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mins_late" INTEGER,
    "has_excuse" BOOLEAN NOT NULL DEFAULT false,
    "excuse_note" TEXT,
    "action" TEXT,
    "occurrence" INTEGER NOT NULL DEFAULT 1,
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_gosi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prepared_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "approved_by_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "wps_file_id" INTEGER,
    "params_snapshot_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_ledger_entries" (
    "id" TEXT NOT NULL,
    "run_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "housing" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtime_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gosi_employee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gosi_employer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loan_deduct" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "absence_deduct" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deduct" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "iban" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "monthly_deduct" DECIMAL(12,2) NOT NULL,
    "remaining" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" TEXT,
    "start_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonuses" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "nominated_by_id" TEXT,
    "payroll_run_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eos_calculations" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "service_years" DOUBLE PRECISION NOT NULL,
    "last_salary" DECIMAL(12,2) NOT NULL,
    "eos_amount" DECIMAL(12,2) NOT NULL,
    "other_dues" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_payable" DECIMAL(12,2) NOT NULL,
    "formula_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'calculated',
    "calculated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eos_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perf_cycles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perf_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" SERIAL NOT NULL,
    "objective_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perf_reviews" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "self_score" DOUBLE PRECISION,
    "manager_score" DOUBLE PRECISION,
    "final_score" DOUBLE PRECISION,
    "rating" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_self',
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perf_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_entries" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "giver_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cycle_id" INTEGER,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "sentiment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pips" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "goals_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "outcome_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT,
    "duration_hrs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sessions" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "trainer_name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "attended_hrs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "test_score" DOUBLE PRECISION,
    "eval_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idps" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "goals_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "review_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoring_pairs" (
    "id" SERIAL NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "mentee_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "focus_area" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sessions_log" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoring_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_plans" (
    "id" SERIAL NOT NULL,
    "position_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "succession_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_candidates" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "readiness" TEXT NOT NULL,
    "development_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "succession_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hipo_members" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "nominated_by_id" TEXT,
    "program_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hipo_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" SERIAL NOT NULL,
    "survey_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "scale" TEXT NOT NULL DEFAULT '0_10',
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" SERIAL NOT NULL,
    "survey_id" INTEGER NOT NULL,
    "answers_json" JSONB NOT NULL,
    "dept_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_interviews" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "conducted_by_id" TEXT NOT NULL,
    "conducted_at" TIMESTAMP(3) NOT NULL,
    "satisfaction" INTEGER,
    "issues_json" JSONB,
    "actions_json" JSONB,
    "follow_up_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'done',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stay_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_cases" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "violation" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "investigation_note" TEXT,
    "employee_defense" TEXT,
    "action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "appeal_note" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinary_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "resolution" TEXT,
    "resolved_by_id" TEXT,
    "escalated_to_id" TEXT,
    "satisfied" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visas" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT,
    "candidate_name" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "fees_paid" DECIMAL(10,2),
    "ref_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iqama_records" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "iqama_number" TEXT,
    "profession" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iqama_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gosi_records" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "gosi_number" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL,
    "salary_base" DECIMAL(12,2) NOT NULL,
    "employee_share" DECIMAL(10,2) NOT NULL,
    "employer_share" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gosi_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamca_records" (
    "id" SERIAL NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "passport_no" TEXT,
    "exam_date" TIMESTAMP(3),
    "result" TEXT,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gamca_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT,
    "candidate_name" TEXT,
    "document_type" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'university',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kafala_transfers" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "from_employer" TEXT,
    "to_employer" TEXT,
    "reason" TEXT,
    "current_sponsor_ok" BOOLEAN NOT NULL DEFAULT false,
    "fees_paid" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kafala_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huroob_reports" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "absence_since" TIMESTAMP(3) NOT NULL,
    "warnings_sent" INTEGER NOT NULL DEFAULT 0,
    "reported_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'monitoring',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "huroob_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "policy_number" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "premium" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_members" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'self',
    "card_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT,
    "file_url" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probation_reviews" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "review_date" TIMESTAMP(3) NOT NULL,
    "performance" TEXT NOT NULL,
    "notes" TEXT,
    "decision" TEXT,
    "reviewer_id" TEXT,
    "confirmed_flag" BOOLEAN NOT NULL DEFAULT false,
    "extended_until" TIMESTAMP(3),
    "action_type" TEXT,
    "action_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nitaqat_snapshots" (
    "id" SERIAL NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "total_employees" INTEGER NOT NULL,
    "saudi_count" INTEGER NOT NULL,
    "expat_count" INTEGER NOT NULL,
    "saudization_pct" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nitaqat_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wps_files" (
    "id" SERIAL NOT NULL,
    "payroll_run_id" INTEGER,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "file_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "uploaded_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wps_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_reports" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payload_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulatory_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "workflow_def_code" TEXT,
    "form_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "request_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_requests" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "employee_id" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "workflow_instance_id" INTEGER,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "source" TEXT NOT NULL DEFAULT 'lookup',
    "source_table" TEXT,
    "owner_roles" JSONB NOT NULL,
    "approver_roles" JSONB NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookup_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "target_key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "before_json" JSONB,
    "reason" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "approver_chain" JSONB NOT NULL,
    "current_stage" INTEGER NOT NULL DEFAULT 0,
    "approvals_json" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_note" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_definitions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "expression_ar" TEXT NOT NULL,
    "logic_json" JSONB,
    "variables_json" JSONB NOT NULL,
    "example_json" JSONB,
    "owner_roles" JSONB NOT NULL,
    "approver_roles" JSONB NOT NULL,
    "requires_ceo" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formula_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "contract_no" TEXT,
    "type" TEXT NOT NULL DEFAULT 'full_time',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "housing" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "qiwa_number" TEXT,
    "renewal_of_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "dept_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "from_branch_id" INTEGER,
    "from_dept_id" INTEGER,
    "from_section_id" INTEGER,
    "from_position_id" INTEGER,
    "to_branch_id" INTEGER,
    "to_dept_id" INTEGER,
    "to_section_id" INTEGER,
    "to_position_id" INTEGER,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT,
    "approved_by" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "from_position_id" INTEGER,
    "to_position_id" INTEGER,
    "from_category" TEXT,
    "to_category" TEXT,
    "from_salary" DECIMAL(12,2),
    "to_salary" DECIMAL(12,2),
    "effective_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "proposed_by" TEXT,
    "approved_by" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qiwa_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT,
    "request_no" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload_json" JSONB,
    "response_json" JSONB,
    "raised_by" TEXT,
    "raised_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qiwa_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_parameters" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "description_ar" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'number',
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
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_catalog_code_key" ON "permission_catalog"("code");

-- CreateIndex
CREATE INDEX "permission_catalog_module_idx" ON "permission_catalog"("module");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_scopes_scope_type_scope_id_idx" ON "user_scopes"("scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scopes_user_id_scope_type_scope_id_key" ON "user_scopes"("user_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_region_id_idx" ON "branches"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_branch_id_idx" ON "departments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_dept_id_idx" ON "positions"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_national_id_key" ON "employees"("national_id");

-- CreateIndex
CREATE INDEX "employees_branch_id_idx" ON "employees"("branch_id");

-- CreateIndex
CREATE INDEX "employees_dept_id_idx" ON "employees"("dept_id");

-- CreateIndex
CREATE INDEX "employees_manager_id_idx" ON "employees"("manager_id");

-- CreateIndex
CREATE INDEX "employees_employment_status_idx" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "employees_resident_type_idx" ON "employees"("resident_type");

-- CreateIndex
CREATE INDEX "employee_history_employee_id_idx" ON "employee_history"("employee_id");

-- CreateIndex
CREATE INDEX "employee_history_change_type_idx" ON "employee_history"("change_type");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_code_key" ON "job_postings"("code");

-- CreateIndex
CREATE INDEX "job_postings_status_idx" ON "job_postings"("status");

-- CreateIndex
CREATE INDEX "job_postings_branch_id_idx" ON "job_postings"("branch_id");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_source_idx" ON "candidates"("source");

-- CreateIndex
CREATE INDEX "applications_stage_idx" ON "applications"("stage");

-- CreateIndex
CREATE INDEX "applications_posting_id_idx" ON "applications"("posting_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_candidate_id_posting_id_key" ON "applications"("candidate_id", "posting_id");

-- CreateIndex
CREATE INDEX "interviews_application_id_idx" ON "interviews"("application_id");

-- CreateIndex
CREATE INDEX "interviews_scheduled_at_idx" ON "interviews"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "offers_application_id_key" ON "offers"("application_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_employee_id_idx" ON "onboarding_tasks"("employee_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_status_idx" ON "onboarding_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "exit_interviews_employee_id_key" ON "exit_interviews"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_code_key" ON "knowledge_documents"("code");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_category_idx" ON "knowledge_documents"("category");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_code_key" ON "decision_records"("code");

-- CreateIndex
CREATE INDEX "decision_records_decided_at_idx" ON "decision_records"("decided_at");

-- CreateIndex
CREATE UNIQUE INDEX "policies_code_key" ON "policies"("code");

-- CreateIndex
CREATE INDEX "policies_jurisdiction_idx" ON "policies"("jurisdiction");

-- CreateIndex
CREATE INDEX "policies_status_idx" ON "policies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_code_key" ON "workflow_definitions"("code");

-- CreateIndex
CREATE INDEX "workflow_instances_entity_type_entity_id_idx" ON "workflow_instances"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "workflow_instances_status_idx" ON "workflow_instances"("status");

-- CreateIndex
CREATE INDEX "workflow_steps_instance_id_idx" ON "workflow_steps"("instance_id");

-- CreateIndex
CREATE INDEX "workflow_steps_assignee_id_idx" ON "workflow_steps"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rules_code_key" ON "compliance_rules"("code");

-- CreateIndex
CREATE INDEX "compliance_rules_jurisdiction_idx" ON "compliance_rules"("jurisdiction");

-- CreateIndex
CREATE INDEX "compliance_violations_status_idx" ON "compliance_violations"("status");

-- CreateIndex
CREATE INDEX "compliance_violations_severity_idx" ON "compliance_violations"("severity");

-- CreateIndex
CREATE INDEX "compliance_violations_entity_type_entity_id_idx" ON "compliance_violations"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "document_expiries_expiry_date_idx" ON "document_expiries"("expiry_date");

-- CreateIndex
CREATE INDEX "document_expiries_entity_type_entity_id_idx" ON "document_expiries"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_kpis_process_code_name_ar_key" ON "process_kpis"("process_code", "name_ar");

-- CreateIndex
CREATE UNIQUE INDEX "maturity_dimensions_axis_id_code_key" ON "maturity_dimensions"("axis_id", "code");

-- CreateIndex
CREATE INDEX "maturity_assessments_dimension_id_idx" ON "maturity_assessments"("dimension_id");

-- CreateIndex
CREATE INDEX "maturity_assessments_assessed_at_idx" ON "maturity_assessments"("assessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "risks_code_key" ON "risks"("code");

-- CreateIndex
CREATE INDEX "risks_status_idx" ON "risks"("status");

-- CreateIndex
CREATE INDEX "risks_level_idx" ON "risks"("level");

-- CreateIndex
CREATE INDEX "roadmap_items_week_number_idx" ON "roadmap_items"("week_number");

-- CreateIndex
CREATE INDEX "roadmap_items_status_idx" ON "roadmap_items"("status");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX "analytics_events_entity_type_entity_id_idx" ON "analytics_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_endpoints_code_key" ON "integration_endpoints"("code");

-- CreateIndex
CREATE INDEX "integration_logs_endpoint_id_idx" ON "integration_logs"("endpoint_id");

-- CreateIndex
CREATE INDEX "integration_logs_created_at_idx" ON "integration_logs"("created_at");

-- CreateIndex
CREATE INDEX "lookups_category_idx" ON "lookups"("category");

-- CreateIndex
CREATE INDEX "lookups_parent_category_parent_code_idx" ON "lookups"("parent_category", "parent_code");

-- CreateIndex
CREATE UNIQUE INDEX "lookups_category_code_key" ON "lookups"("category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

-- CreateIndex
CREATE INDEX "leave_balances_employee_id_idx" ON "leave_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_year_key" ON "leave_balances"("employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_idx" ON "leave_requests"("start_date");

-- CreateIndex
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "overtime_requests_employee_id_idx" ON "overtime_requests"("employee_id");

-- CreateIndex
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests"("status");

-- CreateIndex
CREATE INDEX "attendance_incidents_employee_id_idx" ON "attendance_incidents"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_incidents_type_idx" ON "attendance_incidents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_code_key" ON "payroll_runs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_month_year_key" ON "payroll_runs"("month", "year");

-- CreateIndex
CREATE INDEX "payroll_ledger_entries_run_id_idx" ON "payroll_ledger_entries"("run_id");

-- CreateIndex
CREATE INDEX "payroll_ledger_entries_employee_id_idx" ON "payroll_ledger_entries"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_items_employee_id_idx" ON "payroll_items"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_items_run_id_employee_id_key" ON "payroll_items"("run_id", "employee_id");

-- CreateIndex
CREATE INDEX "loans_employee_id_idx" ON "loans"("employee_id");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "bonuses_employee_id_idx" ON "bonuses"("employee_id");

-- CreateIndex
CREATE INDEX "bonuses_status_idx" ON "bonuses"("status");

-- CreateIndex
CREATE INDEX "eos_calculations_employee_id_idx" ON "eos_calculations"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "perf_cycles_code_key" ON "perf_cycles"("code");

-- CreateIndex
CREATE INDEX "objectives_employee_id_idx" ON "objectives"("employee_id");

-- CreateIndex
CREATE INDEX "objectives_cycle_id_idx" ON "objectives"("cycle_id");

-- CreateIndex
CREATE INDEX "key_results_objective_id_idx" ON "key_results"("objective_id");

-- CreateIndex
CREATE INDEX "perf_reviews_employee_id_idx" ON "perf_reviews"("employee_id");

-- CreateIndex
CREATE INDEX "perf_reviews_cycle_id_idx" ON "perf_reviews"("cycle_id");

-- CreateIndex
CREATE INDEX "feedback_entries_employee_id_idx" ON "feedback_entries"("employee_id");

-- CreateIndex
CREATE INDEX "pips_employee_id_idx" ON "pips"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "course_sessions_course_id_idx" ON "course_sessions"("course_id");

-- CreateIndex
CREATE INDEX "enrollments_employee_id_idx" ON "enrollments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_session_id_employee_id_key" ON "enrollments"("session_id", "employee_id");

-- CreateIndex
CREATE INDEX "certificates_employee_id_idx" ON "certificates"("employee_id");

-- CreateIndex
CREATE INDEX "idps_employee_id_idx" ON "idps"("employee_id");

-- CreateIndex
CREATE INDEX "mentoring_pairs_mentor_id_idx" ON "mentoring_pairs"("mentor_id");

-- CreateIndex
CREATE INDEX "mentoring_pairs_mentee_id_idx" ON "mentoring_pairs"("mentee_id");

-- CreateIndex
CREATE UNIQUE INDEX "succession_candidates_plan_id_employee_id_key" ON "succession_candidates"("plan_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hipo_members_employee_id_key" ON "hipo_members"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_code_key" ON "surveys"("code");

-- CreateIndex
CREATE INDEX "survey_questions_survey_id_idx" ON "survey_questions"("survey_id");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_idx" ON "survey_responses"("survey_id");

-- CreateIndex
CREATE INDEX "stay_interviews_employee_id_idx" ON "stay_interviews"("employee_id");

-- CreateIndex
CREATE INDEX "disciplinary_cases_employee_id_idx" ON "disciplinary_cases"("employee_id");

-- CreateIndex
CREATE INDEX "disciplinary_cases_status_idx" ON "disciplinary_cases"("status");

-- CreateIndex
CREATE INDEX "grievances_employee_id_idx" ON "grievances"("employee_id");

-- CreateIndex
CREATE INDEX "grievances_status_idx" ON "grievances"("status");

-- CreateIndex
CREATE INDEX "visas_employee_id_idx" ON "visas"("employee_id");

-- CreateIndex
CREATE INDEX "visas_type_idx" ON "visas"("type");

-- CreateIndex
CREATE INDEX "visas_status_idx" ON "visas"("status");

-- CreateIndex
CREATE INDEX "iqama_records_employee_id_idx" ON "iqama_records"("employee_id");

-- CreateIndex
CREATE INDEX "iqama_records_expires_at_idx" ON "iqama_records"("expires_at");

-- CreateIndex
CREATE INDEX "gosi_records_employee_id_idx" ON "gosi_records"("employee_id");

-- CreateIndex
CREATE INDEX "kafala_transfers_employee_id_idx" ON "kafala_transfers"("employee_id");

-- CreateIndex
CREATE INDEX "huroob_reports_employee_id_idx" ON "huroob_reports"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_policies_policy_number_key" ON "insurance_policies"("policy_number");

-- CreateIndex
CREATE INDEX "insurance_members_employee_id_idx" ON "insurance_members"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_members_policy_id_employee_id_relation_key" ON "insurance_members"("policy_id", "employee_id", "relation");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_doc_type_idx" ON "employee_documents"("doc_type");

-- CreateIndex
CREATE INDEX "employee_documents_expires_at_idx" ON "employee_documents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "probation_reviews_employee_id_milestone_key" ON "probation_reviews"("employee_id", "milestone");

-- CreateIndex
CREATE UNIQUE INDEX "wps_files_month_year_key" ON "wps_files"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "request_types_code_key" ON "request_types"("code");

-- CreateIndex
CREATE INDEX "employee_requests_employee_id_idx" ON "employee_requests"("employee_id");

-- CreateIndex
CREATE INDEX "employee_requests_type_id_idx" ON "employee_requests"("type_id");

-- CreateIndex
CREATE INDEX "employee_requests_status_idx" ON "employee_requests"("status");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "security_events_type_idx" ON "security_events"("type");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_categories_code_key" ON "lookup_categories"("code");

-- CreateIndex
CREATE INDEX "change_requests_status_idx" ON "change_requests"("status");

-- CreateIndex
CREATE INDEX "change_requests_kind_target_key_idx" ON "change_requests"("kind", "target_key");

-- CreateIndex
CREATE INDEX "change_requests_proposed_by_idx" ON "change_requests"("proposed_by");

-- CreateIndex
CREATE UNIQUE INDEX "formula_definitions_code_key" ON "formula_definitions"("code");

-- CreateIndex
CREATE INDEX "formula_definitions_category_idx" ON "formula_definitions"("category");

-- CreateIndex
CREATE INDEX "contracts_employee_id_idx" ON "contracts"("employee_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_end_date_idx" ON "contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "sections_code_key" ON "sections"("code");

-- CreateIndex
CREATE INDEX "sections_dept_id_idx" ON "sections"("dept_id");

-- CreateIndex
CREATE INDEX "transfers_employee_id_idx" ON "transfers"("employee_id");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "promotions_employee_id_idx" ON "promotions"("employee_id");

-- CreateIndex
CREATE INDEX "promotions_status_idx" ON "promotions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "qiwa_requests_request_no_key" ON "qiwa_requests"("request_no");

-- CreateIndex
CREATE INDEX "qiwa_requests_employee_id_idx" ON "qiwa_requests"("employee_id");

-- CreateIndex
CREATE INDEX "qiwa_requests_status_idx" ON "qiwa_requests"("status");

-- CreateIndex
CREATE INDEX "qiwa_requests_change_type_idx" ON "qiwa_requests"("change_type");

-- CreateIndex
CREATE UNIQUE INDEX "policy_parameters_code_key" ON "policy_parameters"("code");

-- CreateIndex
CREATE INDEX "policy_parameters_category_idx" ON "policy_parameters"("category");

-- CreateIndex
CREATE INDEX "policy_parameter_versions_parameter_code_effective_from_idx" ON "policy_parameter_versions"("parameter_code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "policy_parameter_versions_parameter_code_version_key" ON "policy_parameter_versions"("parameter_code", "version");

-- CreateIndex
CREATE INDEX "formula_revisions_formula_code_idx" ON "formula_revisions"("formula_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_posting_id_fkey" FOREIGN KEY ("posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compliance_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maturity_assessments" ADD CONSTRAINT "maturity_assessments_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "maturity_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "integration_endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_ledger_entries" ADD CONSTRAINT "payroll_ledger_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_ledger_entries" ADD CONSTRAINT "payroll_ledger_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "course_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_candidates" ADD CONSTRAINT "succession_candidates_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "succession_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_members" ADD CONSTRAINT "insurance_members_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "insurance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qiwa_requests" ADD CONSTRAINT "qiwa_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_parameter_versions" ADD CONSTRAINT "policy_parameter_versions_parameter_code_fkey" FOREIGN KEY ("parameter_code") REFERENCES "policy_parameters"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

