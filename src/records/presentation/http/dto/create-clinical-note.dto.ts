import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateClinicalNoteDto {
  @IsString()
  patientId: string;

  @IsIn(['initial', 'followup', 'intercurrence'])
  encounterType: string;

  @IsOptional()
  @IsString()
  subjective?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsIn(['low', 'moderate', 'high'])
  riskLevel?: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsDateString()
  consultationAt: string;
}

