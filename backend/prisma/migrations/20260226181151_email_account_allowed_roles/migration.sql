-- AlterTable
ALTER TABLE "email_accounts" ADD COLUMN     "allowed_roles" TEXT[] DEFAULT ARRAY['ADMIN', 'VERWALTER', 'BUCHHALTER', 'READONLY']::TEXT[];
