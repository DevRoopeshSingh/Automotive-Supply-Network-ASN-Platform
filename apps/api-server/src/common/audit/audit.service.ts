import { Injectable } from "@nestjs/common";
import { prisma } from "@asn/database";
import { createLogger } from "@asn/logger";

export interface LogAuditParams {
  userId?: string;
  businessId?: string;
  action: string;
  resource: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = createLogger("AuditService");

  async log(params: LogAuditParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          businessId: params.businessId,
          action: params.action,
          resource: params.resource,
          payload: params.payload
            ? JSON.parse(JSON.stringify(params.payload))
            : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
      this.logger.info(`Audit logged: ${params.action} on ${params.resource}`, {
        userId: params.userId,
        businessId: params.businessId,
      });
    } catch (error) {
      // Never crash the primary business transaction if audit writing encounters an error
      this.logger.error("Failed to write audit log", error, {
        action: params.action,
      });
    }
  }
}
