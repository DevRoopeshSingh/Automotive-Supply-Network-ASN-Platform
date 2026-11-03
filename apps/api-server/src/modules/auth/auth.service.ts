import { Injectable, BadRequestException } from "@nestjs/common";
import { prisma } from "@asn/database";
import { OtpService } from "./otp/otp.service";
import { SessionService } from "./session/session.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuthTokens, UserContext, UserRole, BusinessType } from "@asn/types";
import { UpdateProfileInput } from "@asn/validators";

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async requestOtp(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.otpService.requestOtp(phone);
  }

  async verifyOtp(
    rawPhone: string,
    otp: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: UserContext; tokens: AuthTokens }> {
    const phone = this.otpService.normalizePhone(rawPhone);

    // 1. Verify OTP with single-use, rate-limit, and timeout checks
    await this.otpService.verifyOtp(phone, otp);

    // 2. Find or register user
    let user = await prisma.user.findUnique({
      where: { phone },
      include: {
        memberships: {
          include: { business: true },
        },
      },
    });

    let isNewUser = false;
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          firstName: "",
          lastName: "",
          isActive: true,
        },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });
      isNewUser = true;
    }

    if (!user.isActive) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "USER_DEACTIVATED",
          message: "Your account has been deactivated. Please contact support.",
        },
      });
    }

    const primaryMembership =
      user.memberships.find((m) => m.isPrimary) || user.memberships[0];

    // 3. Create fresh rotating session
    const tokens = await this.sessionService.createSession(
      user.id,
      user.phone,
      user.isSuperAdmin,
      primaryMembership?.businessId,
      primaryMembership?.role as unknown as UserRole,
      undefined,
      meta,
    );

    // 4. Log Audit Trail
    await this.auditService.log({
      userId: user.id,
      businessId: primaryMembership?.businessId,
      action: isNewUser ? "USER_REGISTERED" : "USER_LOGIN_OTP",
      resource: `User:${user.id}`,
      payload: { phone: `${phone.slice(0, 3)}****${phone.slice(-3)}` },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const userContext: UserContext = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      activeBusinessId: primaryMembership?.businessId,
      role: primaryMembership?.role as unknown as UserRole,
      memberships: user.memberships.map((m) => ({
        id: m.business.id,
        legalName: m.business.legalName,
        tradeName: m.business.tradeName,
        businessType: m.business.businessType as unknown as BusinessType,
        role: m.role as unknown as UserRole,
        isPrimary: m.isPrimary,
        isVerified: m.business.verificationStatus === "VERIFIED",
      })),
    };

    return { user: userContext, tokens };
  }

  async refreshTokens(
    refreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    return this.sessionService.rotateSession(refreshToken, meta);
  }

  async logout(
    userId: string,
    sessionId?: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ success: boolean; message: string }> {
    if (sessionId) {
      await this.sessionService.revokeSession(sessionId);
    } else {
      await this.sessionService.revokeAllUserSessions(userId);
    }

    await this.auditService.log({
      userId,
      action: "USER_LOGOUT",
      resource: `User:${userId}`,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: "Logged out successfully." };
  }

  async getProfile(userId: string): Promise<UserContext> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { business: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    const primaryMembership =
      user.memberships.find((m) => m.isPrimary) || user.memberships[0];

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      activeBusinessId: primaryMembership?.businessId,
      role: primaryMembership?.role as unknown as UserRole,
      memberships: user.memberships.map((m) => ({
        id: m.business.id,
        legalName: m.business.legalName,
        tradeName: m.business.tradeName,
        businessType: m.business.businessType as unknown as BusinessType,
        role: m.role as unknown as UserRole,
        isPrimary: m.isPrimary,
        isVerified: m.business.verificationStatus === "VERIFIED",
      })),
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserContext> {
    if (input.email) {
      const existing = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
      });
      if (existing) {
        throw new BadRequestException(
          "Email address is already in use by another account",
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
      },
      include: {
        memberships: {
          include: { business: true },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: "USER_PROFILE_UPDATED",
      resource: `User:${userId}`,
      payload: { firstName: input.firstName, email: input.email },
    });

    const primaryMembership =
      updated.memberships.find((m) => m.isPrimary) || updated.memberships[0];

    return {
      id: updated.id,
      phone: updated.phone,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      isSuperAdmin: updated.isSuperAdmin,
      activeBusinessId: primaryMembership?.businessId,
      role: primaryMembership?.role as unknown as UserRole,
      memberships: updated.memberships.map((m) => ({
        id: m.business.id,
        legalName: m.business.legalName,
        tradeName: m.business.tradeName,
        businessType: m.business.businessType as unknown as BusinessType,
        role: m.role as unknown as UserRole,
        isPrimary: m.isPrimary,
        isVerified: m.business.verificationStatus === "VERIFIED",
      })),
    };
  }
}
