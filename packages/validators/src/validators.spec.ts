import { describe, it, expect } from "vitest";
import {
  RequestOtpSchema,
  RegisterBusinessSchema,
  CreateStockReservationSchema,
  CreateProductSchema,
  AddFitmentSchema,
  CreateWarehouseSchema,
  AdjustInventorySchema,
  CsvInventoryRowSchema,
} from "./index";
import { BusinessType } from "@asn/types";

describe("ASN Validation Schemas", () => {
  it("should validate valid Indian mobile numbers", () => {
    const valid = RequestOtpSchema.safeParse({ phone: "9876543210" });
    expect(valid.success).toBe(true);

    const invalid = RequestOtpSchema.safeParse({ phone: "1234567890" });
    expect(invalid.success).toBe(false);
  });

  it("should validate business registration schema with valid GSTIN", () => {
    const valid = RegisterBusinessSchema.safeParse({
      legalName: "Apex Auto Spares Pvt Ltd",
      tradeName: "Apex Auto",
      businessType: BusinessType.DISTRIBUTOR,
      gstNumber: "27AABCS1429B1Z8",
      addressLine1: "Gala 4, Kurla Industrial Estate",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400070",
    });
    expect(valid.success).toBe(true);
  });

  it("should enforce 3 to 7 minutes reservation hold limit", () => {
    // 300 seconds (5 min) is valid
    const valid = CreateStockReservationSchema.safeParse({
      checkoutId: "123e4567-e89b-12d3-a456-426614174000",
      holdDurationSeconds: 300,
      items: [
        {
          supplierProductId: "123e4567-e89b-12d3-a456-426614174001",
          quantity: 2,
        },
      ],
    });
    expect(valid.success).toBe(true);

    // 100 seconds (too short) is invalid
    const invalidShort = CreateStockReservationSchema.safeParse({
      checkoutId: "123e4567-e89b-12d3-a456-426614174000",
      holdDurationSeconds: 100,
      items: [
        {
          supplierProductId: "123e4567-e89b-12d3-a456-426614174001",
          quantity: 2,
        },
      ],
    });
    expect(invalidShort.success).toBe(false);
  });

  it("should validate product creation schema with required fields", () => {
    const valid = CreateProductSchema.safeParse({
      partNumber: "0 986 AB1 234",
      brandId: "123e4567-e89b-12d3-a456-426614174000",
      categoryId: "123e4567-e89b-12d3-a456-426614174001",
      name: "Front Ceramic Brake Pad Set",
      conditionType: "AFTERMARKET",
      isSafetyCritical: true,
    });
    expect(valid.success).toBe(true);

    const invalid = CreateProductSchema.safeParse({
      partNumber: "",
      name: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("should enforce fitment year range validity", () => {
    // Valid fitment year span
    const validFitment = AddFitmentSchema.safeParse({
      vehicleVariantId: "123e4567-e89b-12d3-a456-426614174000",
      position: "Front Axle",
      fitmentStartYear: 2018,
      fitmentEndYear: 2022,
    });
    expect(validFitment.success).toBe(true);

    // Invalid fitment year span (start year > end year)
    const invalidFitment = AddFitmentSchema.safeParse({
      vehicleVariantId: "123e4567-e89b-12d3-a456-426614174000",
      fitmentStartYear: 2023,
      fitmentEndYear: 2020,
    });
    expect(invalidFitment.success).toBe(false);
    if (!invalidFitment.success) {
      expect(invalidFitment.error.errors[0]?.message).toContain(
        "Fitment start year cannot be greater than end year",
      );
    }
  });

  it("should validate warehouse creation schema with valid Indian PIN code", () => {
    const valid = CreateWarehouseSchema.safeParse({
      name: "Mayapuri Central Depot",
      code: "WH-DEL-01",
      addressLine1: "Plot 42, Mayapuri Phase II",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110064",
    });
    expect(valid.success).toBe(true);

    const invalidPin = CreateWarehouseSchema.safeParse({
      name: "Mayapuri Central Depot",
      code: "WH-DEL-01",
      addressLine1: "Plot 42, Mayapuri Phase II",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "010064", // Invalid first digit
    });
    expect(invalidPin.success).toBe(false);
  });

  it("should validate inventory adjustment input with non-zero change", () => {
    const validRestock = AdjustInventorySchema.safeParse({
      warehouseId: "123e4567-e89b-12d3-a456-426614174000",
      supplierProductId: "123e4567-e89b-12d3-a456-426614174001",
      changeQuantity: 25,
      reason: "RESTOCK",
    });
    expect(validRestock.success).toBe(true);

    const invalidZero = AdjustInventorySchema.safeParse({
      warehouseId: "123e4567-e89b-12d3-a456-426614174000",
      supplierProductId: "123e4567-e89b-12d3-a456-426614174001",
      changeQuantity: 0,
      reason: "RESTOCK",
    });
    expect(invalidZero.success).toBe(false);
  });

  it("should validate CSV row items with positive price and non-negative quantity", () => {
    const validRow = CsvInventoryRowSchema.safeParse({
      sku: "BOSCH-PAD-01",
      partNumber: "0 986 AB1 234",
      brandName: "Bosch",
      quantity: 50,
      price: 1850.5,
    });
    expect(validRow.success).toBe(true);

    const invalidRow = CsvInventoryRowSchema.safeParse({
      sku: "BOSCH-PAD-01",
      partNumber: "0 986 AB1 234",
      brandName: "Bosch",
      quantity: -5,
      price: -100,
    });
    expect(invalidRow.success).toBe(false);
  });
});
