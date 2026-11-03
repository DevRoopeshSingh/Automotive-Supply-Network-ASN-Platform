import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CatalogService } from "./catalog.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "../../common/audit/audit.service";
import { prisma } from "@asn/database";
import { UserRole, VehicleSegment } from "@asn/types";

describe("Automotive Product Catalog & Vehicle Fitment Engine", () => {
  let catalogService: CatalogService;
  let auditService: AuditService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    vi.spyOn(auditService, "log").mockResolvedValue(undefined);
    catalogService = new CatalogService(auditService);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  // ===========================================================================
  // 1. Product Master Creation, Normalization & Retrieval
  // ===========================================================================
  describe("1. Product Master Creation & Retrieval", () => {
    const mockBrand = {
      id: "brand-bosch-uuid",
      name: "Bosch",
      code: "BOSCH",
      isOem: false,
      isActive: true,
    };

    const mockCategory = {
      id: "cat-brake-pads-uuid",
      name: "Brake Pads",
      slug: "brake-pads",
      isActive: true,
    };

    const sampleProductInput = {
      partNumber: "0 986 AB1 234",
      brandId: mockBrand.id,
      categoryId: mockCategory.id,
      name: "Bosch Front Ceramic Brake Pad Set",
      oemNumber: "58101-1RA00",
      conditionType: "AFTERMARKET" as const,
      status: "ACTIVE" as const,
      isSafetyCritical: true,
      unitOfMeasure: "SET",
      specifications: { axle: "Front", material: "Ceramic" },
    };

    it("should create product master with normalized part numbers and auto-generate OEM reference", async () => {
      vi.spyOn(prisma.brand, "findUnique").mockResolvedValue(mockBrand as any);
      vi.spyOn(prisma.productCategory, "findUnique").mockResolvedValue(
        mockCategory as any,
      );
      vi.spyOn(prisma.masterProduct, "findFirst").mockResolvedValue(null);

      const createdProduct = {
        id: "prod-100",
        ...sampleProductInput,
        normalizedPartNumber: "0986AB1234",
        normalizedOemNumber: "581011RA00",
        createdAt: new Date(),
        updatedAt: new Date(),
        brand: mockBrand,
        category: mockCategory,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            masterProduct: {
              create: vi.fn().mockResolvedValue(createdProduct),
            },
            oEMPartReference: {
              create: vi.fn().mockResolvedValue({ id: "oem-1" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        ...createdProduct,
        media: [],
        oemReferences: [
          {
            id: "oem-1",
            oemNumber: "58101-1RA00",
            normalizedOemNumber: "581011RA00",
            vehicleMakeId: null,
            vehicleMake: null,
            notes: "Primary OEM reference",
          },
        ],
        fitments: [],
      } as any);

      const result = await catalogService.createProduct(
        "user-admin-1",
        sampleProductInput,
      );

      expect(result.id).toBe("prod-100");
      expect(result.partNumber).toBe("0 986 AB1 234");
      expect(result.normalizedPartNumber).toBe("0986AB1234");
      expect(result.oemNumber).toBe("58101-1RA00");
      expect(result.normalizedOemNumber).toBe("581011RA00");
      expect(result.oemReferences.length).toBe(1);
      expect(result.brand.name).toBe("Bosch");
      expect(result.isSafetyCritical).toBe(true);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CATALOG_PRODUCT_CREATED",
          userId: "user-admin-1",
        }),
      );
    });

    it("should reject creating product when duplicate part number exists for the same brand", async () => {
      vi.spyOn(prisma.brand, "findUnique").mockResolvedValue(mockBrand as any);
      vi.spyOn(prisma.productCategory, "findUnique").mockResolvedValue(
        mockCategory as any,
      );
      vi.spyOn(prisma.masterProduct, "findFirst").mockResolvedValue({
        id: "prod-existing",
        partNumber: "0 986 AB1 234",
        brandId: mockBrand.id,
      } as any);

      await expect(
        catalogService.createProduct("user-admin-1", sampleProductInput),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // 2. Product Category Hierarchy
  // ===========================================================================
  describe("2. Product Category Hierarchy", () => {
    it("should construct a hierarchical parent-child category tree", async () => {
      const mockCategories = [
        {
          id: "cat-root-braking",
          name: "Brake System",
          slug: "brake-system",
          parentId: null,
          isActive: true,
          displayOrder: 1,
        },
        {
          id: "cat-child-pads",
          name: "Brake Pads",
          slug: "brake-pads",
          parentId: "cat-root-braking",
          isActive: true,
          displayOrder: 1,
        },
        {
          id: "cat-child-rotors",
          name: "Brake Discs & Rotors",
          slug: "brake-discs-rotors",
          parentId: "cat-root-braking",
          isActive: true,
          displayOrder: 2,
        },
        {
          id: "cat-root-filtration",
          name: "Filtration",
          slug: "filtration",
          parentId: null,
          isActive: true,
          displayOrder: 2,
        },
      ];

      vi.spyOn(prisma.productCategory, "findMany").mockResolvedValue(
        mockCategories as any,
      );

      const tree = await catalogService.getCategoryTree();

      expect(tree.length).toBe(2); // Two root categories: Braking & Filtration
      expect(tree[0]?.slug).toBe("brake-system");
      expect(tree[0]?.children?.length).toBe(2);
      expect(tree[0]?.children?.[0]?.slug).toBe("brake-pads");
      expect(tree[0]?.children?.[1]?.slug).toBe("brake-discs-rotors");
      expect(tree[1]?.slug).toBe("filtration");
      expect(tree[1]?.children?.length).toBe(0);
    });

    it("should prevent duplicate category slug creation", async () => {
      vi.spyOn(prisma.productCategory, "findUnique").mockResolvedValue({
        id: "cat-existing",
        slug: "brake-pads",
      } as any);

      await expect(
        catalogService.createCategory({
          name: "Brake Pads",
          slug: "brake-pads",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // 3. Vehicle Fitment & Compatibility Engine
  // ===========================================================================
  describe("3. Vehicle Compatibility Engine", () => {
    const mockMake = {
      id: "make-hyundai-uuid",
      name: "Hyundai",
      segment: VehicleSegment.CAR,
    };

    const mockModel = {
      id: "model-creta-uuid",
      makeId: mockMake.id,
      name: "Creta",
      make: mockMake,
    };

    const mockVariant = {
      id: "var-creta-diesel-uuid",
      modelId: mockModel.id,
      variantName: "1.5L CRDi Diesel SX",
      startYear: 2020,
      endYear: null, // Still in production
      fuelType: "DIESEL",
      engine: "1.5L CRDi",
      engineCapacity: 1493,
      transmission: "MANUAL",
      isActive: true,
      model: mockModel,
    };

    it("should return verified compatible parts when vehicle variant and manufacturing year match", async () => {
      vi.spyOn(prisma.vehicleVariant, "findUnique").mockResolvedValue(
        mockVariant as any,
      );

      const mockFitments = [
        {
          id: "fit-1",
          masterProductId: "prod-brake-pads-1",
          vehicleVariantId: mockVariant.id,
          position: "Front Axle",
          fitmentStartYear: 2020,
          fitmentEndYear: null,
          isVerified: true,
          masterProduct: {
            id: "prod-brake-pads-1",
            partNumber: "0 986 AB1 234",
            normalizedPartNumber: "0986AB1234",
            oemNumber: "58101-1RA00",
            normalizedOemNumber: "581011RA00",
            name: "Bosch Front Ceramic Brake Pad Set",
            conditionType: "AFTERMARKET",
            status: "ACTIVE",
            isSafetyCritical: true,
            unitOfMeasure: "SET",
            brand: { id: "b1", name: "Bosch", isOem: false },
            category: { id: "c1", name: "Brake Pads", slug: "brake-pads" },
            media: [
              { url: "https://assets.asn.internal/pad.jpg", isPrimary: true },
            ],
          },
        },
      ];

      vi.spyOn(prisma.productFitment, "findMany").mockResolvedValue(
        mockFitments as any,
      );

      const result = await catalogService.getCompatibleProducts(
        mockVariant.id,
        2021, // Queried year
      );

      expect(result.compatibleProductsCount).toBe(1);
      expect(result.products[0]?.partNumber).toBe("0 986 AB1 234");
      expect(result.products[0]?.brand.name).toBe("Bosch");
      expect(result.vehicleVariant.variantName).toBe("1.5L CRDi Diesel SX");
      expect(result.queryYear).toBe(2021);
    });

    it("should exclude products when queried year is outside vehicle variant manufacturing span", async () => {
      vi.spyOn(prisma.vehicleVariant, "findUnique").mockResolvedValue(
        mockVariant as any,
      );

      // Querying 2017 for Creta Diesel produced starting 2020
      const result = await catalogService.getCompatibleProducts(
        mockVariant.id,
        2017,
      );

      expect(result.compatibleProductsCount).toBe(0);
      expect(result.products.length).toBe(0);
      expect(result.queryYear).toBe(2017);
    });

    it("should reject adding fitment when fitment start year precedes vehicle variant start year", async () => {
      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        id: "prod-1",
      } as any);
      vi.spyOn(prisma.vehicleVariant, "findUnique").mockResolvedValue(
        mockVariant as any, // startYear: 2020
      );
      vi.spyOn(prisma.productFitment, "findUnique").mockResolvedValue(null);

      // Trying to attach fitment starting in 2018 for a car variant introduced in 2020
      await expect(
        catalogService.addFitment("prod-1", {
          vehicleVariantId: mockVariant.id,
          fitmentStartYear: 2018,
          fitmentEndYear: 2022,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject duplicate fitment mapping on the same product and variant", async () => {
      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        id: "prod-1",
      } as any);
      vi.spyOn(prisma.vehicleVariant, "findUnique").mockResolvedValue(
        mockVariant as any,
      );
      vi.spyOn(prisma.productFitment, "findUnique").mockResolvedValue({
        id: "fit-already-exists",
      } as any);

      await expect(
        catalogService.addFitment("prod-1", {
          vehicleVariantId: mockVariant.id,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // 4. Product Search & Pagination
  // ===========================================================================
  describe("4. Product Search & Pagination", () => {
    it("should normalize search keywords and search across SKU, OEM and Brand", async () => {
      const mockProduct = {
        id: "prod-1",
        partNumber: "0 986 AB1 234",
        normalizedPartNumber: "0986AB1234",
        oemNumber: "58101-1RA00",
        normalizedOemNumber: "581011RA00",
        name: "Bosch Premium Front Brake Pad Set",
        conditionType: "AFTERMARKET",
        status: "ACTIVE",
        isSafetyCritical: true,
        unitOfMeasure: "SET",
        brand: { id: "b1", name: "Bosch", isOem: false },
        category: { id: "c1", name: "Brake Pads", slug: "brake-pads" },
        media: [],
      };

      vi.spyOn(prisma.masterProduct, "findMany").mockResolvedValue([
        mockProduct,
      ] as any);
      vi.spyOn(prisma.masterProduct, "count").mockResolvedValue(1);

      // User searches with raw dashes and spaces: "0986-AB1 234"
      const result = await catalogService.listProducts({
        q: "0986-AB1 234",
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items[0]?.normalizedPartNumber).toBe("0986AB1234");

      // Verify that prisma.findMany was called with normalized search conditions
      expect(prisma.masterProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { normalizedPartNumber: { contains: "0986AB1234" } },
            ]),
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // 5. Authorization for Product Management
  // ===========================================================================
  describe("5. Role-Based Access Control for Catalog Management", () => {
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

    it("should allow PLATFORM_SUPER_ADMIN, BUSINESS_OWNER, and CATALOG_SPECIALIST to manage products", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.PLATFORM_SUPER_ADMIN,
        UserRole.BUSINESS_OWNER,
        UserRole.CATALOG_SPECIALIST,
      ]);

      const superAdminCtx = createMockContext(UserRole.PLATFORM_SUPER_ADMIN);
      expect(rolesGuard.canActivate(superAdminCtx)).toBe(true);

      const ownerCtx = createMockContext(UserRole.BUSINESS_OWNER);
      expect(rolesGuard.canActivate(ownerCtx)).toBe(true);

      const catalogSpecialistCtx = createMockContext(
        UserRole.CATALOG_SPECIALIST,
      );
      expect(rolesGuard.canActivate(catalogSpecialistCtx)).toBe(true);
    });

    it("should forbid BUSINESS_STAFF or DELIVERY_PARTNER from mutating product catalog", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.PLATFORM_SUPER_ADMIN,
        UserRole.BUSINESS_OWNER,
        UserRole.CATALOG_SPECIALIST,
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
