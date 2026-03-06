// src/rewards/rewards.module.ts
import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { RewardsRepository } from './repositories/rewards.repository';
import { RecordsModule } from '../records/records.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, RecordsModule], // Certifique-se de que o PrismaModule está aqui
  providers: [
    RewardsService,
    { provide: 'IRewardsRepository', useClass: RewardsRepository }
  ],
  controllers: [RewardsController],
})
export class RewardsModule {}