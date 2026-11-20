import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mocks.send };
  },
}));

vi.mock("../logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: vi.fn(),
  },
}));

describe("sendEnterprisePlanInquiryEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    mocks.send.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerInfo.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sends the request to the administrators and sets the clinic owner as reply-to", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-accepted-123" }, error: null });
    const { sendEnterprisePlanInquiryEmail } = await import("../email");

    const emailId = await sendEnterprisePlanInquiryEmail({
      to: ["admin@modula.example"],
      clinicName: "<Clínica>",
      ownerName: "Owner",
      ownerEmail: "owner@clinic.example",
      message: "<script>alert(1)</script>",
    });

    expect(emailId).toBe("email-accepted-123");
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@modula.example"],
        replyTo: "owner@clinic.example",
        subject: "Solicitação de contato sobre o plano Enterprise",
        html: expect.stringContaining("&lt;script&gt;alert(1)&lt;/script&gt;"),
      }),
    );
    expect(mocks.send.mock.calls[0][0].html).toContain("&lt;Clínica&gt;");
    expect(mocks.loggerInfo).toHaveBeenCalled();
  });

  it("throws when the provider rejects the message", async () => {
    mocks.send.mockResolvedValue({ data: null, error: new Error("provider unavailable") });
    const { sendEnterprisePlanInquiryEmail } = await import("../email");

    await expect(sendEnterprisePlanInquiryEmail({
      to: ["admin@modula.example"],
      clinicName: "Clinic",
      ownerName: "Owner",
      ownerEmail: "owner@clinic.example",
    })).rejects.toThrow("Não foi possível enviar a solicitação de contato comercial");
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("throws instead of claiming success when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEnterprisePlanInquiryEmail } = await import("../email");

    await expect(sendEnterprisePlanInquiryEmail({
      to: ["admin@modula.example"],
      clinicName: "Clinic",
      ownerName: "Owner",
      ownerEmail: "owner@clinic.example",
    })).rejects.toThrow("RESEND_API_KEY is not configured");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
