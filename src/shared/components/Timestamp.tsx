export function Timestamp({ value }: { value: string }) {
  const exact = new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return <time dateTime={value} title={exact}>{exact}</time>
}
