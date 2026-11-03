import { z } from "zod";
import { BusinessType } from "@asn/types";

export const RegisterBusinessSchema = z.object({
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

export type RegisterBusinessInput = z.infer<typeof RegisterBusinessSchema>;
