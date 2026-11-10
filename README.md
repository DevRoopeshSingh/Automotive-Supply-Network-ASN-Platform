# Automotive Supply Network (ASN) Platform

> **One Network. Every Automotive Requirement.**  
> The digital infrastructure connecting India's automotive aftermarket.

---

## 1. Overview

Automotive Supply Network (ASN) is a unified, multi-sided commerce and logistics coordination platform connecting parts distributors, wholesalers, retailers, independent garages, fleet operators, and independent delivery partners.

The platform coordinates the entire lifecycle:

1. **Catalog & Vehicle Fitment:** Accurate part matching across Make, Model, Variant, Year, Fuel, Engine, and Transmission.
2. **5-Minute Atomic Stock Reservation:** Distributed locking preventing overselling across multi-supplier checkouts.
3. **Network-First 60-Minute Logistics:** Proximity-driven route evaluation (Preparation + Pickup + Collection + Transfer + Last-Mile + Handover) with 60-minute quick-delivery SLA guardrails.
4. **Transparent Economics:** Central Commission & Settlement Engine (CCSE) with an immutable, append-only financial ledger.

---

## 2. Platform Applications & Local Endpoints

| Application                                  | Workspace Target           | Technology            | Local Port | Local URL                                                    |
| :------------------------------------------- | :------------------------- | :-------------------- | :--------- | :----------------------------------------------------------- |
| **Buyer Marketplace** (`apps/buyer-web`)     | Garages, Fleets, Mechanics | Next.js 14 App Router | `3000`     | [http://localhost:3000](http://localhost:3000)               |
| **Supplier OS** (`apps/supplier-web`)        | Distributors, Wholesalers  | Next.js 14 App Router | `3001`     | [http://localhost:3001](http://localhost:3001)               |
| **Admin Control Centre** (`apps/admin-web`)  | Platform Ops, Governance   | Next.js 14 App Router | `3002`     | [http://localhost:3002](http://localhost:3002)               |
| **Backend API Monolith** (`apps/api-server`) | Core Business Engine       | NestJS 10, Fastify    | `4000`     | [http://localhost:4000](http://localhost:4000)               |
| **Interactive API Docs**                     | OpenAPI / Swagger UI       | Swagger UI            | `4000`     | [http://localhost:4000/docs](http://localhost:4000/docs)     |
| **API Health Probe**                         | Health Check Endpoint      | JSON Health Probe     | `4000`     | [http://localhost:4000/health](http://localhost:4000/health) |

---

## 3. Monorepo Structure

Managed via **pnpm workspaces** and **Turborepo**:

```
asn-platform/
├── apps/
│   ├── api-server/         # NestJS modular monolith backend
│   ├── buyer-web/          # Buyer marketplace web app
│   ├── supplier-web/       # Supplier OS & wholesale desk
│   ├── admin-web/          # Admin operations console
│   └── logistics-mobile/   # React Native delivery partner app
├── packages/
│   ├── config/             # Shared TypeScript, ESLint, Prettier configs
│   ├── database/           # Prisma schema, migrations & seeders
│   ├── logger/             # Structured JSON logger with trace correlation
│   ├── types/              # Domain models, enums & API response contracts
│   ├── ui/                 # Shared Tailwind & Radix UI design system
│   ├── utils/              # Automotive, currency (INR) & geo helpers
│   └── validators/         # Shared Zod validation schemas
├── docs/                   # Architectural Decision Records (ADRs) & setup guides
└── docker-compose.yml      # Local PostgreSQL 16 (PostGIS) & Redis 7 services
```

---

## 4. Quick Start

### Prerequisites

- **Node.js:** `>= 20.0.0`
- **pnpm:** `>= 9.0.0`
- **Docker & Docker Compose:** For running local PostgreSQL and Redis

### Installation & Local Setup

```bash
# 1. Install dependencies across the monorepo
pnpm install

# 2. Start local PostgreSQL and Redis services
docker compose up -d

# 3. Generate Prisma client and seed foundational data
pnpm db:generate
pnpm db:push
pnpm db:seed

# 4. Start all applications in development mode with hot-reload
pnpm dev
```

### Seeded Demo Accounts (One-Click or OTP Login)

In development mode, SMS dispatch is mocked. All accounts log in using OTP: **`123456`**, or via the one-click **"Quick Demo Login"** button on each portal:

| Persona      | Phone Number | Dev OTP  | Role & Organization                                             |
| :----------- | :----------- | :------- | :-------------------------------------------------------------- |
| **Buyer**    | `9876543210` | `123456` | Vikram Sharma — Apex Auto Care & Garages (`WORKSHOP`)           |
| **Supplier** | `9876543211` | `123456` | Ramesh Patel — SuperSpares Distribution (`DISTRIBUTOR`)         |
| **Carrier**  | `9876543213` | `123456` | Rajesh Sharma — Delhivery Express Freight (`LOGISTICS_PARTNER`) |
| **Admin**    | `9999999999` | `123456` | Amit Singhania — Platform Super Admin (`PLATFORM_SUPER_ADMIN`)  |

### Running Tests & Quality Verification

```bash
# Run unit & integration test suites
pnpm test

# Run browser-based end-to-end tests (Playwright)
pnpm test:e2e

# Run TypeScript typechecks across all 16 workspaces
pnpm typecheck

# Check or auto-fix formatting
pnpm format:check
pnpm format
```

---

## 5. Documentation Links

- [**Local Execution & Developer Runbook**](docs/development/local-execution-guide.md) — Complete local setup, ports, seeded users & workflows
- [Local Development & Environment Setup](docs/development/setup.md) — Comprehensive API curl reference & tenant guides
- [Cost-Effective Production Deployment Strategy](docs/deployment/cost-effective-deployment-strategy.md) — Hetzner / DigitalOcean $20-$40/mo blueprint
- [Docker Compose Production Guide](docs/deployment/docker-compose-production-guide.md) — Single-node production deployment runbook
- [System Architecture Overview](docs/architecture/system-architecture.md)
- [Monorepo Structure & Boundaries](docs/architecture/monorepo-structure.md)
- [Architectural Decision Records (ADRs)](docs/architecture/decisions/)
