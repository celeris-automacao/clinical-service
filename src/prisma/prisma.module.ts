// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Permite usar o PrismaService em qualquer lugar sem importar o módulo de novo
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}