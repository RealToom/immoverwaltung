-- Recurrence + reminders + entity links for calendar events; notifications table
CREATE TYPE "RecurrenceFreq" AS ENUM ('TAEGLICH', 'WOECHENTLICH', 'MONATLICH', 'JAEHRLICH');

ALTER TABLE "calendar_events"
  ADD COLUMN "recurrence_freq" "RecurrenceFreq",
  ADD COLUMN "recurrence_interval" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "recurrence_until" TIMESTAMP(3),
  ADD COLUMN "reminder_minutes" INTEGER,
  ADD COLUMN "reminder_sent_for" TIMESTAMP(3),
  ADD COLUMN "property_id" INTEGER,
  ADD COLUMN "tenant_id" INTEGER,
  ADD COLUMN "visitor_name" TEXT,
  ADD COLUMN "visitor_contact" TEXT;

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "notifications"("company_id");
CREATE INDEX "calendar_events_property_id_idx" ON "calendar_events"("property_id");
CREATE INDEX "calendar_events_tenant_id_idx" ON "calendar_events"("tenant_id");
