export const byTenant = <T extends Record<string, unknown>>(tenantId: string, where?: T) => ({
  ...(where ?? {}),
  tenantId,
});

export const byIdAndTenant = (id: string, tenantId: string) => ({
  id,
  tenantId,
});

export const byPatientAndTenant = (patientId: string, tenantId: string) => ({
  patientId,
  tenantId,
});
