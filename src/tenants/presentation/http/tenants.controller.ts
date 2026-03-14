import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTenantUseCase } from '../../application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../application/use-cases/get-tenants.use-case';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly getTenantsUseCase: GetTenantsUseCase,
    private readonly getTenantByIdUseCase: GetTenantByIdUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova clínica (Tenant)' })
  @ApiResponse({ status: 201, description: 'Clínica e Boss inicial criados com sucesso.' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.createTenantUseCase.execute(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as clínicas cadastradas' })
  findAll() {
    return this.getTenantsUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma clínica específica' })
  findOne(@Param('id') id: string) {
    return this.getTenantByIdUseCase.execute(id);
  }
}
