-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('WOHNUNG', 'GARAGE', 'STELLPLATZ');

-- AlterTable properties: address aufteilen in street/zip/city (Phase 7)
ALTER TABLE "properties" ADD COLUMN "street" TEXT NOT NULL DEFAULT '';
ALTER TABLE "properties" ADD COLUMN "zip" TEXT NOT NULL DEFAULT '';
ALTER TABLE "properties" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "properties" DROP COLUMN "address";

-- AlterTable units: UnitType Spalte hinzufuegen
ALTER TABLE "units" ADD COLUMN "type" "UnitType" NOT NULL DEFAULT 'WOHNUNG';

-- DropIndex: Multi-Unit pro Mieter (Phase 7 - war 1:1, jetzt 1:n)
DROP INDEX "units_tenant_id_key";

-- AlterTable documents: property_id nullable, neue Felder, companyId
ALTER TABLE "documents" ALTER COLUMN "property_id" DROP NOT NULL;
ALTER TABLE "documents" ADD COLUMN "tenant_id" INTEGER;
ALTER TABLE "documents" ADD COLUMN "retention_until" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "is_encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "company_id" INTEGER;

-- Drop alte property_id FK (muss neu erstellt werden als nullable)
ALTER TABLE "documents" DROP CONSTRAINT "documents_property_id_fkey";

-- Backfill company_id aus Property
UPDATE "documents" d
SET "company_id" = p."company_id"
FROM "properties" p
WHERE d."property_id" = p."id";

-- Backfill company_id aus Tenant (fuer Dokumente ohne Property)
UPDATE "documents" d
SET "company_id" = t."company_id"
FROM "tenants" t
WHERE d."company_id" IS NULL AND d."tenant_id" = t."id";

-- Verwaiste Dokumente ohne Company entfernen
DELETE FROM "documents" WHERE "company_id" IS NULL;

-- Jetzt NOT NULL setzen
ALTER TABLE "documents" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateTable bank_accounts
CREATE TABLE "bank_accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL DEFAULT '',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_sync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable transactions: optionale Verknuepfung mit Bankkonto
ALTER TABLE "transactions" ADD COLUMN "bank_account_id" INTEGER;

-- AddForeignKey documents (nullable property_id + neuer tenant_id + company_id)
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey bank_accounts
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey transactions -> bank_accounts
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
