import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { StorageService } from "../storage/storage.service";
import { S3Service } from "./s3.service";
import type { CreateUploadUrlDto } from "./dto/create-upload-url.dto";

@Injectable()
export class FilesService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly s3: S3Service,
    private readonly storage: StorageService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto, uploadedBy: string) {
    const tenantId = requireCurrentTenantId();
    // Chave sempre prefixada pelo tenantId resolvido no backend — nunca
    // aceita do cliente (ver SECURITY.md §2, isolamento em storage).
    const bucketKey = `${tenantId}/${randomUUID()}-${dto.nomeOriginal}`;

    const file = await this.tenantPrisma.file.create({
      data: {
        bucketKey,
        nomeOriginal: dto.nomeOriginal,
        mimeType: dto.mimeType,
        tamanho: dto.tamanho,
        uploadedBy,
        status: "pending",
      },
    });

    const uploadUrl = await this.s3.createUploadUrl(bucketKey, dto.mimeType);
    return { fileId: file.id, uploadUrl };
  }

  async confirmUpload(fileId: string) {
    const file = await this.tenantPrisma.file.findFirst({ where: { id: fileId, deletedAt: null } });
    if (!file) {
      throw new NotFoundException("Arquivo não encontrado.");
    }
    if (file.status === "uploaded") {
      return { status: "ok" as const };
    }

    await this.tenantPrisma.file.update({ where: { id: fileId }, data: { status: "uploaded" } });
    await this.storage.recordFileAdded(requireCurrentTenantId(), file.tamanho, file.mimeType);
    return { status: "ok" as const };
  }

  /** Soft delete — decrementa o contador de armazenamento (ver StorageService.recordFileRemoved). */
  async remove(fileId: string) {
    const tenantId = requireCurrentTenantId();
    const file = await this.tenantPrisma.file.findFirst({ where: { id: fileId, deletedAt: null } });
    if (!file) {
      throw new NotFoundException("Arquivo não encontrado.");
    }

    await this.tenantPrisma.file.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    if (file.status === "uploaded") {
      await this.storage.recordFileRemoved(tenantId, file.tamanho, file.mimeType);
    }
    return { status: "ok" as const };
  }

  async createDownloadUrl(fileId: string) {
    const file = await this.tenantPrisma.file.findFirst({ where: { id: fileId, deletedAt: null } });
    if (!file) {
      throw new NotFoundException("Arquivo não encontrado.");
    }
    if (file.status !== "uploaded") {
      throw new ForbiddenException("Arquivo ainda não foi confirmado como enviado.");
    }

    const downloadUrl = await this.s3.createDownloadUrl(file.bucketKey);
    return { downloadUrl, nomeOriginal: file.nomeOriginal, mimeType: file.mimeType };
  }
}
