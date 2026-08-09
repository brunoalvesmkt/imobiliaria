import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";
import { S3Service } from "./s3.service";

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService],
})
export class FilesModule {}
