'use strict';
// Label printers reached without the system print dialog (main process side).
//
// Studio draws a label in PRINTER DOTS (renderer/labels). Here that image is
// turned into a 1-bit bitmap and, for a Brother QL on the network, into the
// printer's own raster language sent straight to its raw port (TCP 9100). No
// driver is needed for that path. The Marklife P15 is Bluetooth LE and is
// driven from the renderer (renderer/labels/p15.js, Web Bluetooth); it only
// takes the bitmap from here.
//
//   toBitmap(nativeImage, { rotate })  → { width, height, bytesPerRow, data } (1 = black, MSB first)
//   discoverNetworkPrinters(ms)        → [{ id, name, model, host, port, ql }] (mDNS)
//   qlHeadDots(model)                  → 720 or 1296 (wide models)
//   printQl({ host, port, model, image, roll }) → { ok, media, scaled } | { ok:false, reason, needRoll? }
//
// The QL raster command set is Brother's ("QL-800/810W/820NWB Raster Command
// Reference"): invalidate, initialise, status request, raster mode, print
// information, auto cut, margins, uncompressed raster lines (g 00 nn), print.
// Each raster line is MIRRORED and shifted by the media's right margin, as the
// printer feeds the label face down: the media table below is the printable
// width and right margin, in dots, of each Brother DK roll.

const net = require('net');

// ── Bitmap ────────────────────────────────────────────────────────────────────
// A nativeImage (BGRA) → 1-bit rows, MSB first, 1 = a black dot. The labels are
// black on white, so a plain threshold keeps every QR module sharp (no dither).
// `rotate: true` turns the label a quarter turn clockwise (its height becomes
// the line width), for a printer whose head runs along the label's short side.
function toBitmap(img, { rotate = false, threshold = 160 } = {}) {
  const { width: w, height: h } = img.getSize();
  const px = img.toBitmap();   // BGRA, w * h * 4
  const dark = (x, y) => {
    const i = (y * w + x) * 4;
    const a = px[i + 3] / 255;
    const lum = (0.114 * px[i] + 0.587 * px[i + 1] + 0.299 * px[i + 2]) * a + 255 * (1 - a);
    return lum < threshold;
  };
  const W = rotate ? h : w, H = rotate ? w : h;
  const bytesPerRow = Math.ceil(W / 8);
  const data = new Uint8Array(bytesPerRow * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Clockwise: the output's top row is the label's left column, read bottom to top.
      const on = rotate ? dark(y, h - 1 - x) : dark(x, y);
      if (on) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width: W, height: H, bytesPerRow, data };
}

