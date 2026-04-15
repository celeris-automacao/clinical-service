import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferPatientDto {
  @ApiProperty({ description: 'ID do novo médico responsável', example: 'uuid-do-medico' })
  @IsUUID()
  @IsNotEmpty()
  newDoctorId: string;
}
