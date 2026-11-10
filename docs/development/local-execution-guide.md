# ASN Platform — Local Execution & Developer Runbook

> **Complete guide to running, exploring, and testing the Automotive Supply Network (ASN) Platform locally.**

---

## 1. Executive Summary & Capabilities

The Automotive Supply Network (ASN) platform is architected as a high-performance monorepo managed with **pnpm** and **Turborepo**. The entire multi-sided ecosystem can be booted locally on a developer workstation in minutes.

When running locally, the following micro-frontends and backend services operate in concert:

| Application                 | Technology              | Local Port | URL                                                          | Role / Purpose                                                                                       |
| :-------------------------- | :---------------------- | :--------- | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **Buyer Marketplace**       | Next.js 14 (App Router) | `3000`     | [http://localhost:3000](http://localhost:3000)               | Automotive catalog search, vehicle fitment lookup, RFQ creation, quote comparison, shipment tracking |
| **Supplier OS**             | Next.js 14 (App Router) | `3001`     | [http://localhost:3001](http://localhost:3001)               | Inventory & warehouse management, CSV stock bulk upload, RFQ bidding desk, shipment dispatch         |
| **Admin Control Centre**    | Next.js 14 (App Router) | `3002`     | [http://localhost:3002](http://localhost:3002)               | Platform governance, master parts catalog, logistics carrier provisioning, shipment audit trail      |
| **Backend API Monolith**    | NestJS 10 & Fastify     | `4000`     | [http://localhost:4000](http://localhost:4000)               | Core business logic, auth, catalog, inventory, RFQ/quotes, multi-leg logistics                       |
| **Swagger API Docs**        | OpenAPI 3.0 / Swagger   | `4000`     | [http://localhost:4000/docs](http://localhost:4000/docs)     | Interactive API exploration and live schema documentation                                            |
| **API Health Probe**        | HTTP Endpoint           | `4000`     | [http://localhost:4000/health](http://localhost:4000/health) | Real-time database and service status verification                                                   |
| **PostgreSQL 16 + PostGIS** | Docker Container        | `5432`     | `localhost:5432`                                             | Relational source of truth with geospatial extensions                                                |
| **Redis 7**                 | Docker Container        | `6379`     | `localhost:6379`                                             | Distributed locks, cache, session store                                                              |

---

## 2. Prerequisites

Ensure your workstation meets the following requirements:

- **Node.js:** `>= 20.0.0` (LTS recommended)
- **pnpm:** `>= 9.0.0` (`npm install -g pnpm@latest`)
- **Docker & Docker Compose:** For running local PostgreSQL with PostGIS and Redis
- **Git:** Standard version control

---

## 3. Quick Start in 4 Steps

### Step 3.1: Install Monorepo Dependencies

```bash
cd ASN-Platform
pnpm install
```

### Step 3.2: Start PostgreSQL & Redis

Start local database containers using Docker Compose:

```bash
docker compose up -d
```

Verify containers are running healthy:

```bash
docker compose ps
```

### Step 3.3: Push Schema & Seed Initial Data

Push the Prisma database schema and seed test automotive catalog items, warehouses, inventory, seed users, RFQs, quotes, and sample shipments:

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### Step 3.4: Launch the Full Platform

Start all applications and backend API simultaneously via Turborepo:

```bash
pnpm dev
```

> **Tip:** Turborepo boots all 4 apps concurrently with streaming logs and hot module reloading.

---

## 4. Pre-Configured Seed Accounts & Authentication

In local development mode (`ALLOW_DEV_OTP=true` and `NODE_ENV=development`), the SMS gateway uses a mock provider. **Any seed user logs in using OTP: `123456`**.

Furthermore, each frontend application includes a **"Quick Demo Login"** button on the sign-in screen to bypass typing entirely.

| Persona               | Trade / Business Name            | Business Type          | Phone Number | Dev OTP  | Key Capabilities                                                                               |
| :-------------------- | :------------------------------- | :--------------------- | :----------- | :------- | :--------------------------------------------------------------------------------------------- |
| **Buyer**             | Apex Auto Care & Garages Pvt Ltd | `WORKSHOP`             | `9876543210` | `123456` | Search vehicle parts, raise RFQs, evaluate supplier quotes, award bids, view delivery tracking |
| **Supplier 1**        | SuperSpares Distribution         | `DISTRIBUTOR`          | `9876543211` | `123456` | Mayapuri Hub stock (150 brake pads, 200 oil filters), submit quotes, dispatch shipments        |
| **Supplier 2**        | National Parts Wholesalers       | `WHOLESALER`           | `9876543212` | `123456` | Bhiwandi Hub stock, submit competing wholesale quotations                                      |
| **Logistics Carrier** | Delhivery Express Freight        | `LOGISTICS_PARTNER`    | `9876543213` | `123456` | Multi-leg carrier assignments, transit status updates, Proof of Delivery (POD) upload          |
| **Super Admin**       | ASN Operations HQ                | `PLATFORM_SUPER_ADMIN` | `9999999999` | `123456` | Platform surveillance, master catalog management, carrier registrations, tenant oversight      |

---

## 5. End-to-End User Journeys to Test Locally

### 5.1 Buyer Journey ([http://localhost:3000](http://localhost:3000))

1. **Sign In:** Use phone `9876543210` and OTP `123456` (or click "Quick Demo Login").
2. **Catalog & Fitment Search:**
   - Search for `Brake Pad` or OEM part number `58101-1RA00`.
   - Filter by vehicle make (e.g. _Hyundai_), model (_Creta_), and variant (_1.5L CRDi Diesel_).
3. **Raise an RFQ:**
   - Click **"Create RFQ"**, select quantity (e.g., 20 sets), target price, and delivery location.
   - Publish RFQ to the network.
4. **Compare Quotes & Award:**
   - Navigate to **"My RFQs"** to view competing supplier quotations.
   - Click **"Award Quotation"** — this atomically awards the supplier and triggers shipment orchestration.
5. **Track Delivery & Proof of Delivery:**
   - View the active shipment, sequential legs, assigned carrier, transit checkpoints, and recipient POD details.

---

### 5.2 Supplier Journey ([http://localhost:3001](http://localhost:3001))

1. **Sign In:** Use phone `9876543211` and OTP `123456`.
2. **Dashboard Overview:**
   - Review live metrics: total inventory SKUs, active warehouses, incoming RFQs, pending dispatches.
3. **Warehouse & Stock Management:**
   - View Mayapuri Central Depot inventory.
   - Adjust physical stock quantities or reserve buffers.
   - Test CSV bulk import preview and execution.
4. **Respond to RFQs:**
   - Navigate to **"Marketplace RFQs"**.
   - Review buyer specifications, submit quote with price per unit, GST rate, and validity duration.

---

### 5.3 Admin Operations Journey ([http://localhost:3002](http://localhost:3002))

1. **Sign In:** Use phone `9999999999` and OTP `123456`.
2. **Master Catalog Governance:**
   - Browse master automotive parts, brands, and vehicle fitment hierarchies.
   - Create or edit canonical automotive parts with OEM cross-references.
3. **Logistics Fleet Management:**
   - View onboarded logistics partners (e.g., Delhivery, BlueDart).
   - Review platform-wide active shipments and transit exception alerts.

---

## 6. Automated Testing & Verification Suite

The repository includes a comprehensive automated test pyramid that can be run locally:

```bash
# 1. Run full unit and integration test suite (109+ tests)
pnpm test

# 2. Run Playwright browser end-to-end tests (headless)
pnpm test:e2e

# 3. Run Playwright tests with visible browser UI (headed)
pnpm test:e2e --headed

# 4. Run TypeScript static typechecking across all 16 workspaces
pnpm typecheck

# 5. Check code formatting against Prettier
pnpm format:check
```

---

## 7. Interactive API Testing (Swagger / cURL)

### Interactive Swagger UI

Visit [http://localhost:4000/docs](http://localhost:4000/docs) in your browser. All REST endpoints are documented with request/response schemas, DTO models, and inline "Try it out" execution.

### Quick cURL Smoke Tests

**Health Check:**

```bash
curl http://localhost:4000/health
```

**Request OTP:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

**Verify OTP & Get Bearer Token:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456"}'
```

**Query Automotive Catalog:**

```bash
curl "http://localhost:4000/api/v1/catalog/products?q=Brake"
```

---

## 8. Troubleshooting & FAQ

### Q: Port 5432 or 6379 is already in use

**A:** If you have existing local Postgres or Redis instances running outside Docker:

- Stop the existing services (`brew services stop postgresql` / `brew services stop redis`), OR
- Change `DB_PORT=5433` and `REDIS_PORT=6380` in your root `.env` file before executing `docker compose up -d`.

### Q: "Can't reach database server at localhost:5432"

**A:** Ensure Docker Desktop is running and run `docker compose ps`. If Postgres is restarting, check container logs with `docker compose logs postgres`.

### Q: Resetting to a fresh database state

**A:** To wipe and re-seed clean test data:

```bash
pnpm --filter @asn/database prisma db push --force-reset
pnpm db:seed
```

### Q: What environment files are needed?

**A:** The repository includes pre-configured defaults in `.env.example` across apps. In local development, the root `.env` and default configurations allow zero-config startup out of the box.
