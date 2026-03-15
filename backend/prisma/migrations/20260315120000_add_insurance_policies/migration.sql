-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('GEBAEUDE', 'HAFTPFLICHT', 'ELEMENTAR', 'RECHTSSCHUTZ', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('AKTIV', 'ABGELAUFEN', 'GEKUENDIGT');

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policy_number" TEXT,
    "type" "InsuranceType" NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'AKTIV',
    "premium" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "property_id" INTEGER,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_policies_company_id_idx" ON "insurance_policies"("company_id");

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
