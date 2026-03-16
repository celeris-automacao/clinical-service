import { IsDateString, IsUUID } from 'class-validator';

export class AssignTaskTemplateDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  patientId: string;

  @IsDateString()
  dueDate: string;
}
