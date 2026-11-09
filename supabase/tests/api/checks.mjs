import assert from 'node:assert/strict'

let checks = 0
export function check(condition, label) {
  assert.ok(condition, label)
  ++checks
}
export function countChecks() { return checks }
export async function allowed(request, label) {
  const { data, error } = await request
  check(!error, `${label}: expected success, received ${error?.code ?? 'transport error'}`)
  return data
}
export async function denied(request, label, code = '42501') {
  const { error, status } = await request
  check(error?.code === code, `${label}: expected ${code}, received ${error?.code || 'no SQLSTATE'} (HTTP ${status}): ${error?.message ?? 'success'}`)
}
export async function hidden(request, label) {
  const rows = await allowed(request, label)
  check(Array.isArray(rows) && rows.length === 0, `${label}: expected no visible rows`)
}

export function join(channel) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), 15_000)
    channel.subscribe((status) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        clearTimeout(timer)
        resolve(status)
      }
    })
  })
}
export async function eventually(predicate, label) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (predicate()) { check(true, label); return }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  check(false, label)
}
