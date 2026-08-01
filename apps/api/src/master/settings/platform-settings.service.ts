import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

const SINGLETON_ID = "singleton";

/**
 * Configurações globais do fluxo de contratação/cadastro (documento de
 * alterações, seção 5) — linha única no banco, criada com os defaults do
 * schema na primeira leitura se a migration de seed não tiver rodado (ex.:
 * banco de teste recriado do zero).
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  get() {
    return this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  async update(dto: UpdatePlatformSettingsDto, actorId: string) {
    await this.get();
    const settings = await this.prisma.platformSettings.update({ where: { id: SINGLETON_ID }, data: dto });

    await this.audit.record({
      actorId,
      actorType: "master",
      action: "master.platform_settings_updated",
      entity: "PlatformSettings",
      entityId: SINGLETON_ID,
      newData: { ...dto },
    });

    return settings;
  }
}
