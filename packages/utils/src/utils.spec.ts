import { describe, it, expect } from "vitest";
import {
  formatINR,
  calculateHaversineDistanceKm,
  normalizePartNumber,
  isValidVIN,
} from "./index";

describe("ASN Shared Utilities", () => {
  it("should format INR currency properly", () => {
    expect(formatINR(5000)).toContain("5,000");
    expect(formatINR(150000)).toContain("1,50,000");
  });

  it("should calculate Haversine distance in kilometers accurately", () => {
    // Mumbai CST (18.9401, 72.8354) to Bandra Station (19.0544, 72.8405) is ~12.7 km
    const distance = calculateHaversineDistanceKm(
      18.9401,
      72.8354,
      19.0544,
      72.8405,
    );
    expect(distance).toBeGreaterThan(12);
    expect(distance).toBeLessThan(14);
  });

  it("should normalize automotive part numbers", () => {
    expect(normalizePartNumber("  04465-0K280 ")).toBe("044650K280");
    expect(normalizePartNumber("wgh_991.12_b")).toBe("WGH99112B");
  });

  it("should validate ISO 3779 VIN numbers", () => {
    // Valid 17-char VIN
    expect(isValidVIN("MALBB51BLAM123456")).toBe(true);
    // Invalid containing 'I', 'O', or 'Q'
    expect(isValidVIN("MALI B51BLAM123456")).toBe(false);
    // Invalid length
    expect(isValidVIN("SHORTVIN123")).toBe(false);
  });
});
