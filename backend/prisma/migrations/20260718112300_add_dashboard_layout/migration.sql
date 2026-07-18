-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_user_id_key" ON "dashboard_layouts"("user_id");

-- CreateIndex
CREATE INDEX "dashboard_layouts_company_id_idx" ON "dashboard_layouts"("company_id");

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
