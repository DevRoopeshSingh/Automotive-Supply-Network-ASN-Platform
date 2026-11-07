# Automotive Supply Network (ASN) — QA & UAT Test Plan

**Version:** 1.0.0  
**Target Release:** Phase 1-3 Functional Baseline  
**Environment:** Local Development / Dockerized QA Staging  
**Test Coverage:** Authentication, Catalog & Fitment, Supplier OS & Inventory, B2B RFQ & SSN Wholesale, Multi-Leg Logistics, Platform Admin

---

## 1. Test Environment & Pre-requisites

### 1.1 Service Ports

| Service                  | Local URL                      | Port |
| :----------------------- | :----------------------------- | :--- |
| **Buyer Web**            | `http://localhost:3000`        | 3000 |
| **Supplier Web**         | `http://localhost:3001`        | 3001 |
| **Admin Web**            | `http://localhost:3002`        | 3002 |
| **API Server**           | `http://localhost:4000/api/v1` | 4000 |
| **PostgreSQL + PostGIS** | `localhost:5432`               | 5432 |
| **Redis Cache**          | `localhost:6379`               | 6379 |

### 1.2 Seed Accounts & Credentials

| Role                         | Business Name              | Type              | Phone        | Dev OTP  | User ID                    |
| :--------------------------- | :------------------------- | :---------------- | :----------- | :------- | :------------------------- |
| **Platform Super Admin**     | ASN Operations HQ          | Super Admin       | `9999999999` | `123456` | `admin-super-uuid`         |
| **Buyer (Workshop)**         | Apex Multi-Brand Workshop  | WORKSHOP          | `9876543210` | `123456` | `user-buyer-seed-uuid`     |
| **Supplier 1 (Distributor)** | SuperSpares Distribution   | DISTRIBUTOR       | `9876543211` | `123456` | `user-supplier1-seed-uuid` |
| **Supplier 2 (Wholesaler)**  | National Parts Wholesalers | WHOLESALER        | `9876543212` | `123456` | `user-supplier2-seed-uuid` |
| **Logistics Carrier**        | Delhivery Express Freight  | LOGISTICS_PARTNER | `9876543213` | `123456` | `user-logistics-seed-uuid` |

---

## 2. Test Cases Specification

### Module 1: Identity, Authentication & Multi-Tenant RBAC

#### TC-AUTH-001: Phone OTP Request & Development Bypass

- **Module:** Authentication
- **Scenario:** Valid 10-digit Indian phone number requests OTP and logs in via dev bypass `123456`.
- **Preconditions:** API server is running in non-production mode (`NODE_ENV=development`).
- **Test Steps:**
  1. Open Buyer Web (`http://localhost:3000`) or send `POST /api/v1/auth/otp/request` with body `{"phone": "9876543210"}`.
  2. Verify response status is `200 OK` with `success: true`.
  3. Send `POST /api/v1/auth/otp/verify` with body `{"phone": "9876543210", "otp": "123456"}`.
- **Expected Result:** Login succeeds. Returns `{ user: { phone: "9876543210" }, tokens: { accessToken, refreshToken } }`. Access token is a signed JWT with 15-minute validity; refresh token is stored in DB with 7-day validity.
- **Pass / Fail:** PASS

#### TC-AUTH-002: Phone Validation & Rate-Limit Cooldown

- **Module:** Authentication
- **Scenario:** Enforce 10-digit Indian phone normalization and 60-second OTP cooldown.
- **Preconditions:** API server running.
- **Test Steps:**
  1. Send `POST /api/v1/auth/otp/request` with invalid phone `"12345"`.
  2. Send valid request for `"9876543210"`.
  3. Immediately send a second request for `"9876543210"` within 5 seconds.
- **Expected Result:**
  - Step 1 returns `400 Bad Request` (`Phone number must be a valid 10-digit Indian mobile number`).
  - Step 2 returns `200 OK`.
  - Step 3 returns `429 Too Many Requests` (`Please wait 60 seconds before requesting another OTP`).
- **Pass / Fail:** PASS

#### TC-AUTH-003: Refresh Token Rotation & Family Revocation

