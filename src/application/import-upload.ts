/**
 * The uploaded workbook as it travels from the upload action to the import adapter, in the `workbook` field of
 * the `import.preview` payload (BR41.2, BR42.1). It holds the file's bytes and its name as a label: never a
 * path. The facade builds an idempotency fingerprint by writing the payload as JSON, so the value writes
 * itself as the name and the size; the bytes are never copied into a string.
 */
export class WorkbookUpload {
  readonly fileName: string;
  readonly bytes: Uint8Array;

  constructor(fileName: string, bytes: Uint8Array) {
    this.fileName = fileName;
    this.bytes = bytes;
  }

  toJSON(): { fileName: string; size: number } {
    return { fileName: this.fileName, size: this.bytes.byteLength };
  }
}
