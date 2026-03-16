import { randomUUID } from 'crypto';

export const APPLICATION_EVENTS = {
  achievementUnlocked: 'achievement.unlocked',
  bossDefeated: 'boss.defeated',
  bossDefeatedGlobal: 'boss.defeated.global',
  rewardClaimed: 'reward.claimed',
  taskCompleted: 'task.completed',
} as const;

export interface AchievementUnlockedEventPayload {
  patientId: string;
  tenantId: string;
  achievement: string;
}

export interface BossDefeatedEventPayload {
  tenantId: string;
  bossId: string;
  bossName: string;
  killerId: string;
}

export interface BossDefeatedGlobalEventPayload {
  tenantId: string;
  message: string;
  timestamp: Date;
}

export interface RewardClaimedEventPayload {
  userId: string;
  tenantId: string;
  rewardTitle: string;
}

export interface TaskCompletedEventPayload {
  taskId: string;
  userId: string;
  tenantId: string;
  xp: number;
}

export interface ApplicationEventMap {
  [APPLICATION_EVENTS.achievementUnlocked]: AchievementUnlockedEventPayload;
  [APPLICATION_EVENTS.bossDefeated]: BossDefeatedEventPayload;
  [APPLICATION_EVENTS.bossDefeatedGlobal]: BossDefeatedGlobalEventPayload;
  [APPLICATION_EVENTS.rewardClaimed]: RewardClaimedEventPayload;
  [APPLICATION_EVENTS.taskCompleted]: TaskCompletedEventPayload;
}

export type ApplicationEventName = keyof ApplicationEventMap;

export type ApplicationEventPayload<TName extends ApplicationEventName> = ApplicationEventMap[TName];

export interface ApplicationEventDefinition<TName extends ApplicationEventName = ApplicationEventName> {
  name: TName;
  version: number;
  domain: string;
  description: string;
}

export const APPLICATION_EVENT_CATALOG: {
  [TName in ApplicationEventName]: ApplicationEventDefinition<TName>;
} = {
  [APPLICATION_EVENTS.achievementUnlocked]: {
    name: APPLICATION_EVENTS.achievementUnlocked,
    version: 1,
    domain: 'achievements',
    description: 'Published when a patient unlocks an achievement badge.',
  },
  [APPLICATION_EVENTS.bossDefeated]: {
    name: APPLICATION_EVENTS.bossDefeated,
    version: 1,
    domain: 'records',
    description: 'Published when an active boss is defeated by a patient.',
  },
  [APPLICATION_EVENTS.bossDefeatedGlobal]: {
    name: APPLICATION_EVENTS.bossDefeatedGlobal,
    version: 1,
    domain: 'achievements',
    description: 'Published when the clinic receives the global victory announcement.',
  },
  [APPLICATION_EVENTS.rewardClaimed]: {
    name: APPLICATION_EVENTS.rewardClaimed,
    version: 1,
    domain: 'rewards',
    description: 'Published when a patient successfully claims a reward.',
  },
  [APPLICATION_EVENTS.taskCompleted]: {
    name: APPLICATION_EVENTS.taskCompleted,
    version: 1,
    domain: 'tasks',
    description: 'Published when a patient completes a task.',
  },
};

export interface ApplicationEventMetadata {
  tenantId?: string;
  actorId?: string;
  aggregateId?: string;
  aggregateType?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey: string;
}

export interface ApplicationEventEnvelope<TName extends ApplicationEventName = ApplicationEventName> {
  eventId: string;
  name: TName;
  version: number;
  occurredAt: Date;
  payload: ApplicationEventPayload<TName>;
  metadata: ApplicationEventMetadata;
}

export interface SerializedApplicationEvent<TName extends ApplicationEventName = ApplicationEventName> {
  eventId: string;
  name: TName;
  version: number;
  occurredAt: string;
  payload: ApplicationEventPayload<TName>;
  metadata: ApplicationEventMetadata;
}

type MetadataInput = Omit<ApplicationEventMetadata, 'idempotencyKey'> & {
  idempotencyKey?: string;
};

function inferTenantId(payload: Record<string, unknown>): string | undefined {
  const tenantId = payload.tenantId;
  return typeof tenantId === 'string' ? tenantId : undefined;
}

function buildDefaultMetadata<TName extends ApplicationEventName>(
  name: TName,
  payload: ApplicationEventPayload<TName>,
): ApplicationEventMetadata {
  const commonTenantId = inferTenantId(payload as unknown as Record<string, unknown>);

  switch (name) {
    case APPLICATION_EVENTS.achievementUnlocked: {
      const achievementPayload = payload as AchievementUnlockedEventPayload;
      return {
        tenantId: commonTenantId,
        actorId: achievementPayload.patientId,
        aggregateId: achievementPayload.patientId,
        aggregateType: 'patient-achievement',
        idempotencyKey: `achievement-unlocked:${achievementPayload.tenantId}:${achievementPayload.patientId}:${achievementPayload.achievement}`,
      };
    }
    case APPLICATION_EVENTS.bossDefeated: {
      const bossPayload = payload as BossDefeatedEventPayload;
      return {
        tenantId: commonTenantId,
        actorId: bossPayload.killerId,
        aggregateId: bossPayload.bossId,
        aggregateType: 'boss-battle',
        idempotencyKey: `boss-defeated:${bossPayload.tenantId}:${bossPayload.bossId}:${bossPayload.killerId}`,
      };
    }
    case APPLICATION_EVENTS.bossDefeatedGlobal: {
      const globalPayload = payload as BossDefeatedGlobalEventPayload;
      return {
        tenantId: commonTenantId,
        aggregateType: 'clinic-announcement',
        idempotencyKey: `boss-defeated-global:${globalPayload.tenantId}:${globalPayload.timestamp.toISOString()}`,
      };
    }
    case APPLICATION_EVENTS.rewardClaimed: {
      const rewardPayload = payload as RewardClaimedEventPayload;
      return {
        tenantId: commonTenantId,
        actorId: rewardPayload.userId,
        aggregateId: rewardPayload.userId,
        aggregateType: 'reward-claim',
        idempotencyKey: `reward-claimed:${rewardPayload.tenantId}:${rewardPayload.userId}:${rewardPayload.rewardTitle}`,
      };
    }
    case APPLICATION_EVENTS.taskCompleted: {
      const taskPayload = payload as TaskCompletedEventPayload;
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

export function createApplicationEvent<TName extends ApplicationEventName>(
  name: TName,
  payload: ApplicationEventPayload<TName>,
  metadata?: MetadataInput,
): ApplicationEventEnvelope<TName> {
  const definition = APPLICATION_EVENT_CATALOG[name];
  const defaultMetadata = buildDefaultMetadata(name, payload);

  return {
    eventId: randomUUID(),
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

export function serializeApplicationEvent<TName extends ApplicationEventName>(
  event: ApplicationEventEnvelope<TName>,
): SerializedApplicationEvent<TName> {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
  };
}