- **Module:** Authentication & Security
- **Scenario:** Verify refresh token rotation upon session refresh, and automatic family revocation upon token reuse.
- **Preconditions:** Active user session with valid `refreshToken`.
- **Test Steps:**
  1. Send `POST /api/v1/auth/session/refresh` with initial `refreshToken`.
  2. Verify newly rotated token pair is received.
  3. Replay initial (now revoked) `refreshToken`.
- **Expected Result:** Step 2 issues fresh access/refresh tokens. Step 3 detects token reuse, invalidates all sessions belonging to the token family, and returns `401 Unauthorized`.
- **Pass / Fail:** PASS

---

### Module 2: Automotive Product Catalog & Vehicle Fitment

#### TC-CAT-001: Vehicle Fitment Filtering (Make/Model/Year)

- **Module:** Catalog & Fitments
- **Scenario:** Workshop searches for brake pads compatible with Hyundai Creta 1.5L CRDi.
- **Preconditions:** Seed data populated (`pnpm db:seed`).
- **Test Steps:**
  1. Open Buyer Web (`http://localhost:3000`).
  2. Select Vehicle Make: `Hyundai`, Model: `Creta`, Year: `2022`.
  3. Type Search: `Brake Pad` or OEM number `58101-1RA00`.
- **Expected Result:** Bosch Ceramic Brake Pad Set (`0 986 AB1 234`) is displayed with OEM cross-reference, fitment tag `Hyundai Creta 1.5 CRDi`, OES condition badge, and Safety Critical flag.
- **Pass / Fail:** PASS

#### TC-CAT-002: Master Product Creation with OEM Cross-Reference (Admin)

- **Module:** Catalog Management
- **Scenario:** Platform Super Admin catalogs a new canonical automotive part.
- **Preconditions:** Admin Web logged in (`http://localhost:3002`).
- **Test Steps:**
  1. Click **+ Add Master Product** modal in Admin Web.
  2. Enter Brand: `NGK`, Category: `Ignition`, Part Number: `LFR6AIX-11`, OEM: `22401-AA630`.
  3. Set Condition: `AFTERMARKET`, Safety Critical: `false`.
  4. Submit form (`POST /api/v1/catalog/products`).
- **Expected Result:** Master Product is persisted with normalized part numbers (`LFR6AIX11`), OEM reference linked to Subaru/Toyota vehicle makes, and status set to `ACTIVE`.
- **Pass / Fail:** PASS

---

### Module 3: Supplier OS — Multi-Warehouse Inventory & Real-Time Stock Control

#### TC-SUP-001: Multi-Warehouse Management & Tenant Isolation

- **Module:** Supplier OS
- **Scenario:** Supplier 1 registers a secondary regional warehouse; verify Supplier 2 cannot view or mutate it.
- **Preconditions:** Supplier 1 logged in on Supplier Web (`http://localhost:3001`).
- **Test Steps:**
  1. Click **+ Add Warehouse** modal.
  2. Enter Name: `SuperSpares Kundli Logistics Park`, Code: `WH-HR-02`, City: `Sonipat`, State: `Haryana`, PIN: `131028`.
  3. Submit form (`POST /api/v1/supplier/warehouses`).
  4. Query warehouses as Supplier 2 (`GET /api/v1/supplier/warehouses` with `x-business-id: biz-supplier-national-2`).
- **Expected Result:** Warehouse is registered and active for SuperSpares. Supplier 2's query returns only their own Bhiwandi warehouse (`WH-MUM-01`), strictly isolating tenant data.
- **Pass / Fail:** PASS

#### TC-SUP-002: Atomic Stock Adjustment & Negative Stock Prevention

- **Module:** Supplier Inventory
- **Scenario:** Supplier receives a new shipment and adjusts stock; attempt negative stock deduction beyond balance.
- **Preconditions:** SuperSpares North Hub has 150 units of Bosch Brake Pads.
- **Test Steps:**
  1. In Supplier Web, click **Adjust Stock** on Bosch Front Brake Pads.
  2. Add `+50` units with Reason: `RESTOCK` (`POST /api/v1/supplier/inventory/adjust`).
  3. Verify new available quantity is `200`.
  4. Attempt deduction of `-250` units.
