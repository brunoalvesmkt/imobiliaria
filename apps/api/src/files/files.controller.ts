import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { FilesService } from "./files.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";

@Controller("files")
@UseGuards(TenantAuthGuard)
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post("upload-url")
  createUploadUrl(@Body() dto: CreateUploadUrlDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.createUploadUrl(dto, user.id);
  }

  @Post(":id/confirm")
  confirmUpload(@Param("id") id: string) {
    return this.service.confirmUpload(id);
  }

  @Get(":id/download-url")
  createDownloadUrl(@Param("id") id: string) {
    return this.service.createDownloadUrl(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
