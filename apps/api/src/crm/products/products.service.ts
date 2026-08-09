import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tipo?: "produto" | "servico") {
    return this.tenantPrisma.product.findMany({
      ...(tipo ? { where: { tipo } } : {}),
      orderBy: { nome: "asc" },
    });
  }

  async get(id: string) {
    const product = await this.tenantPrisma.product.findFirst({ where: { id } });
    if (!product) {
      throw new NotFoundException("Produto/serviço não encontrado.");
    }
    return product;
  }

  async create(dto: CreateProductDto, actorId: string) {
    const product = await this.tenantPrisma.product.create({
      data: { nome: dto.nome, tipo: dto.tipo, descricaoCurta: dto.descricaoCurta ?? null, preco: dto.preco },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      newData: { nome: product.nome, tipo: product.tipo },
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    await this.get(id);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.descricaoCurta !== undefined) data.descricaoCurta = dto.descricaoCurta;
    if (dto.preco !== undefined) data.preco = dto.preco;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.tenantPrisma.product.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "product.update",
      entity: "Product",
      entityId: id,
      newData: { nome: dto.nome, tipo: dto.tipo, preco: dto.preco, ativo: dto.ativo },
    });

    return updated;
  }
}
