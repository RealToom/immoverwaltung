-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "property_id" INTEGER,
ADD COLUMN     "suggested_property_id" INTEGER,
ADD COLUMN     "suggested_tenant_id" INTEGER,
ADD COLUMN     "tenant_id" INTEGER;

-- CreateIndex
CREATE INDEX "email_messages_company_id_suggested_tenant_id_idx" ON "email_messages"("company_id", "suggested_tenant_id");

-- CreateIndex
CREATE INDEX "email_messages_company_id_tenant_id_idx" ON "email_messages"("company_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_suggested_tenant_id_fkey" FOREIGN KEY ("suggested_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_suggested_property_id_fkey" FOREIGN KEY ("suggested_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
