/**
 * Session-store bridge.
 *
 * Two ways to reach the local session store:
 *   1. through the harness services (`ctx.sessionQuery`, `ctx.sessionPersistence`)
 *      which is what the GUI itself uses — preferred, because an imported
 *      session then shows up exactly like a locally created one;
 *   2. straight from `$DSH_HOME/sessions` when the services are unavailable
 *      (standalone harness, older build). Reading still works; importing needs
 *      the persistence service, so that path reports a clear error.
 *
 * Wire format for one session (`exportSession`):
 *   { format: 'dsh-session-sync/1', session: <header>, events: [<...>] }
 * `events` is the replay-validated raw log exactly as `readSession` returns it.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { zstdDecompressSync } from 'node:zlib'
import { dshHome } from './state.js'

export const WIRE_FORMAT = 'dsh-session-sync/1'

export class SessionSyncError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'SessionSyncError'
    this.code = code
    this.status = status
  }
}


/**
 * Drop the inherited prefix a forked/summarised source carries.
 *
 * A seeded session's log ends its inherited block with
 * `{ type: 'session/end-seed', data: { inherited: true } }`. Copying those events
 * into a fresh, unseeded log makes DSH reject the copy with
 * "released v2 unseeded Session contains an inherited end-seed marker", so an
 * import keeps only the events the source session authored itself.
 *
 * @param {object[]} events - source event list, in seq order.
 * @returns {object[]} the source's own events (possibly the same array).
 */
export function stripInheritedPrefix(events) {
  let cut = -1
  for (const [index, event] of events.entries()) {
    if (event?.type === 'session/end-seed' && isPlainObject(event.data) && event.data.inherited === true) cut = index
  }
  if (cut < 0) return events
  return events.slice(cut + 1).filter(
    (event) => !(event?.type === 'session/end-seed' && isPlainObject(event.data) && event.data.inherited === true),
  )
}

/**
 * Pick the working directory an imported session should claim: an explicit
 * override, then the source directory when it also exists on this machine, then
 * the current process directory. A v4 header needs an absolute path that the
 * local UI can reopen.
 */
function importCwd(source, options) {
  if (typeof options.cwd === 'string' && path.isAbsolute(options.cwd)) return options.cwd
  if (typeof source.cwd === 'string' && path.isAbsolute(source.cwd) && fs.existsSync(source.cwd)) return source.cwd
  return process.cwd()
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Map session id -> {file, dir, mtime, size} for every stored session. */
function scanStore(storeRoot) {
  const index = new Map()
  let slugs
  try {
    slugs = fs.readdirSync(storeRoot, { withFileTypes: true })
  } catch {
    return index
  }
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue
    const slugDir = path.join(storeRoot, slug.name)
    let sessions
    try {
      sessions = fs.readdirSync(slugDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of sessions) {
      if (!entry.isDirectory()) continue
      const dir = path.join(slugDir, entry.name)
      let files
      try {
        files = fs.readdirSync(dir)
      } catch {
        continue
      }
      const file = files.find((name) => name.endsWith('.jsonl.zstd'))
      if (file === undefined) continue
      const full = path.join(dir, file)
      let stat
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }
      index.set(entry.name, { file: full, dir, mtime: stat.mtimeMs, size: stat.size, slug: slug.name })
    }
  }
  return index
}

/** Read the header line (first zstd frame) without decompressing the whole log. */
function readHeader(file) {
  let fd
  try {
    fd = fs.openSync(file, 'r')
    const chunk = Buffer.allocUnsafe(Math.min(256 * 1024, Math.max(4096, fs.fstatSync(fd).size)))
    const read = fs.readSync(fd, chunk, 0, chunk.length, 0)
    const text = zstdDecompressSync(chunk.subarray(0, read)).toString('utf8')
    const line = text.split('\n', 1)[0]
    const header = JSON.parse(line)
    return isPlainObject(header) ? header : undefined
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        /* ignore */
      }
    }
  }
}

