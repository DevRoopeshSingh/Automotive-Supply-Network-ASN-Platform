import { describe, it, expect, beforeEach, vi } from "vitest";
import { JwtService } from "@nestjs/jwt";
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { OtpService } from "./otp/otp.service";
import { MockOtpProvider } from "./otp/mock-otp.provider";
import { SessionService } from "./session/session.service";
import { AuthService } from "./auth.service";
import { RedisService } from "../../common/redis/redis.service";
import { AuditService } from "../../common/audit/audit.service";
import { prisma } from "@asn/database";
import { envConfig } from "../../common/config/env.config";

describe("Auth & Session Security Module", () => {
  let otpProvider: MockOtpProvider;
  let redisService: RedisService;
  let otpService: OtpService;
  let sessionService: SessionService;
  let auditService: AuditService;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(() => {
    vi.restoreAllMocks();
    jwtService = new JwtService({ secret: envConfig.JWT_SECRET });
    otpProvider = new MockOtpProvider();
    redisService = new RedisService();
    auditService = new AuditService();
    otpService = new OtpService(otpProvider, redisService);
    sessionService = new SessionService(jwtService, redisService);
    authService = new AuthService(otpService, sessionService, auditService);
  });

  describe("1. Phone Normalization & Validation", () => {
    it("should normalize Indian phone numbers from diverse formats to 10 digits", () => {
      expect(otpService.normalizePhone("9876543210")).toBe("9876543210");
      expect(otpService.normalizePhone("+91 98765 43210")).toBe("9876543210");
      expect(otpService.normalizePhone("09876543210")).toBe("9876543210");
      expect(otpService.normalizePhone("+91-9876543210")).toBe("9876543210");
    });

    it("should reject invalid phone lengths", () => {
      expect(() => otpService.normalizePhone("12345")).toThrow(
        BadRequestException,
      );
      expect(() => otpService.normalizePhone("98765432100000")).toThrow(
        BadRequestException,
      );
    });
  });

  describe("2. OTP Lifecycle & Rate Limiting", () => {
    it("should enforce a 60-second cooldown between consecutive OTP requests", async () => {
      const phone = "9876500001";

      vi.spyOn(prisma.otpRecord, "updateMany").mockResolvedValue({ count: 0 });
      vi.spyOn(prisma.otpRecord, "create").mockResolvedValue({
        id: "otp-1",
        phone,
        otpHash: "hash",
        attempts: 0,
        isUsed: false,
        expiresAt: new Date(Date.now() + 300000),
        createdAt: new Date(),
      });

      // First request succeeds
      const first = await otpService.requestOtp(phone);
      expect(first.success).toBe(true);

      // Second immediate request must be rejected with 429
      try {
        await otpService.requestOtp(phone);
        expect.unreachable("Should have thrown 429");
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(429);
        expect(err.getResponse()).toMatchObject({
          success: false,
          error: { code: "OTP_COOLDOWN" },
        });
      }
    });

    it("should reject expired OTPs", async () => {
      const phone = "9876500002";
      const expiredDate = new Date(Date.now() - 10000); // 10s in the past

      vi.spyOn(prisma.otpRecord, "findFirst").mockResolvedValue({
        id: "otp-expired",
        phone,
        otpHash: "anyhash",
        attempts: 0,
        isUsed: false,
        expiresAt: expiredDate,
        createdAt: new Date(Date.now() - 400000),
      });

      const updateSpy = vi
        .spyOn(prisma.otpRecord, "update")
        .mockResolvedValue({} as any);

      try {
        await otpService.verifyOtp(phone, "123456");
        expect.unreachable("Should have thrown OTP_EXPIRED");
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          success: false,
          error: { code: "OTP_EXPIRED" },
        });
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ data: { isUsed: true } }),
        );
      }
    });

    it("should lockout and invalidate OTP after maximum failed attempts", async () => {
      const phone = "9876500003";

      vi.spyOn(prisma.otpRecord, "findFirst").mockResolvedValue({
        id: "otp-max",
        phone,
        otpHash: "somehash",
        attempts: 5, // Already reached max 5 attempts
        isUsed: false,
        expiresAt: new Date(Date.now() + 200000),
        createdAt: new Date(),
      });

      const updateSpy = vi
        .spyOn(prisma.otpRecord, "update")
        .mockResolvedValue({} as any);

      try {
        await otpService.verifyOtp(phone, "123456");
        expect.unreachable("Should have thrown MAX_ATTEMPTS_EXCEEDED");
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          success: false,
          error: { code: "MAX_ATTEMPTS_EXCEEDED" },
        });
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ data: { isUsed: true } }),
        );
      }
    });
  });

  describe("3. Refresh Token Rotation & Reuse Detection (Security Core)", () => {
    it("should rotate refresh token and issue a new token within the same family", async () => {
      const userId = "usr-123";
      const phone = "9876543210";

      vi.spyOn(prisma.refreshSession, "create").mockResolvedValue({} as any);
      vi.spyOn(prisma.refreshSession, "update").mockResolvedValue({} as any);

      // 1. Create initial session
      const initialTokens = await sessionService.createSession(
        userId,
        phone,
        false,
      );
      expect(initialTokens.accessToken).toBeDefined();
      expect(initialTokens.refreshToken).toBeDefined();

      const payload = jwtService.decode(initialTokens.refreshToken) as any;

      vi.spyOn(prisma.refreshSession, "findUnique").mockResolvedValue({
        id: payload.sessionId,
        userId,
        tokenHash: (sessionService as any).hashToken(
          initialTokens.refreshToken,
        ),
        familyId: payload.familyId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userAgent: null,
        ipAddress: null,
        user: {
          id: userId,
          phone,
          isSuperAdmin: false,
          memberships: [],
        },
      } as any);

      // 2. Rotate session
      const rotatedTokens = await sessionService.rotateSession(
        initialTokens.refreshToken,
      );
      expect(rotatedTokens.accessToken).toBeDefined();
      expect(rotatedTokens.refreshToken).toBeDefined();
      expect(rotatedTokens.refreshToken).not.toBe(initialTokens.refreshToken);

      const rotatedPayload = jwtService.decode(
        rotatedTokens.refreshToken,
      ) as any;
      // Must maintain familyId grouping
      expect(rotatedPayload.familyId).toBe(payload.familyId);
      // Must have fresh sessionId
      expect(rotatedPayload.sessionId).not.toBe(payload.sessionId);
    });

    it("should detect token reuse and revoke ALL sessions in family upon breach", async () => {
      const userId = "usr-hacked";
      const familyId = "fam-comp-999";

      const compromisedRefreshToken = jwtService.sign(
        { sub: userId, sessionId: "sess-already-used", familyId },
        { secret: envConfig.JWT_REFRESH_SECRET, expiresIn: "7d" },
      );

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
        user: {
          id: userId,
          phone: "9876543210",
          isSuperAdmin: false,
          memberships: [],
        },
      } as any);

      const revokeAllSpy = vi
        .spyOn(prisma.refreshSession, "updateMany")
        .mockResolvedValue({ count: 3 });

      try {
        await sessionService.rotateSession(compromisedRefreshToken);
        expect.unreachable("Should have thrown TOKEN_REUSE_DETECTED");
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.getResponse()).toMatchObject({
          success: false,
          error: { code: "TOKEN_REUSE_DETECTED" },
        });
        expect(revokeAllSpy).toHaveBeenCalledWith({
          where: { familyId },
          data: { isRevoked: true },
        });
      }
    });
  });

  describe("4. AuthService Login & Registration Flow", () => {
    it("should register new user and issue session tokens upon valid OTP verification", async () => {
      const phone = "9876543210";
      const otp = "123456";

      vi.spyOn(otpService, "normalizePhone").mockReturnValue(phone);
      vi.spyOn(otpService, "verifyOtp").mockResolvedValue(true);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.user, "create").mockResolvedValue({
        id: "usr-new-1",
        phone,
        firstName: "",
        lastName: "",
        isSuperAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      } as any);
      vi.spyOn(sessionService, "createSession").mockResolvedValue({
        accessToken: "access-123",
        refreshToken: "refresh-123",
        expiresIn: 900,
        tokenType: "Bearer",
      });
      vi.spyOn(auditService, "log").mockResolvedValue(undefined);

      const result = await authService.verifyOtp(phone, otp);
      expect(result.user.id).toBe("usr-new-1");
      expect(result.tokens.accessToken).toBe("access-123");
    });
  });
});
