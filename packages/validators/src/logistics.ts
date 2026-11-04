import { z } from "zod";
import {
  ShipmentStatus,
  LegType,
  LegStatus,
  LogisticsProviderType,
  ShipmentEventType,
} from "@asn/types";

export const ShipmentStatusEnum = z.nativeEnum(ShipmentStatus);
export const LegTypeEnum = z.nativeEnum(LegType);
export const LegStatusEnum = z.nativeEnum(LegStatus);
export const LogisticsProviderTypeEnum = z.nativeEnum(LogisticsProviderType);
export const ShipmentEventTypeEnum = z.nativeEnum(ShipmentEventType);

export const CreateShipmentItemSchema = z.object({
  masterProductId: z.string().uuid("Valid Master Product ID required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().positive("Unit price must be positive").optional(),
  sku: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateShipmentItemInput = z.input<typeof CreateShipmentItemSchema>;

export const CreateShipmentLegSchema = z.object({
  legSequence: z.number().int().min(1, "Leg sequence must start from 1"),
  legType: LegTypeEnum.default(LegType.LAST_MILE_DELIVERY),
  originFacilityName: z.string().trim().max(100).optional(),
  originAddress: z.string().trim().min(5, "Origin address required").max(300),
  originCity: z.string().trim().min(2, "Origin city required").max(100),
  originState: z.string().trim().min(2, "Origin state required").max(100),
  originPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  destinationFacilityName: z.string().trim().max(100).optional(),
  destinationAddress: z
    .string()
    .trim()
    .min(5, "Destination address required")
    .max(300),
  destinationCity: z
    .string()
    .trim()
    .min(2, "Destination city required")
    .max(100),
  destinationState: z
    .string()
    .trim()
    .min(2, "Destination state required")
    .max(100),
  destinationPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  assignedProviderId: z.string().uuid().optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  plannedDepartureAt: z.string().datetime().or(z.date()).optional(),
  plannedArrivalAt: z.string().datetime().or(z.date()).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateShipmentLegInput = z.input<typeof CreateShipmentLegSchema>;

export const CreateShipmentSchema = z.object({
  receiverBusinessId: z.string().uuid("Valid receiver business ID required"),
  sourcingRfqId: z.string().uuid().optional(),
  sourcingQuotationId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  pickupAddress: z.string().trim().min(5, "Pickup address required").max(300),
  pickupCity: z.string().trim().min(2, "Pickup city required").max(100),
  pickupState: z.string().trim().min(2, "Pickup state required").max(100),
  pickupPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  pickupWarehouseId: z.string().uuid().optional(),
  deliveryAddress: z
    .string()
    .trim()
    .min(5, "Delivery address required")
    .max(300),
  deliveryCity: z.string().trim().min(2, "Delivery city required").max(100),
  deliveryState: z.string().trim().min(2, "Delivery state required").max(100),
  deliveryPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Invalid Indian 6-digit PIN code"),
  deliveryContactName: z.string().trim().min(2).max(100).optional(),
  deliveryContactPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Valid 10-digit phone number required")
    .optional(),
  scheduledPickupAt: z.string().datetime().or(z.date()).optional(),
  estimatedDeliveryAt: z.string().datetime().or(z.date()).optional(),
  totalWeightKg: z.number().positive().optional(),
  totalVolumeCbm: z.number().positive().optional(),
  declaredValue: z.number().positive().optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(CreateShipmentItemSchema)
    .min(1, "At least one item is required in a shipment"),
  legs: z.array(CreateShipmentLegSchema).optional(),
});
export type CreateShipmentInput = z.input<typeof CreateShipmentSchema>;

export const UpdateShipmentStatusSchema = z.object({
  status: ShipmentStatusEnum,
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type UpdateShipmentStatusInput = z.input<
  typeof UpdateShipmentStatusSchema
>;

export const SubmitProofOfDeliverySchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name must be at least 2 characters")
    .max(100),
  recipientPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Valid 10-digit phone number required")
    .optional(),
  documentUrl: z.string().trim().url("Valid document URL required").optional(),
  verificationCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type SubmitProofOfDeliveryInput = z.input<
  typeof SubmitProofOfDeliverySchema
>;

export const RecordFailedDeliverySchema = z.object({
  failureReason: z
    .string()
    .trim()
    .min(3, "Failure reason must be specified")
    .max(500),
  initiateReturn: z.boolean().optional().default(false),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type RecordFailedDeliveryInput = z.input<
  typeof RecordFailedDeliverySchema
>;

export const CreateLogisticsProviderSchema = z.object({
  providerCode: z
    .string()
    .trim()
    .min(2, "Provider code must be at least 2 characters")
    .max(30)
    .regex(
      /^[A-Za-z0-9-_]+$/,
      "Provider code can contain only alphanumeric characters, dashes, and underscores",
    ),
  name: z
    .string()
    .trim()
    .min(2, "Provider name must be at least 2 characters")
    .max(100),
  providerType: LogisticsProviderTypeEnum.optional().default(
    LogisticsProviderType.THIRD_PARTY_3PL,
  ),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Valid 10-digit phone number required")
    .optional(),
  contactEmail: z.string().trim().email("Valid email required").optional(),
  trackingUrlTemplate: z.string().trim().max(500).optional(),
  businessId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateLogisticsProviderInput = z.input<
  typeof CreateLogisticsProviderSchema
>;

export const AssignProviderSchema = z.object({
  providerId: z.string().uuid("Valid logistics provider ID required"),
  legId: z.string().uuid().optional(),
  trackingNumber: z.string().trim().max(100).optional(),
});
export type AssignProviderInput = z.input<typeof AssignProviderSchema>;

export const AddTrackingEventSchema = z.object({
  eventType: ShipmentEventTypeEnum,
  legId: z.string().uuid().optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type AddTrackingEventInput = z.input<typeof AddTrackingEventSchema>;

export const ShipmentQuerySchema = z.object({
  status: ShipmentStatusEnum.optional(),
  senderBusinessId: z.string().uuid().optional(),
  receiverBusinessId: z.string().uuid().optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ShipmentQueryInput = z.input<typeof ShipmentQuerySchema>;