/** Titles recorded in the projection cache, which is cheap and always current. */
function cachedTitles(storeRoot) {
  const out = new Map()
  const dir = path.join(path.dirname(storeRoot), 'storages', 'session_projcache', 'sessions')
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
      const title = doc?.record?.rows?.title?.val
      if (typeof title === 'string' && title.trim().length > 0) out.set(name.slice(0, -'.json'.length), title.trim())
    } catch {
      /* a broken cache file only costs us a title */
    }
  }
  return out
}

function titleFromEvents(events) {
  for (const event of events) {
    if (event?.type !== 'message' || !isPlainObject(event.data)) continue
    const role = event.data.role
    if (role !== 'user') continue
    const content = event.data.content
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '')).join(' ')
        : ''
    const flat = text.replace(/\s+/g, ' ').trim()
    if (flat.length > 0) return flat.slice(0, 80)
  }
  return undefined
}

function sourceCreatedAt(source) {
  const value = source?.createdAt
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : Date.now()
}

/**
 * Content fingerprint of a session, stable across the id rewrite every import
 * performs.
 *
 * Two devices with auto-pull enabled would otherwise bounce the same
 * conversation back and forth: A pushes to B, B's auto-pull imports it under a
 * fresh id, A's auto-pull imports that copy under another fresh id, forever.
 * Fingerprinting the payload lets the importer notice "I already have this
 * conversation" without trusting ids.
 *
 * @param {object} session - wire session header.
 * @param {object[]} events - wire events.
 * @returns {string} short hex digest.
 */
export function sessionSignature(session, events) {
  const list = Array.isArray(events) ? events : []
  const first = list[0]
  const last = list[list.length - 1]
  const shape = [
    typeof session?.createdAt === 'number' ? session.createdAt : null,
    typeof session?.agentPreset === 'string' ? session.agentPreset : null,
    list.length,
    typeof first?.seq === 'number' ? first.seq : 0,
    typeof first?.time === 'number' ? first.time : null,
    typeof first?.type === 'string' ? first.type : null,
    preview(first),
    typeof last?.time === 'number' ? last.time : null,
    typeof last?.type === 'string' ? last.type : null,
  ]
  return crypto.createHash('sha1').update(JSON.stringify(shape)).digest('hex').slice(0, 20)
}

function preview(event) {
  const data = event?.data
  if (typeof data === 'string') return data.slice(0, 160)
  if (isPlainObject(data)) {
    const content = data.content ?? data.text ?? data.message ?? null
    if (typeof content === 'string') return content.slice(0, 160)
    if (Array.isArray(content)) {
      const text = content
        .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
        .join('')
      return text.slice(0, 160)
    }
  }
  return null
}

/**
 * SHA-256 of one wire payload, so the receiver can prove it got the bytes the
 * sender meant to send. Hashed over exactly what travels on the wire
 * (`{format, session, events}`); `JSON.stringify` of a parsed object keeps the
 * sender's key order, so both sides hash the same string.
 *
 * @param {object} session - wire session header.
 * @param {object[]} events - wire events.
 * @returns {string} 64-char lowercase hex digest.
 */
export function sessionDigest(session, events) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ format: WIRE_FORMAT, session, events }))
    .digest('hex')
}

function checksumMatches(payload) {
  const expected = typeof payload?.sha256 === 'string' ? payload.sha256.toLowerCase() : null
  if (expected === null || expected.length === 0) return { verified: false, digest: null, ok: true }
  const actual = sessionDigest(payload.session, payload.events)
  return { verified: true, digest: actual, ok: actual === expected }
}

export class SessionBridge {
  /**
   * @param {object} ctx - host plugin context.
   * @param {{ home?: string, onImported?: (signature: string, localId: string) => void, onExported?: (signature: string, localId: string) => void }} [options]
   */
  constructor(ctx, options = {}) {
    const home = dshHome(options)
    this.ctx = ctx
    this.onImported = typeof options.onImported === 'function' ? options.onImported : null
    this.onExported = typeof options.onExported === 'function' ? options.onExported : null
    this.home = home
    this.storeRoot = path.join(home, 'sessions')
    this._titleCache = new Map()
    this._titleCacheAt = 0
  }

