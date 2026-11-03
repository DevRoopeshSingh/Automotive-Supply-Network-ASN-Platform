import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { prisma } from "@asn/database";
import { AuditService } from "../../common/audit/audit.service";
import { SessionService } from "../auth/session/session.service";
import {
  CreateBusinessInput,
  UpdateBusinessInput,
  InviteBusinessMemberInput,
} from "@asn/validators";
import { UserContext, UserRole } from "@asn/types";
import { createLogger } from "@asn/logger";

@Injectable()
export class BusinessesService {
  private readonly logger = createLogger("BusinessesService");

  constructor(
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async createBusiness(
    userId: string,
    input: CreateBusinessInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (input.gstNumber) {
      const existing = await prisma.business.findUnique({
        where: { gstNumber: input.gstNumber },
      });
      if (existing) {
        throw new BadRequestException(
          "A business with this GSTIN is already registered.",
        );
      }
    }

    // Atomic transaction: create business, address, and assign creator as BUSINESS_OWNER
    const business = await prisma.$transaction(async (tx) => {
      const newBiz = await tx.business.create({
        data: {
          legalName: input.legalName,
          tradeName: input.tradeName,
          businessType: input.businessType,
          gstNumber: input.gstNumber,
          panNumber: input.panNumber,
          verificationStatus: "PENDING",
          isActive: true,
          addresses: {
            create: {
              addressLine1: input.addressLine1,
              addressLine2: input.addressLine2,
              city: input.city,
              state: input.state,
              postalCode: input.postalCode,
              latitude: input.latitude,
              longitude: input.longitude,
              isDefault: true,
            },
          },
        },
      });

      // Check if user has any existing primary business
      const existingPrimary = await tx.businessMember.findFirst({
        where: { userId, isPrimary: true },
      });

      await tx.businessMember.create({
        data: {
          userId,
          businessId: newBiz.id,
          role: UserRole.BUSINESS_OWNER,
          isPrimary: !existingPrimary, // Set primary if user had none
        },
      });

      return newBiz;
    });

    this.logger.info(
      `Business created: ${business.legalName} (${business.id})`,
    );

    await this.auditService.log({
      userId,
      businessId: business.id,
      action: "BUSINESS_CREATED",
      resource: `Business:${business.id}`,
      payload: { tradeName: input.tradeName, businessType: input.businessType },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return business;
  }

  async getUserBusinesses(userId: string) {
    const memberships = await prisma.businessMember.findMany({
      where: { userId },
      include: {
        business: {
          include: {
            addresses: true,
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      businessId: m.businessId,
      role: m.role,
      isPrimary: m.isPrimary,
      business: m.business,
    }));
  }

  async getBusinessById(businessId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        addresses: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async updateBusiness(
    businessId: string,
    input: UpdateBusinessInput,
    userId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
      },
    });

    await this.auditService.log({
      userId,
      businessId,
      action: "BUSINESS_PROFILE_UPDATED",
      resource: `Business:${businessId}`,
      payload: input as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async switchBusinessContext(
    user: UserContext,
    targetBusinessId: string,
  ): Promise<{
    accessToken: string;
    activeBusinessId: string;
    role: UserRole;
  }> {
    const membership = user.memberships.find((m) => m.id === targetBusinessId);

    if (!membership && !user.isSuperAdmin) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "MEMBERSHIP_NOT_FOUND",
          message: "You are not a member of the requested business.",
        },
      });
    }

    const assignedRole = user.isSuperAdmin
      ? UserRole.PLATFORM_SUPER_ADMIN
      : membership!.role;

    // Generate new access token bound to the switched business context
    const accessToken = this.sessionService.generateAccessToken({
      sub: user.id,
      phone: user.phone,
      isSuperAdmin: user.isSuperAdmin,
      activeBusinessId: targetBusinessId,
      role: assignedRole,
    });

    await this.auditService.log({
      userId: user.id,
      businessId: targetBusinessId,
      action: "BUSINESS_CONTEXT_SWITCHED",
      resource: `Business:${targetBusinessId}`,
      payload: { role: assignedRole },
    });

    return {
      accessToken,
      activeBusinessId: targetBusinessId,
      role: assignedRole,
    };
  }

  async inviteMember(
    businessId: string,
    invitedByUserId: string,
    input: InviteBusinessMemberInput,
  ) {
    const invitationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.businessInvitation.create({
      data: {
        businessId,
        phone: input.phone,
        email: input.email,
        role: input.role,
        invitedById: invitedByUserId,
        status: "PENDING",
        token: invitationToken,
        expiresAt,
      },
    });

    await this.auditService.log({
      userId: invitedByUserId,
      businessId,
      action: "BUSINESS_MEMBER_INVITED",
      resource: `BusinessInvitation:${invitation.id}`,
      payload: { phone: input.phone, role: input.role },
    });

    return {
      id: invitation.id,
      phone: invitation.phone,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }
}
