/**
 * Core Domain Enums & Interfaces for Automotive Supply Network (ASN)
 */

export enum WorkspaceMode {
  BUYER = "BUYER",
  SUPPLIER = "SUPPLIER",
  SUPPLY_NETWORK = "SUPPLY_NETWORK",
  LOGISTICS = "LOGISTICS",
  ADMIN = "ADMIN",
}

export enum BusinessType {
  GARAGE = "GARAGE",
  WORKSHOP = "WORKSHOP",
  RETAILER = "RETAILER",
  WHOLESALER = "WHOLESALER",
  DISTRIBUTOR = "DISTRIBUTOR",
  MANUFACTURER = "MANUFACTURER",
  FLEET_OPERATOR = "FLEET_OPERATOR",
  LOGISTICS_PARTNER = "LOGISTICS_PARTNER",
}

export enum UserRole {
  // Platform Super Admin
  PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",

  // Tenant / Business RBAC Roles
  BUSINESS_OWNER = "BUSINESS_OWNER",
  BUSINESS_ADMIN = "BUSINESS_ADMIN",
  BUSINESS_MANAGER = "BUSINESS_MANAGER",
  BUSINESS_STAFF = "BUSINESS_STAFF",

  // Domain Roles
  GARAGE_OWNER = "GARAGE_OWNER",
  WORKSHOP_MANAGER = "WORKSHOP_MANAGER",
  FLEET_MANAGER = "FLEET_MANAGER",
  INDIVIDUAL_OWNER = "INDIVIDUAL_OWNER",
  SUPPLIER_ADMIN = "SUPPLIER_ADMIN",
  INVENTORY_MANAGER = "INVENTORY_MANAGER",
  FULFILLMENT_STAFF = "FULFILLMENT_STAFF",
  WHOLESALE_TRADER = "WHOLESALE_TRADER",
  DELIVERY_PARTNER = "DELIVERY_PARTNER",
  FLEET_DISPATCHER = "FLEET_DISPATCHER",
  CATALOG_SPECIALIST = "CATALOG_SPECIALIST",
  DISPATCH_CONTROLLER = "DISPATCH_CONTROLLER",
  FINANCE_CONTROLLER = "FINANCE_CONTROLLER",
}

export enum Permission {
  // Inventory
  INVENTORY_READ = "INVENTORY_READ",
  INVENTORY_WRITE = "INVENTORY_WRITE",
  INVENTORY_BULK_UPLOAD = "INVENTORY_BULK_UPLOAD",

  // Orders
  ORDER_READ = "ORDER_READ",
  ORDER_ACCEPT = "ORDER_ACCEPT",
  ORDER_CANCEL = "ORDER_CANCEL",
  ORDER_DISPATCH = "ORDER_DISPATCH",

  // Sourcing & RFQ
  RFQ_CREATE = "RFQ_CREATE",
  RFQ_QUOTE = "RFQ_QUOTE",
  WHOLESALE_TRADE = "WHOLESALE_TRADE",

  // Logistics
  LOGISTICS_ACCEPT = "LOGISTICS_ACCEPT",
  LOGISTICS_NAVIGATE = "LOGISTICS_NAVIGATE",
  LOGISTICS_POD = "LOGISTICS_POD",

  // Business Management
  BUSINESS_MANAGE = "BUSINESS_MANAGE",
  BUSINESS_INVITE = "BUSINESS_INVITE",

  // Administration
  ADMIN_CATALOG = "ADMIN_CATALOG",
  ADMIN_SETTLEMENT = "ADMIN_SETTLEMENT",
  ADMIN_DISPUTES = "ADMIN_DISPUTES",
  ADMIN_AUDIT = "ADMIN_AUDIT",
}

export enum InvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
}

export enum VehicleSegment {
  CAR = "CAR",
  TWO_WHEELER = "TWO_WHEELER",
  COMMERCIAL_VEHICLE = "COMMERCIAL_VEHICLE",
}

