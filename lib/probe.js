/**
 * Quiet HTTP fallback for networks where UDP broadcast (and even unicast UDP)
 * cannot cross a router or a firewall.
 *
 * Only *explicit* targets are probed — a bare IP from the "cross-subnet" box or
 * a `host:port` from the manual list — never a whole CIDR: 254 hosts times a
 * port range would be a port scan, not a discovery handshake.
 *
 * The probe is a normal `GET /v1/info` against the same API every peer already
 * exposes on the LAN; the reply carries the device id, so the rest of the
 * plugin can treat an HTTP-discovered device exactly like a broadcast one.
 */

/** Sync port the plugin starts on, plus the ports it falls back to (16 tries). */
export const SYNC_PORT_BASE = 47802
export const SYNC_PORT_TRIES = 16

export const DEFAULT_SYNC_PORTS = Array.from({ length: SYNC_PORT_TRIES }, (_, index) => SYNC_PORT_BASE + index)

/**
 * Split `192.168.1.20:47802` into host and port. IPv6 literals in brackets are
 * rejected on purpose: the LAN API is IPv4-only (the discovery socket is udp4).
 *
 * @param {string} spec
 * @returns {{host: string, port: number|null} | null}
 */
export function parseTarget(spec) {
  const text = String(spec ?? '').trim()
  if (text.length === 0) return null
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(text)
  if (match === null) return null
  const host = match[1]
  const parts = host.split('.').map(Number)
  if (parts.some((part) => part < 0 || part > 255)) return null
  if (match[2] === undefined) return { host, port: null }
  const port = Number(match[2])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { host, port }
}

/**
 * Try the candidate ports of one host and return the first `/v1/info` answer.
 *
 * @param {string} host
 * @param {number[]} ports
 * @param {{token?: string|null, timeoutMs?: number, header?: string}} options
 * @returns {Promise<{host: string, port: number, info: object} | null>}
 */
export async function probeHost(host, ports, options = {}) {
  const timeoutMs = options.timeoutMs ?? 450
  const headers = { 'x-dsh-session-sync': '1' }
  if (typeof options.token === 'string' && options.token.length > 0) headers['x-dsh-session-sync-token'] = options.token
  // Ports are tried concurrently: a filtered port stalls the full timeout, so
  // sequential probing of 16 ports would take 7s on a quiet host.
  const attempt = async (port) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    timer.unref?.()
    try {
      const response = await fetch(`http://${host}:${port}/v1/info`, { headers, signal: controller.signal })
      if (!response.ok) return null
      const info = await response.json()
      if (info !== null && typeof info === 'object' && typeof info.id === 'string' && info.id.length > 0) {
        return { host, port, info }
      }
      return null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
  const settled = await Promise.allSettled(ports.map((port) => attempt(port)))
  for (const entry of settled) {
    if (entry.status === 'fulfilled' && entry.value !== null) return entry.value
  }
  return null
}

/**
 * Probe a list of explicit targets, stopping at the first answer per host.
 * Sequential on purpose: a handful of addresses, and we do not want a burst.
 *
 * @param {Array<{host: string, port: number|null}>} targets
 * @param {{token?: string|null, timeoutMs?: number, ports?: number[]}} options
 * @returns {Promise<Array<{host: string, port: number, info: object}>>}
 */
export async function probeTargets(targets, options = {}) {
  const ports = options.ports ?? DEFAULT_SYNC_PORTS
  const found = []
  const seen = new Set()
  for (const target of targets) {
    if (target === null || typeof target.host !== 'string') continue
    if (seen.has(target.host)) continue
    seen.add(target.host)
    const result = await probeHost(target.host, target.port === null ? ports : [target.port], options)
    if (result !== null) found.push(result)
  }
  return found
}
