-- Verzugszinsen (§ 288 BGB) je Mahnung
ALTER TABLE "dunning_records" ADD COLUMN "interest_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
