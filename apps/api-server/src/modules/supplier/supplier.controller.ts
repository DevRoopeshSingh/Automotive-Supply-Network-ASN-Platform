import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from "@nestjs/swagger";
import { Request } from "express";
import { SupplierWarehouseService } from "./supplier-warehouse.service";
import { SupplierInventoryService } from "./supplier-inventory.service";
import { InventoryImportService } from "./inventory-import.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { RequireRoles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateWarehouseSchema,
  CreateWarehouseInput,
  UpdateWarehouseSchema,
  UpdateWarehouseInput,
  CreateSupplierProductSchema,
  CreateSupplierProductInput,
  UpdateSupplierProductSchema,
  UpdateSupplierProductInput,
  AdjustInventorySchema,
  AdjustInventoryInput,
  WarehouseInventoryQuerySchema,
  WarehouseInventoryQueryInput,
  SupplierProductQuerySchema,
  SupplierProductQueryInput,
  UploadCsvImportSchema,
  UploadCsvImportInput,
  ExecuteImportJobSchema,
  ExecuteImportJobInput,
} from "@asn/validators";
import {
  UserContext,
  BusinessContext,
  UserRole,
  ApiResponse as IApiResponse,
} from "@asn/types";

@ApiTags("Supplier OS — Warehouses & Inventory")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Business-Id",
  description: "Active tenant/business ID for the supplier",
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@RequireRoles(
  UserRole.PLATFORM_SUPER_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.BUSINESS_OWNER,
  UserRole.BUSINESS_ADMIN,
  UserRole.SUPPLIER_ADMIN,
  UserRole.INVENTORY_MANAGER,
)
@Controller("supplier")
export class SupplierController {
  constructor(
    private readonly warehouseService: SupplierWarehouseService,
    private readonly inventoryService: SupplierInventoryService,
    private readonly importService: InventoryImportService,
  ) {}

  // ===========================================================================
  // 1. Warehouse Management
  // ===========================================================================

  @Post("warehouses")
  @ApiOperation({
    summary: "Create a new supplier warehouse facility",
  })
  async createWarehouse(
    @CurrentBusiness() business: BusinessContext,
    @Body(new ZodValidationPipe(CreateWarehouseSchema))
    body: CreateWarehouseInput,
  ): Promise<IApiResponse<any>> {
    const warehouse = await this.warehouseService.createWarehouse(
      business.id,
      body,
    );
    return {
      success: true,
      data: warehouse,
    };
  }

  @Get("warehouses")
  @ApiOperation({
    summary: "List all warehouses for the active supplier business",
  })
  async listWarehouses(
    @CurrentBusiness() business: BusinessContext,
  ): Promise<IApiResponse<any>> {
    const warehouses = await this.warehouseService.listWarehouses(business.id);
    return {
      success: true,
      data: warehouses,
    };
  }

  @Get("warehouses/:id")
  @ApiOperation({
    summary: "Get supplier warehouse facility details",
  })
  async getWarehouseById(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") id: string,
  ): Promise<IApiResponse<any>> {
    const warehouse = await this.warehouseService.getWarehouseById(
      business.id,
      id,
    );
    return {
      success: true,
      data: warehouse,
    };
  }

