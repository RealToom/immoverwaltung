-- CreateEnum
CREATE TYPE "UtilityStatementStatus" AS ENUM ('FINALISIERT', 'KORRIGIERT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('OFFEN', 'BEZAHLT', 'VERRECHNET');

-- AlterEnum
ALTER TYPE "MeterType" ADD VALUE 'WARMWASSER';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "occupants_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "billing_period_start_month" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "labor_cost_amount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "receipt_document_id" INTEGER;

-- CreateTable
CREATE TABLE "utility_statements" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "delivery_deadline" TIMESTAMP(3) NOT NULL,
    "status" "UtilityStatementStatus" NOT NULL DEFAULT 'FINALISIERT',
    "total_costs" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_by_id" INTEGER,

    CONSTRAINT "utility_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_statement_items" (
    "id" SERIAL NOT NULL,
    "statement_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "unit_number" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "heating_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_prepaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL,
    "is_refund" BOOLEAN NOT NULL,
    "document_id" INTEGER,
    "suggested_prepayment" DOUBLE PRECISION,
    "delivered_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "settlement_status" "SettlementStatus" NOT NULL DEFAULT 'OFFEN',
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "utility_statement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "utility_statements_company_id_property_id_year_idx" ON "utility_statements"("company_id", "property_id", "year");

-- CreateIndex
CREATE INDEX "utility_statement_items_company_id_tenant_id_idx" ON "utility_statement_items"("company_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receipt_document_id_fkey" FOREIGN KEY ("receipt_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_statements" ADD CONSTRAINT "utility_statements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_statements" ADD CONSTRAINT "utility_statements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_statements" ADD CONSTRAINT "utility_statements_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "utility_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_statement_items" ADD CONSTRAINT "utility_statement_items_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "utility_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
