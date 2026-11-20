import { and, eq, sql } from "drizzle-orm";
import {
  db,
  clinicOwnersTable,
  doctorsTable,
  patientClinicsTable,
  patientsTable,
  secretariesTable,
  usersTable,
} from "@workspace/db";
import {
  ensurePatientAccess,
  type UserRole,
} from "./auth-helpers";

type StorageAccessUser = {
  id: number;
  role: UserRole;
};

export type StorageReference =
  | { resourceType: "clinic" | "patient" | "user"; resourceId: number }
  | { resourceType: "public"; resourceId: 0 };

export interface StorageAccessResolver {
  getReferences(path: string): Promise<StorageReference[]>;
  canAccessClinic(user: StorageAccessUser, clinicId: number, activeClinicId?: number): Promise<boolean>;
  canAccessPatient(user: StorageAccessUser, patientId: number, activeClinicId?: number): Promise<boolean>;
  canAccessUserAvatar(user: StorageAccessUser, targetUserId: number, activeClinicId?: number): Promise<boolean>;
}

async function getStorageReferences(path: string): Promise<StorageReference[]> {
  const result = await db.execute<StorageReference>(sql`
    SELECT 'clinic' AS "resourceType", id AS "resourceId"
      FROM clinics WHERE logo_url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM clinic_settings WHERE logo_url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM clinic_gallery_photos WHERE url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM community_posts WHERE media_url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM expenses WHERE receipt_url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM clinic_public_pages WHERE cover_image_url = ${path}
    UNION ALL
    SELECT 'clinic', clinic_id FROM care_packages WHERE promotion_images @> ARRAY[${path}]::text[]
    UNION ALL
    SELECT 'clinic', clinic_id FROM care_package_promotion_uploads WHERE object_path = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM appointments WHERE payment_proof_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM contracts WHERE signature_image_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM patient_materials WHERE file_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM check_ins WHERE photo_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM check_ins WHERE food_photo_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM check_ins WHERE exercise_photo_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM calorie_entries WHERE photo_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM exercise_entries WHERE photo_url = ${path}
    UNION ALL
    SELECT 'patient', patient_id FROM weight_entries WHERE photo_url = ${path}
    UNION ALL
    SELECT 'user', id FROM users WHERE avatar_url = ${path}
    UNION ALL
    SELECT 'public', 0
      FROM clinic_public_pages
      WHERE cover_image_url = ${path} AND published = true
    UNION ALL
    SELECT 'public', 0
      FROM care_packages
      WHERE promotion_images @> ARRAY[${path}]::text[] AND active = true
    UNION ALL
    SELECT 'public', 0
      FROM clinic_gallery_photos photos
      INNER JOIN clinic_public_pages pages
        ON pages.clinic_id = photos.clinic_id AND pages.published = true
      WHERE photos.url = ${path}
    UNION ALL
    SELECT 'public', 0
      FROM clinics
      INNER JOIN clinic_public_pages pages
        ON pages.clinic_id = clinics.id AND pages.published = true
      WHERE clinics.logo_url = ${path}
    UNION ALL
    SELECT 'public', 0
      FROM clinic_settings
      INNER JOIN clinic_public_pages pages
        ON pages.clinic_id = clinic_settings.clinic_id AND pages.published = true
      WHERE clinic_settings.logo_url = ${path}
    UNION ALL
    SELECT 'public', 0
      FROM doctors
      INNER JOIN users ON users.id = doctors.user_id
      INNER JOIN clinic_public_pages pages
        ON pages.clinic_id = doctors.clinic_id AND pages.published = true
      WHERE users.avatar_url = ${path} AND doctors.show_on_public_page = true
  `);
  return result.rows;
}

