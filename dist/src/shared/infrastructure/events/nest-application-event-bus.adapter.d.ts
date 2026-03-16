import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplicationEventEnvelope, ApplicationEventName } from '../../application/events/application-events';
import { ApplicationEventBusPort } from '../../application/ports/application-event-bus.port';
export declare class NestApplicationEventBusAdapter implements ApplicationEventBusPort {
    private readonly eventEmitter;
    constructor(eventEmitter: EventEmitter2);
    publish<TName extends ApplicationEventName>(event: ApplicationEventEnvelope<TName>): void;
}
