import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BusinessesService } from "./businesses.service";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "../../common/audit/audit.service";
import { SessionService } from "../auth/session/session.service";
import { BusinessType, UserRole } from "@asn/types";
import { prisma } from "@asn/database";

describe("Multi-Tenant Business & RBAC Module", () => {
  let businessesService: BusinessesService;
  let auditService: AuditService;
  let sessionService: SessionService;
  let tenantGuard: TenantContextGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    sessionService = {
      generateAccessToken: vi.fn().mockReturnValue("mock-scoped-jwt"),
    } as any;
    businessesService = new BusinessesService(auditService, sessionService);
    tenantGuard = new TenantContextGuard();
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  describe("1. Business Creation & Ownership Assignment", () => {
    it("should create business and automatically assign creator as BUSINESS_OWNER in atomic transaction", async () => {
      const userId = "usr-owner-1";
      const input = {
        legalName: "Star Auto Spares LLP",
        tradeName: "Star Auto",
        businessType: BusinessType.DISTRIBUTOR,
        addressLine1: "Gala 12, Kurla West",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400070",
      };

      const mockBusiness = {
        id: "biz-100",
        ...input,
        verificationStatus: "PENDING",
        isActive: true,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            business: {
              create: vi.fn().mockResolvedValue(mockBusiness),
            },
            businessMember: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({
                id: "mem-1",
                userId,
                businessId: mockBusiness.id,
                role: UserRole.BUSINESS_OWNER,
                isPrimary: true,
              }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(auditService, "log").mockResolvedValue(undefined);

      const result = await businessesService.createBusiness(userId, input);
      expect(result.id).toBe(mockBusiness.id);
      expect(result.tradeName).toBe(input.tradeName);
    });
  });

  describe("2. Multi-Tenant Context Isolation Guard", () => {
    it("should reject access (403) when user attempts to access business they do not belong to", async () => {
      const mockRequest = {
        user: {
          id: "usr-unauthorized",
          phone: "9876543210",
          isSuperAdmin: false,
          activeBusinessId: "biz-other",
          memberships: [],
        },
        headers: {
          "x-business-id": "biz-forbidden-999",
        },
        params: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      // Mock DB checking membership
      vi.spyOn(prisma.businessMember, "findUnique").mockResolvedValue(null);

      await expect(tenantGuard.canActivate(mockContext)).rejects.toThrowError(
        ForbiddenException,
      );
    });

    it("should grant access and inject BusinessContext when user is a verified member", async () => {
      const mockRequest = {
        user: {
          id: "usr-valid",
          phone: "9876543210",
          isSuperAdmin: false,
          activeBusinessId: "biz-valid-1",
          memberships: [],
        },
        headers: {
          "x-business-id": "biz-valid-1",
        },
        params: {},
      } as any;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      vi.spyOn(prisma.businessMember, "findUnique").mockResolvedValue({
        id: "mem-valid",
        userId: "usr-valid",
        businessId: "biz-valid-1",
        role: UserRole.BUSINESS_OWNER,
        isPrimary: true,
        business: {
          id: "biz-valid-1",
          legalName: "Apex Spares",
          tradeName: "Apex",
          businessType: BusinessType.GARAGE,
          verificationStatus: "VERIFIED",
          isActive: true,
          gstNumber: "27AABCS1429B1Z8",
          panNumber: null,
        },
      } as any);

      const canActivate = await tenantGuard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockRequest.businessContext).toBeDefined();
      expect(mockRequest.businessContext.id).toBe("biz-valid-1");
      expect(mockRequest.businessContext.currentUserRole).toBe(
        UserRole.BUSINESS_OWNER,
      );
    });
  });

  describe("3. Role-Based Access Control (RBAC Guard)", () => {
    it("should forbid BUSINESS_STAFF on routes requiring BUSINESS_OWNER or BUSINESS_ADMIN", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.BUSINESS_OWNER,
        UserRole.BUSINESS_ADMIN,
      ]);

      const mockRequest = {
        user: { id: "usr-staff", isSuperAdmin: false },
        businessContext: {
          id: "biz-1",
          currentUserRole: UserRole.BUSINESS_STAFF, // Staff role
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrowError(
        ForbiddenException,
      );
    });

    it("should allow BUSINESS_OWNER on admin-protected routes", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.BUSINESS_OWNER,
        UserRole.BUSINESS_ADMIN,
      ]);

      const mockRequest = {
        user: { id: "usr-owner", isSuperAdmin: false },
        businessContext: {
          id: "biz-1",
          currentUserRole: UserRole.BUSINESS_OWNER,
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });
  });
});
