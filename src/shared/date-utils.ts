/**
 * Returns today's date as YYYY-MM-DD in the **local** timezone.
 *
 * Never use `new Date().toISOString().slice(0, 10)` — that returns UTC,
 * which rolls to the next day after 5 PM in negative-UTC timezones (e.g. PDT).
 */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
