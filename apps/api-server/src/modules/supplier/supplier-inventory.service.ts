import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@asn/database";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import {
  CreateSupplierProductInput,
  UpdateSupplierProductInput,
  AdjustInventoryInput,
  WarehouseInventoryQueryInput,
  SupplierProductQueryInput,
} from "@asn/validators";
import {
  StockStatus,
  StockVisibility,
  SupplierProductSummaryDto,
  WarehouseInventoryDto,
  InventoryMovementDto,
} from "@asn/types";

@Injectable()
export class SupplierInventoryService {
  private readonly logger = createLogger("SupplierInventoryService");

  constructor(private readonly auditService: AuditService) {}

  // ===========================================================================
  // 1. Supplier Product Listings
  // ===========================================================================

  async createListing(
    businessId: string,
    userId: string,
    input: CreateSupplierProductInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<SupplierProductSummaryDto> {
    const masterProduct = await prisma.masterProduct.findUnique({
      where: { id: input.masterProductId },
      include: { brand: true, category: true },
    });

    if (!masterProduct) {
      throw new NotFoundException(
        `Master product with ID '${input.masterProductId}' not found in catalog.`,
      );
    }

    // Check duplicate SKU for this supplier
    const existingSku = await prisma.supplierProduct.findUnique({
      where: {
        businessId_supplierSku: {
          businessId,
          supplierSku: input.supplierSku.trim(),
        },
      },
    });
    if (existingSku) {
      throw new ConflictException(
        `A listing with supplier SKU '${input.supplierSku}' already exists for your business.`,
      );
    }

    // Check if supplier already listed this master product
    const existingMaster = await prisma.supplierProduct.findUnique({
      where: {
        businessId_masterProductId: {
          businessId,
          masterProductId: input.masterProductId,
        },
      },
    });
    if (existingMaster) {
      throw new ConflictException(
        `Your business has already created a listing for this product master (${existingMaster.supplierSku}). Use inventory adjustment to add warehouse stock.`,
      );
    }

    if (input.warehouseId) {
      const warehouse = await prisma.supplierWarehouse.findFirst({
        where: { id: input.warehouseId, businessId, isActive: true },
      });
      if (!warehouse) {
        throw new NotFoundException(
          `Warehouse with ID '${input.warehouseId}' not found or is inactive.`,
        );
      }
    }

    const initialStock = input.initialStock || 0;
    const initialStatus =
      initialStock <= 0
        ? StockStatus.OUT_OF_STOCK
        : initialStock <= (input.minStockThreshold || 5)
          ? StockStatus.LOW_STOCK
          : StockStatus.IN_STOCK;

    const listing = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierProduct.create({
        data: {
          businessId,
          masterProductId: input.masterProductId,
          supplierSku: input.supplierSku.trim(),
          sellingPrice: input.sellingPrice,
          mrp: input.mrp,
          costPrice: input.costPrice,
          availableQuantity: initialStock,
          reservedQuantity: 0,
          stockStatus: initialStatus as any,
          visibility: (input.visibility || StockVisibility.PUBLIC) as any,
          minimumOrderQuantity: input.minimumOrderQuantity || 1,
          leadTimeDays: input.leadTimeDays || 1,
        },
      });

      if (input.warehouseId && initialStock >= 0) {
        const inventory = await tx.warehouseInventory.create({
          data: {
            warehouseId: input.warehouseId,
            supplierProductId: created.id,
            binLocation: input.binLocation?.trim(),
            quantity: initialStock,
            availableQuantity: initialStock,
            reservedQuantity: 0,
            damagedQuantity: 0,
            minStockThreshold: input.minStockThreshold || 5,
          },
        });

        if (initialStock > 0) {
          await tx.inventoryMovement.create({
            data: {
              warehouseInventoryId: inventory.id,
              warehouseId: input.warehouseId,
              supplierProductId: created.id,
              userId,
              changeQuantity: initialStock,
              previousBalance: 0,
              newBalance: initialStock,
              reason: "INITIAL_STOCK",
              notes: "Initial inventory setup on product creation",
            },
          });
        }
      }

      return created;
    });

