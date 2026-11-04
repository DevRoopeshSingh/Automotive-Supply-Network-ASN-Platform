# ADR 008: Logistics Engine, Multi-Leg Delivery Orchestration & Proof of Delivery (POD)

## Status

Accepted

## Context

Automotive aftermarket parts procurement and wholesale trading on the Automotive Supply Network (ASN) require reliable, multi-modal, and auditable logistics orchestration. Deliveries range from rapid intracity dispatches (e.g., hyper-local workshop delivery) to intercity multi-leg freight movements involving supplier warehouse pickups, transit hub sorting, mid-mile line hauls, and final destination deliveries.

Key operational and technical requirements include:

1. **Deterministic Shipment State Machine**: An explicit 11-stage shipment lifecycle (`DRAFT`, `CREATED`, `PICKUP_SCHEDULED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `CANCELLED`, `RETURN_INITIATED`, `RETURNED`) with strict validation preventing invalid or unauthorized transitions.
2. **Multi-Leg Route Orchestration**: Capability to break shipments into ordered sequential legs (`FIRST_MILE_PICKUP`, `MID_MILE_TRANSFER`, `HUB_SORTING`, `LAST_MILE_DELIVERY`), allowing independent carrier assignment, leg status tracking, and automated single direct last-mile generation when no explicit legs are specified.
3. **Carrier & Fleet Partner Model**: A unified provider registry supporting `INTERNAL_FLEET`, `THIRD_PARTY_3PL`, `HYPERLOCAL`, and `INTERCITY_FREIGHT` partners, enabling leg-level carrier assignment and external tracking reference storage.
4. **Immutable Tracking Ledger**: An append-only audit trail (`ShipmentTrackingEvent`) capturing status transitions, locations, carrier pings, and operational exceptions with timestamps and metadata.
5. **Atomic Proof of Delivery (POD)**: Strict operational verification requiring recipient name, timestamp, signature/document URL, or OTP verification code before a shipment can be transitioned to `DELIVERED`. Direct status mutation to `DELIVERED` without POD is forbidden.
6. **Delivery Failure & Reverse Logistics**: Tracking failed delivery attempts with reason logging, attempt counters, and managed transitions into return workflows (`RETURN_INITIATED` $\rightarrow$ `RETURNED`).
7. **Strict Multi-Tenant Scoping**: Shipments must be accessible exclusively to the sender business, receiver business, or assigned logistics carrier. Unrelated tenants must receive `403 Forbidden`.

## Decisions

### 1. Shipment Domain & Multi-Leg Architecture (`Shipment`, `ShipmentLeg`, `ShipmentItem`)

- **`Shipment` Entity**:
  - Uniquely identified by UUID and human-readable tracking number (`SHP-YYYY-XXXXX`).
  - Scoped to `senderBusinessId` and `receiverBusinessId`.
  - Links to commercial origins: optional `sourcingRfqId`, `sourcingQuotationId`, and future purchase-order IDs.
  - Tracks physical locations: `pickupAddress`, `pickupCity`, `pickupState`, `pickupPostalCode`, and corresponding `deliveryAddress` fields.
  - Maintains `attemptsCount`, `maxDeliveryAttempts` (default: 3), and estimated delivery timestamps.
- **Ordered Sequential Legs (`ShipmentLeg`)**:
  - Sequenced by an integer `sequenceNumber` (1, 2, ...).
  - Categorized by `LegType` (`FIRST_MILE_PICKUP`, `MID_MILE_TRANSFER`, `HUB_SORTING`, `LAST_MILE_DELIVERY`).
  - Managed by `LegStatus` (`PENDING`, `SCHEDULED`, `ACTIVE`, `COMPLETED`, `FAILED`, `CANCELLED`).
  - Can be assigned independently to distinct `LogisticsProvider` entities.
  - Auto-generation fallback: If no legs are supplied on creation, the engine automatically creates a single sequence-1 `LAST_MILE_DELIVERY` leg connecting the pickup and delivery points.
- **Shipment Items (`ShipmentItem`)**:
  - Links canonical `masterProductId`, `quantity`, weight, and package dimensions.

### 2. Deterministic State Machine & Lifecycle Transitions

Valid state transitions are codified and strictly enforced:

```
                  ┌─────────┐
                  │  DRAFT  │
                  └────┬────┘
                       │
                  ┌────▼────┐
           ┌─────►│ CREATED │───────┐
           │      └────┬────┘       │
           │           │            │
           │ ┌─────────▼──────────┐ │
           │ │  PICKUP_SCHEDULED  │ │
           │ └─────────┬──────────┘ │
           │           │            │
           │      ┌────▼────┐       │
           │      │PICKED_UP│       │
           │      └────┬────┘       │
           │           │            │
           │      ┌────▼────┐       │
           │      │IN_TRANSIT│      │
           │      └────┬────┘       │
           │           │            │
           │ ┌─────────▼──────────┐ │
           │ │  OUT_FOR_DELIVERY  │ │
           │ └──────┬──────────┬──┘ │
           │        │          │    │
           │   [POD Submit]    │    │
           │        │          │    │
           │  ┌─────▼─────┐    │    │
           │  │ DELIVERED │    │    │
           │  └───────────┘    │    │
           │                   │    │
           │ [Failure/Retry]   │    │
           └───────┐           │    │
                   │           │    │
           ┌───────▼─────────┐ │    │
           │ DELIVERY_FAILED │ │    │
           └───────┬─────────┘ │    │
                   │           │    │
                   ▼           │    │
          ┌─────────────────┐  │    │
          │ RETURN_INITIATED│  │    │
          └────────┬────────┘  │    │
                   │           │    │
                   ▼           │    │
             ┌───────────┐     │    │
             │ RETURNED  │     │    │
             └───────────┘     │    │
                               │    │
                               ▼    ▼
                         ┌───────────┐
                         │ CANCELLED │
                         └───────────┘
```

- **Invariant Rules**:
  1. Once dispatched (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED`), a shipment cannot be `CANCELLED`.
  2. Transition to `DELIVERED` is prohibited via standard status update; it must occur through `submitProofOfDelivery`.
  3. Transitions to terminal states (`DELIVERED`, `CANCELLED`, `RETURNED`) are irreversible.

