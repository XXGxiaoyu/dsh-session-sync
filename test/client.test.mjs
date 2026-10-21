/**
 * The browser half must survive the real module contract: `load({id, factory})`,
 * a `require` that only knows the platform seeds, and a Cordis context that
 * provides `slots` + `locale`.
 *
 * Rendering runs through react-dom/server with the plugin's own React, which is
 * a dev dependency only — at runtime the host supplies it.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const bundlePath = path.join(here, '..', 'lib', 'client.js')
const source = fs.readFileSync(bundlePath, 'utf8')

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

/** Evaluate the bundle exactly as `__ModuleLoader__` would. */
function loadBundle() {
  let registration
  globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  const appended = []
  globalThis.document = {
    baseURI: 'http://127.0.0.1:4397/',
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: (node) => appended.push(node) },
  }
  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'document', source)
  run(globalThis.window, globalThis.document)
  return { registration, appended }
}

function makeContext(registration, { active = 'zh' } = {}) {
  const locales = []
  const effects = []
  const registered = []
  const injected = []
  const ctx = {
    fiber: { name: 'dsh-session-sync' },
    effect(fn) {
      effects.push(fn)
      const dispose = fn()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    locale: {
      getSnapshot: () => ({ active }),
      subscribe: () => () => {},
      register(namespace, dictionaries) {
        locales.push({ namespace, dictionaries })
        return () => {}
      },
      bind: (namespace) => (key, params) => {
        const dictionary = locales.find((entry) => entry.namespace === namespace)?.dictionaries.zh ?? {}
        const template = dictionary[key] ?? key
        if (params === undefined) return template
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      },
    },
    slots: {
      inject(key, callback) {
        injected.push(key)
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
  return { exports, locales, registered, injected, ctx }
}

test('bundle registers under its package id and declares slots + locale', () => {
  const { registration, appended } = loadBundle()
  assert.equal(registration.id, 'dsh-session-sync')
  assert.equal(typeof registration.factory, 'function')
  assert.equal(appended.length, 0, 'nothing may touch the DOM before the factory runs')

  const { exports, injected, registered } = makeContext(registration)
  assert.equal(appended.length, 1, 'the stylesheet must be claimed by the module loader')
  assert.equal(appended[0].dataset.plugin, 'dsh-session-sync')
  assert.equal(appended[0].dataset.pluginCss, 'dsh-session-sync/client.css')
  assert.match(appended[0].textContent, /\.ss-page/)
  assert.equal(exports.name, 'dsh-session-sync')
  assert.deepEqual(exports.inject, ['slots', 'locale'])
  assert.deepEqual(injected, ['settings.section', 'sidebar.panellist', 'main'])
  assert.deepEqual(
    registered.map((entry) => entry.options.name),
    ['settings.section', 'sidebar.panellist', 'main'],
  )
  const [section, row, panel] = registered
  assert.equal(section.options.id, 'session-sync')
  assert.equal(row.options.id, 'session-sync', 'the sidebar row opens the keyed panel of the same id')
  assert.equal(panel.options.key, 'session-sync')
  assert.equal(typeof row.options.label, 'function')
  assert.equal(row.options.label(), '会话同步', 'label resolves through the bound translator')
})

test('locale dictionaries stay in sync and cover every t() key used', () => {
  const { registration } = loadBundle()
  const { locales } = makeContext(registration)
  assert.equal(locales.length, 1)
  const { namespace, dictionaries } = locales[0]
  assert.equal(namespace, 'sessionSync')
  const zh = Object.keys(dictionaries.zh).sort()
  const en = Object.keys(dictionaries.en).sort()
  assert.deepEqual(zh, en, 'zh and en dictionaries must expose the same keys')

  const used = new Set([...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((match) => match[1]))
  const missing = [...used].filter((key) => !(key in dictionaries.zh))
  assert.deepEqual(missing, [], 'every t() key needs a dictionary entry')
})

test('settings page renders an empty but honest device list', () => {
  const { registration } = loadBundle()
  const { registered, locales } = makeContext(registration)
  const t = (key, params) => {
    const template = locales[0].dictionaries.zh[key] ?? key
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
  }
  const settings = registered.find((entry) => entry.options.id === 'session-sync')
  const html = renderToStaticMarkup(React.createElement(settings.component, { t }))
  assert.match(html, /会话同步/)
  assert.match(html, /本机/)
  assert.match(html, /让另一台设备也安装这个插件/)
  assert.match(html, /同步设置/)
})

test('sidebar row and main panel share the page', () => {
  const { registration } = loadBundle()
  const { registered, locales } = makeContext(registration)
  const t = (key, params) => {
    const template = locales[0].dictionaries.zh[key] ?? key
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
  }
  const row = registered.find((entry) => entry.options.name === 'sidebar.panellist')
  const rowHtml = renderToStaticMarkup(React.createElement(row.component, { size: 16 }))
  assert.match(rowHtml, /<svg/)
  assert.match(rowHtml, /ss-navicon/)

  const panel = registered.find((entry) => entry.options.name === 'main')
  const panelHtml = renderToStaticMarkup(React.createElement(panel.component, { t }))
  assert.match(panelHtml, /ss-page/)
  assert.match(panelHtml, /会话同步/)
})

test('client and host agree on the same-origin API path', () => {
  const host = fs.readFileSync(path.join(here, '..', 'lib', 'index.js'), 'utf8')
  const clientPath = /const API_PATH = '([^']+)'/.exec(source)?.[1]
  const hostPrefix = /const API_PREFIX = '([^']+)'/.exec(host)?.[1]
  assert.equal(clientPath, '/session-sync/api')
  assert.equal(hostPrefix, clientPath)
  assert.match(host, /kind: 'prefix',\s*\n\s*path: '\/session-sync'/)
})

test('the plugin follows the DSH locale, and reads non-Chinese as English', () => {
  const { registration } = loadBundle()
  const english = makeContext(registration, { active: 'en-US' })
  const row = english.registered.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(row.options.label(), 'Session Sync', 'the sidebar row follows the DSH language')

  const section = english.registered.find((entry) => entry.options.id === 'session-sync')
  const html = renderToStaticMarkup(React.createElement(section.component, {}))
  assert.match(html, /Sync settings/)
  assert.match(html, /Follow DSH \/ system/, 'the language row offers the follow-option')
  assert.match(html, /<option value="zh">中文<\/option>/, 'Chinese stays selectable in either language')
  assert.match(html, /<option value="en">English<\/option>/, 'English stays selectable in either language')

  const chinese = makeContext(registration, { active: 'zh-CN' })
  const zhRow = chinese.registered.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(zhRow.options.label(), '会话同步')
})

test('without a DSH locale the plugin falls back to the system language', () => {
  const { registration } = loadBundle()
  const original = globalThis.navigator
  const withSystemLanguage = (tag) => Object.defineProperty(globalThis, 'navigator', {
    value: { languages: [tag], language: tag },
    configurable: true,
  })
  try {
    withSystemLanguage('en-US')
    const english = makeContext(registration, { active: null })
    const enRow = english.registered.find((entry) => entry.options.name === 'sidebar.panellist')
    assert.equal(enRow.options.label(), 'Session Sync', 'non-Chinese systems default to English')

    withSystemLanguage('zh-Hans-CN')
    const chinese = makeContext(registration, { active: null })
    const zhRow = chinese.registered.find((entry) => entry.options.name === 'sidebar.panellist')
    assert.equal(zhRow.options.label(), '会话同步', 'Chinese systems default to Chinese')
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
  }
})

test('the page footer credits the version, the license and the repository', () => {
  const { registration } = loadBundle()
  const { registered, locales } = makeContext(registration)
  const t = (key, params) => {
    const template = locales[0].dictionaries.zh[key] ?? key
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
  }
  const section = registered.find((entry) => entry.options.id === 'session-sync')
  const html = renderToStaticMarkup(React.createElement(section.component, { t }))
  assert.match(html, /ss-footer/)
  assert.match(html, /MIT 协议/)
  assert.match(html, /https:\/\/github\.com\/XXGxiaoyu\/dsh-session-sync/)
  assert.match(html, /Star/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noreferrer noopener"/)
})

test('the bundled client version tracks package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'))
  const bundled = /const CLIENT_VERSION = '([^']+)'/.exec(source)?.[1]
  assert.ok(bundled !== undefined, 'CLIENT_VERSION must be a literal so the footer never lags a release')
  assert.equal(bundled, pkg.version, 'bump both together — the footer shows the running build, not the latest tag')
})

