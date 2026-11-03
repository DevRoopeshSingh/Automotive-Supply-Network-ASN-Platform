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

## 2. Platform Applications

| Application                                        | Workspace Target                        | Technology                             | Port   |
| :------------------------------------------------- | :-------------------------------------- | :------------------------------------- | :----- |
| **Buyer Marketplace** (`apps/buyer-web`)           | Garages, Fleets, Vehicle Owners         | Next.js 14 App Router, React, Tailwind | `3000` |
| **Supplier OS** (`apps/supplier-web`)              | Distributors, Wholesalers, Retailers    | Next.js 14 App Router, React, Tailwind | `3001` |
| **Admin Control Centre** (`apps/admin-web`)        | Operations, Catalog & Finance Team      | Next.js 14 App Router, React, Tailwind | `3002` |
| **Logistics Mobile App** (`apps/logistics-mobile`) | Independent Delivery Couriers & Drivers | React Native, Expo                     | `8081` |
| **Backend API Monolith** (`apps/api-server`)       | Shared Core Infrastructure              | Node.js 20 LTS, NestJS 10, OpenAPI     | `4000` |

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

### Running Tests & Quality Checks

```bash
# Run all unit tests
pnpm test

# Run TypeScript typechecks across all workspaces
pnpm typecheck

# Format code
pnpm format
```

---

## 5. Documentation Links

- [System Architecture Overview](docs/architecture/system-architecture.md)
- [Monorepo Structure & Boundaries](docs/architecture/monorepo-structure.md)
- [Local Development & Environment Setup](docs/development/setup.md)
- [Architectural Decision Records (ADRs)](docs/architecture/decisions/)
