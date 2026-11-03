import { z } from "zod";
import { StockStatus, StockVisibility, ImportJobStatus } from "@asn/types";

export const StockStatusEnum = z.nativeEnum(StockStatus);
export const StockVisibilityEnum = z.nativeEnum(StockVisibility);
export const ImportJobStatusEnum = z.nativeEnum(ImportJobStatus);

export const CreateWarehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Warehouse name must be at least 2 characters")
    .max(100, "Warehouse name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Warehouse code must be at least 2 characters")
    .max(30, "Warehouse code cannot exceed 30 characters")
    .regex(
      /^[A-Za-z0-9-_]+$/,
      "Warehouse code must contain only alphanumeric characters, dashes, and underscores",
    ),
  addressLine1: z.string().trim().min(3, "Address is required").max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number")
    .optional(),
  contactEmail: z.string().trim().email("Invalid email").optional(),
  isPrimary: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export type CreateWarehouseInput = z.input<typeof CreateWarehouseSchema>;

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();
export type UpdateWarehouseInput = z.input<typeof UpdateWarehouseSchema>;

export const CreateSupplierProductSchema = z.object({
  masterProductId: z.string().uuid("Valid Master Product ID required"),
  supplierSku: z
    .string()
    .trim()
    .min(1, "Supplier SKU is required")
    .max(50, "Supplier SKU cannot exceed 50 characters"),
  sellingPrice: z.number().positive("Selling price must be greater than 0"),
  mrp: z.number().positive("MRP must be greater than 0").optional(),
  costPrice: z
    .number()
    .positive("Cost price must be greater than 0")
    .optional(),
  minimumOrderQuantity: z.number().int().min(1).optional().default(1),
  leadTimeDays: z.number().int().min(0).max(60).optional().default(1),
  visibility: StockVisibilityEnum.optional().default(StockVisibility.PUBLIC),
  warehouseId: z.string().uuid("Valid Warehouse ID required").optional(),
  initialStock: z.number().int().min(0).optional().default(0),
  binLocation: z.string().trim().max(50).optional(),
  minStockThreshold: z.number().int().min(0).optional().default(5),
});
export type CreateSupplierProductInput = z.input<
  typeof CreateSupplierProductSchema
>;

export const UpdateSupplierProductSchema = z.object({
  sellingPrice: z
    .number()
    .positive("Selling price must be greater than 0")
    .optional(),
  mrp: z.number().positive("MRP must be greater than 0").optional(),
  costPrice: z
    .number()
    .positive("Cost price must be greater than 0")
    .optional(),
  minimumOrderQuantity: z.number().int().min(1).optional(),
  leadTimeDays: z.number().int().min(0).max(60).optional(),
  visibility: StockVisibilityEnum.optional(),
  stockStatus: StockStatusEnum.optional(),
});
export type UpdateSupplierProductInput = z.input<
  typeof UpdateSupplierProductSchema
>;

export const InventoryAdjustmentReasonEnum = z.enum([
  "INITIAL_STOCK",
  "RESTOCK",
  "PURCHASE",
  "SALE",
  "CORRECTION",
  "DAMAGED",
  "RETURN_RESTOCK",
  "AUDIT_ADJUSTMENT",
]);
export type InventoryAdjustmentReason = z.infer<
  typeof InventoryAdjustmentReasonEnum
>;

export const AdjustInventorySchema = z.object({
  warehouseId: z.string().uuid("Valid Warehouse ID required"),
  supplierProductId: z.string().uuid("Valid Supplier Product ID required"),
  changeQuantity: z
    .number()
    .int("Adjustment quantity must be an integer")
    .refine((val) => val !== 0, "Adjustment quantity cannot be zero"),
  reason: InventoryAdjustmentReasonEnum,
  notes: z.string().trim().max(255).optional(),
  binLocation: z.string().trim().max(50).optional(),
});
export type AdjustInventoryInput = z.input<typeof AdjustInventorySchema>;

export const WarehouseInventoryQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  q: z.string().trim().optional(),
  lowStockOnly: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type WarehouseInventoryQueryInput = z.input<
  typeof WarehouseInventoryQuerySchema
>;

export const SupplierProductQuerySchema = z.object({
  q: z.string().trim().optional(),
  stockStatus: StockStatusEnum.optional(),
  visibility: StockVisibilityEnum.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type SupplierProductQueryInput = z.input<
  typeof SupplierProductQuerySchema
>;

export const CsvInventoryRowSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(50),
  partNumber: z.string().trim().min(1, "Part number is required").max(50),
  brandName: z.string().trim().min(1, "Brand name is required").max(100),
  productName: z.string().trim().max(255).optional(),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  price: z.number().positive("Price must be greater than 0"),
  minStock: z.number().int().min(0).optional().default(5),
  binLocation: z.string().trim().max(50).optional(),
});
export type CsvInventoryRowInput = z.infer<typeof CsvInventoryRowSchema>;

export const UploadCsvImportSchema = z.object({
  warehouseId: z.string().uuid("Valid Warehouse ID required"),
  csvContent: z.string().min(5, "CSV content is required"),
  fileName: z.string().trim().optional().default("catalog_import.csv"),
});
export type UploadCsvImportInput = z.input<typeof UploadCsvImportSchema>;

export const ExecuteImportJobSchema = z.object({
  jobId: z.string().uuid("Valid Job ID required"),
});
export type ExecuteImportJobInput = z.input<typeof ExecuteImportJobSchema>;
