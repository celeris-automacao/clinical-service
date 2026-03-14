import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplicationEventBusPort } from '../../application/ports/application-event-bus.port';

@Injectable()
export class NestApplicationEventBusAdapter implements ApplicationEventBusPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(eventName: string, payload: unknown): void {
    this.eventEmitter.emit(eventName, payload);
  }
}
