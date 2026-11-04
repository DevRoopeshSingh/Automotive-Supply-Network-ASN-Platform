-- CreateEnum RfqStatus
DO $$ BEGIN
    CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESPONSES_RECEIVED', 'UNDER_NEGOTIATION', 'AWARDED', 'REJECTED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum QuotationStatus
DO $$ BEGIN
    CREATE TYPE "QuotationStatus" AS ENUM ('SUBMITTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable sourcing_rfqs
CREATE TABLE IF NOT EXISTS "sourcing_rfqs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rfq_number" TEXT NOT NULL,
    "buyer_business_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "master_product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "target_price" DECIMAL(10,2),
    "delivery_address" TEXT NOT NULL,
    "delivery_city" TEXT NOT NULL,
    "delivery_state" TEXT NOT NULL,
    "delivery_postal_code" TEXT NOT NULL,
    "delivery_deadline" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "awarded_quotation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourcing_rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable sourcing_quotations
CREATE TABLE IF NOT EXISTS "sourcing_quotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_number" TEXT NOT NULL,
    "rfq_id" UUID NOT NULL,
    "supplier_business_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "available_quantity" INTEGER NOT NULL,
    "minimum_order_quantity" INTEGER NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "validity_until" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "terms" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourcing_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable quotation_revisions
CREATE TABLE IF NOT EXISTS "quotation_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "available_quantity" INTEGER NOT NULL,
    "minimum_order_quantity" INTEGER NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL,
    "validity_until" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable rfq_invited_suppliers
CREATE TABLE IF NOT EXISTS "rfq_invited_suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rfq_id" UUID NOT NULL,
    "supplier_business_id" UUID NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_invited_suppliers_pkey" PRIMARY KEY ("id")
);

-- Unique and standard indexes for sourcing_rfqs
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_rfqs_rfq_number_key" ON "sourcing_rfqs"("rfq_number");
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_rfqs_awarded_quotation_id_key" ON "sourcing_rfqs"("awarded_quotation_id");
CREATE INDEX IF NOT EXISTS "sourcing_rfqs_buyer_business_id_status_idx" ON "sourcing_rfqs"("buyer_business_id", "status");
CREATE INDEX IF NOT EXISTS "sourcing_rfqs_master_product_id_status_idx" ON "sourcing_rfqs"("master_product_id", "status");
CREATE INDEX IF NOT EXISTS "sourcing_rfqs_status_idx" ON "sourcing_rfqs"("status");
CREATE INDEX IF NOT EXISTS "sourcing_rfqs_expires_at_idx" ON "sourcing_rfqs"("expires_at");

-- Unique and standard indexes for sourcing_quotations
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_quotations_quote_number_key" ON "sourcing_quotations"("quote_number");
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_quotations_rfq_id_supplier_business_id_key" ON "sourcing_quotations"("rfq_id", "supplier_business_id");
CREATE INDEX IF NOT EXISTS "sourcing_quotations_rfq_id_status_idx" ON "sourcing_quotations"("rfq_id", "status");
CREATE INDEX IF NOT EXISTS "sourcing_quotations_supplier_business_id_status_idx" ON "sourcing_quotations"("supplier_business_id", "status");
CREATE INDEX IF NOT EXISTS "sourcing_quotations_validity_until_idx" ON "sourcing_quotations"("validity_until");

-- Indexes for quotation_revisions
CREATE UNIQUE INDEX IF NOT EXISTS "quotation_revisions_quotation_id_revision_number_key" ON "quotation_revisions"("quotation_id", "revision_number");
CREATE INDEX IF NOT EXISTS "quotation_revisions_quotation_id_idx" ON "quotation_revisions"("quotation_id");

-- Indexes for rfq_invited_suppliers
CREATE UNIQUE INDEX IF NOT EXISTS "rfq_invited_suppliers_rfq_id_supplier_business_id_key" ON "rfq_invited_suppliers"("rfq_id", "supplier_business_id");
CREATE INDEX IF NOT EXISTS "rfq_invited_suppliers_supplier_business_id_idx" ON "rfq_invited_suppliers"("supplier_business_id");

-- Foreign key constraints
ALTER TABLE "sourcing_rfqs" DROP CONSTRAINT IF EXISTS "sourcing_rfqs_buyer_business_id_fkey";
ALTER TABLE "sourcing_rfqs" ADD CONSTRAINT "sourcing_rfqs_buyer_business_id_fkey" FOREIGN KEY ("buyer_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sourcing_rfqs" DROP CONSTRAINT IF EXISTS "sourcing_rfqs_created_by_id_fkey";
ALTER TABLE "sourcing_rfqs" ADD CONSTRAINT "sourcing_rfqs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sourcing_rfqs" DROP CONSTRAINT IF EXISTS "sourcing_rfqs_master_product_id_fkey";
ALTER TABLE "sourcing_rfqs" ADD CONSTRAINT "sourcing_rfqs_master_product_id_fkey" FOREIGN KEY ("master_product_id") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sourcing_rfqs" DROP CONSTRAINT IF EXISTS "sourcing_rfqs_awarded_quotation_id_fkey";
ALTER TABLE "sourcing_rfqs" ADD CONSTRAINT "sourcing_rfqs_awarded_quotation_id_fkey" FOREIGN KEY ("awarded_quotation_id") REFERENCES "sourcing_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sourcing_quotations" DROP CONSTRAINT IF EXISTS "sourcing_quotations_rfq_id_fkey";
ALTER TABLE "sourcing_quotations" ADD CONSTRAINT "sourcing_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "sourcing_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sourcing_quotations" DROP CONSTRAINT IF EXISTS "sourcing_quotations_supplier_business_id_fkey";
ALTER TABLE "sourcing_quotations" ADD CONSTRAINT "sourcing_quotations_supplier_business_id_fkey" FOREIGN KEY ("supplier_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sourcing_quotations" DROP CONSTRAINT IF EXISTS "sourcing_quotations_submitted_by_id_fkey";
ALTER TABLE "sourcing_quotations" ADD CONSTRAINT "sourcing_quotations_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_revisions" DROP CONSTRAINT IF EXISTS "quotation_revisions_quotation_id_fkey";
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sourcing_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rfq_invited_suppliers" DROP CONSTRAINT IF EXISTS "rfq_invited_suppliers_rfq_id_fkey";
ALTER TABLE "rfq_invited_suppliers" ADD CONSTRAINT "rfq_invited_suppliers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "sourcing_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rfq_invited_suppliers" DROP CONSTRAINT IF EXISTS "rfq_invited_suppliers_supplier_business_id_fkey";
ALTER TABLE "rfq_invited_suppliers" ADD CONSTRAINT "rfq_invited_suppliers_supplier_business_id_fkey" FOREIGN KEY ("supplier_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

