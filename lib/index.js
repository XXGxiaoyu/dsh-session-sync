/**
 * dsh-session-sync — host half.
 *
 * Responsibilities:
 *   - own the machine's sync identity and the local cache of peer names;
 *   - beacon/observe other devices over UDP (lib/discovery.js);
 *   - serve the LAN sync API on its own port (lib/lan.js);
 *   - expose the GUI's same-origin API under /session-sync/api;
 *   - pull/push sessions through the harness session store (lib/sessions.js).
 *
 * The GUI only ever talks to /session-sync/api on the loopback web server;
 * cross-machine traffic never reaches the GUI port.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Discovery } from './discovery.js'
import { parseTarget, probeTargets } from './probe.js'
import { LanServer } from './lan.js'
import { SessionBridge, SessionSyncError, sessionDigest, sessionSignature } from './sessions.js'
import { StateStore, dshHome } from './state.js'

/** First non-internal IPv4 address — what other machines on the LAN can dial. */
function localAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && entry.internal !== true) return entry.address
    }
  }
  return '127.0.0.1'
}

export const name = 'dsh-session-sync'
export const inject = ['webServer']

const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return '0.0.0'
  }
})()
const REPO_URL = 'https://github.com/XXGxiaoyu/dsh-session-sync'
const LICENSE = 'MIT'
const PEER_TTL_MS = 12_000
/**
 * Explicit targets are also probed over plain HTTP: some networks drop UDP
 * between VLANs entirely, and a `GET /v1/info` still gets through. The interval
 * stays under PEER_TTL_MS so an HTTP-only peer never flickers offline.
 */
const PROBE_INTERVAL_MS = 8_000
const AUTO_PULL_INTERVAL_MS = 20_000
const API_PREFIX = '/session-sync/api'

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampInt(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), min), max)
}

function clampLimit(value, fallback = 200) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), 1), 500)
}

/** `label :: detail` error surfaced to the GUI. */
function apiError(error) {
  if (error instanceof SessionSyncError) return { code: error.code, message: error.message }
  const message = String(error?.message ?? error)
  return { code: 'internal', message }
}

/**
 * @param {object} ctx - host plugin context (webServer required).
 * @param {object} [config] - deployment config from the loader row.
 */
