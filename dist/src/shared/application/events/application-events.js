"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLICATION_EVENT_CATALOG = exports.APPLICATION_EVENTS = void 0;
exports.createApplicationEvent = createApplicationEvent;
exports.serializeApplicationEvent = serializeApplicationEvent;
const crypto_1 = require("crypto");
exports.APPLICATION_EVENTS = {
    achievementUnlocked: 'achievement.unlocked',
    bossDefeated: 'boss.defeated',
    bossDefeatedGlobal: 'boss.defeated.global',
    rewardClaimed: 'reward.claimed',
    taskCompleted: 'task.completed',
};
exports.APPLICATION_EVENT_CATALOG = {
    [exports.APPLICATION_EVENTS.achievementUnlocked]: {
        name: exports.APPLICATION_EVENTS.achievementUnlocked,
        version: 1,
        domain: 'achievements',
        description: 'Published when a patient unlocks an achievement badge.',
    },
    [exports.APPLICATION_EVENTS.bossDefeated]: {
        name: exports.APPLICATION_EVENTS.bossDefeated,
        version: 1,
        domain: 'records',
        description: 'Published when an active boss is defeated by a patient.',
    },
    [exports.APPLICATION_EVENTS.bossDefeatedGlobal]: {
        name: exports.APPLICATION_EVENTS.bossDefeatedGlobal,
        version: 1,
        domain: 'achievements',
        description: 'Published when the clinic receives the global victory announcement.',
    },
    [exports.APPLICATION_EVENTS.rewardClaimed]: {
        name: exports.APPLICATION_EVENTS.rewardClaimed,
        version: 1,
        domain: 'rewards',
        description: 'Published when a patient successfully claims a reward.',
    },
    [exports.APPLICATION_EVENTS.taskCompleted]: {
        name: exports.APPLICATION_EVENTS.taskCompleted,
        version: 1,
        domain: 'tasks',
        description: 'Published when a patient completes a task.',
    },
};
function inferTenantId(payload) {
    const tenantId = payload.tenantId;
    return typeof tenantId === 'string' ? tenantId : undefined;
}
function buildDefaultMetadata(name, payload) {
    const commonTenantId = inferTenantId(payload);
    switch (name) {
        case exports.APPLICATION_EVENTS.achievementUnlocked: {
            const achievementPayload = payload;
            return {
                tenantId: commonTenantId,
                actorId: achievementPayload.patientId,
                aggregateId: achievementPayload.patientId,
                aggregateType: 'patient-achievement',
                idempotencyKey: `achievement-unlocked:${achievementPayload.tenantId}:${achievementPayload.patientId}:${achievementPayload.achievement}`,
            };
        }
        case exports.APPLICATION_EVENTS.bossDefeated: {
            const bossPayload = payload;
            return {
                tenantId: commonTenantId,
                actorId: bossPayload.killerId,
                aggregateId: bossPayload.bossId,
                aggregateType: 'boss-battle',
                idempotencyKey: `boss-defeated:${bossPayload.tenantId}:${bossPayload.bossId}:${bossPayload.killerId}`,
            };
        }
        case exports.APPLICATION_EVENTS.bossDefeatedGlobal: {
            const globalPayload = payload;
            return {
                tenantId: commonTenantId,
                aggregateType: 'clinic-announcement',
                idempotencyKey: `boss-defeated-global:${globalPayload.tenantId}:${globalPayload.timestamp.toISOString()}`,
            };
        }
        case exports.APPLICATION_EVENTS.rewardClaimed: {
            const rewardPayload = payload;
            return {
                tenantId: commonTenantId,
                actorId: rewardPayload.userId,
                aggregateId: rewardPayload.userId,
                aggregateType: 'reward-claim',
                idempotencyKey: `reward-claimed:${rewardPayload.tenantId}:${rewardPayload.userId}:${rewardPayload.rewardTitle}`,
            };
        }
        case exports.APPLICATION_EVENTS.taskCompleted: {
            const taskPayload = payload;
            return {
                tenantId: commonTenantId,
                actorId: taskPayload.userId,
                aggregateId: taskPayload.taskId,
                aggregateType: 'task-completion',
                idempotencyKey: `task-completed:${taskPayload.tenantId}:${taskPayload.userId}:${taskPayload.taskId}`,
            };
        }
    }
}
function createApplicationEvent(name, payload, metadata) {
    const definition = exports.APPLICATION_EVENT_CATALOG[name];
    const defaultMetadata = buildDefaultMetadata(name, payload);
    return {
        eventId: (0, crypto_1.randomUUID)(),
        name,
        version: definition.version,
        occurredAt: new Date(),
        payload,
        metadata: {
            ...defaultMetadata,
            ...metadata,
            idempotencyKey: metadata?.idempotencyKey ?? defaultMetadata.idempotencyKey,
        },
    };
}
function serializeApplicationEvent(event) {
    return {
        ...event,
        occurredAt: event.occurredAt.toISOString(),
    };
}
//# sourceMappingURL=application-events.js.map