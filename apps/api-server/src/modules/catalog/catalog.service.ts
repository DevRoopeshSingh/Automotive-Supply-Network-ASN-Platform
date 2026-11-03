import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { prisma } from "@asn/database";
import { normalizePartNumber } from "@asn/utils";
import { createLogger } from "@asn/logger";
import { AuditService } from "../../common/audit/audit.service";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
  CreateCategoryInput,
  AddFitmentInput,
  AddOemReferenceInput,
  AddProductMediaInput,
} from "@asn/validators";
import {
  ProductStatus,
  ProductCondition,
  MediaType,
  CategoryNode,
  VehicleSegment,
} from "@asn/types";

@Injectable()
export class CatalogService {
  private readonly logger = createLogger("CatalogService");

  constructor(private readonly auditService: AuditService) {}

  // ===========================================================================
  // 1. Product Master Operations
  // ===========================================================================

  async createProduct(
    userId: string,
    input: CreateProductInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const brand = await prisma.brand.findUnique({
      where: { id: input.brandId },
    });
    if (!brand) {
      throw new NotFoundException(
        `Brand with ID '${input.brandId}' not found.`,
      );
    }

    const category = await prisma.productCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID '${input.categoryId}' not found.`,
      );
    }

    const normalizedPartNumber = normalizePartNumber(input.partNumber);
    const normalizedOemNumber = input.oemNumber
      ? normalizePartNumber(input.oemNumber)
      : null;

    // Check for duplicate part number within the same brand
    const existing = await prisma.masterProduct.findFirst({
      where: {
        brandId: input.brandId,
        OR: [{ partNumber: input.partNumber }, { normalizedPartNumber }],
      },
    });

    if (existing) {
      throw new ConflictException(
        `Product with part number '${input.partNumber}' already exists for brand '${brand.name}'.`,
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.masterProduct.create({
        data: {
          partNumber: input.partNumber.trim(),
          normalizedPartNumber,
          oemNumber: input.oemNumber ? input.oemNumber.trim() : null,
          normalizedOemNumber,
          brandId: input.brandId,
          categoryId: input.categoryId,
          name: input.name.trim(),
          description: input.description?.trim(),
          conditionType: input.conditionType as ProductCondition,
          status: input.status as ProductStatus,
          isSafetyCritical: input.isSafetyCritical,
          unitOfMeasure: input.unitOfMeasure,
          specifications: input.specifications as any,
          dimensions: input.dimensions as any,
          barcode: input.barcode?.trim(),
        },
        include: {
          brand: true,
          category: true,
        },
      });

      // If OEM number provided, register an initial OEM reference
      if (input.oemNumber && normalizedOemNumber) {
        await tx.oEMPartReference.create({
          data: {
            masterProductId: created.id,
            oemNumber: input.oemNumber.trim(),
            normalizedOemNumber,
            notes: "Primary OEM reference from product creation",
          },
        });
      }

      return created;
    });

    this.logger.info(
      `Product master created: ${product.name} (${product.partNumber})`,
      {
        productId: product.id,
        brandId: product.brandId,
      },
    );

    await this.auditService.log({
      userId,
      action: "CATALOG_PRODUCT_CREATED",
      resource: `MasterProduct:${product.id}`,
      payload: {
        partNumber: product.partNumber,
        brand: brand.name,
        name: product.name,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.getProductById(product.id);
  }

  async updateProduct(
    id: string,
    userId: string,
    input: UpdateProductInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const product = await prisma.masterProduct.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    const targetBrandId = input.brandId ?? product.brandId;
    let normalizedPartNumber = product.normalizedPartNumber;
    let normalizedOemNumber = product.normalizedOemNumber;

    if (input.partNumber) {
      normalizedPartNumber = normalizePartNumber(input.partNumber);
      // Check for duplicate part number in target brand
      const duplicate = await prisma.masterProduct.findFirst({
        where: {
          id: { not: id },
          brandId: targetBrandId,
          OR: [{ partNumber: input.partNumber }, { normalizedPartNumber }],
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Another product with part number '${input.partNumber}' already exists for this brand.`,
        );
      }
    }

    if (input.oemNumber !== undefined) {
      normalizedOemNumber = input.oemNumber
        ? normalizePartNumber(input.oemNumber)
        : null;
    }

    const updated = await prisma.masterProduct.update({
      where: { id },
      data: {
        partNumber: input.partNumber ? input.partNumber.trim() : undefined,
        normalizedPartNumber: input.partNumber
          ? normalizedPartNumber
          : undefined,
        oemNumber:
          input.oemNumber !== undefined
            ? input.oemNumber
              ? input.oemNumber.trim()
              : null
            : undefined,
        normalizedOemNumber:
          input.oemNumber !== undefined ? normalizedOemNumber : undefined,
        brandId: input.brandId,
        categoryId: input.categoryId,
        name: input.name ? input.name.trim() : undefined,
        description:
          input.description !== undefined
            ? input.description?.trim()
            : undefined,
        conditionType: input.conditionType as ProductCondition,
        status: input.status as ProductStatus,
        isSafetyCritical: input.isSafetyCritical,
        unitOfMeasure: input.unitOfMeasure,
        specifications: input.specifications as any,
        dimensions: input.dimensions as any,
        barcode:
          input.barcode !== undefined ? input.barcode?.trim() : undefined,
      },
    });

    await this.auditService.log({
      userId,
      action: "CATALOG_PRODUCT_UPDATED",
      resource: `MasterProduct:${updated.id}`,
      payload: { updatedFields: Object.keys(input) },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.getProductById(id);
  }

  async updateProductStatus(
    id: string,
    status: ProductStatus,
    userId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const product = await prisma.masterProduct.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    const updated = await prisma.masterProduct.update({
      where: { id },
      data: { status },
    });

    await this.auditService.log({
      userId,
      action: "CATALOG_PRODUCT_STATUS_UPDATED",
      resource: `MasterProduct:${updated.id}`,
      payload: { previousStatus: product.status, newStatus: status },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async getProductById(id: string) {
    const product = await prisma.masterProduct.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        media: {
          orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
        },
        oemReferences: {
          include: {
            vehicleMake: true,
          },
        },
        fitments: {
          include: {
            vehicleVariant: {
              include: {
                model: {
                  include: {
                    make: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    return this.formatProductDetail(product);
  }

  async listProducts(query: ProductQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by status (default ACTIVE if not specified)
    where.status = query.status || ProductStatus.ACTIVE;

    if (query.brandId) {
      where.brandId = query.brandId;
    }

    if (query.conditionType) {
      where.conditionType = query.conditionType;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.categorySlug) {
      // Find category and its child categories
      const cat = await prisma.productCategory.findUnique({
        where: { slug: query.categorySlug },
        include: { children: true },
      });
      if (cat) {
        const catIds = [cat.id, ...cat.children.map((c) => c.id)];
        where.categoryId = { in: catIds };
      }
    }

    // Search query across name, part number, normalized part number, OEM number, brand name
    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      const normQ = normalizePartNumber(q);

      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { partNumber: { contains: q, mode: "insensitive" } },
        { normalizedPartNumber: { contains: normQ } },
        { oemNumber: { contains: q, mode: "insensitive" } },
        { normalizedOemNumber: { contains: normQ } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        {
          oemReferences: { some: { normalizedOemNumber: { contains: normQ } } },
        },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.masterProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          brand: true,
          category: true,
          media: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      }),
      prisma.masterProduct.count({ where }),
    ]);

    return {
      items: products.map((p) => this.formatProductSummary(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ===========================================================================
  // 2. Product Categories
  // ===========================================================================

  async listCategories(parentId?: string | null) {
    const where: any = { isActive: true };
    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    return prisma.productCategory.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  }

  async getCategoryTree(): Promise<CategoryNode[]> {
    const allCategories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    const categoryMap = new Map<string, CategoryNode>();
    allCategories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        isActive: cat.isActive,
        displayOrder: cat.displayOrder,
        parentId: cat.parentId,
        children: [],
      });
    });

    const rootNodes: CategoryNode[] = [];
    allCategories.forEach((cat) => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children!.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  async createCategory(input: CreateCategoryInput) {
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    const existingSlug = await prisma.productCategory.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Category slug '${slug}' already exists.`);
    }

    if (input.parentId) {
      const parent = await prisma.productCategory.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID '${input.parentId}' not found.`,
        );
      }
    }

    return prisma.productCategory.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim(),
        imageUrl: input.imageUrl,
        parentId: input.parentId,
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }

  // ===========================================================================
  // 3. Vehicle Fitment Database & Compatibility Engine
  // ===========================================================================

  async getVehicleMakes(segment?: VehicleSegment) {
    return prisma.vehicleMake.findMany({
      where: {
        isActive: true,
        segment: segment ? (segment as any) : undefined,
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { models: true },
        },
      },
    });
  }

  async getModelsByMake(makeId: string) {
    const make = await prisma.vehicleMake.findUnique({
      where: { id: makeId },
    });
    if (!make) {
      throw new NotFoundException(
        `Vehicle make with ID '${makeId}' not found.`,
      );
    }

    return prisma.vehicleModel.findMany({
      where: { makeId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { variants: true },
        },
      },
    });
  }

  async getVariantsByModel(modelId: string) {
    const model = await prisma.vehicleModel.findUnique({
      where: { id: modelId },
    });
    if (!model) {
      throw new NotFoundException(
        `Vehicle model with ID '${modelId}' not found.`,
      );
    }

    return prisma.vehicleVariant.findMany({
      where: { modelId, isActive: true },
      orderBy: [{ startYear: "desc" }, { variantName: "asc" }],
    });
  }

  async getVariantById(variantId: string) {
    const variant = await prisma.vehicleVariant.findUnique({
      where: { id: variantId },
      include: {
        model: {
          include: {
            make: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Vehicle variant with ID '${variantId}' not found.`,
      );
    }

    return variant;
  }

  async addFitment(productId: string, input: AddFitmentInput) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found.`);
    }

    const variant = await prisma.vehicleVariant.findUnique({
      where: { id: input.vehicleVariantId },
    });
    if (!variant) {
      throw new NotFoundException(
        `Vehicle variant with ID '${input.vehicleVariantId}' not found.`,
      );
    }

    // Check duplicate
    const existing = await prisma.productFitment.findUnique({
      where: {
        masterProductId_vehicleVariantId: {
          masterProductId: productId,
          vehicleVariantId: input.vehicleVariantId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        "Fitment mapping for this vehicle variant already exists on this product.",
      );
    }

    // Validate fitment year bounds against variant year bounds
    if (input.fitmentStartYear && input.fitmentStartYear < variant.startYear) {
      throw new BadRequestException(
        `Fitment start year (${input.fitmentStartYear}) cannot precede vehicle variant start year (${variant.startYear}).`,
      );
    }
    if (
      input.fitmentEndYear &&
      variant.endYear &&
      input.fitmentEndYear > variant.endYear
    ) {
      throw new BadRequestException(
        `Fitment end year (${input.fitmentEndYear}) cannot exceed vehicle variant end year (${variant.endYear}).`,
      );
    }

    return prisma.productFitment.create({
      data: {
        masterProductId: productId,
        vehicleVariantId: input.vehicleVariantId,
        position: input.position?.trim(),
        fitmentStartYear: input.fitmentStartYear,
        fitmentEndYear: input.fitmentEndYear,
        isVerified: input.isVerified ?? true,
        notes: input.notes?.trim(),
      },
      include: {
        vehicleVariant: {
          include: {
            model: {
              include: {
                make: true,
              },
            },
          },
        },
      },
    });
  }

  async addOemReference(productId: string, input: AddOemReferenceInput) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found.`);
    }

    if (input.vehicleMakeId) {
      const make = await prisma.vehicleMake.findUnique({
        where: { id: input.vehicleMakeId },
      });
      if (!make) {
        throw new NotFoundException(
          `Vehicle make with ID '${input.vehicleMakeId}' not found.`,
        );
      }
    }

    const normalizedOemNumber = normalizePartNumber(input.oemNumber);

    const existing = await prisma.oEMPartReference.findUnique({
      where: {
        masterProductId_normalizedOemNumber: {
          masterProductId: productId,
          normalizedOemNumber,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `OEM reference '${input.oemNumber}' already exists for this product.`,
      );
    }

    return prisma.oEMPartReference.create({
      data: {
        masterProductId: productId,
        oemNumber: input.oemNumber.trim(),
        normalizedOemNumber,
        vehicleMakeId: input.vehicleMakeId,
        notes: input.notes?.trim(),
      },
      include: {
        vehicleMake: true,
      },
    });
  }

  async addProductMedia(productId: string, input: AddProductMediaInput) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found.`);
    }

    if (input.isPrimary) {
      // Unset previous primary image
      await prisma.productMedia.updateMany({
        where: { masterProductId: productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return prisma.productMedia.create({
      data: {
        masterProductId: productId,
        url: input.url.trim(),
        mediaType: input.mediaType as MediaType,
        altText: input.altText?.trim(),
        isPrimary: input.isPrimary ?? false,
        displayOrder: input.displayOrder ?? 0,
      },
    });
  }

  /**
   * Compatibility Engine: Finds all verified compatible products for a given
   * vehicle variant and optional manufacturing year.
   */
  async getCompatibleProducts(
    variantId: string,
    year?: number,
    categoryId?: string,
  ) {
    const variant = await this.getVariantById(variantId);

    // If a specific year is queried, verify that it falls within the vehicle variant's production span
    if (year !== undefined) {
      if (
        year < variant.startYear ||
        (variant.endYear && year > variant.endYear)
      ) {
        return {
          vehicleVariant: variant,
          queryYear: year,
          compatibleProductsCount: 0,
          products: [],
        };
      }
    }

    // Build fitment filter
    const fitmentWhere: any = {
      vehicleVariantId: variantId,
      isVerified: true,
      masterProduct: {
        status: ProductStatus.ACTIVE,
        ...(categoryId ? { categoryId } : {}),
      },
    };

    if (year !== undefined) {
      fitmentWhere.AND = [
        {
          OR: [{ fitmentStartYear: null }, { fitmentStartYear: { lte: year } }],
        },
        {
          OR: [{ fitmentEndYear: null }, { fitmentEndYear: { gte: year } }],
        },
      ];
    }

    const fitments = await prisma.productFitment.findMany({
      where: fitmentWhere,
      include: {
        masterProduct: {
          include: {
            brand: true,
            category: true,
            media: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        masterProduct: {
          name: "asc",
        },
      },
    });

    const products = fitments.map((f) =>
      this.formatProductSummary(f.masterProduct),
    );

    return {
      vehicleVariant: variant,
      queryYear: year,
      compatibleProductsCount: products.length,
      products,
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private formatProductSummary(p: any) {
    return {
      id: p.id,
      partNumber: p.partNumber,
      normalizedPartNumber: p.normalizedPartNumber,
      oemNumber: p.oemNumber,
      normalizedOemNumber: p.normalizedOemNumber,
      name: p.name,
      conditionType: p.conditionType,
      status: p.status,
      isSafetyCritical: p.isSafetyCritical,
      unitOfMeasure: p.unitOfMeasure,
      brand: {
        id: p.brand.id,
        name: p.brand.name,
        isOem: p.brand.isOem,
      },
      category: {
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
      },
      primaryImageUrl: p.media?.[0]?.url || null,
    };
  }

  private formatProductDetail(p: any) {
    return {
      ...this.formatProductSummary(p),
      description: p.description,
      specifications: p.specifications,
      dimensions: p.dimensions,
      barcode: p.barcode,
      media: (p.media || []).map((m: any) => ({
        id: m.id,
        url: m.url,
        mediaType: m.mediaType,
        altText: m.altText,
        isPrimary: m.isPrimary,
        displayOrder: m.displayOrder,
      })),
      oemReferences: (p.oemReferences || []).map((o: any) => ({
        id: o.id,
        oemNumber: o.oemNumber,
        normalizedOemNumber: o.normalizedOemNumber,
        vehicleMakeId: o.vehicleMakeId,
        vehicleMakeName: o.vehicleMake?.name || null,
        notes: o.notes,
      })),
      fitments: (p.fitments || []).map((f: any) => ({
        id: f.id,
        masterProductId: f.masterProductId,
        vehicleVariantId: f.vehicleVariantId,
        position: f.position,
        fitmentStartYear: f.fitmentStartYear,
        fitmentEndYear: f.fitmentEndYear,
        isVerified: f.isVerified,
        notes: f.notes,
        vehicleVariant: f.vehicleVariant
          ? {
              id: f.vehicleVariant.id,
              modelId: f.vehicleVariant.modelId,
              variantName: f.vehicleVariant.variantName,
              startYear: f.vehicleVariant.startYear,
              endYear: f.vehicleVariant.endYear,
              fuelType: f.vehicleVariant.fuelType,
              engine: f.vehicleVariant.engine,
              engineCapacity: f.vehicleVariant.engineCapacity,
              transmission: f.vehicleVariant.transmission,
              isActive: f.vehicleVariant.isActive,
              model: {
                id: f.vehicleVariant.model.id,
                name: f.vehicleVariant.model.name,
                make: {
                  id: f.vehicleVariant.model.make.id,
                  name: f.vehicleVariant.model.make.name,
                  segment: f.vehicleVariant.model.make.segment,
                },
              },
            }
          : undefined,
      })),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
