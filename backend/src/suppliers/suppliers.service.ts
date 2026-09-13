import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly systemAuditService: SystemAuditService,
  ) {}

  async getAllSuppliers(query?: QuerySuppliersDto) {
    const where: Prisma.SupplierWhereInput = {};

    if (query?.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { inn: { contains: q, mode: 'insensitive' } },
        { contractNumber: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { invoices: true, itemInstances: true, movements: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSupplierStats() {
    const [totalSuppliers, totalInvoices, invoicesWithAmount] = await Promise.all([
      this.prisma.supplier.count(),
      this.prisma.invoice.count(),
      this.prisma.invoice.findMany({
        select: { totalAmount: true },
      }),
    ]);

    const totalInvoiceAmount = invoicesWithAmount.reduce((sum, inv) => {
      const val = inv.totalAmount ? Number(inv.totalAmount) : 0;
      return sum + val;
    }, 0);

    const activeContractsCount = await this.prisma.supplier.count({
      where: { contractNumber: { not: null } },
    });

    return {
      totalSuppliers,
      activeContractsCount,
      totalInvoices,
      totalInvoiceAmount,
    };
  }

  async getSupplierById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { invoiceDate: 'desc' },
          include: {
            _count: { select: { instances: true } },
          },
        },
        itemInstances: {
          include: {
            item: { select: { name: true, model: true, unit: true } },
            room: { select: { number: true, name: true, building: true } },
          },
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          include: {
            toWarehouse: { select: { name: true } },
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { invoices: true, itemInstances: true, movements: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Ta’minotchi topilmadi!');
    }

    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto, executorId?: string) {
    const count = await this.prisma.supplier.count();

    const finalInn = dto.inn?.trim() || this.codeGen.generateINN(count + 1);
    const finalContract =
      dto.contractNumber?.trim() || this.codeGen.generateContractNumber(count + 1);

    if (dto.inn && dto.inn.trim().length > 0) {
      const existing = await this.prisma.supplier.findFirst({
        where: { inn: dto.inn.trim() },
      });
      if (existing) {
        throw new ConflictException(`Ushbu STIR (INN: ${dto.inn}) bo‘yicha ta’minotchi allaqachon mavjud!`);
      }
    }

    const newSupplier = await this.prisma.$transaction(async (tx) => {
      return tx.supplier.create({
        data: {
          name: dto.name.trim(),
          inn: finalInn,
          contractNumber: finalContract,
          contractDate: dto.contractDate ? new Date(dto.contractDate) : new Date(),
          contactPerson: dto.contactPerson?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          notes: dto.notes?.trim() || null,
        },
      });
    });

    if (executorId) {
      await this.systemAuditService.log({
        action: 'SUPPLIER_CREATED',
        entity: 'Supplier',
        entityId: newSupplier.id,
        userId: executorId,
        details: {
          name: newSupplier.name,
          inn: newSupplier.inn,
          contractNumber: newSupplier.contractNumber,
        },
      });
    }

    return newSupplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, executorId?: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tahrirlanayotgan ta’minotchi topilmadi!');
    }

    if (dto.inn && dto.inn.trim() !== existing.inn) {
      const duplicate = await this.prisma.supplier.findFirst({
        where: { inn: dto.inn.trim(), id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(`Ushbu STIR (INN: ${dto.inn}) boshqa ta’minotchiga tegishli!`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.supplier.update({
        where: { id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          inn: dto.inn !== undefined ? (dto.inn ? dto.inn.trim() : null) : undefined,
          contractNumber:
            dto.contractNumber !== undefined
              ? dto.contractNumber
                ? dto.contractNumber.trim()
                : null
              : undefined,
          contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
          contactPerson:
            dto.contactPerson !== undefined
              ? dto.contactPerson
                ? dto.contactPerson.trim()
                : null
              : undefined,
          phone: dto.phone !== undefined ? (dto.phone ? dto.phone.trim() : null) : undefined,
          email:
            dto.email !== undefined
              ? dto.email
                ? dto.email.trim().toLowerCase()
                : null
              : undefined,
          notes: dto.notes !== undefined ? (dto.notes ? dto.notes.trim() : null) : undefined,
        },
      });
    });

    if (executorId) {
      await this.systemAuditService.log({
        action: 'SUPPLIER_UPDATED',
        entity: 'Supplier',
        entityId: updated.id,
        userId: executorId,
        details: {
          name: updated.name,
          inn: updated.inn,
          contractNumber: updated.contractNumber,
        },
      });
    }

    return updated;
  }

  async deleteSupplier(id: string, executorId?: string) {
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoices: true, itemInstances: true, movements: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('O‘chirilayotgan ta’minotchi topilmadi!');
    }

    if (
      existing._count.itemInstances > 0 ||
      existing._count.movements > 0 ||
      existing._count.invoices > 0
    ) {
      throw new BadRequestException(
        `Ushbu ta’minotchiga biriktirilgan ashyolar (${existing._count.itemInstances} ta), ombor harakatlari (${existing._count.movements} ta) yoki hisob-fakturalar (${existing._count.invoices} ta) mavjud. Ma’lumotlar butunligi uchun uni o‘chirish taqiqlanadi!`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.delete({ where: { id } });
    });

    if (executorId) {
      await this.systemAuditService.log({
        action: 'SUPPLIER_DELETED',
        entity: 'Supplier',
        entityId: id,
        userId: executorId,
        details: {
          name: existing.name,
          inn: existing.inn,
          contractNumber: existing.contractNumber,
        },
      });
    }

    return { success: true, message: 'Ta’minotchi muvaffaqiyatli o‘chirildi' };
  }

  async createInvoice(supplierId: string, dto: CreateInvoiceDto, executorId?: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException('Ta’minotchi topilmadi!');
    }

    const cleanInvoiceNumber = dto.invoiceNumber.trim();
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: cleanInvoiceNumber },
    });

    if (existingInvoice) {
      throw new ConflictException(
        `Faktura raqami ${cleanInvoiceNumber} allaqachon ro‘yxatga olingan!`,
      );
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          invoiceNumber: cleanInvoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          totalAmount: dto.totalAmount !== undefined ? new Prisma.Decimal(dto.totalAmount) : null,
          notes: dto.notes?.trim() || null,
          supplierId,
        },
      });
    });

    if (executorId) {
      await this.systemAuditService.log({
        action: 'INVOICE_CREATED',
        entity: 'Invoice',
        entityId: invoice.id,
        userId: executorId,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          supplier: supplier.name,
          totalAmount: invoice.totalAmount,
        },
      });
    }

    return invoice;
  }

  async getSupplierInvoices(supplierId: string) {
    await this.getSupplierById(supplierId);
    return this.prisma.invoice.findMany({
      where: { supplierId },
      include: {
        _count: { select: { instances: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async getNextCodes() {
    const count = await this.prisma.supplier.count();
    return {
      nextInn: this.codeGen.generateINN(count + 1),
      nextContractNumber: this.codeGen.generateContractNumber(count + 1),
      nextInvoiceNumber: this.codeGen.generateInvoiceNumber(count + 1),
    };
  }
}
