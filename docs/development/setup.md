# Local Development & Environment Setup Guide

This guide describes how to configure, boot, and verify the ASN monorepo on a local developer workstation.

---

## 1. Prerequisites

Ensure the following tools are installed:

- **Node.js:** v20.x or v22.x LTS (compatible with Node 20+)
- **pnpm:** v9.x (`npm install -g pnpm@latest`)
- **Docker & Docker Compose:** For running local PostgreSQL and Redis instances
- **Git:** For source control

---

## 2. Step-by-Step Installation

### Step 2.1: Clone & Install Dependencies

```bash
cd ASN-Platform
pnpm install
```

### Step 2.2: Launch Local Services (Postgres & Redis)

Ensure Docker Desktop is running, then execute:

```bash
docker compose up -d
```

- **PostgreSQL with PostGIS:** accessible at `localhost:5432` (`asn_user` / `asn_password` / `asn_dev`)
- **Redis:** accessible at `localhost:6379`

### Step 2.3: Environment Configuration

Copy `.env.example` files to `.env` in respective packages:

```bash
cp apps/api-server/.env.example apps/api-server/.env
cp apps/buyer-web/.env.example apps/buyer-web/.env.local
```

### Step 2.4: Database Schema Push & Seeding

```bash
# Generate the Prisma client
pnpm db:generate

# Push the schema to local PostgreSQL
pnpm db:push

# Seed foundational vehicle makes and categories
pnpm db:seed
```

---

## 3. Running the Applications

To start all applications and the API server simultaneously with Turborepo hot-reloading:

```bash
pnpm dev
```

### Application URLs:

- **Backend API Server:** `http://localhost:4000`
- **Swagger OpenAPI Documentation:** `http://localhost:4000/docs`
- **Health Check:** `http://localhost:4000/health`
- **Buyer Marketplace:** `http://localhost:3000`
- **Supplier OS:** `http://localhost:3001`
- **Admin Control Centre:** `http://localhost:3002`

---

## 4. Verification & Quality Commands

```bash
# Run all unit tests across all packages
pnpm test

# Run TypeScript typechecking across all packages and apps
pnpm typecheck

# Check code formatting with Prettier
pnpm format:check
```

---

## 5. Local Authentication & Multi-Tenant Testing

### 5.1 Request Phone OTP

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

_(In development mode, check your server console for the mock OTP dispatch log.)_

### 5.2 Verify OTP & Obtain Tokens

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "<6-DIGIT-OTP>"}'
```

_Returns `accessToken` (valid for 15 mins) and sets `asn_refresh_token` in HttpOnly cookie / JSON response._

### 5.3 Fetch Current User Profile

```bash
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 5.4 Create Business & Switch Active Tenant

```bash
# 1. Create a business (Creator is automatically assigned as BUSINESS_OWNER)
curl -X POST http://localhost:4000/api/v1/businesses \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "legalName": "Apex Auto Spares LLP",
    "tradeName": "Apex Spares",
    "businessType": "DISTRIBUTOR",
    "addressLine1": "Gala 4, Kurla Industrial Estate",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400070"
  }'

# 2. Switch context to the newly created business (returns new scoped token)
curl -X POST http://localhost:4000/api/v1/businesses/<BUSINESS_ID>/switch \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 6. Testing the Automotive Catalog & Vehicle Fitment API

### 6.1 Query Categories & Category Tree

```bash
# 1. Fetch flat category list
curl -X GET http://localhost:4000/api/v1/catalog/categories

# 2. Fetch full hierarchical category tree (Parent -> Children)
curl -X GET http://localhost:4000/api/v1/catalog/categories/tree
```

### 6.2 Query Vehicle Hierarchy

```bash
# 1. List vehicle makes
curl -X GET http://localhost:4000/api/v1/catalog/vehicles/makes

# 2. List models for a vehicle make
curl -X GET http://localhost:4000/api/v1/catalog/vehicles/makes/<MAKE_ID>/models

# 3. List variants for a vehicle model
curl -X GET http://localhost:4000/api/v1/catalog/vehicles/models/<MODEL_ID>/variants
```

### 6.3 Vehicle Part Compatibility Engine

```bash
# Query verified compatible parts for a vehicle variant and model year
curl -X GET "http://localhost:4000/api/v1/catalog/vehicles/compatibility?variantId=<VARIANT_ID>&year=2021"
```

### 6.4 Search Products with Punctuation & Spacing Normalization

```bash
# Query with raw spaces/hyphens (e.g. "0986-AB1 234" automatically normalizes to "0986AB1234")
curl -X GET "http://localhost:4000/api/v1/catalog/products?q=0986-AB1%20234&page=1&limit=10"

