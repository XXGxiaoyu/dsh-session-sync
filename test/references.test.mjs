/**
 * Free-identifier guard for the hand-written browser bundle.
 *
 * The bundle has no build step, so a typo like `shortClock(...)` without a
 * definition only surfaces at render time — inside a settings panel the user
 * has to click before it throws. This test parses the bundle and reports any
 * identifier that is read but never declared, which is exactly that bug class.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import * as acorn from 'acorn'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = ['client.js', 'index.js', 'discovery.js', 'lan.js', 'probe.js', 'sessions.js', 'state.js']

/** Names the bundle may read without declaring them. */
const GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'console',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'structuredClone', 'performance', 'globalThis', 'undefined', 'arguments', 'this',
  'NaN', 'Infinity', 'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math', 'JSON', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Error', 'TypeError', 'RangeError', 'AggregateError',
  'Intl', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal', 'TextEncoder', 'TextDecoder',
  'Blob', 'File', 'FileReader', 'FormData', 'Headers', 'Request', 'Response', 'fetch', 'Event', 'CustomEvent',
  'HTMLElement', 'Element', 'Node', 'NodeList', 'DOMException', 'MutationObserver', 'ResizeObserver',
  'IntersectionObserver', 'crypto', 'btoa', 'atob', 'Uint8Array', 'ArrayBuffer', 'DataView', 'Reflect', 'Proxy',
  'process', 'Buffer', 'require', 'module', 'exports', 'Text', 'KeyboardEvent', 'MouseEvent', 'DragEvent',
])

/** Property names that read like identifiers but are not references. */
function patternNames(node, out = new Set()) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  switch (node.type) {
    case 'Identifier':
      out.add(node.name)
      break
    case 'ObjectPattern':
      for (const property of node.properties) {
        if (property.type === 'RestElement') patternNames(property.argument, out)
        else patternNames(property.value, out)
      }
      break
    case 'ArrayPattern':
      for (const element of node.elements) patternNames(element, out)
      break
    case 'AssignmentPattern':
      patternNames(node.left, out)
      break
    case 'RestElement':
      patternNames(node.argument, out)
      break
    default:
      break
  }
  return out
}

/** Walk every node, recording parent links so key/property positions can be skipped. */
function collect(ast) {
  const parents = new Map()
  const all = []
  const visit = (node, parent) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, parent)
      return
    }
    if (typeof node.type !== 'string') return
    all.push(node)
    parents.set(node, parent)
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue
      visit(node[key], node)
    }
  }
  visit(ast, null)
  return { all, parents }
}

function declaredNames(all) {
  const names = new Set()
  for (const node of all) {
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) names.add(node.id.name)
        for (const param of node.params) patternNames(param, names)
        break
      case 'VariableDeclarator':
        patternNames(node.id, names)
        break
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) names.add(node.id.name)
        break
      case 'CatchClause':
        patternNames(node.param, names)
        break
      case 'ImportDefaultSpecifier':
      case 'ImportSpecifier':
      case 'ImportNamespaceSpecifier':
        names.add(node.local.name)
        break
      case 'LabeledStatement':
        names.add(node.label.name)
        break
      default:
        break
    }
  }
  // Nested function expressions assign to outer names via `var module = {}` etc.
  return names
}

function freeReferences(file, source) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const { all, parents } = collect(ast)
  const declared = declaredNames(all)
  const free = []
  for (const node of all) {
    if (node.type !== 'Identifier') continue
    const parent = parents.get(node)
    if (parent === null) continue
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) continue
    if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) continue
    if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) continue
    if (parent.type === 'PropertyDefinition' && parent.key === node && !parent.computed) continue
    if (parent.type === 'ExportSpecifier') continue
    if (parent.type === 'MetaProperty') continue
    if (parent.type === 'ImportSpecifier' && parent.imported === node) continue
    if (declared.has(node.name) || GLOBALS.has(node.name)) continue
    free.push(`${file}:${node.loc.start.line} ${node.name}`)
  }
  return free
}

test('every identifier the bundles read is declared somewhere', () => {
  const problems = []
  for (const file of files) {
    const source = fs.readFileSync(path.join(here, '..', 'lib', file), 'utf8')
    problems.push(...freeReferences(`lib/${file}`, source))
  }
  assert.deepEqual(problems, [], 'undeclared identifiers (a render-time ReferenceError waiting to happen)')
})
