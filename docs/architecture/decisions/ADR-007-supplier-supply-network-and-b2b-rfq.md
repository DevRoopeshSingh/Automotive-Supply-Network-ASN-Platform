# ADR 007: Supplier Supply Network (SSN) — Supplier-to-Supplier Sourcing, Quotation Confidentiality & Atomic B2B RFQ Award

## Status

Accepted

## Context

Automotive suppliers, distributors, and workshops in India often encounter sudden stock-outs, unexpected fleet maintenance demands, or urgent wholesale procurement needs that cannot be met from their own warehouse inventory.
Key operational, commercial, and technical requirements include:

1. **Supplier-to-Supplier Sourcing**: Enabling verified automotive suppliers (`DISTRIBUTOR`, `WHOLESALER`, `MANUFACTURER`) to discover other suppliers carrying canonical parts from the `MasterProduct` catalog and raise wholesale RFQs.
2. **Complete B2B RFQ Lifecycle**: Supporting defined states (`DRAFT`, `PUBLISHED`, `RESPONSES_RECEIVED`, `UNDER_NEGOTIATION`, `AWARDED`, `REJECTED`, `CANCELLED`, `EXPIRED`), delivery deadlines, and quote validity limits.
3. **Strict Quotation Confidentiality**: Commercial pricing in wholesale aftermarket trading is highly sensitive. Competing suppliers bidding on an RFQ must **never** be allowed to view competitors' quotations or pricing. Only the RFQ buyer and the respective submitting supplier may view quote details.
4. **Negotiation & Revision History**: Suppliers must be able to revise quotations prior to award, while maintaining an immutable audit log and snapshot history of previous bids.
5. **Atomic RFQ Award & Race Condition Protection**: Awarding an RFQ must be an atomic transaction that marks the winning quote `ACCEPTED`, rejects all competing active quotes, and transitions the RFQ to `AWARDED`. Duplicate or concurrent awards must be strictly rejected.

## Decisions

### 1. RFQ Domain Model & Network Discovery (`SourcingRfq`)

- **`SourcingRfq`**: Captures `buyerBusinessId`, `masterProductId`, `quantity`, optional `targetPrice`, delivery location (`deliveryAddress`, `deliveryCity`, `deliveryState`, `deliveryPostalCode`), `deliveryDeadline`, and quotation `expiresAt`.
- **Public vs. Private Network RFQs**: By default, published RFQs are visible to all eligible verified suppliers on the network. Buyers can optionally restrict an RFQ to specific invited suppliers via `RfqInvitedSupplier`.
- **Supplier Sourcing Discovery**: Query `discoverEligibleSuppliers` dynamically matches suppliers that have an active listing in `SupplierProduct` with positive available warehouse stock across their facilities.

### 2. Commercial Quotation Confidentiality & Revision History (`SourcingQuotation` & `QuotationRevision`)

- **Confidentiality Enforcement**:
  ```ts
  const isBuyer = quotation.rfq.buyerBusinessId === businessId;
  const isSupplier = quotation.supplierBusinessId === businessId;

  if (!isBuyer && !isSupplier) {
    throw new ForbiddenException(
      "Access denied: Commercial quotation details are strictly confidential between the buyer and the responding supplier",
    );
  }
  ```
- **Revision Snapshotting**:
  When a supplier revises a quote prior to award, current values are snapshotted into `QuotationRevision` (`quotationId`, `revisionNumber`, `unitPrice`, `totalAmount`, `leadTimeDays`, `validityUntil`, `notes`) before the active quotation is updated and its `revision` counter incremented.

### 3. Atomic RFQ Award Engine with Concurrency Guard

Awarding an RFQ executes inside `prisma.$transaction`:

1. Check that RFQ status is `PUBLISHED`, `RESPONSES_RECEIVED`, or `UNDER_NEGOTIATION`, and `awardedQuotationId` is null. If already awarded, throw `ConflictException("RFQ has already been awarded")`.
2. Verify the selected quotation belongs to this RFQ, is `SUBMITTED` or `REVISED`, and has not expired (`validityUntil >= now`).
3. Mark winning quotation as `ACCEPTED`.
4. Atomically reject all other competing active quotations for this RFQ:
   ```ts
   await tx.sourcingQuotation.updateMany({
     where: {
       rfqId,
       id: { not: quotationId },
       status: { in: [QuotationStatus.SUBMITTED, QuotationStatus.REVISED] },
     },
     data: { status: QuotationStatus.REJECTED },
   });
   ```
5. Update RFQ status to `AWARDED` with `awardedQuotationId: quotationId`.
6. Record audit entries for both buyer and winning supplier.

### 4. Non-Goals for Phase 2, Task 2.3

- **Payment Processing**: Payment settlements and gateway transactions are deferred to Phase 3.
- **Physical Inventory Reservation**: Actual stock reservation and delivery dispatch occur in subsequent purchase order and checkout flows. RFQs determine agreed commercial terms.

## Consequences

- **Positive**:
  - Eliminates quote leakage between competing distributors, maintaining commercial trust.
  - Safe against double-award race conditions via atomic transaction guards.
  - Full revision and audit trail enables transparency and dispute resolution.
  - Buyer comparison matrix calculates price savings vs target price and fastest lead times.
- **Negative / Considerations**:
  - Background expiration cron/worker will be beneficial in production to automatically transition expired RFQs and quotations to `EXPIRED` status without waiting for queries.
