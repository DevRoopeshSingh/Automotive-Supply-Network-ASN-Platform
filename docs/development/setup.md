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