export enum ProductCondition {
  OEM = "OEM",
  OES = "OES",
  AFTERMARKET = "AFTERMARKET",
  REFURBISHED = "REFURBISHED",
  USED = "USED",
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DISCONTINUED = "DISCONTINUED",
}

export enum MediaType {
  IMAGE = "IMAGE",
  DIAGRAM = "DIAGRAM",
  DOCUMENT = "DOCUMENT",
  CERTIFICATE = "CERTIFICATE",
}

export enum StockStatus {
  IN_STOCK = "IN_STOCK",
  LOW_STOCK = "LOW_STOCK",
  LIMITED = "LIMITED",
  ON_REQUEST = "ON_REQUEST",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  INACTIVE = "INACTIVE",
  DISCONTINUED = "DISCONTINUED",
}

export enum ImportJobStatus {
  PENDING = "PENDING",
  PARSING = "PARSING",
  PREVIEW_READY = "PREVIEW_READY",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
  FAILED = "FAILED",
}

export enum StockVisibility {
  PUBLIC = "PUBLIC",
  VERIFIED_BUYERS = "VERIFIED_BUYERS",
  SUPPLIERS_ONLY = "SUPPLIERS_ONLY",
  SELECTED_CUSTOMERS = "SELECTED_CUSTOMERS",
  REQUEST_ONLY = "REQUEST_ONLY",
}

export enum ReservationStatus {
  ACTIVE = "ACTIVE",
  COMMITTED = "COMMITTED",
  EXPIRED = "EXPIRED",
  RELEASED = "RELEASED",
}

export enum OrderStatus {
  CREATED = "CREATED",
  AWAITING_SUPPLIER_CONFIRMATION = "AWAITING_SUPPLIER_CONFIRMATION",
  RESERVATION_PENDING = "RESERVATION_PENDING",
  ELIGIBLE = "ELIGIBLE",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY_FOR_PICKUP = "READY_FOR_PICKUP",
  DISPATCHED = "DISPATCHED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  DISPUTED = "DISPUTED",
}

export enum DeliveryLegType {
  PICKUP = "PICKUP",
  COLLECTION = "COLLECTION",
  TRANSFER = "TRANSFER",
  LAST_MILE = "LAST_MILE",
  HANDOVER = "HANDOVER",
}

