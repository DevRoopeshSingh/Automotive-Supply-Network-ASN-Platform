# ASN System Architecture

## 1. Architectural Style: Modular Monolith

The Automotive Supply Network (ASN) backend is built as a **Modular Monolith** using **NestJS**.

### Why Not Microservices for MVP?

1. **Transaction Integrity:** Multi-supplier checkouts, 5-minute atomic stock reservations, and payment allocations require ACID transactions across tables. Distributed sagas or 2PC (Two-Phase Commit) would introduce latency and failure modes.
2. **Network Latency:** Meeting the **60-Minute Delivery Promise** requires sub-100ms internal processing for proximity searches and multi-leg route calculations. Internal in-memory method calls and event bus emissions are orders of magnitude faster than inter-service HTTP/gRPC roundtrips.
3. **Operational Simplicity:** Single deployment pipeline, shared database connection pooling, unified monitoring, and streamlined local development.

---

## 2. Data Flow & Boundary Isolation

```mermaid
flowchart TD
    Client[Web & Mobile Clients] -->|HTTPS / WSS| Ingress[Edge Ingress / Reverse Proxy]
    Ingress --> API[NestJS Modular Monolith]

    subgraph InternalModules [Encapsulated Domain Modules]
        Auth[Auth & Identity Module]
        Catalog[Master Catalog & Fitment]
        Inventory[Supplier Inventory]
        Reservation[Stock Reservation Engine]
        Logistics[60-Min Network Routing Engine]
        Commerce[Orders & Multi-Supplier Cart]
        Settlement[Commission & Financial Ledger]
    end

    API --> InternalModules
    Reservation <-->|Distributed Atomic Locks| Redis[(Redis 7)]
    InternalModules -->|ACID Persistence & Spatial Queries| Postgres[(PostgreSQL 16 + PostGIS)]
    InternalModules -->|Pre-signed Media Uploads| S3[(S3 Object Storage)]
```

### Module Encapsulation Rules

- **No Cross-Module Database Joins:** Modules access other module tables strictly through domain service interfaces.
- **Asynchronous Coupling via Domain Events:** Cross-cutting side effects (e.g., sending WhatsApp notifications after an order is confirmed, or logging commission ledger lines) are decoupled using NestJS `EventEmitter2`.

---

## 3. Data Tier Responsibilities

- **PostgreSQL 16 (Single Source of Truth):**
  - All financial ledger entries (immutable, append-only).
  - Master vehicle and part catalog.
  - Order states and supplier profiles.
  - PostGIS spatial data (`ST_DWithin`) for calculating local supplier density around garages.
- **Redis 7 (Distributed Coordination & Cache):**
  - 5-minute atomic reservation locks (`SET NX PX`).
  - BullMQ job queues for delayed reservation expiration.
  - User session tokens and invalidated token blacklists.

---

## 4. Multi-Tenant Identity, Authentication & Session Security

### 4.1 Phone-Based OTP Authentication

- **Indian Mobile Normalization:** Accepts `+91`, `0`, or 10-digit formats and normalizes to standard 10-digit format.
- **Security Controls:**
  - Rate-limited to max 5 requests per 15-minute sliding window with a mandatory 60-second cooldown between requests.
  - Maximum 5 failed verification attempts before permanent OTP invalidation.
  - OTPs stored exclusively as salted SHA-256 hashes (`otp_hash`).
  - Cryptographically secure timing-safe hash comparison (`crypto.timingSafeEqual`).
  - Single-use guarantee (`is_used: true`).
  - Uniform response messages to prevent phone number enumeration.
  - Zero OTP logging in production.

### 4.2 JWT Session Security & Refresh Token Rotation

- **Access Tokens:** Short-lived (15 minutes), containing user ID, phone, role, and active business context.
- **Refresh Tokens:** Long-lived (7 days), stored as SHA-256 hashes in `refresh_sessions`.
- **Automatic Reuse Detection:** Refresh tokens are bound to a cryptographic `familyId`. If an already-rotated or revoked token is replayed by an adversary, the entire token family is immediately invalidated, terminating all sessions for that device.
- **Dual Client Support:** Supports HttpOnly, Secure, `SameSite=Lax` cookies for browser clients, with simultaneous support for Authorization Bearer tokens in mobile requests.

### 4.3 Multi-Tenant RBAC & Tenant Isolation

