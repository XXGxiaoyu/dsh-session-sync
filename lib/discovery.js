/**
 * LAN discovery over UDP broadcast.
 *
 * Every instance beacons `{t:'dsh-session-sync/hello', ...}` to the broadcast
 * address of each IPv4 interface plus 127.0.0.1 (so two instances on one host
 * find each other during development). A receiver that has not seen an id
 * before answers immediately with a unicast hello, which makes discovery feel
 * instant instead of "within one beacon interval".
 *
 * The beacon carries only identity and a session count; session lists are
 * fetched over the HTTP sync port named in the beacon.
 */
import dgram from 'node:dgram'
import os from 'node:os'
import { parseTarget } from './probe.js'

export const MAGIC = 'dsh-session-sync/hello'
export const PROTOCOL_VERSION = 1

const BEACON_INTERVAL_MS = 4000
/** How often the cross-subnet sweep rebuilds its host list and starts over. */
const SWEEP_INTERVAL_MS = 60_000
/** Pacing: 10 unicast hellos every 150 ms keeps the sweep invisible on the wire. */
const SWEEP_BATCH = 10
const SWEEP_TICK_MS = 150
/** Hard cap on expansion so a `/8` cannot turn into 16M packets. */
const SWEEP_MAX_HOSTS = 4096

function ipToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8 >>> 0) + (Number(part) & 0xff), 0) >>> 0
}

function intToIp(int) {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 0xff).join('.')
}

/** Broadcast targets for the interfaces that exist right now. */
export function broadcastTargets() {
  const out = new Set(['127.0.0.1'])
  let interfaces = {}
  try {
    interfaces = os.networkInterfaces()
  } catch {
    /* ignore */
  }
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      try {
        const ip = ipToInt(entry.address)
        const mask = ipToInt(entry.netmask)
        out.add(intToIp(((ip & mask) | (~mask >>> 0)) >>> 0))
      } catch {
        /* ignore malformed interface entry */
      }
      out.add('255.255.255.255')
    }
  }
  return [...out]
}

/** Local /24s: broadcast is fine inside one segment, but some switches drop it. */
function localNets() {
  const out = new Set()
  let interfaces = {}
  try {
    interfaces = os.networkInterfaces()
  } catch {
    return []
  }
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      const parts = entry.address.split('.')
      if (parts.length === 4) out.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
    }
  }
  return [...out]
}

/** Expand one CIDR / bare IP into the host addresses it covers. */
export function expandTarget(spec) {
  const trimmed = String(spec ?? '').trim()
  if (trimmed.length === 0) return []
  const [address, rawPrefix] = trimmed.split('/')
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return []
  const prefix = rawPrefix === undefined ? 32 : Number(rawPrefix)
  if (!Number.isInteger(prefix) || prefix < 16 || prefix > 32) return []
  const base = ipToInt(address)
  const size = 2 ** (32 - prefix)
  const first = prefix >= 31 ? base : base + 1
  const last = prefix >= 31 ? base + size - 1 : base + size - 2
  const out = []
  for (let value = first; value <= last && out.length < SWEEP_MAX_HOSTS; value += 1) out.push(intToIp(value))
  return out
}

export class Discovery {
  /**
   * @param {object} options
   * @param {number} options.port - UDP port shared by every device.
   * @param {() => object} options.identity - current beacon payload fields.
   * @param {(peer: object, rinfo: {address: string, port: number}) => void} options.onPeer
   * @param {() => string[]} [options.seeds] - extra `host:port` targets.
   * @param {() => string[]} [options.subnets] - CIDRs / IPs to unicast-sweep.
   * @param {(message: string) => void} [options.log]
   */
  constructor({ port, identity, onPeer, seeds, subnets, log }) {
    this.port = port
    this.identity = identity
    this.onPeer = onPeer
    this.seeds = seeds ?? (() => [])
    this.subnets = subnets ?? (() => [])
    this.log = log ?? (() => {})
    this.socket = null
    this.timer = null
    this.sweepTimer = null
    this.sweepRefresh = null
    this._sweep = []
    this.boundPort = null
    this._seen = new Map()
  }

  async start() {
    if (this.socket !== null) return
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket
    socket.on('error', (error) => {
      this.log(`发现服务 UDP 错误: ${error?.message ?? error}`)
      if (this.boundPort === null) {
        // Port taken by an instance that does not share it: retry on an
        // ephemeral port. Peers still answer to the source port of our beacons.
        try {
          socket.close()
        } catch {
          /* ignore */
        }
        this.socket = null
        this._listen(0).catch((retry) => this.log(`发现服务启动失败: ${retry?.message ?? retry}`))
      }
    })
    socket.on('message', (buffer, rinfo) => this._onMessage(buffer, rinfo))
    await this._listen(this.port)
    this.timer = setInterval(() => this.beacon(), BEACON_INTERVAL_MS)
    this.timer.unref?.()
    this.beacon()
    this.startSweep()
  }

  _listen(port) {
    return new Promise((resolve, reject) => {
      const socket = this.socket
      if (socket === null) {
        reject(new Error('socket closed'))
        return
      }
      const onListening = () => {
        socket.off('error', onError)
        try {
          socket.setBroadcast(true)
          socket.setMulticastTTL?.(1)
        } catch {
          /* optional socket tuning */
        }
        this.boundPort = socket.address().port
        this.log(`发现服务已监听 UDP ${this.boundPort}`)
        resolve()
      }
      const onError = (error) => {
        socket.off('listening', onListening)
        try {
          socket.close()
        } catch {
          /* ignore */
        }
        this.socket = null
        reject(error)
      }
      socket.once('listening', onListening)
      socket.once('error', onError)
      socket.bind(port, '0.0.0.0')
    })
  }

