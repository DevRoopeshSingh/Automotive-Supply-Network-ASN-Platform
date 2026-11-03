import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { prisma } from "@asn/database";
import { RedisService } from "../../../common/redis/redis.service";
import { envConfig } from "../../../common/config/env.config";
import {
  AuthTokens,
  JwtAccessPayload,
  JwtRefreshPayload,
  UserRole,
  WorkspaceMode,
} from "@asn/types";
import { createLogger } from "@asn/logger";

@Injectable()
export class SessionService {
  private readonly logger = createLogger("SessionService");
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";
  private readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async createSession(
    userId: string,
    phone: string,
    isSuperAdmin: boolean,
    activeBusinessId?: string,
    role?: UserRole,
    workspaceMode?: WorkspaceMode,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    const familyId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    // 1. Generate Refresh Token
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId,
      familyId,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: envConfig.JWT_REFRESH_SECRET,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    // 2. Persist in database
    await prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash,
        familyId,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
        isRevoked: false,
        expiresAt,
      },
    });

    // 3. Cache in Redis
    await this.redisService.set(
      `session:${sessionId}`,
      JSON.stringify({ userId, familyId, isRevoked: false }),
      this.REFRESH_TOKEN_TTL_SECONDS,
    );

    // 4. Generate Access Token
    const accessToken = this.generateAccessToken({
      sub: userId,
      phone,
      isSuperAdmin,
      activeBusinessId,
      role,
      workspaceMode,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 mins in seconds
      tokenType: "Bearer",
    };
  }

  generateAccessToken(payload: JwtAccessPayload): string {
    return this.jwtService.sign(payload, {
      secret: envConfig.JWT_SECRET,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  async rotateSession(
    rawRefreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(rawRefreshToken, {
        secret: envConfig.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "The provided refresh token is expired or invalid.",
        },
      });
    }

    const { sub: userId, sessionId, familyId } = payload;
    const incomingHash = this.hashToken(rawRefreshToken);

    const session = await prisma.refreshSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            memberships: {
              include: { business: true },
            },
          },
        },
      },
    });

    // REUSE DETECTION: If session does not exist, or token hash does not match, or is already revoked
    if (!session || session.tokenHash !== incomingHash || session.isRevoked) {
      this.logger.warn(
        `Security alert: Refresh token reuse detected for family ${familyId}`,
        {
          userId,
          familyId,
        },
      );

      // Immediate revocation of the ENTIRE family to protect the compromised user account
      await prisma.refreshSession.updateMany({
        where: { familyId },
        data: { isRevoked: true },
      });

      throw new UnauthorizedException({
        success: false,
        error: {
          code: "TOKEN_REUSE_DETECTED",
          message:
            "Security breach detected. All active sessions have been terminated. Please log in again.",
        },
      });
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      await prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "SESSION_EXPIRED",
          message: "Session has expired. Please log in again.",
        },
      });
    }

    // Mark current session as revoked / rotated
    await prisma.refreshSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
    await this.redisService.del(`session:${sessionId}`);

    // Create a new session in the same family (Token Rotation)
    const newSessionId = crypto.randomUUID();
    const newRefreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId: newSessionId,
      familyId,
    };

    const newRefreshToken = this.jwtService.sign(newRefreshPayload, {
      secret: envConfig.JWT_REFRESH_SECRET,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    const newTokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await prisma.refreshSession.create({
      data: {
        id: newSessionId,
        userId,
        tokenHash: newTokenHash,
        familyId,
        userAgent: meta?.userAgent || session.userAgent,
        ipAddress: meta?.ipAddress || session.ipAddress,
        isRevoked: false,
        expiresAt,
      },
    });

    await this.redisService.set(
      `session:${newSessionId}`,
      JSON.stringify({ userId, familyId, isRevoked: false }),
      this.REFRESH_TOKEN_TTL_SECONDS,
    );

    // Find default active business membership if available
    const primaryMembership =
      session.user.memberships.find((m) => m.isPrimary) ||
      session.user.memberships[0];

    const accessToken = this.generateAccessToken({
      sub: userId,
      phone: session.user.phone,
      isSuperAdmin: session.user.isSuperAdmin,
      activeBusinessId: primaryMembership?.businessId,
      role: primaryMembership?.role as unknown as UserRole,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: "Bearer",
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.refreshSession.updateMany({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
    await this.redisService.del(`session:${sessionId}`);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.refreshSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
