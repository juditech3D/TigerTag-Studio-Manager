'use strict';
// TigerScale as a TigerPOD — the readers of a scale on the network, offered to
// the app exactly like the USB readers of services/nfc-process.js.
//
// A TigerScale (firmware with the TigerPOD tool) lends its two PN532 readers
// while that tool is open on its screen. It speaks the same messages as the
// reader process, over a WebSocket on the scale:
//
//   ws://<scale>/pod?c=<lan_access_code>
//   scale → app  {type:'reader-connected', reader:'1'}
//                {type:'card', reader, uid, atr, rawPagesHex}
//                {type:'card-removed', reader}
//                {type:'read-result'|'write-result', id, ok, …}
//   app → scale  {type:'read-now', reader, id, start?, length?}
//                {type:'write-now', reader, id, pages, verify?}
//
// This module turns those into the reader-process messages main.js already
// handles (`_onNfcMessage`), with a reader name of its own per scale and
// reader ("TigerScale Atelier #1"), so every RFID feature works on a scale as
// it does on a TigerPOD. The request ids the app uses are floats; the scale
// gets small integers and the answer is mapped back.
//
// Which scales: the ones of the signed-in account that publish a LAN address
// and access code (`lan_url`, `lan_access_code` on users/{uid}/scales/{mac}),
// passed in by the renderer through setScales(). The scale refuses the
// handshake unless its TigerPOD tool is open, so each one is simply retried
// every RETRY_MS; nothing is logged per retry. The code is never logged.

const RETRY_MS = 5000;
const REQUEST_TIMEOUT_MS = 8000;
// Only an address on the local network: a scale's code is not sent anywhere else.
const LOCAL = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|[^.]+\.local$)/i;

class ScalePods {
  /** @param {(msg: object) => void} emit — receives reader-process messages */
  constructor(emit) {
    this._emit = emit;
    this._scales = new Map();   // mac → { mac, name, host, code, ws, retry, readers:Set<id>, closed }
    this._owner = new Map();    // full reader name → { mac, reader }
    this._pending = new Map();  // scale request id → { reqId, type }
    this._seq = 0;
  }

  _readerName(scale, reader) { return `TigerScale ${scale.name} #${reader}`; }

  /** The scales to reach: [{ mac, name, url, code }] — any other is dropped. */
  setScales(list) {
    const want = new Map();
    for (const s of Array.isArray(list) ? list : []) {
      let host = null;
      try { host = new URL(String(s.url)).hostname; } catch { /* not a URL */ }
      if (!s?.mac || !host || !LOCAL.test(host) || typeof s.code !== 'string' || !s.code) continue;
      want.set(String(s.mac), { mac: String(s.mac), name: String(s.name || 'Tiger Scale').slice(0, 40), host, code: s.code });
    }
    for (const [mac, cur] of this._scales) {
      const next = want.get(mac);
      if (!next || next.host !== cur.host || next.code !== cur.code || next.name !== cur.name) this._drop(mac);
    }
    for (const [mac, s] of want) if (!this._scales.has(mac)) this._open({ ...s, ws: null, retry: null, readers: new Set(), closed: false });
  }

  /** True when this reader name is one of a scale's. */
  owns(readerName) { return this._owner.has(readerName); }

  /** True when at least one scale has its readers on offer right now. */
  hasReaders() { return this._owner.size > 0; }

  /** A read-now / write-now for one of the scales' readers. */
  send(msg) {
    const own = this._owner.get(msg.readerName);
    const scale = own && this._scales.get(own.mac);
    const resType = msg.type === 'write-now' ? 'write-result' : 'read-result';
    if (!scale?.ws || scale.ws.readyState !== 1) {
      this._emit({ type: resType, reqId: msg.reqId, ok: false, error: 'Reader not connected' });
      return;
    }
    const id = ++this._seq;
    const timer = setTimeout(() => {
      if (!this._pending.delete(id)) return;
      this._emit({ type: resType, reqId: msg.reqId, ok: false, error: 'Scale did not answer' });
    }, REQUEST_TIMEOUT_MS);
    this._pending.set(id, { reqId: msg.reqId, timer });
    const out = { type: msg.type, reader: own.reader, id };
    if (msg.type === 'read-now') {
      if (msg.start != null) out.start = msg.start;
      if (msg.length != null) out.length = msg.length;
    } else {
      out.pages = msg.pages;
      if (msg.verify) out.verify = true;
    }
    scale.ws.send(JSON.stringify(out));
  }

  _open(scale) {
    this._scales.set(scale.mac, scale);
    let ws;
    try {
      ws = new WebSocket(`ws://${scale.host}/pod?c=${encodeURIComponent(scale.code)}`);
    } catch {
      this._retry(scale);
      return;
    }
    scale.ws = ws;
    ws.onopen = () => console.log(`[NFC] TigerScale ${scale.name}: TigerPOD connected`);
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      this._onScaleMessage(scale, m);
    };
    ws.onerror = () => { /* the close that follows does the work */ };
    ws.onclose = () => {
      if (scale.ws !== ws) return;
      scale.ws = null;
      this._readersGone(scale);
      if (!scale.closed) this._retry(scale);
    };
  }

  _retry(scale) {
    clearTimeout(scale.retry);
    scale.retry = setTimeout(() => { if (!scale.closed && this._scales.get(scale.mac) === scale) this._open(scale); }, RETRY_MS);
  }

  _drop(mac) {
    const scale = this._scales.get(mac);
    if (!scale) return;
    scale.closed = true;
    clearTimeout(scale.retry);
    try { scale.ws?.close(); } catch { /* already closed */ }
    scale.ws = null;
    this._readersGone(scale);
    this._scales.delete(mac);
  }

  _readersGone(scale) {
    for (const reader of scale.readers) {
      const name = this._readerName(scale, reader);
      this._owner.delete(name);
      this._emit({ type: 'reader-disconnected', name });
    }
    scale.readers.clear();
  }

  _onScaleMessage(scale, m) {
    const reader = typeof m.reader === 'string' && /^[12]$/.test(m.reader) ? m.reader : null;
    switch (m.type) {
      case 'reader-connected': {
        if (!reader || scale.readers.has(reader)) return;
        scale.readers.add(reader);
        const name = this._readerName(scale, reader);
        this._owner.set(name, { mac: scale.mac, reader });
        this._emit({ type: 'reader-connected', name });
        return;
      }
      case 'card':
        if (!reader || !scale.readers.has(reader) || typeof m.uid !== 'string') return;
        this._emit({ type: 'card', readerName: this._readerName(scale, reader), uid: m.uid,
          rawPagesHex: typeof m.rawPagesHex === 'string' ? m.rawPagesHex : null, atr: m.atr || null });
        return;
      case 'card-removed':
        if (!reader || !scale.readers.has(reader)) return;
        this._emit({ type: 'card-removed', readerName: this._readerName(scale, reader) });
        return;
      case 'read-result':
      case 'write-result': {
        const p = this._pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer);
        this._pending.delete(m.id);
        this._emit({ ...m, id: undefined, reqId: p.reqId });
        return;
      }
    }
  }
}

module.exports = { ScalePods };
