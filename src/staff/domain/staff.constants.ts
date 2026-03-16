export const STAFF_STATUSES = ['invited', 'active', 'inactive', 'blocked'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_ROLES = ['owner', 'admin', 'doctor', 'specialist', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PROFESSIONAL_TYPES = [
  'doctor',
  'nutritionist',
  'physiotherapist',
  'psychologist',
  'nurse',
  'specialist',
  'other',
] as const;
export type StaffProfessionalType = (typeof STAFF_PROFESSIONAL_TYPES)[number];

export const PROTECTED_STAFF_ROLES = ['owner', 'admin'] as const;
