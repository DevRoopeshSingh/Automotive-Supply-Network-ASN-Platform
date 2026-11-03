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
  LIMITED = "LIMITED",
  ON_REQUEST = "ON_REQUEST",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  DISCONTINUED = "DISCONTINUED",
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