- Users can belong to multiple businesses (`BusinessMember`).
- `TenantContextGuard` intercepts incoming requests, reads the `X-Business-Id` header, and verifies active membership in PostgreSQL.
- `RolesGuard` evaluates `@RequireRoles(UserRole.BUSINESS_OWNER, UserRole.BUSINESS_ADMIN)`.
- Platform Super Admins have universal read/write bypass for cross-tenant governance and emergency intervention.
- Sensitive actions (`USER_LOGIN_OTP`, `BUSINESS_CREATED`, `BUSINESS_CONTEXT_SWITCHED`, `BUSINESS_MEMBER_INVITED`) write immutable records to `audit_logs`.

## 5. Automotive Product Catalog & Vehicle Fitment Architecture

### 5.1 Decoupled Master Catalog vs. Supplier Inventory

- **`MasterProduct`**: Canonical representation of automotive aftermarket parts. Stores universal specifications, dimensions, brand, category, safety-critical indicators, media, and vehicle compatibility.
- **`SupplierProduct`**: Stores tenant-specific inventory, stock levels, warehouse locations, and pricing. Decoupled from `MasterProduct` to preserve catalog data integrity across multi-seller listings.
- **Access Boundaries**: Buyer searches query `MasterProduct` with status `ACTIVE`. Catalog mutation endpoints (`POST /api/v1/catalog/products`) require `BUSINESS_OWNER`, `BUSINESS_ADMIN`, `SUPPLIER_ADMIN`, or `CATALOG_SPECIALIST` privileges.

### 5.2 Punctuation-Insensitive Search & Normalized Part Numbers

- Indian automotive mechanics and suppliers query part numbers using unpredictable spacing and punctuation (e.g. `0 986 AB1 234`, `0986-AB1-234`, `0986AB1234`).
- All parts and OEM numbers maintain indexed normalized columns (`normalized_part_number`, `normalized_oem_number`) stripping spaces, dashes, dots, and underscores.
- Queries execute index scans across both original and normalized values, brand names, and linked OEM cross references (`oem_part_references`).

### 5.3 Hierarchical Category Engine

- Two-tier or multi-tier category structures managed through self-referential adjacency (`parent_id`).
- Unique slug indexing (`product_categories.slug`) allows querying top-level domains (e.g. `brake-system`) which automatically resolves child categories (e.g. `brake-pads`, `brake-discs-rotors`).

### 5.4 Vehicle Fitment & Compatibility Engine

- Structured three-tier vehicle hierarchy: `VehicleMake` -> `VehicleModel` -> `VehicleVariant`.
- `VehicleVariant` defines production year range (`start_year`, `end_year`), `fuel_type`, `engine_capacity`, and `transmission`.
- `ProductFitment` maps products to variants with optional component-level installation positions (`Front Axle`, `Rear`) and custom fitment year overrides (`fitment_start_year`, `fitment_end_year`).
- Compatibility verification ensures:
  1. The queried vehicle model year falls within the variant's manufacturing span.
  2. The queried year satisfies any component-specific fitment year overrides.
  3. The mapped fitment is verified (`is_verified = true`) and the product is active.

## 6. Supplier OS, Multi-Warehouse Inventory & Bulk Import Engine

### 6.1 Multi-Warehouse Management & Tenant Isolation

- **`SupplierWarehouse`**: Models physical warehouse facilities operated by a supplier business.
- Each warehouse is uniquely identified by `code` within the tenant scope (`[business_id, code]`).
- Supports primary warehouse designation (`is_primary`), geospatial coordinates (`latitude`, `longitude`), and contact metadata.
- All warehouse and inventory endpoints enforce strict tenant isolation via `TenantContextGuard` and `X-Business-Id`.

### 6.2 Real-Time Stock Control & Non-Negative Guarantees

- **`WarehouseInventory`**: Tracks warehouse-level stock partitions:
  - `quantity`: Total physical inventory on hand.
  - `availableQuantity`: Stock free to promise to buyers (`quantity - reservedQuantity - damagedQuantity`).
  - `reservedQuantity`: Stock held in active cart reservations or pending dispatch.
  - `damagedQuantity`: Stock quarantined due to transit or warehouse damage.
- **Atomic Concurrency Protection**:
  - All stock adjustments execute inside transactional blocks (`prisma.$transaction`).
  - Negative stock is strictly rejected: adjustments that would cause `quantity < 0` or `availableQuantity < 0` abort with `400 Bad Request`.
  - Dynamically recalculates `SupplierProduct.availableQuantity` as the aggregate sum across all active warehouses.
  - Automatically updates `stockStatus` to `OUT_OF_STOCK`, `LOW_STOCK`, or `IN_STOCK`.

