import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Tenants')
@Controller('tenants') // Se o seu main.ts tiver prefixo 'v1', a rota será /v1/tenants
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova clínica (Tenant)' })
  @ApiResponse({ status: 201, description: 'Clínica e Boss inicial criados com sucesso.' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as clínicas cadastradas' })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma clínica específica' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }
}