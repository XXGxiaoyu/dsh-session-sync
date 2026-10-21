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
const { createRoot: baseCreateRoot } = require('react-dom/client')

// Every test gets a clean document and unmounts its roots afterwards: React
// roots keep polling the host, so leaking them piles up timers and DOM nodes.
const liveRoots = new Set()
function createRoot(container) {
  const root = baseCreateRoot(container)
  liveRoots.add(root)
  return root
}
test.afterEach(() => {
  for (const root of liveRoots) {
    try { root.unmount() } catch { /* already gone */ }
  }
  liveRoots.clear()
  document.body.innerHTML = '<div id="root"></div>'
})

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

  const menuButton = onlineRow.querySelector('.ss-menu-wrap > button')
  await act(async () => {
    menuButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
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
  const copied = []
  const previousClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard')
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: async (value) => { copied.push(value) } },
    configurable: true,
  })
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
  const show = peerRow.querySelector('.ss-device-name')
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

  // Option A: the digest stays automatic, but the full value is copyable so it
  // can be compared out-of-band when that is actually needed.
  const copy = [...box.querySelectorAll('button')].find((button) => button.textContent === t('sessions.copyHash'))
  assert.ok(copy, 'the verified row exposes a copy action')
  await act(async () => {
    copy.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  assert.deepEqual(copied, ['a'.repeat(64)], 'the clipboard gets the full 64-char digest')
  if (previousClipboard === undefined) delete globalThis.navigator.clipboard
  else Object.defineProperty(globalThis.navigator, 'clipboard', previousClipboard)

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

function jsonReply(data) {
  return { ok: true, status: 200, async json() { return data } }
}

function sessionPayload() {
  const now = Date.now()
  return {
    version: 4,
    id: 'l-1',
    createdAt: now - 60_000,
    cwd: '/tmp/ws',
    events: [
      { seq: 0, type: 'session', time: now - 60_000, data: {} },
      { seq: 1, type: 'user/message', time: now - 50_000, data: { content: [{ type: 'text', text: 'hi' }] } },
    ],
  }
}

function transfer() {
  const store = new Map()
  return {
    types: ['application/x-dsh-session-sync'],
    setData: (type, value) => store.set(type, value),
    getData: (type) => store.get(type) ?? '',
  }
}

test('a background refresh never wipes what the user is typing', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  stubFetch(() => statePayload(), calls)
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const name = container.querySelector('input.ss-input')
  await act(async () => { setInputValue(name, '还没保存的名字') })
  assert.equal(name.value, '还没保存的名字')

  const refresh = [...container.querySelectorAll('button')].find((button) => button.textContent === t('common.refresh'))
  await act(async () => { refresh.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  assert.equal(container.querySelector('input.ss-input').value, '还没保存的名字', 'typing survives the poll')
  await act(async () => { root.unmount() })
})

test('one-click sync dedupes imported sessions and reports them as skipped', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [
          { id: 'remote-1', title: '未拉取的会话', createdAt: Date.now() - 1000, eventCount: 3, imported: null },
          { id: 'remote-2', title: '已经拉过的会话', createdAt: Date.now() - 2000, eventCount: 3, imported: { localId: 'l-2' } },
        ],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: 'new-1', title: '未拉取的会话' } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [{ id: 'l-1', title: '本机会话', cwd: '/tmp/ws', updatedAt: Date.now() }] })
    return jsonReply(statePayload())
  }
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const open = container.querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })
  assert.match(container.textContent, /未拉取的会话/)

  const syncAll = [...container.querySelectorAll('button')].find((button) => button.textContent === t('device.pullAll'))
  await act(async () => { syncAll.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok(container.querySelector('.ss-modal'), 'a second confirmation is required')
  assert.match(container.querySelector('.ss-modal').textContent, /1/, 'the duplicate is called out')

  const confirm = [...container.querySelectorAll('.ss-modal button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })

  const pulls = calls.filter((call) => call.body.action === 'pull')
  assert.equal(pulls.length, 1, 'only the session that is not imported yet is transferred')
  assert.equal(pulls[0].body.sessionId, 'remote-1')
  assert.equal(calls.filter((call) => call.body.action === 'push').length, 0, 'sync means pull direction')
  assert.match(container.textContent, /跳过|Skipped/, 'the duplicate is reported as skipped in the queue')
  await act(async () => { root.unmount() })
})

test('dragging a peer session onto a workspace folder pulls it into that folder', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [{ id: 'remote-1', title: '拖过来的会话', createdAt: Date.now() - 1000, eventCount: 3, imported: null, cwd: '/Users/wang/projects/a' }],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: 'new-1', title: '拖过来的会话' } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [{ id: 'l-1', title: '本机会话', cwd: '/tmp/ws', updatedAt: Date.now() }] })
    return jsonReply(statePayload())
  }
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const open = container.querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  const item = container.querySelector('.ss-item[draggable="true"]')
  const folder = [...container.querySelectorAll('.ss-drop')].find((row) => row.textContent.includes('/tmp/ws'))
  assert.ok(item, 'sessions are draggable')
  assert.ok(folder, 'known folders are drop targets')

  const data = transfer()
  const dragStart = new dom.window.Event('dragstart', { bubbles: true })
  Object.defineProperty(dragStart, 'dataTransfer', { value: data })
  await act(async () => { item.dispatchEvent(dragStart) })
  assert.match(data.getData('application/x-dsh-session-sync'), /"direction":"pull"/)

  const drop = new dom.window.Event('drop', { bubbles: true })
  Object.defineProperty(drop, 'dataTransfer', { value: data })
  await act(async () => { folder.dispatchEvent(drop) })
  assert.ok(container.querySelector('.ss-modal'), 'dropping opens the confirmation dialog')
  assert.match(container.querySelector('.ss-modal').textContent, /\/tmp\/ws/)

  const confirm = [...container.querySelectorAll('.ss-modal button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })

  const pull = calls.find((call) => call.body.action === 'pull')
  assert.ok(pull, 'the drop results in a pull')
  assert.equal(pull.body.sessionId, 'remote-1')
  assert.equal(pull.body.cwd, '/tmp/ws', 'the conversation lands in the folder it was dropped on')
  await act(async () => { root.unmount() })
})

