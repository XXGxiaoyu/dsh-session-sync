/**
 * End-to-end tests for dsh-session-sync's host half.
 *
 * Two independent plugin instances are booted in one process with:
 *   - their own `home` (state dir + session store),
 *   - their own GUI web server (what the browser would call),
 *   - their own sync port,
 *   - and mutual unicast seeds standing in for "two machines on the LAN"
 *     (broadcast delivery to two sockets on one host is OS dependent, so the
 *     seed path exercises exactly the same beacon protocol deterministically).
 *
 * Run: node --test test/
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { apply as applyPlugin } from '../lib/index.js'
import { expandTarget } from '../lib/discovery.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function tempHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `dsh-sync-${tag}-`))
}

function fakeStore() {
  const map = new Map()
  const persistence = {
    map,
    async list() {
      return [...map.entries()].map(([id, value]) => ({
        header: structuredClone(value.header),
        revision: value.events.length,
        eventCount: value.events.length,
        sizeBytes: 0,
        formatStatus: 'current',
      }))
    },
    async create(header) {
      // Mirror dsh-session-format-v3-to-v4's assertReleasedV4Header: a stray
      // key (e.g. the storage-owned `type`) makes the real backend throw
      // "format v4 header has unexpected field <key>".
      const allowed = new Set(['version', 'id', 'createdAt', 'isSeeded', 'delegationDepth', 'cwd', 'parentSession', 'origin', 'agentPreset'])
      const stray = Object.keys(header).find((key) => !allowed.has(key))
      if (stray !== undefined) throw new Error(`format v4 header has unexpected field ${stray}`)
      if (header.version !== 4) throw new Error('expected format v4 header')
      if (typeof header.cwd !== 'string' || !path.isAbsolute(header.cwd)) throw new Error('format v4 header cwd must be absolute')
      if (map.has(header.id)) throw new Error('exists')
      const record = { header: structuredClone(header), events: [] }
      map.set(header.id, record)
      let closed = false
      return {
        async read() {
          return { eventState: 'detached', events: structuredClone(record.events) }
        },
        async append(events) {
          if (closed) throw new Error('closed')
          for (const [index, event] of events.entries()) {
            if (event.seq !== record.events.length + index) throw new Error(`gap at ${event.seq}`)
            // Mirror restoreReleasedV4Artifact: an unseeded log must not carry an
            // inherited end-seed marker, or DSH refuses to load it later.
            if (record.header.isSeeded === false && event.type === 'session/end-seed' && event.data?.inherited === true) {
              throw new Error('released v2 unseeded Session contains an inherited end-seed marker')
            }
          }
          record.events.push(...structuredClone(events))
        },
        async flush() {},
        async close() {
          closed = true
        },
      }
    },
    async open(id) {
      const record = map.get(id)
      if (record === undefined) throw new Error('not found')
      return {
        async read() {
          return { eventState: 'detached', events: structuredClone(record.events) }
        },
        async append() {
          throw new Error('read-only')
        },
        async flush() {},
        async close() {},
      }
    },
    async stat(id) {
      const record = map.get(id)
      if (record === undefined) throw new Error('not found')
      return { header: structuredClone(record.header), eventCount: record.events.length, sizeBytes: 0 }
    },
  }
  const query = {
    async listSessions() {
      return [...map.values()].map((value) => ({
        header: structuredClone(value.header),
        live: false,
        persisted: true,
        formatStatus: 'current',
      }))
    },
    async readSession(id) {
      const record = map.get(id)
      if (record === undefined) throw new Error(`no session ${id}`)
      return {
        session: structuredClone(record.header),
        events: structuredClone(record.events),
        inheritedEventCount: 0,
      }
    },
    async readTitleSnapshots(ids) {
      // DSH returns *settled results*, not bare snapshots — mirror that shape so
      // a regression that forgets to unwrap it fails here instead of at runtime.
      return ids.map((id) => {
        const record = map.get(id)
        if (record === undefined) return { status: 'rejected', reason: new Error(`no session ${id}`) }
        return {
          status: 'fulfilled',
          value: { session: structuredClone(record.header), ...(record.title === undefined ? {} : { title: record.title }) },
        }
      })
    },
  }
  return { map, persistence, query }
}

/**
 * Every instance this suite booted. Tests that assert their own cleanup keep
 * calling `stop()`; this list is the safety net, because one instance left
 * running pins an HTTP server, a LAN listener and a UDP socket, and
 * `node --test` then hangs after the last assertion instead of exiting.
 */
