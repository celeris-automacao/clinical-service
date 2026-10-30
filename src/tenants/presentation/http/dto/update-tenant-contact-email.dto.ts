import { IsEmail } from 'class-validator';

export class UpdateTenantContactEmailDto {
  @IsEmail()
  email: string;
}
