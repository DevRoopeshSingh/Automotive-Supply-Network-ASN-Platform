# Automotive Supply Network (ASN) — Smoke Test Checklist

**Document Version:** 1.0.0  
**Execution Time:** ~5–7 Minutes  
**Target:** Local Startup / CI Deployment Verification / Staging Sanity Check

---

## Pre-flight Checklist

- [ ] **Docker Containers Running:** PostgreSQL (Port 5432) & Redis (Port 6379).
- [ ] **Environment Files Present:** Root `.env`, `apps/supplier-web/.env`, `apps/admin-web/.env`, `apps/buyer-web/.env`.
- [ ] **Database Schema Synchronized:** `pnpm db:push` or `pnpm db:migrate` completed.
- [ ] **Database Seeded:** `pnpm db:seed` completed successfully.
- [ ] **Applications Running:**
  - `apps/api-server` (Port 4000)
  - `apps/buyer-web` (Port 3000)
  - `apps/supplier-web` (Port 3001)
  - `apps/admin-web` (Port 3002)

---

## Quick Verification Matrix (Step-by-Step)

|  Step  | Action                    | Endpoint / Screen                                                                                   | Expected Result                                                          | Checked |
| :----: | :------------------------ | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :-----: |
| **1**  | **API Health Check**      | `GET http://localhost:4000/api/v1/health`                                                           | HTTP 200 with status `"healthy"`, timestamp, and uptime                  |   [ ]   |
| **2**  | **Dev OTP Login**         | `POST http://localhost:4000/api/v1/auth/otp/verify` with `{"phone": "9876543210", "otp": "123456"}` | HTTP 200 with JWT `accessToken` and user object                          |   [ ]   |
| **3**  | **Buyer Catalog Search**  | Open `http://localhost:3000`, select `Hyundai` > `Creta`                                            | Bosch Brake Pad Set (`0 986 AB1 234`) displayed with fitment tags        |   [ ]   |
| **4**  | **Buyer RFQ Inspection**  | On `http://localhost:3000`, view Wholesale RFQs tab                                                 | `RFQ-2026-0001` listed in `PUBLISHED` status with 2 quotes               |   [ ]   |
| **5**  | **Quote Matrix View**     | Click **Compare Quotes** on `RFQ-2026-0001`                                                         | Modal shows SuperSpares (₹1,050) & National Parts (₹1,080)               |   [ ]   |
| **6**  | **Shipment Tracking**     | On `http://localhost:3000`, view Shipments tab                                                      | `SHP-2026-00001` shows `IN_TRANSIT` with 2 legs and Delhivery tracking   |   [ ]   |
| **7**  | **Proof of Delivery**     | Click **View Tracking** on `SHP-2026-00002`                                                         | Modal shows `DELIVERED` status and verified POD recipient "Sanjay Verma" |   [ ]   |
| **8**  | **Supplier Warehouses**   | Open `http://localhost:3001`, view Warehouses                                                       | SuperSpares North Hub (`WH-DEL-01`) listed with active badge             |   [ ]   |
| **9**  | **Supplier Live Stock**   | On `http://localhost:3001`, view Inventory table                                                    | Bosch Brake Pads (150 available), Oil Filters (200 available)            |   [ ]   |
| **10** | **Supplier Stock Adjust** | Click **Adjust Stock**, add `+10` units                                                             | Live stock updates to 160 immediately without page reload                |   [ ]   |
| **11** | **Admin Surveillance**    | Open `http://localhost:3002`, view Operations HQ                                                    | Global metrics (4 verified businesses, 2 active shipments, ₹51,000 GMV)  |   [ ]   |
| **12** | **Admin Master Part**     | On `http://localhost:3002`, view Master Products                                                    | 4 canonical products listed with OEM references and vehicle makes        |   [ ]   |

---

## Automated Smoke Command

Run the entire automated verification suite in one command:

```bash
# 1. Monorepo static & type checks
pnpm typecheck

# 2. Automated integration test suite
pnpm test

# 3. Playwright browser suite (if headless browsers installed)
pnpm test:e2e
```

**Passing criteria:** 100% tests green, 0 type errors, 0 lint warnings.