const bootedInstances = []
after(async () => {
  for (const instance of bootedInstances) await instance.stop()
})

async function bootInstance({ tag, discoveryPort, seeds, home: reuseHome, config = {} }) {
  const home = reuseHome ?? tempHome(tag)
  const store = fakeStore()
  const routes = []
  const ctx = {
    get(name) {
      if (name === 'sessionQuery') return store.query
      if (name === 'sessionPersistence') return store.persistence
      return undefined
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {
          const index = routes.indexOf(route)
          if (index >= 0) routes.splice(index, 1)
        }
      },
    },
    effect(fn) {
      const disposer = fn()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
  }
  const web = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = routes.find((candidate) => url.pathname.startsWith(candidate.path))
    if (route === undefined) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end('{"ok":false}')
      return
    }
    route.handler(req, res)
  })
  await new Promise((resolve) => web.listen(0, '127.0.0.1', resolve))
  const webPort = web.address().port
  const handle = applyPlugin(ctx, {
    home,
    discoveryPort,
    lanPort: 0,
    seeds,
    verbose: false,
    // The suite runs every instance on 127.0.0.1, which the host would otherwise
    // classify as "this machine" and hide.
    allowLoopbackPeers: true,
    ...config,
  })
  await handle.ready
  const instance = {
    home,
    store,
    handle,
    web, 
    webPort,
    api: async (action, payload = {}) => {
      const response = await fetch(`http://127.0.0.1:${webPort}/session-sync/api`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      return { status: response.status, body: await response.json() }
    },
    /** Idempotent: a test may stop its instance and the safety net runs anyway. */
    async stop() {
      try { web.close() } catch { /* already stopped */ }
      try { handle.discovery.close() } catch { /* already stopped */ }
      try { handle.lan.close() } catch { /* already stopped */ }
    },
  }
  bootedInstances.push(instance)
  return instance
}

async function waitFor(predicate, { timeout = 12000, interval = 100, label = 'condition' } = {}) {
  const started = Date.now()
  for (;;) {
    if (await predicate()) return
    if (Date.now() - started > timeout) throw new Error(`timeout waiting for ${label}`)
    await sleep(interval)
  }
}

function seedSession(store, id, title, cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-sync-cwd-'))) {
  store.map.set(id, {
    title,
    header: {
      type: 'session',
      version: 4,
      id,
      createdAt: Date.now() - 60_000,
      cwd,
      isSeeded: false,
      delegationDepth: 0,
      agentPreset: 'standard',
    },
    events: [
      { type: 'message', seq: 0, time: Date.now() - 60_000, data: { role: 'user', content: title } },
      { type: 'message', seq: 1, time: Date.now() - 50_000, data: { role: 'assistant', content: '好的' } },
    ],
  })
}

