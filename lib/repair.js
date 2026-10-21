/**
 * Repair session logs that an older plugin build imported incorrectly.
 *
 * Those copies carried the source's inherited `session/end-seed` marker into an
 * unseeded header, so DSH rejects them with
 * "released v2 unseeded Session contains an inherited end-seed marker".
 * Dropping the inherited prefix (the source's own conversation is kept) and
 * renumbering `seq` makes the log valid again.
 */
import fs from 'node:fs'
import path from 'node:path'

import { decodeStoredLog, encodeStoredLog } from './logfile.js'

/** @typedef {{ dropped: number, events: number }} RepairReport */

/**
 * Remove an inherited prefix from decoded JSONL text.
 *
 * @param {string} text - decoded log including its header line.
 * @returns {{ text: string, report: RepairReport } | null} null when nothing needs repair.
 */
export function repairLogText(text) {
  const lines = text.split('\n').filter((line) => line.length > 0)
  if (lines.length < 2) return null
  let header
  try {
    header = JSON.parse(lines[0])
  } catch {
    return null
  }
  if (header?.type !== 'session' || header.version !== 4) return null
  if (header.isSeeded === true) return null

  let cut = -1
  for (const [index, line] of lines.slice(1).entries()) {
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event?.type === 'session/end-seed' && event.data?.inherited === true) cut = index
  }
  if (cut < 0) return null

  const kept = lines.slice(cut + 2).map((line, index) => {
    const event = JSON.parse(line)
    return JSON.stringify({ ...event, seq: index })
  })
  return {
    text: [JSON.stringify(header), ...kept].join('\n') + '\n',
    report: { dropped: cut + 1, events: kept.length },
  }
}

/**
 * Every `session*.jsonl.zstd` under a sessions root, with its lock state.
 *
 * @param {string} root - `$DSH_HOME/sessions`.
 * @returns {{ file: string, dir: string, locked: boolean }[]}
 */
export function listStoredLogs(root) {
  const found = []
  let slugs = []
  try {
    slugs = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return found
  }
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue
    const slugDir = path.join(root, slug.name)
    let sessions = []
    try {
      sessions = fs.readdirSync(slugDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const dir = path.join(slugDir, session.name)
      let files = []
      try {
        files = fs.readdirSync(dir)
      } catch {
        continue
      }
      const file = files.find((name) => name.endsWith('.jsonl.zstd'))
      if (file === undefined) continue
      found.push({ file: path.join(dir, file), dir, locked: files.includes('session.lock') })
    }
  }
  return found
}

/**
 * Repair one stored log in place, keeping a `*.bak` next to it.
 *
 * @param {string} file - path to `session.v4.jsonl.zstd`.
 * @param {{ dryRun?: boolean }} [options]
 * @returns {RepairReport | null} null when the log needed no repair.
 */
export function repairStoredLog(file, options = {}) {
  const raw = fs.readFileSync(file)
  let text
  try {
    text = decodeStoredLog(raw)
  } catch {
    return null
  }
  const repaired = repairLogText(text)
  if (repaired === null) return null
  if (options.dryRun === true) return repaired.report
  fs.writeFileSync(`${file}.bak`, raw)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, encodeStoredLog(repaired.text))
  fs.renameSync(tmp, file)
  return repaired.report
}

/**
 * Repair every unlocked stored log under a sessions root.
 *
 * @param {string} root - `$DSH_HOME/sessions`.
 * @param {{ dryRun?: boolean, log?: (message: string) => void }} [options]
 * @returns {{ scanned: number, repaired: number, locked: number }}
 */
export function repairStoredSessions(root, options = {}) {
  const log = options.log ?? (() => {})
  const summary = { scanned: 0, repaired: 0, locked: 0 }
  for (const entry of listStoredLogs(root)) {
    summary.scanned += 1
    if (entry.locked) summary.locked += 1
    // `session.lock` is an empty marker DSH leaves behind, not a reliable
    // "someone is writing" signal — and a corrupt log cannot be open anyway,
    // because opening it fails validation. Repair it and keep the backup.
    let report = null
    try {
      report = repairStoredLog(entry.file, { dryRun: options.dryRun })
    } catch (error) {
      log(`修复失败 ${entry.file}: ${error?.message ?? error}`)
      continue
    }
    if (report === null) continue
    summary.repaired += 1
    log(`已修复 ${path.basename(entry.dir)}：丢弃继承前缀 ${report.dropped} 条，保留 ${report.events} 条`)
  }
  return summary
}
