import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { prisma, LogisticsProviderType } from "@asn/database";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import { CreateLogisticsProviderInput } from "@asn/validators";
import { LogisticsProviderDto } from "@asn/types";

@Injectable()
export class LogisticsProviderService {
  private readonly logger = createLogger("LogisticsProviderService");

  constructor(private readonly auditService: AuditService) {}

  /**
   * Helper: Map Prisma LogisticsProvider to DTO
   */
  private toDto(provider: {
    id: string;
    providerCode: string;
    name: string;
    providerType: LogisticsProviderType;
    contactPhone: string | null;
    contactEmail: string | null;
    trackingUrlTemplate: string | null;
    isActive: boolean;
    businessId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LogisticsProviderDto {
    return {
      id: provider.id,
      providerCode: provider.providerCode,
      name: provider.name,
      providerType:
        provider.providerType as unknown as import("@asn/types").LogisticsProviderType,
      contactPhone: provider.contactPhone,
      contactEmail: provider.contactEmail,
      trackingUrlTemplate: provider.trackingUrlTemplate,
      isActive: provider.isActive,
      businessId: provider.businessId,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
    };
  }

  /**
   * Register a new logistics carrier or delivery partner
   */
  async createProvider(
    userId: string,
    callerBusinessId: string,
    input: CreateLogisticsProviderInput,
  ): Promise<LogisticsProviderDto> {
    const existing = await prisma.logisticsProvider.findUnique({
      where: { providerCode: input.providerCode },
    });
    if (existing) {
      throw new ConflictException(
        `Logistics provider code '${input.providerCode}' is already registered`,
      );
    }

    if (input.businessId) {
      const biz = await prisma.business.findUnique({
        where: { id: input.businessId },
      });
      if (!biz) {
        throw new NotFoundException("Associated business tenant not found");
      }
    }

    const provider = await prisma.logisticsProvider.create({
      data: {
        providerCode: input.providerCode,
        name: input.name,
        providerType: input.providerType as unknown as LogisticsProviderType,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        trackingUrlTemplate: input.trackingUrlTemplate,
        businessId: input.businessId,
        isActive: input.isActive ?? true,
      },
    });

    this.logger.info(
      `Logistics provider registered: ${provider.name} (${provider.providerCode})`,
      { providerId: provider.id },
    );

    await this.auditService.log({
      userId,
      businessId: callerBusinessId,
      action: "LOGISTICS_PROVIDER_REGISTERED",
      resource: `LogisticsProvider:${provider.id}`,
      payload: {
        providerCode: provider.providerCode,
        name: provider.name,
        providerType: provider.providerType,
      },
    });

    return this.toDto(provider);
  }

  /**
   * List active logistics providers
   */
  async listProviders(activeOnly = true): Promise<LogisticsProviderDto[]> {
    const providers = await prisma.logisticsProvider.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: "asc" },
    });
    return providers.map((p) => this.toDto(p));
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string): Promise<LogisticsProviderDto> {
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException("Logistics provider not found");
    }
    return this.toDto(provider);
  }
}