function threeSessionFetch(calls, options = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [
          { id: 'remote-1', title: '会话一', createdAt: Date.now() - 1000, eventCount: 3, imported: null },
          { id: 'remote-2', title: '会话二', createdAt: Date.now() - 2000, eventCount: 3, imported: { localId: 'l-2' } },
          { id: 'remote-3', title: '会话三', createdAt: Date.now() - 3000, eventCount: 3, imported: null },
        ],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: `new-${body.sessionId}` } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [{ id: 'l-1', title: '本机会话', cwd: '/tmp/ws', updatedAt: Date.now() }] })
    return jsonReply(statePayload(options.state ?? {}))
  }
}

test('a skipped item keeps the rest of the queue moving', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = threeSessionFetch(calls)
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const open = container.querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  const syncAll = [...container.querySelectorAll('button')].find((button) => button.textContent === t('device.pullAll'))
  await act(async () => { syncAll.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })

  const select = container.querySelector('.ss-modal select.ss-select')
  assert.ok(select, 'the duplicate row offers a choice')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set
    setter.call(select, 'skip')
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })

  const confirm = [...container.querySelectorAll('.ss-modal button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)) })

  const pulls = calls.filter((call) => call.body.action === 'pull').map((call) => call.body.sessionId)
  assert.deepEqual(pulls.sort(), ['remote-1', 'remote-3'], 'both fresh sessions go through, the skipped one does not block them')
  const text = container.textContent
  assert.match(text, /跳过|Skipped/)
  await act(async () => { root.unmount() })
})

