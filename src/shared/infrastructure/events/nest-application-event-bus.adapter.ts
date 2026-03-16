import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplicationEventEnvelope, ApplicationEventName } from '../../application/events/application-events';
import { ApplicationEventBusPort } from '../../application/ports/application-event-bus.port';

@Injectable()
export class NestApplicationEventBusAdapter implements ApplicationEventBusPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish<TName extends ApplicationEventName>(event: ApplicationEventEnvelope<TName>): void {
    this.eventEmitter.emit(event.name, event);
  }
}
