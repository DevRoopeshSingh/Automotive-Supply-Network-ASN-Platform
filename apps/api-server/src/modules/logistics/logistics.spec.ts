import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ShipmentService } from "./shipment.service";
import { LogisticsProviderService } from "./logistics-provider.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "../../common/audit/audit.service";
import { prisma } from "@asn/database";
import {
  UserRole,
  ShipmentStatus,
  LegType,
  LegStatus,
  ShipmentEventType,
  LogisticsProviderType,
} from "@asn/types";

describe("Logistics Engine & Multi-Leg Delivery Orchestration", () => {
  let shipmentService: ShipmentService;
  let providerService: LogisticsProviderService;
  let auditService: AuditService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const senderBizId = "biz-sender-supplier-111";
  const receiverBizId = "biz-receiver-workshop-222";
  const thirdPartyBizId = "biz-unrelated-rogue-333";

  const userId = "usr-logistics-mgr-1";
  const masterProductId = "prod-brake-disc-uuid";
  const providerId = "lp-delhivery-uuid";

  beforeEach(() => {
    vi.restoreAllMocks();
    auditService = new AuditService();
    vi.spyOn(auditService, "log").mockResolvedValue(undefined);

    shipmentService = new ShipmentService(auditService);
    providerService = new LogisticsProviderService(auditService);

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  // ===========================================================================
  // 1. Shipment Creation & Multi-Leg Planning
  // ===========================================================================
  describe("1. Shipment Creation & Multi-Leg Planning", () => {
    const validShipmentInput = {
      receiverBusinessId: receiverBizId,
      pickupAddress: "Plot 42, Mayapuri Phase II",
      pickupCity: "New Delhi",
      pickupState: "Delhi",
      pickupPostalCode: "110064",
      deliveryAddress: "Shop 12, Opera House Auto Market",
      deliveryCity: "Mumbai",
      deliveryState: "Maharashtra",
      deliveryPostalCode: "400004",
      deliveryContactName: "Vikram Mehta",
      deliveryContactPhone: "9876543210",
      items: [
        {
          masterProductId,
          quantity: 20,
          unitPrice: 1500.0,
          sku: "DISC-FRONT-01",
        },
      ],
    };

    it("should create a shipment with direct last-mile delivery leg when no legs are provided", async () => {
      vi.spyOn(prisma.business, "findUnique").mockImplementation(((
        args: any,
      ) => {
        if (args.where.id === senderBizId) {
          return Promise.resolve({
            id: senderBizId,
            tradeName: "Delhi Central Spares",
            legalName: "Delhi Central Spares LLP",
            verificationStatus: "VERIFIED",
          } as any);
        }
        if (args.where.id === receiverBizId) {
          return Promise.resolve({
            id: receiverBizId,
            tradeName: "Opera Auto Works",
            legalName: "Opera Auto Works Pvt Ltd",
            verificationStatus: "VERIFIED",
          } as any);
        }
        return Promise.resolve(null);
      }) as any);

      vi.spyOn(prisma.masterProduct, "findMany").mockResolvedValue([
        { id: masterProductId },
      ] as any);

      const mockCreatedShipment = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        senderBusinessId: senderBizId,
        receiverBusinessId: receiverBizId,
        status: ShipmentStatus.CREATED,
        pickupAddress: validShipmentInput.pickupAddress,
        pickupCity: "New Delhi",
        pickupState: "Delhi",
        pickupPostalCode: "110064",
        deliveryAddress: validShipmentInput.deliveryAddress,
        deliveryCity: "Mumbai",
        deliveryState: "Maharashtra",
        deliveryPostalCode: "400004",
        deliveryContactName: "Vikram Mehta",
        deliveryContactPhone: "9876543210",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              create: vi.fn().mockResolvedValue(mockCreatedShipment),
            },
            shipmentItem: {
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            shipmentLeg: {
              create: vi
                .fn()
                .mockResolvedValue({ id: "leg-1", legSequence: 1 }),
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-1" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        senderBusinessId: senderBizId,
        senderBusinessName: "Delhi Central Spares",
        receiverBusinessId: receiverBizId,
        receiverBusinessName: "Opera Auto Works",
        status: ShipmentStatus.CREATED as any,
        pickupCity: "New Delhi",
        pickupState: "Delhi",
        deliveryCity: "Mumbai",
        deliveryState: "Maharashtra",
        pickupAddress: validShipmentInput.pickupAddress,
        pickupPostalCode: "110064",
        deliveryAddress: validShipmentInput.deliveryAddress,
        deliveryPostalCode: "400004",
        deliveryAttemptCount: 0,
        totalItemsCount: 1,
        totalLegsCount: 1,
        items: [
          {
            id: "item-1",
            shipmentId: "shp-100",
            masterProductId,
            productName: "Brembo Vented Brake Disc",
            partNumber: "09.A820.11",
            quantity: 20,
            unitPrice: 1500.0,
            totalPrice: 30000.0,
            createdAt: new Date().toISOString(),
          },
        ],
        legs: [
          {
            id: "leg-1",
            shipmentId: "shp-100",
            legSequence: 1,
            legType: LegType.LAST_MILE_DELIVERY as any,
            status: LegStatus.PENDING as any,
            originAddress: validShipmentInput.pickupAddress,
            originCity: "New Delhi",
            originState: "Delhi",
            originPostalCode: "110064",
            destinationAddress: validShipmentInput.deliveryAddress,
            destinationCity: "Mumbai",
            destinationState: "Maharashtra",
            destinationPostalCode: "400004",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        trackingEvents: [
          {
            id: "evt-1",
            shipmentId: "shp-100",
            eventType: ShipmentEventType.SHIPMENT_CREATED as any,
            location: "New Delhi, Delhi",
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await shipmentService.createShipment(
        senderBizId,
        userId,
        validShipmentInput,
      );

      expect(result.id).toBe("shp-100");
      expect(result.status).toBe(ShipmentStatus.CREATED);
      expect(result.legs).toHaveLength(1);
      expect(result.items).toHaveLength(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SHIPMENT_CREATED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should reject shipment creation if sender and receiver businesses are identical", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: senderBizId,
        verificationStatus: "VERIFIED",
      } as any);

      await expect(
        shipmentService.createShipment(senderBizId, userId, {
          ...validShipmentInput,
          receiverBusinessId: senderBizId, // Same business!
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject shipment creation if sender is unverified", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: senderBizId,
        verificationStatus: "PENDING", // Not verified!
      } as any);

      await expect(
        shipmentService.createShipment(senderBizId, userId, validShipmentInput),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject shipment creation if leg sequence is non-sequential or does not start at 1", async () => {
      vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
        id: senderBizId,
        verificationStatus: "VERIFIED",
      } as any);

      vi.spyOn(prisma.masterProduct, "findMany").mockResolvedValue([
        { id: masterProductId },
      ] as any);

      const invalidLegsInput = {
        ...validShipmentInput,
        legs: [
          {
            legSequence: 2, // Starts at 2 instead of 1!
            legType: LegType.MID_MILE_TRANSFER,
            originAddress: "Address 1",
            originCity: "City 1",
            originState: "State 1",
            originPostalCode: "110001",
            destinationAddress: "Address 2",
            destinationCity: "City 2",
            destinationState: "State 2",
            destinationPostalCode: "400001",
          },
        ],
      };

      await expect(
        shipmentService.createShipment(senderBizId, userId, invalidLegsInput),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 2. Shipment Lifecycle Transitions & State Machine
  // ===========================================================================
  describe("2. Shipment Lifecycle Transitions & State Machine", () => {
    it("should transition shipment through valid lifecycle: CREATED -> PICKUP_SCHEDULED -> PICKED_UP", async () => {
      const mockShipmentCreated = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        senderBusinessId: senderBizId,
        receiverBusinessId: receiverBizId,
        status: ShipmentStatus.CREATED,
        actualPickupAt: null,
        legs: [],
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipmentCreated),
              update: vi.fn().mockResolvedValue({
                ...mockShipmentCreated,
                status: ShipmentStatus.PICKUP_SCHEDULED,
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-2" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.PICKUP_SCHEDULED as any,
      } as any);

      const scheduled = await shipmentService.transitionStatus(
        senderBizId,
        userId,
        "DISPATCHER",
        "shp-100",
        { status: ShipmentStatus.PICKUP_SCHEDULED as any },
      );
      expect(scheduled.status).toBe(ShipmentStatus.PICKUP_SCHEDULED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SHIPMENT_STATUS_TRANSITIONED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should reject invalid state transitions according to the state machine", async () => {
      const mockShipment = {
        id: "shp-100",
        status: ShipmentStatus.CREATED, // Cannot jump directly to IN_TRANSIT or DELIVERED!
        legs: [],
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        shipmentService.transitionStatus(
          senderBizId,
          userId,
          "DISPATCHER",
          "shp-100",
          { status: ShipmentStatus.IN_TRANSIT as any }, // Invalid jump!
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should cancel an un-dispatched shipment", async () => {
      const mockCreated = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        senderBusinessId: senderBizId,
        receiverBusinessId: receiverBizId,
        status: ShipmentStatus.CREATED,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockCreated),
              update: vi.fn().mockResolvedValue({
                ...mockCreated,
                status: ShipmentStatus.CANCELLED,
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-cancel" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.CANCELLED as any,
      } as any);

      const result = await shipmentService.cancelShipment(
        senderBizId,
        userId,
        "shp-100",
        "Buyer requested order alteration",
      );
      expect(result.status).toBe(ShipmentStatus.CANCELLED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SHIPMENT_CANCELLED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should prevent cancellation of an in-transit shipment", async () => {
      const mockInTransit = {
        id: "shp-100",
        senderBusinessId: senderBizId,
        receiverBusinessId: receiverBizId,
        status: ShipmentStatus.IN_TRANSIT, // Cannot cancel!
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockInTransit),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        shipmentService.cancelShipment(senderBizId, userId, "shp-100"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 3. Logistics Provider Management & Assignment
  // ===========================================================================
  describe("3. Logistics Provider Management & Assignment", () => {
    it("should register a logistics provider and enforce code uniqueness", async () => {
      vi.spyOn(prisma.logisticsProvider, "findUnique").mockResolvedValue(null);

      const mockProvider = {
        id: providerId,
        providerCode: "LP-DELHIVERY",
        name: "Delhivery Surface Express",
        providerType: LogisticsProviderType.THIRD_PARTY_3PL,
        contactPhone: "9876543210",
        contactEmail: "ops@delhivery.example.com",
        trackingUrlTemplate: "https://track.delhivery.com/{trackingNumber}",
        isActive: true,
        businessId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.logisticsProvider, "create").mockResolvedValue(
        mockProvider,
      );

      const result = await providerService.createProvider(userId, senderBizId, {
        providerCode: "LP-DELHIVERY",
        name: "Delhivery Surface Express",
        providerType: LogisticsProviderType.THIRD_PARTY_3PL as any,
        contactPhone: "9876543210",
        contactEmail: "ops@delhivery.example.com",
      });

      expect(result.id).toBe(providerId);
      expect(result.providerCode).toBe("LP-DELHIVERY");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LOGISTICS_PROVIDER_REGISTERED",
          resource: `LogisticsProvider:${providerId}`,
        }),
      );
    });

    it("should assign a provider to a shipment leg and automatically advance status from CREATED to PICKUP_SCHEDULED", async () => {
      vi.spyOn(prisma.logisticsProvider, "findUnique").mockResolvedValue({
        id: providerId,
        name: "Delhivery Surface Express",
        isActive: true,
      } as any);

      const mockShipment = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        senderBusinessId: senderBizId,
        status: ShipmentStatus.CREATED,
        pickupCity: "New Delhi",
        pickupState: "Delhi",
        legs: [
          {
            id: "leg-1",
            legSequence: 1,
            assignedProviderId: null,
            trackingNumber: null,
          },
        ],
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
              update: vi.fn().mockResolvedValue({
                ...mockShipment,
                status: ShipmentStatus.PICKUP_SCHEDULED,
              }),
            },
            shipmentLeg: {
              update: vi.fn().mockResolvedValue({
                id: "leg-1",
                assignedProviderId: providerId,
                status: LegStatus.ASSIGNED,
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-assign" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.PICKUP_SCHEDULED as any,
        legs: [
          {
            id: "leg-1",
            assignedProviderId: providerId,
            assignedProviderName: "Delhivery Surface Express",
            status: LegStatus.ASSIGNED as any,
          } as any,
        ],
      } as any);

      const result = await shipmentService.assignProviderToLeg(
        senderBizId,
        userId,
        "shp-100",
        {
          providerId,
          trackingNumber: "DEL-TRK-998877",
        },
      );

      expect(result.status).toBe(ShipmentStatus.PICKUP_SCHEDULED);
      expect(result.legs[0]?.assignedProviderId).toBe(providerId);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LOGISTICS_PROVIDER_ASSIGNED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should prevent non-sender businesses from assigning logistics providers (tenant isolation)", async () => {
      vi.spyOn(prisma.logisticsProvider, "findUnique").mockResolvedValue({
        id: providerId,
        isActive: true,
      } as any);

      const mockShipment = {
        id: "shp-100",
        senderBusinessId: senderBizId, // Belongs to senderBizId
        legs: [{ id: "leg-1", legSequence: 1 }],
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        shipmentService.assignProviderToLeg(
          thirdPartyBizId, // Rogue business!
          userId,
          "shp-100",
          { providerId },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===========================================================================
  // 4. Delivery Failure & Return Workflows
  // ===========================================================================
  describe("4. Delivery Failure & Return Workflows", () => {
    it("should record failed delivery attempt, increment attempt count, and store failure reason", async () => {
      const mockShipment = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        deliveryAttemptCount: 0,
        currentLocation: "Andheri East, Mumbai",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
              update: vi.fn().mockResolvedValue({
                ...mockShipment,
                status: ShipmentStatus.DELIVERY_FAILED,
                deliveryAttemptCount: 1,
                deliveryFailureReason: "Workshop premises closed at 7 PM",
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-fail" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.DELIVERY_FAILED as any,
        deliveryAttemptCount: 1,
        deliveryFailureReason: "Workshop premises closed at 7 PM",
      } as any);

      const result = await shipmentService.recordFailedDelivery(
        senderBizId,
        userId,
        "shp-100",
        {
          failureReason: "Workshop premises closed at 7 PM",
          initiateReturn: false,
        },
      );

      expect(result.status).toBe(ShipmentStatus.DELIVERY_FAILED);
      expect(result.deliveryAttemptCount).toBe(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELIVERY_FAILED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should initiate return to sender when initiateReturn is true on delivery failure", async () => {
      const mockShipment = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        deliveryAttemptCount: 1,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
              update: vi.fn().mockResolvedValue({
                ...mockShipment,
                status: ShipmentStatus.RETURN_INITIATED,
                deliveryAttemptCount: 2,
                deliveryFailureReason:
                  "Recipient rejected delivery: part ordered by mistake",
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-ret-init" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.RETURN_INITIATED as any,
        deliveryAttemptCount: 2,
      } as any);

      const result = await shipmentService.recordFailedDelivery(
        senderBizId,
        userId,
        "shp-100",
        {
          failureReason: "Recipient rejected delivery: part ordered by mistake",
          initiateReturn: true,
        },
      );

      expect(result.status).toBe(ShipmentStatus.RETURN_INITIATED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RETURN_INITIATED",
          resource: "Shipment:shp-100",
        }),
      );
    });
  });

  // ===========================================================================
  // 5. Proof of Delivery (POD) & Delivery Confirmation
  // ===========================================================================
  describe("5. Proof of Delivery (POD) & Delivery Confirmation", () => {
    it("should submit Proof of Delivery when OUT_FOR_DELIVERY, atomically marking shipment DELIVERED and legs COMPLETED", async () => {
      const mockShipment = {
        id: "shp-100",
        shipmentNumber: "SHP-2026-10001",
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        deliveryCity: "Mumbai",
        deliveryState: "Maharashtra",
        proofOfDelivery: null,
      };

      const podInput = {
        recipientName: "Sanjay Verma",
        recipientPhone: "9876543210",
        documentUrl: "https://storage.example.com/pod/sig-100.png",
        verificationCode: "4921",
        notes: "Delivered to shop foreman",
      };

      let podCreated = false;
      let shipmentDelivered = false;
      let legCompleted = false;

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(mockShipment),
              update: vi.fn().mockImplementation((args: any) => {
                if (args.data.status === ShipmentStatus.DELIVERED) {
                  shipmentDelivered = true;
                }
                return { ...mockShipment, status: ShipmentStatus.DELIVERED };
              }),
            },
            proofOfDelivery: {
              create: vi.fn().mockImplementation(() => {
                podCreated = true;
                return Promise.resolve({ id: "pod-1", ...podInput });
              }),
            },
            shipmentLeg: {
              updateMany: vi.fn().mockImplementation(() => {
                legCompleted = true;
                return Promise.resolve({ count: 1 });
              }),
            },
            shipmentTrackingEvent: {
              create: vi.fn().mockResolvedValue({ id: "evt-del" }),
            },
          };
          return callback(tx);
        },
      );

      vi.spyOn(shipmentService, "getShipmentById").mockResolvedValue({
        id: "shp-100",
        status: ShipmentStatus.DELIVERED as any,
        proofOfDelivery: {
          id: "pod-1",
          shipmentId: "shp-100",
          recipientName: "Sanjay Verma",
          recipientPhone: "9876543210",
          deliveryTimestamp: new Date().toISOString(),
          documentUrl: podInput.documentUrl,
          verificationCode: "4921",
          notes: podInput.notes,
          createdAt: new Date().toISOString(),
        },
      } as any);

      const result = await shipmentService.submitProofOfDelivery(
        senderBizId,
        userId,
        "shp-100",
        podInput,
      );

      expect(podCreated).toBe(true);
      expect(shipmentDelivered).toBe(true);
      expect(legCompleted).toBe(true);
      expect(result.status).toBe(ShipmentStatus.DELIVERED);
      expect(result.proofOfDelivery?.recipientName).toBe("Sanjay Verma");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SHIPMENT_DELIVERED",
          resource: "Shipment:shp-100",
        }),
      );
    });

    it("should prevent duplicate Proof of Delivery submission for the same shipment", async () => {
      const alreadyDelivered = {
        id: "shp-100",
        status: ShipmentStatus.DELIVERED,
        proofOfDelivery: { id: "existing-pod" }, // Already has POD!
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: any) => {
          const tx = {
            shipment: {
              findUnique: vi.fn().mockResolvedValue(alreadyDelivered),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        shipmentService.submitProofOfDelivery(senderBizId, userId, "shp-100", {
          recipientName: "Sanjay Verma",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // 6. Tenant Isolation & RBAC
  // ===========================================================================
  describe("6. Tenant Isolation & RBAC", () => {
    it("should enforce tenant isolation: unrelated business cannot view shipment details", async () => {
      vi.spyOn(prisma.shipment, "findUnique").mockResolvedValue({
        id: "shp-100",
        senderBusinessId: senderBizId,
        receiverBusinessId: receiverBizId,
        legs: [],
      } as any);

      await expect(
        shipmentService.getShipmentById(thirdPartyBizId, "shp-100"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow logistics and dispatch roles through RolesGuard", () => {
      function createMockContext(role: UserRole): ExecutionContext {
        return {
          getHandler: () => ({}),
          getClass: () => ({}),
          switchToHttp: () => ({
            getRequest: () => ({
              user: { role },
              business: { id: senderBizId, currentUserRole: role },
            }),
          }),
        } as unknown as ExecutionContext;
      }

      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue([
        UserRole.FLEET_DISPATCHER,
        UserRole.DISPATCH_CONTROLLER,
        UserRole.DELIVERY_PARTNER,
      ]);

      expect(
        rolesGuard.canActivate(createMockContext(UserRole.FLEET_DISPATCHER)),
      ).toBe(true);
      expect(
        rolesGuard.canActivate(createMockContext(UserRole.DISPATCH_CONTROLLER)),
      ).toBe(true);
      expect(
        rolesGuard.canActivate(createMockContext(UserRole.DELIVERY_PARTNER)),
      ).toBe(true);
    });
  });
});
