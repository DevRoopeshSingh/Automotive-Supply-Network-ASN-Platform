import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from "@nestjs/swagger";
import { ShipmentService } from "./shipment.service";
import { LogisticsProviderService } from "./logistics-provider.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { RequireRoles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateShipmentSchema,
  CreateShipmentInput,
  UpdateShipmentStatusSchema,
  UpdateShipmentStatusInput,
  SubmitProofOfDeliverySchema,
  SubmitProofOfDeliveryInput,
  RecordFailedDeliverySchema,
  RecordFailedDeliveryInput,
  CreateLogisticsProviderSchema,
  CreateLogisticsProviderInput,
  AssignProviderSchema,
  AssignProviderInput,
  AddTrackingEventSchema,
  AddTrackingEventInput,
  ShipmentQuerySchema,
  ShipmentQueryInput,
} from "@asn/validators";
import {
  UserContext,
  BusinessContext,
  UserRole,
  ApiResponse as IApiResponse,
} from "@asn/types";

@ApiTags("Logistics & Multi-Leg Delivery Orchestration")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Business-Id",
  description:
    "Active tenant/business ID for the sender, receiver, or logistics provider",
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@RequireRoles(
  UserRole.PLATFORM_SUPER_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.BUSINESS_OWNER,
  UserRole.BUSINESS_ADMIN,
  UserRole.BUSINESS_MANAGER,
  UserRole.FLEET_DISPATCHER,
  UserRole.DISPATCH_CONTROLLER,
  UserRole.DELIVERY_PARTNER,
  UserRole.SUPPLIER_ADMIN,
  UserRole.WHOLESALE_TRADER,
)
@Controller("logistics")
export class LogisticsController {
  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly providerService: LogisticsProviderService,
  ) {}

  // ---------------------------------------------------------------------------
  // Logistics Provider Endpoints
  // ---------------------------------------------------------------------------

  @Post("providers")
  @ApiOperation({
    summary: "Register a logistics provider or 3PL partner",
  })
  async createProvider(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateLogisticsProviderSchema))
    body: CreateLogisticsProviderInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.providerService.createProvider(
      user.id,
      business.id,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Get("providers")
  @ApiOperation({
    summary: "List registered logistics providers",
  })
  @ApiQuery({ name: "activeOnly", required: false, type: Boolean })
  async listProviders(
    @Query("activeOnly") activeOnly?: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.providerService.listProviders(
      activeOnly !== "false",
    );
    return {
      success: true,
      data,
    };
  }

  @Get("providers/:id")
  @ApiOperation({
    summary: "Get logistics provider details",
  })
  async getProviderById(
    @Param("id") providerId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.providerService.getProviderById(providerId);
    return {
      success: true,
      data,
    };
  }

  // ---------------------------------------------------------------------------
  // Shipment Orchestration Endpoints
  // ---------------------------------------------------------------------------

  @Post("shipments")
  @ApiOperation({
    summary: "Create a new shipment with multi-leg delivery planning",
  })
  async createShipment(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateShipmentSchema))
    body: CreateShipmentInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.createShipment(
      business.id,
      user.id,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Get("shipments")
  @ApiOperation({
    summary: "List shipments accessible to the calling business",
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "senderBusinessId", required: false })
  @ApiQuery({ name: "receiverBusinessId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listShipments(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(ShipmentQuerySchema))
    query: ShipmentQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.shipmentService.listShipments(business.id, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get("shipments/:id")
  @ApiOperation({
    summary: "Get shipment details, legs, events, and proof of delivery",
  })
  async getShipmentById(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") shipmentId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.getShipmentById(
      business.id,
      shipmentId,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("shipments/:id/cancel")
  @ApiOperation({
    summary: "Cancel an un-dispatched shipment",
  })
  async cancelShipment(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body("reason") reason?: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.cancelShipment(
      business.id,
      user.id,
      shipmentId,
      reason,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch("shipments/:id/status")
  @ApiOperation({
    summary: "Transition shipment status through the delivery state machine",
  })
  async transitionStatus(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body(new ZodValidationPipe(UpdateShipmentStatusSchema))
    body: UpdateShipmentStatusInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.transitionStatus(
      business.id,
      user.id,
      business.currentUserRole || "DISPATCHER",
      shipmentId,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("shipments/:id/assign-provider")
  @ApiOperation({
    summary: "Assign a logistics carrier or partner to a shipment leg",
  })
  async assignProviderToLeg(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body(new ZodValidationPipe(AssignProviderSchema))
    body: AssignProviderInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.assignProviderToLeg(
      business.id,
      user.id,
      shipmentId,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("shipments/:id/failed")
  @ApiOperation({
    summary: "Record delivery failure and optionally initiate return to sender",
  })
  async recordFailedDelivery(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body(new ZodValidationPipe(RecordFailedDeliverySchema))
    body: RecordFailedDeliveryInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.recordFailedDelivery(
      business.id,
      user.id,
      shipmentId,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("shipments/:id/proof-of-delivery")
  @ApiOperation({
    summary: "Submit Proof of Delivery (POD) and mark shipment as DELIVERED",
  })
  async submitProofOfDelivery(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body(new ZodValidationPipe(SubmitProofOfDeliverySchema))
    body: SubmitProofOfDeliveryInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.submitProofOfDelivery(
      business.id,
      user.id,
      shipmentId,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("shipments/:id/events")
  @ApiOperation({
    summary: "Add a tracking event or checkpoint to a shipment",
  })
  async addTrackingEvent(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") shipmentId: string,
    @Body(new ZodValidationPipe(AddTrackingEventSchema))
    body: AddTrackingEventInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.shipmentService.addTrackingEvent(
      business.id,
      user.id,
      business.currentUserRole || "DISPATCHER",
      shipmentId,
      body,
    );
    return {
      success: true,
      data,
    };
  }
}
