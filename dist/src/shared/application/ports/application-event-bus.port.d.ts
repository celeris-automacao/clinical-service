import { ApplicationEventEnvelope, ApplicationEventName } from '../events/application-events';
export interface ApplicationEventBusPort {
    publish<TName extends ApplicationEventName>(event: ApplicationEventEnvelope<TName>): void;
}
