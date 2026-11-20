import { describe, expect, it } from "vitest";
import { buildAppointmentSlots, weekdayFromDateString } from "../appointmentSlots";

describe("appointment slots", () => {
  const windows = [{ startTime: "08:00", endTime: "10:00", slotDurationMinutes: 30 }];
  it("generates sorted slots and marks overlapping bookings unavailable", () => {
    expect(buildAppointmentSlots(windows, [{ startTime: "08:15", endTime: "08:45" }])).toEqual([
      { startTime: "08:00", endTime: "08:30", available: false },
      { startTime: "08:30", endTime: "09:00", available: false },
      { startTime: "09:00", endTime: "09:30", available: true },
      { startTime: "09:30", endTime: "10:00", available: true },
    ]);
  });
  it("deduplicates overlapping windows without treating adjacent bookings as overlaps", () => {
    expect(buildAppointmentSlots([...windows, ...windows], [{ startTime: "07:30", endTime: "08:00" }])).toHaveLength(4);
    expect(buildAppointmentSlots(windows, [{ startTime: "07:30", endTime: "08:00" }])[0]?.available).toBe(true);
  });

  it("omits slots that overlap the configured one-hour lunch break", () => {
    const daytimeWindows = [{ startTime: "11:00", endTime: "14:00", slotDurationMinutes: 30 }];
    expect(buildAppointmentSlots(daytimeWindows, [], [{ startTime: "12:00", endTime: "13:00" }])).toEqual([
      { startTime: "11:00", endTime: "11:30", available: true },
      { startTime: "11:30", endTime: "12:00", available: true },
      { startTime: "13:00", endTime: "13:30", available: true },
      { startTime: "13:30", endTime: "14:00", available: true },
    ]);
  });
  it("rejects invalid durations rather than looping forever", () => {
    expect(() => buildAppointmentSlots([{ ...windows[0]!, slotDurationMinutes: 0 }], [])).toThrow();
  });
  it("uses the calendar weekday independently of the server timezone", () => {
    expect(weekdayFromDateString("2026-11-02")).toBe("monday");
  });
});
