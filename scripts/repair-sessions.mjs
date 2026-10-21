#!/usr/bin/env node
/**
 * Repair session logs imported by plugin builds before 0.5.5.
 *
 * Run with DSH closed (or just reload the app afterwards):
 *   node scripts/repair-sessions.mjs            # repair, keeping *.bak copies
 *   node scripts/repair-sessions.mjs --dry-run  # only report what would change
 *   node scripts/repair-sessions.mjs --home ~/.dsh
 */
import os from 'node:os'
import path from 'node:path'

import { repairStoredSessions } from '../lib/repair.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const homeFlag = args.indexOf('--home')
const home = homeFlag >= 0 && args[homeFlag + 1] ? args[homeFlag + 1] : process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const root = path.join(home, 'sessions')

const summary = repairStoredSessions(root, {
  dryRun,
  log: (message) => console.log(message),
})
console.log(
  `${dryRun ? 'would repair' : 'repaired'} ${summary.repaired} of ${summary.scanned} stored session(s)` +
    (summary.locked > 0 ? ` (${summary.locked} carried a lock marker)` : ''),
)
if (!dryRun && summary.repaired > 0) {
  console.log('Restart DSH, then open the conversation again. Originals are kept as *.bak next to each log.')
}
