import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ExecutionContext,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { BackendEnvSchema } from "@asn/validators";
import { OtpService } from "./auth/otp/otp.service";
import { MockOtpProvider } from "./auth/otp/mock-otp.provider";
import { SessionService } from "./auth/session/session.service";
import { TenantContextGuard } from "../common/guards/tenant-context.guard";
import { RfqService } from "./ssn/rfq.service";
import { QuotationService } from "./ssn/quotation.service";
import { ShipmentService } from "./logistics/shipment.service";
import { SupplierInventoryService } from "./supplier/supplier-inventory.service";
import { AuditService } from "../common/audit/audit.service";
import { RedisService } from "../common/redis/redis.service";
import { envConfig } from "../common/config/env.config";
import { prisma, RfqStatus, QuotationStatus } from "@asn/database";
import {
  UserRole,
  BusinessType,
  ShipmentStatus,
  LegType,
  LegStatus,
  ShipmentEventType,
} from "@asn/types";

describe("ASN Platform — Pre-Phase 4 Security & Business Integrity Audit Suite", () => {
  let auditService: AuditService;
  let redisService: RedisService;
  let jwtService: JwtService;
  let otpService: OtpService;
  let sessionService: SessionService;
  let tenantGuard: TenantContextGuard;
  let rfqService: RfqService;
  let quotationService: QuotationService;
  let shipmentService: ShipmentService;
  let inventoryService: SupplierInventoryService;

  const buyerBizId = "biz-buyer-apex-001";
  const supplier1BizId = "biz-supplier-super-002";
  const competingSupplierBizId = "biz-supplier-competitor-003";
  const thirdPartyBizId = "biz-rogue-attacker-004";

  const buyerUserId = "usr-buyer-001";
  const supplier1UserId = "usr-supplier-002";
  const competitorUserId = "usr-competitor-003";

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    vi.spyOn(auditService, "log").mockResolvedValue(undefined);

    redisService = new RedisService();
    jwtService = new JwtService({
      secret: "test-super-secret-jwt-key-minimum-32-chars-long",
    });
    otpService = new OtpService(new MockOtpProvider(), redisService);
    sessionService = new SessionService(jwtService, redisService);
    tenantGuard = new TenantContextGuard();
    rfqService = new RfqService(auditService);
    quotationService = new QuotationService(auditService);
    shipmentService = new ShipmentService(auditService);
    inventoryService = new SupplierInventoryService(auditService);

    // Default transaction passthrough for unit tests without live postgres
    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (callback: any) => {
        if (typeof callback === "function") {
          const tx = Object.create(prisma);
          tx.$queryRaw = vi.fn().mockResolvedValue([]);
          return callback(tx);
        }
        return callback;
      },
    );
  });

  // ===========================================================================
  // SECTION 1: Authentication, OTP Lifecycle & Production Safety
  // ===========================================================================
  describe("1. Authentication, OTP Lifecycle & Production Safety", () => {
    it("VEC-AUTH-01: BackendEnvSchema must strictly reject ALLOW_DEV_OTP='true' in production", () => {
      const invalidProdConfig = {
        NODE_ENV: "production",
        PORT: 4000,
        DATABASE_URL: "postgresql://asn:asn_pass@localhost:5432/asn_prod",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "strong_production_jwt_secret_with_adequate_entropy_123",
        JWT_REFRESH_SECRET:
          "strong_production_jwt_refresh_secret_with_adequate_entropy_456",
        ALLOW_DEV_OTP: "true",
      };

      const result = BackendEnvSchema.safeParse(invalidProdConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const devOtpIssue = result.error.issues.find((issue) =>
          issue.path.includes("ALLOW_DEV_OTP"),
        );
        expect(devOtpIssue).toBeDefined();
        expect(devOtpIssue?.message).toContain(
          "CRITICAL SECURITY CONFIGURATION ERROR",
        );
      }
    });

    it("VEC-AUTH-02: BackendEnvSchema must reject insecure default JWT secrets in production", () => {
      const insecureProdConfig = {
        NODE_ENV: "production",
        PORT: 4000,
        DATABASE_URL: "postgresql://asn:asn_pass@localhost:5432/asn_prod",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "asn_super_secret_jwt_key_with_at_least_32_characters_long",
        JWT_REFRESH_SECRET:
          "asn_super_secret_refresh_jwt_key_with_at_least_32_chars",
        ALLOW_DEV_OTP: "false",
      };

      const result = BackendEnvSchema.safeParse(insecureProdConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const secretIssue = result.error.issues.find(
          (issue) =>
            issue.path.includes("JWT_SECRET") ||
            issue.path.includes("JWT_REFRESH_SECRET"),
        );
        expect(secretIssue).toBeDefined();
      }
    });

    it("VEC-AUTH-03: OtpService must reject dev OTP 123456 when ALLOW_DEV_OTP is false", async () => {
      const originalFlag = envConfig.ALLOW_DEV_OTP;
      try {
        (envConfig as any).ALLOW_DEV_OTP = "false";
        vi.spyOn(prisma.otpRecord, "findFirst").mockResolvedValue(null);

        await expect(
          otpService.verifyOtp("9876543210", "123456"),
        ).rejects.toThrow(BadRequestException);
      } finally {
        (envConfig as any).ALLOW_DEV_OTP = originalFlag;
      }
    });

    it("VEC-AUTH-04: SessionService must detect token reuse replay and revoke ENTIRE session family", async () => {
      const userId = "usr-hacked-999";
      const familyId = "fam-breached-999";

      const compromisedRefreshToken = jwtService.sign(
        { sub: userId, sessionId: "sess-already-used", familyId },
        { secret: envConfig.JWT_REFRESH_SECRET, expiresIn: "7d" },
      );

      // Mock finding a session that is already revoked (simulating replay attack)
      vi.spyOn(prisma.refreshSession, "findUnique").mockResolvedValue({
        id: "sess-already-used",
        userId,
        tokenHash: (sessionService as any).hashToken(compromisedRefreshToken),
        familyId,
        isRevoked: true, // Already consumed!
        expiresAt: new Date(Date.now() + 500000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userAgent: null,
        ipAddress: null,
      } as any);

      const revokeManySpy = vi
        .spyOn(prisma.refreshSession, "updateMany")
        .mockResolvedValue({ count: 4 });

      await expect(
        sessionService.rotateSession(compromisedRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      // Verify that all sessions in the breached family were revoked
      expect(revokeManySpy).toHaveBeenCalledWith({
        where: { familyId },
        data: { isRevoked: true },
      });
    });
  });

  // ===========================================================================
  // SECTION 2: Multi-Tenant Isolation & Authorization Boundaries
  // ===========================================================================
  describe("2. Multi-Tenant Isolation & Authorization Boundaries", () => {
    it("VEC-TENANT-01: TenantContextGuard must block access to tenants where user is not an active member", async () => {
      vi.spyOn(prisma.businessMember, "findUnique").mockResolvedValue(null);

      const unauthorizedContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: competitorUserId,
              isSuperAdmin: false,
              businesses: [
                {
                  businessId: competingSupplierBizId,
                  role: UserRole.BUSINESS_OWNER,
                  business: {
                    id: competingSupplierBizId,
                    legalName: "Competitor Parts Ltd",
                    tradeName: "Competitor Spares",
                    businessType: BusinessType.DISTRIBUTOR,
                  },
                },
              ],
            },
            headers: {
              "x-business-id": buyerBizId, // Attempting to spoof Buyer Biz tenant
            },
            params: {},
            baseUrl: "/api/v1/rfqs",
            url: "/api/v1/rfqs",
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(
        tenantGuard.canActivate(unauthorizedContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-TENANT-02: TenantContextGuard must NOT treat resource :id as businessId on non-business routes", async () => {
      vi.spyOn(prisma.businessMember, "findUnique").mockResolvedValue({
        id: "bm-1",
        businessId: buyerBizId,
        userId: buyerUserId,
        role: UserRole.BUSINESS_OWNER,
        business: {
          id: buyerBizId,
          legalName: "Apex Auto Care",
          tradeName: "Apex Auto",
          businessType: BusinessType.WORKSHOP,
          verificationStatus: "VERIFIED",
          isActive: true,
        },
      } as any);

      const requestObj: any = {
        user: {
          id: buyerUserId,
          isSuperAdmin: false,
          activeBusinessId: buyerBizId,
          businesses: [
            {
              businessId: buyerBizId,
              role: UserRole.BUSINESS_OWNER,
              business: {
                id: buyerBizId,
                legalName: "Apex Auto Care",
                tradeName: "Apex Auto",
                businessType: BusinessType.WORKSHOP,
              },
            },
          ],
        },
        headers: {},
        params: { id: "shp-resource-uuid-1234" }, // Resource ID on shipment route
        baseUrl: "/api/v1/shipments",
        url: "/api/v1/shipments/shp-resource-uuid-1234",
      };

      const resourceContext = {
        switchToHttp: () => ({
          getRequest: () => requestObj,
        }),
      } as unknown as ExecutionContext;

      const allowed = await tenantGuard.canActivate(resourceContext);
      expect(allowed).toBe(true);

      // Resolved tenant must be activeBusinessId (buyerBizId), NOT the shipment resource UUID!
      expect(requestObj.businessContext.id).toBe(buyerBizId);
    });

    it("VEC-TENANT-03: Sourcing RFQ comparison matrix must strictly block competing suppliers (403)", async () => {
      const rfqId = "rfq-test-confidential-001";
      const sampleRfq = {
        id: rfqId,
        buyerBusinessId: buyerBizId, // Owned by Apex Auto Care
        buyerBusiness: { tradeName: "Apex Auto", legalName: "Apex Auto Care" },
        createdBy: { firstName: "Rajesh", lastName: "Sharma" },
        masterProduct: {
          id: "prod-1",
          name: "Front Ceramic Brake Pad Set",
          partNumber: "BP-5544",
          brand: { name: "Bosch" },
          category: { name: "Brake System" },
        },
        invitedSuppliers: [],
        awardedQuotation: null,
        _count: { quotations: 2 },
        rfqNumber: "RFQ-2026-0001",
        status: RfqStatus.PUBLISHED,
        isPrivate: false,
        validityUntil: new Date(Date.now() + 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        deliveryDeadline: new Date(Date.now() + 86400000 * 2),
        targetUnitPrice: 1000.0,
        quantity: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue(
        sampleRfq as any,
      );

      // Competing supplier attempts to view quotation comparison matrix
      await expect(
        rfqService.compareQuotations(competingSupplierBizId, rfqId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-TENANT-04: Sourcing quotation detail must strictly block competing suppliers (403)", async () => {
      const quoteId = "qt-confidential-001";
      const supplier1Quote = {
        id: quoteId,
        quoteNumber: "QT-2026-0001",
        rfqId: "rfq-001",
        supplierBusinessId: supplier1BizId,
        unitPrice: 1000.0,
        totalAmount: 50000.0,
        availableQuantity: 50,
        minimumOrderQuantity: 1,
        leadTimeDays: 1,
        validityUntil: new Date(Date.now() + 86400000),
        status: QuotationStatus.SUBMITTED,
        revision: 1,
        terms: "Net 30",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rfq: {
          buyerBusinessId: buyerBizId,
        },
        supplierBusiness: {
          tradeName: "SuperSpares",
          legalName: "SuperSpares Ltd",
        },
        revisions: [],
      };

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue(
        supplier1Quote as any,
      );

      // Competing supplier attempts to read Supplier 1's pricing
      await expect(
        quotationService.getQuotationById(competingSupplierBizId, quoteId),
      ).rejects.toThrow(ForbiddenException);

      // Buyer business IS authorized to inspect the quotation
      const buyerView = await quotationService.getQuotationById(
        buyerBizId,
        quoteId,
      );
      expect(buyerView.id).toBe(quoteId);
    });
  });

  // ===========================================================================
  // SECTION 3: Logistics Multi-Tenant Authorization & POD Integrity
  // ===========================================================================
  describe("3. Logistics Multi-Tenant Authorization & POD Integrity", () => {
    const verifiedSender = {
      id: supplier1BizId,
      legalName: "SuperSpares Distribution",
      verificationStatus: "VERIFIED",
    };
    const verifiedReceiver = {
      id: buyerBizId,
      legalName: "Apex Auto Care",
      verificationStatus: "VERIFIED",
    };

    const shipmentMock = {
      id: "shp-audit-100",
      shipmentNumber: "SHP-2026-9999",
      senderBusinessId: supplier1BizId,
      receiverBusinessId: buyerBizId,
      status: ShipmentStatus.CREATED,
      deliveryAttemptCount: 0,
      legs: [
        {
          id: "leg-audit-1",
          legSequence: 1,
          legType: LegType.LAST_MILE_DELIVERY,
          status: LegStatus.PENDING,
          assignedProviderId: "lp-official-carrier",
        },
      ],
      items: [{ id: "item-1", masterProductId: "prod-1", quantity: 10 }],
    };

    it("VEC-LOG-01: Unauthorized third-party cannot transition shipment status (403)", async () => {
      vi.spyOn(prisma.shipment, "findUnique").mockResolvedValue(
        shipmentMock as any,
      );

      await expect(
        shipmentService.transitionStatus(
          thirdPartyBizId,
          "usr-attacker",
          "STAFF",
          shipmentMock.id,
          { status: ShipmentStatus.PICKUP_SCHEDULED as any },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-LOG-02: Unauthorized third-party cannot record delivery failure (403)", async () => {
      vi.spyOn(prisma.shipment, "findUnique").mockResolvedValue(
        shipmentMock as any,
      );

      await expect(
        shipmentService.recordFailedDelivery(
          thirdPartyBizId,
          "usr-attacker",
          shipmentMock.id,
          { failureReason: "Malicious cancellation attempt" },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-LOG-03: Unauthorized third-party cannot submit Proof of Delivery (403)", async () => {
      vi.spyOn(prisma.shipment, "findUnique").mockResolvedValue(
        shipmentMock as any,
      );

      await expect(
        shipmentService.submitProofOfDelivery(
          thirdPartyBizId,
          "usr-attacker",
          shipmentMock.id,
          { recipientName: "Fake Receiver" },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-LOG-04: Unauthorized tenant cannot inject tracking events (403)", async () => {
      vi.spyOn(prisma.shipment, "findUnique").mockResolvedValue(
        shipmentMock as any,
      );

      await expect(
        shipmentService.addTrackingEvent(
          thirdPartyBizId,
          "usr-attacker",
          "STAFF",
          shipmentMock.id,
          {
            eventType: ShipmentEventType.STATUS_UPDATED,
            notes: "Spoofed location update",
            location: "Unknown",
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("VEC-LOG-05: Cannot create shipment for non-ACCEPTED quotation (400)", async () => {
      (vi.spyOn(prisma.business, "findUnique") as any).mockImplementation(
        (args: any) => {
          if (args.where.id === supplier1BizId)
            return Promise.resolve(verifiedSender as any);
          if (args.where.id === buyerBizId)
            return Promise.resolve(verifiedReceiver as any);
          return Promise.resolve(null);
        },
      );

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue({
        id: "qt-unaccepted-001",
        rfqId: "rfq-001",
        supplierBusinessId: supplier1BizId,
        status: QuotationStatus.SUBMITTED, // NOT accepted
        rfq: { buyerBusinessId: buyerBizId },
      } as any);

      await expect(
        shipmentService.createShipment(supplier1BizId, supplier1UserId, {
          receiverBusinessId: buyerBizId,
          sourcingQuotationId: "qt-unaccepted-001",
          pickupAddress: "Warehouse 1",
          pickupCity: "Delhi",
          pickupState: "Delhi",
          pickupPostalCode: "110001",
          deliveryAddress: "Shop 2",
          deliveryCity: "Delhi",
          deliveryState: "Delhi",
          deliveryPostalCode: "110002",
          items: [{ masterProductId: "prod-1", quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("VEC-LOG-06: Cannot create duplicate active shipment for the same quotation (409 Conflict)", async () => {
      (vi.spyOn(prisma.business, "findUnique") as any).mockImplementation(
        (args: any) => {
          if (args.where.id === supplier1BizId)
            return Promise.resolve(verifiedSender as any);
          if (args.where.id === buyerBizId)
            return Promise.resolve(verifiedReceiver as any);
          return Promise.resolve(null);
        },
      );

      vi.spyOn(prisma.sourcingQuotation, "findUnique").mockResolvedValue({
        id: "qt-accepted-001",
        rfqId: "rfq-001",
        supplierBusinessId: supplier1BizId,
        status: QuotationStatus.ACCEPTED,
        rfq: { buyerBusinessId: buyerBizId },
      } as any);

      vi.spyOn(prisma.masterProduct, "findMany").mockResolvedValue([
        { id: "prod-1" } as any,
      ]);

      // Mock an existing active shipment in transit
      vi.spyOn(prisma.shipment, "findFirst").mockResolvedValue({
        id: "shp-existing-active",
        shipmentNumber: "SHP-2026-00001",
        status: ShipmentStatus.IN_TRANSIT,
      } as any);

      await expect(
        shipmentService.createShipment(supplier1BizId, supplier1UserId, {
          receiverBusinessId: buyerBizId,
          sourcingQuotationId: "qt-accepted-001",
          pickupAddress: "Warehouse 1",
          pickupCity: "Delhi",
          pickupState: "Delhi",
          pickupPostalCode: "110001",
          deliveryAddress: "Shop 2",
          deliveryCity: "Delhi",
          deliveryState: "Delhi",
          deliveryPostalCode: "110002",
          items: [{ masterProductId: "prod-1", quantity: 5 }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // SECTION 4: Business Integrity & Concurrency Controls
  // ===========================================================================
  describe("4. Business Integrity & Concurrency Controls", () => {
    it("VEC-INT-01: Inventory adjustment cannot reduce stock below zero (negative stock prevention)", async () => {
      const warehouseId = "wh-delhi-001";
      const supplierProductId = "sp-prod-100";

      vi.spyOn(prisma.supplierWarehouse, "findFirst").mockResolvedValue({
        id: warehouseId,
        supplierBusinessId: supplier1BizId,
      } as any);

      vi.spyOn(prisma.supplierProduct, "findFirst").mockResolvedValue({
        id: supplierProductId,
        supplierBusinessId: supplier1BizId,
      } as any);

      const existingInventory = {
        id: "wh-inv-1",
        warehouseId,
        supplierProductId,
        quantity: 10,
        availableQuantity: 10,
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

      // Attempt to deduct 15 units when balance is only 10
      await expect(
        inventoryService.adjustStock(supplier1BizId, supplier1UserId, {
          warehouseId,
          supplierProductId,
          changeQuantity: -15,
          reason: "CORRECTION",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("VEC-INT-02: RFQ award cannot be executed twice (atomic award idempotency & duplicate rejection)", async () => {
      const rfqId = "rfq-award-race-001";
      const winningQuoteId = "qt-winner-001";

      // Mock RFQ already in AWARDED state (e.g. from an earlier parallel thread)
      vi.spyOn(prisma.sourcingRfq, "findUnique").mockResolvedValue({
        id: rfqId,
        buyerBusinessId: buyerBizId,
        status: RfqStatus.AWARDED,
        rfqNumber: "RFQ-2026-9999",
        awardedQuotationId: winningQuoteId,
      } as any);

      await expect(
        rfqService.awardRfq(buyerBizId, buyerUserId, rfqId, winningQuoteId),
      ).rejects.toThrow(ConflictException);
    });
  });
});