  get query() {
    const service = this.ctx?.get?.('sessionQuery') ?? this.ctx?.sessionQuery
    return service
  }

  get persistence() {
    const service = this.ctx?.get?.('sessionPersistence') ?? this.ctx?.sessionPersistence
    return service
  }

  get hasPersistence() {
    return this.persistence !== undefined && this.persistence !== null
  }

  /** Number of stored sessions, without reading any log or title. */
  async count() {
    const persistence = this.persistence
    if (persistence !== undefined && persistence !== null) {
      try {
        const all = await persistence.list()
        return Array.isArray(all) ? all.length : 0
      } catch {
        /* fall through to the directory scan */
      }
    }
    return scanStore(this.storeRoot).size
  }

  /** Header + event log for one session, replay-validated when services exist. */
  async read(id) {
    const query = this.query
    if (query !== undefined && query !== null) {
      const snapshot = await query.readSession(id)
      return {
        session: snapshot.session ?? snapshot.header,
        events: snapshot.events ?? [],
        inheritedEventCount: snapshot.inheritedEventCount ?? 0,
      }
    }
    const scanned = scanStore(this.storeRoot).get(id)
    if (scanned === undefined) throw new SessionSyncError('session-not-found', `会话不存在: ${id}`, 404)
    const header = readHeader(scanned.file)
    if (header === undefined) throw new SessionSyncError('session-unreadable', `无法解析会话头: ${id}`, 500)
    return { session: header, events: [], inheritedEventCount: 0 }
  }

  /**
   * List sessions newest-first with the metadata the UI needs.
   * @param {{ limit?: number }} [options]
   */
  async list(options = {}) {
    const limit = options.limit ?? 200
    const query = this.query
    if (query !== undefined && query !== null) {
      const records = await query.listSessions()
      const sliced = records.slice(0, limit)
      const ids = sliced.map((record) => record.header.id)
      const titles = await this._titles(ids)
      const scanned = scanStore(this.storeRoot)
      return sliced.map((record) => {
        const header = record.header
        const disk = scanned.get(header.id)
        return {
          id: header.id,
          title: titles.get(header.id) ?? null,
          cwd: header.cwd ?? null,
          createdAt: header.createdAt ?? null,
          updatedAt: disk?.mtime ?? null,
          sizeBytes: disk?.size ?? null,
          live: record.live === true,
          persisted: record.persisted === true,
          parentSession: header.parentSession ?? null,
        }
      })
    }
    return this._fallbackList(limit)
  }

  async _fallbackList(limit) {
    const scanned = scanStore(this.storeRoot)
    const titles = cachedTitles(this.storeRoot)
    const rows = []
    for (const [id, disk] of scanned) {
      const header = readHeader(disk.file)
      rows.push({
        id,
        title: titles.get(id) ?? null,
        cwd: header?.cwd ?? null,
        createdAt: header?.createdAt ?? null,
        updatedAt: disk.mtime,
        sizeBytes: disk.size,
        live: false,
        persisted: true,
        parentSession: header?.parentSession ?? null,
      })
    }
    rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    return rows.slice(0, limit)
  }

  async _titles(ids) {
    const now = Date.now()
    const cache = this._titleCache
    if (now - this._titleCacheAt > 60_000) {
      cache.clear()
      this._titleCacheAt = now
    }
    // Most sessions never write a `session/title` event; DSH keeps their names
    // in its projection cache. Fold that in so the list stops looking untitled.
    const projected = cachedTitles(this.storeRoot)
    const fallback = (id) => projected.get(id) ?? null
    const missing = ids.filter((id) => !cache.has(id))
    const query = this.query
    if (query !== undefined && query !== null && missing.length > 0) {
      try {
        for (let offset = 0; offset < missing.length; offset += 100) {
          const batch = missing.slice(offset, offset + 100)
          const snapshots = await query.readTitleSnapshots(batch)
          for (const result of snapshots) {
            // readTitleSnapshots returns settled results, not bare snapshots:
            // {status:'fulfilled', value:{session,title}} | {status:'rejected'}.
            const value = result !== null && typeof result === 'object' && 'status' in result
              ? (result.status === 'fulfilled' ? result.value : null)
              : result
            const id = value?.session?.id
            if (typeof id !== 'string') continue
            const title = value?.title
            cache.set(id, typeof title === 'string' && title.trim().length > 0 ? title.trim() : fallback(id))
          }
          for (const id of batch) if (!cache.has(id)) cache.set(id, fallback(id))
        }
      } catch {
        for (const id of missing) if (!cache.has(id)) cache.set(id, fallback(id))
      }
    }
    return new Map(ids.map((id) => [id, cache.get(id) ?? fallback(id)]))
  }

