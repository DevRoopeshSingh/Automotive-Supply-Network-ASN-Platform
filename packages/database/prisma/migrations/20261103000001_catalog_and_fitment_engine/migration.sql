-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'DIAGRAM', 'DOCUMENT', 'CERTIFICATE');

-- AlterTable vehicle_makes
ALTER TABLE "vehicle_makes" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "vehicle_makes" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable vehicle_models
ALTER TABLE "vehicle_models" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable vehicle_variants
ALTER TABLE "vehicle_variants" ADD COLUMN IF NOT EXISTS "engine_capacity" INTEGER;
ALTER TABLE "vehicle_variants" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "vehicle_variants_model_id_start_year_end_year_idx" ON "vehicle_variants"("model_id", "start_year", "end_year");

-- AlterTable product_categories
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable brands
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "country_of_origin" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "brands_code_key" ON "brands"("code");

-- AlterTable master_products
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "normalized_part_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "normalized_oem_number" TEXT;
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "unit_of_measure" TEXT NOT NULL DEFAULT 'PCS';
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "dimensions" JSONB;
ALTER TABLE "master_products" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE INDEX IF NOT EXISTS "master_products_normalized_part_number_idx" ON "master_products"("normalized_part_number");
CREATE INDEX IF NOT EXISTS "master_products_normalized_oem_number_idx" ON "master_products"("normalized_oem_number");
CREATE INDEX IF NOT EXISTS "master_products_category_id_status_idx" ON "master_products"("category_id", "status");
CREATE INDEX IF NOT EXISTS "master_products_brand_id_status_idx" ON "master_products"("brand_id", "status");

-- AlterTable product_fitments
ALTER TABLE "product_fitments" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "product_fitments" ADD COLUMN IF NOT EXISTS "fitment_start_year" INTEGER;
ALTER TABLE "product_fitments" ADD COLUMN IF NOT EXISTS "fitment_end_year" INTEGER;
CREATE INDEX IF NOT EXISTS "product_fitments_vehicle_variant_id_is_verified_idx" ON "product_fitments"("vehicle_variant_id", "is_verified");

-- CreateTable oem_part_references
CREATE TABLE IF NOT EXISTS "oem_part_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "master_product_id" UUID NOT NULL,
    "oem_number" TEXT NOT NULL,
    "normalized_oem_number" TEXT NOT NULL,
    "vehicle_make_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oem_part_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oem_part_references_master_product_id_normalized_oem_number_key" ON "oem_part_references"("master_product_id", "normalized_oem_number");
CREATE INDEX IF NOT EXISTS "oem_part_references_normalized_oem_number_idx" ON "oem_part_references"("normalized_oem_number");

-- CreateTable product_media
CREATE TABLE IF NOT EXISTS "product_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "master_product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "alt_text" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_media_master_product_id_is_primary_idx" ON "product_media"("master_product_id", "is_primary");

-- AddForeignKey
ALTER TABLE "oem_part_references" DROP CONSTRAINT IF EXISTS "oem_part_references_master_product_id_fkey";
ALTER TABLE "oem_part_references" ADD CONSTRAINT "oem_part_references_master_product_id_fkey" FOREIGN KEY ("master_product_id") REFERENCES "master_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_part_references" DROP CONSTRAINT IF EXISTS "oem_part_references_vehicle_make_id_fkey";
ALTER TABLE "oem_part_references" ADD CONSTRAINT "oem_part_references_vehicle_make_id_fkey" FOREIGN KEY ("vehicle_make_id") REFERENCES "vehicle_makes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" DROP CONSTRAINT IF EXISTS "product_media_master_product_id_fkey";
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_master_product_id_fkey" FOREIGN KEY ("master_product_id") REFERENCES "master_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
