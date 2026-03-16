import { ArrayMinSize, IsArray, IsDateString, IsUUID } from 'class-validator';

export class BulkAssignTaskTemplateDto {
  @IsUUID()
  templateId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  patientIds: string[];

  @IsDateString()
  dueDate: string;
}
