// src/records/records.controller.ts
import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { SupabaseGuard } from '../auth/guards/supabase.guard';
import { GetUser, UserContext } from '../common/decorators/get-user.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EvolutionDto } from './dto/evolution.dto';

@Controller('v1/records')
@UseGuards(SupabaseGuard) // Protege todas as rotas deste controller [cite: 222]
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  createRecord(
    @Body() createRecordDto: CreateRecordDto,
    @GetUser() user: UserContext // Captura o contexto injetado pelo Guard
  ) {
    return this.recordsService.createRecord(createRecordDto, user);
  }

  @Get('me') // Rota: GET /v1/records/me
  @UseGuards(SupabaseGuard)
  @ApiOperation({ summary: 'Busca histórico de evolução' })
  @ApiResponse({ status: 200, type: [EvolutionDto] })
  getEvolution(@GetUser() user: UserContext) {
      return this.recordsService.getEvolution(user);
  }

  @Get('stats') // Rota: GET /v1/records/stats
  @UseGuards(SupabaseGuard)
  getStats(@GetUser() user: UserContext) {
    return this.recordsService.getStats(user);
  } 


}