import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RfqService } from "./rfq.service";
import { QuotationService } from "./quotation.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "../../common/audit/audit.service";
import { prisma, RfqStatus, QuotationStatus, Prisma } from "@asn/database";
import { UserRole, BusinessType } from "@asn/types";

describe("Supplier Supply Network (SSN) — Wholesale & B2B RFQ Engine", () => {
  let rfqService: RfqService;
  let quotationService: QuotationService;
  let auditService: AuditService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const buyerBizId = "biz-buyer-workshop-111";
  const supplierBizA = "biz-supplier-distributor-222";
  const supplierBizB = "biz-supplier-wholesaler-333";
  const rogueSupplierBiz = "biz-supplier-rogue-444";

  const buyerUserId = "usr-buyer-owner-1";
  const supplierUserA = "usr-trader-a-1";

  const masterProductId = "prod-brake-pad-uuid";

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    vi.spyOn(auditService, "log").mockResolvedValue(undefined);

    rfqService = new RfqService(auditService);
    quotationService = new QuotationService(auditService);

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  // ===========================================================================
  // 1. RFQ Creation, Validation & Lifecycle
  // ===========================================================================
  describe("1. RFQ Creation, Validation & Lifecycle", () => {
    const validRfqInput = {
      masterProductId,
      quantity: 50,
      targetPrice: 1200.0,
      deliveryAddress: "Shop 12, Opera House Auto Market",
      deliveryCity: "Mumbai",
      deliveryState: "Maharashtra",
      deliveryPostalCode: "400004",
      deliveryDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      notes: "Need OEM packaging only",
    };

    it("should create a sourcing RFQ in DRAFT status for a verified buyer business", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: buyerBizId,
        legalName: "Opera Auto Works Pvt Ltd",
        tradeName: "Opera Auto Works",
        verificationStatus: "VERIFIED",
        isActive: true,
      } as any);

      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        id: masterProductId,
        name: "Bosch Front Brake Pads",
        partNumber: "0 986 AB1 234",
        status: "ACTIVE",
        brand: { name: "Bosch" },
        category: { name: "Brake System" },
      } as any);

      const mockCreatedRfq = {
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId,
        createdById: buyerUserId,
        masterProductId,
        quantity: 50,
        targetPrice: new Prisma.Decimal(1200.0),
        deliveryAddress: validRfqInput.deliveryAddress,
        deliveryCity: "Mumbai",
        deliveryState: "Maharashtra",
        deliveryPostalCode: "400004",
        deliveryDeadline: new Date(validRfqInput.deliveryDeadline),
        expiresAt: new Date(validRfqInput.expiresAt),
        status: RfqStatus.DRAFT,
        notes: validRfqInput.notes,
        awardedQuotationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        buyerBusiness: {
          tradeName: "Opera Auto Works",
          legalName: "Opera Auto Works Pvt Ltd",
        },
        createdBy: { firstName: "Vikram", lastName: "Mehta" },
        masterProduct: {
          name: "Bosch Front Brake Pads",
          partNumber: "0 986 AB1 234",
          brand: { name: "Bosch" },
          category: { name: "Brake System" },
        },
        invitedSuppliers: [],
        awardedQuotation: null,
        _count: { quotations: 0 },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            sourcingRfq: {
              create: vi.fn().mockResolvedValue(mockCreatedRfq),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(rfqService, "getRfqDetail").mockResolvedValue({
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId,
        buyerBusinessName: "Opera Auto Works",
        masterProductId,
        productName: "Bosch Front Brake Pads",
        partNumber: "0 986 AB1 234",
        brandName: "Bosch",
        quantity: 50,
        targetPrice: 1200.0,
        deliveryCity: "Mumbai",
        deliveryState: "Maharashtra",
        deliveryDeadline: validRfqInput.deliveryDeadline,
        expiresAt: validRfqInput.expiresAt,
        status: RfqStatus.DRAFT as any,
        isExpired: false,
        quotationsCount: 0,
        awardedQuotationId: null,
        createdById: buyerUserId,
        deliveryAddress: validRfqInput.deliveryAddress,
        deliveryPostalCode: "400004",
        invitedSuppliers: [],
        awardedQuotation: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await rfqService.createRfq(
        buyerBizId,
        buyerUserId,
        validRfqInput,
      );

      expect(result.id).toBe("rfq-100");
      expect(result.status).toBe(RfqStatus.DRAFT);
      expect(result.quantity).toBe(50);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RFQ_CREATED",
          resource: "SourcingRfq:rfq-100",
        }),
      );
    });

    it("should reject RFQ creation if buyer business is not verified", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: buyerBizId,
        verificationStatus: "PENDING", // Not verified!
      } as any);

      await expect(
        rfqService.createRfq(buyerBizId, buyerUserId, validRfqInput),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject RFQ creation if master product is inactive or not found", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: buyerBizId,
        verificationStatus: "VERIFIED",
      } as any);

      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        id: masterProductId,
        status: "INACTIVE", // Inactive!
      } as any);

      await expect(
        rfqService.createRfq(buyerBizId, buyerUserId, validRfqInput),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject RFQ creation if expiry date is in past or delivery deadline < expiry", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: buyerBizId,
        verificationStatus: "VERIFIED",
      } as any);

      vi.spyOn(prisma.masterProduct, "findUnique").mockResolvedValue({
        id: masterProductId,
        status: "ACTIVE",
      } as any);

      const pastExpiryInput = {
        ...validRfqInput,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      await expect(
        rfqService.createRfq(buyerBizId, buyerUserId, pastExpiryInput),
      ).rejects.toThrow(BadRequestException);

      const invalidDeadlineInput = {
        ...validRfqInput,
        expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
        deliveryDeadline: new Date(Date.now() + 5 * 86400000).toISOString(), // Earlier than expiry!
      };

      await expect(
        rfqService.createRfq(buyerBizId, buyerUserId, invalidDeadlineInput),
      ).rejects.toThrow(BadRequestException);
    });

    it("should publish a draft RFQ and transition status to PUBLISHED", async () => {
      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.DRAFT,
        expiresAt: new Date(Date.now() + 5 * 86400000),
      } as any);

      vi.spyOn(prisma.sourcingRfq, "update").mockResolvedValue({
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        status: RfqStatus.PUBLISHED,
      } as any);

      vi.spyOn(rfqService, "getRfqDetail").mockResolvedValue({
        id: "rfq-100",
        status: RfqStatus.PUBLISHED as any,
      } as any);

      const result = await rfqService.publishRfq(
        buyerBizId,
        buyerUserId,
        "rfq-100",
      );
      expect(result.status).toBe(RfqStatus.PUBLISHED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RFQ_PUBLISHED",
          resource: "SourcingRfq:rfq-100",
        }),
      );
    });

    it("should cancel an unawarded RFQ and transition status to CANCELLED", async () => {
      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.PUBLISHED,
      } as any);

      vi.spyOn(prisma.sourcingRfq, "update").mockResolvedValue({
        id: "rfq-100",
        status: RfqStatus.CANCELLED,
      } as any);

      vi.spyOn(rfqService, "getRfqDetail").mockResolvedValue({
        id: "rfq-100",
        status: RfqStatus.CANCELLED as any,
      } as any);

      const result = await rfqService.cancelRfq(
        buyerBizId,
        buyerUserId,
        "rfq-100",
        "No longer required",
      );
      expect(result.status).toBe(RfqStatus.CANCELLED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RFQ_CANCELLED",
          resource: "SourcingRfq:rfq-100",
        }),
      );
    });

    it("should prevent cancellation of an already awarded RFQ", async () => {
      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.AWARDED,
      } as any);

      await expect(
        rfqService.cancelRfq(buyerBizId, buyerUserId, "rfq-100"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 2. Supplier Quotations, Confidentiality & Revisions
  // ===========================================================================
  describe("2. Supplier Quotations, Confidentiality & Revisions", () => {
    const validQuoteInput = {
      rfqId: "rfq-100",
      unitPrice: 1100.0,
      availableQuantity: 100,
      minimumOrderQuantity: 10,
      leadTimeDays: 2,
      validityUntil: new Date(Date.now() + 5 * 86400000).toISOString(),
      terms: "Net 15 days via bank transfer",
      notes: "Ex-warehouse Delhi depot",
    };

    it("should submit a quotation for an open RFQ by a verified distributor", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: supplierBizA,
        tradeName: "Super Spares Distributors",
        verificationStatus: "VERIFIED",
        businessType: BusinessType.DISTRIBUTOR,
        isActive: true,
      } as any);

      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId, // Different from supplier!
        status: RfqStatus.PUBLISHED,
        quantity: 50,
        expiresAt: new Date(Date.now() + 3 * 86400000),
        invitedSuppliers: [],
      } as any);

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue(null);

      const mockCreatedQuote = {
        id: "qt-100",
        quoteNumber: "QT-2026-55443",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        submittedById: supplierUserA,
        unitPrice: new Prisma.Decimal(1100.0),
        totalAmount: new Prisma.Decimal(55000.0), // 1100 * 50
        availableQuantity: 100,
        minimumOrderQuantity: 10,
        leadTimeDays: 2,
        validityUntil: new Date(validQuoteInput.validityUntil),
        status: QuotationStatus.SUBMITTED,
        revision: 1,
        terms: validQuoteInput.terms,
        notes: validQuoteInput.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplierBusiness: {
          tradeName: "Super Spares Distributors",
          legalName: "Super Spares LLP",
        },
        revisions: [],
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            sourcingQuotation: {
              create: vi.fn().mockResolvedValue(mockCreatedQuote),
            },
            sourcingRfq: {
              update: vi.fn().mockResolvedValue({
                id: "rfq-100",
                status: RfqStatus.RESPONSES_RECEIVED,
              }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(quotationService, "getQuotationById").mockResolvedValue({
        id: "qt-100",
        quoteNumber: "QT-2026-55443",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        supplierBusinessName: "Super Spares Distributors",
        submittedById: supplierUserA,
        unitPrice: 1100.0,
        totalAmount: 55000.0,
        availableQuantity: 100,
        minimumOrderQuantity: 10,
        leadTimeDays: 2,
        validityUntil: validQuoteInput.validityUntil,
        status: QuotationStatus.SUBMITTED as any,
        revision: 1,
        isExpired: false,
        revisions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await quotationService.submitQuotation(
        supplierBizA,
        supplierUserA,
        validQuoteInput,
      );

      expect(result.id).toBe("qt-100");
      expect(result.status).toBe(QuotationStatus.SUBMITTED);
      expect(result.totalAmount).toBe(55000.0);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "QUOTATION_SUBMITTED",
          resource: "SourcingQuotation:qt-100",
        }),
      );
    });

    it("should reject quotation submission if supplier tries to bid on their own RFQ", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: buyerBizId,
        verificationStatus: "VERIFIED",
        businessType: BusinessType.DISTRIBUTOR,
      } as any);

      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        buyerBusinessId: buyerBizId, // Same business!
        status: RfqStatus.PUBLISHED,
        expiresAt: new Date(Date.now() + 86400000),
        invitedSuppliers: [],
      } as any);

      await expect(
        quotationService.submitQuotation(
          buyerBizId,
          buyerUserId,
          validQuoteInput,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject quotation submission if RFQ is closed, awarded, or expired", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: supplierBizA,
        verificationStatus: "VERIFIED",
        businessType: BusinessType.DISTRIBUTOR,
      } as any);

      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.AWARDED, // Already awarded!
        expiresAt: new Date(Date.now() + 86400000),
        invitedSuppliers: [],
      } as any);

      await expect(
        quotationService.submitQuotation(
          supplierBizA,
          supplierUserA,
          validQuoteInput,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should prevent duplicate quote from same supplier and enforce revision workflow", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: supplierBizA,
        verificationStatus: "VERIFIED",
        businessType: BusinessType.DISTRIBUTOR,
      } as any);

      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.PUBLISHED,
        expiresAt: new Date(Date.now() + 86400000),
        invitedSuppliers: [],
      } as any);

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue({
        id: "existing-quote-1",
      } as any);

      await expect(
        quotationService.submitQuotation(
          supplierBizA,
          supplierUserA,
          validQuoteInput,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should revise an existing quotation, archiving prior version in QuotationRevision and incrementing revision counter", async () => {
      const existingQuote = {
        id: "qt-100",
        quoteNumber: "QT-2026-55443",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        unitPrice: new Prisma.Decimal(1100.0),
        totalAmount: new Prisma.Decimal(55000.0),
        availableQuantity: 100,
        minimumOrderQuantity: 10,
        leadTimeDays: 2,
        validityUntil: new Date(Date.now() + 86400000),
        status: QuotationStatus.SUBMITTED,
        revision: 1,
        terms: "Net 15",
        notes: "Ex-Delhi",
        rfq: {
          id: "rfq-100",
          quantity: 50,
          status: RfqStatus.RESPONSES_RECEIVED,
          expiresAt: new Date(Date.now() + 3 * 86400000),
        },
        supplierBusiness: { tradeName: "Super Spares Distributors" },
      };

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue(
        existingQuote as any,
      );

      const revisionInput = {
        unitPrice: 1050.0, // Reduced price
        availableQuantity: 100,
        minimumOrderQuantity: 10,
        leadTimeDays: 1, // Faster delivery
        validityUntil: new Date(Date.now() + 4 * 86400000).toISOString(),
        notes: "Revised competitive wholesale price",
      };

      const mockRevisionRecord = {
        id: "rev-1",
        quotationId: "qt-100",
        revisionNumber: 1,
        unitPrice: new Prisma.Decimal(1100.0),
        totalAmount: new Prisma.Decimal(55000.0),
        leadTimeDays: 2,
        createdAt: new Date(),
      };

      const mockUpdatedQuote = {
        ...existingQuote,
        unitPrice: new Prisma.Decimal(1050.0),
        totalAmount: new Prisma.Decimal(52500.0),
        leadTimeDays: 1,
        revision: 2,
        status: QuotationStatus.REVISED,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            quotationRevision: {
              create: vi.fn().mockResolvedValue(mockRevisionRecord),
            },
            sourcingQuotation: {
              update: vi.fn().mockResolvedValue(mockUpdatedQuote),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(quotationService, "getQuotationById").mockResolvedValue({
        id: "qt-100",
        quoteNumber: "QT-2026-55443",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        supplierBusinessName: "Super Spares Distributors",
        submittedById: supplierUserA,
        unitPrice: 1050.0,
        totalAmount: 52500.0,
        availableQuantity: 100,
        minimumOrderQuantity: 10,
        leadTimeDays: 1,
        validityUntil: revisionInput.validityUntil,
        status: QuotationStatus.REVISED as any,
        revision: 2,
        isExpired: false,
        revisions: [
          {
            id: "rev-1",
            quotationId: "qt-100",
            revisionNumber: 1,
            unitPrice: 1100.0,
            totalAmount: 55000.0,
            availableQuantity: 100,
            minimumOrderQuantity: 10,
            leadTimeDays: 2,
            validityUntil: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await quotationService.reviseQuotation(
        supplierBizA,
        supplierUserA,
        "qt-100",
        revisionInput,
      );

      expect(result.revision).toBe(2);
      expect(result.unitPrice).toBe(1050.0);
      expect(result.revisions).toHaveLength(1);
      expect(result.revisions[0]?.unitPrice).toBe(1100.0);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "QUOTATION_REVISED",
          resource: "SourcingQuotation:qt-100",
        }),
      );
    });

    it("should enforce strict quotation confidentiality: competing supplier cannot view another supplier's quote", async () => {
      // Quotation belongs to supplierBizA and RFQ was created by buyerBizId
      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue({
        id: "qt-100",
        quoteNumber: "QT-100",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        submittedById: supplierUserA,
        unitPrice: new Prisma.Decimal(1100.0),
        totalAmount: new Prisma.Decimal(55000.0),
        availableQuantity: 50,
        minimumOrderQuantity: 1,
        leadTimeDays: 2,
        validityUntil: new Date(Date.now() + 86400000),
        status: QuotationStatus.SUBMITTED,
        revision: 1,
        terms: "Net 15",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rfq: { buyerBusinessId: buyerBizId },
        supplierBusiness: {
          tradeName: "Super Spares",
          legalName: "Super Spares LLP",
        },
        revisions: [],
      } as any);

      // Rogue competing supplier attempts to view quotation
      await expect(
        quotationService.getQuotationById(rogueSupplierBiz, "qt-100"),
      ).rejects.toThrow(ForbiddenException);

      // But RFQ buyer CAN view quotation
      const buyerResult = await quotationService.getQuotationById(
        buyerBizId,
        "qt-100",
      );
      expect(buyerResult.id).toBe("qt-100");

      // And submitting supplier CAN view quotation
      const supplierResult = await quotationService.getQuotationById(
        supplierBizA,
        "qt-100",
      );
      expect(supplierResult.id).toBe("qt-100");
    });

    it("should allow RFQ buyer to view all quotations for comparison, while supplier only sees their own", async () => {
      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
      } as any);

      const mockQuotes = [
        {
          id: "qt-1",
          quoteNumber: "QT-01",
          rfqId: "rfq-100",
          supplierBusinessId: supplierBizA,
          supplierBusiness: { tradeName: "Super Spares" },
          unitPrice: new Prisma.Decimal(1050.0),
          totalAmount: new Prisma.Decimal(52500.0),
          availableQuantity: 50,
          minimumOrderQuantity: 1,
          leadTimeDays: 2,
          validityUntil: new Date(Date.now() + 86400000),
          status: QuotationStatus.SUBMITTED,
          revision: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "qt-2",
          quoteNumber: "QT-02",
          rfqId: "rfq-100",
          supplierBusinessId: supplierBizB,
          supplierBusiness: { tradeName: "Metro Auto Components" },
          unitPrice: new Prisma.Decimal(1080.0),
          totalAmount: new Prisma.Decimal(54000.0),
          availableQuantity: 50,
          minimumOrderQuantity: 1,
          leadTimeDays: 1,
          validityUntil: new Date(Date.now() + 86400000),
          status: QuotationStatus.SUBMITTED,
          revision: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // If buyer queries, finds all quotes
      vi.spyOn(prisma.sourcingQuotation, "findMany").mockImplementation((async (
        args: any,
      ) => {
        if (!args.where.supplierBusinessId) {
          return mockQuotes as any;
        }
        return mockQuotes.filter(
          (q) => q.supplierBusinessId === args.where.supplierBusinessId,
        ) as any;
      }) as any);

      const buyerView = await quotationService.listQuotationsForRfq(
        buyerBizId,
        "rfq-100",
      );
      expect(buyerView).toHaveLength(2);

      // If supplierBizA queries, finds only supplierBizA's quote
      const supplierView = await quotationService.listQuotationsForRfq(
        supplierBizA,
        "rfq-100",
      );
      expect(supplierView).toHaveLength(1);
      expect(supplierView[0]?.supplierBusinessId).toBe(supplierBizA);
    });
  });

  // ===========================================================================
  // 3. Atomic RFQ Award & Concurrency Protection
  // ===========================================================================
  describe("3. Atomic RFQ Award & Concurrency Protection", () => {
    it("should atomically award RFQ: accept winning quotation, reject competing quotes, and mark RFQ as AWARDED", async () => {
      const mockRfq = {
        id: "rfq-100",
        rfqNumber: "RFQ-2026-10001",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.RESPONSES_RECEIVED,
        awardedQuotationId: null,
      };

      const mockWinningQuote = {
        id: "qt-1",
        quoteNumber: "QT-2026-0001",
        rfqId: "rfq-100",
        supplierBusinessId: supplierBizA,
        unitPrice: new Prisma.Decimal(1050.0),
        totalAmount: new Prisma.Decimal(52500.0),
        validityUntil: new Date(Date.now() + 3 * 86400000),
        status: QuotationStatus.SUBMITTED,
        supplierBusiness: { tradeName: "Super Spares" },
      };

      let winningQuoteUpdated = false;
      let rejectedOthersCount = 0;
      let rfqAwarded = false;

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            sourcingRfq: {
              findUnique: vi.fn().mockResolvedValue(mockRfq),
              update: vi.fn().mockImplementation((args: any) => {
                if (args.data.status === RfqStatus.AWARDED) {
                  rfqAwarded = true;
                }
                return {
                  ...mockRfq,
                  status: RfqStatus.AWARDED,
                  awardedQuotationId: "qt-1",
                };
              }),
            },
            sourcingQuotation: {
              findUnique: vi.fn().mockResolvedValue(mockWinningQuote),
              update: vi.fn().mockImplementation((args: any) => {
                if (args.data.status === QuotationStatus.ACCEPTED) {
                  winningQuoteUpdated = true;
                }
                return {
                  ...mockWinningQuote,
                  status: QuotationStatus.ACCEPTED,
                };
              }),
              updateMany: vi.fn().mockImplementation((args: any) => {
                if (args.data.status === QuotationStatus.REJECTED) {
                  rejectedOthersCount = 1;
                }
                return { count: 1 };
              }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(rfqService, "getRfqDetail").mockResolvedValue({
        id: "rfq-100",
        status: RfqStatus.AWARDED as any,
        awardedQuotationId: "qt-1",
      } as any);

      const result = await rfqService.awardRfq(
        buyerBizId,
        buyerUserId,
        "rfq-100",
        "qt-1",
      );

      expect(winningQuoteUpdated).toBe(true);
      expect(rejectedOthersCount).toBe(1);
      expect(rfqAwarded).toBe(true);
      expect(result.status).toBe(RfqStatus.AWARDED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RFQ_AWARDED",
          resource: "SourcingRfq:rfq-100",
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "QUOTATION_ACCEPTED",
          resource: "SourcingQuotation:qt-1",
        }),
      );
    });

    it("should prevent duplicate awards if RFQ is already awarded (conflict protection)", async () => {
      const alreadyAwardedRfq = {
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.AWARDED,
        awardedQuotationId: "qt-1",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            sourcingRfq: {
              findUnique: vi.fn().mockResolvedValue(alreadyAwardedRfq),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        rfqService.awardRfq(buyerBizId, buyerUserId, "rfq-100", "qt-2"),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject award if selected quotation has expired", async () => {
      const openRfq = {
        id: "rfq-100",
        buyerBusinessId: buyerBizId,
        status: RfqStatus.RESPONSES_RECEIVED,
        awardedQuotationId: null,
      };

      const expiredQuote = {
        id: "qt-1",
        rfqId: "rfq-100",
        validityUntil: new Date(Date.now() - 3600000), // Expired 1 hr ago!
        status: QuotationStatus.SUBMITTED,
        supplierBusiness: { tradeName: "Super Spares" },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            sourcingRfq: {
              findUnique: vi.fn().mockResolvedValue(openRfq),
            },
            sourcingQuotation: {
              findUnique: vi.fn().mockResolvedValue(expiredQuote),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        rfqService.awardRfq(buyerBizId, buyerUserId, "rfq-100", "qt-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 4. Sourcing Discovery & Comparison Analytics
  // ===========================================================================
  describe("4. Sourcing Discovery & Comparison Analytics", () => {
    it("should discover eligible verified suppliers with product inventory for an RFQ", async () => {
      const mockSuppliers = [
        {
          id: supplierBizA,
          legalName: "Super Spares Pvt Ltd",
          tradeName: "Super Spares",
          businessType: BusinessType.DISTRIBUTOR,
          verificationStatus: "VERIFIED",
          addresses: [{ city: "Delhi", state: "Delhi" }],
          supplierProducts: [
            {
              warehouseInventories: [
                { availableQuantity: 40 },
                { availableQuantity: 60 },
              ],
            },
          ],
        },
      ];

      vi.spyOn(prisma.business, "findMany").mockResolvedValue(
        mockSuppliers as any,
      );

      const result = await rfqService.discoverEligibleSuppliers(
        buyerBizId,
        masterProductId,
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.hasListingForProduct).toBe(true);
      expect(result[0]?.availableStock).toBe(100);
      expect(result[0]?.city).toBe("Delhi");
    });

    it("should generate quotation comparison matrix with lowest price, fastest delivery, and delta vs target price", async () => {
      vi.spyOn(rfqService, "getRfqDetail").mockResolvedValue({
        id: "rfq-100",
        targetPrice: 1200.0,
      } as any);

      vi.spyOn(prisma.sourcingQuotation, "findMany").mockResolvedValue([
        {
          id: "qt-1",
          quoteNumber: "QT-01",
          supplierBusinessId: supplierBizA,
          supplierBusiness: { tradeName: "Super Spares" },
          unitPrice: new Prisma.Decimal(1100.0), // -8.33% vs 1200
          totalAmount: new Prisma.Decimal(55000.0),
          availableQuantity: 50,
          minimumOrderQuantity: 1,
          leadTimeDays: 3,
          validityUntil: new Date(),
          status: QuotationStatus.SUBMITTED,
          revision: 1,
        },
        {
          id: "qt-2",
          quoteNumber: "QT-02",
          supplierBusinessId: supplierBizB,
          supplierBusiness: { tradeName: "Metro Auto" },
          unitPrice: new Prisma.Decimal(1150.0),
          totalAmount: new Prisma.Decimal(57500.0),
          availableQuantity: 50,
          minimumOrderQuantity: 1,
          leadTimeDays: 1, // Fastest!
          validityUntil: new Date(),
          status: QuotationStatus.SUBMITTED,
          revision: 1,
        },
      ] as any);

      const comparison = await rfqService.compareQuotations(
        buyerBizId,
        "rfq-100",
      );
      expect(comparison.lowestUnitPrice).toBe(1100.0);
      expect(comparison.fastestLeadTimeDays).toBe(1);
      expect(comparison.quotations).toHaveLength(2);

      const quote1 = comparison.quotations.find(
        (q) => q.quotationId === "qt-1",
      );
      const quote2 = comparison.quotations.find(
        (q) => q.quotationId === "qt-2",
      );

      expect(quote1?.isBestPrice).toBe(true);
      expect(quote1?.isFastestDelivery).toBe(false);
      expect(quote1?.priceDeltaVsTargetPercent).toBe(-8.33);

      expect(quote2?.isBestPrice).toBe(false);
      expect(quote2?.isFastestDelivery).toBe(true);
    });
  });

  // ===========================================================================
  // 5. Multi-Tenant RBAC & Role Verification
  // ===========================================================================
  describe("5. Multi-Tenant RBAC & Role Verification", () => {
    function createMockContext(role: UserRole): ExecutionContext {
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role },
            business: { id: buyerBizId, currentUserRole: role },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it("should allow WHOLESALE_TRADER, SUPPLIER_ADMIN, and BUSINESS_OWNER roles through RolesGuard", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.BUSINESS_OWNER,
        UserRole.SUPPLIER_ADMIN,
        UserRole.WHOLESALE_TRADER,
      ]);

      expect(
        rolesGuard.canActivate(createMockContext(UserRole.WHOLESALE_TRADER)),
      ).toBe(true);
      expect(
        rolesGuard.canActivate(createMockContext(UserRole.SUPPLIER_ADMIN)),
      ).toBe(true);
      expect(
        rolesGuard.canActivate(createMockContext(UserRole.BUSINESS_OWNER)),
      ).toBe(true);
    });

    it("should reject unauthorized roles (e.g. DELIVERY_PARTNER) through RolesGuard", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.BUSINESS_OWNER,
        UserRole.SUPPLIER_ADMIN,
        UserRole.WHOLESALE_TRADER,
      ]);

      expect(() =>
        rolesGuard.canActivate(createMockContext(UserRole.DELIVERY_PARTNER)),
      ).toThrow(ForbiddenException);
    });
  });
});
