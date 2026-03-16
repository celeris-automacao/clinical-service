import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../application/use-cases/get-plans.use-case';
import { CreatePlanDto } from './dto/create-plan.dto';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly getPlansUseCase: GetPlansUseCase,
    private readonly getPlanByIdUseCase: GetPlanByIdUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.createPlanUseCase.execute(dto);
  }

  @Get()
  findAll() {
    return this.getPlansUseCase.execute();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getPlanByIdUseCase.execute(id);
  }
}
