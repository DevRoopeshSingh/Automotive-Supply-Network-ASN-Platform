/**
 * Sanitizes and normalizes an automotive OEM / Part Number for indexing and exact matching
 * Example: "  04465-0K280 " -> "044650K280"
 */
export function normalizePartNumber(partNumber: string): string {
  return partNumber
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, "");
}

/**
 * Validates standard 17-character ISO 3779 Vehicle Identification Number (VIN)
 */
export function isValidVIN(vin: string): boolean {
  const cleanVin = vin.trim().toUpperCase();
  // VINs do not contain I, O, Q to avoid confusion with 1 and 0
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
  return vinRegex.test(cleanVin);
}
