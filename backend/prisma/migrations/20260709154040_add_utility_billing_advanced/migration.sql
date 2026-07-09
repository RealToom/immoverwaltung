-- CreateEnum
CREATE TYPE "BetrkvCategory" AS ENUM ('GRUNDSTEUER', 'WASSERVERSORGUNG', 'ENTWAESSERUNG', 'AUFZUG', 'STRASSENREINIGUNG_MUELL', 'GEBAEUDE_REINIGUNG', 'GARTENPFLEGE', 'BELEUCHTUNG', 'SCHORNSTEINREINIGUNG', 'VERSICHERUNGEN', 'HAUSWART', 'GEMEINSCHAFTS_ANTENNE', 'WASCHRAUM', 'SONSTIGE_KOSTEN');

-- CreateEnum
CREATE TYPE "DistributionKey" AS ENUM ('WOHNFLAECHE', 'PERSONEN', 'WOHNEINHEIT', 'VERBRAUCH');

-- CreateEnum
CREATE TYPE "MeterInterfaceType" AS ENUM ('MANUAL', 'MQTT', 'MODBUS_TCP', 'KNX');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "utility_prepayment" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "energy_passports" ADD COLUMN     "co2_emissions" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "meters" ADD COLUMN     "interface_type" "MeterInterfaceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "knx_group_address" TEXT,
ADD COLUMN     "modbus_register" INTEGER,
ADD COLUMN     "mqtt_topic" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "cost_configuration" JSONB;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "betrkv_category" "BetrkvCategory",
ADD COLUMN     "co2_tax_amount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "maintenance_warning" TEXT;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "coownership_share" DOUBLE PRECISION,
ADD COLUMN     "current_inhabitants" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sqm" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "billing_disputes" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_disputes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "billing_disputes" ADD CONSTRAINT "billing_disputes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_disputes" ADD CONSTRAINT "billing_disputes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