test('LAN discovery, custom naming cache, pull and push', async () => {
  // A private, per-run port pair: a stray instance from an earlier run must
  // never be mistaken for the two devices under test.
  const portA = 50000 + Math.floor(Math.random() * 1200)
  const portB = portA + 1
  const a = await bootInstance({ tag: 'a', discoveryPort: portA, seeds: [`127.0.0.1:${portB}`] })
  const b = await bootInstance({ tag: 'b', discoveryPort: portB, seeds: [`127.0.0.1:${portA}`] })

  try {
    await waitFor(async () => {
      const response = await a.api('state')
      return response.body.peers.length > 0
    }, { label: 'A 发现 B' })

    const stateA = (await a.api('state')).body
    assert.equal(stateA.peers.length, 1)
    const peerB = stateA.peers[0]
    assert.equal(peerB.online, true)
    assert.equal(peerB.id, b.handle.state.self.id)
    assert.equal(peerB.port, b.handle.lan.port)
    assert.equal(peerB.sameMachine, true, 'a peer on 127.0.0.1 is this machine, not another device')

    // ── custom name is local-only and cached ────────────────────────────
    const renamed = await a.api('rename', { peerId: peerB.id, name: '客厅那台 Mac' })
    assert.equal(renamed.status, 200)
    assert.equal(renamed.body.peer.name, '客厅那台 Mac')

    const persisted = JSON.parse(fs.readFileSync(path.join(a.home, 'session-sync', 'state.json'), 'utf8'))
    assert.equal(persisted.peers[peerB.id].customName, '客厅那台 Mac')

    // ── ui language: 'auto' by default, only the three known values stick ──
    const defaultLocale = await a.api('state')
    assert.equal(defaultLocale.body.settings.locale, 'auto', 'a fresh install follows DSH / the system')
    const pinned = await a.api('settings', { patch: { locale: 'en' } })
    assert.equal(pinned.body.settings.locale, 'en')
    const bogus = await a.api('settings', { patch: { locale: 'klingon' } })
    assert.equal(bogus.body.settings.locale, 'en', 'unknown languages are ignored, not stored')
    const storedLocale = JSON.parse(fs.readFileSync(path.join(a.home, 'session-sync', 'state.json'), 'utf8'))
    assert.equal(storedLocale.settings.locale, 'en', 'the choice survives a restart')

    // The peer's own name is untouched on the peer side.
    const diag = (await a.api('diag')).body
    assert.equal(diag.platform, process.platform, 'diagnostics identify the host platform')
    assert.equal(typeof diag.node, 'string')
    assert.equal(diag.version, stateA.version)
    assert.equal(diag.selfIp.length > 0, true, 'the self card needs a dialable address')
    assert.equal(diag.ports.lan, (await a.api('state')).body.self.port)

    const stateB = (await b.api('state')).body
    assert.equal(stateB.self.name, b.handle.state.self.name)

    // ── rename survives an offline gap and the peer coming back ─────────
    await b.stop()
    await waitFor(async () => {
      const response = await a.api('state')
      const peer = response.body.peers.find((candidate) => candidate.id === peerB.id)
      return peer !== undefined && peer.online === false
    }, { label: 'B 离线', timeout: 20_000 })

    const offlineView = (await a.api('state')).body.peers.find((candidate) => candidate.id === peerB.id)
    assert.equal(offlineView.name, '客厅那台 Mac')
    assert.equal(offlineView.customName, '客厅那台 Mac')
    assert.equal(offlineView.address, '127.0.0.1')

    const b2 = await bootInstance({ tag: 'b2', home: b.home, discoveryPort: portB, seeds: [`127.0.0.1:${portA}`] })
    assert.equal(b2.handle.state.self.id, b.handle.state.self.id, '重启后设备身份必须稳定')
    await waitFor(async () => {
      const response = await a.api('state')
      const peer = response.body.peers.find((candidate) => candidate.id === peerB.id)
      return peer !== undefined && peer.online === true
    }, { label: 'B 重新上线' })

    const onlineAgain = (await a.api('state')).body.peers.find((candidate) => candidate.id === peerB.id)
    assert.equal(onlineAgain.name, '客厅那台 Mac', '自定义命名在设备重新上线后仍生效')

    // ── pull one session from B ─────────────────────────────────────────
    seedSession(b2.store, 'session-from-b', 'B 上的会话')
    const listB = await a.api('peerSessions', { peerId: peerB.id })
    assert.equal(listB.status, 200)
    assert.equal(listB.body.sessions.length, 1)
    assert.equal(listB.body.sessions[0].id, 'session-from-b')
    assert.equal(listB.body.sessions[0].imported, null)

    const pulled = await a.api('pull', { peerId: peerB.id, sessionId: 'session-from-b' })
    assert.equal(pulled.status, 200)
    const localId = pulled.body.imported.localId
    assert.match(localId, /^session-/)
    const imported = a.store.map.get(localId)
    assert.ok(imported, '拉取的会话必须写入本地会话库')
    assert.equal(imported.events.length, 2)
    assert.deepEqual(imported.events.map((event) => event.seq), [0, 1])
    assert.equal(imported.events[0].data.content, 'B 上的会话')
    assert.equal(imported.header.cwd, b2.store.map.get('session-from-b').header.cwd, '本机存在的源目录原样保留')

    // A directory that does not exist here falls back to this instance's cwd so
    // the pulled session still shows up in the local workspace.
    seedSession(b2.store, 'session-ghost', '不存在的目录', '/definitely/not/here')
    const ghost = await a.api('pull', { peerId: peerB.id, sessionId: 'session-ghost' })
    assert.equal(ghost.status, 200)
    const ghostHeader = a.store.map.get(ghost.body.imported.localId).header
    assert.equal(ghostHeader.cwd, process.cwd())
    assert.ok(!Object.hasOwn(ghostHeader, 'type'), 'the storage-owned type field stays out of the header')

    assert.match(pulled.body.imported.sha256, /^[0-9a-f]{64}$/, '拉取时要带上校验和')
    assert.equal(pulled.body.imported.verified, true, '对端提供了 sha256 就必须校验通过')

    const verified = await a.api('verify', { peerId: peerB.id, sessionId: 'session-from-b' })
    assert.equal(verified.status, 200)
    assert.equal(verified.body.verified, true, 'verify 要重算摘要并与对端声明的值比对')
    assert.equal(verified.body.localMatch, true, '本机副本的摘要应与对端一致')
    assert.equal(verified.body.sha256.length, 64)

    const listedAfter = await a.api('peerSessions', { peerId: peerB.id })
    assert.equal(listedAfter.body.sessions[0].imported.localId, localId, '已拉取状态要能在列表里看到')

    // ── push one session back ───────────────────────────────────────────
    seedSession(a.store, 'session-on-a', 'A 本地会话')
    const pushed = await a.api('push', { peerId: peerB.id, sessionId: 'session-on-a' })
    assert.equal(pushed.status, 200)
    const pushedLocal = b2.store.map.get(pushed.body.remoteId)
    assert.ok(pushedLocal, '推送的会话必须写入对端会话库')
    assert.equal(pushedLocal.events.length, 2)

    // ── the raw LAN API is fenced ───────────────────────────────────────
    const unfenced = await fetch(`http://127.0.0.1:${b2.handle.lan.port}/v1/sessions`)
    assert.equal(unfenced.status, 401)
    const fenced = await fetch(`http://127.0.0.1:${b2.handle.lan.port}/v1/info`, {
      headers: { 'x-dsh-session-sync': '1' },
    })
    assert.equal(fenced.status, 200)
    const info = await fenced.json()
    assert.equal(info.ok, true)
    assert.equal(info.id, b2.handle.state.self.id)

    await b2.stop()
  } finally {
    await a.stop()
    await b.stop().catch(() => {})
  }
})