async function canAccessClinic(
  user: StorageAccessUser,
  clinicId: number,
  _activeClinicId?: number,
): Promise<boolean> {
  if (user.role === "super_admin") return true;

  if (user.role === "clinic_owner") {
    const [membership] = await db
      .select({ clinicId: clinicOwnersTable.clinicId })
      .from(clinicOwnersTable)
      .where(and(eq(clinicOwnersTable.userId, user.id), eq(clinicOwnersTable.clinicId, clinicId)))
      .limit(1);
    return Boolean(membership);
  }

  if (user.role === "profissional_saude") {
    const [membership] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(and(eq(doctorsTable.userId, user.id), eq(doctorsTable.clinicId, clinicId)))
      .limit(1);
    return Boolean(membership);
  }

  if (user.role === "secretaria") {
    const [membership] = await db
      .select({ clinicId: secretariesTable.clinicId })
      .from(secretariesTable)
      .where(and(eq(secretariesTable.userId, user.id), eq(secretariesTable.clinicId, clinicId)))
      .limit(1);
    return Boolean(membership);
  }

  if (user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);
    if (!patient) return false;
    const [membership] = await db
      .select({ clinicId: patientClinicsTable.clinicId })
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patient.id), eq(patientClinicsTable.clinicId, clinicId)))
      .limit(1);
    return Boolean(membership);
  }

  return false;
}

async function canAccessPatient(
  user: StorageAccessUser,
  patientId: number,
  activeClinicId?: number,
): Promise<boolean> {
  return Boolean(await ensurePatientAccess(user, patientId, activeClinicId));
}

async function canAccessUserAvatar(
  user: StorageAccessUser,
  targetUserId: number,
  activeClinicId?: number,
): Promise<boolean> {
  if (user.id === targetUserId || user.role === "super_admin") return true;

  const [target] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);
  if (!target) return false;

  if (target.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, targetUserId))
      .limit(1);
    return patient ? canAccessPatient(user, patient.id, activeClinicId) : false;
  }

  const clinicIds =
    target.role === "clinic_owner"
      ? await db
          .select({ clinicId: clinicOwnersTable.clinicId })
          .from(clinicOwnersTable)
          .where(eq(clinicOwnersTable.userId, targetUserId))
      : target.role === "profissional_saude"
        ? await db
            .select({ clinicId: doctorsTable.clinicId })
            .from(doctorsTable)
            .where(eq(doctorsTable.userId, targetUserId))
        : target.role === "secretaria"
          ? await db
              .select({ clinicId: secretariesTable.clinicId })
              .from(secretariesTable)
              .where(eq(secretariesTable.userId, targetUserId))
          : [];

  for (const { clinicId } of clinicIds) {
    if (await canAccessClinic(user, clinicId, activeClinicId)) return true;
  }
  return false;
}

const defaultResolver: StorageAccessResolver = {
  getReferences: getStorageReferences,
  canAccessClinic,
  canAccessPatient,
  canAccessUserAvatar,
};

export function isValidStorageObjectPath(path: string): boolean {
  return (
    path.startsWith("/objects/") &&
    path.length > "/objects/".length &&
    path.length <= 2048 &&
    !path.includes("\\") &&
    path.slice("/objects/".length).split("/").every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}

export async function canReadStorageObject(
  path: string,
  user: StorageAccessUser | null,
  activeClinicId?: number,
  resolver: StorageAccessResolver = defaultResolver,
): Promise<boolean> {
  if (!isValidStorageObjectPath(path)) return false;

  const references = await resolver.getReferences(path);
  if (references.some((reference) => reference.resourceType === "public")) return true;
  if (!user) return false;

  for (const reference of references) {
    if (reference.resourceType === "clinic" &&
        await resolver.canAccessClinic(user, reference.resourceId, activeClinicId)) return true;
    if (reference.resourceType === "patient" &&
        await resolver.canAccessPatient(user, reference.resourceId, activeClinicId)) return true;
    if (reference.resourceType === "user" &&
        await resolver.canAccessUserAvatar(user, reference.resourceId, activeClinicId)) return true;
  }
  return false;
}