const bit = (bm, x, y) => x >= 0 && y >= 0 && x < bm.width && y < bm.height
  && (bm.data[y * bm.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) !== 0;

// ── Discovery (mDNS) ─────────────────────────────────────────────────────────
// Network label printers announce `_pdl-datastream._tcp` (the raw port), and
// usually `_ipp._tcp` / `_printer._tcp` too; the TXT record `ty` (or `product`,
// "(Brother QL-820NWB)") names the model. One entry per printer (by address).
async function discoverNetworkPrinters(ms = 2500) {
  let Bonjour;
  try { ({ Bonjour } = require('bonjour-service')); } catch (_) { return []; }
  const bj = new Bonjour();
  const byHost = new Map();
  const browsers = [];
  const add = (svc, type) => {
    if (!svc) return;
    const txt = svc.txt || {};
    const ipv4 = (svc.addresses || []).find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
    const host = ipv4 || svc.host;
    if (!host) return;
    const model = String(txt.ty || String(txt.product || '').replace(/^\(|\)$/g, '') || svc.name || '').trim();
    const prev = byHost.get(host) || {};
    byHost.set(host, {
      id: `net:${host}`,
      name: prev.name || svc.name || model,
      model: prev.model || model,
      host,
      // The raw port is the one announced as pdl-datastream; 9100 otherwise.
      port: type === 'pdl-datastream' ? (svc.port || 9100) : (prev.port || 9100),
    });
  };
  await new Promise((resolve) => {
    for (const type of ['pdl-datastream', 'ipp', 'printer']) {
      try {
        const b = bj.find({ type }, svc => add(svc, type));
        b.on?.('error', () => {});
        browsers.push(b);
      } catch (_) {}
    }
    setTimeout(resolve, ms);
  });
  browsers.forEach(b => { try { b.stop(); } catch (_) {} });
  try { bj.destroy(); } catch (_) {}
  return [...byHost.values()].map(p => ({ ...p, ql: /\bQL-?\d/i.test(p.model) }));
}

// ── Brother QL raster ────────────────────────────────────────────────────────
// Wide-format models (QL-1050/1060N/1100/1110NWB) have a 1296-dot head and a
// 44-dot extra right offset; every other QL a 720-dot head.
const qlWide = model => /QL-?10\d\d/i.test(String(model || ''));
const qlHeadDots = model => (qlWide(model) ? 1296 : 720);

// Media by width × length in mm (length 0 = continuous roll): printable dots
// across the head and the right margin in dots.
const QL_MEDIA = {
  '12x0': [106, 29], '29x0': [306, 6], '38x0': [413, 12], '50x0': [554, 12], '54x0': [590, 0], '62x0': [696, 12], '102x0': [1164, 12],
  '17x54': [165, 0], '17x87': [165, 0], '23x23': [202, 42], '29x42': [306, 6], '29x90': [306, 6], '38x90': [413, 12],
  '39x48': [425, 6], '52x29': [578, 0], '62x29': [696, 12], '62x100': [696, 12], '102x51': [1164, 12], '102x152': [1164, 12],
};

// Ask the printer which roll it holds: ESC i S → a 32-byte status. Byte 10 is
// the media width (mm), 11 the type (0x0A / 0x4A continuous, 0x0B / 0x4B die-cut),
// 17 the length (mm), 8-9 the error flags.
function qlStatus(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let buf = Buffer.alloc(0), done = false;
    const finish = (v) => { if (done) return; done = true; try { sock.destroy(); } catch (_) {} resolve(v); };
    sock.setTimeout(timeoutMs, () => finish(null));
    sock.on('error', () => finish(null));
    sock.on('connect', () => sock.write(Buffer.concat([Buffer.alloc(200), Buffer.from([0x1b, 0x40, 0x1b, 0x69, 0x53])])));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const at = buf.indexOf(0x80);
      if (at >= 0 && buf.length - at >= 32) {
        const s = buf.subarray(at, at + 32);
        finish({ width: s[10], type: s[11], length: s[17], err1: s[8], err2: s[9] });
      }
    });
  });
}

// The job for one label: `bitmap` is the label with its width ACROSS the head
// (printQl turns it when that is what fits the roll). It is
// centred in the media's printable width, mirrored, and sent line by line.
function qlJob(bitmap, { model, media }) {
  const head = qlHeadDots(model), lineBytes = head / 8;
  const key = `${media.width}x${media.dieCut ? media.length : 0}`;
  const [printable, margin0] = QL_MEDIA[key] || QL_MEDIA[`${media.width}x0`] || [Math.min(head, bitmap.width), 0];
  const rightMargin = margin0 + (qlWide(model) ? 44 : 0);
  const left = Math.floor((printable - bitmap.width) / 2);   // the label, centred in the printable width
  const rows = bitmap.height;
  const out = [];
  out.push(Buffer.alloc(200));                                  // invalidate
  out.push(Buffer.from([0x1b, 0x40]));                          // initialise
  out.push(Buffer.from([0x1b, 0x69, 0x61, 0x01]));              // raster mode
  const dieCut = !!media.dieCut;
  out.push(Buffer.from([0x1b, 0x69, 0x7a,                      // print information
    0x80 | 0x02 | 0x04 | (dieCut ? 0x08 : 0), dieCut ? 0x0b : 0x0a, media.width & 0xff, dieCut ? media.length & 0xff : 0,
    rows & 0xff, (rows >> 8) & 0xff, (rows >> 16) & 0xff, (rows >> 24) & 0xff, 0x00, 0x00]));
  out.push(Buffer.from([0x1b, 0x69, 0x4d, 0x40]));              // auto cut on
  out.push(Buffer.from([0x1b, 0x69, 0x41, 0x01]));              // cut every label
  out.push(Buffer.from([0x1b, 0x69, 0x4b, 0x08]));              // cut at the end
  const feed = dieCut ? 0 : 35;
  out.push(Buffer.from([0x1b, 0x69, 0x64, feed & 0xff, (feed >> 8) & 0xff]));   // margin
  out.push(Buffer.from([0x4d, 0x00]));                          // no compression
  for (let y = 0; y < rows; y++) {
    const line = Buffer.alloc(lineBytes);
    for (let p = 0; p < printable; p++) {
      if (!bit(bitmap, p - left, y)) continue;
      // Mirrored: printable column p lands at head column rightMargin + printable - 1 - p.
      const col = rightMargin + printable - 1 - p;
      if (col >= 0 && col < head) line[col >> 3] |= 0x80 >> (col & 7);
    }
    out.push(Buffer.from([0x67, 0x00, lineBytes]), line);
  }
  out.push(Buffer.from([0x1a]));                                // print, then feed and cut
  return Buffer.concat(out);
}

