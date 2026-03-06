// src/dashboard/repositories/interfaces/notifications.repository.interface.ts

export interface INotificationsRepository {
  /**
   * Centraliza a criação de notificações no sistema.
   * Atualmente focado em logs, preparado para persistência em banco.
   */
  createNotification(data: { 
    tenantId: string; 
    userId: string; 
    title: string; 
    message: string; 
    type: string 
  }): Promise<any>;
}