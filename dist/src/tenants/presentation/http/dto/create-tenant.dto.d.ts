import { TenantAddressDto } from './tenant-address.dto';
export declare class CreateTenantDto {
    name: string;
    legalName: string;
    cnpj: string;
    planId: string;
    responsibleName: string;
    responsibleEmail: string;
    responsiblePhone?: string;
    address: TenantAddressDto;
}
