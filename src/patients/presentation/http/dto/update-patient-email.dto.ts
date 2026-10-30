import { IsEmail } from 'class-validator';

export class UpdatePatientEmailDto {
  @IsEmail()
  email: string;
}
