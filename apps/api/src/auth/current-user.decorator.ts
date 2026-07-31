import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedRequestUser } from "./jwt-payload.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedRequestUser }>();
    return request.user;
  },
);