### 3. Proof of Delivery (POD) Engine (`ProofOfDelivery`)

Proof of delivery is recorded in an atomic database transaction:

1. **Eligibility Check**: Shipment must be in `OUT_FOR_DELIVERY` status.
2. **Payload Validation**: `recipientName` is mandatory; optional `recipientPhone`, `documentUrl` (signed slip, photo, or invoice), and `verificationCode` (OTP).
3. **Atomic Execution**:
   - Creates the `ProofOfDelivery` record linked to the shipment.
   - Sets `Shipment.status = DELIVERED` and `Shipment.actualDeliveryAt = now()`.
   - Sets all associated shipment legs to `COMPLETED`.
   - Appends a `DELIVERY_COMPLETED` tracking event to `ShipmentTrackingEvent`.
   - Records an immutable audit log entry.
4. **Duplicate Prevention**: If a shipment already has a POD or is marked `DELIVERED`, subsequent attempts throw `409 Conflict`.

### 4. Delivery Failure & Return Flow

When a delivery cannot be completed:

- `recordFailedDelivery` increments `attemptsCount` and writes the failure reason.
- If `initiateReturn: true` or `attemptsCount >= maxDeliveryAttempts`, the shipment transitions to `RETURN_INITIATED`.
- When the package arrives back at the sender warehouse, it transitions to `RETURNED`.

### 5. Multi-Tenant Authorization Guard

Every shipment inspection, leg update, or lifecycle transition enforces multi-tenant access:

- **Allowed Parties**: Sender business (`senderBusinessId`), Receiver business (`receiverBusinessId`), or the assigned logistics partner (`LogisticsProvider.businessId`).
- Platform super-admins (`ADMIN`) retain global management capabilities.
- Unrelated tenants attempting access receive an immediate `403 Forbidden`.

## Consequences

### Positive

- **End-to-End Visibility**: Complete tracking from supplier dispatch to workshop receipt across multiple freight legs.
- **Integrity & Compliance**: Deliveries cannot be marked completed without verifiable proof of delivery, eliminating phantom deliveries and dispute ambiguities.
- **Extensible Integration Boundary**: Clean abstraction layer ready to hook into third-party 3PL tracking APIs (Delhivery, Shiprocket, Porter) and IoT GPS pings without altering the core state machine.
- **Audit Trail**: Every milestone, status shift, and failure is immutably logged with actor references.

### Negative / Trade-Offs

- **Leg Sync Overhead**: Multi-leg shipments require leg state synchronization with the top-level shipment state. Handled programmatically during status updates.
- **External Webhooks Deferred**: Live 3PL webhook ingestion and automated GPS tracking are scheduled for future milestone integration; manual/API tracking events serve as the foundational bedrock.