// `image`: the label as a nativeImage at 300 dpi, its width as laid out.
// `roll`: the roll the user said is loaded ("62x0" continuous, "29x90" die-cut…,
// a QL_MEDIA key); without one, the printer's status is asked (the QL-580N on
// the network answers none: then the job is refused with needRoll rather than
// sent for a roll it may not hold, which stops the printer on an error light).
// The label goes in the orientation that keeps it largest on that roll, and is
// scaled down when it is wider than the printable width (a 40 × 30 label on a
// 29 mm roll) or longer than a die-cut label.
async function printQl({ host, port = 9100, model, image, roll }) {
  if (!host || !image) return { ok: false, reason: 'bad request' };
  let media = null;
  if (typeof roll === 'string' && QL_MEDIA[roll]) {
    const [w, l] = roll.split('x').map(Number);
    media = { width: w, length: l, dieCut: l > 0 };
  } else {
    const st = await qlStatus(host, port);
    if (st && st.width) {
      if (st.err1 || st.err2) return { ok: false, reason: `printer error ${st.err1.toString(16)}/${st.err2.toString(16)}` };
      media = { width: st.width, length: st.length, dieCut: st.type === 0x0b || st.type === 0x4b };
    }
  }
  if (!media) return { ok: false, reason: 'roll unknown', needRoll: true };
  const key = `${media.width}x${media.dieCut ? media.length : 0}`;
  const printable = (QL_MEDIA[key] || QL_MEDIA[`${media.width}x0`] || [qlHeadDots(model)])[0];
  const maxLen = media.dieCut ? Math.floor(media.length * 300 / 25.4) - 20 : Infinity;
  const { width: w, height: h } = image.getSize();
  const fit = (across, along) => Math.min(1, printable / across, maxLen / along);
  const rotate = fit(h, w) > fit(w, h);
  const k = rotate ? fit(h, w) : fit(w, h);
  const img = k < 1 ? image.resize({ width: Math.floor(w * k), height: Math.floor(h * k), quality: 'best' }) : image;
  const bitmap = toBitmap(img, { rotate });
  const job = qlJob(bitmap, { model, media });
  return await new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { sock.destroy(); } catch (_) {} resolve(v); };
    sock.setTimeout(15000, () => finish({ ok: false, reason: 'timeout' }));
    sock.on('error', e => finish({ ok: false, reason: e.message }));
    // Written, then left open a moment: closing at once can cut the tail of the job.
    sock.on('connect', () => sock.write(job, () => setTimeout(() => finish({ ok: true, media, scaled: k < 1 }), 1500)));
  });
}

module.exports = { toBitmap, discoverNetworkPrinters, qlHeadDots, qlJob, printQl, QL_MEDIA };
