/**
 * Reads the directory of a ZIP file (the end-of-central-directory record and the central directory) without
 * expanding any entry (BR41.2). The workbook limits are decided from these declared numbers, so a hostile
 * file (a zip bomb, an absurd number of parts) is refused before the spreadsheet library inflates a byte.
 * Only the facts the checks need are read: the entry names, their declared uncompressed sizes and the count.
 */

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_RECORD_BYTES = 22;
/** The comment after the end record may be up to 65535 bytes, so the record starts at most that far from the end. */
const MAX_COMMENT_BYTES = 0xffff;
/** A ZIP64 marker: the real number is in a record this reader does not follow; such a file is too large for a workbook. */
const ZIP64_MARKER = 0xffffffff;
const ZIP64_COUNT_MARKER = 0xffff;
/** A workbook has a few dozen parts; far more than this is not a workbook. */
const MAX_ENTRIES = 10000;

export type ZipEntry = Readonly<{ name: string; uncompressedBytes: number }>;

export type ZipDirectory =
  | Readonly<{
      ok: true;
      entries: readonly ZipEntry[];
      /** The sum of the declared uncompressed sizes. */
      uncompressedBytes: number;
    }>
  | Readonly<{ ok: false; reason: "not_a_zip" | "too_large" }>;

/** Reads the directory of a ZIP file held in memory. A file that is not a well-formed ZIP gives `not_a_zip`. */
export function readZipDirectory(bytes: Uint8Array): ZipDirectory {
  if (bytes.length < END_RECORD_BYTES) {
    return { ok: false, reason: "not_a_zip" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== LOCAL_SIGNATURE) {
    return { ok: false, reason: "not_a_zip" };
  }

  let endOffset = -1;
  const lowest = Math.max(0, bytes.length - END_RECORD_BYTES - MAX_COMMENT_BYTES);
  for (let offset = bytes.length - END_RECORD_BYTES; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_SIGNATURE) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    return { ok: false, reason: "not_a_zip" };
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (
    entryCount === ZIP64_COUNT_MARKER ||
    directorySize === ZIP64_MARKER ||
    directoryOffset === ZIP64_MARKER
  ) {
    return { ok: false, reason: "too_large" };
  }
  if (entryCount > MAX_ENTRIES || directoryOffset + directorySize > endOffset) {
    return { ok: false, reason: "not_a_zip" };
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries: ZipEntry[] = [];
  let total = 0;
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      return { ok: false, reason: "not_a_zip" };
    }
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > endOffset) {
      return { ok: false, reason: "not_a_zip" };
    }
    if (uncompressed === ZIP64_MARKER) {
      return { ok: false, reason: "too_large" };
    }
    total += uncompressed;
    entries.push({
      name: decoder.decode(bytes.subarray(offset + 46, nameEnd)),
      uncompressedBytes: uncompressed,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  return { ok: true, entries, uncompressedBytes: total };
}
