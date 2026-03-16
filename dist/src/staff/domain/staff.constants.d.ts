export declare const STAFF_STATUSES: readonly ["invited", "active", "inactive", "blocked"];
export type StaffStatus = (typeof STAFF_STATUSES)[number];
export declare const STAFF_ROLES: readonly ["owner", "admin", "doctor", "specialist", "staff"];
export type StaffRole = (typeof STAFF_ROLES)[number];
export declare const STAFF_PROFESSIONAL_TYPES: readonly ["doctor", "nutritionist", "physiotherapist", "psychologist", "nurse", "specialist", "other"];
export type StaffProfessionalType = (typeof STAFF_PROFESSIONAL_TYPES)[number];
export declare const PROTECTED_STAFF_ROLES: readonly ["owner", "admin"];
