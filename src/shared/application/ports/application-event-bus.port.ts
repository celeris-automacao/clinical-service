export interface ApplicationEventBusPort {
  emit(eventName: string, payload: unknown): void;
}