    this.logger.info(`Supplier listing created: ${listing.supplierSku}`, {
      businessId,
      listingId: listing.id,
      masterProductId: input.masterProductId,
    });

    await this.auditService.log({
      userId,
      businessId,
      action: "SUPPLIER_PRODUCT_LISTING_CREATED",
      resource: `SupplierProduct:${listing.id}`,
      payload: {
        sku: listing.supplierSku,
        sellingPrice: input.sellingPrice,
        initialStock,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.getListingById(businessId, listing.id);
  }

  async listListings(businessId: string, query: SupplierProductQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { businessId };

    if (query.stockStatus) {
      where.stockStatus = query.stockStatus;
    }
    if (query.visibility) {
      where.visibility = query.visibility;
    }

    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      where.OR = [
        { supplierSku: { contains: q, mode: "insensitive" } },
        { masterProduct: { name: { contains: q, mode: "insensitive" } } },
        { masterProduct: { partNumber: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.supplierProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          masterProduct: {
            include: { brand: true, category: true },
          },
          _count: {
            select: { warehouseInventories: true },
          },
        },
      }),
      prisma.supplierProduct.count({ where }),
    ]);

    return {
      items: listings.map((l) => this.mapListingSummary(l)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getListingById(
    businessId: string,
    id: string,
  ): Promise<SupplierProductSummaryDto> {
    const listing = await prisma.supplierProduct.findFirst({
      where: { id, businessId },
      include: {
        masterProduct: {
          include: { brand: true, category: true },
        },
        _count: {
          select: { warehouseInventories: true },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(
        `Supplier listing with ID '${id}' not found for your business.`,
      );
    }

    return this.mapListingSummary(listing);
  }

  async updateListing(
    businessId: string,
    id: string,
    userId: string,
    input: UpdateSupplierProductInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<SupplierProductSummaryDto> {
    const listing = await prisma.supplierProduct.findFirst({
      where: { id, businessId },
    });

    if (!listing) {
      throw new NotFoundException(
        `Supplier listing with ID '${id}' not found for your business.`,
      );
    }

    const updated = await prisma.supplierProduct.update({
      where: { id },
      data: {
        sellingPrice: input.sellingPrice,
        mrp: input.mrp !== undefined ? input.mrp : undefined,
        costPrice: input.costPrice !== undefined ? input.costPrice : undefined,
        minimumOrderQuantity: input.minimumOrderQuantity,
        leadTimeDays: input.leadTimeDays,
        visibility: input.visibility as any,
        stockStatus: input.stockStatus as any,
      },
    });

    await this.auditService.log({
      userId,
      businessId,
      action: "SUPPLIER_PRODUCT_LISTING_UPDATED",
      resource: `SupplierProduct:${id}`,
      payload: { updatedFields: Object.keys(input) },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.getListingById(businessId, updated.id);
  }

  // ===========================================================================
  // 2. Multi-Warehouse Inventory & Real-Time Stock Control
  // ===========================================================================

  async getWarehouseInventory(
    businessId: string,
    query: WarehouseInventoryQueryInput,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouse: { businessId },
    };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.lowStockOnly) {
      // Stock quantity is less than or equal to minimum threshold
      where.availableQuantity = {
        lte: prisma.warehouseInventory.fields.minStockThreshold,
      };
    }

    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      where.OR = [
        {
          supplierProduct: {
            supplierSku: { contains: q, mode: "insensitive" },
          },
        },
        {
          supplierProduct: {
            masterProduct: { name: { contains: q, mode: "insensitive" } },
          },
        },
        {
          supplierProduct: {
            masterProduct: { partNumber: { contains: q, mode: "insensitive" } },
          },
        },
        { binLocation: { contains: q, mode: "insensitive" } },
      ];
    }

    const [inventories, total] = await Promise.all([
      prisma.warehouseInventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ warehouse: { name: "asc" } }, { quantity: "asc" }],
        include: {
          warehouse: true,
          supplierProduct: true,
        },
      }),
      prisma.warehouseInventory.count({ where }),
    ]);

    return {
      items: inventories.map((inv) => this.mapInventoryDto(inv)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInventoryDetail(
    businessId: string,
    inventoryId: string,
  ): Promise<WarehouseInventoryDto> {
    const inventory = await prisma.warehouseInventory.findFirst({
      where: {
        id: inventoryId,
        warehouse: { businessId },
      },
      include: {
        warehouse: true,
        supplierProduct: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        `Warehouse inventory record '${inventoryId}' not found for your business.`,
      );
    }

    return this.mapInventoryDto(inventory);
  }

  /**
   * Atomic stock adjustment with strict negative stock prevention,
   * multi-warehouse aggregation, and auditable movement tracking.
   */
  async adjustStock(
    businessId: string,
    userId: string,
    input: AdjustInventoryInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<WarehouseInventoryDto> {
    // 1. Verify warehouse belongs to business and is active
    const warehouse = await prisma.supplierWarehouse.findFirst({
      where: { id: input.warehouseId, businessId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID '${input.warehouseId}' not found or is inactive for your business.`,
      );
    }

    // 2. Verify product belongs to business
    const supplierProduct = await prisma.supplierProduct.findFirst({
      where: { id: input.supplierProductId, businessId },
    });
    if (!supplierProduct) {
      throw new NotFoundException(
        `Supplier product with ID '${input.supplierProductId}' not found for your business.`,
      );
    }

    // 3. Execute atomic stock adjustment in transaction
    const updatedInventory = await prisma.$transaction(async (tx) => {
      let inv = await tx.warehouseInventory.findUnique({
        where: {
          warehouseId_supplierProductId: {
            warehouseId: input.warehouseId,
            supplierProductId: input.supplierProductId,
          },
        },
      });

      if (!inv) {
        if (input.changeQuantity < 0) {
          throw new BadRequestException(
            "Cannot deduct stock. Inventory record does not exist in this warehouse.",
          );
        }
        inv = await tx.warehouseInventory.create({
          data: {
            warehouseId: input.warehouseId,
            supplierProductId: input.supplierProductId,
            binLocation: input.binLocation?.trim(),
            quantity: 0,
            availableQuantity: 0,
            reservedQuantity: 0,
            damagedQuantity: 0,
          },
        });
      } else {
        // Row-level lock to serialize concurrent stock modifications
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`SELECT id FROM warehouse_inventories WHERE id = ${inv.id}::uuid FOR UPDATE`;
        }
        const locked = await tx.warehouseInventory.findUnique({
          where: { id: inv.id },
        });
        if (locked) {
          inv = locked;
        }
      }

      const previousBalance = inv.quantity;
      const newQuantity = inv.quantity + input.changeQuantity;
      const newAvailable = inv.availableQuantity + input.changeQuantity;

      // STRICT NEGATIVE STOCK PREVENTION
      if (newQuantity < 0 || newAvailable < 0) {
        throw new BadRequestException(
          `Insufficient stock. Current available: ${inv.availableQuantity}, attempted change: ${input.changeQuantity}. Balance cannot become negative.`,
        );
      }

      const updated = await tx.warehouseInventory.update({
        where: { id: inv.id },
        data: {
          quantity: newQuantity,
          availableQuantity: newAvailable,
          binLocation:
            input.binLocation !== undefined
              ? input.binLocation?.trim()
              : undefined,
          lastStockUpdate: new Date(),
        },
        include: {
          warehouse: true,
          supplierProduct: true,
        },
      });

      // Insert audit movement record
      await tx.inventoryMovement.create({
        data: {
          warehouseInventoryId: inv.id,
          warehouseId: input.warehouseId,
          supplierProductId: input.supplierProductId,
          userId,
          changeQuantity: input.changeQuantity,
          previousBalance,
          newBalance: newQuantity,
          reason: input.reason,
          notes: input.notes?.trim(),
        },
      });

      // Recalculate total available across all warehouses for this supplier product
      const aggregate = await tx.warehouseInventory.aggregate({
        where: { supplierProductId: input.supplierProductId },
        _sum: { availableQuantity: true },
      });

      const totalAvailable = aggregate._sum.availableQuantity || 0;
      let newProductStatus = StockStatus.IN_STOCK;
      if (totalAvailable <= 0) {
        newProductStatus = StockStatus.OUT_OF_STOCK;
      } else if (totalAvailable <= updated.minStockThreshold) {
        newProductStatus = StockStatus.LOW_STOCK;
      }

      await tx.supplierProduct.update({
        where: { id: input.supplierProductId },
        data: {
          availableQuantity: totalAvailable,
          stockStatus: newProductStatus as any,
          lastStockUpdate: new Date(),
        },
      });

      return updated;
    });

    this.logger.info(
      `Stock adjusted: ${supplierProduct.supplierSku} at ${warehouse.name} (${input.changeQuantity > 0 ? "+" : ""}${input.changeQuantity})`,
      {
        businessId,
        warehouseId: input.warehouseId,
        productId: input.supplierProductId,
        newBalance: updatedInventory.quantity,
      },
    );

    await this.auditService.log({
      userId,
      businessId,
      action: "INVENTORY_STOCK_ADJUSTED",
      resource: `WarehouseInventory:${updatedInventory.id}`,
      payload: {
        warehouseCode: warehouse.code,
        sku: supplierProduct.supplierSku,
        changeQuantity: input.changeQuantity,
        newBalance: updatedInventory.quantity,
        reason: input.reason,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.mapInventoryDto(updatedInventory);
  }

  async getMovementHistory(
    businessId: string,
    supplierProductId: string,
    limit: number = 50,
  ): Promise<InventoryMovementDto[]> {
    // Verify product belongs to business
    const product = await prisma.supplierProduct.findFirst({
      where: { id: supplierProductId, businessId },
    });
    if (!product) {
      throw new NotFoundException(
        `Supplier product with ID '${supplierProductId}' not found for your business.`,
      );
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: { supplierProductId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        warehouse: true,
      },
    });

    return movements.map((m) => ({
      id: m.id,
      supplierProductId: m.supplierProductId,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouse?.name || null,
      userId: m.userId,
      changeQuantity: m.changeQuantity,
      previousBalance: m.previousBalance,
      newBalance: m.newBalance,
      reason: m.reason,
      notes: m.notes,
      referenceId: m.referenceId,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mapListingSummary(l: any): SupplierProductSummaryDto {
    return {
      id: l.id,
      businessId: l.businessId,
      masterProductId: l.masterProductId,
      supplierSku: l.supplierSku,
      sellingPrice: Number(l.sellingPrice),
      mrp: l.mrp ? Number(l.mrp) : null,
      costPrice: l.costPrice ? Number(l.costPrice) : null,
      availableQuantity: l.availableQuantity,
      reservedQuantity: l.reservedQuantity || 0,
      stockStatus: l.stockStatus,
      visibility: l.visibility,
      minimumOrderQuantity: l.minimumOrderQuantity,
      leadTimeDays: l.leadTimeDays,
      masterProduct: {
        id: l.masterProduct.id,
        name: l.masterProduct.name,
        partNumber: l.masterProduct.partNumber,
        normalizedPartNumber: l.masterProduct.normalizedPartNumber,
        brandName: l.masterProduct.brand.name,
        categoryName: l.masterProduct.category.name,
      },
      warehouseStockCount: l._count?.warehouseInventories || 0,
      lastStockUpdate: l.lastStockUpdate.toISOString(),
    };
  }

  private mapInventoryDto(inv: any): WarehouseInventoryDto {
    return {
      id: inv.id,
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      warehouseCode: inv.warehouse.code,
      supplierProductId: inv.supplierProductId,
      supplierSku: inv.supplierProduct.supplierSku,
      binLocation: inv.binLocation,
      quantity: inv.quantity,
      availableQuantity: inv.availableQuantity,
      reservedQuantity: inv.reservedQuantity,
      damagedQuantity: inv.damagedQuantity,
      minStockThreshold: inv.minStockThreshold,
      reorderLevel: inv.reorderLevel,
      reorderQuantity: inv.reorderQuantity,
      lastStockUpdate: inv.lastStockUpdate.toISOString(),
    };
  }
}
