import { SetMetadata } from "@nestjs/common";

export const REQUIRED_MODULE_KEY = "required_feature_module";

/** Bloqueia a rota quando o módulo comercial não está ativo (FeatureFlag) para o tenant — ver MODULE_DEPENDENCIES.md. */
export const RequireModule = (module: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_MODULE_KEY, module);