test('a stale host is called out instead of looking like a wrong version', () => {
  const { registration } = loadBundle()
  const { registered, locales } = makeContext(registration)
  const t = (key, params) => {
    const template = locales[0].dictionaries.zh[key] ?? key
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
  }
  const section = registered.find((entry) => entry.options.id === 'session-sync')
  const html = renderToStaticMarkup(React.createElement(section.component, { t }))
  assert.match(html, new RegExp(`v${JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')).version.replace(/\./g, '\\.')}`), 'the footer advertises the build it was shipped with')
  assert.doesNotMatch(html, /宿主 v/, 'no stale-host line when host and bundle agree')
})

test('a render crash is contained by an error boundary instead of a blank panel', () => {
  assert.match(source, /class Boundary extends React\.Component/)
  assert.match(source, /getDerivedStateFromError/)
  assert.match(source, /function Diagnostics\(/)
  assert.match(source, /h\(Boundary, \{ t: \(key\) => translateNow\(key\) \}/, 'both the settings section and the main panel are wrapped')
})

test('every runtime-translated key exists in both dictionaries', () => {
  const { registration } = loadBundle()
  const { locales } = makeContext(registration)
  const dictionaries = locales[0].dictionaries
  const keys = new Set([...source.matchAll(/translateNow\(\s*'([^']+)'/g)].map((match) => match[1]))
  assert.ok(keys.size > 0, 'the bundle resolves some strings at runtime')
  for (const key of keys) {
    for (const language of ['zh', 'en']) {
      assert.ok(dictionaries[language][key] !== undefined, `${language} is missing ${key}`)
    }
  }
})