- **Expected Result:** Step 2 atomically updates balance to `200` and creates an audit movement in `InventoryMovement`. Step 4 is rejected with `400 Bad Request` (`Cannot deduct 250 units. Available stock is 200`), preventing negative inventory.
- **Pass / Fail:** PASS

#### TC-SUP-003: Staged Bulk CSV Import & Validation

- **Module:** Supplier Inventory Import
- **Scenario:** Supplier uploads inventory CSV containing valid rows, duplicate SKUs, and invalid part numbers.
- **Preconditions:** Supplier Web Inventory view.
- **Test Steps:**
  1. Drag and drop sample CSV into the bulk upload zone.
  2. Observe staged preview validation.
  3. Confirm import of valid rows.
- **Expected Result:** Validation flags missing catalog SKUs as errors, identifies in-file duplicates, and stages valid items for preview. Executing import creates supplier listings and records `PARTIAL_SUCCESS` job status.
- **Pass / Fail:** PASS

---

### Module 4: Supplier Supply Network (SSN) — Wholesale & B2B RFQ Engine

#### TC-RFQ-001: Wholesale RFQ Creation (Buyer)

- **Module:** SSN Wholesale
- **Scenario:** Workshop creates a wholesale sourcing RFQ for 50 units of Bosch Brake Pads.
- **Preconditions:** Buyer Web logged in (`http://localhost:3000`).
- **Test Steps:**
  1. In Buyer Web, click **Create Wholesale RFQ**.
  2. Select Bosch Brake Pad Set (`0 986 AB1 234`), Quantity: `50`, Target Price: `₹1,100`.
  3. Set Delivery Address: `Shop 4-6, Phase 2, Okhla`, PIN: `110020`, Delivery Deadline: `+7 days`.
  4. Submit form (`POST /api/v1/ssn/rfqs`).
- **Expected Result:** RFQ is assigned unique identifier `RFQ-2026-XXXX`, saved in `PUBLISHED` status, and made discoverable to verified distributors.
- **Pass / Fail:** PASS

#### TC-RFQ-002: Competing Quotation Bidding & Revisions (Suppliers)

- **Module:** SSN Quotations
- **Scenario:** SuperSpares and National Parts submit competing bids; SuperSpares revises their price.
- **Preconditions:** Open RFQ `RFQ-2026-0001` exists.
- **Test Steps:**
  1. In Supplier Web, open **B2B Wholesale RFQ Network**.
  2. SuperSpares submits Bid 1: Unit Price: `₹1,050`, Lead Time: `1 day` (`QT-2026-0001`).
  3. National Parts submits Bid 2: Unit Price: `₹1,080`, Lead Time: `2 days` (`QT-2026-0002`).
  4. SuperSpares revises Bid 1 to `₹1,020` with notes `Revised competitive rate`.
- **Expected Result:** SuperSpares quote increments to `revision: 2`, prior version is archived in `QuotationRevision`. Competing supplier cannot view or modify the bid.
- **Pass / Fail:** PASS

#### TC-RFQ-003: Commercial Confidentiality Enforcement

- **Module:** SSN Security
- **Scenario:** National Parts attempts to query SuperSpares' quotation details directly.
- **Preconditions:** Active quotes `QT-2026-0001` and `QT-2026-0002`.
- **Test Steps:**
  1. National Parts sends `GET /api/v1/ssn/quotations/{quote1Id}` with their `x-business-id`.
- **Expected Result:** API returns `403 Forbidden` (`Access denied: Commercial quotation details are strictly confidential between the buyer and the responding supplier`).
- **Pass / Fail:** PASS

#### TC-RFQ-004: Quotation Comparison Matrix & Atomic RFQ Award

- **Module:** SSN Award Engine
- **Scenario:** Workshop compares competing quotes, identifies best price, and awards RFQ.
- **Preconditions:** RFQ has 2 competing bids.
- **Test Steps:**
  1. In Buyer Web, click **Compare Quotes** on `RFQ-2026-0001`.
  2. Verify matrix shows SuperSpares as **Best Price (₹1,020)** and **Fastest Delivery (1 day)**.
  3. Click **Award RFQ** to SuperSpares (`POST /api/v1/ssn/rfqs/{id}/award`).
  4. Immediately click Award again to test race conditions.
