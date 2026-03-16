export interface TenantPlanPort {
    getTenantPlan(tenantId: string): Promise<{
        id: string;
        maxStaff: number;
        maxPatients: number;
    } | null>;
}
