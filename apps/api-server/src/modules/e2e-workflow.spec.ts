import { describe, it, expect, beforeEach, vi } from "vitest";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { ShipmentStatus, LegType, LegStatus } from "@asn/types";
import { ShipmentService } from "./logistics/shipment.service";
import { RfqService } from "./ssn/rfq.service";
import { QuotationService } from "./ssn/quotation.service";
import { SupplierInventoryService } from "./supplier/supplier-inventory.service";
import { CatalogService } from "./catalog/catalog.service";
import { AuthService } from "./auth/auth.service";
import { OtpService } from "./auth/otp/otp.service";
import { SessionService } from "./auth/session/session.service";

const { mockPrisma } = vi.hoisted(() => {
  const mp: any = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    businessMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    otpRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    masterProduct: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    vehicleMake: { findUnique: vi.fn() },
    productCategory: { findUnique: vi.fn() },
    supplierWarehouse: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplierProduct: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    warehouseInventory: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    inventoryImportJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sourcingRfq: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    sourcingQuotation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    quotationRevision: {
      create: vi.fn(),
    },
    logisticsProvider: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    shipment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    shipmentLeg: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    shipmentItem: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    shipmentTrackingEvent: {
      create: vi.fn(),
    },
    proofOfDelivery: {
      create: vi.fn(),
    },
  };
  mp.$transaction = vi.fn((fn: any) =>
    typeof fn === "function" ? fn(mp) : Promise.all(fn),
  );
  return { mockPrisma: mp };
});

vi.mock("@asn/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@asn/database")>();
  return {
    ...actual,
    prisma: mockPrisma,
  };
});

