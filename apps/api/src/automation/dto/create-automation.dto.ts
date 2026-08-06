import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";
import { ALL_DOMAIN_EVENTS, type DomainEventName } from "../../common/events/domain-event.types";
import { AUTOMATION_CATEGORIES, type AutomationCategory } from "../automation-definition.types";
import type { AutomationCondition, AutomationAction } from "../automation-definition.types";

export class CreateAutomationDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(AUTOMATION_CATEGORIES)
  tipoAutomacao?: AutomationCategory;

  @IsIn(ALL_DOMAIN_EVENTS)
  gatilhoTipo!: DomainEventName;

  /** Parâmetro numérico dos gatilhos de tempo (crm_task.due_soon → horasAntecedencia, opportunity.stage_stagnant → diasParado) — validado em AutomationsService via validateTriggerParams. */
  @IsOptional()
  gatilhoParametros?: Record<string, number>;

  @IsOptional()
  @ValidateIf((o: CreateAutomationDto) => o.cooldownMinutos !== null)
  @IsInt()
  @Min(1)
  cooldownMinutos?: number | null;

  @IsOptional()
  @IsArray()
  condicoes?: AutomationCondition[];

  @IsArray()
  acoes!: AutomationAction[];
}
