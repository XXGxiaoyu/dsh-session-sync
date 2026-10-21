/**
 * Local state for dsh-session-sync.
 *
 * The state file holds exactly the facts that must survive restarts on THIS
 * machine:
 *   - self:          this device's stable id and display name
 *   - peers:         everything learned about other devices, keyed by device id.
 *                    `customName` lives here only — it never leaves this machine,
 *                    so renaming a peer is private and cached across reboots,
 *                    and survives the peer going offline and coming back.
 *   - imports:       which remote session is stored locally under which id, so
 *                    the UI can show "已拉取" and skip duplicate pulls.
 *   - signatures:    content fingerprints of every session imported here. Two
 *                    devices that each pull the other's copies would otherwise
 *                    keep re-importing the same conversation under new ids.
 *   - settings:      auto-pull switches, discovery port, etc.
 *
 * Everything is written atomically (tmp + rename) with 0600 permissions.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

/** Resolve the harness home directory (`$DSH_HOME` or `~/.dsh`). */
export function dshHome(config) {
  if (typeof config?.home === 'string' && config.home.length > 0) return config.home
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

/** Fresh state for a machine that has never run the plugin. */
export function defaultState() {
  return {
    v: 1,
    self: {
      id: crypto.randomUUID(),
      name: defaultDeviceName(),
    },
    peers: {},
    imports: {},
    signatures: {},
    settings: {
      autoPull: false,
      autoPush: false,
      // UI language: 'auto' follows the DSH locale (which itself falls back to
      // the browser/OS language), 'zh' / 'en' pin the plugin's own copy.
      locale: 'auto',
      discoveryPort: 47801,
      lanPort: 47802,
      seeds: [],
    },
  }
}

function defaultDeviceName() {
  const host = os.hostname().replace(/\.local$/i, '')
  return host || 'DSH 设备'
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Merge persisted state over the defaults so new fields appear on upgrade. */
function normalize(raw) {
  const base = defaultState()
  if (!isPlainObject(raw)) return base
  const self = isPlainObject(raw.self) ? raw.self : {}
  const peers = isPlainObject(raw.peers) ? raw.peers : {}
  const imports = isPlainObject(raw.imports) ? raw.imports : {}
  const signatures = isPlainObject(raw.signatures) ? raw.signatures : {}
  const settings = isPlainObject(raw.settings) ? raw.settings : {}
  return {
    v: 1,
    self: {
      id: typeof self.id === 'string' && self.id.length > 0 ? self.id : base.self.id,
      name: typeof self.name === 'string' && self.name.trim().length > 0 ? self.name.trim() : base.self.name,
    },
    peers: Object.fromEntries(
      Object.entries(peers).filter(([id, rec]) => typeof id === 'string' && isPlainObject(rec)),
    ),
    imports: Object.fromEntries(
      Object.entries(imports).filter(([key, rec]) => typeof key === 'string' && isPlainObject(rec)),
    ),
    signatures: Object.fromEntries(
      Object.entries(signatures).filter(([key, value]) => typeof key === 'string' && typeof value === 'string'),
    ),
    settings: { ...base.settings, ...pickSettings(settings) },
  }
}

function pickSettings(settings) {
  const out = {}
  if (settings.locale === 'auto' || settings.locale === 'zh' || settings.locale === 'en') out.locale = settings.locale
  if (typeof settings.autoPull === 'boolean') out.autoPull = settings.autoPull
  if (typeof settings.autoPush === 'boolean') out.autoPush = settings.autoPush
  if (Number.isInteger(settings.discoveryPort) && settings.discoveryPort > 0 && settings.discoveryPort < 65536) {
    out.discoveryPort = settings.discoveryPort
  }
  if (Number.isInteger(settings.lanPort) && settings.lanPort > 0 && settings.lanPort < 65536) {
    out.lanPort = settings.lanPort
  }
  if (Array.isArray(settings.seeds)) {
    out.seeds = settings.seeds
      .filter((value) => typeof value === 'string' && value.length > 0)
      .slice(0, 32)
  } else {
    out.seeds = []
  }
  return out
}

/**
 * Stores flush on process exit so a rename made less than one debounce window
 * before the app is killed is not lost.
 */
const liveStores = new Set()
process.once('exit', () => {
  for (const store of liveStores) {
    try {
      store.saveNow()
    } catch {
      /* best effort during shutdown */
    }
  }
})

export class StateStore {
  /**
   * @param {{ dir: string }} options - `dir` is the plugin's own state directory.
   */
  constructor({ dir }) {
    this.dir = dir
    this.file = path.join(dir, 'state.json')
    this.data = null
    this.dirty = false
    this._timer = null
    this._lastWrite = 0
    liveStores.add(this)
  }

  /** Drop the exit hook for a disposed plugin instance. */
  dispose() {
    if (this._timer !== null) {
      clearTimeout(this._timer)
      this._timer = null
    }
    liveStores.delete(this)
    this.saveNow()
  }

  load() {
    if (this.data !== null) return this.data
    let raw
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      raw = undefined
    }
    const existed = raw !== undefined
    this.data = normalize(raw)
    if (!existed) this.saveNow()
    return this.data
  }

  /** Mutate in place, then schedule a debounced atomic write. */
  update(fn) {
    const data = this.load()
    fn(data)
    this.saveSoon()
    return data
  }

  saveSoon(delay = 400) {
    this.dirty = true
    if (this._timer !== null) return
    this._timer = setTimeout(() => {
      this._timer = null
      this.saveNow()
    }, delay)
    this._timer.unref?.()
  }

  saveNow() {
    if (this.data === null) return
    const text = `${JSON.stringify(this.data, null, 2)}\n`
    try {
      fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 })
      const tmp = path.join(this.dir, `.state-${process.pid}-${Date.now()}.tmp`)
      fs.writeFileSync(tmp, text, { mode: 0o600 })
      fs.renameSync(tmp, this.file)
      this._lastWrite = Date.now()
      this.dirty = false
    } catch (error) {
      // A failing state write must never take the session bus down; the next
      // successful write retries with the in-memory value intact.
      console.warn('[dsh-session-sync] 状态写入失败:', error?.message ?? error)
    }
  }

  flush() {
    this.saveNow()
  }
}
