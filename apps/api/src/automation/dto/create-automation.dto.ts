import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
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

  @IsOptional()
  @IsArray()
  condicoes?: AutomationCondition[];

  @IsArray()
  acoes!: AutomationAction[];
}