export enum LedgerEntryType {
  PARTS_SALE = "PARTS_SALE",
  PARTS_COMMISSION = "PARTS_COMMISSION",
  DELIVERY_FEE = "DELIVERY_FEE",
  LOGISTICS_MARGIN = "LOGISTICS_MARGIN",
  TCS_GST = "TCS_GST",
  TDS = "TDS",
  REFUND_DEBIT = "REFUND_DEBIT",
  REFUND_REVERSAL = "REFUND_REVERSAL",
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface JwtAccessPayload {
  sub: string;
  phone: string;
  isSuperAdmin: boolean;
  activeBusinessId?: string;
  role?: UserRole;
  workspaceMode?: WorkspaceMode;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  familyId: string;
}

export interface UserContext {
  id: string;
  phone: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isSuperAdmin: boolean;
  activeBusinessId?: string;
  role?: UserRole;
  workspaceMode?: WorkspaceMode;
  memberships: BusinessSummary[];
}

export interface BusinessSummary {
  id: string;
  legalName: string;
  tradeName: string;
  businessType: BusinessType;
  role: UserRole;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface BusinessContext {
  id: string;
  legalName: string;
  tradeName: string;
  businessType: BusinessType;
  isVerified: boolean;
  gstNumber?: string | null;
  panNumber?: string | null;
  currentUserRole: UserRole;
}

// -----------------------------------------------------------------------------
// Catalog & Fitment DTOs
// -----------------------------------------------------------------------------

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  displayOrder: number;
  parentId?: string | null;
  children?: CategoryNode[];
}

export interface BrandDto {
  id: string;
  name: string;
  code?: string | null;
  countryOfOrigin?: string | null;
  logoUrl?: string | null;
  isOem: boolean;
  isActive: boolean;
}

export interface VehicleMakeDto {
  id: string;
  name: string;
  segment: VehicleSegment;
  logoUrl?: string | null;
  isActive: boolean;
}

export interface VehicleModelDto {
  id: string;
  makeId: string;
  name: string;
  isActive: boolean;
  make?: {
    id: string;
    name: string;
    segment: VehicleSegment;
  };
}

export interface VehicleVariantDto {
  id: string;
  modelId: string;
  variantName: string;
  startYear: number;
  endYear?: number | null;
  fuelType: string;
  engine?: string | null;
  engineCapacity?: number | null;
  transmission?: string | null;
  isActive: boolean;
  model?: {
    id: string;
    name: string;
    make: {
      id: string;
      name: string;
      segment: VehicleSegment;
    };
  };
}

export interface ProductMediaDto {
  id: string;
  url: string;
  mediaType: MediaType;
  altText?: string | null;
  isPrimary: boolean;
  displayOrder: number;
}

export interface OEMPartReferenceDto {
  id: string;
  oemNumber: string;
  normalizedOemNumber: string;
  vehicleMakeId?: string | null;
  vehicleMakeName?: string | null;
  notes?: string | null;
}

export interface ProductFitmentDto {
  id: string;
  masterProductId: string;
  vehicleVariantId: string;
  position?: string | null;
  fitmentStartYear?: number | null;
  fitmentEndYear?: number | null;
  isVerified: boolean;
  notes?: string | null;
  vehicleVariant?: VehicleVariantDto;
}

export interface ProductMasterSummary {
  id: string;
  partNumber: string;
  normalizedPartNumber: string;
  oemNumber?: string | null;
  normalizedOemNumber?: string | null;
  name: string;
  conditionType: ProductCondition;
  status: ProductStatus;
  isSafetyCritical: boolean;
  unitOfMeasure: string;
  brand: {
    id: string;
    name: string;
    isOem: boolean;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  primaryImageUrl?: string | null;
}

export interface ProductMasterDetail extends ProductMasterSummary {
  description?: string | null;
  specifications: Record<string, unknown>;
  dimensions?: Record<string, unknown> | null;
  barcode?: string | null;
  media: ProductMediaDto[];
  oemReferences: OEMPartReferenceDto[];
  fitments: ProductFitmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface VehicleCompatibilityResult {
  vehicleVariant: VehicleVariantDto;
  queryYear?: number;
  compatibleProductsCount: number;
  products: ProductMasterSummary[];
}

// -----------------------------------------------------------------------------
// Supplier OS & Multi-Warehouse Inventory DTOs
// -----------------------------------------------------------------------------

export interface SupplierWarehouseDto {
  id: string;
  businessId: string;
  name: string;
  code: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  inventoryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProductSummaryDto {
  id: string;
  businessId: string;
  masterProductId: string;
  supplierSku: string;
  sellingPrice: number;
  mrp?: number | null;
  costPrice?: number | null;
  availableQuantity: number;
  reservedQuantity: number;
  stockStatus: StockStatus;
  visibility: StockVisibility;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  masterProduct: {
    id: string;
    name: string;
    partNumber: string;
    normalizedPartNumber: string;
    brandName: string;
    categoryName: string;
  };
  warehouseStockCount: number;
  lastStockUpdate: string;
}

export interface WarehouseInventoryDto {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  supplierProductId: string;
  supplierSku: string;
  binLocation?: string | null;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  minStockThreshold: number;
  reorderLevel: number;
  reorderQuantity: number;
  lastStockUpdate: string;
}

export interface InventoryMovementDto {
  id: string;
  supplierProductId: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  userId?: string | null;
  changeQuantity: number;
  previousBalance: number;
  newBalance: number;
  reason: string;
  notes?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface InventoryImportJobSummaryDto {
  id: string;
  businessId: string;
  warehouseId: string;
  warehouseName?: string;
  fileName: string;
  fileType: string;
  status: ImportJobStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  processedRows: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryImportJobDetailDto extends InventoryImportJobSummaryDto {
  metadata: Record<string, unknown>;
  errorReport: Array<{
    row: number;
    sku?: string;
    error: string;
    data?: Record<string, unknown>;
  }>;
}

// -----------------------------------------------------------------------------
// Supplier Supply Network (SSN) & B2B RFQ DTOs
// -----------------------------------------------------------------------------

export enum RfqStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  RESPONSES_RECEIVED = "RESPONSES_RECEIVED",
  UNDER_NEGOTIATION = "UNDER_NEGOTIATION",
  AWARDED = "AWARDED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum QuotationStatus {
  SUBMITTED = "SUBMITTED",
  REVISED = "REVISED",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  WITHDRAWN = "WITHDRAWN",
}

export interface EligibleSupplierDto {
  businessId: string;
  legalName: string;
  tradeName: string;
  businessType: BusinessType;
  isVerified: boolean;
  city?: string | null;
  state?: string | null;
  hasListingForProduct: boolean;
  availableStock?: number;
}

export interface QuotationRevisionDto {
  id: string;
  quotationId: string;
  revisionNumber: number;
  unitPrice: number;
  totalAmount: number;
  availableQuantity: number;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  validityUntil: string;
  notes?: string | null;
  createdAt: string;
}

export interface SourcingQuotationSummaryDto {
  id: string;
  quoteNumber: string;
  rfqId: string;
  supplierBusinessId: string;
  supplierBusinessName: string;
  submittedById: string;
  unitPrice: number;
  totalAmount: number;
  availableQuantity: number;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  validityUntil: string;
  status: QuotationStatus;
  revision: number;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingQuotationDetailDto extends SourcingQuotationSummaryDto {
  terms?: string | null;
  notes?: string | null;
  revisions: QuotationRevisionDto[];
}

export interface SourcingRfqSummaryDto {
  id: string;
  rfqNumber: string;
  buyerBusinessId: string;
  buyerBusinessName: string;
  masterProductId: string;
  productName: string;
  partNumber: string;
  brandName: string;
  quantity: number;
  targetPrice?: number | null;
  deliveryCity: string;
  deliveryState: string;
  deliveryDeadline: string;
  expiresAt: string;
  status: RfqStatus;
  isExpired: boolean;
  quotationsCount: number;
  awardedQuotationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingRfqDetailDto extends SourcingRfqSummaryDto {
  createdById: string;
  createdByName?: string;
  deliveryAddress: string;
  deliveryPostalCode: string;
  notes?: string | null;
  categoryName?: string;
  invitedSuppliers: Array<{
    supplierBusinessId: string;
    tradeName: string;
    invitedAt: string;
  }>;
  awardedQuotation?: SourcingQuotationSummaryDto | null;
}

export interface RfqComparisonItemDto {
  quotationId: string;
  quoteNumber: string;
  supplierBusinessId: string;
  supplierName: string;
  unitPrice: number;
  totalAmount: number;
  availableQuantity: number;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  validityUntil: string;
  status: QuotationStatus;
  revision: number;
  priceDeltaVsTargetPercent?: number | null;
  isBestPrice: boolean;
  isFastestDelivery: boolean;
}

export interface RfqComparisonDto {
  rfq: SourcingRfqDetailDto;
  quotations: RfqComparisonItemDto[];
  lowestUnitPrice?: number | null;
  fastestLeadTimeDays?: number | null;
}

// -----------------------------------------------------------------------------
// Logistics Engine & Multi-Leg Delivery Orchestration DTOs
// -----------------------------------------------------------------------------

export enum ShipmentStatus {
  DRAFT = "DRAFT",
  CREATED = "CREATED",
  PICKUP_SCHEDULED = "PICKUP_SCHEDULED",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  DELIVERY_FAILED = "DELIVERY_FAILED",
  CANCELLED = "CANCELLED",
  RETURN_INITIATED = "RETURN_INITIATED",
  RETURNED = "RETURNED",
}

export enum LegType {
  FIRST_MILE_PICKUP = "FIRST_MILE_PICKUP",
  MID_MILE_TRANSFER = "MID_MILE_TRANSFER",
  HUB_SORTING = "HUB_SORTING",
  LAST_MILE_DELIVERY = "LAST_MILE_DELIVERY",
}

export enum LegStatus {
  PENDING = "PENDING",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum LogisticsProviderType {
  INTERNAL_FLEET = "INTERNAL_FLEET",
  THIRD_PARTY_3PL = "THIRD_PARTY_3PL",
  HYPERLOCAL = "HYPERLOCAL",
  INTERCITY_FREIGHT = "INTERCITY_FREIGHT",
}

export enum ShipmentEventType {
  SHIPMENT_CREATED = "SHIPMENT_CREATED",
  PICKUP_SCHEDULED = "PICKUP_SCHEDULED",
  PICKED_UP = "PICKED_UP",
  LEG_STARTED = "LEG_STARTED",
  ARRIVED_AT_HUB = "ARRIVED_AT_HUB",
  DEPARTED_HUB = "DEPARTED_HUB",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERY_ATTEMPTED = "DELIVERY_ATTEMPTED",
  DELIVERY_FAILED = "DELIVERY_FAILED",
  DELIVERED = "DELIVERED",
  RETURN_INITIATED = "RETURN_INITIATED",
  RETURNED = "RETURNED",
  CANCELLED = "CANCELLED",
  STATUS_UPDATED = "STATUS_UPDATED",
}

export interface LogisticsProviderDto {
  id: string;
  providerCode: string;
  name: string;
  providerType: LogisticsProviderType;
  contactPhone?: string | null;
  contactEmail?: string | null;
  trackingUrlTemplate?: string | null;
  isActive: boolean;
  businessId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentItemDto {
  id: string;
  shipmentId: string;
  masterProductId: string;
  productName: string;
  partNumber: string;
  brandName?: string;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
  sku?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ShipmentLegDto {
  id: string;
  shipmentId: string;
  legSequence: number;
  legType: LegType;
  status: LegStatus;
  originFacilityName?: string | null;
  originAddress: string;
  originCity: string;
  originState: string;
  originPostalCode: string;
  destinationFacilityName?: string | null;
  destinationAddress: string;
  destinationCity: string;
  destinationState: string;
  destinationPostalCode: string;
  assignedProviderId?: string | null;
  assignedProviderName?: string | null;
  trackingNumber?: string | null;
  plannedDepartureAt?: string | null;
  actualDepartureAt?: string | null;
  plannedArrivalAt?: string | null;
  actualArrivalAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentTrackingEventDto {
  id: string;
  shipmentId: string;
  legId?: string | null;
  eventType: ShipmentEventType;
  location?: string | null;
  notes?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  timestamp: string;
}

export interface ProofOfDeliveryDto {
  id: string;
  shipmentId: string;
  recipientName: string;
  recipientPhone?: string | null;
  deliveryTimestamp: string;
  documentUrl?: string | null;
  verificationCode?: string | null;
  confirmedByUserId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ShipmentSummaryDto {
  id: string;
  shipmentNumber: string;
  senderBusinessId: string;
  senderBusinessName: string;
  receiverBusinessId: string;
  receiverBusinessName: string;
  sourcingRfqId?: string | null;
  sourcingQuotationId?: string | null;
  orderId?: string | null;
  status: ShipmentStatus;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  scheduledPickupAt?: string | null;
  actualPickupAt?: string | null;
  estimatedDeliveryAt?: string | null;
  actualDeliveryAt?: string | null;
  currentLocation?: string | null;
  totalItemsCount: number;
  totalLegsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentDetailDto extends ShipmentSummaryDto {
  pickupAddress: string;
  pickupPostalCode: string;
  pickupWarehouseId?: string | null;
  pickupWarehouseName?: string | null;
  deliveryAddress: string;
  deliveryPostalCode: string;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  totalWeightKg?: number | null;
  totalVolumeCbm?: number | null;
  declaredValue?: number | null;
  deliveryFailureReason?: string | null;
  deliveryAttemptCount: number;
  notes?: string | null;
  items: ShipmentItemDto[];
  legs: ShipmentLegDto[];
  trackingEvents: ShipmentTrackingEventDto[];
  proofOfDelivery?: ProofOfDeliveryDto | null;
}
