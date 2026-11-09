import { createFixtures } from './fixtures.mjs'
import { countChecks } from './checks.mjs'
import { verifyAccess } from './verify-access.mjs'

const fixtures = await createFixtures()
try {
  await verifyAccess(fixtures)
  const outcome = process.argv.includes('--skip-conflicts') ? 'PARTIAL (HTTP conflict check skipped)' : 'PASS'
  console.log(`${outcome}: ${countChecks()} real guest/API/Realtime checks.`)
  console.log('Registered-user conversion and visual/browser acceptance remain separate checks.')
} finally {
  await fixtures.cleanup()
}
