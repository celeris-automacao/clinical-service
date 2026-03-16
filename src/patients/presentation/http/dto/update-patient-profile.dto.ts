import { IsString, IsOptional } from 'class-validator';

export class UpdatePatientProfileDto {
  @IsString()
  @IsOptional()
  initialGoals?: string; // O que ele quer alcançar

  @IsString()
  @IsOptional()
  symptoms?: string; // O que ele sente (dores, cansaço)

  @IsString()
  @IsOptional()
  pathologies?: string; // Histórico de doenças

  @IsString()
  @IsOptional()
  medicalNotes?: string; // Observações do médico
}