test('state survives a plugin restart (same home)', async () => {
  const home = tempHome('restart')
  const store = fakeStore()
  const ctx = {
    get(name) {
      if (name === 'sessionQuery') return store.query
      if (name === 'sessionPersistence') return store.persistence
      return undefined
    },
    webServer: { register: () => () => {} },
    effect: (fn) => { fn(); return () => {} },
  }
  const first = applyPlugin(ctx, { home, discoveryPort: 47921, lanPort: 0, verbose: false })
  await first.ready
  const id = first.state.self.id
  first.store.update((state) => {
    state.self.name = '我的工作站'
    state.peers['peer-x'] = { remoteName: '对面机器', customName: '书房 PC', address: '10.0.0.9', port: 47802 }
  })
  first.store.dispose()
  first.discovery.close()
  first.lan.close()

  const second = applyPlugin(ctx, { home, discoveryPort: 47922, lanPort: 0, verbose: false })
  await second.ready
  assert.equal(second.state.self.id, id)
  assert.equal(second.state.self.name, '我的工作站')
  assert.equal(second.state.peers['peer-x'].customName, '书房 PC')
  second.store.dispose()
  second.discovery.close()
  second.lan.close()
})

test('auto-pull does not bounce one conversation between two devices', async () => {
  const portA = 51000 + Math.floor(Math.random() * 800)
  const portB = portA + 1
  const fast = { autoPullIntervalMs: 1_000 }
  const a = await bootInstance({ tag: 'pp-a', discoveryPort: portA, seeds: [`127.0.0.1:${portB}`], config: fast })
  const b = await bootInstance({ tag: 'pp-b', discoveryPort: portB, seeds: [`127.0.0.1:${portA}`], config: fast })

  try {
    await waitFor(async () => (await a.api('state')).body.peers.length > 0, { label: '两台设备互相发现' })
    seedSession(a.store, 'session-shared', '只应存在一份的对话')
    // 两端都打开自动拉取：这是把重复导入放大成无限循环的前提条件。
    await a.api('settings', { patch: { autoPull: true } })
    await b.api('settings', { patch: { autoPull: true } })

    await waitFor(() => b.store.map.size === 1, { label: 'B 自动拉取到会话' })
    // 再等几个轮次：以前这里会长出 A→B→A 的副本链。
    await sleep(4_000)

    assert.equal(a.store.map.size, 1, 'A 不该把 B 的副本再拉回来')
    assert.equal(b.store.map.size, 1, 'B 也不该继续生成副本')
    const importedCount = Object.keys(a.handle.state.imports).length + Object.keys(b.handle.state.imports).length
    assert.equal(importedCount, 1, '两个设备合计只应记录一次导入')
  } finally {
    await a.stop()
    await b.stop()
    a.handle.store.dispose()
    b.handle.store.dispose()
  }
})

