-- CreateTable
CREATE TABLE "maintenance_budgets" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "planned_amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "property_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_budgets_company_id_idx" ON "maintenance_budgets"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_budgets_company_id_property_id_year_key" ON "maintenance_budgets"("company_id", "property_id", "year");

-- AddForeignKey
ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
