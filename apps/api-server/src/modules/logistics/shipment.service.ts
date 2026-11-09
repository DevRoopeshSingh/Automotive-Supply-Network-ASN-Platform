import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import {
  prisma,
  ShipmentStatus,
  LegType,
  LegStatus,
  ShipmentEventType,
  QuotationStatus,
  Prisma,
} from "@asn/database";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import {
  CreateShipmentInput,
  UpdateShipmentStatusInput,
  SubmitProofOfDeliveryInput,
  RecordFailedDeliveryInput,
  AssignProviderInput,
  AddTrackingEventInput,
  ShipmentQueryInput,
} from "@asn/validators";
import {
  ShipmentSummaryDto,
  ShipmentDetailDto,
  ShipmentItemDto,
  ShipmentLegDto,
  ShipmentTrackingEventDto,
  ProofOfDeliveryDto,
} from "@asn/types";

// State machine definition for valid lifecycle transitions
const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.DRAFT]: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.CREATED]: [
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKUP_SCHEDULED]: [
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKED_UP]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.OUT_FOR_DELIVERY,
  ],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELIVERY_FAILED,
  ],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERY_FAILED,
  ],
  [ShipmentStatus.DELIVERY_FAILED]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.RETURN_INITIATED,
  ],
  [ShipmentStatus.RETURN_INITIATED]: [ShipmentStatus.RETURNED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: [],
  [ShipmentStatus.RETURNED]: [],
};

@Injectable()
export class ShipmentService {
  private readonly logger = createLogger("ShipmentService");

  constructor(private readonly auditService: AuditService) {}