test('a pushed session is not re-imported by its own origin', async () => {
  const portA = 52000 + Math.floor(Math.random() * 800)
  const portB = portA + 1
  const fast = { autoPullIntervalMs: 1_000 }
  const a = await bootInstance({ tag: 'pu-a', discoveryPort: portA, seeds: [`127.0.0.1:${portB}`], config: fast })
  const b = await bootInstance({ tag: 'pu-b', discoveryPort: portB, seeds: [`127.0.0.1:${portA}`], config: fast })

  try {
    await waitFor(async () => (await a.api('state')).body.peers.length > 0, { label: '两台设备互相发现' })
    seedSession(a.store, 'session-origin', '推送出去的对话')
    const peerB = (await a.api('state')).body.peers[0]
    const pushed = await a.api('push', { peerId: peerB.id, sessionId: 'session-origin' })
    assert.equal(pushed.status, 200)

    await a.api('settings', { patch: { autoPull: true } })
    await sleep(3_500)
    assert.equal(a.store.map.size, 1, 'A 不能把自己推出去的副本拉回本地')
  } finally {
    await a.stop()
    await b.stop()
    a.handle.store.dispose()
    b.handle.store.dispose()
  }
})

test('sha256 pins every byte of a session, and a tampered payload is refused', async () => {
  const portA = 50000 + Math.floor(Math.random() * 1200)
  const a = await bootInstance({ tag: 'sha', discoveryPort: portA })
  try {
    seedSession(a.store, 'session-sha', '校验样例')
    const exported = await a.handle.bridge.exportSession('session-sha')
    assert.equal(exported.format, 'dsh-session-sync/1')
    assert.match(exported.sha256, /^[0-9a-f]{64}$/)

    const tampered = {
      ...exported,
      events: exported.events.map((event, index) => (index === 0 ? { ...event, time: event.time + 1 } : event)),
    }
    await assert.rejects(
      () => a.handle.bridge.importSession(tampered),
      (error) => error.code === 'checksum-mismatch',
      'flipping one byte must fail the import',
    )

    const imported = await a.handle.bridge.importSession(exported)
    assert.equal(imported.verified, true)
    assert.equal(imported.sha256, exported.sha256)
    assert.equal(imported.events, 2)

    // Deterministic: exporting the same session twice hashes to the same value.
    const repeat = await a.handle.bridge.exportSession('session-sha')
    assert.equal(repeat.sha256, exported.sha256)
    // ...and the imported copy gets its own digest, because it is its own id.
    const copy = await a.handle.bridge.exportSession(imported.id)
    assert.match(copy.sha256, /^[0-9a-f]{64}$/)
    assert.notEqual(copy.sha256, exported.sha256)
  } finally {
    await a.stop()
    a.handle.store.dispose()
  }
})

