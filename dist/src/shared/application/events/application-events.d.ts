export declare const APPLICATION_EVENTS: {
    readonly achievementUnlocked: "achievement.unlocked";
    readonly bossDefeated: "boss.defeated";
    readonly bossDefeatedGlobal: "boss.defeated.global";
    readonly rewardClaimed: "reward.claimed";
    readonly taskCompleted: "task.completed";
};
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
export declare const APPLICATION_EVENT_CATALOG: {
    [TName in ApplicationEventName]: ApplicationEventDefinition<TName>;
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
export declare function createApplicationEvent<TName extends ApplicationEventName>(name: TName, payload: ApplicationEventPayload<TName>, metadata?: MetadataInput): ApplicationEventEnvelope<TName>;
export declare function serializeApplicationEvent<TName extends ApplicationEventName>(event: ApplicationEventEnvelope<TName>): SerializedApplicationEvent<TName>;
export {};
