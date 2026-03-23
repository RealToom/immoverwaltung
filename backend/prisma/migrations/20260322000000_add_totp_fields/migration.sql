-- Add TOTP fields to users table
ALTER TABLE "users" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "totp_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "totp_bypassed_by_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "totp_backup_codes" TEXT[] NOT NULL DEFAULT '{}';
