/**
 * The HTTP fallback: a peer whose UDP beacons never arrive (different VLAN,
 * firewall, or a moved discovery port) must still be reachable through the
 * normal `/v1/info` endpoint.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import { createServer } from 'node:net'
import { test } from 'node:test'
import { DEFAULT_SYNC_PORTS, parseTarget, probeHost, probeTargets } from '../lib/probe.js'

/** Start a fake peer that answers /v1/info like lib/lan.js does. */
function fakePeer() {
  const server = http.createServer((request, response) => {
    if (request.headers['x-dsh-session-sync'] !== '1') {
      response.writeHead(400)
      response.end('missing header')
      return
    }
    if (request.url !== '/v1/info') {
      response.writeHead(404)
      response.end('nope')
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ id: 'peer-device', name: 'peer-mac', version: '0.3.1', platform: 'darwin-arm64', sessions: 2 }))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

test('parseTarget accepts bare IPs and IP:port, rejects anything else', () => {
  assert.deepEqual(parseTarget('192.168.5.20'), { host: '192.168.5.20', port: null })
  assert.deepEqual(parseTarget(' 192.168.5.20:47803 '), { host: '192.168.5.20', port: 47803 })
  assert.equal(parseTarget('192.168.5.0/24'), null, 'CIDRs are the UDP sweeper job, not the prober')
  assert.equal(parseTarget('192.168.5.20:99999'), null)
  assert.equal(parseTarget('300.1.2.3'), null)
  assert.equal(parseTarget('peer.local'), null)
})

test('probeHost finds the peer among dead ports and requires the protocol header', async () => {
  const { server, port } = await fakePeer()
  try {
    // A neighbouring port could belong to another test's fake peer when the
    // suite runs in parallel, so reserve one and close it instead of guessing.
    const dead = await new Promise((resolve) => {
      const probe = createServer(() => {})
      probe.listen(0, '127.0.0.1', () => {
        const { port: deadPort } = probe.address()
        probe.close(() => resolve(deadPort))
      })
    })
    const ports = [dead, port]
    const found = await probeHost('127.0.0.1', ports, { timeoutMs: 400 })
    assert.equal(found?.port, port)
    assert.equal(found?.info.id, 'peer-device')
  } finally {
    server.close()
  }
})

test('probeHost returns null when nothing answers', async () => {
  const found = await probeHost('127.0.0.1', [1], { timeoutMs: 250 })
  assert.equal(found, null)
})

test('probeTargets deduplicates hosts and honours an explicit port', async () => {
  const { server, port } = await fakePeer()
  try {
    const found = await probeTargets(
      [{ host: '127.0.0.1', port }, { host: '127.0.0.1', port }],
      { timeoutMs: 400, ports: DEFAULT_SYNC_PORTS },
    )
    assert.equal(found.length, 1)
    assert.equal(found[0].info.name, 'peer-mac')
  } finally {
    server.close()
  }
})
