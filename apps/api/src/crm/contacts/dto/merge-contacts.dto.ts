import { IsUUID } from "class-validator";

/** `duplicateId` é absorvido em `primaryId` — o registro duplicado é soft-deleted ao final (ver ContactsService.merge). */
export class MergeContactsDto {
  @IsUUID()
  duplicateId!: string;
}
