import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@asn/database";
import { createLogger } from "@asn/logger";
import { CreateWarehouseInput, UpdateWarehouseInput } from "@asn/validators";
import { SupplierWarehouseDto } from "@asn/types";

@Injectable()
export class SupplierWarehouseService {
  private readonly logger = createLogger("SupplierWarehouseService");

  async createWarehouse(
    businessId: string,
    input: CreateWarehouseInput,
  ): Promise<SupplierWarehouseDto> {
    const existingCode = await prisma.supplierWarehouse.findUnique({
      where: {
        businessId_code: {
          businessId,
          code: input.code.trim().toUpperCase(),
        },
      },
    });

    if (existingCode) {
      throw new ConflictException(
        `Warehouse with code '${input.code}' already exists for your business.`,
      );
    }

    // If marked as primary, reset existing primary warehouse for this business
    if (input.isPrimary) {
      await prisma.supplierWarehouse.updateMany({
        where: { businessId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const warehouse = await prisma.supplierWarehouse.create({
      data: {
        businessId,
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        addressLine1: input.addressLine1.trim(),
        addressLine2: input.addressLine2?.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postalCode: input.postalCode.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        contactPhone: input.contactPhone?.trim(),
        contactEmail: input.contactEmail?.trim(),
        isPrimary: input.isPrimary ?? false,
        isActive: input.isActive ?? true,
      },
    });

    this.logger.info(
      `Warehouse created: ${warehouse.name} (${warehouse.code})`,
      {
        businessId,
        warehouseId: warehouse.id,
      },
    );

    return this.mapWarehouseDto(warehouse);
  }

  async listWarehouses(businessId: string): Promise<SupplierWarehouseDto[]> {
    const warehouses = await prisma.supplierWarehouse.findMany({
      where: { businessId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    return warehouses.map((w) => ({
      ...this.mapWarehouseDto(w),
      inventoryCount: w._count.inventories,
    }));
  }

  async getWarehouseById(
    businessId: string,
    warehouseId: string,
  ): Promise<SupplierWarehouseDto> {
    const warehouse = await prisma.supplierWarehouse.findFirst({
      where: { id: warehouseId, businessId },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID '${warehouseId}' not found for your business.`,
      );
    }

    return {
      ...this.mapWarehouseDto(warehouse),
      inventoryCount: warehouse._count.inventories,
    };
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: UpdateWarehouseInput,
  ): Promise<SupplierWarehouseDto> {
    const warehouse = await prisma.supplierWarehouse.findFirst({
      where: { id: warehouseId, businessId },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID '${warehouseId}' not found for your business.`,
      );
    }

    if (input.code && input.code.trim().toUpperCase() !== warehouse.code) {
      const duplicateCode = await prisma.supplierWarehouse.findUnique({
        where: {
          businessId_code: {
            businessId,
            code: input.code.trim().toUpperCase(),
          },
        },
      });
      if (duplicateCode) {
        throw new ConflictException(
          `Warehouse code '${input.code}' is already used by another warehouse.`,
        );
      }
    }

    if (input.isPrimary && !warehouse.isPrimary) {
      await prisma.supplierWarehouse.updateMany({
        where: { businessId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.supplierWarehouse.update({
      where: { id: warehouseId },
      data: {
        name: input.name?.trim(),
        code: input.code?.trim().toUpperCase(),
        addressLine1: input.addressLine1?.trim(),
        addressLine2:
          input.addressLine2 !== undefined
            ? input.addressLine2?.trim()
            : undefined,
        city: input.city?.trim(),
        state: input.state?.trim(),
        postalCode: input.postalCode?.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        contactPhone:
          input.contactPhone !== undefined
            ? input.contactPhone?.trim()
            : undefined,
        contactEmail:
          input.contactEmail !== undefined
            ? input.contactEmail?.trim()
            : undefined,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
      },
    });

    return this.mapWarehouseDto(updated);
  }

  async setWarehouseActive(
    businessId: string,
    warehouseId: string,
    isActive: boolean,
  ): Promise<SupplierWarehouseDto> {
    const warehouse = await prisma.supplierWarehouse.findFirst({
      where: { id: warehouseId, businessId },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID '${warehouseId}' not found.`,
      );
    }

    if (!isActive && warehouse.isPrimary) {
      throw new BadRequestException(
        "Cannot deactivate primary warehouse. Designate another warehouse as primary first.",
      );
    }

    const updated = await prisma.supplierWarehouse.update({
      where: { id: warehouseId },
      data: { isActive },
    });

    return this.mapWarehouseDto(updated);
  }

  private mapWarehouseDto(w: any): SupplierWarehouseDto {
    return {
      id: w.id,
      businessId: w.businessId,
      name: w.name,
      code: w.code,
      addressLine1: w.addressLine1,
      addressLine2: w.addressLine2,
      city: w.city,
      state: w.state,
      postalCode: w.postalCode,
      latitude: w.latitude,
      longitude: w.longitude,
      contactPhone: w.contactPhone,
      contactEmail: w.contactEmail,
      isPrimary: w.isPrimary,
      isActive: w.isActive,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }
}
