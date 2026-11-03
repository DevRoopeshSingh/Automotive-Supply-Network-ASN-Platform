# ADR 005: Automotive Catalog Architecture, Normalized Part Indexing & Vehicle Compatibility Engine

## Status

Accepted

## Context

Automotive aftermarket commerce critically depends on exact part compatibility and rapid lookup across heterogeneous, non-standardized numbering schemes.
In the Indian aftermarket:

1. OEM numbers, manufacturer SKUs, and cross-reference numbers often include varied punctuation, hyphens, slashes, or whitespace (e.g. `0 986 AB1 234`, `0986-AB1-234`, `0986AB1234`).
2. A single part (e.g. front brake pads) frequently fits multiple vehicle models and variants across specific manufacturing year spans (e.g., Hyundai Creta 1.5L Diesel 2020–present).
3. Public product master specifications must remain strictly decoupled from supplier-specific pricing, stock locations, and dynamic inventory levels to prevent tenant data leakage and maintain catalog integrity.

## Decisions

### 1. Master Product Catalog Decoupled from Supplier Listings

- `MasterProduct` represents the universal automotive part master (brand, category, specifications, normalized part number, dimensions, safety-critical flags, and media).
- Supplier inventory, wholesale/retail pricing, minimum order quantities, and warehouse locations reside in `SupplierProduct` (Phase 2, Task 2.2).
- Public and buyer-facing catalog queries read only from `MasterProduct` records with `status = ACTIVE`.

### 2. Dual Number Indexing (Original & Normalized)

- For every SKU and OEM number stored (`partNumber`, `oemNumber`), a companion uppercase alphanumeric-only column is generated and indexed (`normalizedPartNumber`, `normalizedOemNumber`).
- Query inputs are normalized using the `@asn/utils` function:
  ```ts
  partNumber
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, "");
  ```
- Search queries execute composite indexing checks across normalized fields, original fields, product titles, brand names, and linked `OEMPartReference` records.

### 3. Hierarchical Categories & Slugs

- `ProductCategory` uses a recursive self-referential adjacency list (`parentId`) allowing arbitrary depth (Root -> Subcategory -> Sub-assembly).
- Slugs are uniquely indexed to allow fast, SEO-friendly retrieval and aggregation (e.g., filtering all products in `brake-system` automatically includes child category parts such as `brake-pads` and `brake-discs-rotors`).

### 4. Vehicle Compatibility Engine

- Vehicle hierarchy is structured into three tiers:
  - `VehicleMake` (e.g. Hyundai, Maruti Suzuki, Tata, Mahindra)
  - `VehicleModel` (e.g. Creta, Swift, Nexon)
  - `VehicleVariant` (e.g. 1.5L CRDi Diesel SX with `startYear`, `endYear`, `fuelType`, `engineCapacity`, `transmission`)
- `ProductFitment` maps `(masterProductId, vehicleVariantId)` with optional position (`Front Axle`, `Rear`) and year overrides (`fitmentStartYear`, `fitmentEndYear`).
- Compatibility queries evaluate:
  1. Does queried year fall within variant manufacturing span: `variant.startYear <= year && (!variant.endYear || variant.endYear >= year)`?
  2. Does queried year fall within part fitment override: `(fitmentStartYear IS NULL || fitmentStartYear <= year) && (fitmentEndYear IS NULL || fitmentEndYear >= year)`?
  3. Is fitment verified and product active?

## Consequences

- **Positive**:
  - Eliminates "part doesn't fit my car" return disputes through strict year and variant matching.
  - Immune to spacing and hyphen differences in user or supplier input part numbers.
  - Efficient PostgreSQL compound index lookups (`[modelId, startYear, endYear]`, `[normalizedPartNumber]`, `[vehicleVariantId, isVerified]`).
- **Negative / Considerations**:
  - Requires maintaining and verifying vehicle fitment relationships as new model years are released.
  - Requires normalized columns to be consistently maintained on product write and update operations.
