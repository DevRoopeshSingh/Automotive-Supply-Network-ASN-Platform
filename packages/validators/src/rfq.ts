import { z } from "zod";
import { RfqStatus, QuotationStatus } from "@asn/types";

export const RfqStatusEnum = z.nativeEnum(RfqStatus);
export const QuotationStatusEnum = z.nativeEnum(QuotationStatus);

export const CreateRfqSchema = z.object({
  masterProductId: z.string().uuid("Valid Master Product ID required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  targetPrice: z.number().positive("Target price must be positive").optional(),
  deliveryAddress: z
    .string()
    .trim()
    .min(5, "Delivery address must be at least 5 characters")
    .max(300),
  deliveryCity: z.string().trim().min(2, "City is required").max(100),
  deliveryState: z.string().trim().min(2, "State is required").max(100),
  deliveryPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  deliveryDeadline: z
    .string()
    .datetime("Valid ISO delivery deadline date string required")
    .or(z.date()),
  expiresAt: z
    .string()
    .datetime("Valid ISO expiry date string required")
    .or(z.date()),
  notes: z.string().trim().max(1000).optional(),
  publishImmediately: z.boolean().optional().default(false),
  invitedSupplierIds: z.array(z.string().uuid()).optional().default([]),
});
export type CreateRfqInput = z.input<typeof CreateRfqSchema>;

export const UpdateRfqSchema = CreateRfqSchema.partial();
export type UpdateRfqInput = z.input<typeof UpdateRfqSchema>;

export const SubmitQuotationSchema = z.object({
  rfqId: z.string().uuid("Valid RFQ ID required"),
  unitPrice: z.number().positive("Unit price must be positive"),
  availableQuantity: z
    .number()
    .int()
    .min(1, "Available quantity must be at least 1"),
  minimumOrderQuantity: z.number().int().min(1).optional().default(1),
  leadTimeDays: z
    .number()
    .int()
    .min(0, "Lead time cannot be negative")
    .max(365, "Lead time cannot exceed 365 days"),
  validityUntil: z
    .string()
    .datetime("Valid ISO validity date required")
    .or(z.date()),
  terms: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type SubmitQuotationInput = z.input<typeof SubmitQuotationSchema>;

export const ReviseQuotationSchema = z.object({
  unitPrice: z.number().positive("Unit price must be positive"),
  availableQuantity: z
    .number()
    .int()
    .min(1, "Available quantity must be at least 1"),
  minimumOrderQuantity: z.number().int().min(1).optional().default(1),
  leadTimeDays: z
    .number()
    .int()
    .min(0, "Lead time cannot be negative")
    .max(365, "Lead time cannot exceed 365 days"),
  validityUntil: z
    .string()
    .datetime("Valid ISO validity date required")
    .or(z.date()),
  terms: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type ReviseQuotationInput = z.input<typeof ReviseQuotationSchema>;

export const AwardRfqSchema = z.object({
  quotationId: z.string().uuid("Valid Quotation ID required to award RFQ"),
});
export type AwardRfqInput = z.input<typeof AwardRfqSchema>;

export const RfqQuerySchema = z.object({
  status: RfqStatusEnum.optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type RfqQueryInput = z.input<typeof RfqQuerySchema>;

export const QuotationQuerySchema = z.object({
  rfqId: z.string().uuid().optional(),
  status: QuotationStatusEnum.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type QuotationQueryInput = z.input<typeof QuotationQuerySchema>;