  beacon() {
    const socket = this.socket
    if (socket === null || this.boundPort === null) return
    const payload = Buffer.from(JSON.stringify({
      t: MAGIC,
      proto: PROTOCOL_VERSION,
      ...this.identity(),
      at: Date.now(),
    }))
    const targets = new Set(broadcastTargets())
    for (const seed of this.seeds()) {
      const host = String(seed).split(':')[0]
      if (host.length > 0) targets.add(host)
    }
    for (const target of targets) {
      socket.send(payload, 0, payload.length, this.port, target, (error) => {
        if (error !== undefined && error !== null && target !== '127.0.0.1') {
          // Interfaces come and go; a failed broadcast is routine.
        }
      })
    }
    for (const seed of this.seeds()) {
      const [host, rawPort] = String(seed).split(':')
      const port = Number(rawPort)
      if (host && Number.isInteger(port) && port > 0) {
        socket.send(payload, 0, payload.length, port, host, () => {})
      }
    }
  }

  /**
   * Silent cross-subnet scan: a hello is a normal discovery packet, so a peer
   * that receives one answers with its own identity and shows up in the list
   * exactly like a broadcast peer. No port scanning, no HTTP probe.
   */
  startSweep() {
    if (this.sweepTimer !== null) return
    const refill = () => {
      const targets = new Map()
      for (const spec of [...localNets(), ...this.subnets()]) {
        const parsed = parseTarget(spec)
        // `10.0.0.7:47901` is allowed so a peer whose UDP port moved is still
        // reachable; a bare CIDR/IP sweeps the shared discovery port.
        const hosts = parsed !== null && parsed.port !== null ? [parsed.host] : expandTarget(spec)
        for (const host of hosts) {
          if (!targets.has(host)) targets.set(host, parsed?.port ?? this.port)
        }
      }
      this._sweep = [...targets.entries()].map(([host, port]) => ({ host, port }))
      this._sweepIndex = 0
    }
    refill()
    this.sweepRefresh = setInterval(refill, SWEEP_INTERVAL_MS)
    this.sweepRefresh.unref?.()
    this.sweepTimer = setInterval(() => this._sendSweepBatch(), SWEEP_TICK_MS)
    this.sweepTimer.unref?.()
  }

  _sendSweepBatch() {
    const socket = this.socket
    if (socket === null || this.boundPort === null) return
    if (!Array.isArray(this._sweep) || this._sweep.length === 0) return
    const identity = this.identity()
    const payload = Buffer.from(JSON.stringify({
      t: MAGIC,
      proto: PROTOCOL_VERSION,
      ...identity,
      at: Date.now(),
    }))
    const selfHost = typeof identity.host === 'string' ? identity.host : null
    let sent = 0
    while (sent < SWEEP_BATCH && this._sweepIndex < this._sweep.length) {
      const entry = this._sweep[this._sweepIndex]
      this._sweepIndex += 1
      const host = entry.host
      if (host === selfHost || host === '0.0.0.0' || host.endsWith('.255')) continue
      socket.send(payload, 0, payload.length, entry.port, host, () => {})
      sent += 1
    }
    // Wrap around so a short list keeps getting poked between refills.
    if (this._sweepIndex >= this._sweep.length) this._sweepIndex = 0
  }

  _onMessage(buffer, rinfo) {
    let message
    try {
      message = JSON.parse(buffer.toString('utf8'))
    } catch {
      return
    }
    if (message?.t !== MAGIC || message?.proto !== PROTOCOL_VERSION) return
    if (typeof message.id !== 'string' || message.id.length === 0) return
    const self = this.identity()
    if (message.id === self.id) return
    const peer = {
      id: message.id,
      name: typeof message.name === 'string' ? message.name : '',
      host: typeof message.host === 'string' ? message.host : rinfo.address,
      port: Number.isInteger(message.port) ? message.port : null,
      platform: typeof message.platform === 'string' ? message.platform : '',
      version: typeof message.version === 'string' ? message.version : '',
      sessions: Number.isInteger(message.sessions) ? message.sessions : null,
      at: typeof message.at === 'number' ? message.at : Date.now(),
      address: rinfo.address,
    }
    const known = this._seen.has(peer.id)
    this._seen.set(peer.id, Date.now())
    this.onPeer(peer, rinfo)
    if (!known) {
      const socket = this.socket
      if (socket !== null && this.boundPort !== null) {
        const reply = Buffer.from(JSON.stringify({
          t: MAGIC,
          proto: PROTOCOL_VERSION,
          ...self,
          at: Date.now(),
        }))
        socket.send(reply, 0, reply.length, rinfo.port, rinfo.address, () => {})
      }
    }
  }

  /** Rebuild the sweep list right now (used after the settings change). */
  refresh() {
    if (this.sweepTimer === null) {
      this.startSweep()
      return
    }
    const targets = new Map()
    for (const spec of [...localNets(), ...this.subnets()]) {
      const parsed = parseTarget(spec)
      const hosts = parsed !== null && parsed.port !== null ? [parsed.host] : expandTarget(spec)
      for (const host of hosts) {
        if (!targets.has(host)) targets.set(host, parsed?.port ?? this.port)
      }
    }
    this._sweep = [...targets.entries()].map(([host, port]) => ({ host, port }))
    this._sweepIndex = 0
  }

  close() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.sweepTimer !== null) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
    if (this.sweepRefresh !== null) {
      clearInterval(this.sweepRefresh)
      this.sweepRefresh = null
    }
    this._sweep = []
    const socket = this.socket
    this.socket = null
    this.boundPort = null
    if (socket !== null) {
      try {
        socket.close()
      } catch {
        /* ignore */
      }
    }
  }
}
