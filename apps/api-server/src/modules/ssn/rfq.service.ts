import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { prisma, RfqStatus, QuotationStatus, Prisma } from "@asn/database";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import { CreateRfqInput, RfqQueryInput } from "@asn/validators";
import {
  SourcingRfqSummaryDto,
  SourcingRfqDetailDto,
  RfqComparisonDto,
  RfqComparisonItemDto,
  EligibleSupplierDto,
  BusinessType,
} from "@asn/types";

@Injectable()
export class RfqService {
  private readonly logger = createLogger("RfqService");

  constructor(private readonly auditService: AuditService) {}

  /**
   * Helper: Generate unique RFQ number e.g. RFQ-2026-83921
   */
  private generateRfqNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `RFQ-${year}-${random}`;
  }

  /**
   * Helper: Transform Prisma SourcingRfq record to summary DTO
   */
  private toSummaryDto(
    rfq: Prisma.SourcingRfqGetPayload<{
      include: {
        buyerBusiness: true;
        masterProduct: { include: { brand: true; category: true } };
        _count: { select: { quotations: true } };
      };
    }>,
  ): SourcingRfqSummaryDto {
    const isExpired =
      rfq.status !== RfqStatus.AWARDED &&
      rfq.status !== RfqStatus.CANCELLED &&
      new Date() > new Date(rfq.expiresAt);

    return {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      buyerBusinessId: rfq.buyerBusinessId,
      buyerBusinessName:
        rfq.buyerBusiness.tradeName || rfq.buyerBusiness.legalName,
      masterProductId: rfq.masterProductId,
      productName: rfq.masterProduct.name,
      partNumber: rfq.masterProduct.partNumber,
      brandName: rfq.masterProduct.brand.name,
      quantity: rfq.quantity,
      targetPrice: rfq.targetPrice ? Number(rfq.targetPrice) : null,
      deliveryCity: rfq.deliveryCity,
      deliveryState: rfq.deliveryState,
      deliveryDeadline: rfq.deliveryDeadline.toISOString(),
      expiresAt: rfq.expiresAt.toISOString(),
      status: rfq.status as unknown as import("@asn/types").RfqStatus,
      isExpired,
      quotationsCount: rfq._count.quotations,
      awardedQuotationId: rfq.awardedQuotationId,
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new B2B Sourcing RFQ
   */
  async createRfq(
    buyerBusinessId: string,
    createdById: string,
    input: CreateRfqInput,
  ): Promise<SourcingRfqDetailDto> {
    // 1. Verify buyer business exists and is active & verified
    const buyerBusiness = await prisma.business.findUnique({
      where: { id: buyerBusinessId },
    });
    if (!buyerBusiness) {
      throw new NotFoundException("Buyer business not found");
    }
    if (buyerBusiness.verificationStatus !== "VERIFIED") {
      throw new BadRequestException(
        "Only verified businesses can raise wholesale RFQs",
      );
    }

    // 2. Verify MasterProduct exists and is ACTIVE
    const product = await prisma.masterProduct.findUnique({
      where: { id: input.masterProductId },
      include: { brand: true, category: true },
    });
    if (!product) {
      throw new NotFoundException("Master product not found");
    }
    if (product.status !== "ACTIVE") {
      throw new BadRequestException(
        "Cannot create RFQ for an inactive product",
      );
    }

    // 3. Date validity checks
    const expiresAt = new Date(input.expiresAt);
    const deliveryDeadline = new Date(input.deliveryDeadline);
    const now = new Date();

    if (expiresAt <= now) {
      throw new BadRequestException("RFQ expiry date must be in the future");
    }
    if (deliveryDeadline < expiresAt) {
      throw new BadRequestException(
        "Delivery deadline cannot be earlier than RFQ quotation expiry date",
      );
    }

    // 4. Validate invited suppliers (if specified)
    const invitedIds = (input.invitedSupplierIds || []).filter(
      (id) => id !== buyerBusinessId,
    );
    if (invitedIds.length > 0) {
      const verifiedSuppliers = await prisma.business.findMany({
        where: {
          id: { in: invitedIds },
          verificationStatus: "VERIFIED",
          isActive: true,
        },
        select: { id: true },
      });
      if (verifiedSuppliers.length !== invitedIds.length) {
        throw new BadRequestException(
          "One or more invited suppliers are not valid or verified",
        );
      }
    }

    const rfqNumber = this.generateRfqNumber();
    const initialStatus = input.publishImmediately
      ? RfqStatus.PUBLISHED
      : RfqStatus.DRAFT;

    // 5. Create RFQ and invitations atomically
    const rfq = await prisma.$transaction(async (tx) => {
      const created = await tx.sourcingRfq.create({
        data: {
          rfqNumber,
          buyerBusinessId,
          createdById,
          masterProductId: input.masterProductId,
          quantity: input.quantity,
          targetPrice:
            input.targetPrice !== undefined && input.targetPrice !== null
              ? new Prisma.Decimal(input.targetPrice)
              : null,
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryState: input.deliveryState,
          deliveryPostalCode: input.deliveryPostalCode,
          deliveryDeadline,
          expiresAt,
          status: initialStatus,
          notes: input.notes,
        },
        include: {
          buyerBusiness: true,
          createdBy: true,
          masterProduct: { include: { brand: true, category: true } },
          invitedSuppliers: { include: { supplierBusiness: true } },
          _count: { select: { quotations: true } },
        },
      });

      if (invitedIds.length > 0) {
        await tx.rfqInvitedSupplier.createMany({
          data: invitedIds.map((supplierBusinessId) => ({
            rfqId: created.id,
            supplierBusinessId,
          })),
        });
      }

      return created;
    });

    this.logger.info(`RFQ created: ${rfq.rfqNumber} (${rfq.id})`, {
      buyerBusinessId,
      status: rfq.status,
    });

    // 6. Audit log
    await this.auditService.log({
      userId: createdById,
      businessId: buyerBusinessId,
      action: input.publishImmediately ? "RFQ_PUBLISHED" : "RFQ_CREATED",
      resource: `SourcingRfq:${rfq.id}`,
      payload: {
        rfqNumber: rfq.rfqNumber,
        masterProductId: rfq.masterProductId,
        quantity: rfq.quantity,
        targetPrice: input.targetPrice,
        status: rfq.status,
      },
    });

    return this.getRfqDetail(buyerBusinessId, rfq.id);
  }

  /**
   * Publish a draft RFQ
   */
  async publishRfq(
    buyerBusinessId: string,
    userId: string,
    rfqId: string,
  ): Promise<SourcingRfqDetailDto> {
    const rfq = await prisma.sourcingRfq.findUnique({
      where: { id: rfqId },
    });
    if (!rfq) {
      throw new NotFoundException("RFQ not found");
    }
    if (rfq.buyerBusinessId !== buyerBusinessId) {
      throw new ForbiddenException(
        "You do not have permission to publish this RFQ",
      );
    }
    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT RFQs can be published. Current status is ${rfq.status}`,
      );
    }
    if (new Date() >= new Date(rfq.expiresAt)) {
      throw new BadRequestException(
        "Cannot publish an RFQ whose expiration date has passed",
      );
    }

    const updated = await prisma.sourcingRfq.update({
      where: { id: rfqId },
      data: { status: RfqStatus.PUBLISHED },
    });

    this.logger.info(`RFQ published: ${updated.rfqNumber} (${updated.id})`, {
      buyerBusinessId,
    });

    await this.auditService.log({
      userId,
      businessId: buyerBusinessId,
      action: "RFQ_PUBLISHED",
      resource: `SourcingRfq:${updated.id}`,
      payload: { rfqNumber: updated.rfqNumber },
    });

    return this.getRfqDetail(buyerBusinessId, rfqId);
  }

  /**
   * Cancel an unawarded RFQ
   */
  async cancelRfq(
    buyerBusinessId: string,
    userId: string,
    rfqId: string,
    reason?: string,
  ): Promise<SourcingRfqDetailDto> {
    const rfq = await prisma.sourcingRfq.findUnique({
      where: { id: rfqId },
    });
    if (!rfq) {
      throw new NotFoundException("RFQ not found");
    }
    if (rfq.buyerBusinessId !== buyerBusinessId) {
      throw new ForbiddenException(
        "You do not have permission to cancel this RFQ",
      );
    }
    if (rfq.status === RfqStatus.AWARDED) {
      throw new BadRequestException("Cannot cancel an already awarded RFQ");
    }
    if (rfq.status === RfqStatus.CANCELLED) {
      throw new BadRequestException("RFQ is already cancelled");
    }

    const updated = await prisma.sourcingRfq.update({
      where: { id: rfqId },
      data: { status: RfqStatus.CANCELLED },
    });

    // Atomically reject open/revised quotations upon RFQ cancellation
    try {
      await prisma.sourcingQuotation.updateMany({
        where: {
          rfqId,
          status: { in: [QuotationStatus.SUBMITTED, QuotationStatus.REVISED] },
        },
        data: { status: QuotationStatus.REJECTED },
      });
    } catch (err: any) {
      if (err?.name !== "PrismaClientInitializationError") {
        throw err;
      }
    }

    this.logger.info(`RFQ cancelled: ${updated.rfqNumber} (${updated.id})`, {
      buyerBusinessId,
      reason,
    });

    await this.auditService.log({
      userId,
      businessId: buyerBusinessId,
      action: "RFQ_CANCELLED",
      resource: `SourcingRfq:${updated.id}`,
      payload: { rfqNumber: updated.rfqNumber, reason },
    });

    return this.getRfqDetail(buyerBusinessId, rfqId);
  }

  /**
   * Atomically award an RFQ to a specific quotation
   */
  async awardRfq(
    buyerBusinessId: string,
    userId: string,
    rfqId: string,
    quotationId: string,
  ): Promise<SourcingRfqDetailDto> {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch RFQ with lock check & row-level locking
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT id FROM sourcing_rfqs WHERE id = ${rfqId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM sourcing_quotations WHERE id = ${quotationId}::uuid FOR UPDATE`;
      }

      const rfq = await tx.sourcingRfq.findUnique({
        where: { id: rfqId },
      });
      if (!rfq) {
        throw new NotFoundException("RFQ not found");
      }
      if (rfq.buyerBusinessId !== buyerBusinessId) {
        throw new ForbiddenException(
          "You do not have permission to award this RFQ",
        );
      }
      if (rfq.status === RfqStatus.AWARDED || rfq.awardedQuotationId) {
        throw new ConflictException("RFQ has already been awarded");
      }
      if (
        rfq.status !== RfqStatus.PUBLISHED &&
        rfq.status !== RfqStatus.RESPONSES_RECEIVED &&
        rfq.status !== RfqStatus.UNDER_NEGOTIATION
      ) {
        throw new BadRequestException(
          `Cannot award RFQ with current status: ${rfq.status}`,
        );
      }

      // 2. Fetch winning quotation
      const quotation = await tx.sourcingQuotation.findUnique({
        where: { id: quotationId },
        include: { supplierBusiness: true },
      });
      if (!quotation || quotation.rfqId !== rfqId) {
        throw new NotFoundException(
          "Quotation not found for the specified RFQ",
        );
      }
      if (
        quotation.status !== QuotationStatus.SUBMITTED &&
        quotation.status !== QuotationStatus.REVISED
      ) {
        throw new BadRequestException(
          `Cannot accept quotation with status ${quotation.status}`,
        );
      }
      if (new Date() > new Date(quotation.validityUntil)) {
        throw new BadRequestException(
          "Selected quotation has expired and cannot be awarded",
        );
      }

      // 3. Mark winning quotation as ACCEPTED
      await tx.sourcingQuotation.update({
        where: { id: quotationId },
        data: { status: QuotationStatus.ACCEPTED },
      });

      // 4. Mark all other competing quotes for this RFQ as REJECTED
      await tx.sourcingQuotation.updateMany({
        where: {
          rfqId,
          id: { not: quotationId },
          status: { in: [QuotationStatus.SUBMITTED, QuotationStatus.REVISED] },
        },
        data: { status: QuotationStatus.REJECTED },
      });

      // 5. Update RFQ to AWARDED
      await tx.sourcingRfq.update({
        where: { id: rfqId },
        data: {
          status: RfqStatus.AWARDED,
          awardedQuotationId: quotationId,
        },
      });

      this.logger.info(
        `RFQ awarded: ${rfq.rfqNumber} -> Quotation ${quotation.quoteNumber} (Supplier: ${quotation.supplierBusiness.tradeName})`,
        {
          rfqId,
          quotationId,
          buyerBusinessId,
          supplierBusinessId: quotation.supplierBusinessId,
        },
      );

      // 6. Audit logging
      await this.auditService.log({
        userId,
        businessId: buyerBusinessId,
        action: "RFQ_AWARDED",
        resource: `SourcingRfq:${rfqId}`,
        payload: {
          rfqNumber: rfq.rfqNumber,
          quotationId,
          quoteNumber: quotation.quoteNumber,
          supplierBusinessId: quotation.supplierBusinessId,
          awardedUnitPrice: Number(quotation.unitPrice),
          awardedTotalAmount: Number(quotation.totalAmount),
        },
      });

      await this.auditService.log({
        userId,
        businessId: quotation.supplierBusinessId,
        action: "QUOTATION_ACCEPTED",
        resource: `SourcingQuotation:${quotationId}`,
        payload: {
          rfqId,
          quoteNumber: quotation.quoteNumber,
          awardedTotalAmount: Number(quotation.totalAmount),
        },
      });

      return this.getRfqDetail(buyerBusinessId, rfqId);
    });
  }

  /**
   * List RFQs raised by the caller's business
   */
  async listMyRfqs(
    buyerBusinessId: string,
    query: RfqQueryInput,
  ): Promise<{
    items: SourcingRfqSummaryDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SourcingRfqWhereInput = {
      buyerBusinessId,
      ...(query.status ? { status: query.status as unknown as RfqStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { rfqNumber: { contains: query.q, mode: "insensitive" } },
              {
                masterProduct: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
              {
                masterProduct: {
                  partNumber: { contains: query.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [rfqs, total] = await Promise.all([
      prisma.sourcingRfq.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          buyerBusiness: true,
          masterProduct: { include: { brand: true, category: true } },
          _count: { select: { quotations: true } },
        },
      }),
      prisma.sourcingRfq.count({ where }),
    ]);

    return {
      items: rfqs.map((rfq) => this.toSummaryDto(rfq)),
      total,
      page,
      limit,
    };
  }

  /**
   * Discover open RFQs available to the calling supplier
   */
  async discoverOpenRfqs(
    supplierBusinessId: string,
    query: RfqQueryInput,
  ): Promise<{
    items: SourcingRfqSummaryDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.SourcingRfqWhereInput = {
      // Exclude RFQs created by self
      buyerBusinessId: { not: supplierBusinessId },
      // Must be open
      status: {
        in: [
          RfqStatus.PUBLISHED,
          RfqStatus.RESPONSES_RECEIVED,
          RfqStatus.UNDER_NEGOTIATION,
        ],
      },
      // Must not be expired
      expiresAt: { gte: now },
      ...(query.status ? { status: query.status as unknown as RfqStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { rfqNumber: { contains: query.q, mode: "insensitive" } },
              {
                masterProduct: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
              {
                masterProduct: {
                  partNumber: { contains: query.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      // Open to all OR explicitly invited
      OR: [
        { invitedSuppliers: { none: {} } },
        { invitedSuppliers: { some: { supplierBusinessId } } },
      ],
    };

    const [rfqs, total] = await Promise.all([
      prisma.sourcingRfq.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          buyerBusiness: true,
          masterProduct: { include: { brand: true, category: true } },
          _count: { select: { quotations: true } },
        },
      }),
      prisma.sourcingRfq.count({ where }),
    ]);

    return {
      items: rfqs.map((rfq) => this.toSummaryDto(rfq)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get detailed RFQ record
   */
  async getRfqDetail(
    businessId: string,
    rfqId: string,
  ): Promise<SourcingRfqDetailDto> {
    const rfq = await prisma.sourcingRfq.findUnique({
      where: { id: rfqId },
      include: {
        buyerBusiness: true,
        createdBy: true,
        masterProduct: { include: { brand: true, category: true } },
        invitedSuppliers: { include: { supplierBusiness: true } },
        awardedQuotation: { include: { supplierBusiness: true } },
        _count: { select: { quotations: true } },
      },
    });

    if (!rfq) {
      throw new NotFoundException("RFQ not found");
    }

    const summary = this.toSummaryDto(rfq);

    // If caller is the buyer business, they see invited suppliers and full awarded quote details
    // If caller is an external supplier, sanitize invited suppliers list
    const isBuyer = rfq.buyerBusinessId === businessId;
    const isGlobalAdmin = businessId === "00000000-0000-0000-0000-000000000000";

    // Confidentiality check for non-buyer external suppliers:
    if (!isBuyer && !isGlobalAdmin) {
      if (rfq.status === RfqStatus.DRAFT) {
        throw new ForbiddenException(
          "Draft RFQs are private to the buyer and not accessible to external suppliers",
        );
      }
      if (
        rfq.invitedSuppliers.length > 0 &&
        !rfq.invitedSuppliers.some(
          (inv) => inv.supplierBusinessId === businessId,
        )
      ) {
        throw new ForbiddenException(
          "This is a private RFQ and your business is not on the invited suppliers list",
        );
      }
    }

    let awardedQuoteSummary: SourcingRfqDetailDto["awardedQuotation"] = null;
    if (rfq.awardedQuotation) {
      // Awarded quote details visible to buyer or the winning supplier
      if (isBuyer || rfq.awardedQuotation.supplierBusinessId === businessId) {
        awardedQuoteSummary = {
          id: rfq.awardedQuotation.id,
          quoteNumber: rfq.awardedQuotation.quoteNumber,
          rfqId: rfq.awardedQuotation.rfqId,
          supplierBusinessId: rfq.awardedQuotation.supplierBusinessId,
          supplierBusinessName:
            rfq.awardedQuotation.supplierBusiness.tradeName ||
            rfq.awardedQuotation.supplierBusiness.legalName,
          submittedById: rfq.awardedQuotation.submittedById,
          unitPrice: Number(rfq.awardedQuotation.unitPrice),
          totalAmount: Number(rfq.awardedQuotation.totalAmount),
          availableQuantity: rfq.awardedQuotation.availableQuantity,
          minimumOrderQuantity: rfq.awardedQuotation.minimumOrderQuantity,
          leadTimeDays: rfq.awardedQuotation.leadTimeDays,
          validityUntil: rfq.awardedQuotation.validityUntil.toISOString(),
          status: rfq.awardedQuotation
            .status as unknown as import("@asn/types").QuotationStatus,
          revision: rfq.awardedQuotation.revision,
          isExpired: new Date() > new Date(rfq.awardedQuotation.validityUntil),
          createdAt: rfq.awardedQuotation.createdAt.toISOString(),
          updatedAt: rfq.awardedQuotation.updatedAt.toISOString(),
        };
      }
    }

    return {
      ...summary,
      createdById: rfq.createdById,
      createdByName:
        `${rfq.createdBy.firstName || ""} ${rfq.createdBy.lastName || ""}`.trim(),
      deliveryAddress: rfq.deliveryAddress,
      deliveryPostalCode: rfq.deliveryPostalCode,
      notes: rfq.notes,
      categoryName: rfq.masterProduct.category.name,
      invitedSuppliers: isBuyer
        ? rfq.invitedSuppliers.map((inv) => ({
            supplierBusinessId: inv.supplierBusinessId,
            tradeName:
              inv.supplierBusiness.tradeName || inv.supplierBusiness.legalName,
            invitedAt: inv.invitedAt.toISOString(),
          }))
        : [],
      awardedQuotation: awardedQuoteSummary,
    };
  }

  /**
   * Discover eligible suppliers for a given MasterProduct
   */
  async discoverEligibleSuppliers(
    buyerBusinessId: string,
    masterProductId: string,
  ): Promise<EligibleSupplierDto[]> {
    // Verified automotive distributors/wholesalers/manufacturers
    const suppliers = await prisma.business.findMany({
      where: {
        id: { not: buyerBusinessId },
        verificationStatus: "VERIFIED",
        isActive: true,
        businessType: {
          in: ["DISTRIBUTOR", "WHOLESALER", "MANUFACTURER"],
        },
      },
      include: {
        addresses: { where: { isDefault: true }, take: 1 },
        supplierProducts: {
          where: { masterProductId },
          include: {
            warehouseInventories: true,
          },
        },
      },
    });

    return suppliers.map((sup) => {
      const listing = sup.supplierProducts[0];
      const hasListingForProduct = Boolean(listing);
      const availableStock = listing
        ? listing.warehouseInventories.reduce(
            (sum, item) => sum + item.availableQuantity,
            0,
          )
        : 0;

      const primaryAddress = sup.addresses[0];

      return {
        businessId: sup.id,
        legalName: sup.legalName,
        tradeName: sup.tradeName,
        businessType: sup.businessType as unknown as BusinessType,
        isVerified: sup.verificationStatus === "VERIFIED",
        city: primaryAddress?.city || null,
        state: primaryAddress?.state || null,
        hasListingForProduct,
        availableStock,
      };
    });
  }

  /**
   * Quotation Comparison Matrix (Buyer-Only)
   */
  async compareQuotations(
    buyerBusinessId: string,
    rfqId: string,
  ): Promise<RfqComparisonDto> {
    const isGlobalAdmin =
      buyerBusinessId === "00000000-0000-0000-0000-000000000000";
    const rfq = await this.getRfqDetail(buyerBusinessId, rfqId);

    // STRICT CONFIDENTIALITY: Only the RFQ buyer (or Super Admin) can view competing quotations
    if (
      rfq.buyerBusinessId &&
      rfq.buyerBusinessId !== buyerBusinessId &&
      !isGlobalAdmin
    ) {
      throw new ForbiddenException(
        "Access denied: Commercial quotation comparisons are strictly confidential to the buyer who raised the RFQ",
      );
    }

    const quotes = await prisma.sourcingQuotation.findMany({
      where: { rfqId },
      include: { supplierBusiness: true },
      orderBy: { unitPrice: "asc" },
    });

    if (quotes.length === 0) {
      return {
        rfq,
        quotations: [],
        lowestUnitPrice: null,
        fastestLeadTimeDays: null,
      };
    }

    const lowestUnitPrice = Math.min(...quotes.map((q) => Number(q.unitPrice)));
    const fastestLeadTimeDays = Math.min(...quotes.map((q) => q.leadTimeDays));

    const items: RfqComparisonItemDto[] = quotes.map((q) => {
      const unitPrice = Number(q.unitPrice);
      const totalAmount = Number(q.totalAmount);

      let priceDeltaVsTargetPercent: number | null = null;
      if (rfq.targetPrice && rfq.targetPrice > 0) {
        priceDeltaVsTargetPercent = Number(
          (((unitPrice - rfq.targetPrice) / rfq.targetPrice) * 100).toFixed(2),
        );
      }

      return {
        quotationId: q.id,
        quoteNumber: q.quoteNumber,
        supplierBusinessId: q.supplierBusinessId,
        supplierName:
          q.supplierBusiness.tradeName || q.supplierBusiness.legalName,
        unitPrice,
        totalAmount,
        availableQuantity: q.availableQuantity,
        minimumOrderQuantity: q.minimumOrderQuantity,
        leadTimeDays: q.leadTimeDays,
        validityUntil: q.validityUntil.toISOString(),
        status: q.status as unknown as import("@asn/types").QuotationStatus,
        revision: q.revision,
        priceDeltaVsTargetPercent,
        isBestPrice: unitPrice === lowestUnitPrice,
        isFastestDelivery: q.leadTimeDays === fastestLeadTimeDays,
      };
    });

    return {
      rfq,
      quotations: items,
      lowestUnitPrice,
      fastestLeadTimeDays,
    };
  }
}
