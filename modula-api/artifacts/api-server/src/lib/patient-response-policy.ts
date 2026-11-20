import type { UserRole } from "./auth-helpers";

export type PatientResponseRole = UserRole | string;

export type PatientResponseView = "full" | "administrative";

export interface PatientResponseBase {
  id: number;
  userId: number;
  clinicId?: number | null;
  name: string;
  email: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  allergies: string | null;
  hasAllergies: boolean;
  medicalConditions: string | null;
  dietaryRestrictions: string | null;
  hasDietaryRestrictions: boolean;
  psychologyNotes: string | null;
  physicalActivityNotes: string | null;
  endocrinologyNotes: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  paymentType?: string | null;
  insuranceName?: string | null;
  startWeight: number;
  targetWeight: number | null;
  proposedTargetWeight: number | null;
  weightGoalStatus: string | null;
  weightGoalValidatedByName: string | null;
  weightGoalValidatedAt: string | null;
  currentWeight: number | null;
  totalXp: number;
  isTemporaryPassword: boolean;
  temporaryPasswordExpiresAt: string | null;
  dailyCalorieGoal: number | null;
  createdAt: string;
  careTeam: Array<{
    id: number;
    userId: number;
    name: string;
    avatarUrl: string | null;
    specialty: string;
    consultationPrice: string | null;
    acceptsInsurance: boolean;
    insurances: Array<{ id: number; name: string; price: number }>;
  }>;
  reminderSettings: {
    water: { enabled: boolean | null; hour: number | null; minute: number | null; frequency: number | null };
    weight: { enabled: boolean | null; hour: number | null; minute: number | null; frequency: number | null };
  };
}

export type PatientFullResponse = PatientResponseBase;

export type PatientAdministrativeResponse = Pick<
  PatientResponseBase,
  | "id"
  | "userId"
  | "name"
  | "email"
  | "avatarUrl"
  | "phone"
  | "createdAt"
  | "isTemporaryPassword"
  | "temporaryPasswordExpiresAt"
  | "clinicId"
> & {
  status: {
    isTemporaryPassword: boolean;
    temporaryPasswordExpiresAt: string | null;
  };
  clinic?: {
    id: number | null;
  };
  appointment?: {
    nextDate: string | null;
  };
  invitation?: {
    pending: boolean;
  };
  careTeam?: PatientResponseBase["careTeam"];
  administrativeDates?: {
    createdAt: string;
  };
};

export function getPatientResponseView(role: PatientResponseRole): PatientResponseView {
  if (role === "secretaria") return "administrative";
  return "full";
}

export function serializePatientResponse(
  patient: PatientResponseBase,
  role: PatientResponseRole
): PatientFullResponse | PatientAdministrativeResponse {
  const view = getPatientResponseView(role);
  if (view === "full") {
    return patient;
  }

  return {
    id: patient.id,
    userId: patient.userId,
    clinicId: patient.clinicId ?? null,
    name: patient.name,
    email: patient.email,
    avatarUrl: patient.avatarUrl,
    phone: patient.phone,
    createdAt: patient.createdAt,
    isTemporaryPassword: patient.isTemporaryPassword,
    temporaryPasswordExpiresAt: patient.temporaryPasswordExpiresAt,
    status: {
      isTemporaryPassword: patient.isTemporaryPassword,
      temporaryPasswordExpiresAt: patient.temporaryPasswordExpiresAt,
    },
    clinic: { id: patient.clinicId ?? null },
    appointment: { nextDate: null },
    invitation: { pending: patient.isTemporaryPassword },
    careTeam: patient.careTeam,
    administrativeDates: { createdAt: patient.createdAt },
  };
}
