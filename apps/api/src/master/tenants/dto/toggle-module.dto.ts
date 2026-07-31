import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class ToggleModuleDto {
  @IsString()
  @MinLength(2)
  module!: string;

  @IsBoolean()
  enabled!: boolean;

  /**
   * Configuração específica do módulo — hoje usada só por `module: "ia"`
   * (`{ allowByok?: boolean; allowPlatformKey?: boolean }`, ver AiAccessService).
   * Objeto livre de propósito: cada módulo decide o que guarda aqui, sem
   * exigir uma migration nova por módulo.
   */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