# Fetch product master details including OEM references, media, and fitments
curl -X GET http://localhost:4000/api/v1/catalog/products/<PRODUCT_ID>
```

### 6.5 Create Product Master (Authorized Roles Only)

```bash
curl -X POST http://localhost:4000/api/v1/catalog/products \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "partNumber": "0 986 AB1 234",
    "brandId": "<BRAND_ID>",
    "categoryId": "<CATEGORY_ID>",
    "name": "Bosch Front Ceramic Brake Pad Set",
    "oemNumber": "58101-1RA00",
    "conditionType": "AFTERMARKET",
    "isSafetyCritical": true,
    "unitOfMeasure": "SET",
    "specifications": {
      "frictionMaterial": "Ceramic",
      "axlePosition": "Front"
    }
  }'
```

## 7. Testing Supplier OS — Warehouses, Inventory & Bulk Import

All supplier endpoints require authentication headers:

- `Authorization: Bearer <ACCESS_TOKEN>`
- `X-Business-Id: <SUPPLIER_BUSINESS_ID>`

### 7.1 Warehouse Operations

```bash
# 1. Create a supplier warehouse
curl -X POST http://localhost:4000/api/v1/supplier/warehouses \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mayapuri Central Depot",
    "code": "WH-DEL-01",
    "addressLine1": "Plot 42, Mayapuri Phase II",
    "city": "New Delhi",
    "state": "Delhi",
    "postalCode": "110064",
    "isPrimary": true
  }'

# 2. List supplier warehouses
curl -X GET http://localhost:4000/api/v1/supplier/warehouses \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>"
```

### 7.2 Supplier Product Listings & Warehouse Stock

```bash
# 1. Create a supplier listing linked to MasterProduct
curl -X POST http://localhost:4000/api/v1/supplier/listings \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "masterProductId": "<MASTER_PRODUCT_ID>",
    "supplierSku": "BOSCH-PAD-CR-01",
    "sellingPrice": 1850.00,
    "mrp": 2200.00,
    "warehouseId": "<WAREHOUSE_ID>",
    "initialStock": 25,
    "binLocation": "A-12-01"
  }'

# 2. Query warehouse inventory levels
curl -X GET "http://localhost:4000/api/v1/supplier/inventory?warehouseId=<WAREHOUSE_ID>&page=1&limit=20" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>"
```

### 7.3 Atomic Stock Adjustments (Negative Stock Prevention)

```bash
# Restock +15 units (creates movement with reason RESTOCK)
curl -X POST http://localhost:4000/api/v1/supplier/inventory/adjust \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouseId": "<WAREHOUSE_ID>",
    "supplierProductId": "<SUPPLIER_PRODUCT_ID>",
    "changeQuantity": 15,
    "reason": "RESTOCK",
    "notes": "PO-2026-881 received"
  }'

# View chronological movement ledger for a product
curl -X GET "http://localhost:4000/api/v1/supplier/inventory/movements/<SUPPLIER_PRODUCT_ID>" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>"
```

### 7.4 Staged Bulk CSV Import Pipeline

```bash
# 1. Upload CSV to generate staged validation preview
curl -X POST http://localhost:4000/api/v1/supplier/inventory/import/preview \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouseId": "<WAREHOUSE_ID>",
    "fileName": "batch_mayapuri_stock.csv",
    "csvContent": "SKU,Part Number,Brand,Quantity,Price\nBOSCH-PAD-01,0 986 AB1 234,Bosch,50,1850.00\nMAHLE-OC501,OC 501,Mahle,100,420.00"
  }'

# 2. Check import job report
curl -X GET "http://localhost:4000/api/v1/supplier/inventory/import/<JOB_ID>" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>"

# 3. Execute valid rows into live inventory
curl -X POST http://localhost:4000/api/v1/supplier/inventory/import/execute \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "<JOB_ID>"
  }'