  /** Latest title for one session, or null when the log never named it. */
  async titleOf(id) {
    const titles = await this._titles([id])
    return titles.get(id) ?? null
  }

  /** Export one session in the wire format used between devices. */
  async exportSession(id) {
    const snapshot = await this.read(id)
    const header = snapshot.session
    if (!isPlainObject(header)) throw new SessionSyncError('session-unreadable', `会话头无效: ${id}`, 500)
    // Exporting is the moment this conversation leaves the machine: fingerprint
    // it so a copy coming back later is recognised as "already mine".
    this.onExported?.(sessionSignature(header, snapshot.events), id)
    return {
      format: WIRE_FORMAT,
      session: header,
      events: snapshot.events,
      sha256: sessionDigest(header, snapshot.events),
    }
  }

  /**
   * Store a session received from another device as a normal local session.
   *
   * A new id is minted so two devices can each keep their own copy without
   * fighting over the same log; parent links are dropped because the parent
   * may not exist here.
   *
   * @param {{ session: object, events: object[] }} payload - wire payload.
   * @param {{ cwd?: string }} [options]
   * @returns {Promise<{ id: string, events: number }>}
   */
  async importSession(payload, options = {}) {
    if (!isPlainObject(payload?.session)) throw new SessionSyncError('bad-payload', '缺少会话头', 400)
    if (!Array.isArray(payload?.events)) throw new SessionSyncError('bad-payload', '缺少事件列表', 400)
    const persistence = this.persistence
    if (persistence === undefined || persistence === null) {
      throw new SessionSyncError('no-persistence', '当前运行环境没有会话存储服务，无法导入', 501)
    }
    const checksum = checksumMatches(payload)
    if (!checksum.ok) {
      throw new SessionSyncError(
        'checksum-mismatch',
        `会话校验失败：sha256 不匹配（期望 ${String(payload.sha256).slice(0, 12)}…，实际 ${checksum.digest.slice(0, 12)}…）`,
        409,
      )
    }
    const source = payload.session
    const id = `session-${crypto.randomUUID()}`
    // The v4 header accepts exactly these keys — `type` is storage-owned
    // framing that dsh-session-persistence-jsonl writes for us, and one stray
    // key makes the whole import fail with "unexpected field".
    const header = {
      version: 4,
      id,
      // Keep the source creation time: it is what makes a copied session
      // recognisable, and it keeps the timeline honest in the local list.
      createdAt: sourceCreatedAt(source),
      cwd: importCwd(source, options),
      isSeeded: false,
      delegationDepth: 0,
      agentPreset: typeof source.agentPreset === 'string' && source.agentPreset.length > 0
        ? source.agentPreset
        : 'standard',
    }
    // An imported copy is always unseeded; keep only what the source authored
    // itself, otherwise the inherited end-seed marker makes the log unreadable.
    const own = stripInheritedPrefix(payload.events.filter((event) => isPlainObject(event)))
    const events = own.map((event, index) => ({ ...event, seq: index }))
    const handle = await persistence.create(header)
    let closed = false
    try {
      if (events.length > 0) await handle.append(events)
      await handle.flush()
    } finally {
      if (!closed) {
        closed = true
        await handle.close().catch(() => undefined)
      }
    }
    const signature = sessionSignature(source, payload.events)
    this.onImported?.(signature, id)
    return {
      id,
      events: events.length,
      signature,
      sha256: checksum.digest ?? sessionDigest(source, payload.events),
      verified: checksum.verified,
    }
  }
}
