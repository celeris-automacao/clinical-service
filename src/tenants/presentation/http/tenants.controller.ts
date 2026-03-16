import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChangeTenantStatusUseCase } from '../../application/use-cases/change-tenant-status.use-case';
import { CreateTenantUseCase } from '../../application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../application/use-cases/get-tenants.use-case';
import { ChangeTenantStatusDto } from './dto/change-tenant-status.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly getTenantsUseCase: GetTenantsUseCase,
    private readonly getTenantByIdUseCase: GetTenantByIdUseCase,
    private readonly changeTenantStatusUseCase: ChangeTenantStatusUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova clinica (Tenant)' })
  @ApiResponse({ status: 201, description: 'Clinica criada com boss inicial.' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.createTenantUseCase.execute(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as clinicas cadastradas' })
  findAll() {
    return this.getTenantsUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma clinica especifica' })
  findOne(@Param('id') id: string) {
    return this.getTenantByIdUseCase.execute(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Alterar status operacional da clinica' })
  changeStatus(@Param('id') id: string, @Body() dto: ChangeTenantStatusDto) {
    return this.changeTenantStatusUseCase.execute(id, dto.status);
  }
}
