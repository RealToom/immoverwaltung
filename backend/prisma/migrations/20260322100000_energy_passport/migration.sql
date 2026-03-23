-- CreateEnum
CREATE TYPE "EnergyPassportType" AS ENUM ('VERBRAUCH', 'BEDARF');

-- CreateTable
CREATE TABLE "energy_passports" (
    "id" SERIAL NOT NULL,
    "certificate_type" "EnergyPassportType" NOT NULL,
    "energy_class" TEXT NOT NULL,
    "primary_energy_demand" DOUBLE PRECISION,
    "final_energy_demand" DOUBLE PRECISION,
    "energy_carrier" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "certificate_number" TEXT,
    "property_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "energy_passports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "energy_passports_property_id_key" ON "energy_passports"("property_id");

-- AddForeignKey
ALTER TABLE "energy_passports" ADD CONSTRAINT "energy_passports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_passports" ADD CONSTRAINT "energy_passports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