  @Put("warehouses/:id")
  @ApiOperation({
    summary: "Update warehouse name, address, or contact details",
  })
  async updateWarehouse(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateWarehouseSchema))
    body: UpdateWarehouseInput,
  ): Promise<IApiResponse<any>> {
    const warehouse = await this.warehouseService.updateWarehouse(
      business.id,
      id,
      body,
    );
    return {
      success: true,
      data: warehouse,
    };
  }

  @Patch("warehouses/:id/active")
  @ApiOperation({
    summary: "Activate or deactivate a warehouse facility",
  })
  @ApiQuery({ name: "isActive", required: true, type: Boolean })
  async setWarehouseActive(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") id: string,
    @Query("isActive") isActive: string,
  ): Promise<IApiResponse<any>> {
    const active = isActive === "true" || isActive === "1";
    const warehouse = await this.warehouseService.setWarehouseActive(
      business.id,
      id,
      active,
    );
    return {
      success: true,
      data: warehouse,
    };
  }

  // ===========================================================================
  // 2. Supplier Product Listings
  // ===========================================================================

  @Post("listings")
  @ApiOperation({
    summary: "Create a new supplier catalog listing linked to MasterProduct",
  })
  async createListing(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateSupplierProductSchema))
    body: CreateSupplierProductInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const listing = await this.inventoryService.createListing(
      business.id,
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: listing,
    };
  }

  @Get("listings")
  @ApiOperation({
    summary:
      "List supplier catalog products with search, pagination, and stock status filters",
  })
  async listListings(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(SupplierProductQuerySchema))
    query: SupplierProductQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.inventoryService.listListings(business.id, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get("listings/:id")
  @ApiOperation({
    summary: "Get supplier listing details and warehouse stock distribution",
  })
  async getListingById(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") id: string,
  ): Promise<IApiResponse<any>> {
    const listing = await this.inventoryService.getListingById(business.id, id);
    return {
      success: true,
      data: listing,
    };
  }

  @Put("listings/:id")
  @ApiOperation({
    summary: "Update supplier listing price, MOQ, lead time, and visibility",
  })
  async updateListing(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSupplierProductSchema))
    body: UpdateSupplierProductInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const listing = await this.inventoryService.updateListing(
      business.id,
      id,
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: listing,
    };
  }

  // ===========================================================================
  // 3. Multi-Warehouse Inventory & Real-Time Stock Control
  // ===========================================================================

  @Get("inventory")
  @ApiOperation({
    summary: "Query warehouse stock levels with low-stock filter and search",
  })
  async getWarehouseInventory(
    @CurrentBusiness() business: BusinessContext,
    @Query(new ZodValidationPipe(WarehouseInventoryQuerySchema))
    query: WarehouseInventoryQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.inventoryService.getWarehouseInventory(
      business.id,
      query,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get("inventory/:id")
  @ApiOperation({
    summary: "Get inventory details for a specific warehouse and product",
  })
  async getInventoryDetail(
    @CurrentBusiness() business: BusinessContext,
    @Param("id") id: string,
  ): Promise<IApiResponse<any>> {
    const inventory = await this.inventoryService.getInventoryDetail(
      business.id,
      id,
    );
    return {
      success: true,
      data: inventory,
    };
  }

  @Post("inventory/adjust")
  @ApiOperation({
    summary:
      "Atomically adjust warehouse stock with auditable ledger (Never allows negative stock)",
  })
  async adjustStock(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(AdjustInventorySchema))
    body: AdjustInventoryInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const inventory = await this.inventoryService.adjustStock(
      business.id,
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: inventory,
    };
  }

  @Get("inventory/movements/:productId")
  @ApiOperation({
    summary: "View chronological stock movement ledger for a product",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getMovementHistory(
    @CurrentBusiness() business: BusinessContext,
    @Param("productId") productId: string,
    @Query("limit") limit?: string,
  ): Promise<IApiResponse<any>> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const movements = await this.inventoryService.getMovementHistory(
      business.id,
      productId,
      limitNum,
    );
    return {
      success: true,
      data: movements,
    };
  }

  // ===========================================================================
  // 4. Bulk CSV / Excel Import Engine
  // ===========================================================================

  @Post("inventory/import/preview")
  @ApiOperation({
    summary:
      "Upload CSV catalog file and generate validation preview without modifying live inventory",
  })
  async previewCsvImport(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(UploadCsvImportSchema))
    body: UploadCsvImportInput,
  ): Promise<IApiResponse<any>> {
    const report = await this.importService.previewCsvImport(
      business.id,
      user.id,
      body,
    );
    return {
      success: true,
      data: report,
    };
  }

  @Post("inventory/import/execute")
  @ApiOperation({
    summary:
      "Execute staged import job committing valid rows into live inventory",
  })
  async executeImportJob(
    @CurrentBusiness() business: BusinessContext,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(ExecuteImportJobSchema))
    body: ExecuteImportJobInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const result = await this.importService.executeImportJob(
      business.id,
      user.id,
      body.jobId,
      meta,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get("inventory/import/:jobId")
  @ApiOperation({
    summary: "Get bulk import job progress, status, and detailed error report",
  })
  async getImportJob(
    @CurrentBusiness() business: BusinessContext,
    @Param("jobId") jobId: string,
  ): Promise<IApiResponse<any>> {
    const job = await this.importService.getImportJob(business.id, jobId);
    return {
      success: true,
      data: job,
    };
  }
}
