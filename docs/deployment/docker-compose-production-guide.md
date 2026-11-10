# ASN Production Docker Compose & Reverse Proxy Guide

This document defines the production multi-container orchestration architecture for the Automotive Supply Network (ASN) platform. It provides the exact container definitions, internal networking, reverse proxy configuration with automatic TLS, and operational management commands.

---

## 1. Production Architecture Overview

```mermaid
flowchart TD
    Internet[Public Internet / Garages & Suppliers] -->|HTTPS 443 / HTTP 80| Caddy[Caddy 2 Reverse Proxy<br>Automatic Let's Encrypt TLS]

    subgraph InternalNetwork [Internal Isolated Docker Network: asn-backend-net]
        Caddy -->|api.asn.in| API[NestJS API Server :4000]
        Caddy -->|buyer.asn.in| Buyer[Buyer Web :3000]
        Caddy -->|supplier.asn.in| Supplier[Supplier OS :3001]
        Caddy -->|admin.asn.in| Admin[Admin Web :3002]

        API --> DB[(PostgreSQL 16 + PostGIS :5432)]
        API --> Redis[(Redis 7 :6379)]
    end

    subgraph HostVolumes [Persistent Host NVMe Volumes]
        DB --> VolPG[(/var/lib/docker/volumes/asn_pg_data)]
        Redis --> VolRedis[(/var/lib/docker/volumes/asn_redis_data)]
        Caddy --> VolCaddy[(/var/lib/docker/volumes/caddy_data)]
    end
```

---

## 2. Production Docker Compose (`docker-compose.prod.yml`)

Save this file in the root of the repository as `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  # ---------------------------------------------------------------------------
  # 1. Reverse Proxy & Automatic SSL Termination (Caddy 2)
  # ---------------------------------------------------------------------------
  caddy:
    image: caddy:2.8-alpine
    container_name: asn-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - asn-network
    depends_on:
      - api-server
      - buyer-web
      - supplier-web
      - admin-web
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  # ---------------------------------------------------------------------------
  # 2. Database: PostgreSQL 16 with PostGIS 3.4
  # ---------------------------------------------------------------------------
  postgres:
    image: postgis/postgis:16-3.4-alpine
    container_name: asn-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-asn_prod}
      POSTGRES_USER: ${DB_USER:-asn_prod_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be provided}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - asn-network
    # Port 5432 is strictly internal; NEVER exposed to public host
    expose:
      - "5432"
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${DB_USER:-asn_prod_user} -d ${DB_NAME:-asn_prod}",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2048M
        reservations:
          memory: 1024M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"

  # ---------------------------------------------------------------------------
  # 3. Cache & Lock Coordination: Redis 7
  # ---------------------------------------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: asn-redis-prod
    restart: unless-stopped
    command:
      [
        "redis-server",
        "--appendonly",
        "yes",
        "--requirepass",
        "${REDIS_PASSWORD:?REDIS_PASSWORD must be provided}",
      ]
    volumes:
      - redis_prod_data:/data
    networks:
      - asn-network
    expose:
      - "6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # 4. Core Backend: NestJS Modular Monolith API
  # ---------------------------------------------------------------------------
  api-server:
    build:
      context: .
      dockerfile: apps/api-server/Dockerfile
    container_name: asn-api-server-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public&sslmode=prefer
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET must be set}
      CORS_ORIGIN: "https://asn.in,https://buyer.asn.in,https://supplier.asn.in,https://admin.asn.in"
      ALLOW_DEV_OTP: "false" # STRICT PRODUCTION ENFORCEMENT
    networks:
      - asn-network
    expose:
      - "4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4000/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits:
          memory: 1536M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"

  # ---------------------------------------------------------------------------
  # 5. Frontend: Buyer Web Portal
  # ---------------------------------------------------------------------------
  buyer-web:
    build:
      context: .
      dockerfile: apps/buyer-web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://api.asn.in/api/v1
    container_name: asn-buyer-web-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
    networks:
      - asn-network
    expose:
      - "3000"
    deploy:
      resources:
        limits:
          memory: 1024M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # 6. Frontend: Supplier OS Portal
  # ---------------------------------------------------------------------------
  supplier-web:
    build:
      context: .
      dockerfile: apps/supplier-web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://api.asn.in/api/v1
    container_name: asn-supplier-web-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
    networks:
      - asn-network
    expose:
      - "3001"
    deploy:
      resources:
        limits:
          memory: 1024M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # 7. Frontend: Admin Governance Control Centre
  # ---------------------------------------------------------------------------
  admin-web:
    build:
      context: .
      dockerfile: apps/admin-web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://api.asn.in/api/v1
    container_name: asn-admin-web-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3002
    networks:
      - asn-network
    expose:
      - "3002"
    deploy:
      resources:
        limits:
          memory: 768M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# -----------------------------------------------------------------------------
# Networks & Persistent Volumes
# -----------------------------------------------------------------------------
networks:
  asn-network:
    driver: bridge

volumes:
  postgres_prod_data:
    driver: local
  redis_prod_data:
    driver: local
  caddy_data:
    driver: local
  caddy_config:
    driver: local
```

---

## 3. Caddy Reverse Proxy Configuration (`Caddyfile`)

Caddy handles automatic HTTPS certificate provisioning and renewals via Let's Encrypt / ZeroSSL with zero manual certbot maintenance.

Create a `Caddyfile` in the project root:

```caddyfile
{
    email devops@asn.in
    admin off
}

# 1. Core API Server
api.asn.in {
    encode gzip zstd

    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Proxy to NestJS API container
    reverse_proxy api-server:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
}

# 2. Buyer Marketplace Portal
buyer.asn.in, asn.in {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
    }

    reverse_proxy buyer-web:3000
}

# 3. Supplier Operating System
supplier.asn.in {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
    }

    reverse_proxy supplier-web:3001
}

# 4. Admin Governance Control Centre
admin.asn.in {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    reverse_proxy admin-web:3002
}
```

---

## 4. Operational Runbook Commands

### 4.1 Initial Launch

```bash
# 1. Verify production environment file
cp .env.production.example .env.production
nano .env.production # Fill in strong random secrets

# 2. Build and launch all containers in detached mode
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Execute database migrations inside the running API container
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database db:push

# 4. Seed master database if first deployment
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database seed
```

### 4.2 Health & Status Inspection

```bash
# View status of all containers
docker compose -f docker-compose.prod.yml ps

# View live API server logs
docker compose -f docker-compose.prod.yml logs -f api-server

# Check reverse proxy routing logs
docker compose -f docker-compose.prod.yml logs -f caddy
```

### 4.3 Zero-Downtime Application Update

```bash
# 1. Pull latest code from GitHub
git pull origin main

# 2. Rebuild images without bringing down the database
docker compose -f docker-compose.prod.yml build api-server buyer-web supplier-web admin-web

# 3. Run migrations
docker compose -f docker-compose.prod.yml exec api-server pnpm --filter @asn/database db:push

# 4. Gracefully recreate application containers
docker compose -f docker-compose.prod.yml up -d --no-deps api-server buyer-web supplier-web admin-web
```
