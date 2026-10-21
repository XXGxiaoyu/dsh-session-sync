/**
 * Offline helpers for the JSONL session logs DSH keeps in `$DSH_HOME/sessions`.
 *
 * `zlib.zstdDecompressSync` only decodes the *first* Zstandard frame of a file,
 * and DSH appends one frame per write batch, so reading a stored log needs a
 * frame walker first. Writing back emits a single frame, which every decoder
 * (including DSH's streaming reader) accepts.
 */
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

const MAGIC = 0xfd2fb528

/**
 * Split a buffer into its concatenated Zstandard frames.
 *
 * @param {Buffer} buffer - raw `*.jsonl.zstd` content.
 * @returns {Buffer[]} one slice per frame, in file order.
 */
export function splitZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset + 4 <= buffer.length) {
    const start = offset
    if (buffer.readUInt32LE(offset) !== MAGIC) {
      // A torn tail (crash mid-write) is the only legitimate reason to stop;
      // keep what was decoded so far instead of refusing the whole log.
      break
    }
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const fcsFlag = descriptor >> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictFlag = descriptor & 0x03
    const dictSize = dictFlag === 0 ? 0 : dictFlag === 1 ? 1 : dictFlag === 2 ? 2 : 4
    if (singleSegment === false) offset += 1
    offset += dictSize
    offset += fcsFlag === 0 ? (singleSegment ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
    for (;;) {
      if (offset + 3 > buffer.length) return frames
      const header = buffer.readUIntLE(offset, 3)
      offset += 3
      const last = (header & 0x01) !== 0
      const type = (header >> 1) & 0x03
      const size = header >> 3
      if (type === 0) offset += size
      else if (type === 1) offset += 1
      else if (type === 2) offset += size
      else throw new Error('zstd frame uses a reserved block type')
      if (offset > buffer.length) return frames
      if (last) break
    }
    if (checksum) offset += 4
    frames.push(buffer.subarray(start, Math.min(offset, buffer.length)))
    if (offset >= buffer.length) break
  }
  return frames
}

/**
 * Decode a whole stored log (all frames) into its JSONL text.
 *
 * @param {Buffer} buffer - raw `*.jsonl.zstd` content.
 * @returns {string} newline-delimited JSON text without a trailing newline requirement.
 */
export function decodeStoredLog(buffer) {
  const parts = splitZstdFrames(buffer).map((frame) => zstdDecompressSync(frame))
  return Buffer.concat(parts).toString('utf8')
}

/**
 * Encode JSONL text as a single Zstandard frame.
 *
 * @param {string} text - newline-delimited JSON.
 * @returns {Buffer} compressed bytes ready to write as `session.v4.jsonl.zstd`.
 */
export function encodeStoredLog(text) {
  return zstdCompressSync(Buffer.from(text, 'utf8'))
}
