import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { BusinessContext, UserContext, UserRole } from "@asn/types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserContext = request.user;
    const businessContext: BusinessContext = request.businessContext;

    if (!user) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required for role evaluation.",
        },
      });
    }

    // Platform Super Admin bypasses all role checks
    if (user.isSuperAdmin) {
      return true;
    }

    const currentRole = businessContext?.currentUserRole || user.role;

    if (!currentRole || !requiredRoles.includes(currentRole)) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: `Access denied. Requires one of roles: [${requiredRoles.join(", ")}]. Current role: ${currentRole || "NONE"}`,
        },
      });
    }

    return true;
  }
}