test('choosing overwrite asks the receiver to bypass its fingerprint check', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = threeSessionFetch(calls)
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const open = container.querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  const syncAll = [...container.querySelectorAll('button')].find((button) => button.textContent === t('device.pullAll'))
  await act(async () => { syncAll.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })

  const select = container.querySelector('.ss-modal select.ss-select')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set
    setter.call(select, 'copy')
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
  const confirm = [...container.querySelectorAll('.ss-modal button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)) })

  const overwrite = calls.find((call) => call.body.action === 'pull' && call.body.sessionId === 'remote-2')
  assert.ok(overwrite, 'the duplicated session is transferred')
  assert.equal(overwrite.body.force, true)
  await act(async () => { root.unmount() })
})

test('checking a session enables the selection actions and scopes the plan', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = threeSessionFetch(calls)
  const container = document.getElementById('root')
  const root = createRoot(container)
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  await act(async () => { root.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })

  const open = container.querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  const boxes = [...container.querySelectorAll('input.ss-check')]
  assert.ok(boxes.length >= 4, 'the header has a select-all box and every session has one')
  await act(async () => { boxes[1].click() })
  await act(async () => { await Promise.resolve() })

  assert.match(container.textContent, new RegExp(t('sessions.selected', { n: 1 })))
  const selectedButton = [...container.querySelectorAll('button')].find((button) => button.textContent === t('sessions.syncSelected'))
  assert.equal(selectedButton.disabled, false, 'selecting one session enables the action')

  await act(async () => { selectedButton.click() })
  const rows = [...container.querySelectorAll('.ss-modal-row')]
  assert.equal(rows.length, 1, 'the dialog plans only the selected session')
  await act(async () => { root.unmount() })
})

test('the device list never shows this machine, and unnamed sessions carry their id', async () => {
  const { registered, t } = loadComponents()
  const json = (data) => ({ ok: true, status: 200, async json() { return data } })
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.action === 'peerSessions') {
      return json({
        ok: true,
        sessions: [{ id: 'session-abcdef12-9999-4f2c', title: '', createdAt: Date.now(), events: 3, cwd: '/work' }],
      })
    }
    return json(statePayload({
      self: { id: 'self-1', name: '本机工作台', ip: '10.1.2.3', port: 47802 },
      peers: [{ id: 'peer-mac', name: '隔壁的 Mac', remoteName: 'mac', address: '10.1.2.9', port: 47802, online: true, lastSeen: Date.now(), sameMachine: false }],
    }))
  }
  const panel = registered.find((entry) => entry.options.key === 'session-sync')
  assert.ok(panel, 'the main panel is registered under the plugin id')
  const container = document.getElementById('root')
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(panel.component, { t }))
  })
  await act(async () => { await Promise.resolve() })

  assert.ok(container.querySelector('.ss-self'), 'this machine is the local card, not a device row')
  assert.deepEqual([...container.querySelectorAll('[data-peer]')].map((row) => row.getAttribute('data-peer')), ['peer-mac'], 'its own address is never a device row')
  assert.equal(container.querySelector('.ss-self input.ss-input').value, '本机工作台', 'the name still lives in the rename field')
  const macRow = container.querySelector('[data-peer="peer-mac"]')
  assert.ok(macRow, 'the other machine is listed as a device')
  assert.match(macRow.textContent, /隔壁的 Mac/)

  const showButton = macRow.querySelector('.ss-device-name')
  await act(async () => {
    showButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })

  const text = container.textContent
  assert.match(text, /未命名会话/, 'untitled sessions keep their human label')
  assert.match(text, /#abcdef12/, 'and expose the id slice so look-alike rows can be told apart')

  await act(async () => { root.unmount() })
})


test('a peer on this machine is grouped under 本机, not counted as a device', async () => {
  const { registered, t } = loadComponents()
  const json = (data) => ({ ok: true, status: 200, async json() { return data } })
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.action === 'peerSessions') return json({ ok: true, sessions: [] })
    return json(statePayload({
      self: { id: 'self-1', name: '本机工作台', ip: '10.1.2.3', port: 47802 },
      peers: [
        { id: 'peer-local', name: '同机另一个 profile', remoteName: 'work', address: '10.1.2.3', port: 47803, online: true, lastSeen: Date.now(), sameMachine: true },
        { id: 'peer-local-old', name: '同机另一个 profile', remoteName: 'work', address: '10.1.2.3', port: 47803, online: false, lastSeen: Date.now() - 600_000, sameMachine: true },
        { id: 'peer-remote', name: '隔壁的 Mac', remoteName: 'mac', address: '10.1.2.9', port: 47802, online: true, lastSeen: Date.now(), sameMachine: false },
      ],
    }))
  }
  const panel = registered.find((entry) => entry.options.key === 'session-sync')
  const container = document.getElementById('root')
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(panel.component, { t })) })
  await act(async () => { await Promise.resolve() })

  assert.doesNotMatch(container.textContent, /同机另一个 profile/, 'same-host instances are not shown at all')
  assert.equal(container.querySelectorAll('[data-peer]').length, 1, 'only the other machine is a device row')
  assert.match(container.querySelector('[data-peer]').textContent, /隔壁的 Mac/)
  assert.match(container.textContent, /1 在线 \/ 共 1/, 'the total counts other machines only')

  await act(async () => { root.unmount() })
})