describe("ASN Platform — End-to-End Cross-Tenant Integration Workflow", () => {
  let mockRedis: any;
  let mockAudit: any;
  let mockOtpProvider: any;

  // Services
  let authService: AuthService;
  let otpService: OtpService;
  let sessionService: SessionService;
  let catalogService: CatalogService;
  let inventoryService: SupplierInventoryService;
  let rfqService: RfqService;
  let quotationService: QuotationService;
  let shipmentService: ShipmentService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
    };

    mockAudit = {
      logAction: vi.fn().mockResolvedValue({ id: "audit-1" }),
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockOtpProvider = {
      sendOtp: vi.fn().mockResolvedValue(true),
      getLatestOtpForTesting: vi.fn().mockReturnValue("123456"),
    };

    // Instantiate Services
    const jwtService = new JwtService({
      secret: "test-secret-at-least-32-chars-long",
    });
    otpService = new OtpService(mockOtpProvider, mockRedis);
    sessionService = new SessionService(jwtService, mockRedis);
    authService = new AuthService(otpService, sessionService, mockAudit);
    catalogService = new CatalogService(mockAudit);
    inventoryService = new SupplierInventoryService(mockAudit);
    quotationService = new QuotationService(mockAudit);
    rfqService = new RfqService(mockAudit);
    shipmentService = new ShipmentService(mockAudit);
  });

  it("1. should execute complete cross-tenant journey: Auth -> Catalog -> Inventory -> RFQ -> Competing Quotes -> Revision -> Atomic Award -> Multi-Leg Shipment -> Proof of Delivery", async () => {
    // -------------------------------------------------------------------------
    // Phase A: Buyer & Supplier Authentication
    // -------------------------------------------------------------------------
    const buyerPhone = "9876543210";
    const otpRequestRes = await authService.requestOtp(buyerPhone);
    expect(otpRequestRes.success).toBe(true);

    // Mock OTP verification in DB
    mockPrisma.otpRecord.findFirst.mockResolvedValue({
      id: "otp-rec-1",
      phone: buyerPhone,
      otpHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      expiresAt: new Date(Date.now() + 300000),
      attempts: 0,
      isUsed: false,
    });
    mockPrisma.otpRecord.update.mockResolvedValue({ id: "otp-rec-1" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "usr-buyer-1",
      phone: buyerPhone,
      isSuperAdmin: false,
      isActive: true,
      memberships: [],
    });
    mockPrisma.refreshSession.create.mockResolvedValue({ id: "sess-1" });

    // Verify OTP using dev default OTP (123456)
    const verifyRes = await authService.verifyOtp(buyerPhone, "123456");
    expect(verifyRes.tokens.accessToken).toBeDefined();
    expect(verifyRes.user.phone).toBe(buyerPhone);

    // -------------------------------------------------------------------------
    // Phase B: Catalog Definition & Vehicle Fitment Lookup
    // -------------------------------------------------------------------------
    const sampleProduct = {
      id: "prod-bosch-bp1",
      name: "Bosch Front Ceramic Brake Pad Set",
      partNumber: "0986AB1234",
      normalizedPartNumber: "0986AB1234",
      oemNumber: "58101-1RA00",
      normalizedOemNumber: "581011RA00",
      conditionType: "OES",
      brandId: "brand-bosch-1",
      brand: { id: "brand-bosch-1", name: "Bosch", isOem: true },
      category: {
        id: "cat-brakes-1",
        name: "Brake System",
        slug: "brake-system",
      },
      status: "ACTIVE",
      isSafetyCritical: true,
      unitOfMeasure: "SET",
      media: [],
      oemReferences: [],
      fitments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.masterProduct.findUnique.mockResolvedValue(sampleProduct);
    const catalogItem = await catalogService.getProductById(sampleProduct.id);
    expect(catalogItem.partNumber).toBe("0986AB1234");
    expect(catalogItem.status).toBe("ACTIVE");

    // -------------------------------------------------------------------------
    // Phase C: Supplier OS Warehouse & Real-Time Stock Control
    // -------------------------------------------------------------------------
    const supplierBizId = "biz-supplier-superspares-1";
    const buyerBizId = "biz-buyer-apex-1";
    const supplier2BizId = "biz-supplier-national-2";

    const sampleWarehouse = {
      id: "wh-del-1",
      businessId: supplierBizId,
      code: "WH-DEL-01",
      name: "SuperSpares North Hub",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110064",
      isActive: true,
    };
    const mockSupplierProduct = {
      id: "supp-prod-1",
      businessId: supplierBizId,
      supplierSku: "0986AB1234",
      availableQuantity: 100,
      stockStatus: "IN_STOCK",
    };
    mockPrisma.supplierWarehouse.findFirst.mockResolvedValue(sampleWarehouse);
    mockPrisma.supplierProduct.findFirst.mockResolvedValue(mockSupplierProduct);

    // Adjust Stock (+50 units receipt)
    const currentInventory = {
      id: "inv-bp1",
      warehouseId: sampleWarehouse.id,
      supplierProductId: mockSupplierProduct.id,
      quantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
      damagedQuantity: 0,
      minStockThreshold: 10,
      reorderLevel: 20,
      reorderQuantity: 50,
      binLocation: "A-01",
      lastStockUpdate: new Date(),
      warehouse: sampleWarehouse,
      supplierProduct: mockSupplierProduct,
    };
    mockPrisma.warehouseInventory.findUnique.mockResolvedValue(
      currentInventory,
    );
    mockPrisma.warehouseInventory.update.mockResolvedValue({
      ...currentInventory,
      quantity: 150,
      availableQuantity: 150,
      lastStockUpdate: new Date(),
    });
    mockPrisma.warehouseInventory.aggregate.mockResolvedValue({
      _sum: { availableQuantity: 150 },
    });
    mockPrisma.inventoryMovement.create.mockResolvedValue({ id: "mov-1" });
    mockPrisma.supplierProduct.update.mockResolvedValue({
      id: mockSupplierProduct.id,
      availableQuantity: 150,
      stockStatus: "IN_STOCK",
    });

    const stockAdjustment = await inventoryService.adjustStock(
      supplierBizId,
      "usr-supplier-1",
      {
        warehouseId: sampleWarehouse.id,
        supplierProductId: mockSupplierProduct.id,
        changeQuantity: 50,
        reason: "RESTOCK",
        notes: "Arrival of Bosch shipment",
      },
    );
    expect(stockAdjustment.quantity).toBe(150);
    expect(stockAdjustment.availableQuantity).toBe(150);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalled();

    // -------------------------------------------------------------------------
    // Phase D: Wholesale RFQ Creation (Buyer)
    // -------------------------------------------------------------------------
    const buyerBusinessMock = {
      id: buyerBizId,
      legalName: "Apex Multi-Brand Workshop Pvt Ltd",
      tradeName: "Apex Multi-Brand Workshop",
      verificationStatus: "VERIFIED",
      businessType: "WORKSHOP",
      isActive: true,
    };
    const supplier1BusinessMock = {
      id: supplierBizId,
      legalName: "SuperSpares Distribution LLP",
      tradeName: "SuperSpares Distribution",
      verificationStatus: "VERIFIED",
      businessType: "DISTRIBUTOR",
      isActive: true,
    };
    const supplier2BusinessMock = {
      id: supplier2BizId,
      legalName: "National Parts Wholesalers Pvt Ltd",
      tradeName: "National Parts Wholesalers",
      verificationStatus: "VERIFIED",
      businessType: "WHOLESALER",
      isActive: true,
    };

    mockPrisma.business.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === buyerBizId) return Promise.resolve(buyerBusinessMock);
      if (where.id === supplierBizId)
        return Promise.resolve(supplier1BusinessMock);
      if (where.id === supplier2BizId)
        return Promise.resolve(supplier2BusinessMock);
      return Promise.resolve(null);
    });

    const openRfq: any = {
      id: "rfq-test-100",
      rfqNumber: "RFQ-2026-0001",
      buyerBusinessId: buyerBizId,
      createdById: "usr-buyer-1",
      masterProductId: sampleProduct.id,
      quantity: 50,
      targetPrice: 1100.0,
      status: "PUBLISHED",
      awardedQuotationId: null,
      deliveryDeadline: new Date(Date.now() + 7 * 86400000),
      expiresAt: new Date(Date.now() + 5 * 86400000),
      deliveryAddress: "Shop 4-6, Phase 2, Okhla",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      notes: "Urgent requirements",
      createdAt: new Date(),
      updatedAt: new Date(),
      buyerBusiness: buyerBusinessMock,
      createdBy: { firstName: "Rajesh", lastName: "Sharma" },
      masterProduct: sampleProduct,
      invitedSuppliers: [],
      awardedQuotation: null,
      _count: { quotations: 0 },
    };
    mockPrisma.masterProduct.findUnique.mockResolvedValue(sampleProduct);
    mockPrisma.sourcingRfq.create.mockResolvedValue(openRfq);
    mockPrisma.sourcingRfq.findUnique.mockResolvedValue(openRfq);

    const createdRfq = await rfqService.createRfq(buyerBizId, "usr-buyer-1", {
      masterProductId: sampleProduct.id,
      quantity: 50,
      targetPrice: 1100,
      deliveryAddress: "Shop 4-6, Phase 2, Okhla",
      deliveryCity: "New Delhi",
      deliveryState: "Delhi",
      deliveryPostalCode: "110020",
      deliveryDeadline: openRfq.deliveryDeadline.toISOString(),
      expiresAt: openRfq.expiresAt.toISOString(),
    });
    expect(createdRfq.rfqNumber).toBe("RFQ-2026-0001");

    // -------------------------------------------------------------------------
    // Phase E: Competing B2B Quotations & Revision Snapshots (Suppliers)
    // -------------------------------------------------------------------------
    // Quote 1 from SuperSpares (₹1,050)
    const quote1: any = {
      id: "qt-1",
      quoteNumber: "QT-2026-0001",
      rfqId: openRfq.id,
      supplierBusinessId: supplierBizId,
      submittedById: "usr-supplier-1",
      unitPrice: 1050.0,
      totalAmount: 52500.0,
      availableQuantity: 150,
      minimumOrderQuantity: 5,
      leadTimeDays: 1,
      validityUntil: new Date(Date.now() + 5 * 86400000),
      status: "SUBMITTED",
      revision: 1,
      terms: "Immediate dispatch",
      notes: "Stock ready at North Hub",
      createdAt: new Date(),
      updatedAt: new Date(),
      supplierBusiness: supplier1BusinessMock,
      revisions: [],
      rfq: openRfq,
    };

    let currentQuote1 = quote1;
    mockPrisma.sourcingQuotation.findUnique.mockImplementation(
      ({ where }: any) => {
        if (where.rfqId_supplierBusinessId) return Promise.resolve(null);
        if (where.id === quote1.id) return Promise.resolve(currentQuote1);
        return Promise.resolve(null);
      },
    );
    mockPrisma.sourcingQuotation.create.mockResolvedValue(quote1);

    const submittedQuote1 = await quotationService.submitQuotation(
      supplierBizId,
      "usr-supplier-1",
      {
        rfqId: openRfq.id,
        unitPrice: 1050.0,
        availableQuantity: 150,
        minimumOrderQuantity: 5,
        leadTimeDays: 1,
        validityUntil: quote1.validityUntil.toISOString(),
      },
    );
    expect(submittedQuote1.quoteNumber).toBe("QT-2026-0001");

    // Supplier 1 revises quote to ₹1,020 (Revision snapshot creation)
    const revisedQuote1: any = {
      ...quote1,
      unitPrice: 1020.0,
      totalAmount: 51000.0,
      revision: 2,
      status: "REVISED",
      revisions: [
        {
          id: "rev-1",
          quotationId: quote1.id,
          revisionNumber: 1,
          unitPrice: 1050.0,
          totalAmount: 52500.0,
          availableQuantity: 150,
          minimumOrderQuantity: 5,
          leadTimeDays: 1,
          validityUntil: quote1.validityUntil,
          notes: "Initial quote",
          createdAt: new Date(),
        },
      ],
    };
    mockPrisma.sourcingQuotation.update.mockImplementation((args: any) => {
      currentQuote1 = {
        ...currentQuote1,
        ...args.data,
      };
      return Promise.resolve(currentQuote1);
    });

    const revisedQuote1Res = await quotationService.reviseQuotation(
      supplierBizId,
      "usr-supplier-1",
      quote1.id,
      {
        unitPrice: 1020.0,
        availableQuantity: 150,
        minimumOrderQuantity: 5,
        leadTimeDays: 1,
        validityUntil: quote1.validityUntil.toISOString(),
        notes: "Discounted wholesale rate",
      },
    );
    expect(revisedQuote1Res.revision).toBe(2);
    expect(revisedQuote1Res.unitPrice).toBe(1020.0);
    expect(mockPrisma.quotationRevision.create).toHaveBeenCalled();

    // Confidentiality Guard: Competing Supplier 2 cannot view Supplier 1's quotation
    await expect(
      quotationService.getQuotationById(supplier2BizId, quote1.id),
    ).rejects.toThrow(ForbiddenException);

    // -------------------------------------------------------------------------
    // Phase F: Quotation Comparison Matrix & Atomic Award (Buyer)
    // -------------------------------------------------------------------------
    const quote2: any = {
      id: "qt-2",
      quoteNumber: "QT-2026-0002",
      rfqId: openRfq.id,
      supplierBusinessId: supplier2BizId,
      submittedById: "usr-supplier-2",
      unitPrice: 1080.0,
      totalAmount: 54000.0,
      availableQuantity: 80,
      minimumOrderQuantity: 10,
      leadTimeDays: 2,
      validityUntil: new Date(Date.now() + 5 * 86400000),
      status: "SUBMITTED",
      revision: 1,
      terms: "Net 30",
      notes: "Dispatch from Mumbai",
      createdAt: new Date(),
      updatedAt: new Date(),
      supplierBusiness: supplier2BusinessMock,
      revisions: [],
      rfq: openRfq,
    };

    let rfqState: any = openRfq;
    mockPrisma.sourcingRfq.findUnique.mockImplementation(() =>
      Promise.resolve(rfqState),
    );
    mockPrisma.sourcingRfq.update.mockImplementation((args: any) => {
      rfqState = {
        ...openRfq,
        ...args.data,
        awardedQuotation: revisedQuote1,
      };
      return Promise.resolve(rfqState);
    });
    mockPrisma.sourcingQuotation.findMany.mockResolvedValue([
      revisedQuote1,
      quote2,
    ]);

    const comparison = await rfqService.compareQuotations(
      buyerBizId,
      openRfq.id,
    );
    expect(comparison.quotations).toHaveLength(2);
    expect(comparison.quotations[0]?.isBestPrice).toBe(true);
    expect(comparison.quotations[0]?.isFastestDelivery).toBe(true);

    const awardResult = await rfqService.awardRfq(
      buyerBizId,
      "usr-buyer-1",
      openRfq.id,
      quote1.id,
    );
    expect(awardResult.status).toBe("AWARDED");
    expect(awardResult.awardedQuotationId).toBe(quote1.id);

    // Concurrency Guard: Duplicate award attempt must throw ConflictException
    await expect(
      rfqService.awardRfq(buyerBizId, "usr-buyer-1", openRfq.id, quote1.id),
    ).rejects.toThrow(ConflictException);

    // -------------------------------------------------------------------------
    // Phase G: Multi-Leg Freight Shipment & State Progression
    // -------------------------------------------------------------------------
    const activeShipment: any = {
      id: "shp-100",
      shipmentNumber: "SHP-2026-00001",
      senderBusinessId: supplierBizId,
      receiverBusinessId: buyerBizId,
      sourcingRfqId: openRfq.id,
      sourcingQuotationId: quote1.id,
      status: ShipmentStatus.CREATED,
      deliveryAttemptCount: 0,
      senderBusiness: supplier1BusinessMock,
      receiverBusiness: buyerBusinessMock,
      pickupWarehouse: sampleWarehouse,
      legs: [
        {
          id: "leg-1",
          shipmentId: "shp-100",
          legSequence: 1,
          legType: LegType.FIRST_MILE_PICKUP,
          status: LegStatus.PENDING,
          originFacilityName: "North Hub",
          originAddress: "Warehouse 1",
          originCity: "New Delhi",
          originState: "Delhi",
          originPostalCode: "110064",
          destinationFacilityName: "Sorting Center",
          destinationAddress: "Hub 2",
          destinationCity: "New Delhi",
          destinationState: "Delhi",
          destinationPostalCode: "110075",
          assignedProviderId: null,
          assignedProvider: null,
          trackingNumber: null,
          plannedDepartureAt: null,
          actualDepartureAt: null,
          plannedArrivalAt: null,
          actualArrivalAt: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "leg-2",
          shipmentId: "shp-100",
          legSequence: 2,
          legType: LegType.LAST_MILE_DELIVERY,
          status: LegStatus.PENDING,
          originFacilityName: "Sorting Center",
          originAddress: "Hub 2",
          originCity: "New Delhi",
          originState: "Delhi",
          originPostalCode: "110075",
          destinationFacilityName: "Workshop",
          destinationAddress: "Shop 4-6",
          destinationCity: "New Delhi",
          destinationState: "Delhi",
          destinationPostalCode: "110020",
          assignedProviderId: "prov-delhivery-1",
          assignedProvider: { name: "Delhivery Surface Express" },
          trackingNumber: "DLV88776655",
          plannedDepartureAt: null,
          actualDepartureAt: null,
          plannedArrivalAt: null,
          actualArrivalAt: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      items: [
        {
          id: "item-1",
          shipmentId: "shp-100",
          masterProductId: sampleProduct.id,
          quantity: 50,
          unitPrice: 1020.0,
          totalPrice: 51000.0,
          sku: "0986AB1234",
          notes: null,
          createdAt: new Date(),
          masterProduct: sampleProduct,
        },
      ],
      trackingEvents: [],
      proofOfDelivery: null,
      _count: { items: 1, legs: 2 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.masterProduct.findMany.mockResolvedValue([
      { id: sampleProduct.id },
    ]);
    mockPrisma.shipmentLeg.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.shipmentItem.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.shipmentTrackingEvent.create.mockResolvedValue({ id: "evt-1" });
    mockPrisma.shipment.create.mockResolvedValue(activeShipment);
    mockPrisma.shipment.findUnique.mockResolvedValue(activeShipment);

    // Create Shipment
    const createdShipment = await shipmentService.createShipment(
      supplierBizId,
      "usr-supplier-1",
      {
        receiverBusinessId: buyerBizId,
        sourcingRfqId: openRfq.id,
        sourcingQuotationId: quote1.id,
        pickupAddress: sampleWarehouse.postalCode,
        pickupCity: sampleWarehouse.city,
        pickupState: sampleWarehouse.state,
        pickupPostalCode: sampleWarehouse.postalCode,
        deliveryAddress: "Shop 4-6, Phase 2, Okhla",
        deliveryCity: "New Delhi",
        deliveryState: "Delhi",
        deliveryPostalCode: "110020",
        items: [{ masterProductId: sampleProduct.id, quantity: 50 }],
        legs: [
          {
            legSequence: 1,
            legType: LegType.FIRST_MILE_PICKUP,
            originAddress: "Warehouse 1",
            originCity: "New Delhi",
            originState: "Delhi",
            originPostalCode: "110064",
            destinationAddress: "Hub 2",
            destinationCity: "New Delhi",
            destinationState: "Delhi",
            destinationPostalCode: "110075",
          },
          {
            legSequence: 2,
            legType: LegType.LAST_MILE_DELIVERY,
            originAddress: "Hub 2",
            originCity: "New Delhi",
            originState: "Delhi",
            originPostalCode: "110075",
            destinationAddress: "Shop 4-6",
            destinationCity: "New Delhi",
            destinationState: "Delhi",
            destinationPostalCode: "110020",
          },
        ],
      },
    );
    expect(createdShipment.shipmentNumber).toBe("SHP-2026-00001");

    // Lifecycle progression: CREATED -> PICKUP_SCHEDULED
    const scheduledShipment = {
      ...activeShipment,
      status: ShipmentStatus.PICKUP_SCHEDULED,
    };
    mockPrisma.shipment.findUnique.mockResolvedValueOnce(activeShipment);
    mockPrisma.shipment.update.mockResolvedValue(scheduledShipment);
    mockPrisma.shipment.findUnique.mockResolvedValue(scheduledShipment);

    const statusProgression = await shipmentService.transitionStatus(
      supplierBizId,
      "usr-supplier-1",
      "SENDER",
      activeShipment.id,
      {
        status: ShipmentStatus.PICKUP_SCHEDULED,
        notes: "Pickup scheduled with rider",
      },
    );
    expect(statusProgression.status).toBe(ShipmentStatus.PICKUP_SCHEDULED);

    // Direct transition to DELIVERED without POD must be rejected
    await expect(
      shipmentService.transitionStatus(
        supplierBizId,
        "usr-supplier-1",
        "SENDER",
        activeShipment.id,
        { status: ShipmentStatus.DELIVERED },
      ),
    ).rejects.toThrow(BadRequestException);

    // -------------------------------------------------------------------------
    // Phase H: Atomic Proof of Delivery (POD) Verification
    // -------------------------------------------------------------------------
    const deliveredShipment = {
      ...activeShipment,
      status: ShipmentStatus.DELIVERED,
      proofOfDelivery: {
        id: "pod-1",
        shipmentId: activeShipment.id,
        recipientName: "Sanjay Verma",
        recipientPhone: "9876543210",
        deliveryTimestamp: new Date(),
        documentUrl: "https://assets.asn.internal/pod-signed.jpg",
        verificationCode: "847291",
        confirmedByUserId: "usr-supplier-1",
        notes: "Received in good condition",
        createdAt: new Date(),
      },
    };
    mockPrisma.shipment.findUnique.mockResolvedValueOnce({
      ...activeShipment,
      status: ShipmentStatus.OUT_FOR_DELIVERY,
      proofOfDelivery: null,
    });
    mockPrisma.proofOfDelivery.create.mockResolvedValue(
      deliveredShipment.proofOfDelivery,
    );
    mockPrisma.shipment.update.mockResolvedValue(deliveredShipment);
    mockPrisma.shipment.findUnique.mockResolvedValue(deliveredShipment);

    const podResult = await shipmentService.submitProofOfDelivery(
      supplierBizId,
      "usr-supplier-1",
      activeShipment.id,
      {
        recipientName: "Sanjay Verma",
        recipientPhone: "9876543210",
        verificationCode: "847291",
        documentUrl: "https://assets.asn.internal/pod-signed.jpg",
        notes: "Received in good condition",
      },
    );

    expect(podResult.status).toBe(ShipmentStatus.DELIVERED);
    expect(podResult.proofOfDelivery?.recipientName).toBe("Sanjay Verma");
    expect(mockPrisma.shipmentLeg.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shipmentId: activeShipment.id }),
        data: expect.objectContaining({ status: LegStatus.COMPLETED }),
      }),
    );

    // Post-delivery cancellation guard
    await expect(
      shipmentService.cancelShipment(
        supplierBizId,
        "usr-supplier-1",
        activeShipment.id,
        "Cancel requested",
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
