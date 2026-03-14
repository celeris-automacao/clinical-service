import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsRepositoryPort } from '../../application/ports/notifications-repository.port';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: { 
    tenantId: string; 
    userId: string; 
    title: string; 
    message: string; 
    type: string 
  }) {
    // Mantendo sua lógica atual de preparação para o futuro
    return { ...data, createdAt: new Date() };
  }
}