test('two profiles on one address collapse into a single device row', async () => {
  const { registered, t } = loadComponents()
  const json = (data) => ({ ok: true, status: 200, async json() { return data } })
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.action === 'peerSessions') return json({ ok: true, sessions: [] })
    return json(statePayload({
      self: { id: 'self-1', name: '本机工作台', ip: '10.1.2.3', port: 47802 },
      peers: [
        { id: 'peer-a', name: '工作室的 iMac', remoteName: 'imac', address: '10.9.0.7', port: 47802, online: true, lastSeen: Date.now() },
        { id: 'peer-b', name: '工作室的 iMac', remoteName: 'imac', address: '10.9.0.7', port: 47803, online: false, lastSeen: Date.now() - 900_000 },
      ],
    }))
  }
  const panel = registered.find((entry) => entry.options.key === 'session-sync')
  const container = document.getElementById('root')
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(panel.component, { t })) })
  await act(async () => { await Promise.resolve() })

  assert.equal(container.querySelectorAll('[data-peer]').length, 1, 'one IP is one device, whatever the port')
  assert.match(container.textContent, /1 在线 \/ 共 1/, 'the count follows the collapsed list')
  await act(async () => { root.unmount() })
})

test('a session dragged over a real sidebar row drops into that workspace', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [{ id: 'remote-9', title: '拖到工作区', createdAt: Date.now() - 1000, eventCount: 2, imported: null, cwd: '/Users/wang/a' }],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: 'new-9', title: '拖到工作区' } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [] })
    return jsonReply(statePayload({
      workspaces: [{ id: 'w1', path: '/tmp/alpha', title: 'Alpha' }],
      unsortedDir: '/tmp/unsorted',
      syncDir: '',
    }))
  }
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  assert.ok(page, 'the sidebar row opens the page')

  const panelRoot = createRoot(document.getElementById('root'))
  await act(async () => { panelRoot.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })
  const open = document.getElementById('root').querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  // DSH renders workspace rows with this stable attribute; the plugin only
  // listens on document, it never rewrites the row.
  const sidebar = document.createElement('div')
  const workspaceRow = document.createElement('div')
  workspaceRow.setAttribute('data-row-key', 'workspace:w1')
  const ungroupedRow = document.createElement('div')
  ungroupedRow.setAttribute('data-row-key', 'workspace:')
  sidebar.append(workspaceRow, ungroupedRow)
  document.body.append(sidebar)

  const item = document.getElementById('root').querySelector('.ss-item[draggable="true"]')
  const data = transfer()
  const dragStart = new dom.window.Event('dragstart', { bubbles: true })
  Object.defineProperty(dragStart, 'dataTransfer', { value: data })
  await act(async () => { item.dispatchEvent(dragStart) })

  const over = new dom.window.Event('dragover', { bubbles: true, cancelable: true })
  Object.defineProperty(over, 'dataTransfer', { value: data })
  await act(async () => { workspaceRow.dispatchEvent(over) })
  assert.ok(workspaceRow.classList.contains('ss-ws-over'), 'the official row lights up under the pointer')

  // Expanded area: a session row belongs to the header above it, so the whole
  // group — not just the header — accepts the drop.
  const member = document.createElement('div')
  member.setAttribute('data-row-key', 'session:remote-9')
  workspaceRow.after(member)
  const overMember = new dom.window.Event('dragover', { bubbles: true, cancelable: true })
  Object.defineProperty(overMember, 'dataTransfer', { value: data })
  await act(async () => { member.dispatchEvent(overMember) })
  assert.ok(workspaceRow.classList.contains('ss-ws-over'), 'the owning header is marked')
  assert.ok(member.classList.contains('ss-ws-member'), 'the expanded row is tinted too')
  const pill = document.querySelector('.ss-dnd-tip.ws')
  assert.ok(pill !== null, 'the pointer pill names the target')
  assert.match(pill.querySelector('.ss-dnd-name').textContent, /Alpha|ds-harness-workspace/)
  assert.match(pill.querySelector('.ss-dnd-hint').textContent, /整组可放|Whole group/)

  const outside = new dom.window.Event('dragover', { bubbles: true, cancelable: true })
  Object.defineProperty(outside, 'dataTransfer', { value: data })
  await act(async () => { document.body.dispatchEvent(outside) })
  assert.ok(document.querySelector('.ss-dnd-tip.blocked') !== null, 'stray areas show the blocked pill')

  const overUngrouped = new dom.window.Event('dragover', { bubbles: true, cancelable: true })
  Object.defineProperty(overUngrouped, 'dataTransfer', { value: data })
  await act(async () => { ungroupedRow.dispatchEvent(overUngrouped) })
  assert.ok(ungroupedRow.classList.contains('ss-ws-over'), '未分组 resolves through its empty key')
  assert.ok(!workspaceRow.classList.contains('ss-ws-over'), 'only one row is marked at a time')

  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: data })
  await act(async () => { member.dispatchEvent(drop) })
  // The success state holds for ~90ms before the confirmation dialog opens.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 160)) })

  const modal = document.getElementById('root').querySelector('.ss-modal')
  assert.ok(modal, 'dropping opens the confirmation dialog')
  assert.match(modal.textContent, /\/tmp\/alpha/)
  const confirm = [...modal.querySelectorAll('button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
  const pull = calls.find((call) => call.body.action === 'pull')
  assert.ok(pull, 'the drop pulls the session')
  assert.equal(pull.body.cwd, '/tmp/alpha', 'the conversation lands in the row the user dropped on')

  await act(async () => { panelRoot.unmount() })
  sidebar.remove()
})