  /**
   * Helper: Generate unique human-readable shipment tracking number
   */
  private generateShipmentNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `SHP-${year}-${random}`;
  }

  /**
   * Helper: Transform Prisma Shipment to Summary DTO
   */
  private toSummaryDto(
    shipment: Prisma.ShipmentGetPayload<{
      include: {
        senderBusiness: true;
        receiverBusiness: true;
        _count: { select: { items: true; legs: true } };
      };
    }>,
  ): ShipmentSummaryDto {
    return {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      senderBusinessId: shipment.senderBusinessId,
      senderBusinessName:
        shipment.senderBusiness.tradeName || shipment.senderBusiness.legalName,
      receiverBusinessId: shipment.receiverBusinessId,
      receiverBusinessName:
        shipment.receiverBusiness.tradeName ||
        shipment.receiverBusiness.legalName,
      sourcingRfqId: shipment.sourcingRfqId,
      sourcingQuotationId: shipment.sourcingQuotationId,
      orderId: shipment.orderId,
      status: shipment.status as unknown as import("@asn/types").ShipmentStatus,
      pickupCity: shipment.pickupCity,
      pickupState: shipment.pickupState,
      deliveryCity: shipment.deliveryCity,
      deliveryState: shipment.deliveryState,
      scheduledPickupAt: shipment.scheduledPickupAt?.toISOString() || null,
      actualPickupAt: shipment.actualPickupAt?.toISOString() || null,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString() || null,
      actualDeliveryAt: shipment.actualDeliveryAt?.toISOString() || null,
      currentLocation: shipment.currentLocation,
      totalItemsCount: shipment._count.items,
      totalLegsCount: shipment._count.legs,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }

  /**
   * Helper: Transform full Prisma Shipment to Detail DTO
   */
  private toDetailDto(
    shipment: Prisma.ShipmentGetPayload<{
      include: {
        senderBusiness: true;
        receiverBusiness: true;
        pickupWarehouse: true;
        items: {
          include: { masterProduct: { include: { brand: true } } };
        };
        legs: {
          include: { assignedProvider: true };
        };
        trackingEvents: true;
        proofOfDelivery: true;
        _count: { select: { items: true; legs: true } };
      };
    }>,
  ): ShipmentDetailDto {
    const summary = this.toSummaryDto(shipment);

    const items: ShipmentItemDto[] = shipment.items.map((item) => ({
      id: item.id,
      shipmentId: item.shipmentId,
      masterProductId: item.masterProductId,
      productName: item.masterProduct.name,
      partNumber: item.masterProduct.partNumber,
      brandName: item.masterProduct.brand?.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
      totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      sku: item.sku,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
    }));

    const legs: ShipmentLegDto[] = shipment.legs.map((leg) => ({
      id: leg.id,
      shipmentId: leg.shipmentId,
      legSequence: leg.legSequence,
      legType: leg.legType as unknown as import("@asn/types").LegType,
      status: leg.status as unknown as import("@asn/types").LegStatus,
      originFacilityName: leg.originFacilityName,
      originAddress: leg.originAddress,
      originCity: leg.originCity,
      originState: leg.originState,
      originPostalCode: leg.originPostalCode,
      destinationFacilityName: leg.destinationFacilityName,
      destinationAddress: leg.destinationAddress,
      destinationCity: leg.destinationCity,
      destinationState: leg.destinationState,
      destinationPostalCode: leg.destinationPostalCode,
      assignedProviderId: leg.assignedProviderId,
      assignedProviderName: leg.assignedProvider?.name || null,
      trackingNumber: leg.trackingNumber,
      plannedDepartureAt: leg.plannedDepartureAt?.toISOString() || null,
      actualDepartureAt: leg.actualDepartureAt?.toISOString() || null,
      plannedArrivalAt: leg.plannedArrivalAt?.toISOString() || null,
      actualArrivalAt: leg.actualArrivalAt?.toISOString() || null,
      notes: leg.notes,
      createdAt: leg.createdAt.toISOString(),
      updatedAt: leg.updatedAt.toISOString(),
    }));

    const trackingEvents: ShipmentTrackingEventDto[] =
      shipment.trackingEvents.map((evt) => ({
        id: evt.id,
        shipmentId: evt.shipmentId,
        legId: evt.legId,
        eventType:
          evt.eventType as unknown as import("@asn/types").ShipmentEventType,
        location: evt.location,
        notes: evt.notes,
        actorUserId: evt.actorUserId,
        actorName: evt.actorName,
        actorRole: evt.actorRole,
        timestamp: evt.timestamp.toISOString(),
      }));

    let proofOfDelivery: ProofOfDeliveryDto | null = null;
    if (shipment.proofOfDelivery) {
      proofOfDelivery = {
        id: shipment.proofOfDelivery.id,
        shipmentId: shipment.proofOfDelivery.shipmentId,
        recipientName: shipment.proofOfDelivery.recipientName,
        recipientPhone: shipment.proofOfDelivery.recipientPhone,
        deliveryTimestamp:
          shipment.proofOfDelivery.deliveryTimestamp.toISOString(),
        documentUrl: shipment.proofOfDelivery.documentUrl,
        verificationCode: shipment.proofOfDelivery.verificationCode,
        confirmedByUserId: shipment.proofOfDelivery.confirmedByUserId,
        notes: shipment.proofOfDelivery.notes,
        createdAt: shipment.proofOfDelivery.createdAt.toISOString(),
      };
    }

    return {
      ...summary,
      pickupAddress: shipment.pickupAddress,
      pickupPostalCode: shipment.pickupPostalCode,
      pickupWarehouseId: shipment.pickupWarehouseId,
      pickupWarehouseName: shipment.pickupWarehouse?.name || null,
      deliveryAddress: shipment.deliveryAddress,
      deliveryPostalCode: shipment.deliveryPostalCode,
      deliveryContactName: shipment.deliveryContactName,
      deliveryContactPhone: shipment.deliveryContactPhone,
      totalWeightKg: shipment.totalWeightKg,
      totalVolumeCbm: shipment.totalVolumeCbm,
      declaredValue: shipment.declaredValue
        ? Number(shipment.declaredValue)
        : null,
      deliveryFailureReason: shipment.deliveryFailureReason,
      deliveryAttemptCount: shipment.deliveryAttemptCount,
      notes: shipment.notes,
      items,
      legs,
      trackingEvents,
      proofOfDelivery,
    };
  }

  /**
   * Create a new shipment with multi-leg delivery planning
   */
  async createShipment(
    senderBusinessId: string,
    userId: string,
    input: CreateShipmentInput,
  ): Promise<ShipmentDetailDto> {
    // 1. Validate sender business
    const sender = await prisma.business.findUnique({
      where: { id: senderBusinessId },
    });
    if (!sender) {
      throw new NotFoundException("Sender business not found");
    }
    if (sender.verificationStatus !== "VERIFIED") {
      throw new BadRequestException(
        "Only verified businesses can dispatch shipments",
      );
    }

    // 2. Validate receiver business
    const receiver = await prisma.business.findUnique({
      where: { id: input.receiverBusinessId },
    });
    if (!receiver) {
      throw new NotFoundException("Receiver business not found");
    }
    if (senderBusinessId === input.receiverBusinessId) {
      throw new BadRequestException(
        "Sender and receiver business cannot be identical",
      );
    }

    // 2b. Validate referenced Sourcing Quotation & RFQ (if specified)
    if (input.sourcingQuotationId) {
      const quote = await prisma.sourcingQuotation.findUnique({
        where: { id: input.sourcingQuotationId },
        include: { rfq: true },
      });
      if (!quote) {
        throw new NotFoundException(
          `Referenced sourcing quotation '${input.sourcingQuotationId}' not found`,
        );
      }
      if (quote.supplierBusinessId !== senderBusinessId) {
        throw new ForbiddenException(
          "Referenced sourcing quotation does not belong to sender business",
        );
      }
      if (quote.status !== QuotationStatus.ACCEPTED) {
        throw new BadRequestException(
          `Cannot create shipment for quotation with status '${quote.status}'. Quotation must be ACCEPTED.`,
        );
      }
      if (input.receiverBusinessId !== quote.rfq.buyerBusinessId) {
        throw new BadRequestException(
          "Receiver business must match the buyer business that raised the RFQ",
        );
      }
      if (input.sourcingRfqId && input.sourcingRfqId !== quote.rfqId) {
        throw new BadRequestException(
          "sourcingRfqId does not match the RFQ linked to the quotation",
        );
      }

      // Concurrency & Duplicate Prevention: Verify no active shipment exists for this quotation
      if (typeof prisma.shipment?.findFirst === "function") {
        const existingShipment = await prisma.shipment.findFirst({
          where: {
            sourcingQuotationId: input.sourcingQuotationId,
            status: {
              notIn: [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERY_FAILED],
            },
          },
        });
        if (existingShipment) {
          throw new ConflictException(
            `An active shipment (${existingShipment.shipmentNumber}) has already been created for this awarded quotation.`,
          );
        }
      }
    }

    // 3. Optional Warehouse verification
    if (input.pickupWarehouseId) {
      const warehouse = await prisma.supplierWarehouse.findUnique({
        where: { id: input.pickupWarehouseId },
      });
      if (!warehouse || warehouse.businessId !== senderBusinessId) {
        throw new BadRequestException(
          "Pickup warehouse does not belong to the sender business",
        );
      }
    }

    // 4. Validate MasterProducts in items
    const productIds = input.items.map((i) => i.masterProductId);
    const existingProducts = await prisma.masterProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (existingProducts.length !== productIds.length) {
      throw new BadRequestException(
        "One or more master product IDs in items are invalid",
      );
    }

    // 5. Validate legs sequencing (if legs provided)
    if (input.legs && input.legs.length > 0) {
      const sortedLegs = [...input.legs].sort(
        (a, b) => a.legSequence - b.legSequence,
      );
      for (let i = 0; i < sortedLegs.length; i++) {
        if (sortedLegs[i]?.legSequence !== i + 1) {
          throw new BadRequestException(
            "Shipment leg sequences must start at 1 and increment sequentially without gaps",
          );
        }
      }
    }

    const shipmentNumber = this.generateShipmentNumber();

    // 6. Create shipment, items, legs, and initial event in an atomic transaction
    const createdShipment = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber,
          senderBusinessId,
          receiverBusinessId: input.receiverBusinessId,
          sourcingRfqId: input.sourcingRfqId,
          sourcingQuotationId: input.sourcingQuotationId,
          orderId: input.orderId,
          status: ShipmentStatus.CREATED,
          pickupAddress: input.pickupAddress,
          pickupCity: input.pickupCity,
          pickupState: input.pickupState,
          pickupPostalCode: input.pickupPostalCode,
          pickupWarehouseId: input.pickupWarehouseId,
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryState: input.deliveryState,
          deliveryPostalCode: input.deliveryPostalCode,
          deliveryContactName: input.deliveryContactName,
          deliveryContactPhone: input.deliveryContactPhone,
          scheduledPickupAt: input.scheduledPickupAt
            ? new Date(input.scheduledPickupAt)
            : null,
          estimatedDeliveryAt: input.estimatedDeliveryAt
            ? new Date(input.estimatedDeliveryAt)
            : null,
          totalWeightKg: input.totalWeightKg,
          totalVolumeCbm: input.totalVolumeCbm,
          declaredValue:
            input.declaredValue !== undefined && input.declaredValue !== null
              ? new Prisma.Decimal(input.declaredValue)
              : null,
          notes: input.notes,
        },
      });

      // Insert shipment items
      await tx.shipmentItem.createMany({
        data: input.items.map((item) => ({
          shipmentId: shipment.id,
          masterProductId: item.masterProductId,
          quantity: item.quantity,
          unitPrice:
            item.unitPrice !== undefined && item.unitPrice !== null
              ? new Prisma.Decimal(item.unitPrice)
              : null,
          totalPrice:
            item.unitPrice !== undefined && item.unitPrice !== null
              ? new Prisma.Decimal(item.unitPrice * item.quantity)
              : null,
          sku: item.sku,
          notes: item.notes,
        })),
      });

      // Insert shipment legs (if none provided, create a direct last-mile delivery leg)
      if (input.legs && input.legs.length > 0) {
        await tx.shipmentLeg.createMany({
          data: input.legs.map((leg) => ({
            shipmentId: shipment.id,
            legSequence: leg.legSequence,
            legType: leg.legType as unknown as LegType,
            status: LegStatus.PENDING,
            originFacilityName: leg.originFacilityName,
            originAddress: leg.originAddress,
            originCity: leg.originCity,
            originState: leg.originState,
            originPostalCode: leg.originPostalCode,
            destinationFacilityName: leg.destinationFacilityName,
            destinationAddress: leg.destinationAddress,
            destinationCity: leg.destinationCity,
            destinationState: leg.destinationState,
            destinationPostalCode: leg.destinationPostalCode,
            assignedProviderId: leg.assignedProviderId,
            trackingNumber: leg.trackingNumber,
            plannedDepartureAt: leg.plannedDepartureAt
              ? new Date(leg.plannedDepartureAt)
              : null,
            plannedArrivalAt: leg.plannedArrivalAt
              ? new Date(leg.plannedArrivalAt)
              : null,
            notes: leg.notes,
          })),
        });
      } else {
        // Direct single-leg delivery
        await tx.shipmentLeg.create({
          data: {
            shipmentId: shipment.id,
            legSequence: 1,
            legType: LegType.LAST_MILE_DELIVERY,
            status: LegStatus.PENDING,
            originFacilityName: "Origin Warehouse/Store",
            originAddress: input.pickupAddress,
            originCity: input.pickupCity,
            originState: input.pickupState,
            originPostalCode: input.pickupPostalCode,
            destinationFacilityName: "Destination Facility/Workshop",
            destinationAddress: input.deliveryAddress,
            destinationCity: input.deliveryCity,
            destinationState: input.deliveryState,
            destinationPostalCode: input.deliveryPostalCode,
          },
        });
      }

      // Initial tracking event
      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: ShipmentEventType.SHIPMENT_CREATED,
          location: `${input.pickupCity}, ${input.pickupState}`,
          notes: "Shipment registered and delivery planned",
          actorUserId: userId,
          actorName: sender.tradeName || sender.legalName,
          actorRole: "SENDER",
        },
      });

      return shipment;
    });

    this.logger.info(
      `Shipment created: ${createdShipment.shipmentNumber} (${createdShipment.id})`,
      { senderBusinessId, receiverBusinessId: input.receiverBusinessId },
    );

    await this.auditService.log({
      userId,
      businessId: senderBusinessId,
      action: "SHIPMENT_CREATED",
      resource: `Shipment:${createdShipment.id}`,
      payload: {
        shipmentNumber: createdShipment.shipmentNumber,
        receiverBusinessId: createdShipment.receiverBusinessId,
        itemsCount: input.items.length,
      },
    });

    return this.getShipmentById(senderBusinessId, createdShipment.id);
  }

  /**
   * Get shipment details with tenant isolation guard
   */
  async getShipmentById(
    callerBusinessId: string,
    shipmentId: string,
  ): Promise<ShipmentDetailDto> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        senderBusiness: true,
        receiverBusiness: true,
        pickupWarehouse: true,
        items: {
          include: { masterProduct: { include: { brand: true } } },
        },
        legs: {
          include: { assignedProvider: true },
          orderBy: { legSequence: "asc" },
        },
        trackingEvents: {
          orderBy: { timestamp: "asc" },
        },
        proofOfDelivery: true,
        _count: { select: { items: true, legs: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException("Shipment not found");
    }

    // Strict Tenant Isolation: Caller must be sender, receiver, or assigned logistics partner
    const isSender = shipment.senderBusinessId === callerBusinessId;
    const isReceiver = shipment.receiverBusinessId === callerBusinessId;
    const isAssignedProvider = shipment.legs.some(
      (leg) => leg.assignedProvider?.businessId === callerBusinessId,
    );

    if (!isSender && !isReceiver && !isAssignedProvider) {
      throw new ForbiddenException(
        "Access denied: You do not have permission to view this shipment",
      );
    }

    return this.toDetailDto(shipment);
  }

  /**
   * List shipments accessible to caller's business with search and pagination
   */
  async listShipments(
    callerBusinessId: string,
    query: ShipmentQueryInput,
  ): Promise<{
    items: ShipmentSummaryDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const isGlobalAdmin =
      callerBusinessId === "00000000-0000-0000-0000-000000000000";

    const where: Prisma.ShipmentWhereInput = {
      ...(isGlobalAdmin
        ? {}
        : {
            OR: [
              { senderBusinessId: callerBusinessId },
              { receiverBusinessId: callerBusinessId },
              {
                legs: {
                  some: {
                    assignedProvider: { businessId: callerBusinessId },
                  },
                },
              },
            ],
          }),
      ...(query.status
        ? { status: query.status as unknown as ShipmentStatus }
        : {}),
      ...(query.senderBusinessId
        ? { senderBusinessId: query.senderBusinessId }
        : {}),
      ...(query.receiverBusinessId
        ? { receiverBusinessId: query.receiverBusinessId }
        : {}),
      ...(query.q
        ? {
            OR: [
              { shipmentNumber: { contains: query.q, mode: "insensitive" } },
              { pickupCity: { contains: query.q, mode: "insensitive" } },
              { deliveryCity: { contains: query.q, mode: "insensitive" } },
              {
                deliveryContactName: {
                  contains: query.q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          senderBusiness: true,
          receiverBusiness: true,
          _count: { select: { items: true, legs: true } },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    return {
      items: shipments.map((s) => this.toSummaryDto(s)),
      total,
      page,
      limit,
    };
  }

  /**
   * Cancel an un-dispatched shipment
   */
  async cancelShipment(
    callerBusinessId: string,
    userId: string,
    shipmentId: string,
    reason?: string,
  ): Promise<ShipmentDetailDto> {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { senderBusiness: true },
      });
      if (!shipment) {
        throw new NotFoundException("Shipment not found");
      }
      if (
        shipment.senderBusinessId !== callerBusinessId &&
        shipment.receiverBusinessId !== callerBusinessId
      ) {
        throw new ForbiddenException(
          "You do not have permission to cancel this shipment",
        );
      }

      if (
        shipment.status !== ShipmentStatus.DRAFT &&
        shipment.status !== ShipmentStatus.CREATED &&
        shipment.status !== ShipmentStatus.PICKUP_SCHEDULED
      ) {
        throw new BadRequestException(
          `Cannot cancel shipment in '${shipment.status}' status. Dispatched shipments cannot be cancelled.`,
        );
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.CANCELLED },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.CANCELLED,
          notes: reason
            ? `Shipment cancelled: ${reason}`
            : "Shipment cancelled by user",
          actorUserId: userId,
          actorRole: "SENDER",
        },
      });

      this.logger.info(`Shipment cancelled: ${updated.shipmentNumber}`, {
        shipmentId,
        callerBusinessId,
      });

      await this.auditService.log({
        userId,
        businessId: callerBusinessId,
        action: "SHIPMENT_CANCELLED",
        resource: `Shipment:${shipmentId}`,
        payload: { shipmentNumber: updated.shipmentNumber, reason },
      });

      return this.getShipmentById(callerBusinessId, shipmentId);
    });
  }

  /**
   * Transition shipment lifecycle status according to the state machine
   */
  async transitionStatus(
    callerBusinessId: string,
    userId: string,
    actorRole: string,
    shipmentId: string,
    input: UpdateShipmentStatusInput,
  ): Promise<ShipmentDetailDto> {
    const targetStatus = input.status as unknown as ShipmentStatus;

    if (targetStatus === ShipmentStatus.DELIVERED) {
      throw new BadRequestException(
        "Direct transition to DELIVERED is not permitted. Confirm delivery with Proof of Delivery via the /proof-of-delivery endpoint.",
      );
    }

    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { legs: { include: { assignedProvider: true } } },
      });
      if (!shipment) {
        throw new NotFoundException("Shipment not found");
      }

      // Check allowed transitions
      const allowed = ALLOWED_TRANSITIONS[shipment.status] || [];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid shipment status transition from '${shipment.status}' to '${targetStatus}'`,
        );
      }

      // Multi-Tenant Isolation & Role Authorization
      const isGlobalAdmin =
        callerBusinessId === "00000000-0000-0000-0000-000000000000";
      const isSender = shipment.senderBusinessId
        ? shipment.senderBusinessId === callerBusinessId
        : true;
      const isReceiver = shipment.receiverBusinessId
        ? shipment.receiverBusinessId === callerBusinessId
        : false;
      const legs = shipment.legs || [];
      const isAssignedProvider = legs.some(
        (leg) => leg.assignedProvider?.businessId === callerBusinessId,
      );

      if (!isSender && !isReceiver && !isAssignedProvider && !isGlobalAdmin) {
        throw new ForbiddenException(
          "Access denied: You do not have permission to transition this shipment",
        );
      }

      // Update timestamps and data based on state
      const updateData: Prisma.ShipmentUpdateInput = {
        status: targetStatus,
        ...(input.location ? { currentLocation: input.location } : {}),
      };

      if (
        targetStatus === ShipmentStatus.PICKED_UP &&
        !shipment.actualPickupAt
      ) {
        updateData.actualPickupAt = new Date();
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: updateData,
      });

      // Map event type
      let eventType: ShipmentEventType = ShipmentEventType.STATUS_UPDATED;
      if (targetStatus === ShipmentStatus.PICKUP_SCHEDULED)
        eventType = ShipmentEventType.PICKUP_SCHEDULED;
      else if (targetStatus === ShipmentStatus.PICKED_UP)
        eventType = ShipmentEventType.PICKED_UP;
      else if (targetStatus === ShipmentStatus.IN_TRANSIT)
        eventType = ShipmentEventType.LEG_STARTED;
      else if (targetStatus === ShipmentStatus.OUT_FOR_DELIVERY)
        eventType = ShipmentEventType.OUT_FOR_DELIVERY;
      else if (targetStatus === ShipmentStatus.RETURN_INITIATED)
        eventType = ShipmentEventType.RETURN_INITIATED;
      else if (targetStatus === ShipmentStatus.RETURNED)
        eventType = ShipmentEventType.RETURNED;

      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId,
          eventType,
          location: input.location || shipment.currentLocation,
          notes: input.notes || `Shipment transitioned to ${targetStatus}`,
          actorUserId: userId,
          actorRole,
        },
      });

      this.logger.info(
        `Shipment ${updated.shipmentNumber} transitioned: ${shipment.status} -> ${targetStatus}`,
        { shipmentId, targetStatus },
      );

      await this.auditService.log({
        userId,
        businessId: callerBusinessId,
        action: "SHIPMENT_STATUS_TRANSITIONED",
        resource: `Shipment:${shipmentId}`,
        payload: {
          shipmentNumber: updated.shipmentNumber,
          fromStatus: shipment.status,
          toStatus: targetStatus,
        },
      });

      return this.getShipmentById(callerBusinessId, shipmentId);
    });
  }

  /**
   * Assign a logistics provider to a shipment leg
   */
  async assignProviderToLeg(
    callerBusinessId: string,
    userId: string,
    shipmentId: string,
    input: AssignProviderInput,
  ): Promise<ShipmentDetailDto> {
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id: input.providerId },
    });
    if (!provider || !provider.isActive) {
      throw new NotFoundException("Active logistics provider not found");
    }

    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { legs: { orderBy: { legSequence: "asc" } } },
      });
      if (!shipment) {
        throw new NotFoundException("Shipment not found");
      }
      if (shipment.senderBusinessId !== callerBusinessId) {
        throw new ForbiddenException(
          "Only the sender business can assign logistics providers",
        );
      }

      // Pick target leg: either by input.legId or first unassigned leg
      const leg = input.legId
        ? shipment.legs.find((l) => l.id === input.legId)
        : shipment.legs.find((l) => !l.assignedProviderId) || shipment.legs[0];

      if (!leg) {
        throw new NotFoundException("Target delivery leg not found");
      }

      await tx.shipmentLeg.update({
        where: { id: leg.id },
        data: {
          assignedProviderId: input.providerId,
          trackingNumber: input.trackingNumber || leg.trackingNumber,
          status: LegStatus.ASSIGNED,
        },
      });

      // If shipment is in CREATED status, automatically schedule pickup
      if (shipment.status === ShipmentStatus.CREATED) {
        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: ShipmentStatus.PICKUP_SCHEDULED },
        });

        await tx.shipmentTrackingEvent.create({
          data: {
            shipmentId,
            legId: leg.id,
            eventType: ShipmentEventType.PICKUP_SCHEDULED,
            location: `${shipment.pickupCity}, ${shipment.pickupState}`,
            notes: `Pickup scheduled with ${provider.name}${input.trackingNumber ? ` (Tracking: ${input.trackingNumber})` : ""}`,
            actorUserId: userId,
            actorRole: "DISPATCHER",
          },
        });
      }

      this.logger.info(
        `Provider assigned to shipment ${shipment.shipmentNumber} leg ${leg.legSequence}: ${provider.name}`,
        { shipmentId, providerId: provider.id },
      );

      await this.auditService.log({
        userId,
        businessId: callerBusinessId,
        action: "LOGISTICS_PROVIDER_ASSIGNED",
        resource: `Shipment:${shipmentId}`,
        payload: {
          shipmentNumber: shipment.shipmentNumber,
          providerId: provider.id,
          providerName: provider.name,
          legSequence: leg.legSequence,
          trackingNumber: input.trackingNumber,
        },
      });

      return this.getShipmentById(callerBusinessId, shipmentId);
    });
  }

  /**
   * Record a failed delivery attempt with optional return initiation
   */
  async recordFailedDelivery(
    callerBusinessId: string,
    userId: string,
    shipmentId: string,
    input: RecordFailedDeliveryInput,
  ): Promise<ShipmentDetailDto> {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { legs: { include: { assignedProvider: true } } },
      });
      if (!shipment) {
        throw new NotFoundException("Shipment not found");
      }

      const isGlobalAdmin =
        callerBusinessId === "00000000-0000-0000-0000-000000000000";
      const isSender = shipment.senderBusinessId
        ? shipment.senderBusinessId === callerBusinessId
        : true;
      const legs = shipment.legs || [];
      const isAssignedProvider = legs.some(
        (leg) => leg.assignedProvider?.businessId === callerBusinessId,
      );

      if (!isSender && !isAssignedProvider && !isGlobalAdmin) {
        throw new ForbiddenException(
          "Access denied: Only the assigned logistics provider or sender can record delivery failure",
        );
      }

      if (
        shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY &&
        shipment.status !== ShipmentStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(
          `Cannot record delivery failure for shipment in '${shipment.status}' status`,
        );
      }

      const nextStatus = input.initiateReturn
        ? ShipmentStatus.RETURN_INITIATED
        : ShipmentStatus.DELIVERY_FAILED;

      const newAttemptCount = shipment.deliveryAttemptCount + 1;

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: nextStatus,
          deliveryFailureReason: input.failureReason,
          deliveryAttemptCount: newAttemptCount,
          currentLocation: input.location || shipment.currentLocation,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId,
          eventType: input.initiateReturn
            ? ShipmentEventType.RETURN_INITIATED
            : ShipmentEventType.DELIVERY_FAILED,
          location: input.location || shipment.currentLocation,
          notes: `Attempt #${newAttemptCount} failed: ${input.failureReason}${input.initiateReturn ? " -> Return initiated to sender" : ""}`,
          actorUserId: userId,
          actorRole: "DELIVERY_PARTNER",
        },
      });

      this.logger.warn(
        `Delivery failure recorded for ${updated.shipmentNumber}: ${input.failureReason}`,
        { shipmentId, attempts: newAttemptCount, nextStatus },
      );

      await this.auditService.log({
        userId,
        businessId: callerBusinessId,
        action: input.initiateReturn ? "RETURN_INITIATED" : "DELIVERY_FAILED",
        resource: `Shipment:${shipmentId}`,
        payload: {
          shipmentNumber: updated.shipmentNumber,
          failureReason: input.failureReason,
          attemptCount: newAttemptCount,
          status: nextStatus,
        },
      });

      return this.getShipmentById(callerBusinessId, shipmentId);
    });
  }

  /**
   * Submit Proof of Delivery (POD) and atomically mark shipment as DELIVERED
   */
  async submitProofOfDelivery(
    callerBusinessId: string,
    userId: string,
    shipmentId: string,
    input: SubmitProofOfDeliveryInput,
  ): Promise<ShipmentDetailDto> {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          proofOfDelivery: true,
          legs: { include: { assignedProvider: true } },
        },
      });
      if (!shipment) {
        throw new NotFoundException("Shipment not found");
      }

      // Multi-Tenant Isolation & Role Authorization:
      // Only the assigned logistics provider, the sender business, or global admin can submit POD
      const isGlobalAdmin =
        callerBusinessId === "00000000-0000-0000-0000-000000000000";
      const isSender = shipment.senderBusinessId
        ? shipment.senderBusinessId === callerBusinessId
        : true;
      const legs = shipment.legs || [];
      const isAssignedProvider = legs.some(
        (leg) => leg.assignedProvider?.businessId === callerBusinessId,
      );

      if (!isAssignedProvider && !isSender && !isGlobalAdmin) {
        throw new ForbiddenException(
          "Access denied: Only the assigned logistics partner or sender can submit Proof of Delivery",
        );
      }

      if (shipment.proofOfDelivery) {
        throw new ConflictException(
          "Proof of delivery has already been recorded for this shipment",
        );
      }

      if (
        shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY &&
        shipment.status !== ShipmentStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(
          `Proof of delivery can only be submitted when shipment is OUT_FOR_DELIVERY (current: ${shipment.status})`,
        );
      }

      const deliveryTimestamp = new Date();

      // 1. Create POD
      await tx.proofOfDelivery.create({
        data: {
          shipmentId,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          deliveryTimestamp,
          documentUrl: input.documentUrl,
          verificationCode: input.verificationCode,
          confirmedByUserId: userId,
          notes: input.notes,
        },
      });

      // 2. Mark shipment as DELIVERED
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.DELIVERED,
          actualDeliveryAt: deliveryTimestamp,
        },
      });

      // 3. Mark final leg as COMPLETED
      await tx.shipmentLeg.updateMany({
        where: { shipmentId, status: { not: LegStatus.COMPLETED } },
        data: {
          status: LegStatus.COMPLETED,
          actualArrivalAt: deliveryTimestamp,
        },
      });

      // 4. Create tracking event
      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId,
          eventType: ShipmentEventType.DELIVERED,
          location: `${shipment.deliveryCity}, ${shipment.deliveryState}`,
          notes: `Delivered to ${input.recipientName}${input.recipientPhone ? ` (${input.recipientPhone})` : ""}`,
          actorUserId: userId,
          actorRole: "DELIVERY_PARTNER",
        },
      });

      this.logger.info(
        `Shipment delivered: ${updated.shipmentNumber} to ${input.recipientName}`,
        { shipmentId },
      );

      await this.auditService.log({
        userId,
        businessId: callerBusinessId,
        action: "SHIPMENT_DELIVERED",
        resource: `Shipment:${shipmentId}`,
        payload: {
          shipmentNumber: updated.shipmentNumber,
          recipientName: input.recipientName,
          deliveryTimestamp: deliveryTimestamp.toISOString(),
        },
      });

      return this.getShipmentById(callerBusinessId, shipmentId);
    });
  }

  /**
   * Add a tracking checkpoint event to a shipment's ledger
   */
  async addTrackingEvent(
    callerBusinessId: string,
    userId: string,
    actorRole: string,
    shipmentId: string,
    input: AddTrackingEventInput,
  ): Promise<ShipmentDetailDto> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { legs: { include: { assignedProvider: true } } },
    });
    if (!shipment) {
      throw new NotFoundException("Shipment not found");
    }

    const isGlobalAdmin =
      callerBusinessId === "00000000-0000-0000-0000-000000000000";
    const isSender = shipment.senderBusinessId
      ? shipment.senderBusinessId === callerBusinessId
      : true;
    const isReceiver = shipment.receiverBusinessId
      ? shipment.receiverBusinessId === callerBusinessId
      : false;
    const legs = shipment.legs || [];
    const isAssignedProvider = legs.some(
      (leg) => leg.assignedProvider?.businessId === callerBusinessId,
    );

    if (!isSender && !isReceiver && !isAssignedProvider && !isGlobalAdmin) {
      throw new ForbiddenException(
        "Access denied: You do not have permission to add tracking events to this shipment",
      );
    }

    await prisma.shipmentTrackingEvent.create({
      data: {
        shipmentId,
        legId: input.legId,
        eventType: input.eventType as unknown as ShipmentEventType,
        location: input.location,
        notes: input.notes,
        actorUserId: userId,
        actorRole,
      },
    });

    if (input.location) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { currentLocation: input.location },
      });
    }

    return this.getShipmentById(callerBusinessId, shipmentId);
  }
}
