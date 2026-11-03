import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@asn/database";
import { normalizePartNumber } from "@asn/utils";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import { UploadCsvImportInput, CsvInventoryRowSchema } from "@asn/validators";
import {
  ImportJobStatus,
  StockStatus,
  StockVisibility,
  InventoryImportJobDetailDto,
} from "@asn/types";

interface ParsedCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
  sku?: string;
  partNumber?: string;
  brandName?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  minStock?: number;
  binLocation?: string;
  masterProductId?: string;
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class InventoryImportService {
  private readonly logger = createLogger("InventoryImportService");

  constructor(private readonly auditService: AuditService) {}

  /**
   * Parses CSV, validates all rows, checks duplicates and catalog existence,
   * stages preview in database, and returns validation report without mutating live inventory.
   */
  async previewCsvImport(
    businessId: string,
    userId: string,
    input: UploadCsvImportInput,
  ): Promise<InventoryImportJobDetailDto> {
    const warehouse = await prisma.supplierWarehouse.findFirst({
      where: { id: input.warehouseId, businessId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Active warehouse with ID '${input.warehouseId}' not found for your business.`,
      );
    }

    // 1. Parse CSV lines
    const parsedRows = this.parseCsv(input.csvContent);
    if (parsedRows.length === 0) {
      throw new BadRequestException("CSV file contains no readable data rows.");
    }

    // 2. Validate rows, detect duplicates in file, and resolve master products
    const seenSkus = new Set<string>();
    const seenPartBrand = new Set<string>();
    const errorReport: Array<{ row: number; sku?: string; error: string }> = [];

    // Preload brands for matching
    const allBrands = await prisma.brand.findMany({
      select: { id: true, name: true },
    });
    const brandMap = new Map<string, string>();
    allBrands.forEach((b) => brandMap.set(b.name.trim().toLowerCase(), b.id));

    for (const row of parsedRows) {
      // Validate schema
      const parseResult = CsvInventoryRowSchema.safeParse({
        sku: row.sku,
        partNumber: row.partNumber,
        brandName: row.brandName,
        productName: row.productName,
        quantity: row.quantity,
        price: row.price,
        minStock: row.minStock,
        binLocation: row.binLocation,
      });

      if (!parseResult.success) {
        row.isValid = false;
        parseResult.error.errors.forEach((err) => {
          const errMsg = `${err.path.join(".")}: ${err.message}`;
          row.errors.push(errMsg);
          errorReport.push({ row: row.rowNumber, sku: row.sku, error: errMsg });
        });
        continue;
      }

      const validData = parseResult.data;
      const skuLower = validData.sku.toLowerCase();
      const normPart = normalizePartNumber(validData.partNumber);
      const brandLower = validData.brandName.toLowerCase();
      const partBrandKey = `${brandLower}:${normPart}`;

      // In-file duplicate SKU detection
      if (seenSkus.has(skuLower)) {
        row.isValid = false;
        const msg = `Duplicate SKU '${validData.sku}' detected within this import file.`;
        row.errors.push(msg);
        errorReport.push({
          row: row.rowNumber,
          sku: validData.sku,
          error: msg,
        });
        continue;
      }
      seenSkus.add(skuLower);

      // In-file duplicate part + brand detection
      if (seenPartBrand.has(partBrandKey)) {
        row.isValid = false;
        const msg = `Duplicate part number '${validData.partNumber}' for brand '${validData.brandName}' within this import file.`;
        row.errors.push(msg);
        errorReport.push({
          row: row.rowNumber,
          sku: validData.sku,
          error: msg,
        });
        continue;
      }
      seenPartBrand.add(partBrandKey);

      // Catalog lookup: match brand & part number
      const brandId = brandMap.get(brandLower);
      let masterProduct = null;
      if (brandId) {
        masterProduct = await prisma.masterProduct.findFirst({
          where: {
            brandId,
            OR: [
              { normalizedPartNumber: normPart },
              { normalizedOemNumber: normPart },
              { oemReferences: { some: { normalizedOemNumber: normPart } } },
            ],
          },
        });
      }

      if (!masterProduct) {
        row.isValid = false;
        const msg = `Automotive part '${validData.partNumber}' under brand '${validData.brandName}' was not found in the ASN master catalog. Verify part number spelling or request catalog addition.`;
        row.errors.push(msg);
        errorReport.push({
          row: row.rowNumber,
          sku: validData.sku,
          error: msg,
        });
      } else {
        row.isValid = true;
        row.masterProductId = masterProduct.id;
      }
    }

    const totalRows = parsedRows.length;
    const validRows = parsedRows.filter((r) => r.isValid).length;
    const errorRows = totalRows - validRows;

    // 3. Create persistent Import Job & staged rows
    const job = await prisma.inventoryImportJob.create({
      data: {
        businessId,
        warehouseId: input.warehouseId,
        userId,
        fileName: input.fileName || "catalog_import.csv",
        fileType: "CSV",
        status: ImportJobStatus.PREVIEW_READY,
        totalRows,
        validRows,
        errorRows,
        processedRows: 0,
        metadata: {
          warehouseName: warehouse.name,
          warehouseCode: warehouse.code,
        },
        errorReport: errorReport as any,
        rows: {
          create: parsedRows.map((r) => ({
            rowNumber: r.rowNumber,
            sku: r.sku || "UNKNOWN",
            partNumber: r.partNumber || "UNKNOWN",
            brandName: r.brandName || "UNKNOWN",
            productName: r.productName,
            quantity: r.quantity || 0,
            price: r.price || 0,
            minStock: r.minStock,
            binLocation: r.binLocation,
            status: r.isValid ? "VALID" : "INVALID",
            errors: r.errors,
          })),
        },
      },
    });

    this.logger.info(
      `Import preview staged: Job ${job.id} (${validRows} valid, ${errorRows} errors)`,
      {
        businessId,
        warehouseId: input.warehouseId,
      },
    );

    return this.getImportJob(businessId, job.id);
  }

  /**
   * Executes the staged import job, committing valid rows into live inventory
   * within database transactions and generating audit movement records.
   */
  async executeImportJob(
    businessId: string,
    userId: string,
    jobId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<InventoryImportJobDetailDto> {
    const job = await prisma.inventoryImportJob.findFirst({
      where: { id: jobId, businessId },
      include: {
        warehouse: true,
        rows: {
          where: { status: "VALID" },
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(
        `Import job with ID '${jobId}' not found for your business.`,
      );
    }

    if (job.status !== ImportJobStatus.PREVIEW_READY) {
      throw new BadRequestException(
        `Cannot execute job in '${job.status}' status. Job must be in 'PREVIEW_READY' status.`,
      );
    }

    if (job.rows.length === 0) {
      throw new BadRequestException(
        "No valid rows found in this job to import.",
      );
    }

    // Set job to PROCESSING
    await prisma.inventoryImportJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.PROCESSING },
    });

    let processedCount = 0;
    const executionErrors: Array<{ row: number; sku?: string; error: string }> =
      [...(job.errorReport as any[])];

    // Preload brands for matching
    const allBrands = await prisma.brand.findMany({
      select: { id: true, name: true },
    });
    const brandMap = new Map<string, string>();
    allBrands.forEach((b) => brandMap.set(b.name.trim().toLowerCase(), b.id));

    // Process valid rows inside a transaction
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of job.rows) {
          const brandId = brandMap.get(row.brandName.trim().toLowerCase());
          const normPart = normalizePartNumber(row.partNumber);

          const masterProduct = await tx.masterProduct.findFirst({
            where: {
              brandId,
              OR: [
                { normalizedPartNumber: normPart },
                { normalizedOemNumber: normPart },
                { oemReferences: { some: { normalizedOemNumber: normPart } } },
              ],
            },
          });

          if (!masterProduct) {
            executionErrors.push({
              row: row.rowNumber,
              sku: row.sku,
              error: `Master product not found during execution for part ${row.partNumber}`,
            });
            await tx.inventoryImportRow.update({
              where: { id: row.id },
              data: { status: "FAILED" },
            });
            continue;
          }

          // Upsert Supplier Product
          let supplierProduct = await tx.supplierProduct.findUnique({
            where: {
              businessId_supplierSku: {
                businessId,
                supplierSku: row.sku,
              },
            },
          });

          if (!supplierProduct) {
            supplierProduct = await tx.supplierProduct.create({
              data: {
                businessId,
                masterProductId: masterProduct.id,
                supplierSku: row.sku,
                sellingPrice: row.price,
                availableQuantity: 0,
                reservedQuantity: 0,
                stockStatus: StockStatus.IN_STOCK,
                visibility: StockVisibility.PUBLIC,
              },
            });
          } else {
            // Update price on existing product listing
            await tx.supplierProduct.update({
              where: { id: supplierProduct.id },
              data: {
                sellingPrice: row.price,
              },
            });
          }

          // Upsert Warehouse Inventory
          let inventory = await tx.warehouseInventory.findUnique({
            where: {
              warehouseId_supplierProductId: {
                warehouseId: job.warehouseId,
                supplierProductId: supplierProduct.id,
              },
            },
          });

          const previousBalance = inventory ? inventory.quantity : 0;
          const newBalance = previousBalance + row.quantity;
          const newAvailable =
            (inventory ? inventory.availableQuantity : 0) + row.quantity;

          if (!inventory) {
            inventory = await tx.warehouseInventory.create({
              data: {
                warehouseId: job.warehouseId,
                supplierProductId: supplierProduct.id,
                binLocation: row.binLocation,
                quantity: newBalance,
                availableQuantity: newAvailable,
                reservedQuantity: 0,
                damagedQuantity: 0,
                minStockThreshold: row.minStock || 5,
              },
            });
          } else {
            inventory = await tx.warehouseInventory.update({
              where: { id: inventory.id },
              data: {
                quantity: newBalance,
                availableQuantity: newAvailable,
                binLocation: row.binLocation || inventory.binLocation,
                lastStockUpdate: new Date(),
              },
            });
          }

          // Log movement
          await tx.inventoryMovement.create({
            data: {
              warehouseInventoryId: inventory.id,
              warehouseId: job.warehouseId,
              supplierProductId: supplierProduct.id,
              userId,
              changeQuantity: row.quantity,
              previousBalance,
              newBalance,
              reason: "BULK_IMPORT",
              notes: `Imported via bulk CSV job '${job.fileName}' (Row ${row.rowNumber})`,
              referenceId: job.id,
            },
          });

          // Recalculate total available on SupplierProduct
          const agg = await tx.warehouseInventory.aggregate({
            where: { supplierProductId: supplierProduct.id },
            _sum: { availableQuantity: true },
          });

          const totalAvail = agg._sum.availableQuantity || 0;
          const updatedStatus =
            totalAvail <= 0
              ? StockStatus.OUT_OF_STOCK
              : totalAvail <= (row.minStock || 5)
                ? StockStatus.LOW_STOCK
                : StockStatus.IN_STOCK;

          await tx.supplierProduct.update({
            where: { id: supplierProduct.id },
            data: {
              availableQuantity: totalAvail,
              stockStatus: updatedStatus as any,
              lastStockUpdate: new Date(),
            },
          });

          await tx.inventoryImportRow.update({
            where: { id: row.id },
            data: { status: "PROCESSED" },
          });

          processedCount++;
        }
      });
    } catch (err: any) {
      this.logger.error("Failed to execute bulk import batch", err, { jobId });
      await prisma.inventoryImportJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.FAILED,
          errorReport: [
            ...executionErrors,
            { row: 0, error: err.message },
          ] as any,
        },
      });
      throw new BadRequestException(`Import execution failed: ${err.message}`);
    }

    const finalStatus =
      executionErrors.length > 0
        ? ImportJobStatus.PARTIAL_SUCCESS
        : ImportJobStatus.COMPLETED;

    const finalJob = await prisma.inventoryImportJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processedRows: processedCount,
        errorReport: executionErrors as any,
      },
      include: {
        warehouse: true,
      },
    });

    this.logger.info(
      `Bulk import completed: Job ${jobId} -> ${finalStatus} (${processedCount} processed)`,
      {
        businessId,
        warehouseId: job.warehouseId,
      },
    );

    await this.auditService.log({
      userId,
      businessId,
      action: "INVENTORY_BULK_IMPORT_EXECUTED",
      resource: `InventoryImportJob:${jobId}`,
      payload: {
        warehouse: job.warehouse.name,
        processedRows: processedCount,
        errorRows: executionErrors.length,
        status: finalStatus,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.mapJobDetail(finalJob);
  }

  async getImportJob(
    businessId: string,
    jobId: string,
  ): Promise<InventoryImportJobDetailDto> {
    const job = await prisma.inventoryImportJob.findFirst({
      where: { id: jobId, businessId },
      include: { warehouse: true },
    });

    if (!job) {
      throw new NotFoundException(
        `Import job with ID '${jobId}' not found for your business.`,
      );
    }

    return this.mapJobDetail(job);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private parseCsv(csvContent: string): ParsedCsvRow[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return [];
    }

    // Determine delimiter (comma, semicolon, or tab)
    const headerLine = lines[0]!;
    let delimiter = ",";
    if (headerLine.includes(";") && !headerLine.includes(",")) {
      delimiter = ";";
    } else if (headerLine.includes("\t")) {
      delimiter = "\t";
    }

    const headers = headerLine.split(delimiter).map((h) =>
      h
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    );

    const result: ParsedCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const values = line
        .split(delimiter)
        .map((v) => v.trim().replace(/^["']|["']$/g, ""));

      const rowDict: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowDict[h] = values[idx] || "";
      });

      // Flexible header mapping
      const sku =
        rowDict["sku"] ||
        rowDict["suppliersku"] ||
        rowDict["supplier_sku"] ||
        rowDict["part_sku"];
      const partNumber =
        rowDict["partnumber"] ||
        rowDict["part_number"] ||
        rowDict["part_no"] ||
        rowDict["oemnumber"] ||
        rowDict["oem_number"];
      const brandName =
        rowDict["brand"] ||
        rowDict["brandname"] ||
        rowDict["brand_name"] ||
        rowDict["manufacturer"];
      const productName =
        rowDict["name"] ||
        rowDict["productname"] ||
        rowDict["product_name"] ||
        rowDict["description"];
      const qtyStr =
        rowDict["quantity"] ||
        rowDict["qty"] ||
        rowDict["stock"] ||
        rowDict["available_quantity"];
      const priceStr =
        rowDict["price"] ||
        rowDict["sellingprice"] ||
        rowDict["selling_price"] ||
        rowDict["rate"];
      const minStockStr =
        rowDict["minstock"] || rowDict["min_stock"] || rowDict["threshold"];
      const binLocation =
        rowDict["bin"] ||
        rowDict["binlocation"] ||
        rowDict["bin_location"] ||
        rowDict["location"];

      result.push({
        rowNumber: i + 1, // 1-indexed Excel/CSV row number
        raw: rowDict,
        sku,
        partNumber,
        brandName,
        productName,
        quantity: qtyStr ? parseInt(qtyStr, 10) : undefined,
        price: priceStr ? parseFloat(priceStr) : undefined,
        minStock: minStockStr ? parseInt(minStockStr, 10) : undefined,
        binLocation,
        isValid: true,
        errors: [],
      });
    }

    return result;
  }

  private mapJobDetail(job: any): InventoryImportJobDetailDto {
    return {
      id: job.id,
      businessId: job.businessId,
      warehouseId: job.warehouseId,
      warehouseName: job.warehouse?.name,
      fileName: job.fileName,
      fileType: job.fileType,
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      errorRows: job.errorRows,
      processedRows: job.processedRows,
      metadata: (job.metadata as any) || {},
      errorReport: (job.errorReport as any) || [],
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
