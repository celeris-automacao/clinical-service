import { IsString, IsNotEmpty, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ 
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 
    description: 'O ID único do usuário vindo do Auth do Supabase' 
  })
  @IsUUID()
  @IsNotEmpty()
  supabaseId: string; // - Este ID é crucial para o vínculo com o login

  @ApiProperty({ 
    example: 'Guerreiro de Saúde', 
    description: 'Nome completo ou apelido do paciente no jogo' 
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;
}