import assert from 'node:assert/strict'
import test from 'node:test'

import { attachImportedSession } from '../lib/index.js'

function registryWith(id, calls) {
  const entity = {
    async attachSession(sessionId) {
      calls.push(`attach:${sessionId}`)
    },
    async insertSessionBefore(sessionId, before) {
      calls.push(`before:${sessionId}<${before}`)
    },
  }
  return { get: (workspaceId) => (workspaceId === id ? entity : undefined) }
}

test('an imported session is attached to the workspace before its anchor', async () => {
  const calls = []
  const placed = await attachImportedSession(registryWith('w-alpha', calls), 'session-new', {
    workspace: 'w-alpha',
    before: 'session-anchor',
  })
  assert.equal(placed, true)
  assert.deepEqual(calls, ['attach:session-new', 'before:session-new<session-anchor'])
})

test('without an anchor the session simply joins the workspace', async () => {
  const calls = []
  const placed = await attachImportedSession(registryWith('w-alpha', calls), 'session-new', { workspace: 'w-alpha' })
  assert.equal(placed, true)
  assert.deepEqual(calls, ['attach:session-new'])
})

test('an unknown workspace or a missing registry leaves the import untouched', async () => {
  const calls = []
  assert.equal(await attachImportedSession(registryWith('w-alpha', calls), 'session-new', { workspace: 'ghost' }), false)
  assert.equal(await attachImportedSession(null, 'session-new', { workspace: 'w-alpha' }), false)
  assert.equal(await attachImportedSession(registryWith('w-alpha', calls), 'session-new', {}), false)
  assert.deepEqual(calls, [])
})

test('a registry rejection surfaces to the caller so it can be logged', async () => {
  const registry = {
    get: () => ({
      async attachSession() {
        throw new Error("cannot attach session 'x': its cwd resolves elsewhere")
      },
      async insertSessionBefore() {},
    }),
  }
  await assert.rejects(
    () => attachImportedSession(registry, 'session-new', { workspace: 'w-alpha' }),
    /resolves elsewhere/,
  )
})
