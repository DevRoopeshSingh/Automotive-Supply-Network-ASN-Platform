-- AlterEnum LegStatus
ALTER TYPE "LegStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- CreateEnum ShipmentStatus
DO $$ BEGIN
    CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_INITIATED', 'RETURNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum LegType
DO $$ BEGIN
    CREATE TYPE "LegType" AS ENUM ('FIRST_MILE_PICKUP', 'MID_MILE_TRANSFER', 'HUB_SORTING', 'LAST_MILE_DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum LogisticsProviderType
DO $$ BEGIN
    CREATE TYPE "LogisticsProviderType" AS ENUM ('INTERNAL_FLEET', 'THIRD_PARTY_3PL', 'HYPERLOCAL', 'INTERCITY_FREIGHT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ShipmentEventType
DO $$ BEGIN
    CREATE TYPE "ShipmentEventType" AS ENUM ('SHIPMENT_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'LEG_STARTED', 'ARRIVED_AT_HUB', 'DEPARTED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERY_FAILED', 'DELIVERED', 'RETURN_INITIATED', 'RETURNED', 'CANCELLED', 'STATUS_UPDATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable logistics_providers
CREATE TABLE IF NOT EXISTS "logistics_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" "LogisticsProviderType" NOT NULL DEFAULT 'THIRD_PARTY_3PL',
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "tracking_url_template" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "business_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable shipments
CREATE TABLE IF NOT EXISTS "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_number" TEXT NOT NULL,
    "sender_business_id" UUID NOT NULL,
    "receiver_business_id" UUID NOT NULL,
    "sourcing_rfq_id" UUID,
    "sourcing_quotation_id" UUID,
    "order_id" UUID,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "pickup_address" TEXT NOT NULL,
    "pickup_city" TEXT NOT NULL,
    "pickup_state" TEXT NOT NULL,
    "pickup_postal_code" TEXT NOT NULL,
    "pickup_warehouse_id" UUID,
    "delivery_address" TEXT NOT NULL,
    "delivery_city" TEXT NOT NULL,
    "delivery_state" TEXT NOT NULL,
    "delivery_postal_code" TEXT NOT NULL,
    "delivery_contact_name" TEXT,
    "delivery_contact_phone" TEXT,
    "scheduled_pickup_at" TIMESTAMP(3),
    "actual_pickup_at" TIMESTAMP(3),
    "estimated_delivery_at" TIMESTAMP(3),
    "actual_delivery_at" TIMESTAMP(3),
    "total_weight_kg" DOUBLE PRECISION,
    "total_volume_cbm" DOUBLE PRECISION,
    "declared_value" DECIMAL(10,2),
    "current_location" TEXT,
    "delivery_failure_reason" TEXT,
    "delivery_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable shipment_items
CREATE TABLE IF NOT EXISTS "shipment_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "master_product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2),
    "total_price" DECIMAL(10,2),
    "sku" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable shipment_legs
CREATE TABLE IF NOT EXISTS "shipment_legs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "leg_sequence" INTEGER NOT NULL,
    "leg_type" "LegType" NOT NULL DEFAULT 'LAST_MILE_DELIVERY',
    "status" "LegStatus" NOT NULL DEFAULT 'PENDING',
    "origin_facility_name" TEXT,
    "origin_address" TEXT NOT NULL,
    "origin_city" TEXT NOT NULL,
    "origin_state" TEXT NOT NULL,
    "origin_postal_code" TEXT NOT NULL,
    "destination_facility_name" TEXT,
    "destination_address" TEXT NOT NULL,
    "destination_city" TEXT NOT NULL,
    "destination_state" TEXT NOT NULL,
    "destination_postal_code" TEXT NOT NULL,
    "assigned_provider_id" UUID,
    "tracking_number" TEXT,
    "planned_departure_at" TIMESTAMP(3),
    "actual_departure_at" TIMESTAMP(3),
    "planned_arrival_at" TIMESTAMP(3),
    "actual_arrival_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable shipment_tracking_events
CREATE TABLE IF NOT EXISTS "shipment_tracking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "leg_id" UUID,
    "event_type" "ShipmentEventType" NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "actor_user_id" UUID,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable proof_of_delivery
CREATE TABLE IF NOT EXISTS "proof_of_delivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "delivery_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_url" TEXT,
    "verification_code" TEXT,
    "confirmed_by_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
);

-- Unique and standard indexes for logistics_providers
CREATE UNIQUE INDEX IF NOT EXISTS "logistics_providers_provider_code_key" ON "logistics_providers"("provider_code");

-- Unique and standard indexes for shipments
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_shipment_number_key" ON "shipments"("shipment_number");
CREATE INDEX IF NOT EXISTS "shipments_sender_business_id_status_idx" ON "shipments"("sender_business_id", "status");
CREATE INDEX IF NOT EXISTS "shipments_receiver_business_id_status_idx" ON "shipments"("receiver_business_id", "status");
CREATE INDEX IF NOT EXISTS "shipments_status_idx" ON "shipments"("status");
CREATE INDEX IF NOT EXISTS "shipments_shipment_number_idx" ON "shipments"("shipment_number");

-- Indexes for shipment_items
CREATE INDEX IF NOT EXISTS "shipment_items_shipment_id_idx" ON "shipment_items"("shipment_id");

-- Unique and standard indexes for shipment_legs
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_legs_shipment_id_leg_sequence_key" ON "shipment_legs"("shipment_id", "leg_sequence");
CREATE INDEX IF NOT EXISTS "shipment_legs_shipment_id_status_idx" ON "shipment_legs"("shipment_id", "status");
CREATE INDEX IF NOT EXISTS "shipment_legs_assigned_provider_id_idx" ON "shipment_legs"("assigned_provider_id");

-- Indexes for shipment_tracking_events
CREATE INDEX IF NOT EXISTS "shipment_tracking_events_shipment_id_timestamp_idx" ON "shipment_tracking_events"("shipment_id", "timestamp");

-- Unique index for proof_of_delivery
CREATE UNIQUE INDEX IF NOT EXISTS "proof_of_delivery_shipment_id_key" ON "proof_of_delivery"("shipment_id");

-- Foreign key constraints
ALTER TABLE "logistics_providers" DROP CONSTRAINT IF EXISTS "logistics_providers_business_id_fkey";
ALTER TABLE "logistics_providers" ADD CONSTRAINT "logistics_providers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "shipments_sender_business_id_fkey";
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sender_business_id_fkey" FOREIGN KEY ("sender_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "shipments_receiver_business_id_fkey";
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_receiver_business_id_fkey" FOREIGN KEY ("receiver_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "shipments_sourcing_rfq_id_fkey";
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sourcing_rfq_id_fkey" FOREIGN KEY ("sourcing_rfq_id") REFERENCES "sourcing_rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "shipments_sourcing_quotation_id_fkey";
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sourcing_quotation_id_fkey" FOREIGN KEY ("sourcing_quotation_id") REFERENCES "sourcing_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "shipments_pickup_warehouse_id_fkey";
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pickup_warehouse_id_fkey" FOREIGN KEY ("pickup_warehouse_id") REFERENCES "supplier_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipment_items" DROP CONSTRAINT IF EXISTS "shipment_items_shipment_id_fkey";
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipment_items" DROP CONSTRAINT IF EXISTS "shipment_items_master_product_id_fkey";
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_master_product_id_fkey" FOREIGN KEY ("master_product_id") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shipment_legs" DROP CONSTRAINT IF EXISTS "shipment_legs_shipment_id_fkey";
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipment_legs" DROP CONSTRAINT IF EXISTS "shipment_legs_assigned_provider_id_fkey";
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_assigned_provider_id_fkey" FOREIGN KEY ("assigned_provider_id") REFERENCES "logistics_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipment_tracking_events" DROP CONSTRAINT IF EXISTS "shipment_tracking_events_shipment_id_fkey";
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipment_tracking_events" DROP CONSTRAINT IF EXISTS "shipment_tracking_events_leg_id_fkey";
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "shipment_legs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proof_of_delivery" DROP CONSTRAINT IF EXISTS "proof_of_delivery_shipment_id_fkey";
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
