import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { INotificationsRepository } from '../../repositories/interfaces/notifications.repository.interface';

@Injectable()
export class PrismaNotificationsRepository implements INotificationsRepository {
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
