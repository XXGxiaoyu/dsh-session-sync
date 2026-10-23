import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { encodeStoredLog } from '../lib/logfile.js'
import { SessionBridge } from '../lib/sessions.js'

const header = {
  type: 'session',
  version: 4,
  id: 'session-legacy-broken',
  createdAt: 1_700_000_000_000,
  cwd: '/tmp',
  isSeeded: false,
  delegationDepth: 0,
  agentPreset: 'standard',
}
const brokenEvents = [
  { type: 'message', seq: 0, time: 1, data: { role: 'user', content: 'inherited' } },
  { type: 'session/end-seed', seq: 1, time: 2, data: { inherited: true } },
  { type: 'message', seq: 2, time: 3, data: { role: 'user', content: 'own question' } },
  { type: 'message', seq: 3, time: 4, data: { role: 'assistant', content: 'own answer' } },
]

function storeLegacy(home) {
  const dir = path.join(home, 'sessions', '--tmp--', header.id)
  fs.mkdirSync(dir, { recursive: true })
  const text = [JSON.stringify(header), ...brokenEvents.map((event) => JSON.stringify(event))].join('\n') + '\n'
  fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), encodeStoredLog(text))
}

function throwingQuery(message) {
  return {
    async readSession() {
      throw new Error(message)
    },
  }
}

test('reading a legacy inherited session falls back to the stored log instead of failing the export', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-session-read-'))
  storeLegacy(home)
  const bridge = new SessionBridge(
    { get: (name) => (name === 'sessionQuery' ? throwingQuery('released v2 unseeded Session contains an inherited end-seed marker') : undefined) },
    { home },
  )

  const result = await bridge.read(header.id)
  assert.equal(result.session.id, header.id)
  assert.deepEqual(
    result.events.map((event) => event.data?.content ?? event.type),
    ['own question', 'own answer'],
    'the inherited prefix is stripped rather than exported as a corrupt log',
  )
  assert.ok(!result.events.some((event) => event.type === 'session/end-seed' && event.data?.inherited === true))
})

test('a non-inherited read failure is still surfaced', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-session-read-'))
  storeLegacy(home)
  const bridge = new SessionBridge(
    { get: (name) => (name === 'sessionQuery' ? throwingQuery('disk is on fire') : undefined) },
    { home },
  )
  await assert.rejects(() => bridge.read(header.id), /disk is on fire/)
})
