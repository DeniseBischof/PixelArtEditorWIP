/*!
 * Minimal, dependency-free ZIP writer (STORE / no compression).
 * Produces standards-compliant .zip archives that any tool can open.
 *
 * Exposes a small JSZip-compatible surface so existing call sites keep working:
 *   const zip = new JSZip();
 *   zip.file('a.png', base64String, { base64: true });
 *   zip.file('b.txt', 'hello');            // utf-8 string
 *   const blob = await zip.generateAsync({ type: 'blob' });
 *
 * The previous jszip.min.js was a stub that only concatenated file names,
 * so every archive it created was corrupt. This writes real ZIP records.
 */
(() => {
  'use strict';

  // --- CRC-32 (IEEE 802.3), table built once ---
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // --- data coercion -------------------------------------------------------
  const utf8 = new TextEncoder();

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function toBytes(data, opts) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (opts && opts.base64) return base64ToBytes(String(data));
    return utf8.encode(String(data));
  }

  // --- little-endian byte pushers ------------------------------------------
  function pushU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
  function pushU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

  class MiniZip {
    constructor() { this._entries = []; }

    file(name, data, opts) {
      this._entries.push({ name, bytes: toBytes(data, opts) });
      return this;
    }

    _build() {
      const FLAGS = 0x0800;       // bit 11 = filename is UTF-8
      const local = [];           // local file headers + data
      const central = [];         // central directory
      const meta = [];

      for (const e of this._entries) {
        const nameBytes = utf8.encode(e.name);
        const crc = crc32(e.bytes);
        const size = e.bytes.length;
        const offset = local.length;

        // local file header (0x04034b50)
        pushU32(local, 0x04034b50);
        pushU16(local, 20);        // version needed
        pushU16(local, FLAGS);
        pushU16(local, 0);         // method: store
        pushU16(local, 0);         // mod time
        pushU16(local, 0x0021);    // mod date (1980-01-01, valid non-zero)
        pushU32(local, crc);
        pushU32(local, size);      // compressed size == size (store)
        pushU32(local, size);      // uncompressed size
        pushU16(local, nameBytes.length);
        pushU16(local, 0);         // extra length
        for (const b of nameBytes) local.push(b);
        for (const b of e.bytes) local.push(b);

        meta.push({ nameBytes, crc, size, offset });
      }

      for (const m of meta) {
        // central directory header (0x02014b50)
        pushU32(central, 0x02014b50);
        pushU16(central, 20);      // version made by
        pushU16(central, 20);      // version needed
        pushU16(central, 0x0800);
        pushU16(central, 0);       // method
        pushU16(central, 0);       // mod time
        pushU16(central, 0x0021);  // mod date
        pushU32(central, m.crc);
        pushU32(central, m.size);
        pushU32(central, m.size);
        pushU16(central, m.nameBytes.length);
        pushU16(central, 0);       // extra
        pushU16(central, 0);       // comment
        pushU16(central, 0);       // disk number start
        pushU16(central, 0);       // internal attrs
        pushU32(central, 0);       // external attrs
        pushU32(central, m.offset);
        for (const b of m.nameBytes) central.push(b);
      }

      const end = [];
      pushU32(end, 0x06054b50);    // end of central directory
      pushU16(end, 0);             // disk number
      pushU16(end, 0);             // disk with central dir
      pushU16(end, meta.length);   // entries on this disk
      pushU16(end, meta.length);   // total entries
      pushU32(end, central.length);
      pushU32(end, local.length);  // offset of central dir
      pushU16(end, 0);             // comment length

      return new Uint8Array([...local, ...central, ...end]);
    }

    async generateAsync(opts) {
      const bytes = this._build();
      const type = (opts && opts.type) || 'blob';
      if (type === 'uint8array') return bytes;
      return new Blob([bytes], { type: 'application/zip' });
    }
  }

  window.JSZip = MiniZip;
})();
