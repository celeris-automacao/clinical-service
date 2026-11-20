import { describe, expect, it, vi } from "vitest";
import {
  canReadStorageObject,
  type StorageAccessResolver,
  type StorageReference,
} from "../storage-access";

vi.mock("@workspace/db", () => {
  const column = () => ({ name: "test" });
  return {
    db: {},
    clinicOwnersTable: { clinicId: column(), userId: column() },
    doctorsTable: { clinicId: column(), userId: column() },
    patientClinicsTable: { clinicId: column(), patientId: column() },
    patientsTable: { id: column(), userId: column() },
    secretariesTable: { clinicId: column(), userId: column() },
    usersTable: { id: column(), role: column() },
  };
});

vi.mock("../auth-helpers", () => ({
  ensurePatientAccess: vi.fn(),
}));

function createResolver(
  references: StorageReference[],
  allowedClinicIds: number[] = [],
  allowedPatientIds: number[] = [],
): StorageAccessResolver {
  return {
    getReferences: async () => references,
    canAccessClinic: async (_user, clinicId) => allowedClinicIds.includes(clinicId),
    canAccessPatient: async (_user, patientId) => allowedPatientIds.includes(patientId),
    canAccessUserAvatar: async () => false,
  };
}

describe("private storage object authorization", () => {
  const owner = { id: 10, role: "clinic_owner" as const };

  it("allows a clinic member to read an object referenced by that clinic", async () => {
    const allowed = await canReadStorageObject(
      "/objects/clinic-logo",
      owner,
      7,
      createResolver([{ resourceType: "clinic", resourceId: 7 }], [7]),
    );

    expect(allowed).toBe(true);
  });

  it("denies access to objects referenced only by another clinic", async () => {
    const allowed = await canReadStorageObject(
      "/objects/other-clinic-logo",
      owner,
      7,
      createResolver([{ resourceType: "clinic", resourceId: 8 }], [7]),
    );

    expect(allowed).toBe(false);
  });

  it("uses clinic membership rather than the active clinic claim as authorization", async () => {
    const allowed = await canReadStorageObject(
      "/objects/clinic-logo",
      owner,
      8,
      createResolver([{ resourceType: "clinic", resourceId: 7 }], [7]),
    );

    expect(allowed).toBe(true);
  });

  it("allows an unauthenticated request only for a published public-page object", async () => {
    const resolver = createResolver([{ resourceType: "public", resourceId: 0 }]);

    await expect(canReadStorageObject("/objects/public-cover", null, undefined, resolver)).resolves.toBe(true);
    await expect(
      canReadStorageObject(
        "/objects/private-cover",
        null,
        undefined,
        createResolver([{ resourceType: "clinic", resourceId: 7 }], [7]),
      ),
    ).resolves.toBe(false);
  });

  it("rejects malformed object paths before resolving any references", async () => {
    const resolver = createResolver([]);

    await expect(canReadStorageObject("/objects/../secret", owner, undefined, resolver)).resolves.toBe(false);
    await expect(canReadStorageObject("/objects\\secret", owner, undefined, resolver)).resolves.toBe(false);
  });
});
