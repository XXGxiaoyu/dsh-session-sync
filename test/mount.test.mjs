/**
 * Mount the real components in a DOM. This is the closest thing to the browser
 * the test suite can get: jsdom + react-dom/client + the bundle's own effects,
 * polling and click handlers, with `fetch` replaced by a recorded host stub.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'lib', 'client.js'), 'utf8')

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:4397/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = require('react')
const { act } = require('react')
const { createRoot } = require('react-dom/client')

function statePayload(overrides = {}) {
  const now = Date.now()
  return {
    ok: true,
    version: '0.1.0',
    self: { id: 'self-1', name: '本机工作台' },
    peers: [
      {
        id: 'peer-1',
        name: '老王的 Mac',
        customName: '老王的 Mac',
        remoteName: 'wang-mac',
        address: '192.168.1.7',
        port: 47802,
        online: true,
        lastSeen: now,
      },
      {
        id: 'peer-2',
        name: '离线笔记本',
        customName: '离线笔记本',
        remoteName: 'laptop',
        address: '192.168.1.9',
        port: 47802,
        online: false,
        lastSeen: now - 600_000,
      },
    ],
    imports: [],
    settings: { autoPull: false, autoPush: false, discoveryPort: 47801, lanPort: 47802, seeds: [] },
    ports: { lan: 47802, discovery: 47801 },
    hasPersistence: true,
    sessionCount: 5,
    ...overrides,
  }
}

function loadComponents() {
  let registration
  const win = { __ModuleLoader__: { load: (value) => { registration = value } } }
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', source)(win, globalThis.document)
  const dictionaries = {}
  const bound = []
  const registered = []
  const ctx = {
    effect(fn) {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    locale: {
      getSnapshot: () => ({ active: 'zh' }),
      subscribe: () => () => {},
      register(namespace, value) {
        dictionaries[namespace] = value
      },
      bind(namespace) {
        const dictionary = dictionaries[namespace].zh
        const t = (key, params) => {
          const template = dictionary[key] ?? key
          if (params === undefined) return template
          return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
        }
        bound.push(t)
        return t
      },
    },
    slots: {
      inject(key, callback) {
        return ctx.effect(callback)
      },
      register(options, component) {
        registered.push({ options, component })
        return () => {}
      },
    },
  }
  const exports = registration.factory((specifier) => {
    if (specifier === 'react') return React
    throw new Error(`unexpected require(${specifier})`)
  })
  exports.apply(ctx)
  return { registered, t: ctx.locale.bind('sessionSync') }
}

function stubFetch(payload, calls) {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    const data = body.action === 'rename' ? statePayload({ peers: statePayload().peers }) : payload()
    return {
      ok: true,
      status: 200,
      async json() {
        return data
      },
    }
  }
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

test('settings page shows discovered devices and renames one inline', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  stubFetch(() => statePayload(), calls)
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => {
    root.render(React.createElement(page.component, { t }))
  })
  await act(async () => { await Promise.resolve() })

  const text = container.textContent
  assert.match(text, /老王的 Mac/)
  assert.match(text, /离线笔记本/)
  const selfInput = container.querySelector('input.ss-input')
  assert.equal(selfInput.value, '本机工作台', 'the local device name is editable in place')
  assert.ok(calls.some((call) => call.body.action === 'state'), 'the page must poll the host')

  const offlineRow = container.querySelector('[data-peer="peer-2"]')
  assert.ok(offlineRow, 'offline devices stay listed')
  assert.match(offlineRow.textContent, /离线/, 'offline devices render their last-seen hint')
  assert.ok(offlineRow.querySelector('.ss-dot').className.includes('on') === false)

  const onlineRow = container.querySelector('[data-peer="peer-1"]')
  assert.ok(onlineRow.querySelector('.ss-dot').className.includes('on'))

  const renameButton = [...onlineRow.querySelectorAll('button')].find((button) => button.textContent === t('device.rename'))
  await act(async () => {
    renameButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  const input = onlineRow.querySelector('input.ss-input')
  assert.ok(input, 'rename opens an inline editor')
  await act(async () => {
    setInputValue(input, '客厅的 Mac')
  })
  const save = [...onlineRow.querySelectorAll('button')].find((button) => button.textContent === t('common.save'))
  await act(async () => {
    save.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })

  const rename = calls.find((call) => call.body.action === 'rename')
  assert.deepEqual(rename.body, { action: 'rename', peerId: 'peer-1', name: '客厅的 Mac' })

  await act(async () => { root.unmount() })
})

test('the main panel lists a peer\'s sessions and verifies one by sha256', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  const json = (data) => ({ ok: true, status: 200, async json() { return data } })
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'peerSessions') {
      return json({
        ok: true,
        sessions: [{ id: 'session-1', title: '共享会话', createdAt: Date.now(), events: 19, cwd: '/work' }],
      })
    }
    if (body.action === 'verify') {
      const digest = 'a'.repeat(64)
      return json({ ok: true, sessionId: 'session-1', sha256: digest, declared: digest, verified: true, localMatch: null, events: 19 })
    }
    return json(statePayload())
  }

  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const panel = registered.find((entry) => entry.options.name === 'main')
  await act(async () => {
    root.render(React.createElement(panel.component, { t }))
  })
  await act(async () => { await Promise.resolve() })

  assert.ok(host.querySelector('.ss-page'), 'the sidebar row opens a full page')
  const peerRow = host.querySelector('[data-peer="peer-1"]')
  // DeviceRow owns the rename controls; the session buttons are siblings inside
  // the per-device wrapper, so both live under `box`.
  const box = peerRow.parentElement
  const show = [...box.querySelectorAll('button')].find((button) => button.textContent === t('sessions.show'))
  await act(async () => {
    show.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })
  assert.match(box.textContent, /共享会话/)

  const verify = [...box.querySelectorAll('button')].find((button) => button.textContent === t('sessions.verify'))
  assert.ok(verify, 'every remote session can be checked')
  await act(async () => {
    verify.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })

  assert.deepEqual(calls.find((call) => call.body.action === 'verify').body, {
    action: 'verify',
    peerId: 'peer-1',
    sessionId: 'session-1',
  })
  assert.match(box.textContent, /校验通过/)
  assert.match(box.textContent, /aaaaaaaaaaaa/)

  await act(async () => { root.unmount() })
  host.remove()
})

test('a failing host call degrades to an error banner without losing the list', async () => {
  const { registered, t } = loadComponents()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let mode = 'good'
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.action !== 'state') return { ok: true, status: 200, async json() { return { ok: true } } }
    if (mode === 'good') return { ok: true, status: 200, async json() { return statePayload() } }
    return { ok: false, status: 500, async json() { return { ok: false, error: { code: 'boom', message: '插件服务炸了' } } } }
  }
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => {
    root.render(React.createElement(page.component, { t }))
  })
  await act(async () => { await Promise.resolve() })

  const refresh = [...container.querySelectorAll('button')].find((button) => button.textContent === t('common.refresh'))
  mode = 'bad'
  await act(async () => {
    refresh.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })

  assert.match(container.textContent, /老王的 Mac/, 'the previous peer list survives a failed call')
  assert.match(container.textContent, /插件服务炸了/, 'the failure is surfaced')

  await act(async () => { root.unmount() })
  container.remove()
})

test('the language select pins the copy and stores the choice on the host', async () => {
  const { registered } = loadComponents()
  const calls = []
  let stored = 'auto'
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'settings' && typeof body.patch?.locale === 'string') stored = body.patch.locale
    const settings = { ...statePayload().settings, locale: stored }
    return { ok: true, status: 200, async json() { return statePayload({ settings }) } }
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, {})) })
  await act(async () => { await Promise.resolve() })

  const select = container.querySelector('select.ss-select')
  assert.ok(select, 'the settings card exposes a language picker')
  assert.equal(select.value, 'auto', 'auto follows the DSH locale by default')
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    ['跟随 DSH / 系统语言', '中文', 'English'],
  )

  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set
  await act(async () => {
    setter.call(select, 'en')
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })

  assert.deepEqual(calls.find((call) => call.body.action === 'settings').body, {
    action: 'settings',
    patch: { locale: 'en' },
  })
  assert.match(container.textContent, /Sync settings/, 'the copy switches right after the save')

  await act(async () => { root.unmount() })
  container.remove()
})
