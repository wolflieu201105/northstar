const defaultFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' })
const minute = 60_000
const day = 24 * 60 * minute
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * day], ['month', 30 * day], ['week', 7 * day],
  ['day', day], ['hour', 60 * minute], ['minute', minute],
]

export function relativeActivityTime(value: string, now = Date.now(), locale?: string) {
  const difference = Date.parse(value) - now
  if (!Number.isFinite(difference)) return 'Time unavailable'
  if (Math.abs(difference) < minute) return 'Just now'
  const formatter = locale ? new Intl.RelativeTimeFormat(locale, { numeric: 'always' }) : defaultFormatter
  const [unit, duration] = units.find(([, size]) => Math.abs(difference) >= size)!
  return formatter.format(Math.trunc(difference / duration), unit)
}