test('a nested expanded group accepts the drop anywhere inside it', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = async (_input, init = {}) => {
    const body = JSON.parse(init.body ?? '{}')
    calls.push({ body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [{ id: 'remote-9', title: '嵌套分组', createdAt: Date.now() - 1000, eventCount: 2, imported: null, cwd: '/Users/wang/a' }],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: 'new-9', title: '嵌套分组' } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [] })
    return jsonReply(statePayload({
      workspaces: [{ id: 'w1', path: '/tmp/alpha', title: 'Alpha' }],
      unsortedDir: '/tmp/unsorted',
      syncDir: '',
    }))
  }
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  const panelRoot = createRoot(document.getElementById('root'))
  await act(async () => { panelRoot.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })
  const open = document.getElementById('root').querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  // DSH nests an expanded group: <li><row/><ul><li><session row/></li></ul></li>
  const tree = document.createElement('div')
  tree.setAttribute('role', 'tree')
  const group = document.createElement('li')
  const header = document.createElement('div')
  header.setAttribute('data-row-key', 'workspace:w1')
  header.setAttribute('aria-expanded', 'true')
  const list = document.createElement('ul')
  const nested = document.createElement('li')
  const member = document.createElement('div')
  member.setAttribute('data-row-key', 'session:remote-9')
  nested.append(member)
  list.append(nested)
  group.append(header, list)
  tree.append(group)
  document.body.append(tree)

  const item = document.getElementById('root').querySelector('.ss-item[draggable="true"]')
  const data = transfer()
  const dragStart = new dom.window.Event('dragstart', { bubbles: true })
  Object.defineProperty(dragStart, 'dataTransfer', { value: data })
  await act(async () => { item.dispatchEvent(dragStart) })
  assert.ok(document.querySelector('.ss-dragghost') !== null, 'our own ghost replaces the native drag image')

  const over = new dom.window.Event('dragover', { bubbles: true, cancelable: true, clientX: 120, clientY: 240 })
  Object.defineProperty(over, 'dataTransfer', { value: data })
  await act(async () => { member.dispatchEvent(over) })
  assert.ok(header.classList.contains('ss-ws-over'), 'a row two levels down still resolves its group')
  assert.ok(group.classList.contains('ss-ws-group'), 'the whole group container is tinted')
  assert.ok(member.classList.contains('ss-ws-member'), 'the nested member row is tinted')
  assert.ok(document.querySelector('.ss-dnd-tip.ws') !== null, 'the pill announces the group instead of blocking')

  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: data })
  await act(async () => { member.dispatchEvent(drop) })
  assert.ok(document.querySelector('.ss-dragghost') === null, 'the ghost is cleared on drop')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 160)) })
  const modal = document.getElementById('root').querySelector('.ss-modal')
  assert.ok(modal, 'dropping inside the expanded area opens the confirmation dialog')
  const confirm = [...modal.querySelectorAll('button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
  const pull = calls.find((call) => call.body.action === 'pull')
  assert.equal(pull?.body.cwd, '/tmp/alpha')
  await act(async () => { panelRoot.unmount() })
  tree.remove()
})