```

## 8. Supplier Supply Network (SSN) & B2B RFQ Testing Guide

### 8.1 Sourcing RFQ Creation & Publishing (Buyer)

```bash
# 1. Create a wholesale sourcing RFQ (Draft)
curl -X POST http://localhost:4000/api/v1/supplier/ssn/rfqs \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "X-Business-Id: <BUYER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "masterProductId": "<MASTER_PRODUCT_ID>",
    "quantity": 50,
    "targetPrice": 1200.00,
    "deliveryAddress": "Plot 12, Opera House Auto Market",
    "deliveryCity": "Mumbai",
    "deliveryState": "Maharashtra",
    "deliveryPostalCode": "400004",
    "deliveryDeadline": "2026-11-25T00:00:00.000Z",
    "expiresAt": "2026-11-15T00:00:00.000Z",
    "notes": "Need OEM packaging with warranty cards",
    "publishImmediately": false
  }'

# 2. Publish draft RFQ to the network
curl -X POST http://localhost:4000/api/v1/supplier/ssn/rfqs/<RFQ_ID>/publish \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "X-Business-Id: <BUYER_BUSINESS_ID>"
```

### 8.2 Sourcing Discovery & Open RFQs (Supplier)

```bash
# 1. Discover verified suppliers stocking this product
curl -X GET "http://localhost:4000/api/v1/supplier/ssn/rfqs/eligible-suppliers/<MASTER_PRODUCT_ID>" \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "X-Business-Id: <BUYER_BUSINESS_ID>"

# 2. Discover open RFQs available to the calling supplier
curl -X GET "http://localhost:4000/api/v1/supplier/ssn/rfqs/open?page=1&limit=20" \
  -H "Authorization: Bearer <SUPPLIER_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>"
```

### 8.3 Quotation Submission, Revision & Confidentiality

```bash
# 1. Submit quotation for open RFQ
curl -X POST http://localhost:4000/api/v1/supplier/ssn/quotations \
  -H "Authorization: Bearer <SUPPLIER_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "rfqId": "<RFQ_ID>",
    "unitPrice": 1100.00,
    "availableQuantity": 100,
    "minimumOrderQuantity": 10,
    "leadTimeDays": 2,
    "validityUntil": "2026-11-14T00:00:00.000Z",
    "terms": "Net 15 days via bank transfer",
    "notes": "Ready for immediate dispatch"
  }'

# 2. Revise quotation prior to award (creates revision snapshot)
curl -X PATCH http://localhost:4000/api/v1/supplier/ssn/quotations/<QUOTATION_ID>/revise \
  -H "Authorization: Bearer <SUPPLIER_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "unitPrice": 1050.00,
    "availableQuantity": 100,
    "minimumOrderQuantity": 10,
    "leadTimeDays": 1,
    "validityUntil": "2026-11-14T00:00:00.000Z",
    "notes": "Revised price with 1-day express delivery"
  }'

# 3. Verify quotation confidentiality (forbidden for other suppliers)
curl -X GET http://localhost:4000/api/v1/supplier/ssn/quotations/<QUOTATION_ID> \
  -H "Authorization: Bearer <COMPETING_SUPPLIER_TOKEN>" \
  -H "X-Business-Id: <COMPETING_SUPPLIER_BUSINESS_ID>"
# -> HTTP 403 Forbidden
```

### 8.4 Quotation Comparison Matrix & Atomic Award (Buyer)

```bash
# 1. View quotation comparison matrix with best-price and fastest-delivery flags
curl -X GET http://localhost:4000/api/v1/supplier/ssn/rfqs/<RFQ_ID>/compare \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "X-Business-Id: <BUYER_BUSINESS_ID>"

# 2. Atomically award RFQ to winning quotation
curl -X POST http://localhost:4000/api/v1/supplier/ssn/rfqs/<RFQ_ID>/award \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "X-Business-Id: <BUYER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "quotationId": "<WINNING_QUOTATION_ID>"
  }'
```

---

## 9. Logistics & Multi-Leg Delivery Testing Guide

### 9.1 Register Logistics Provider

```bash
# Register a 3PL logistics provider (Admin or Logistics Manager)
curl -X POST http://localhost:4000/api/v1/logistics/providers \
  -H "Authorization: Bearer <ADMIN_OR_LOGISTICS_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delhivery Express Surface",
    "code": "DELHIVERY_EXP",
    "type": "THIRD_PARTY_3PL",
    "contactPerson": "Rajesh Sharma",
    "phone": "9876543210",
    "email": "operations@delhivery.example.com",
    "trackingUrlTemplate": "https://www.delhivery.com/track/package/{{trackingNumber}}"
  }'

