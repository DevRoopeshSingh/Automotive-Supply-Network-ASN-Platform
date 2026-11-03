import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SupplierWarehouseService } from "./supplier-warehouse.service";
import { SupplierInventoryService } from "./supplier-inventory.service";
import { InventoryImportService } from "./inventory-import.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "../../common/audit/audit.service";
import { prisma } from "@asn/database";
import {
  UserRole,
  StockStatus,
  StockVisibility,
  ImportJobStatus,
} from "@asn/types";

describe("Supplier OS — Multi-Warehouse Inventory & Bulk Import Engine", () => {
  let warehouseService: SupplierWarehouseService;
  let inventoryService: SupplierInventoryService;
  let importService: InventoryImportService;
  let auditService: AuditService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const supplierBizA = "biz-supplier-aaa-111";
  const supplierBizB = "biz-supplier-bbb-222";
  const userManagerId = "usr-inventory-mgr-1";

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    vi.spyOn(auditService, "log").mockResolvedValue(undefined);

    warehouseService = new SupplierWarehouseService();
    inventoryService = new SupplierInventoryService(auditService);
    importService = new InventoryImportService(auditService);

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  // ===========================================================================
  // 1. Multi-Warehouse Management & Tenant Isolation
  // ===========================================================================
  describe("1. Multi-Warehouse Management & Tenant Isolation", () => {
    const sampleWarehouseInput = {
      name: "Mayapuri Central Depot",
      code: "WH-DEL-01",
      addressLine1: "Plot 42, Mayapuri Phase II",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110064",
      isPrimary: true,
    };

    it("should create a supplier warehouse with tenant-scoped code uniqueness", async () => {
      vi.spyOn(prisma.supplierWarehouse, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.supplierWarehouse, "updateMany").mockResolvedValue({
        count: 1,
      } as any);

      const mockCreated = {
        id: "wh-del-1",
        businessId: supplierBizA,
        ...sampleWarehouseInput,
        addressLine2: null,
        latitude: null,
        longitude: null,
        contactPhone: null,
        contactEmail: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(prisma.supplierWarehouse, "create").mockResolvedValue(
        mockCreated as any,
      );

      const result = await warehouseService.createWarehouse(
        supplierBizA,
        sampleWarehouseInput,
      );

      expect(result.id).toBe("wh-del-1");
      expect(result.code).toBe("WH-DEL-01");
      expect(result.isPrimary).toBe(true);
      expect(prisma.supplierWarehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: supplierBizA,
            code: "WH-DEL-01",
          }),
        }),
      );
    });

    it("should prevent duplicate warehouse codes under the same business", async () => {
      vi.spyOn(prisma.supplierWarehouse, "findUnique").mockResolvedValue({
        id: "wh-existing",
        code: "WH-DEL-01",
      } as any);

      await expect(
        warehouseService.createWarehouse(supplierBizA, sampleWarehouseInput),
      ).rejects.toThrow(ConflictException);
    });

    it("should enforce tenant isolation (Supplier B cannot access Supplier A's warehouse)", async () => {
      // Mock findFirst returning null because businessId does not match
      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue(null);

      await expect(
        warehouseService.getWarehouseById(supplierBizB, "wh-del-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // 2. Supplier Product Listings
  // ===========================================================================
  describe("2. Supplier Product Listings", () => {
    const mockMasterProduct = {
      id: "master-pad-100",
      partNumber: "0 986 AB1 234",
      normalizedPartNumber: "0986AB1234",
      name: "Bosch Front Ceramic Brake Pad Set",
      brand: { id: "b1", name: "Bosch" },
      category: { id: "c1", name: "Brake Pads" },
    };

    it("should create a supplier listing linked to MasterProduct and seed initial warehouse inventory", async () => {
      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue(
        mockMasterProduct as any,
      );
      vi.spyOn(prisma.supplierProduct, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue({
        id: "wh-del-1",
        businessId: supplierBizA,
        isActive: true,
      } as any);

      const mockListing = {
        id: "sup-prod-1",
        businessId: supplierBizA,
        masterProductId: mockMasterProduct.id,
        supplierSku: "BOSCH-PAD-CR-01",
        sellingPrice: 1850.0,
        mrp: 2200.0,
        availableQuantity: 20,
        reservedQuantity: 0,
        stockStatus: StockStatus.IN_STOCK,
        visibility: StockVisibility.PUBLIC,
        minimumOrderQuantity: 1,
        leadTimeDays: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastStockUpdate: new Date(),
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            supplierProduct: {
              create: vi.fn().mockResolvedValue(mockListing),
            },
            warehouseInventory: {
              create: vi.fn().mockResolvedValue({ id: "inv-1", quantity: 20 }),
            },
            inventoryMovement: {
              create: vi.fn().mockResolvedValue({ id: "mov-1" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(prisma.supplierProduct, "findFirst").mockResolvedValue({
        ...mockListing,
        masterProduct: mockMasterProduct,
        _count: { warehouseInventories: 1 },
      } as any);

      const result = await inventoryService.createListing(
        supplierBizA,
        userManagerId,
        {
          masterProductId: mockMasterProduct.id,
          supplierSku: "BOSCH-PAD-CR-01",
          sellingPrice: 1850.0,
          warehouseId: "wh-del-1",
          initialStock: 20,
        },
      );

      expect(result.id).toBe("sup-prod-1");
      expect(result.supplierSku).toBe("BOSCH-PAD-CR-01");
      expect(result.sellingPrice).toBe(1850.0);
      expect(result.availableQuantity).toBe(20);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUPPLIER_PRODUCT_LISTING_CREATED",
          businessId: supplierBizA,
        }),
      );
    });

    it("should reject duplicate supplier SKU for the same supplier business", async () => {
      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue(
        mockMasterProduct as any,
      );
      vi.spyOn(prisma.supplierProduct, "findUnique").mockResolvedValue({
        id: "sup-prod-existing",
        supplierSku: "BOSCH-PAD-CR-01",
      } as any);

      await expect(
        inventoryService.createListing(supplierBizA, userManagerId, {
          masterProductId: mockMasterProduct.id,
          supplierSku: "BOSCH-PAD-CR-01",
          sellingPrice: 1850.0,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // 3. Stock Adjustments & Negative Stock Prevention
  // ===========================================================================
  describe("3. Real-Time Stock Adjustments & Race Condition Guards", () => {
    const mockWarehouse = {
      id: "wh-del-1",
      businessId: supplierBizA,
      name: "Mayapuri Depot",
      code: "WH-DEL-01",
      isActive: true,
    };

    const mockSupplierProduct = {
      id: "sup-prod-1",
      businessId: supplierBizA,
      supplierSku: "BOSCH-PAD-CR-01",
      availableQuantity: 15,
      stockStatus: StockStatus.IN_STOCK,
    };

    it("should atomically increase stock and record auditable movement ledger", async () => {
      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue(
        mockWarehouse as any,
      );
      vi.spyOn(prisma.supplierProduct, "findFirst").mockResolvedValue(
        mockSupplierProduct as any,
      );

      const existingInventory = {
        id: "inv-1",
        warehouseId: mockWarehouse.id,
        supplierProductId: mockSupplierProduct.id,
        binLocation: "A-12-01",
        quantity: 15,
        availableQuantity: 15,
        reservedQuantity: 0,
        damagedQuantity: 0,
        minStockThreshold: 5,
        reorderLevel: 10,
        reorderQuantity: 20,
        lastStockUpdate: new Date(),
        warehouse: mockWarehouse,
        supplierProduct: mockSupplierProduct,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            warehouseInventory: {
              findUnique: vi.fn().mockResolvedValue(existingInventory),
              update: vi.fn().mockResolvedValue({
                ...existingInventory,
                quantity: 25,
                availableQuantity: 25,
              }),
              aggregate: vi
                .fn()
                .mockResolvedValue({ _sum: { availableQuantity: 25 } }),
            },
            inventoryMovement: {
              create: vi.fn().mockResolvedValue({ id: "mov-new" }),
            },
            supplierProduct: {
              update: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );

      const result = await inventoryService.adjustStock(
        supplierBizA,
        userManagerId,
        {
          warehouseId: mockWarehouse.id,
          supplierProductId: mockSupplierProduct.id,
          changeQuantity: 10, // Restock +10
          reason: "RESTOCK",
          notes: "Shipment received from manufacturer",
        },
      );

      expect(result.quantity).toBe(25);
      expect(result.availableQuantity).toBe(25);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "INVENTORY_STOCK_ADJUSTED",
          businessId: supplierBizA,
        }),
      );
    });

    it("should NEVER allow negative stock (strictly rejects excessive deduction)", async () => {
      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue(
        mockWarehouse as any,
      );
      vi.spyOn(prisma.supplierProduct, "findFirst").mockResolvedValue(
        mockSupplierProduct as any,
      );

      const existingInventory = {
        id: "inv-1",
        warehouseId: mockWarehouse.id,
        supplierProductId: mockSupplierProduct.id,
        quantity: 5,
        availableQuantity: 5,
        minStockThreshold: 5,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            warehouseInventory: {
              findUnique: vi.fn().mockResolvedValue(existingInventory),
            },
          };
          return callback(tx);
        },
      );

      // Attempting to deduct 10 units when only 5 exist
      await expect(
        inventoryService.adjustStock(supplierBizA, userManagerId, {
          warehouseId: mockWarehouse.id,
          supplierProductId: mockSupplierProduct.id,
          changeQuantity: -10,
          reason: "SALE",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 4. Bulk CSV Import Engine
  // ===========================================================================
  describe("4. Bulk CSV Import Engine", () => {
    const mockWarehouse = {
      id: "wh-del-1",
      businessId: supplierBizA,
      name: "Mayapuri Depot",
      code: "WH-DEL-01",
      isActive: true,
    };

    it("should parse CSV, detect in-file duplicates, flag catalog misses, and stage preview", async () => {
      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue(
        mockWarehouse as any,
      );
      vi.spyOn(prisma.brand, "findMany").mockResolvedValue([
        { id: "b-bosch", name: "Bosch" },
      ] as any);

      // Part 1 is in catalog, Part 2 is not
      vi.spyOn(prisma.masterProduct, "findFirst").mockImplementation((async (
        args: any,
      ) => {
        if (args?.where?.OR?.[0]?.normalizedPartNumber === "0986AB1234") {
          return { id: "m-prod-1", partNumber: "0 986 AB1 234" } as any;
        }
        return null;
      }) as any);

      const csvContent = `SKU,Part Number,Brand,Product Name,Quantity,Price
BOSCH-PAD-01,0 986 AB1 234,Bosch,Front Ceramic Brake Pads,50,1850.00
BOSCH-PAD-02,INVALID-PART-999,Bosch,Non-Existent Rotor,20,3200.00
BOSCH-PAD-01,0 986 AB1 234,Bosch,Duplicate Row,10,1850.00`;

      const mockJob = {
        id: "job-import-1",
        businessId: supplierBizA,
        warehouseId: mockWarehouse.id,
        fileName: "test.csv",
        fileType: "CSV",
        status: ImportJobStatus.PREVIEW_READY,
        totalRows: 3,
        validRows: 1, // Only row 1 is valid
        errorRows: 2, // Row 2 (missing from catalog), Row 3 (duplicate SKU)
        processedRows: 0,
        metadata: {},
        errorReport: [
          {
            row: 3,
            sku: "BOSCH-PAD-02",
            error:
              "Automotive part 'INVALID-PART-999' under brand 'Bosch' was not found",
          },
          {
            row: 4,
            sku: "BOSCH-PAD-01",
            error:
              "Duplicate SKU 'BOSCH-PAD-01' detected within this import file.",
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        warehouse: mockWarehouse,
      };

      vi.spyOn(prisma.inventoryImportJob, "create").mockResolvedValue(
        mockJob as any,
      );
      vi.spyOn(prisma.inventoryImportJob, "findFirst").mockResolvedValue(
        mockJob as any,
      );

      const preview = await importService.previewCsvImport(
        supplierBizA,
        userManagerId,
        {
          warehouseId: mockWarehouse.id,
          csvContent,
          fileName: "test.csv",
        },
      );

      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(1);
      expect(preview.errorRows).toBe(2);
      expect(preview.status).toBe(ImportJobStatus.PREVIEW_READY);
      expect(preview.errorReport.length).toBe(2);
    });

    it("should execute valid rows, update live inventory, and mark PARTIAL_SUCCESS if errors exist", async () => {
      const mockJob = {
        id: "job-import-1",
        businessId: supplierBizA,
        warehouseId: mockWarehouse.id,
        status: ImportJobStatus.PREVIEW_READY,
        fileName: "test.csv",
        fileType: "CSV",
        totalRows: 2,
        validRows: 1,
        errorRows: 1,
        processedRows: 0,
        metadata: {},
        errorReport: [{ row: 2, error: "Missing part" }],
        warehouse: mockWarehouse,
        rows: [
          {
            id: "row-1",
            rowNumber: 1,
            sku: "BOSCH-PAD-01",
            partNumber: "0 986 AB1 234",
            brandName: "Bosch",
            quantity: 50,
            price: 1850.0,
            status: "VALID",
          },
        ],
      };

      vi.spyOn(prisma.inventoryImportJob, "findFirst").mockResolvedValue(
        mockJob as any,
      );
      vi.spyOn(prisma.brand, "findMany").mockResolvedValue([
        { id: "b-bosch", name: "Bosch" },
      ] as any);
      vi.spyOn(prisma.inventoryImportJob, "update").mockResolvedValue({
        ...mockJob,
        status: ImportJobStatus.PARTIAL_SUCCESS,
        processedRows: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            masterProduct: {
              findFirst: vi.fn().mockResolvedValue({ id: "m-1" }),
            },
            supplierProduct: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({ id: "sup-1" }),
              update: vi.fn().mockResolvedValue({}),
            },
            warehouseInventory: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({ id: "inv-1" }),
              aggregate: vi
                .fn()
                .mockResolvedValue({ _sum: { availableQuantity: 50 } }),
            },
            inventoryMovement: {
              create: vi.fn().mockResolvedValue({}),
            },
            inventoryImportRow: {
              update: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );

      const result = await importService.executeImportJob(
        supplierBizA,
        userManagerId,
        mockJob.id,
      );

      expect(result.status).toBe(ImportJobStatus.PARTIAL_SUCCESS);
      expect(result.processedRows).toBe(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "INVENTORY_BULK_IMPORT_EXECUTED",
          businessId: supplierBizA,
        }),
      );
    });
  });

  // ===========================================================================
  // 5. Authorization & RBAC
  // ===========================================================================
  describe("5. Role-Based Access Control for Supplier OS", () => {
    function createMockContext(role: UserRole): ExecutionContext {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "usr-tester",
              role,
              isSuperAdmin: role === UserRole.PLATFORM_SUPER_ADMIN,
            },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it("should allow BUSINESS_OWNER, INVENTORY_MANAGER, and SUPPLIER_ADMIN", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.PLATFORM_SUPER_ADMIN,
        UserRole.BUSINESS_OWNER,
        UserRole.SUPPLIER_ADMIN,
        UserRole.INVENTORY_MANAGER,
      ]);

      const ownerCtx = createMockContext(UserRole.BUSINESS_OWNER);
      expect(rolesGuard.canActivate(ownerCtx)).toBe(true);

      const managerCtx = createMockContext(UserRole.INVENTORY_MANAGER);
      expect(rolesGuard.canActivate(managerCtx)).toBe(true);

      const supplierAdminCtx = createMockContext(UserRole.SUPPLIER_ADMIN);
      expect(rolesGuard.canActivate(supplierAdminCtx)).toBe(true);
    });

    it("should forbid BUSINESS_STAFF or DELIVERY_PARTNER from mutating inventory", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.PLATFORM_SUPER_ADMIN,
        UserRole.BUSINESS_OWNER,
        UserRole.SUPPLIER_ADMIN,
        UserRole.INVENTORY_MANAGER,
      ]);

      const staffCtx = createMockContext(UserRole.BUSINESS_STAFF);
      expect(() => rolesGuard.canActivate(staffCtx)).toThrow(
        ForbiddenException,
      );

      const deliveryCtx = createMockContext(UserRole.DELIVERY_PARTNER);
      expect(() => rolesGuard.canActivate(deliveryCtx)).toThrow(
        ForbiddenException,
      );
    });
  });
});
