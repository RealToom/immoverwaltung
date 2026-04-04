-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('SIMPLE', 'SIGNATURE_PAD');

-- CreateEnum
CREATE TYPE "TenantMessageDirection" AS ENUM ('TENANT_TO_ADMIN', 'ADMIN_TO_TENANT');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "primary_color" TEXT NOT NULL DEFAULT '#2563eb';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "requires_signature" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signature_data" TEXT,
ADD COLUMN     "signature_type" "SignatureType",
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by_tenant_user_id" INTEGER;

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "refresh_token" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_messages" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "tenant_user_id" INTEGER NOT NULL,
    "direction" "TenantMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_uploads" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "tenant_user_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Sonstiges',
    "description" TEXT,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_company_id_key" ON "tenant_users"("email", "company_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_signed_by_tenant_user_id_fkey" FOREIGN KEY ("signed_by_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_uploads" ADD CONSTRAINT "tenant_uploads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_uploads" ADD CONSTRAINT "tenant_uploads_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