test('cross-subnet scan targets are validated, persisted and expanded', async () => {
  assert.deepEqual(expandTarget('192.168.5.0/30'), ['192.168.5.1', '192.168.5.2'])
  assert.deepEqual(expandTarget('10.0.0.7'), ['10.0.0.7'])
  assert.deepEqual(expandTarget('nonsense'), [])
  assert.equal(expandTarget('10.0.0.0/16').length, 4096, 'a /16 is capped at 4096 probes, not 65k')
  assert.deepEqual(expandTarget('10.0.0.0/8'), [], 'a /8 is refused outright')

  const inst = await bootInstance({ tag: 'subnets', discoveryPort: 47891 })
  try {
    const before = await inst.api('state')
    assert.deepEqual(before.body.settings.subnets, [])

    const saved = await inst.api('settings', { patch: { subnets: [' 192.168.5.0/24 ', '10.1.2.3', '  '] } })
    assert.deepEqual(saved.body.settings.subnets, ['192.168.5.0/24', '10.1.2.3'])
  } finally {
    await inst.stop()
  }
  // Same home → the list survives a restart, so a cross-subnet peer stays
  // reachable without retyping it.
  const again = await bootInstance({ tag: 'subnets', discoveryPort: 47892, home: inst.home, config: { seeds: [] } })
  try {
    const state = await again.api('state')
    assert.deepEqual(state.body.settings.subnets, ['192.168.5.0/24', '10.1.2.3'])
  } finally {
    await again.stop()
  }
})

test('the receiver dedupes a session pushed twice', async () => {
  const portA = 52000 + Math.floor(Math.random() * 400)
  const portB = portA + 1
  const a = await bootInstance({ tag: 'dedupe-a', discoveryPort: portA, seeds: [`127.0.0.1:${portB}`] })
  const b = await bootInstance({ tag: 'dedupe-b', discoveryPort: portB, seeds: [`127.0.0.1:${portA}`] })
  try {
    seedSession(a.store, 'session-dedupe', '只应存在一份')
    await waitFor(async () => (await a.api('state')).body.peers.some((entry) => entry.online === true), { label: 'B online' })

    const peers = (await a.api('state')).body.peers
    const peer = peers.find((entry) => entry.online === true)
    assert.ok(peer, 'B must be discovered before pushing')

    const first = await a.api('push', { peerId: peer.id, sessionId: 'session-dedupe' })
    assert.equal(first.body.skipped === true, false)
    const second = await a.api('push', { peerId: peer.id, sessionId: 'session-dedupe' })
    assert.equal(second.body.skipped, true, 'the second push is a duplicate')
    assert.equal(b.store.map.size, 1, 'the receiver kept exactly one copy')

    const forced = await a.api('push', { peerId: peer.id, sessionId: 'session-dedupe', force: true })
    assert.equal(forced.body.skipped === true, false, 'force bypasses dedupe')
    assert.equal(b.store.map.size, 2)
  } finally {
    await a.stop()
    await b.stop()
  }
})

test('a peer behind a UDP-blocking network is found over HTTP', async () => {
  // Both instances get a random discovery port, so neither beacon socket is
  // reachable by the other's broadcast: the only path left is the HTTP probe
  // against the peer's explicit `ip:port` entry.
  const b = await bootInstance({ tag: 'http-b', discoveryPort: 0, seeds: [] })
  try {
    const bId = (await b.api('state')).body.self.id
    const bSyncPort = b.handle.lan.port
    assert.ok(Number.isInteger(bSyncPort), 'the peer must expose a sync port')

    const a = await bootInstance({ tag: 'http-a', discoveryPort: 0, seeds: [], config: { subnets: [`127.0.0.1:${bSyncPort}`] } })
    try {
      await waitFor(async () => {
        const state = (await a.api('state')).body
        return state.peers.some((peer) => peer.id === bId && peer.online === true)
      }, { timeout: 20000, interval: 300, label: 'HTTP-discovered peer' })

      const peer = (await a.api('state')).body.peers.find((entry) => entry.id === bId)
      assert.equal(peer.via, 'http', 'UDP cannot have delivered this peer')
      assert.equal(peer.port, bSyncPort)

      // The same port serves the sync API the pull would use.
      const listed = await fetch(`http://127.0.0.1:${peer.port}/v1/sessions`, { headers: { 'x-dsh-session-sync': '1' } })
      assert.equal(listed.status, 200)
    } finally {
      await a.stop()
    }
  } finally {
    await b.stop()
  }
})

