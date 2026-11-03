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
  ApiQuery,
} from "@nestjs/swagger";
import { Request } from "express";
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireRoles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateProductSchema,
  CreateProductInput,
  UpdateProductSchema,
  UpdateProductInput,
  ProductStatusUpdateSchema,
  ProductStatusUpdateInput,
  ProductQuerySchema,
  ProductQueryInput,
  CreateCategorySchema,
  CreateCategoryInput,
  AddFitmentSchema,
  AddFitmentInput,
  AddOemReferenceSchema,
  AddOemReferenceInput,
  AddProductMediaSchema,
  AddProductMediaInput,
  VehicleCompatibilityQuerySchema,
  VehicleCompatibilityQueryInput,
} from "@asn/validators";
import {
  UserContext,
  UserRole,
  ApiResponse as IApiResponse,
  VehicleSegment,
} from "@asn/types";

@ApiTags("Catalog & Vehicle Fitment")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ===========================================================================
  // Public / Buyer-Facing Catalog Read Endpoints
  // ===========================================================================

  @Get("products")
  @ApiOperation({
    summary:
      "List master catalog products with search, filtering, and pagination",
  })
  async listProducts(
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQueryInput,
  ): Promise<IApiResponse<any>> {
    const result = await this.catalogService.listProducts(query);
    return {
      success: true,
      data: result,
    };
  }

  @Get("products/search")
  @ApiOperation({
    summary:
      "Quick search products by part number, OEM reference, brand, or name",
  })
  @ApiQuery({ name: "q", required: true, description: "Search term" })
  @ApiQuery({ name: "limit", required: false, description: "Max results" })
  async searchProducts(
    @Query("q") q: string,
    @Query("limit") limit?: string,
  ): Promise<IApiResponse<any>> {
    const result = await this.catalogService.listProducts({
      q: q || "",
      limit: limit ? parseInt(limit, 10) : 20,
      page: 1,
    });
    return {
      success: true,
      data: result,
    };
  }

  @Get("products/:id")
  @ApiOperation({
    summary:
      "Get detailed master product information including fitments and OEM references",
  })
  async getProductById(@Param("id") id: string): Promise<IApiResponse<any>> {
    const product = await this.catalogService.getProductById(id);
    return {
      success: true,
      data: product,
    };
  }

  @Get("categories")
  @ApiOperation({
    summary:
      "List product categories (flat list, optionally filtered by parent)",
  })
  @ApiQuery({ name: "parentId", required: false })
  async listCategories(
    @Query("parentId") parentId?: string,
  ): Promise<IApiResponse<any>> {
    const categories = await this.catalogService.listCategories(parentId);
    return {
      success: true,
      data: categories,
    };
  }

  @Get("categories/tree")
  @ApiOperation({
    summary: "Get the complete hierarchical product category tree",
  })
  async getCategoryTree(): Promise<IApiResponse<any>> {
    const tree = await this.catalogService.getCategoryTree();
    return {
      success: true,
      data: tree,
    };
  }

  // ===========================================================================
  // Vehicle Fitment & Compatibility Engine
  // ===========================================================================

  @Get("vehicles/makes")
  @ApiOperation({
    summary:
      "List all active vehicle makes (Hyundai, Maruti Suzuki, Tata, etc.)",
  })
  @ApiQuery({
    name: "segment",
    required: false,
    enum: ["CAR", "TWO_WHEELER", "COMMERCIAL_VEHICLE"],
  })
  async getVehicleMakes(
    @Query("segment") segment?: VehicleSegment,
  ): Promise<IApiResponse<any>> {
    const makes = await this.catalogService.getVehicleMakes(segment);
    return {
      success: true,
      data: makes,
    };
  }

  @Get("vehicles/makes/:makeId/models")
  @ApiOperation({
    summary:
      "List vehicle models for a specific make (Creta, Swift, Nexon, etc.)",
  })
  async getModelsByMake(
    @Param("makeId") makeId: string,
  ): Promise<IApiResponse<any>> {
    const models = await this.catalogService.getModelsByMake(makeId);
    return {
      success: true,
      data: models,
    };
  }

  @Get("vehicles/models/:modelId/variants")
  @ApiOperation({
    summary:
      "List vehicle variants for a specific model (1.5L CRDi Diesel, etc.)",
  })
  async getVariantsByModel(
    @Param("modelId") modelId: string,
  ): Promise<IApiResponse<any>> {
    const variants = await this.catalogService.getVariantsByModel(modelId);
    return {
      success: true,
      data: variants,
    };
  }

  @Get("vehicles/compatibility")
  @ApiOperation({
    summary:
      "Query verified compatible automotive parts for a vehicle variant and manufacturing year",
  })
  async getCompatibleProducts(
    @Query(new ZodValidationPipe(VehicleCompatibilityQuerySchema))
    query: VehicleCompatibilityQueryInput,
    @Query("categoryId") categoryId?: string,
  ): Promise<IApiResponse<any>> {
    const result = await this.catalogService.getCompatibleProducts(
      query.variantId,
      query.year,
      categoryId,
    );
    return {
      success: true,
      data: result,
    };
  }

  // ===========================================================================
  // Authorized Catalog Management Endpoints
  // ===========================================================================

  @Post("products")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Create a new product master record with normalized part number",
  })
  async createProduct(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProductInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const product = await this.catalogService.createProduct(
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: product,
    };
  }

  @Put("products/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Update an existing product master record",
  })
  async updateProduct(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(UpdateProductSchema)) body: UpdateProductInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const product = await this.catalogService.updateProduct(
      id,
      user.id,
      body,
      meta,
    );
    return {
      success: true,
      data: product,
    };
  }

  @Patch("products/:id/status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Update product status (ACTIVE, INACTIVE, DISCONTINUED, DRAFT)",
  })
  async updateProductStatus(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(ProductStatusUpdateSchema))
    body: ProductStatusUpdateInput,
    @Req() req: Request,
  ): Promise<IApiResponse<any>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const product = await this.catalogService.updateProductStatus(
      id,
      body.status as any,
      user.id,
      meta,
    );
    return {
      success: true,
      data: product,
    };
  }

  @Post("products/:id/fitments")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Attach vehicle variant compatibility/fitment to a product master",
  })
  async addFitment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AddFitmentSchema)) body: AddFitmentInput,
  ): Promise<IApiResponse<any>> {
    const fitment = await this.catalogService.addFitment(id, body);
    return {
      success: true,
      data: fitment,
    };
  }

  @Post("products/:id/oem-references")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Attach an OEM part reference to a product master",
  })
  async addOemReference(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AddOemReferenceSchema))
    body: AddOemReferenceInput,
  ): Promise<IApiResponse<any>> {
    const oemRef = await this.catalogService.addOemReference(id, body);
    return {
      success: true,
      data: oemRef,
    };
  }

  @Post("products/:id/media")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.BUSINESS_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Attach image or diagram media metadata to a product master",
  })
  async addProductMedia(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AddProductMediaSchema))
    body: AddProductMediaInput,
  ): Promise<IApiResponse<any>> {
    const media = await this.catalogService.addProductMedia(id, body);
    return {
      success: true,
      data: media,
    };
  }

  @Post("categories")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(
    UserRole.PLATFORM_SUPER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CATALOG_SPECIALIST,
  )
  @ApiOperation({
    summary: "Create a new product category in the hierarchy",
  })
  async createCategory(
    @Body(new ZodValidationPipe(CreateCategorySchema))
    body: CreateCategoryInput,
  ): Promise<IApiResponse<any>> {
    const category = await this.catalogService.createCategory(body);
    return {
      success: true,
      data: category,
    };
  }
}
