import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { encodeStoredLog } from '../lib/logfile.js'
import { SessionBridge, sessionDigest, sessionSignature } from '../lib/sessions.js'

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

test('importing a named session writes a title event that does not change the fingerprint', async () => {
  const appended = []
  const persistence = {
    async create() {
      return {
        async append(events) { appended.push(...events) },
        async flush() {},
        async close() {},
      }
    },
  }
  const bridge = new SessionBridge(
    { get: (name) => (name === 'sessionPersistence' ? persistence : undefined) },
    { home: fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-session-title-')) },
  )
  const events = [{ type: 'message', seq: 0, time: 1, data: { role: 'user', content: 'hi' } }]
  const payload = { session: header, events, sha256: sessionDigest(header, events) }

  const imported = await bridge.importSession(payload, { cwd: '/tmp', title: 'Named session' })
  assert.equal(await bridge.titleOf(imported.id), 'Named session', 'the list should see the title immediately')

  const title = appended.find((event) => event.type === 'session/title')
  assert.ok(title, 'the remote title must be persisted as a title event')
  assert.equal(title.data.title, 'Named session')
  assert.deepEqual(title.data.messageSeqs, [], 'a user title has no message sources')
  assert.equal(title.data.source.kind, 'user')
  assert.equal(
    sessionSignature(header, events),
    sessionSignature(header, [...events, title]),
    'title metadata must not change the conversation fingerprint',
  )
})
