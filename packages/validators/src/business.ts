import { z } from "zod";
import { BusinessType, UserRole } from "@asn/types";

export const CreateBusinessSchema = z.object({
  legalName: z
    .string()
    .min(3, "Legal name must be at least 3 characters")
    .max(150),
  tradeName: z
    .string()
    .min(2, "Trade name must be at least 2 characters")
    .max(150),
  businessType: z.nativeEnum(BusinessType),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format",
    )
    .optional(),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
    .optional(),
  addressLine1: z.string().min(5, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().regex(/^\d{6}$/, "Postal code must be 6 digits"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const RegisterBusinessSchema = CreateBusinessSchema;

export const UpdateBusinessSchema = z.object({
  legalName: z.string().min(3).max(150).optional(),
  tradeName: z.string().min(2).max(150).optional(),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format",
    )
    .optional(),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
    .optional(),
  addressLine1: z.string().min(5).optional(),
  addressLine2: z.string().optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  postalCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const SwitchBusinessContextSchema = z.object({
  businessId: z.string().uuid("Valid business ID required"),
});

export const InviteBusinessMemberSchema = z.object({
  phone: z
    .string()
    .regex(
      /^[6-9]\d{9}$/,
      "Please enter a valid 10-digit Indian mobile number",
    ),
  email: z.string().email("Invalid email address").optional(),
  role: z.nativeEnum(UserRole).default(UserRole.BUSINESS_STAFF),
});

export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
export type RegisterBusinessInput = CreateBusinessInput;
export type UpdateBusinessInput = z.infer<typeof UpdateBusinessSchema>;
export type SwitchBusinessContextInput = z.infer<
  typeof SwitchBusinessContextSchema
>;
export type InviteBusinessMemberInput = z.infer<
  typeof InviteBusinessMemberSchema
>;
