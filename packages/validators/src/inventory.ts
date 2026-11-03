import { z } from "zod";
import { StockStatus, StockVisibility } from "@asn/types";

export const UpsertSupplierProductSchema = z.object({
  masterProductId: z.string().uuid("Valid Master Product ID required"),
  supplierSku: z.string().min(1, "Supplier SKU is required").max(50),
  sellingPrice: z.number().positive("Selling price must be greater than 0"),
  availableQuantity: z
    .number()
    .int()
    .nonnegative("Quantity cannot be negative"),
  stockStatus: z.nativeEnum(StockStatus),
  visibility: z.nativeEnum(StockVisibility).default(StockVisibility.PUBLIC),
  warehouseLocation: z.string().max(100).optional(),
  minimumOrderQuantity: z.number().int().positive().default(1),
});

export const BulkInventoryUploadSchema = z.object({
  items: z
    .array(UpsertSupplierProductSchema)
    .min(1, "At least 1 item is required"),
});

export type UpsertSupplierProductInput = z.infer<
  typeof UpsertSupplierProductSchema
>;
export type BulkInventoryUploadInput = z.infer<
  typeof BulkInventoryUploadSchema
>;
