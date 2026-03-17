-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('TRIAL', 'PRO', 'BUSINESS');

-- AlterTable: add nullable first, then set defaults for existing rows, then enforce NOT NULL
ALTER TABLE "companies"
ADD COLUMN "stripe_customer_id"      TEXT,
ADD COLUMN "stripe_subscription_id"  TEXT,
ADD COLUMN "subscription_status"     "SubscriptionStatus",
ADD COLUMN "plan_type"               "PlanType",
ADD COLUMN "trial_ends_at"           TIMESTAMP(3),
ADD COLUMN "current_period_end"      TIMESTAMP(3),
ADD COLUMN "manual_override"         BOOLEAN NOT NULL DEFAULT false;

-- Set existing companies to MANUAL/PRO so they retain full access without interruption
UPDATE "companies"
SET subscription_status = 'MANUAL',
    plan_type = 'PRO',
    manual_override = true
WHERE subscription_status IS NULL OR plan_type IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "companies" ALTER COLUMN "subscription_status" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "plan_type" SET NOT NULL;
