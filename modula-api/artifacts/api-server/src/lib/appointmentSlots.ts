const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function weekdayFromDateString(date: string) {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function buildAppointmentSlots(
  windows: { startTime: string; endTime: string; slotDurationMinutes: number }[],
  bookings: { startTime: string; endTime: string }[],
  lunchBreaks: { startTime: string; endTime: string }[] = [],
) {
  const slots = new Map<string, { startTime: string; endTime: string; available: boolean }>();
  for (const window of windows) {
    if (window.slotDurationMinutes <= 0) throw new Error("Duracao invalida na disponibilidade do profissional.");
    for (let start = timeToMinutes(window.startTime); start + window.slotDurationMinutes <= timeToMinutes(window.endTime); start += window.slotDurationMinutes) {
      const end = start + window.slotDurationMinutes;
      if (lunchBreaks.some((breakTime) =>
        start < timeToMinutes(breakTime.endTime) && end > timeToMinutes(breakTime.startTime)
      )) {
        continue;
      }
      const startTime = minutesToTime(start);
      slots.set(startTime, {
        startTime,
        endTime: minutesToTime(end),
        available: !bookings.some((booking) => start < timeToMinutes(booking.endTime) && end > timeToMinutes(booking.startTime)),
      });
    }
  }
  return [...slots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}