test('a row nested inside DSH\'s div/span section resolves to its group header', async () => {
  const { registered, t } = loadComponents()
  const calls = []
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body ?? '{}')
    calls.push({ body })
    if (body.action === 'peerSessions') {
      return jsonReply({
        ok: true,
        sessions: [{ id: 'remote-9', title: '生产结构', createdAt: Date.now() - 1000, eventCount: 2, imported: null, cwd: '/Users/wang/a' }],
      })
    }
    if (body.action === 'pull') return jsonReply({ ok: true, imported: { localId: 'new-9', title: '生产结构' } })
    if (body.action === 'localSessions') return jsonReply({ ok: true, sessions: [] })
    return jsonReply(statePayload({
      workspaces: [{ id: 'w1', path: '/tmp/alpha', title: 'Alpha' }],
      unsortedDir: '/tmp/unsorted',
      syncDir: '',
    }))
  }
  const page = registered.find((entry) => entry.options.id === 'session-sync')
  const panelRoot = createRoot(document.getElementById('root'))
  await act(async () => { panelRoot.render(React.createElement(page.component, { t })) })
  await act(async () => { await Promise.resolve() })
  const open = document.getElementById('root').querySelector('[data-peer="peer-1"] .ss-device-name')
  await act(async () => { open.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })

  // Mirrors the real sidebar: list > section > (header | span > sessionRow).
  const list = document.createElement('div')
  const section = document.createElement('div')
  const header = document.createElement('div')
  header.setAttribute('data-row-key', 'workspace:w1')
  const span = document.createElement('span')
  const row = document.createElement('div')
  row.className = 'jJkEga_sessionRow'
  row.setAttribute('data-row-key', 'session:session-1')
  span.append(row)
  section.append(header, span)
  list.append(section)
  document.body.append(list)

  const item = document.getElementById('root').querySelector('.ss-item[draggable="true"]')
  const data = transfer()
  const dragStart = new dom.window.Event('dragstart', { bubbles: true })
  Object.defineProperty(dragStart, 'dataTransfer', { value: data })
  await act(async () => { item.dispatchEvent(dragStart) })

  const over = new dom.window.Event('dragover', { bubbles: true, cancelable: true, clientX: 100, clientY: 200 })
  Object.defineProperty(over, 'dataTransfer', { value: data })
  await act(async () => { row.dispatchEvent(over) })
  assert.ok(header.classList.contains('ss-ws-over'), 'the header two levels up lights up')
  assert.ok(section.classList.contains('ss-ws-group'), 'the section itself is tinted')
  assert.ok(row.classList.contains('ss-ws-member'), 'the session row is tinted')

  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: data })
  await act(async () => { row.dispatchEvent(drop) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 160)) })
  const modal = document.getElementById('root').querySelector('.ss-modal')
  const confirm = [...modal.querySelectorAll('button')].find((button) => button.textContent === t('plan.confirm'))
  await act(async () => { confirm.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
  assert.equal(calls.find((call) => call.body.action === 'pull')?.body.cwd, '/tmp/alpha')
  await act(async () => { panelRoot.unmount() })
  list.remove()
})
