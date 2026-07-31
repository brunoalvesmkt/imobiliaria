import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class AffiliateAuthGuard extends AuthGuard("jwt-affiliate") {}
