-- CreateEnum
CREATE TYPE "RentPaymentStatus" AS ENUM ('PUENKTLICH', 'VERSPAETET', 'AUSSTEHEND');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "date_format" TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
ADD COLUMN     "items_per_page" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'de';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notification_prefs" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "rent_payments" (
    "id" SERIAL NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amount_due" DOUBLE PRECISION NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "RentPaymentStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "contract_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rent_payments_contract_id_month_key" ON "rent_payments"("contract_id", "month");

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
