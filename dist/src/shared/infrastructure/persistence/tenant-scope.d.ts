export declare const byTenant: <T extends Record<string, unknown>>(tenantId: string, where?: T) => {
    tenantId: string;
};
export declare const byIdAndTenant: (id: string, tenantId: string) => {
    id: string;
    tenantId: string;
};
export declare const byPatientAndTenant: (patientId: string, tenantId: string) => {
    patientId: string;
    tenantId: string;
};
