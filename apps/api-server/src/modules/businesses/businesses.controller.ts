import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from "@nestjs/swagger";
import { Request } from "express";
import { BusinessesService } from "./businesses.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { RequireRoles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateBusinessSchema,
  CreateBusinessInput,
  UpdateBusinessSchema,
  UpdateBusinessInput,
  InviteBusinessMemberSchema,
  InviteBusinessMemberInput,
} from "@asn/validators";
import {
  UserContext,
  BusinessContext,
  UserRole,
  ApiResponse as IApiResponse,
} from "@asn/types";

@ApiTags("Business Accounts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new business account (e.g. Garage, Distributor, Fleet)",
  })
  async createBusiness(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateBusinessSchema))
    body: CreateBusinessInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    const business = await this.businessesService.createBusiness(
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: business,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get()
  @ApiOperation({
    summary: "Get all businesses the current user has membership in",
  })
  async getUserBusinesses(
    @CurrentUser() user: UserContext,
  ): Promise<IApiResponse<any>> {
    const businesses = await this.businessesService.getUserBusinesses(user.id);
    return {
      success: true,
      data: businesses,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get(":id")
  @UseGuards(TenantContextGuard)
  @ApiHeader({
    name: "X-Business-Id",
    required: false,
    description: "Tenant Context Business ID",
  })
  @ApiOperation({
    summary: "Get details of a specific business (enforces tenant membership)",
  })
  async getBusinessDetails(
    @Param("id") id: string,
    @CurrentBusiness() businessContext: BusinessContext,
  ): Promise<IApiResponse<any>> {
    const business = await this.businessesService.getBusinessById(id);
    return {
      success: true,
      data: { ...business, currentUserRole: businessContext.currentUserRole },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch(":id")
  @UseGuards(TenantContextGuard, RolesGuard)
  @RequireRoles(UserRole.BUSINESS_OWNER, UserRole.BUSINESS_ADMIN)
  @ApiHeader({ name: "X-Business-Id", required: false })
  @ApiOperation({
    summary: "Update business profile (Requires Business Owner or Admin role)",
  })
  async updateBusiness(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(UpdateBusinessSchema))
    body: UpdateBusinessInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    const updated = await this.businessesService.updateBusiness(
      id,
      body,
      user.id,
      meta,
    );
    return {
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post(":id/switch")
  @ApiOperation({
    summary: "Switch active business context and obtain a scoped access token",
  })
  async switchBusinessContext(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
  ): Promise<IApiResponse<any>> {
    const result = await this.businessesService.switchBusinessContext(user, id);
    return {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post(":id/invite")
  @UseGuards(TenantContextGuard, RolesGuard)
  @RequireRoles(UserRole.BUSINESS_OWNER, UserRole.BUSINESS_ADMIN)
  @ApiHeader({ name: "X-Business-Id", required: false })
  @ApiOperation({ summary: "Invite a new team member to this business" })
  async inviteMember(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(InviteBusinessMemberSchema))
    body: InviteBusinessMemberInput,
  ): Promise<IApiResponse<any>> {
    const invitation = await this.businessesService.inviteMember(
      id,
      user.id,
      body,
    );
    return {
      success: true,
      data: invitation,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
