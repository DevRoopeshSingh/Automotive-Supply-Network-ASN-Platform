import { z } from "zod";

export const ProductConditionEnum = z.enum([
  "OEM",
  "OES",
  "AFTERMARKET",
  "REFURBISHED",
  "USED",
]);

export const ProductStatusEnum = z.enum([
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "DISCONTINUED",
]);

export const MediaTypeEnum = z.enum([
  "IMAGE",
  "DIAGRAM",
  "DOCUMENT",
  "CERTIFICATE",
]);

export const VehicleSegmentEnum = z.enum([
  "CAR",
  "TWO_WHEELER",
  "COMMERCIAL_VEHICLE",
]);

export const CreateProductSchema = z.object({
  partNumber: z
    .string()
    .trim()
    .min(1, "Part number is required")
    .max(50, "Part number cannot exceed 50 characters"),
  brandId: z.string().uuid("Invalid brand ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name cannot exceed 255 characters"),
  description: z.string().trim().optional(),
  oemNumber: z.string().trim().max(50).optional(),
  conditionType: ProductConditionEnum.optional().default("AFTERMARKET"),
  status: ProductStatusEnum.optional().default("ACTIVE"),
  isSafetyCritical: z.boolean().optional().default(false),
  unitOfMeasure: z.string().trim().optional().default("PCS"),
  specifications: z.record(z.unknown()).optional().default({}),
  dimensions: z
    .object({
      weightKg: z.number().nonnegative().optional(),
      lengthCm: z.number().nonnegative().optional(),
      widthCm: z.number().nonnegative().optional(),
      heightCm: z.number().nonnegative().optional(),
    })
    .optional(),
  barcode: z.string().trim().optional(),
});

export type CreateProductInput = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.input<typeof UpdateProductSchema>;

export const ProductStatusUpdateSchema = z.object({
  status: ProductStatusEnum,
});
export type ProductStatusUpdateInput = z.input<
  typeof ProductStatusUpdateSchema
>;

export const ProductQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().trim().optional(),
  brandId: z.string().uuid().optional(),
  conditionType: ProductConditionEnum.optional(),
  status: ProductStatusEnum.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ProductQueryInput = z.input<typeof ProductQuerySchema>;

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must only contain lowercase alphanumeric characters and hyphens",
    )
    .optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().url("Invalid image URL").optional(),
  parentId: z.string().uuid("Invalid parent category ID").optional(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});
export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;

export const AddFitmentSchema = z
  .object({
    vehicleVariantId: z.string().uuid("Invalid vehicle variant ID"),
    position: z.string().trim().max(50).optional(),
    fitmentStartYear: z
      .number()
      .int("Fitment start year must be an integer")
      .min(1950, "Fitment start year must be >= 1950")
      .max(2050, "Fitment start year must be <= 2050")
      .optional(),
    fitmentEndYear: z
      .number()
      .int("Fitment end year must be an integer")
      .min(1950, "Fitment end year must be >= 1950")
      .max(2050, "Fitment end year must be <= 2050")
      .optional(),
    isVerified: z.boolean().optional().default(true),
    notes: z.string().trim().max(255).optional(),
  })
  .refine(
    (data) => {
      if (data.fitmentStartYear && data.fitmentEndYear) {
        return data.fitmentStartYear <= data.fitmentEndYear;
      }
      return true;
    },
    {
      message: "Fitment start year cannot be greater than end year",
      path: ["fitmentStartYear"],
    },
  );
export type AddFitmentInput = z.input<typeof AddFitmentSchema>;

export const AddOemReferenceSchema = z.object({
  oemNumber: z
    .string()
    .trim()
    .min(1, "OEM number is required")
    .max(50, "OEM number cannot exceed 50 characters"),
  vehicleMakeId: z.string().uuid("Invalid vehicle make ID").optional(),
  notes: z.string().trim().max(255).optional(),
});
export type AddOemReferenceInput = z.input<typeof AddOemReferenceSchema>;

export const AddProductMediaSchema = z.object({
  url: z.string().url("Invalid media URL"),
  mediaType: MediaTypeEnum.optional().default("IMAGE"),
  altText: z.string().trim().max(255).optional(),
  isPrimary: z.boolean().optional().default(false),
  displayOrder: z.number().int().optional().default(0),
});
export type AddProductMediaInput = z.input<typeof AddProductMediaSchema>;

export const VehicleCompatibilityQuerySchema = z.object({
  variantId: z.string().uuid("Invalid vehicle variant ID"),
  year: z.coerce
    .number()
    .int("Year must be an integer")
    .min(1950, "Year must be >= 1950")
    .max(2050, "Year must be <= 2050")
    .optional(),
});
export type VehicleCompatibilityQueryInput = z.input<
  typeof VehicleCompatibilityQuerySchema
>;
