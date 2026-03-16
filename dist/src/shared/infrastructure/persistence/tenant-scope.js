"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.byPatientAndTenant = exports.byIdAndTenant = exports.byTenant = void 0;
const byTenant = (tenantId, where) => ({
    ...(where ?? {}),
    tenantId,
});
exports.byTenant = byTenant;
const byIdAndTenant = (id, tenantId) => ({
    id,
    tenantId,
});
exports.byIdAndTenant = byIdAndTenant;
const byPatientAndTenant = (patientId, tenantId) => ({
    patientId,
    tenantId,
});
exports.byPatientAndTenant = byPatientAndTenant;
//# sourceMappingURL=tenant-scope.js.map