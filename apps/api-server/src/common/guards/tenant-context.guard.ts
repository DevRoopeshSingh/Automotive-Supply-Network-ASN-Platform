import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@asn/database";
import {
  BusinessContext,
  UserContext,
  UserRole,
  BusinessType,
} from "@asn/types";

@Injectable()
export class TenantContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserContext = request.user;

    if (!user) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "User authentication required prior to tenant resolution.",
        },
      });
    }

    // Determine target business ID from header, param, or user default
    const businessId =
      (request.headers["x-business-id"] as string) ||
      request.params?.businessId ||
      request.params?.id ||
      user.activeBusinessId;

    if (!businessId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "BUSINESS_CONTEXT_MISSING",
          message:
            "No business context provided. Please pass X-Business-Id header or select an active business.",
        },
      });
    }

    // Super Admin bypass: super admin can view all businesses with PLATFORM_SUPER_ADMIN role
    if (user.isSuperAdmin) {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "Requested business does not exist.",
          },
        });
      }

      request.businessContext = {
        id: business.id,
        legalName: business.legalName,
        tradeName: business.tradeName,
        businessType: business.businessType as unknown as BusinessType,
        isVerified: business.verificationStatus === "VERIFIED",
        gstNumber: business.gstNumber,
        panNumber: business.panNumber,
        currentUserRole: UserRole.PLATFORM_SUPER_ADMIN,
      } as BusinessContext;

      return true;
    }

    // Strict multi-tenant verification: verify user is an active member of this business
    const membership = await prisma.businessMember.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
          businessId,
        },
      },
      include: { business: true },
    });

    if (!membership || !membership.business.isActive) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "TENANT_ACCESS_DENIED",
          message:
            "Access denied. You do not have valid membership for this business.",
        },
      });
    }

    const businessContext: BusinessContext = {
      id: membership.business.id,
      legalName: membership.business.legalName,
      tradeName: membership.business.tradeName,
      businessType: membership.business.businessType as unknown as BusinessType,
      isVerified: membership.business.verificationStatus === "VERIFIED",
      gstNumber: membership.business.gstNumber,
      panNumber: membership.business.panNumber,
      currentUserRole: membership.role as unknown as UserRole,
    };

    request.businessContext = businessContext;
    return true;
  }
}
