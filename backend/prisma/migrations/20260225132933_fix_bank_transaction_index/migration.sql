-- DropIndex
DROP INDEX "bank_transactions_bank_account_id_idx";

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_booking_date_idx" ON "bank_transactions"("bank_account_id", "booking_date");