# List active logistics providers
curl -X GET http://localhost:4000/api/v1/logistics/providers \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>"
```

### 9.2 Create Shipment with Multi-Leg Routing

```bash
# Create shipment with 2 legs (First-mile pickup and Last-mile delivery)
curl -X POST http://localhost:4000/api/v1/logistics/shipments \
  -H "Authorization: Bearer <SUPPLIER_TOKEN>" \
  -H "X-Business-Id: <SUPPLIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverBusinessId": "<BUYER_BUSINESS_ID>",
    "sourcingRfqId": "<AWARDED_RFQ_ID>",
    "sourcingQuotationId": "<WINNING_QUOTATION_ID>",
    "pickupAddress": "Plot 42, Mayapuri Industrial Area Phase 1",
    "pickupCity": "New Delhi",
    "pickupState": "Delhi",
    "pickupPostalCode": "110064",
    "deliveryAddress": "Shop 12, Auto Complex, Sector 18",
    "deliveryCity": "Gurugram",
    "deliveryState": "Haryana",
    "deliveryPostalCode": "122015",
    "deliveryNotes": "Deliver to rear loading bay between 10 AM and 6 PM",
    "items": [
      {
        "masterProductId": "<MASTER_PRODUCT_ID>",
        "quantity": 25,
        "weightKg": 4.5
      }
    ],
    "legs": [
      {
        "sequenceNumber": 1,
        "legType": "FIRST_MILE_PICKUP",
        "originCity": "New Delhi",
        "originPostalCode": "110064",
        "destinationCity": "New Delhi",
        "destinationPostalCode": "110037"
      },
      {
        "sequenceNumber": 2,
        "legType": "LAST_MILE_DELIVERY",
        "originCity": "New Delhi",
        "originPostalCode": "110037",
        "destinationCity": "Gurugram",
        "destinationPostalCode": "122015"
      }
    ]
  }'
```

### 9.3 Assign Carrier to Multi-Leg Route & Track Progress

```bash
# 1. Assign provider to a specific leg
curl -X PATCH http://localhost:4000/api/v1/logistics/shipments/<SHIPMENT_ID>/legs/<LEG_ID>/assign \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -H "X-Business-Id: <SENDER_OR_CARRIER_BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "<LOGISTICS_PROVIDER_ID>",
    "carrierTrackingNumber": "DLV9988776655",
    "estimatedPickupAt": "2026-11-04T14:00:00.000Z",
    "estimatedDeliveryAt": "2026-11-04T18:00:00.000Z"
  }'

# 2. Progress shipment through lifecycle (PICKUP_SCHEDULED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY)
curl -X PATCH http://localhost:4000/api/v1/logistics/shipments/<SHIPMENT_ID>/status \
  -H "Authorization: Bearer <CARRIER_OR_SENDER_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OUT_FOR_DELIVERY",
    "notes": "Out for final delivery with rider Ravi Kumar"
  }'

# 3. Add location tracking checkpoint event
curl -X POST http://localhost:4000/api/v1/logistics/shipments/<SHIPMENT_ID>/events \
  -H "Authorization: Bearer <CARRIER_OR_SENDER_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "CARRIER_UPDATE",
    "locationCity": "Gurugram",
    "description": "Van reached Sector 18 distribution hub",
    "latitude": 28.4595,
    "longitude": 77.0266
  }'
```

### 9.4 Record Delivery Failure & Return Flow

```bash
# Record delivery failure with return initiation
curl -X POST http://localhost:4000/api/v1/logistics/shipments/<SHIPMENT_ID>/failed \
  -H "Authorization: Bearer <CARRIER_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "failureReason": "Premises closed: workshop shutters locked",
    "initiateReturn": true,
    "notes": "Second failed delivery attempt; initiating return to sender"
  }'
```

### 9.5 Submit Proof of Delivery (POD)

```bash
# Submit POD to atomically transition to DELIVERED
curl -X POST http://localhost:4000/api/v1/logistics/shipments/<SHIPMENT_ID>/proof-of-delivery \
  -H "Authorization: Bearer <CARRIER_TOKEN>" \
  -H "X-Business-Id: <BUSINESS_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientName": "Sanjay Verma",
    "recipientPhone": "9876543210",
    "documentUrl": "https://s3.ap-south-1.amazonaws.com/asn-pod-docs/shp-100-signed.jpg",
    "verificationCode": "847291",
    "notes": "Verified photo ID and received signed delivery challan"
  }'
```
