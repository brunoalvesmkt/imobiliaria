import { IsBooleanString, IsOptional } from "class-validator";

export class ContactsExportDto {
  @IsOptional()
  @IsBooleanString()
  allPhones?: string;

  @IsOptional()
  @IsBooleanString()
  allEmails?: string;
}
