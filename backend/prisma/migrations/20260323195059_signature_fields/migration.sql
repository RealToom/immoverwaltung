-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('AUSSTEHEND', 'ABGESCHLOSSEN', 'ABGELEHNT', 'ABGELAUFEN');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "signature_request_id" TEXT,
ADD COLUMN "signature_status" "SignatureStatus",
ADD COLUMN "signed_document_id" TEXT,
ADD COLUMN "signed_document_url" TEXT;
