/**
 * Given today's date (midnight local) and a patient's date-of-birth string
 * (ISO "YYYY-MM-DD"), returns the number of days until the patient's next
 * birthday (0 = today, 1 = tomorrow, …).
 *
 * Handles the year-boundary correctly: if today is Dec 28 and the birthday is
 * Jan 2, the function returns 5, not a negative or very large number.
 */
export function getDaysUntilNextBirthday(today: Date, dateOfBirth: string): number {
  const dob = new Date(dateOfBirth + "T00:00:00");
  const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

  const nextBirthday =
    thisYearBirthday >= today
      ? thisYearBirthday
      : new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());

  const diffMs = nextBirthday.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