- **Expected Result:** SuperSpares quote is set to `ACCEPTED`, National Parts quote is automatically set to `REJECTED`, RFQ status becomes `AWARDED`. Step 4 throws `409 Conflict` (`RFQ has already been awarded`).
- **Pass / Fail:** PASS

---

### Module 5: Logistics Engine & Multi-Leg Delivery Orchestration

#### TC-LOG-001: Multi-Leg Freight Shipment Generation

- **Module:** Logistics Orchestration
- **Scenario:** Awarded RFQ generates a multi-leg delivery from Mayapuri Hub to Okhla Workshop.
- **Preconditions:** Awarded RFQ exists.
- **Test Steps:**
  1. Supplier creates shipment (`POST /api/v1/logistics/shipments`) specifying Leg 1 (`FIRST_MILE_PICKUP` from Mayapuri to Sorting Center) and Leg 2 (`LAST_MILE_DELIVERY` from Sorting Center to Okhla).
  2. Assign carrier Delhivery (`LP-DELHIVERY`) with tracking number `DLV88776655`.
- **Expected Result:** Shipment `SHP-2026-XXXXX` created in `CREATED` status with 2 sequenced legs and initial checkpoint logged in `ShipmentTrackingEvent`.
- **Pass / Fail:** PASS

#### TC-LOG-002: State Machine Lifecycle Progression

- **Module:** Logistics State Machine
- **Scenario:** Advance shipment from `CREATED` -> `PICKUP_SCHEDULED` -> `PICKED_UP` -> `IN_TRANSIT` -> `OUT_FOR_DELIVERY`.
- **Preconditions:** Active shipment in `CREATED` status.
- **Test Steps:**
  1. Call `PUT /api/v1/logistics/shipments/{id}/status` with `PICKUP_SCHEDULED`.
  2. Call status update with `OUT_FOR_DELIVERY`.
  3. Attempt invalid transition directly from `CREATED` to `DELIVERED`.
- **Expected Result:** Valid transitions update status and record tracking events. Step 3 throws `400 Bad Request` (`Direct transition to DELIVERED is not permitted. Confirm delivery with Proof of Delivery via the /proof-of-delivery endpoint`).
- **Pass / Fail:** PASS

#### TC-LOG-003: Atomic Proof of Delivery (POD) & Leg Completion

- **Module:** Logistics Delivery Confirmation
- **Scenario:** Delivery agent submits physical receiver verification and OTP/document proof.
- **Preconditions:** Shipment in `OUT_FOR_DELIVERY` status.
- **Test Steps:**
  1. In Buyer Web or mobile client, call `POST /api/v1/logistics/shipments/{id}/proof-of-delivery` with:
     - Recipient Name: `Sanjay Verma`
     - Verification Code: `847291`
     - Document URL: `https://assets.asn.internal/pod-signed.jpg`
  2. Query shipment status.
  3. Attempt to cancel shipment after delivery.
- **Expected Result:** Step 1 atomically transitions shipment to `DELIVERED`, records `ProofOfDelivery`, and marks all remaining legs as `COMPLETED`. Step 3 throws `400 Bad Request` (`Cannot cancel shipment in DELIVERED status`).
- **Pass / Fail:** PASS

---

### Module 6: Platform Administration & Cross-Tenant Surveillance

#### TC-ADM-001: Operational Surveillance Ledger

- **Module:** Admin Web
- **Scenario:** Platform Super Admin audits all active shipments, carrier performance, and dispute logs across all businesses.
- **Preconditions:** Admin Web logged in (`http://localhost:3002`).
- **Test Steps:**
  1. Navigate to **Platform Shipments** tab.
  2. Filter by status: `IN_TRANSIT` and `DELIVERED`.
  3. Click **View Legs** and inspect multi-leg checkpoint history.
- **Expected Result:** Admin has global surveillance visibility across all tenants, displaying carrier codes, estimated vs. actual arrival timestamps, and verified proof-of-delivery documents.
- **Pass / Fail:** PASS
