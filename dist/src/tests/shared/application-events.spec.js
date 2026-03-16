"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const application_events_1 = require("../../shared/application/events/application-events");
describe('Application Events', () => {
    it('deve criar evento com versao catalogada e metadata padrao de idempotencia', () => {
        const event = (0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.taskCompleted, {
            taskId: 'task-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            xp: 50,
        });
        expect(event.version).toBe(application_events_1.APPLICATION_EVENT_CATALOG[application_events_1.APPLICATION_EVENTS.taskCompleted].version);
        expect(event.metadata).toEqual(expect.objectContaining({
            tenantId: 'tenant-1',
            actorId: 'user-1',
            aggregateId: 'task-1',
            aggregateType: 'task-completion',
            idempotencyKey: 'task-completed:tenant-1:user-1:task-1',
        }));
    });
    it('deve permitir sobrescrever metadata para correlacao/outbox', () => {
        const event = (0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.rewardClaimed, {
            userId: 'user-1',
            tenantId: 'tenant-1',
            rewardTitle: 'Premio Epico',
        }, {
            correlationId: 'corr-123',
            causationId: 'cause-456',
            idempotencyKey: 'custom-key',
        });
        expect(event.metadata.correlationId).toBe('corr-123');
        expect(event.metadata.causationId).toBe('cause-456');
        expect(event.metadata.idempotencyKey).toBe('custom-key');
    });
    it('deve serializar o evento com occurredAt em formato ISO para outbox futura', () => {
        const event = (0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.achievementUnlocked, {
            patientId: 'patient-1',
            tenantId: 'tenant-1',
            achievement: 'Maratonista',
        });
        const serialized = (0, application_events_1.serializeApplicationEvent)(event);
        expect(serialized.occurredAt).toBe(event.occurredAt.toISOString());
        expect(serialized.metadata.idempotencyKey).toBe('achievement-unlocked:tenant-1:patient-1:Maratonista');
    });
});
//# sourceMappingURL=application-events.spec.js.map