### 6.3 Auditable Inventory Movement Ledger

- **`InventoryMovement`**: Every physical adjustment, restock, sale, correction, or import writes an immutable ledger entry.
- Records `previous_balance`, `new_balance`, signed `change_quantity`, `reason`, `notes`, `user_id`, and `reference_id` (e.g. order ID, PO number, or import job ID).

### 6.4 Staged Bulk CSV/Excel Import Pipeline

- **Four-Stage Ingestion Pipeline**:
  1. **Upload & Parse**: Accepts CSV content, detects delimiter (comma, semicolon, tab), and normalizes column headers.
  2. **Intra-File Validation**: Detects duplicate SKUs or duplicate part/brand combinations within the uploaded spreadsheet.
  3. **Master Catalog Matching**: Looks up each part number against indexed normalized part numbers in `MasterProduct`. Missing parts are flagged with row numbers.
  4. **Preview & Execution**: Staged in `InventoryImportJob` with status `PREVIEW_READY`. Suppliers review error reports before committing. Executing valid rows commits inventory in atomic batches and logs `BULK_IMPORT` movements, returning `COMPLETED` or `PARTIAL_SUCCESS`.

---

## 4. Multi-Tenant Identity, Authentication & Session Security

### 4.1 Phone-Based OTP Authentication

- **Indian Mobile Normalization:** Accepts `+91`, `0`, or 10-digit formats and normalizes to standard 10-digit format.
- **Security Controls:**
  - Rate-limited to max 5 requests per 15-minute sliding window with a mandatory 60-second cooldown between requests.
  - Maximum 5 failed verification attempts before permanent OTP invalidation.
  - OTPs stored exclusively as salted SHA-256 hashes (`otp_hash`).
  - Cryptographically secure timing-safe hash comparison (`crypto.timingSafeEqual`).
  - Single-use guarantee (`is_used: true`).
  - Uniform response messages to prevent phone number enumeration.
  - Zero OTP logging in production.

### 4.2 JWT Session Security & Refresh Token Rotation

- **Access Tokens:** Short-lived (15 minutes), containing user ID, phone, role, and active business context.
- **Refresh Tokens:** Long-lived (7 days), stored as SHA-256 hashes in `refresh_sessions`.
- **Automatic Reuse Detection:** Refresh tokens are bound to a cryptographic `familyId`. If an already-rotated or revoked token is replayed by an adversary, the entire token family is immediately invalidated, terminating all sessions for that device.
- **Dual Client Support:** Supports HttpOnly, Secure, `SameSite=Lax` cookies for browser clients, with simultaneous support for Authorization Bearer tokens in mobile requests.

### 4.3 Multi-Tenant RBAC & Tenant Isolation

- Users can belong to multiple businesses (`BusinessMember`).
- `TenantContextGuard` intercepts incoming requests, reads the `X-Business-Id` header, and verifies active membership in PostgreSQL.
- `RolesGuard` evaluates `@RequireRoles(UserRole.BUSINESS_OWNER, UserRole.BUSINESS_ADMIN)`.
- Platform Super Admins have universal read/write bypass for cross-tenant governance and emergency intervention.
- Sensitive actions (`USER_LOGIN_OTP`, `BUSINESS_CREATED`, `BUSINESS_CONTEXT_SWITCHED`, `BUSINESS_MEMBER_INVITED`) write immutable records to `audit_logs`.

## 5. Automotive Product Catalog & Vehicle Fitment Architecture

### 5.1 Decoupled Master Catalog vs. Supplier Inventory

- **`MasterProduct`**: Canonical representation of automotive aftermarket parts. Stores universal specifications, dimensions, brand, category, safety-critical indicators, media, and vehicle compatibility.
- **`SupplierProduct`**: Stores tenant-specific inventory, stock levels, warehouse locations, and pricing. Decoupled from `MasterProduct` to preserve catalog data integrity across multi-seller listings.
- **Access Boundaries**: Buyer searches query `MasterProduct` with status `ACTIVE`. Catalog mutation endpoints (`POST /api/v1/catalog/products`) require `BUSINESS_OWNER`, `BUSINESS_ADMIN`, `SUPPLIER_ADMIN`, or `CATALOG_SPECIALIST` privileges.

