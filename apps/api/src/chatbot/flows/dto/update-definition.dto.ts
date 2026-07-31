import { IsArray } from "class-validator";
import type { FlowDefinition } from "../../flow-definition.types";

export class UpdateDefinitionDto implements FlowDefinition {
  @IsArray()
  nodes!: FlowDefinition["nodes"];

  @IsArray()
  edges!: FlowDefinition["edges"];
}
