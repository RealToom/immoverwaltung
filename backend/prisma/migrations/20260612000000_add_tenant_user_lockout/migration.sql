-- AlterTable: account lockout for tenant portal users (10 attempts -> 30 min, same as admin users)
ALTER TABLE "tenant_users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3);