### 5.2 Punctuation-Insensitive Search & Normalized Part Numbers

- Indian automotive mechanics and suppliers query part numbers using unpredictable spacing and punctuation (e.g. `0 986 AB1 234`, `0986-AB1-234`, `0986AB1234`).
- All parts and OEM numbers maintain indexed normalized columns (`normalized_part_number`, `normalized_oem_number`) stripping spaces, dashes, dots, and underscores.
- Queries execute index scans across both original and normalized values, brand names, and linked OEM cross references (`oem_part_references`).

### 5.3 Hierarchical Category Engine

- Two-tier or multi-tier category structures managed through self-referential adjacency (`parent_id`).
- Unique slug indexing (`product_categories.slug`) allows querying top-level domains (e.g. `brake-system`) which automatically resolves child categories (e.g. `brake-pads`, `brake-discs-rotors`).

### 5.4 Vehicle Fitment & Compatibility Engine

- Structured three-tier vehicle hierarchy: `VehicleMake` -> `VehicleModel` -> `VehicleVariant`.
- `VehicleVariant` defines production year range (`start_year`, `end_year`), `fuel_type`, `engine_capacity`, and `transmission`.
- `ProductFitment` maps products to variants with optional component-level installation positions (`Front Axle`, `Rear`) and custom fitment year overrides (`fitment_start_year`, `fitment_end_year`).
- Compatibility verification ensures:
  1. The queried vehicle model year falls within the variant's manufacturing span.
  2. The queried year satisfies any component-specific fitment year overrides.
  3. The mapped fitment is verified (`is_verified = true`) and the product is active.

## 6. Supplier OS, Multi-Warehouse Inventory & Bulk Import Engine

### 6.1 Multi-Warehouse Management & Tenant Isolation

- **`SupplierWarehouse`**: Models physical warehouse facilities operated by a supplier business.
- Each warehouse is uniquely identified by `code` within the tenant scope (`[business_id, code]`).
- Supports primary warehouse designation (`is_primary`), geospatial coordinates (`latitude`, `longitude`), and contact metadata.
- All warehouse and inventory endpoints enforce strict tenant isolation via `TenantContextGuard` and `X-Business-Id`.

### 6.2 Real-Time Stock Control & Non-Negative Guarantees

- **`WarehouseInventory`**: Tracks warehouse-level stock partitions:
  - `quantity`: Total physical inventory on hand.
  - `availableQuantity`: Stock free to promise to buyers (`quantity - reservedQuantity - damagedQuantity`).
  - `reservedQuantity`: Stock held in active cart reservations or pending dispatch.
  - `damagedQuantity`: Stock quarantined due to transit or warehouse damage.
- **Atomic Concurrency Protection**:
  - All stock adjustments execute inside transactional blocks (`prisma.$transaction`).
  - Negative stock is strictly rejected: adjustments that would cause `quantity < 0` or `availableQuantity < 0` abort with `400 Bad Request`.
  - Dynamically recalculates `SupplierProduct.availableQuantity` as the aggregate sum across all active warehouses.
  - Automatically updates `stockStatus` to `OUT_OF_STOCK`, `LOW_STOCK`, or `IN_STOCK`.

### 6.3 Auditable Inventory Movement Ledger

- **`InventoryMovement`**: Every physical adjustment, restock, sale, correction, or import writes an immutable ledger entry.
- Records `previous_balance`, `new_balance`, signed `change_quantity`, `reason`, `notes`, `user_id`, and `reference_id` (e.g. order ID, PO number, or import job ID).

### 6.4 Staged Bulk CSV/Excel Import Pipeline

- **Four-Stage Ingestion Pipeline**:
  1. **Upload & Parse**: Accepts CSV content, detects delimiter (comma, semicolon, tab), and normalizes column headers.
  2. **Intra-File Validation**: Detects duplicate SKUs or duplicate part/brand combinations within the uploaded spreadsheet.
  3. **Master Catalog Matching**: Looks up each part number against indexed normalized part numbers in `MasterProduct`. Missing parts are flagged with row numbers.
  4. **Preview & Execution**: Staged in `InventoryImportJob` with status `PREVIEW_READY`. Suppliers review error reports before committing. Executing valid rows commits inventory in atomic batches and logs `BULK_IMPORT` movements, returning `COMPLETED` or `PARTIAL_SUCCESS`.