test('peers on this machine never reach the device list', async () => {
  const discoveryA = 53000 + Math.floor(Math.random() * 500)
  const discoveryB = discoveryA + 1
  const a = await bootInstance({ tag: 'hide-a', discoveryPort: discoveryA, seeds: [], config: { allowLoopbackPeers: false } })
  const b = await bootInstance({ tag: 'hide-b', discoveryPort: discoveryB, seeds: [] })
  try {
    // Point A at B's beacon port: both run on 127.0.0.1, i.e. this machine.
    await a.api('settings', { patch: { seeds: [`127.0.0.1:${discoveryB}`] } })
    await sleep(2500)
    const stateA = (await a.api('state')).body
    assert.equal(stateA.peers.length, 0, 'a peer on this host address is not another device')
    assert.equal(stateA.peers.filter((peer) => peer.online).length, 0, 'no peer is reported online')
    assert.equal(stateA.self.ip !== undefined, true, 'the machine itself is still shown')
  } finally {
    await a.stop()
    await b.stop()
  }
})

test('session titles from the settled readTitleSnapshots shape reach the GUI', async () => {
  const a = await bootInstance({ tag: 'titles', discoveryPort: 0 })
  try {
    seedSession(a.store, 'session-titled-1', '开发 DSH 局域网同步插件')
    const listed = (await a.api('localSessions')).body
    const row = listed.sessions.find((session) => session.id === 'session-titled-1')
    assert.ok(row !== undefined, 'the seeded session must be listed')
    assert.equal(row.title, '开发 DSH 局域网同步插件', 'every row looked untitled while the settled envelope was not unwrapped')
  } finally {
    a.handle.discovery.close()
    a.handle.lan.close()
  }
})

test('concurrent transfers default to auto and accept an explicit 1..16', async () => {
  const a = await bootInstance({ tag: 'concurrency', discoveryPort: 0 })
  try {
    const initial = (await a.api('state')).body
    assert.equal(initial.settings.concurrency, 0, '0 means "pick from this machine"')
    assert.ok(initial.concurrency >= 1 && initial.concurrency <= 5, `auto resolves to a sane cap, got ${initial.concurrency}`)

    const saved = (await a.api('settings', { patch: { concurrency: 8 } })).body
    assert.equal(saved.settings.concurrency, 8)
    const resolved = (await a.api('state')).body
    assert.equal(resolved.settings.concurrency, 8)
    assert.equal(resolved.concurrency, 8, 'an explicit cap wins over the machine default')

    const ignored = (await a.api('settings', { patch: { concurrency: 99 } })).body
    assert.equal(ignored.settings.concurrency, 8, 'out-of-range values are ignored, not clamped silently')
    const persisted = JSON.parse(fs.readFileSync(path.join(a.home, 'session-sync', 'state.json'), 'utf8'))
    assert.equal(persisted.settings.concurrency, 8)
  } finally {
    a.handle.discovery.close()
    a.handle.lan.close()
  }
})

test('the auto-sync folder is validated, created, persisted and used by auto-pull', async () => {
  const discoveryA = 54000 + Math.floor(Math.random() * 400)
  const a = await bootInstance({ tag: 'sync-dir-a', discoveryPort: discoveryA, seeds: [], config: { autoPullIntervalMs: 1000 } })
  const b = await bootInstance({ tag: 'sync-dir-b', discoveryPort: discoveryA + 1, seeds: [], config: { autoPullIntervalMs: 1000 } })
  try {
    await a.api('settings', { patch: { seeds: [`127.0.0.1:${discoveryA + 1}`] } })
    await b.api('settings', { patch: { seeds: [`127.0.0.1:${discoveryA}`] } })
    await waitFor(async () => (await a.api('state')).body.peers.some((peer) => peer.online), { label: 'peer online' })
    const target = path.join(a.home, 'workspace', 'synced')
    const saved = await a.api('settings', { patch: { syncDir: target } })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.settings.syncDir, target, 'the folder is stored verbatim')
    assert.equal(fs.existsSync(target), true, 'the folder is created on save')

    const rejected = await a.api('settings', { patch: { syncDir: 'relative/dir' } })
    assert.equal(rejected.status, 400, 'only absolute paths are accepted')

    // Auto-pull must land in the configured folder, not in the source cwd.
    seedSession(b.store, 'session-auto-dir', 'B 的目录测试')
    await a.api('settings', { patch: { autoPull: true } })
    await waitFor(() => (a.store.map.has('session-auto-dir') ? true : [...a.store.map.keys()].some((id) => id !== 'session-auto-dir')), { label: 'auto pull' })
    const imported = [...a.store.map.values()].find((entry) => entry.header.cwd === target)
    assert.ok(imported, 'the auto-pulled session keeps the configured folder as cwd')
  } finally {
    await a.stop()
    await b.stop()
  }
})

