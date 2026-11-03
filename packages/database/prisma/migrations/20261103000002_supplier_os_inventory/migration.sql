-- AlterEnum
ALTER TYPE "StockStatus" ADD VALUE IF NOT EXISTS 'LOW_STOCK';
ALTER TYPE "StockStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PARSING', 'PREVIEW_READY', 'PROCESSING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateTable supplier_warehouses
CREATE TABLE IF NOT EXISTS "supplier_warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_warehouses_business_id_code_key" ON "supplier_warehouses"("business_id", "code");
CREATE INDEX IF NOT EXISTS "supplier_warehouses_business_id_is_active_idx" ON "supplier_warehouses"("business_id", "is_active");

-- AlterTable supplier_products
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(10,2);
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(10,2);
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "reserved_quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "lead_time_days" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_products_business_id_master_product_id_key" ON "supplier_products"("business_id", "master_product_id");
CREATE INDEX IF NOT EXISTS "supplier_products_master_product_id_idx" ON "supplier_products"("master_product_id");

-- CreateTable warehouse_inventories
CREATE TABLE IF NOT EXISTS "warehouse_inventories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouse_id" UUID NOT NULL,
    "supplier_product_id" UUID NOT NULL,
    "bin_location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "reorder_quantity" INTEGER NOT NULL DEFAULT 20,
    "last_stock_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_inventories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_inventories_warehouse_id_supplier_product_id_key" ON "warehouse_inventories"("warehouse_id", "supplier_product_id");
CREATE INDEX IF NOT EXISTS "warehouse_inventories_warehouse_id_available_quantity_idx" ON "warehouse_inventories"("warehouse_id", "available_quantity");
CREATE INDEX IF NOT EXISTS "warehouse_inventories_supplier_product_id_idx" ON "warehouse_inventories"("supplier_product_id");

-- AlterTable inventory_movements
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "warehouse_inventory_id" UUID;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "previous_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE INDEX IF NOT EXISTS "inventory_movements_supplier_product_id_created_at_idx" ON "inventory_movements"("supplier_product_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_warehouse_id_created_at_idx" ON "inventory_movements"("warehouse_id", "created_at");

-- CreateTable inventory_import_jobs
CREATE TABLE IF NOT EXISTS "inventory_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL DEFAULT 'CSV',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_report" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_import_jobs_business_id_status_idx" ON "inventory_import_jobs"("business_id", "status");

-- CreateTable inventory_import_rows
CREATE TABLE IF NOT EXISTS "inventory_import_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "product_name" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "min_stock" INTEGER,
    "bin_location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_import_rows_job_id_row_number_idx" ON "inventory_import_rows"("job_id", "row_number");

-- Foreign Keys
ALTER TABLE "supplier_warehouses" DROP CONSTRAINT IF EXISTS "supplier_warehouses_business_id_fkey";
ALTER TABLE "supplier_warehouses" ADD CONSTRAINT "supplier_warehouses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_inventories" DROP CONSTRAINT IF EXISTS "warehouse_inventories_warehouse_id_fkey";
ALTER TABLE "warehouse_inventories" ADD CONSTRAINT "warehouse_inventories_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "supplier_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_inventories" DROP CONSTRAINT IF EXISTS "warehouse_inventories_supplier_product_id_fkey";
ALTER TABLE "warehouse_inventories" ADD CONSTRAINT "warehouse_inventories_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_warehouse_inventory_id_fkey";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_inventory_id_fkey" FOREIGN KEY ("warehouse_inventory_id") REFERENCES "warehouse_inventories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_warehouse_id_fkey";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "supplier_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_user_id_fkey";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_import_jobs" DROP CONSTRAINT IF EXISTS "inventory_import_jobs_business_id_fkey";
ALTER TABLE "inventory_import_jobs" ADD CONSTRAINT "inventory_import_jobs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_import_jobs" DROP CONSTRAINT IF EXISTS "inventory_import_jobs_warehouse_id_fkey";
ALTER TABLE "inventory_import_jobs" ADD CONSTRAINT "inventory_import_jobs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "supplier_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_import_rows" DROP CONSTRAINT IF EXISTS "inventory_import_rows_job_id_fkey";
ALTER TABLE "inventory_import_rows" ADD CONSTRAINT "inventory_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "inventory_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
