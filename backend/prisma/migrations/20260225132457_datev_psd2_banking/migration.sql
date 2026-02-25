-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('MANUAL', 'NORDIGEN');

-- CreateEnum
CREATE TYPE "BankTxStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ChartOfAccounts" AS ENUM ('SKR03', 'SKR04');

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "institution_id" TEXT,
ADD COLUMN     "nordigen_account_id" TEXT,
ADD COLUMN     "provider" "BankProvider" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "requisition_id" TEXT;

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" SERIAL NOT NULL,
    "nordigen_id" TEXT NOT NULL,
    "booking_date" TIMESTAMP(3) NOT NULL,
    "value_date" TIMESTAMP(3),
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "remittance_info" TEXT NOT NULL DEFAULT '',
    "creditor_name" TEXT,
    "creditor_iban" TEXT,
    "debtor_name" TEXT,
    "debtor_iban" TEXT,
    "status" "BankTxStatus" NOT NULL DEFAULT 'UNMATCHED',
    "bank_account_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "rent_payment_id" INTEGER,
    "transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_accounting_settings" (
    "id" SERIAL NOT NULL,
    "beraternummer" INTEGER,
    "mandantennummer" INTEGER,
    "kontenrahmen" "ChartOfAccounts" NOT NULL DEFAULT 'SKR03',
    "default_bank_account" TEXT NOT NULL DEFAULT '1810',
    "default_income_account" TEXT NOT NULL DEFAULT '8400',
    "default_expense_account" TEXT NOT NULL DEFAULT '4900',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 1,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_accounting_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_account_mappings" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datev_export_logs" (
    "id" SERIAL NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "tx_count" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datev_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_nordigen_id_key" ON "bank_transactions"("nordigen_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_transaction_id_key" ON "bank_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_status_idx" ON "bank_transactions"("company_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_accounting_settings_company_id_key" ON "company_accounting_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_account_mappings_company_id_category_key" ON "category_account_mappings"("company_id", "category");

-- CreateIndex
CREATE INDEX "datev_export_logs_company_id_idx" ON "datev_export_logs"("company_id");

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_rent_payment_id_fkey" FOREIGN KEY ("rent_payment_id") REFERENCES "rent_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_accounting_settings" ADD CONSTRAINT "company_accounting_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_account_mappings" ADD CONSTRAINT "category_account_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datev_export_logs" ADD CONSTRAINT "datev_export_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
