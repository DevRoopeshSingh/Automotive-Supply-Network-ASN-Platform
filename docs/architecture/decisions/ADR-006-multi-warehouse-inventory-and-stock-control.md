# ADR 006: Multi-Warehouse Inventory Concurrency, Stock Ledger & Staged Bulk Catalog Import

## Status

Accepted

## Context

Automotive suppliers in India operate across multiple regional depots, central fulfillment hubs, and distributor facilities.
Key business and operational requirements include:

1. **Multi-Warehouse Stock**: A supplier lists a single SKU once against a canonical `MasterProduct`, but holds stock across multiple warehouses (e.g. Mayapuri Hub, Gurugram Depot).
2. **Race Conditions & Non-Negative Stock**: Simultaneous orders, manual stock adjustments, and shipments must never cause stock to become negative or desynchronize physical inventory from available-to-promise inventory.
3. **Auditable Movement Ledger**: Every addition, deduction, correction, or damage write-off must record previous balance, new balance, signed quantity change, business reason, and user identity.
4. **Resilient Bulk Import**: Suppliers frequently upload large spreadsheets (CSV/Excel) containing hundreds or thousands of parts. A single invalid row must not silently corrupt the batch, nor should an entire import fail if 95% of rows are valid.

## Decisions

### 1. Two-Tier Inventory Hierarchy (`SupplierProduct` & `WarehouseInventory`)

- **`SupplierProduct`**: Tenant-scoped product listing tying a supplier business to a `MasterProduct`. Holds selling price, MRP, cost price, MOQ, lead time, and aggregated available stock across all warehouses.
- **`WarehouseInventory`**: Warehouse-specific physical inventory holding `quantity`, `availableQuantity`, `reservedQuantity`, `damagedQuantity`, `binLocation`, and alert thresholds (`minStockThreshold`, `reorderLevel`).
- **Tenant Isolation**: Every warehouse and product listing explicitly references `businessId`. Queries enforce tenant scoping; suppliers cannot read or mutate another supplier's inventory.

### 2. Transactional Stock Adjustments & Non-Negative Invariants

- All inventory adjustments execute inside `prisma.$transaction`.
- Strict negative stock check:
  ```ts
  const newQuantity = inv.quantity + changeQuantity;
  const newAvailable = inv.availableQuantity + changeQuantity;
  if (newQuantity < 0 || newAvailable < 0) {
    throw new BadRequestException(
      "Insufficient stock. Balance cannot become negative.",
    );
  }
  ```
- Recalculates `SupplierProduct.availableQuantity` as the sum of all warehouse available balances, updating `stockStatus` dynamically (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
- Simultaneously creates an immutable `InventoryMovement` record capturing `previousBalance`, `newBalance`, `changeQuantity`, `reason`, `userId`, and `notes`.

### 3. Staged Bulk CSV Import Pipeline (Preview $\rightarrow$ Execution)

- **Phase 1: Parse & Validate**: Reads CSV headers, normalizes columns (`sku`, `partNumber`, `brandName`, `quantity`, `price`), validates with Zod, and checks for intra-file duplicate SKUs.
- **Phase 2: Catalog Matching**: Matches part numbers against the ASN `MasterProduct` catalog via indexed `normalizedPartNumber` and brand lookup.
- **Phase 3: Staged Preview**: Creates an `InventoryImportJob` in `PREVIEW_READY` status with staged rows in `InventoryImportRow`. Does not mutate live inventory.
- **Phase 4: Transactional Execution**: Commits valid rows into `SupplierProduct` and `WarehouseInventory`, logs movements with reason `BULK_IMPORT`, and marks job status as `COMPLETED` (or `PARTIAL_SUCCESS` if errors occurred).

## Consequences

- **Positive**:
  - Eliminates overselling and negative inventory bugs through database transactional guarantees.
  - Complete traceability for inventory discrepancies and tax/audit inspections.
  - Transparent error reporting with exact spreadsheet row numbers for failed items during bulk uploads.
- **Negative / Considerations**:
  - Requires maintaining `SupplierProduct.availableQuantity` aggregations on warehouse changes.
  - Very large CSV imports (100k+ rows) will require asynchronous queueing via BullMQ / Redis in future scale phases.
