import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { envConfig } from "../config/env.config";
import { prisma } from "@asn/database";
import {
  JwtAccessPayload,
  UserContext,
  BusinessType,
  UserRole,
} from "@asn/types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required. No token provided.",
        },
      });
    }

    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token, {
        secret: envConfig.JWT_SECRET,
      });

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          success: false,
          error: {
            code: "USER_INACTIVE",
            message: "User account not found or suspended.",
          },
        });
      }

      const userContext: UserContext = {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        activeBusinessId: payload.activeBusinessId,
        role: payload.role,
        workspaceMode: payload.workspaceMode,
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

      request.user = userContext;
      return true;
    } catch {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Access token is invalid or expired.",
        },
      });
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    if (request.cookies && request.cookies["asn_access_token"]) {
      return request.cookies["asn_access_token"];
    }
    return null;
  }
}
