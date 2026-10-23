/**
 * The LAN-facing HTTP sync endpoint.
 *
 * This is deliberately a separate listener from the GUI web server: the GUI
 * binds one loopback literal (the app keeps it off the network), while syncing
 * must be reachable from other machines. It therefore binds 0.0.0.0 on its own
 * port and only answers requests that present the sync header (and the shared
 * token when one is configured).
 *
 *   GET  /v1/health            liveness probe
 *   GET  /v1/info              identity + session count
 *   GET  /v1/sessions          session index (metadata only)
 *   GET  /v1/sessions/:id      one session: header + replay-validated events
 *   POST /v1/sessions          import a session from another device
 */
import http from 'node:http'
import { SessionSyncError, sessionSignature } from './sessions.js'

const MAX_BODY_BYTES = 256 * 1024 * 1024
const SYNC_HEADER = 'x-dsh-session-sync'

function sendJson(res, status, value) {
  if (res.headersSent) return
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new SessionSyncError('too-large', '会话数据超过 256MB 上限', 413))
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
    req.on('error', (error) => reject(error))
  })
}

export class LanServer {
  /**
   * @param {object} options
   * @param {number} options.port - preferred port; next free ports are tried.
   * @param {string} [options.token] - optional shared secret.
   * @param {import('./sessions.js').SessionBridge} options.bridge
   * @param {() => object} options.info - identity fields for /v1/info.
   * @param {(message: string) => void} [options.log]
   */
  constructor({ port, token, bridge, info, duplicateOf, importOptions, placeImported, log }) {
    this.preferredPort = port
    this.port = null
    this.token = token ?? null
    this.bridge = bridge
    this.info = info
    this.duplicateOf = duplicateOf
    this.importOptions = importOptions
    this.placeImported = placeImported
    this.log = log ?? (() => {})
    this.server = null
  }

  async start() {
    if (this.server !== null) return this.port
    const server = http.createServer((req, res) => {
      this._handle(req, res).catch((error) => {
        const status = error instanceof SessionSyncError ? error.status : 500
        const code = error instanceof SessionSyncError ? error.code : 'internal'
        if (!(error instanceof SessionSyncError)) {
          this.log(`同步请求失败: ${error?.stack ?? error}`)
        }
        sendJson(res, status, { ok: false, error: { code, message: String(error?.message ?? error) } })
      })
    })
    server.on('clientError', (_error, socket) => {
      try {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      } catch {
        /* ignore */
      }
    })
    this.server = server
    const base = Number.isInteger(this.preferredPort) && this.preferredPort >= 0 ? this.preferredPort : 47802
    if (base === 0) {
      // Explicit ephemeral port (tests, or a NAT'd host that forwards).
      await listen(server, 0)
      this.port = server.address().port
      this.log(`局域网同步服务已监听 0.0.0.0:${this.port}`)
      return this.port
    }
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = base + attempt
      if (candidate > 65535) break
      try {
        await listen(server, candidate)
        this.port = candidate
        this.log(`局域网同步服务已监听 0.0.0.0:${candidate}`)
        return candidate
      } catch (error) {
        if (error?.code !== 'EADDRINUSE') throw error
      }
    }
    throw new Error(`端口 ${base} 起连续 16 个端口都被占用，无法启动局域网同步服务`)
  }

  async _handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://dsh-session-sync.internal')
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': `${SYNC_HEADER}, content-type, x-dsh-session-sync-token`,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      })
      res.end()
      return
    }
    if (url.pathname === '/v1/health') {
      sendJson(res, 200, { ok: true, service: 'dsh-session-sync', proto: 1 })
      return
    }
    if (req.headers[SYNC_HEADER] === undefined) {
      throw new SessionSyncError('unauthorized', '缺少同步请求头', 401)
    }
    if (this.token !== null && req.headers['x-dsh-session-sync-token'] !== this.token) {
      throw new SessionSyncError('unauthorized', '同步口令不匹配', 401)
    }
    if (url.pathname === '/v1/info') {
      sendJson(res, 200, { ok: true, ...this.info() })
      return
    }
    if (url.pathname === '/v1/sessions' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? '200')
      const sessions = await this.bridge.list({ limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200 })
      sendJson(res, 200, { ok: true, sessions })
      return
    }
    if (url.pathname.startsWith('/v1/sessions/') && req.method === 'GET') {
      const id = decodeURIComponent(url.pathname.slice('/v1/sessions/'.length))
      if (id.length === 0 || id.includes('/')) throw new SessionSyncError('bad-id', '会话 id 无效', 400)
      const payload = await this.bridge.exportSession(id)
      sendJson(res, 200, { ok: true, ...payload })
      return
    }
    if (url.pathname === '/v1/sessions' && req.method === 'POST') {
      const body = await readJsonBody(req)
      // Dedupe before writing: the same conversation pushed twice (or pushed
      // back after being pulled) must not become a second local copy. Callers
      // that really want a copy ask for it explicitly with `?force=1`.
      const force = url.searchParams.get('force') === '1'
      if (!force && Array.isArray(body?.events)) {
        const signature = sessionSignature(body.session, body.events)
        const duplicate = this.duplicateOf?.(signature) ?? null
        if (duplicate !== null && duplicate !== undefined) {
          sendJson(res, 200, { ok: true, skipped: true, id: duplicate, signature })
          return
        }
      }
      const imported = await this.bridge.importSession(body, this.importOptions?.(body) ?? {})
      const placed = await this.placeImported?.(imported.id, body)
      this.log(`已接收来自 ${req.socket.remoteAddress} 的会话 → ${imported.id}${placed === true ? '（已放入工作区）' : ''}`)
      sendJson(res, 200, { ok: true, ...imported, placed: placed === true })
      return
    }
    throw new SessionSyncError('not-found', `未知接口: ${req.method} ${url.pathname}`, 404)
  }

  close() {
    const server = this.server
    this.server = null
    this.port = null
    if (server !== null) {
      try {
        server.close()
        server.closeAllConnections?.()
      } catch {
        /* ignore */
      }
    }
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '0.0.0.0')
  })
}
