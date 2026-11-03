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
import { RfqService } from "./rfq.service";
import { QuotationService } from "./quotation.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { RequireRoles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateRfqSchema,
  CreateRfqInput,
  AwardRfqSchema,
  AwardRfqInput,
  RfqQuerySchema,
  RfqQueryInput,
  SubmitQuotationSchema,
  SubmitQuotationInput,
  ReviseQuotationSchema,
  ReviseQuotationInput,
  QuotationQuerySchema,
  QuotationQueryInput,
} from "@asn/validators";
import {
  UserContext,
  BusinessContext,
  UserRole,
  ApiResponse as IApiResponse,
} from "@asn/types";

@ApiTags("Supplier Supply Network (SSN) — Wholesale & B2B RFQs")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Business-Id",
  description: "Active tenant/business ID for the supplier or buyer business",
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@RequireRoles(
  UserRole.PLATFORM_SUPER_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.BUSINESS_OWNER,
  UserRole.BUSINESS_ADMIN,
  UserRole.BUSINESS_MANAGER,
  UserRole.SUPPLIER_ADMIN,
  UserRole.WHOLESALE_TRADER,
  UserRole.INVENTORY_MANAGER,
)
@Controller("supplier/ssn")
export class SsnController {
  constructor(
    private readonly rfqService: RfqService,
    private readonly quotationService: QuotationService,
  ) {}

  // ---------------------------------------------------------------------------
  // RFQ Endpoints (Buyer & Discovery)
  // ---------------------------------------------------------------------------

  @Post("rfqs")
  @ApiOperation({
    summary: "Create a new B2B sourcing RFQ",
    description:
      "Allows a verified buyer/supplier to raise a wholesale RFQ for an automotive master product",
  })
  async createRfq(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateRfqSchema)) body: CreateRfqInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.createRfq(business.id, user.id, body);
    return {
      success: true,
      data,
    };
  }

  @Post("rfqs/:id/publish")
  @ApiOperation({
    summary: "Publish a draft RFQ to the network",
  })
  async publishRfq(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") rfqId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.publishRfq(business.id, user.id, rfqId);
    return {
      success: true,
      data,
    };
  }

  @Post("rfqs/:id/cancel")
  @ApiOperation({
    summary: "Cancel an unawarded RFQ",
  })
  async cancelRfq(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") rfqId: string,
    @Body("reason") reason?: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.cancelRfq(
      business.id,
      user.id,
      rfqId,
      reason,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("rfqs/:id/award")
  @ApiOperation({
    summary: "Atomically award an RFQ to a winning quotation",
    description:
      "Performs atomic transaction marking quotation ACCEPTED, rejecting other bids, and updating RFQ to AWARDED",
  })
  async awardRfq(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") rfqId: string,
    @Body(new ZodValidationPipe(AwardRfqSchema)) body: AwardRfqInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.awardRfq(
      business.id,
      user.id,
      rfqId,
      body.quotationId,
    );
    return {
      success: true,
      data,
    };
  }

  @Get("rfqs/mine")
  @ApiOperation({
    summary: "List RFQs created by the caller's business",
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listMyRfqs(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(RfqQuerySchema)) query: RfqQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.rfqService.listMyRfqs(business.id, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get("rfqs/open")
  @ApiOperation({
    summary: "Discover open RFQs available to the calling supplier",
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async discoverOpenRfqs(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(RfqQuerySchema)) query: RfqQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.rfqService.discoverOpenRfqs(business.id, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get("rfqs/eligible-suppliers/:masterProductId")
  @ApiOperation({
    summary: "Discover eligible verified suppliers stocking a master product",
  })
  async discoverEligibleSuppliers(
    @CurrentBusiness() business: BusinessContext,
    @Param("masterProductId") masterProductId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.discoverEligibleSuppliers(
      business.id,
      masterProductId,
    );
    return {
      success: true,
      data,
    };
  }

  @Get("rfqs/:id")
  @ApiOperation({
    summary: "Get RFQ detail by ID",
  })
  async getRfqDetail(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") rfqId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.getRfqDetail(business.id, rfqId);
    return {
      success: true,
      data,
    };
  }

  @Get("rfqs/:id/compare")
  @ApiOperation({
    summary: "Quotation comparison matrix (Buyer only)",
  })
  async compareQuotations(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") rfqId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.rfqService.compareQuotations(business.id, rfqId);
    return {
      success: true,
      data,
    };
  }

  @Get("rfqs/:id/quotations")
  @ApiOperation({
    summary: "List quotations for an RFQ with confidentiality guard",
    description:
      "Buyers see all quotations; external suppliers see only their own quotation",
  })
  async listQuotationsForRfq(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") rfqId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.quotationService.listQuotationsForRfq(
      business.id,
      rfqId,
    );
    return {
      success: true,
      data,
    };
  }

  // ---------------------------------------------------------------------------
  // Quotation Endpoints (Supplier Bidding & Revisions)
  // ---------------------------------------------------------------------------

  @Post("quotations")
  @ApiOperation({
    summary: "Submit a quotation for an open RFQ",
  })
  async submitQuotation(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(SubmitQuotationSchema))
    body: SubmitQuotationInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.quotationService.submitQuotation(
      business.id,
      user.id,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch("quotations/:id/revise")
  @ApiOperation({
    summary: "Revise a submitted quotation prior to RFQ award",
  })
  async reviseQuotation(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") quotationId: string,
    @Body(new ZodValidationPipe(ReviseQuotationSchema))
    body: ReviseQuotationInput,
  ): Promise<IApiResponse<any>> {
    const data = await this.quotationService.reviseQuotation(
      business.id,
      user.id,
      quotationId,
      body,
    );
    return {
      success: true,
      data,
    };
  }

  @Post("quotations/:id/withdraw")
  @ApiOperation({
    summary: "Withdraw a quotation prior to RFQ award",
  })
  async withdrawQuotation(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") quotationId: string,
    @Body("reason") reason?: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.quotationService.withdrawQuotation(
      business.id,
      user.id,
      quotationId,
      reason,
    );
    return {
      success: true,
      data,
    };
  }

  @Get("quotations/mine")
  @ApiOperation({
    summary: "List quotations submitted by the caller's business",
  })
  @ApiQuery({ name: "rfqId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listMySubmittedQuotations(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(QuotationQuerySchema))
    query: QuotationQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.quotationService.listMySubmittedQuotations(
      business.id,
      query,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get("quotations/:id")
  @ApiOperation({
    summary: "Get quotation details with strict confidentiality guard",
  })
  async getQuotationById(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") quotationId: string,
  ): Promise<IApiResponse<any>> {
    const data = await this.quotationService.getQuotationById(
      business.id,
      quotationId,
    );
    return {
      success: true,
      data,
    };
  }
}