export function apply(ctx, config = {}) {
  const cfg = isPlainObject(config) ? config : {}
  const log = (message) => {
    if (cfg.verbose === false) return
    try {
      console.log(`[dsh-session-sync] ${message}`)
    } catch {
      /* ignore */
    }
  }
  const home = dshHome(cfg)
  const stateDir = path.join(home, 'session-sync')
  try {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 })
  } catch (error) {
    log(`状态目录创建失败: ${error?.message ?? error}`)
  }
  const store = new StateStore({ dir: stateDir })
  const state = store.load()
  const autoPullIntervalMs = clampInt(cfg.autoPullIntervalMs, AUTO_PULL_INTERVAL_MS, 1_000, 600_000)
  if (Array.isArray(cfg.subnets)) {
    const extra = cfg.subnets
      .map((value) => String(value).trim())
      .filter((value) => /^(\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?|\d{1,3}(\.\d{1,3}){3}\/\d{1,2})$/.test(value))
    state.settings.subnets = [...new Set([...(state.settings.subnets ?? []), ...extra])].slice(0, 16)
  }
  if (typeof cfg.name === 'string' && cfg.name.trim().length > 0) state.self.name = cfg.name.trim()
  const rememberSignature = (signature, localId) => {
    if (typeof signature !== 'string' || signature.length === 0) return
    state.signatures[signature] = localId
    const keys = Object.keys(state.signatures)
    for (const stale of keys.slice(0, Math.max(0, keys.length - 500))) delete state.signatures[stale]
    store.saveSoon()
  }

  const bridge = new SessionBridge(ctx, { home, onImported: rememberSignature, onExported: rememberSignature })

  /** Live peer table: id -> last beacon facts. Names live in `state.peers`. */
  const livePeers = new Map()
  let sessionCountCache = { value: null, at: 0 }

  const lanPortWanted = Number.isInteger(cfg.lanPort) ? cfg.lanPort : state.settings.lanPort
  const discoveryPortWanted = Number.isInteger(cfg.discoveryPort) ? cfg.discoveryPort : state.settings.discoveryPort

  // Seeds from the loader row are developer/manual peers ("host:port" of the
  // other instance's UDP discovery port); they are merged into the persisted
  // list so a probe added via config keeps working after a restart.
  if (Array.isArray(cfg.seeds)) {
    const extra = cfg.seeds
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => /^[0-9a-zA-Z._:-]+$/.test(value))
    if (extra.length > 0) state.settings.seeds = [...new Set([...extra, ...state.settings.seeds])].slice(0, 32)
  }
  const token = typeof cfg.token === 'string' && cfg.token.length > 0 ? cfg.token : null

  const lan = new LanServer({
    port: lanPortWanted,
    token,
    bridge,
    log,
    // Remote peers push whole sessions; the signature table is what keeps a
    // round-trip (pull, then push back) from duplicating the conversation.
    duplicateOf: (signature) => state.signatures[signature] ?? null,
    info: () => ({
      id: state.self.id,
      name: state.self.name,
      version: VERSION,
      platform: `${process.platform}-${process.arch}`,
      host: os.hostname(),
      port: lan.port,
      sessions: sessionCountCache.value,
    }),
  })

  let probeAt = 0
  let probeFound = 0

  /** Adopt one device into the live table, whether it came from UDP or HTTP. */
  const absorb = (peer, via) => {
    if (typeof peer.id !== 'string' || peer.id.length === 0) return
    if (peer.id === state.self.id) return
    const previous = livePeers.get(peer.id)
    livePeers.set(peer.id, {
      id: peer.id,
      name: peer.name,
      address: peer.address,
      port: peer.port,
      platform: peer.platform,
      version: peer.version,
      sessions: peer.sessions,
      via,
      lastSeen: Date.now(),
    })
    const record = state.peers[peer.id] ?? (state.peers[peer.id] = {})
    let changed = false
    if (record.remoteName !== peer.name) {
      record.remoteName = peer.name
      changed = true
    }
    if (record.address !== peer.address) {
      record.address = peer.address
      changed = true
    }
    if (record.port !== peer.port) {
      record.port = peer.port
      changed = true
    }
    if (record.platform !== peer.platform) {
      record.platform = peer.platform
      changed = true
    }
    if (record.version !== peer.version) {
      record.version = peer.version
      changed = true
    }
    if (record.sessions !== peer.sessions) {
      record.sessions = peer.sessions
      changed = true
    }
    if (record.firstSeen === undefined) record.firstSeen = Date.now()
    record.lastSeen = Date.now()
    if (previous === undefined) {
      log(`发现设备 ${peer.name || peer.address} (${peer.address}:${peer.port ?? '?'}) via ${via}`)
    }
    if (changed) store.saveSoon()
  }

  const discovery = new Discovery({
    port: discoveryPortWanted,
    log,
    identity: () => ({
      id: state.self.id,
      name: state.self.name,
      port: lan.port,
      host: os.hostname(),
      platform: `${process.platform}-${process.arch}`,
      version: VERSION,
      sessions: sessionCountCache.value,
    }),
    seeds: () => state.settings.seeds ?? [],
    subnets: () => state.settings.subnets ?? [],
    onPeer: (peer) => absorb(peer, 'udp'),
  })

  // ── lifecycle ─────────────────────────────────────────────────────────
  const dispose = []
  const onDispose = (fn) => {
    dispose.push(fn)
  }

  const started = (async () => {
    try {
      await lan.start()
    } catch (error) {
      log(`局域网同步服务启动失败: ${error?.message ?? error}`)
    }
    try {
      await discovery.start()
    } catch (error) {
      log(`发现服务启动失败: ${error?.message ?? error}`)
    }
    log(`已就绪：设备 ${state.self.name}，同步端口 ${lan.port ?? '待定'}，发现端口 ${discovery.boundPort ?? '待定'}`)
  })()
  started.catch(() => {})

  onDispose(() => {
    try {
      discovery.close()
    } catch {
      /* ignore */
    }
    try {
      lan.close()
    } catch {
      /* ignore */
    }
    store.dispose()
  })

  /** Probe every explicit target (bare IPs and `host:port` entries). */
  let probing = false
  const probeNow = async () => {
    if (probing) return
    const targets = [...(state.settings.subnets ?? []), ...(state.settings.seeds ?? [])]
      .map((spec) => parseTarget(spec))
      .filter((target) => target !== null)
    if (targets.length === 0) return
    probing = true
    probeAt = Date.now()
    try {
      const found = await probeTargets(targets, { token, timeoutMs: 600 })
      probeFound = found.length
      for (const hit of found) {
        absorb({
          id: hit.info.id,
          name: typeof hit.info.name === 'string' ? hit.info.name : '',
          address: hit.host,
          port: hit.port,
          platform: typeof hit.info.platform === 'string' ? hit.info.platform : '',
          version: typeof hit.info.version === 'string' ? hit.info.version : '',
          sessions: Number.isInteger(hit.info.sessions) ? hit.info.sessions : null,
        }, 'http')
      }
    } catch (error) {
      log(`HTTP 探测失败: ${error?.message ?? error}`)
    } finally {
      probing = false
    }
  }

  started.then(() => { void probeNow() }).catch(() => {})
  const probeTimer = setInterval(() => { void probeNow() }, PROBE_INTERVAL_MS)
  probeTimer.unref?.()
  onDispose(() => clearInterval(probeTimer))

  const refreshCount = async () => {
    try {
      sessionCountCache = { value: await bridge.count(), at: Date.now() }
    } catch {
      /* the count is decorative */
    }
  }
  void refreshCount()
  const countTimer = setInterval(() => { void refreshCount() }, 30_000)
  countTimer.unref?.()
  onDispose(() => clearInterval(countTimer))

  // ── peer view ─────────────────────────────────────────────────────────
  const peerView = (id, record, now) => {
    const live = livePeers.get(id)
    const lastSeen = live?.lastSeen ?? record?.lastSeen ?? null
    const online = live !== undefined && now - live.lastSeen < PEER_TTL_MS
    const remoteName = (online ? live.name : record?.remoteName) || record?.remoteName || null
    const customName = typeof record?.customName === 'string' && record.customName.trim().length > 0
      ? record.customName.trim()
      : null
    return {
      id,
      customName,
      remoteName,
      name: customName ?? remoteName ?? (online ? live.address : record?.address) ?? '未知设备',
      online,
      lastSeen,
      address: (online ? live.address : record?.address) ?? null,
      port: (online ? live.port : record?.port) ?? null,
      platform: (online ? live.platform : record?.platform) ?? null,
      version: (online ? live.version : record?.version) ?? null,
      sessionCount: (online ? live.sessions : record?.sessions) ?? null,
      autoPull: typeof record?.autoPull === 'boolean' ? record.autoPull : null,
      via: online ? (live.via ?? 'udp') : null,
    }
  }

  const peerList = () => {
    const now = Date.now()
    const ids = new Set([...Object.keys(state.peers), ...livePeers.keys()])
    const rows = []
    for (const id of ids) {
      if (id === state.self.id) continue
      rows.push(peerView(id, state.peers[id], now))
    }
    rows.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      return (b.lastSeen ?? 0) - (a.lastSeen ?? 0)
    })
    return rows
  }

  const importStatus = (peerId, sessionId) => {
    const entry = state.imports[`${peerId}::${sessionId}`]
    return entry === undefined ? null : entry
  }

  // ── remote calls ──────────────────────────────────────────────────────
  const remoteBase = (peer, override) => {
    const address = override?.address ?? peer.address
    const port = override?.port ?? peer.port
    if (typeof address !== 'string' || address.length === 0) {
      throw new SessionSyncError('peer-offline', '该设备当前不在线，也没有记录到地址', 409)
    }
    if (!Number.isInteger(port) || port <= 0) {
      throw new SessionSyncError('peer-offline', '该设备没有公布同步端口', 409)
    }
    const host = address.includes(':') ? `[${address}]` : address
    return `http://${host}:${port}`
  }

  const remoteFetch = async (base, pathname, init = {}) => {
    const headers = {
      'x-dsh-session-sync': '1',
      ...(token === null ? {} : { 'x-dsh-session-sync-token': token }),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(init.headers ?? {}),
    }
    let response
    try {
      response = await fetch(`${base}${pathname}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(init.timeoutMs ?? (init.body === undefined ? 20_000 : 180_000)),
      })
    } catch (error) {
      throw new SessionSyncError('peer-unreachable', `连接设备失败: ${error?.message ?? error}`, 502)
    }
    const text = await response.text()
    let body
    try {
      body = text.length > 0 ? JSON.parse(text) : {}
    } catch {
      throw new SessionSyncError('peer-bad-response', '设备返回了无法解析的数据', 502)
    }
    if (!response.ok || body?.ok === false) {
      throw new SessionSyncError(
        body?.error?.code ?? 'peer-error',
        body?.error?.message ?? `设备返回 ${response.status}`,
        response.status === 401 ? 401 : 502,
      )
    }
    return body
  }

  const findPeer = (peerId) => {
    const view = peerView(peerId, state.peers[peerId], Date.now())
    if (view.address === null) throw new SessionSyncError('unknown-peer', '未知设备', 404)
    return view
  }

  // ── GUI API ───────────────────────────────────────────────────────────
  const api = {
    async state() {
      const peers = peerList()
      const imports = Object.entries(state.imports).map(([key, value]) => {
        const [peerId, sessionId] = key.split('::')
        return { peerId, sessionId, ...value }
      })
      return {
        version: VERSION,
        repo: REPO_URL,
        license: LICENSE,
        probe: { at: probeAt, found: probeFound, targets: (state.settings.subnets ?? []).length + (state.settings.seeds ?? []).length },
        self: { ...state.self, ip: localAddress(), port: lan.port },
        peers,
        imports,
        settings: { ...state.settings },
        ports: { lan: lan.port, discovery: discovery.boundPort },
        hasPersistence: bridge.hasPersistence,
        sessionCount: sessionCountCache.value,
      }
    },

    /** Platform/version facts — rendered by the client's crash panel, never required in normal use. */
    async diag() {
      return {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        version: VERSION,
        ports: { lan: lan.port, discovery: discovery.boundPort },
        route: API_PREFIX,
        probe: { at: probeAt, found: probeFound, targets: (state.settings.subnets ?? []).length + (state.settings.seeds ?? []).length },
        hasPersistence: bridge.hasPersistence,
        sessionCount: sessionCountCache.value,
        selfIp: localAddress(),
      }
    },

    async rename(payload) {
      const peerId = String(payload?.peerId ?? '')
      if (peerId.length === 0) throw new SessionSyncError('bad-request', '缺少设备 id', 400)
      const raw = typeof payload?.name === 'string' ? payload.name.trim() : ''
      const record = state.peers[peerId] ?? (state.peers[peerId] = {})
      if (raw.length === 0) delete record.customName
      else record.customName = raw.slice(0, 60)
      store.saveNow()
      return { peer: peerView(peerId, record, Date.now()) }
    },

    async forget(payload) {
      const peerId = String(payload?.peerId ?? '')
      if (peerId.length === 0) throw new SessionSyncError('bad-request', '缺少设备 id', 400)
      delete state.peers[peerId]
      livePeers.delete(peerId)
      for (const key of Object.keys(state.imports)) {
        if (key.startsWith(`${peerId}::`)) delete state.imports[key]
      }
      store.saveNow()
      return { ok: true }
    },

    async selfName(payload) {
      const raw = typeof payload?.name === 'string' ? payload.name.trim() : ''
      if (raw.length === 0) throw new SessionSyncError('bad-request', '设备名不能为空', 400)
      state.self.name = raw.slice(0, 60)
      store.saveNow()
      discovery.beacon()
      return { self: { ...state.self } }
    },

    async settings(payload) {
      const patch = isPlainObject(payload?.patch) ? payload.patch : {}
      if (patch.locale === 'auto' || patch.locale === 'zh' || patch.locale === 'en') state.settings.locale = patch.locale
      if (typeof patch.autoPull === 'boolean') state.settings.autoPull = patch.autoPull
      if (typeof patch.autoPush === 'boolean') state.settings.autoPush = patch.autoPush
      if (Array.isArray(patch.subnets)) {
        state.settings.subnets = patch.subnets
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .filter((value) => /^(\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?|\d{1,3}(\.\d{1,3}){3}\/\d{1,2})$/.test(value))
          .slice(0, 16)
      }
      if (Array.isArray(patch.seeds)) {
        state.settings.seeds = patch.seeds
          .map((value) => String(value).trim())
          .filter((value) => /^[0-9a-zA-Z._-]+(:\d{1,5})?$/.test(value))
          .slice(0, 32)
      }
      store.saveNow()
      discovery.refresh()
      void probeNow()
      return { settings: { ...state.settings } }
    },

    async peerAutoPull(payload) {
      const peerId = String(payload?.peerId ?? '')
      if (peerId.length === 0) throw new SessionSyncError('bad-request', '缺少设备 id', 400)
      const record = state.peers[peerId] ?? (state.peers[peerId] = {})
      if (payload?.enabled === null || payload?.enabled === undefined) delete record.autoPull
      else record.autoPull = payload.enabled === true
      store.saveNow()
      return { peer: peerView(peerId, record, Date.now()) }
    },

    async peerSessions(payload) {
      const peer = findPeer(String(payload?.peerId ?? ''))
      const base = remoteBase(peer)
      const body = await remoteFetch(base, `/v1/sessions?limit=${clampLimit(payload?.limit)}`)
      const sessions = Array.isArray(body.sessions) ? body.sessions : []
      return {
        peer,
        sessions: sessions.map((session) => ({
          ...session,
          imported: importStatus(peer.id, session.id),
        })),
      }
    },

    async pull(payload) {
      const peer = findPeer(String(payload?.peerId ?? ''))
      const sessionId = String(payload?.sessionId ?? '')
      if (sessionId.length === 0) throw new SessionSyncError('bad-request', '缺少会话 id', 400)
      const existing = importStatus(peer.id, sessionId)
      if (existing !== undefined && existing !== null && payload?.force !== true) {
        return { skipped: true, imported: existing }
      }
      const base = remoteBase(peer)
      const body = await remoteFetch(base, `/v1/sessions/${encodeURIComponent(sessionId)}`)
      const result = await bridge.importSession(
        { session: body.session, events: body.events, sha256: body.sha256 },
        { cwd: payload?.cwd },
      )
      const entry = {
        localId: result.id,
        at: Date.now(),
        title: typeof body.session?.title === 'string' ? body.session.title : null,
        events: result.events,
        sha256: result.sha256,
        verified: result.verified,
      }
      state.imports[`${peer.id}::${sessionId}`] = entry
      store.saveNow()
      void refreshCount()
      log(`已拉取会话 ${sessionId} → ${result.id}${result.verified ? '（sha256 校验通过）' : ''}`)
      return { imported: entry, peer }
    },

    async push(payload) {
      const peer = findPeer(String(payload?.peerId ?? ''))
      const sessionId = String(payload?.sessionId ?? '')
      if (sessionId.length === 0) throw new SessionSyncError('bad-request', '缺少会话 id', 400)
      const exported = await bridge.exportSession(sessionId)
      const base = remoteBase(peer)
      const body = await remoteFetch(base, `/v1/sessions${payload?.force === true ? '?force=1' : ''}`, {
        method: 'POST',
        body: JSON.stringify(exported),
      })
      if (body.skipped === true) {
        log(`推送跳过：${peer.name} 上已有相同会话（远端 ${body.id}）`)
        return { ok: true, skipped: true, remoteId: body.id ?? null, peer }
      }
      log(`已推送会话 ${sessionId} → ${peer.name}（远端 ${body.id}）`)
      return { ok: true, remoteId: body.id ?? null, peer }
    },

    async refresh() {
      discovery.beacon()
      await refreshCount()
      const probes = peerList()
        .filter((peer) => peer.online && peer.address !== null)
        .slice(0, 32)
        .map(async (peer) => {
          try {
            const body = await remoteFetch(remoteBase(peer), '/v1/info', { timeoutMs: 4000 })
            const record = state.peers[peer.id] ?? (state.peers[peer.id] = {})
            record.remoteName = body.name ?? record.remoteName
            record.sessions = Number.isInteger(body.sessions) ? body.sessions : record.sessions
            record.version = body.version ?? record.version
            record.lastSeen = Date.now()
          } catch {
            /* a probe failure just means the device is busy or gone */
          }
        })
      await Promise.all(probes)
      store.saveSoon()
      return { peers: peerList() }
    },

    async localSessions(payload) {
      const sessions = await bridge.list({ limit: clampLimit(payload?.limit) })
      return { sessions }
    },

    async verify(payload) {
      const peer = findPeer(String(payload?.peerId ?? ''))
      const sessionId = String(payload?.sessionId ?? '')
      if (sessionId.length === 0) throw new SessionSyncError('bad-request', '缺少会话 id', 400)
      const body = await remoteFetch(remoteBase(peer), `/v1/sessions/${encodeURIComponent(sessionId)}`)
      const declared = typeof body?.sha256 === 'string' && body.sha256.length > 0
        ? body.sha256.toLowerCase()
        : null
      const actual = sessionDigest(body.session, body.events)
      const local = state.imports[`${peer.id}::${sessionId}`] ?? null
      const localDigest = typeof local?.sha256 === 'string' ? local.sha256 : null
      const result = {
        peer,
        sessionId,
        declared,
        sha256: actual,
        verified: declared === null ? null : declared === actual,
        localMatch: localDigest === null ? null : localDigest === actual,
        events: Array.isArray(body.events) ? body.events.length : 0,
      }
      log(
        result.verified === false
          ? `会话 ${sessionId} 校验失败：期望 ${declared?.slice(0, 12)}…，实际 ${actual.slice(0, 12)}…`
          : `会话 ${sessionId} 校验：sha256 ${actual.slice(0, 12)}…`,
      )
      return result
    },

    async forgetImport(payload) {
      const peerId = String(payload?.peerId ?? '')
      const sessionId = String(payload?.sessionId ?? '')
      if (peerId.length === 0 || sessionId.length === 0) throw new SessionSyncError('bad-request', '参数不完整', 400)
      delete state.imports[`${peerId}::${sessionId}`]
      store.saveNow()
      return { ok: true }
    },
  }

  const handleApi = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://dsh-session-sync.internal')
    if (url.pathname === `${API_PREFIX}/version`) {
      writeJson(res, 200, { ok: true, version: VERSION })
      return
    }
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, error: { code: 'method', message: '只接受 POST' } })
      return
    }
    const connection = ctx.get?.('connection') ?? ctx.connection
    if (typeof connection?.requestRejection === 'function') {
      const rejection = connection.requestRejection(req)
      if (rejection !== undefined) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: '请求被连接策略拒绝' } })
        return
      }
    }
    let payload = {}
    if (req.method === 'POST') {
      try {
        payload = await readBody(req)
      } catch (error) {
        writeJson(res, 400, { ok: false, error: apiError(error) })
        return
      }
    }
    const action = String(payload.action ?? url.searchParams.get('action') ?? '')
    const handler = Object.hasOwn(api, action) ? api[action] : undefined
    if (typeof handler !== 'function') {
      writeJson(res, 404, { ok: false, error: { code: 'unknown-action', message: `未知操作: ${action}` } })
      return
    }
    try {
      const result = await handler(payload)
      writeJson(res, 200, { ok: true, ...result })
    } catch (error) {
      const mapped = error instanceof SessionSyncError
        ? { code: error.code, message: error.message }
        : apiError(error)
      if (!(error instanceof SessionSyncError)) log(`操作 ${action} 失败: ${error?.stack ?? error}`)
      writeJson(res, error instanceof SessionSyncError ? error.status : 500, { ok: false, error: mapped })
    }
  }

  const register = () => ctx.webServer.register({
    kind: 'prefix',
    path: '/session-sync',
    handler: (req, res) => {
      handleApi(req, res).catch((error) => {
        writeJson(res, 500, { ok: false, error: apiError(error) })
      })
    },
  })

  if (typeof ctx.effect === 'function') {
    ctx.effect(register, 'dsh-session-sync: GUI API routes')
    ctx.effect(() => () => {
      for (const fn of dispose) {
        try {
          fn()
        } catch {
          /* ignore */
        }
      }
    }, 'dsh-session-sync: discovery and sync lifecycle')
  } else {
    const disposer = register()
    if (typeof disposer === 'function') onDispose(disposer)
  }

  // ── optional auto-pull ────────────────────────────────────────────────
  const autoTimer = setInterval(() => {
    void autoPull()
  }, autoPullIntervalMs)
  autoTimer.unref?.()
  onDispose(() => clearInterval(autoTimer))

  let autoRunning = false
  async function autoPull() {
    if (autoRunning) return
    if (state.settings.autoPull !== true) return
    autoRunning = true
    try {
      const peers = peerList().filter((peer) => peer.online && peer.address !== null)
      for (const peer of peers) {
        const record = state.peers[peer.id]
        const enabled = typeof record?.autoPull === 'boolean' ? record.autoPull : true
        if (!enabled) continue
        try {
          const base = remoteBase(peer)
          const body = await remoteFetch(base, '/v1/sessions?limit=20', { timeoutMs: 8000 })
          const sessions = Array.isArray(body.sessions) ? body.sessions : []
          let importedThisRound = 0
          for (const session of sessions) {
            if (importedThisRound >= 5) break
            if (importStatus(peer.id, session.id) !== null) continue
            const one = await remoteFetch(base, `/v1/sessions/${encodeURIComponent(session.id)}`)
            // Same conversation, new id: skip it instead of bouncing copies
            // between two devices that both auto-pull.
            const signature = sessionSignature(one.session, one.events)
            if (state.signatures[signature] !== undefined) continue
            const result = await bridge.importSession({
              session: one.session,
              events: one.events,
              sha256: one.sha256,
            })
            state.imports[`${peer.id}::${session.id}`] = {
              localId: result.id,
              at: Date.now(),
              title: typeof one.session?.title === 'string' ? one.session.title : null,
              events: result.events,
            }
            importedThisRound += 1
            log(`自动拉取 ${peer.name} 的会话 ${session.id} → ${result.id}`)
          }
          if (importedThisRound > 0) {
            store.saveNow()
            void refreshCount()
          }
        } catch (error) {
          log(`自动拉取 ${peer.name} 失败: ${error?.message ?? error}`)
        }
      }
    } finally {
      autoRunning = false
    }
  }

  return { state, store, lan, discovery, bridge, ready: started }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 4 * 1024 * 1024) {
        reject(new SessionSyncError('too-large', '请求体过大', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (size === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new SessionSyncError('bad-json', '请求体不是合法 JSON', 400))
      }
    })
    req.on('error', reject)
  })
}

function writeJson(res, status, value) {
  if (res.headersSent) return
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}