test('the workspace picker reads names from DSH storage', async () => {
  const instance = await bootInstance({ tag: 'workspaces', discoveryPort: 54300 + Math.floor(Math.random() * 200), seeds: [] })
  try {
    const storages = path.join(instance.home, 'storages')
    fs.mkdirSync(storages, { recursive: true })
    fs.writeFileSync(path.join(storages, 'workspace.json'), JSON.stringify({
      unit: { name: 'workspace', version: 2 },
      global: { workspaceIds: ['w1'] },
      tables: { workspaces: { w1: { path: path.join(instance.home, 'projects', 'alpha'), title: 'alpha' } } },
    }))
    const state = (await instance.api('state')).body
    assert.equal(state.workspaces.length, 1)
    assert.equal(state.workspaces[0].title, 'alpha')
    assert.match(state.syncDir, /session-sync\/unsorted$/, '未分组 is the default target')
  } finally {
    await instance.stop()
  }
})

test('importing a seeded session drops the inherited prefix instead of copying a corrupt log', async () => {
  const portA = 50000 + Math.floor(Math.random() * 1200)
  const a = await bootInstance({ tag: 'seed-src', discoveryPort: portA })
  try {
    // A forked session: the inherited block ends with a tagged marker, then the
    // session continues on its own. Copying that marker into an unseeded copy is
    // exactly what made DSH report
    // "released v2 unseeded Session contains an inherited end-seed marker".
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-sync-seed-'))
    const events = [
      { type: 'message', seq: 0, time: 1_700_000_000_000, data: { role: 'user', content: 'inherited question' } },
      { type: 'session/end-seed', seq: 1, time: 1_700_000_001_000, data: { inherited: true } },
      { type: 'message', seq: 2, time: 1_700_000_002_000, data: { role: 'user', content: 'own question' } },
      { type: 'message', seq: 3, time: 1_700_000_003_000, data: { role: 'assistant', content: 'own answer' } },
    ]
    a.store.map.set('session-seeded', {
      header: {
        type: 'session',
        version: 4,
        id: 'session-seeded',
        createdAt: 1_700_000_000_000,
        cwd,
        parentSession: 'session-parent',
        isSeeded: true,
        delegationDepth: 0,
        agentPreset: 'standard',
      },
      events,
    })

    const exported = await a.handle.bridge.exportSession('session-seeded')
    const imported = await a.handle.bridge.importSession(exported, { cwd })

    const stored = a.store.map.get(imported.id)
    assert.ok(stored, 'the import must be materialised')
    assert.equal(stored.header.isSeeded, false, 'an imported copy is never seeded')
    assert.equal(stored.header.parentSession, undefined, 'the copy does not point at a foreign parent')
    const inherited = stored.events.filter(
      (event) => event.type === 'session/end-seed' && event.data?.inherited === true,
    )
    assert.deepEqual(inherited, [], 'no inherited marker may survive the import')
    assert.deepEqual(stored.events.map((event) => event.seq), stored.events.map((_, index) => index), 'seq stays dense')
    assert.deepEqual(
      stored.events.map((event) => event.data?.content ?? event.type),
      ['own question', 'own answer'],
      'only the events the source authored itself are copied',
    )
  } finally {
    await a.handle.store.dispose()
  }
})
