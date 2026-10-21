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

export const MAGIC = 'dsh-session-sync/hello'
export const PROTOCOL_VERSION = 1

const BEACON_INTERVAL_MS = 4000

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

export class Discovery {
  /**
   * @param {object} options
   * @param {number} options.port - UDP port shared by every device.
   * @param {() => object} options.identity - current beacon payload fields.
   * @param {(peer: object, rinfo: {address: string, port: number}) => void} options.onPeer
   * @param {() => string[]} [options.seeds] - extra `host:port` targets.
   * @param {(message: string) => void} [options.log]
   */
  constructor({ port, identity, onPeer, seeds, log }) {
    this.port = port
    this.identity = identity
    this.onPeer = onPeer
    this.seeds = seeds ?? (() => [])
    this.log = log ?? (() => {})
    this.socket = null
    this.timer = null
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

  close() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
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
