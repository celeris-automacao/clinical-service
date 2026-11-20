import { describe, it, expect } from "vitest";
import { getDaysUntilNextBirthday } from "../birthdayHelpers";

function makeToday(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("getDaysUntilNextBirthday — year boundary (Dec → Jan)", () => {
  it("returns 5 when today is Dec 28 and birthday is Jan 2 (crosses year boundary)", () => {
    const today = makeToday(2024, 12, 28);
    const dob = "1990-01-02";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(5);
  });

  it("patient with Jan 2 birthday appears in a 7-day window when today is Dec 28", () => {
    const today = makeToday(2024, 12, 28);
    const dob = "1990-01-02";
    const days = getDaysUntilNextBirthday(today, dob);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("returns a value > 7 when today is Dec 28 and birthday is Dec 27 (yesterday)", () => {
    const today = makeToday(2024, 12, 28);
    const dob = "1990-12-27";
    const days = getDaysUntilNextBirthday(today, dob);
    expect(days).toBeGreaterThan(7);
  });

  it("patient with Dec 27 birthday does NOT appear in the 7-day window when today is Dec 28", () => {
    const today = makeToday(2024, 12, 28);
    const dob = "1990-12-27";
    const days = getDaysUntilNextBirthday(today, dob);
    expect(days).not.toBeLessThanOrEqual(7);
  });
});

describe("getDaysUntilNextBirthday — same-day and near-boundary cases", () => {
  it("returns 0 when today is the birthday", () => {
    const today = makeToday(2024, 6, 15);
    const dob = "1990-06-15";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(0);
  });

  it("returns 1 when birthday is tomorrow", () => {
    const today = makeToday(2024, 6, 14);
    const dob = "1990-06-15";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(1);
  });

  it("returns 364 or 365 for a birthday that was yesterday (mid-year)", () => {
    const today = makeToday(2024, 6, 15);
    const dob = "1990-06-14";
    const days = getDaysUntilNextBirthday(today, dob);
    expect(days).toBeGreaterThanOrEqual(364);
    expect(days).toBeLessThanOrEqual(366);
  });

  it("returns 3 when today is Dec 29 and birthday is Jan 1", () => {
    const today = makeToday(2024, 12, 29);
    const dob = "1985-01-01";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(3);
  });

  it("returns 7 when today is Dec 25 and birthday is Jan 1 (inclusive boundary)", () => {
    const today = makeToday(2024, 12, 25);
    const dob = "1985-01-01";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(7);
  });

  it("returns 8 when today is Dec 24 and birthday is Jan 1 (just outside 7-day window)", () => {
    const today = makeToday(2024, 12, 24);
    const dob = "1985-01-01";
    expect(getDaysUntilNextBirthday(today, dob)).toBe(8);
  });
});
