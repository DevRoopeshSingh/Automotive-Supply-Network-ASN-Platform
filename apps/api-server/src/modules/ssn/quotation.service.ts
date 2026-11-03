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
import {
  SubmitQuotationInput,
  ReviseQuotationInput,
  QuotationQueryInput,
} from "@asn/validators";
import {
  SourcingQuotationSummaryDto,
  SourcingQuotationDetailDto,
} from "@asn/types";

@Injectable()
export class QuotationService {
  private readonly logger = createLogger("QuotationService");

  constructor(private readonly auditService: AuditService) {}

  /**
   * Helper: Generate unique quote number e.g. QT-2026-48291
   */
  private generateQuoteNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `QT-${year}-${random}`;
  }

  /**
   * Helper: Map Prisma SourcingQuotation to Summary DTO
   */
  private toSummaryDto(
    quotation: Prisma.SourcingQuotationGetPayload<{
      include: {
        supplierBusiness: true;
      };
    }>,
  ): SourcingQuotationSummaryDto {
    const isExpired =
      quotation.status !== QuotationStatus.ACCEPTED &&
      quotation.status !== QuotationStatus.REJECTED &&
      new Date() > new Date(quotation.validityUntil);

    return {
      id: quotation.id,
      quoteNumber: quotation.quoteNumber,
      rfqId: quotation.rfqId,
      supplierBusinessId: quotation.supplierBusinessId,
      supplierBusinessName:
        quotation.supplierBusiness.tradeName ||
        quotation.supplierBusiness.legalName,
      submittedById: quotation.submittedById,
      unitPrice: Number(quotation.unitPrice),
      totalAmount: Number(quotation.totalAmount),
      availableQuantity: quotation.availableQuantity,
      minimumOrderQuantity: quotation.minimumOrderQuantity,
      leadTimeDays: quotation.leadTimeDays,
      validityUntil: quotation.validityUntil.toISOString(),
      status:
        quotation.status as unknown as import("@asn/types").QuotationStatus,
      revision: quotation.revision,
      isExpired,
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString(),
    };
  }

  /**
   * Submit a wholesale quotation for an open RFQ
   */
  async submitQuotation(
    supplierBusinessId: string,
    submittedById: string,
    input: SubmitQuotationInput,
  ): Promise<SourcingQuotationDetailDto> {
    // 1. Verify supplier business exists, is active, verified, and eligible
    const supplier = await prisma.business.findUnique({
      where: { id: supplierBusinessId },
    });
    if (!supplier) {
      throw new NotFoundException("Supplier business not found");
    }
    if (supplier.verificationStatus !== "VERIFIED") {
      throw new BadRequestException(
        "Only verified suppliers can submit wholesale quotations",
      );
    }
    if (
      !["DISTRIBUTOR", "WHOLESALER", "MANUFACTURER"].includes(
        supplier.businessType,
      )
    ) {
      throw new BadRequestException(
        "Only distributors, wholesalers, or manufacturers can submit wholesale quotations",
      );
    }

    // 2. Fetch RFQ
    const rfq = await prisma.sourcingRfq.findUnique({
      where: { id: input.rfqId },
      include: { invitedSuppliers: true },
    });
    if (!rfq) {
      throw new NotFoundException("RFQ not found");
    }

    // Business rule: Supplier cannot bid on their own RFQ
    if (rfq.buyerBusinessId === supplierBusinessId) {
      throw new BadRequestException(
        "Suppliers cannot submit quotations to their own RFQ",
      );
    }

    // RFQ must be active/open
    if (
      rfq.status !== RfqStatus.PUBLISHED &&
      rfq.status !== RfqStatus.RESPONSES_RECEIVED &&
      rfq.status !== RfqStatus.UNDER_NEGOTIATION
    ) {
      throw new BadRequestException(
        `Cannot submit quotation. RFQ is in '${rfq.status}' status`,
      );
    }

    // Check expiration
    if (new Date() >= new Date(rfq.expiresAt)) {
      throw new BadRequestException(
        "RFQ has expired. No new quotations can be accepted",
      );
    }

    // Check private invitation list
    if (rfq.invitedSuppliers.length > 0) {
      const isInvited = rfq.invitedSuppliers.some(
        (inv) => inv.supplierBusinessId === supplierBusinessId,
      );
      if (!isInvited) {
        throw new ForbiddenException(
          "This RFQ is invitation-only and your business was not invited",
        );
      }
    }

    // 3. Check for existing quote by this supplier
    const existingQuote = await prisma.sourcingQuotation.findUnique({
      where: {
        rfqId_supplierBusinessId: {
          rfqId: input.rfqId,
          supplierBusinessId,
        },
      },
    });
    if (existingQuote) {
      throw new ConflictException(
        "A quotation from your business already exists for this RFQ. Use the revision endpoint to submit updated pricing",
      );
    }

    // 4. Validate validity date
    const validityUntil = new Date(input.validityUntil);
    if (validityUntil <= new Date()) {
      throw new BadRequestException(
        "Quotation validity date must be in the future",
      );
    }

    const unitPrice = new Prisma.Decimal(input.unitPrice);
    const totalAmount = new Prisma.Decimal(input.unitPrice * rfq.quantity);
    const quoteNumber = this.generateQuoteNumber();

    // 5. Create quotation and transition RFQ status to RESPONSES_RECEIVED if PUBLISHED
    const createdQuote = await prisma.$transaction(async (tx) => {
      const quote = await tx.sourcingQuotation.create({
        data: {
          quoteNumber,
          rfqId: input.rfqId,
          supplierBusinessId,
          submittedById,
          unitPrice,
          totalAmount,
          availableQuantity: input.availableQuantity,
          minimumOrderQuantity: input.minimumOrderQuantity || 1,
          leadTimeDays: input.leadTimeDays,
          validityUntil,
          status: QuotationStatus.SUBMITTED,
          revision: 1,
          terms: input.terms,
          notes: input.notes,
        },
        include: {
          supplierBusiness: true,
          revisions: true,
        },
      });

      if (rfq.status === RfqStatus.PUBLISHED) {
        await tx.sourcingRfq.update({
          where: { id: input.rfqId },
          data: { status: RfqStatus.RESPONSES_RECEIVED },
        });
      }

      return quote;
    });

    this.logger.info(
      `Quotation submitted: ${createdQuote.quoteNumber} by ${supplier.tradeName} for RFQ ${rfq.rfqNumber}`,
      { quotationId: createdQuote.id, rfqId: input.rfqId, supplierBusinessId },
    );

    // 6. Audit log
    await this.auditService.log({
      userId: submittedById,
      businessId: supplierBusinessId,
      action: "QUOTATION_SUBMITTED",
      resource: `SourcingQuotation:${createdQuote.id}`,
      payload: {
        quoteNumber: createdQuote.quoteNumber,
        rfqId: input.rfqId,
        unitPrice: input.unitPrice,
        totalAmount: Number(totalAmount),
        availableQuantity: input.availableQuantity,
        leadTimeDays: input.leadTimeDays,
      },
    });

    return this.getQuotationById(supplierBusinessId, createdQuote.id);
  }

  /**
   * Revise an existing quotation
   */
  async reviseQuotation(
    supplierBusinessId: string,
    userId: string,
    quotationId: string,
    input: ReviseQuotationInput,
  ): Promise<SourcingQuotationDetailDto> {
    const quotation = await prisma.sourcingQuotation.findUnique({
      where: { id: quotationId },
      include: { rfq: true, supplierBusiness: true },
    });

    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }
    if (quotation.supplierBusinessId !== supplierBusinessId) {
      throw new ForbiddenException(
        "You do not have permission to revise this quotation",
      );
    }
    if (
      quotation.status !== QuotationStatus.SUBMITTED &&
      quotation.status !== QuotationStatus.REVISED
    ) {
      throw new BadRequestException(
        `Cannot revise quotation with status ${quotation.status}`,
      );
    }
    if (
      quotation.rfq.status === RfqStatus.AWARDED ||
      quotation.rfq.status === RfqStatus.CANCELLED ||
      quotation.rfq.status === RfqStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot revise quotation. RFQ is in '${quotation.rfq.status}' status`,
      );
    }
    if (new Date() >= new Date(quotation.rfq.expiresAt)) {
      throw new BadRequestException("Cannot revise quotation. RFQ has expired");
    }

    const validityUntil = new Date(input.validityUntil);
    if (validityUntil <= new Date()) {
      throw new BadRequestException(
        "Quotation validity date must be in the future",
      );
    }

    const newUnitPrice = new Prisma.Decimal(input.unitPrice);
    const newTotalAmount = new Prisma.Decimal(
      input.unitPrice * quotation.rfq.quantity,
    );
    const nextRevision = quotation.revision + 1;

    // Atomically archive current values as a revision and update quotation
    const updatedQuote = await prisma.$transaction(async (tx) => {
      // 1. Snapshot prior values into QuotationRevision
      await tx.quotationRevision.create({
        data: {
          quotationId: quotation.id,
          revisionNumber: quotation.revision,
          unitPrice: quotation.unitPrice,
          totalAmount: quotation.totalAmount,
          availableQuantity: quotation.availableQuantity,
          minimumOrderQuantity: quotation.minimumOrderQuantity,
          leadTimeDays: quotation.leadTimeDays,
          validityUntil: quotation.validityUntil,
          notes: quotation.notes,
        },
      });

      // 2. Update quotation with new terms & pricing
      const updated = await tx.sourcingQuotation.update({
        where: { id: quotationId },
        data: {
          unitPrice: newUnitPrice,
          totalAmount: newTotalAmount,
          availableQuantity: input.availableQuantity,
          minimumOrderQuantity: input.minimumOrderQuantity || 1,
          leadTimeDays: input.leadTimeDays,
          validityUntil,
          status: QuotationStatus.REVISED,
          revision: nextRevision,
          terms: input.terms ?? quotation.terms,
          notes: input.notes ?? quotation.notes,
        },
        include: {
          supplierBusiness: true,
          revisions: true,
        },
      });

      return updated;
    });

    this.logger.info(
      `Quotation revised: ${updatedQuote.quoteNumber} (Rev ${nextRevision}) by ${quotation.supplierBusiness.tradeName}`,
      { quotationId, revision: nextRevision, supplierBusinessId },
    );

    // Audit log
    await this.auditService.log({
      userId,
      businessId: supplierBusinessId,
      action: "QUOTATION_REVISED",
      resource: `SourcingQuotation:${quotationId}`,
      payload: {
        quoteNumber: updatedQuote.quoteNumber,
        previousRevision: quotation.revision,
        newRevision: nextRevision,
        newUnitPrice: input.unitPrice,
        newTotalAmount: Number(newTotalAmount),
        leadTimeDays: input.leadTimeDays,
      },
    });

    return this.getQuotationById(supplierBusinessId, quotationId);
  }

  /**
   * Withdraw quotation prior to award
   */
  async withdrawQuotation(
    supplierBusinessId: string,
    userId: string,
    quotationId: string,
    reason?: string,
  ): Promise<SourcingQuotationDetailDto> {
    const quotation = await prisma.sourcingQuotation.findUnique({
      where: { id: quotationId },
      include: { rfq: true },
    });

    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }
    if (quotation.supplierBusinessId !== supplierBusinessId) {
      throw new ForbiddenException(
        "You do not have permission to withdraw this quotation",
      );
    }
    if (
      quotation.status !== QuotationStatus.SUBMITTED &&
      quotation.status !== QuotationStatus.REVISED
    ) {
      throw new BadRequestException(
        `Cannot withdraw quotation with status ${quotation.status}`,
      );
    }
    if (quotation.rfq.status === RfqStatus.AWARDED) {
      throw new BadRequestException(
        "Cannot withdraw an already awarded quotation",
      );
    }

    await prisma.sourcingQuotation.update({
      where: { id: quotationId },
      data: { status: QuotationStatus.WITHDRAWN },
    });

    this.logger.info(
      `Quotation withdrawn: ${quotation.quoteNumber} (${quotationId})`,
      { supplierBusinessId, reason },
    );

    await this.auditService.log({
      userId,
      businessId: supplierBusinessId,
      action: "QUOTATION_WITHDRAWN",
      resource: `SourcingQuotation:${quotationId}`,
      payload: { quoteNumber: quotation.quoteNumber, reason },
    });

    return this.getQuotationById(supplierBusinessId, quotationId);
  }

  /**
   * Get quotation detail with strict confidentiality guard
   * Only the RFQ buyer or the responding supplier may inspect this quotation.
   */
  async getQuotationById(
    businessId: string,
    quotationId: string,
  ): Promise<SourcingQuotationDetailDto> {
    const quotation = await prisma.sourcingQuotation.findUnique({
      where: { id: quotationId },
      include: {
        supplierBusiness: true,
        rfq: true,
        revisions: { orderBy: { revisionNumber: "asc" } },
      },
    });

    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }

    // STRICT CONFIDENTIALITY:
    // Only the buyer who raised the RFQ or the responding supplier business can view this quote
    const isBuyer = quotation.rfq.buyerBusinessId === businessId;
    const isSupplier = quotation.supplierBusinessId === businessId;

    if (!isBuyer && !isSupplier) {
      throw new ForbiddenException(
        "Access denied: Commercial quotation details are strictly confidential between the buyer and the responding supplier",
      );
    }

    const summary = this.toSummaryDto(quotation);

    return {
      ...summary,
      terms: quotation.terms,
      notes: quotation.notes,
      revisions: quotation.revisions.map((rev) => ({
        id: rev.id,
        quotationId: rev.quotationId,
        revisionNumber: rev.revisionNumber,
        unitPrice: Number(rev.unitPrice),
        totalAmount: Number(rev.totalAmount),
        availableQuantity: rev.availableQuantity,
        minimumOrderQuantity: rev.minimumOrderQuantity,
        leadTimeDays: rev.leadTimeDays,
        validityUntil: rev.validityUntil.toISOString(),
        notes: rev.notes,
        createdAt: rev.createdAt.toISOString(),
      })),
    };
  }

  /**
   * List quotations for an RFQ with strict confidentiality:
   * - If caller is the RFQ buyer: returns all submitted quotations
   * - If caller is an external supplier: returns ONLY their own quotation (or empty array)
   */
  async listQuotationsForRfq(
    businessId: string,
    rfqId: string,
  ): Promise<SourcingQuotationSummaryDto[]> {
    const rfq = await prisma.sourcingRfq.findUnique({
      where: { id: rfqId },
    });
    if (!rfq) {
      throw new NotFoundException("RFQ not found");
    }

    const isBuyer = rfq.buyerBusinessId === businessId;

    const where: Prisma.SourcingQuotationWhereInput = {
      rfqId,
      ...(isBuyer ? {} : { supplierBusinessId: businessId }),
    };

    const quotes = await prisma.sourcingQuotation.findMany({
      where,
      include: { supplierBusiness: true },
      orderBy: { unitPrice: "asc" },
    });

    return quotes.map((q) => this.toSummaryDto(q));
  }

  /**
   * List quotations submitted by the calling supplier
   */
  async listMySubmittedQuotations(
    supplierBusinessId: string,
    query: QuotationQueryInput,
  ): Promise<{
    items: SourcingQuotationSummaryDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SourcingQuotationWhereInput = {
      supplierBusinessId,
      ...(query.rfqId ? { rfqId: query.rfqId } : {}),
      ...(query.status
        ? { status: query.status as unknown as QuotationStatus }
        : {}),
    };

    const [quotes, total] = await Promise.all([
      prisma.sourcingQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { supplierBusiness: true },
      }),
      prisma.sourcingQuotation.count({ where }),
    ]);

    return {
      items: quotes.map((q) => this.toSummaryDto(q)),
      total,
      page,
      limit,
    };
  }
}
