-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BetrkvCategory" ADD VALUE 'HEIZUNG';
ALTER TYPE "BetrkvCategory" ADD VALUE 'WARMWASSER';

-- AlterTable
ALTER TABLE "billing_disputes" ADD COLUMN     "year" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'OFFEN';

-- Data fix: unify dispute status values (English OPEN -> German OFFEN)
UPDATE "billing_disputes" SET "status" = 'OFFEN' WHERE "status" = 'OPEN';

-- Data fix: normalize transaction sign convention. AUSGABE is stored negative,
-- EINNAHME positive; API-created rows were stored positive until now.
UPDATE "transactions" SET "amount" = -ABS("amount") WHERE "type" = 'AUSGABE';
UPDATE "transactions" SET "amount" = ABS("amount") WHERE "type" = 'EINNAHME';
