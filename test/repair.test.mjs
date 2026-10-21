import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { zstdCompressSync } from 'node:zlib'

import { decodeStoredLog } from '../lib/logfile.js'
import { listStoredLogs, repairLogText, repairStoredLog, repairStoredSessions } from '../lib/repair.js'

const header = {
  type: 'session',
  version: 4,
  id: 'session-broken',
  createdAt: 1_700_000_000_000,
  cwd: '/tmp',
  isSeeded: false,
  delegationDepth: 0,
  agentPreset: 'standard',
}
const broken = [
  { type: 'message', seq: 0, time: 1, data: { role: 'user', content: 'inherited' } },
  { type: 'session/end-seed', seq: 1, time: 2, data: { inherited: true } },
  { type: 'message', seq: 2, time: 3, data: { role: 'user', content: 'own question' } },
  { type: 'message', seq: 3, time: 4, data: { role: 'assistant', content: 'own answer' } },
]

function logText(h, events) {
  return [JSON.stringify(h), ...events.map((event) => JSON.stringify(event))].join('\n') + '\n'
}

function store(text, dir) {
  const sessionDir = path.join(dir, '--tmp--', 'session-broken')
  fs.mkdirSync(sessionDir, { recursive: true })
  // Two frames, like DSH's per-batch writes: zstdDecompressSync alone would
  // only see the header, so the frame walker has to find the second one.
  const split = text.indexOf('\n') + 1
  const bytes = Buffer.concat([
    zstdCompressSync(Buffer.from(text.slice(0, split))),
    zstdCompressSync(Buffer.from(text.slice(split))),
  ])
  const file = path.join(sessionDir, 'session.v4.jsonl.zstd')
  fs.writeFileSync(file, bytes)
  return { dir: sessionDir, file, bytes }
}

test('the frame walker reads every frame of a stored log', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-repair-'))
  const { file } = store(logText(header, broken), root)
  const text = decodeStoredLog(fs.readFileSync(file))
  assert.equal(text.trimEnd().split('\n').length, 5, 'header plus four events survive a two-frame file')
})

test('repair strips the inherited prefix and keeps the authored events', () => {
  const repaired = repairLogText(logText(header, broken))
  assert.ok(repaired)
  assert.equal(repaired.report.dropped, 2)
  assert.equal(repaired.report.events, 2)
  const lines = repaired.text.trimEnd().split('\n').map((line) => JSON.parse(line))
  assert.equal(lines[0].isSeeded, false, 'the copy stays unseeded')
  assert.deepEqual(lines.slice(1).map((event) => event.seq), [0, 1], 'seq is renumbered densely')
  assert.deepEqual(
    lines.slice(1).map((event) => event.data.content),
    ['own question', 'own answer'],
  )
})

test('a clean log is left alone', () => {
  const clean = [{ type: 'message', seq: 0, time: 1, data: { role: 'user', content: 'hi' } }]
  assert.equal(repairLogText(logText(header, clean)), null)
  const seeded = { ...header, isSeeded: true, parentSession: 'session-parent' }
  assert.equal(repairLogText(logText(seeded, broken)), null, 'DSH-written seeded logs are not touched')
})

test('repairing a stored session keeps a backup and leaves a readable log', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-repair-'))
  const { file, bytes } = store(logText(header, broken), root)
  const report = repairStoredLog(file)
  assert.deepEqual(report, { dropped: 2, events: 2 })
  assert.deepEqual(fs.readFileSync(`${file}.bak`), bytes, 'the original bytes are preserved')
  const text = decodeStoredLog(fs.readFileSync(file))
  assert.ok(!text.includes('"inherited":true'), 'no inherited marker survives')
  assert.equal(text.trimEnd().split('\n').length, 3)
})

test('a locked log is still repaired, because a corrupt log cannot be open', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-repair-'))
  const { dir, file } = store(logText(header, broken), root)
  fs.writeFileSync(path.join(dir, 'session.lock'), String(process.pid))
  const entries = listStoredLogs(root)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].locked, true)
  const summary = repairStoredSessions(root)
  assert.deepEqual(summary, { scanned: 1, repaired: 1, locked: 1 })
  const text = decodeStoredLog(fs.readFileSync(file))
  assert.ok(!text.includes('"inherited":true'), 'the lock marker does not block the repair')
  assert.ok(fs.existsSync(`${file}.bak`), 'the original bytes are still kept')
})
