'use strict';
// Bambu Lab filament chips — read-only decoding.
//
// A Bambu Lab spool carries one MIFARE Classic 1K chip per flange. Its sectors
// are locked with key A values derived from the chip's 4-byte UID (HKDF-SHA256,
// public salt, info "RFID-A\0", 16 keys of 6 bytes, one per sector). The layout
// of the data blocks below follows the Bambu Research Group's RFID-Tag-Guide
// (BambuLabRfid.md / parse.py). Studio only READS these chips: nothing is ever
// written to them, and their RSA signature (blocks 40-63) is not checked.
//
//   bambuKeysA(uidHex)          → 16 key-A hex strings (sector 0 … 15)
//   BAMBU_SECTORS               → the sectors read (0-4: every field decoded below)
//   parseBambuBlocks(blocksHex) → the decoded fields, or null when it is not one

const crypto = require('crypto');

const SALT = Buffer.from('9a759cf2c4f7caff222cb9769b41bc96', 'hex');
const INFO = Buffer.from('RFID-A\0', 'latin1');
const BAMBU_SECTORS = [0, 1, 2, 3, 4];

function bambuKeysA(uidHex) {
  const uid = Buffer.from(String(uidHex || ''), 'hex');
  if (uid.length !== 4) return null;
  const okm = Buffer.from(crypto.hkdfSync('sha256', uid, SALT, INFO, 16 * 6));
  return Array.from({ length: 16 }, (_, i) => okm.subarray(i * 6, i * 6 + 6).toString('hex'));
}

const str = b => b.toString('latin1').replace(/\0/g, ' ').trim();
const u16 = (b, o) => b.readUInt16LE(o);
const f32 = (b, o) => b.readFloatLE(o);
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** blocksHex: { [blockNumber]: 32 hex chars } for the data blocks of BAMBU_SECTORS. */
function parseBambuBlocks(blocksHex) {
  const blk = n => {
    const h = blocksHex?.[n];
    return typeof h === 'string' && h.length === 32 ? Buffer.from(h, 'hex') : null;
  };
  const b1 = blk(1), b2 = blk(2), b4 = blk(4), b5 = blk(5), b6 = blk(6);
  if (!b1 || !b2 || !b4 || !b5 || !b6) return null;
  const type = str(b2);
  // A chip that opened with these keys but carries no filament type is not a
  // filament chip: say nothing rather than show empty values.
  if (!/^[\x20-\x7e]{2,16}$/.test(type)) return null;
  const b8 = blk(8), b9 = blk(9), b10 = blk(10), b12 = blk(12), b14 = blk(14), b16 = blk(16);
  const colors = ['#' + b5.subarray(0, 4).toString('hex').toUpperCase()];
  if (b16 && u16(b16, 0) === 2 && u16(b16, 2) === 2) {
    colors.push('#' + Buffer.from(b16.subarray(4, 8)).reverse().toString('hex').toUpperCase());
  }
  const diameter = f32(b5, 8);
  return {
    vendor: 'bambu',
    variantId: str(b1.subarray(0, 8)),       // e.g. "A00-K0"
    materialId: str(b1.subarray(8, 16)),     // e.g. "GFA00"
    type,                                    // e.g. "PLA"
    detailedType: str(b4),                   // e.g. "PLA Basic"
    colors,                                  // "#RRGGBBAA", one or two
    weightG: u16(b5, 4),
    diameterMm: Number.isFinite(diameter) ? round(diameter, 2) : null,
    dryTempC: u16(b6, 0),
    dryTimeH: u16(b6, 2),
    bedTempC: u16(b6, 6),
    hotendMaxC: u16(b6, 8),
    hotendMinC: u16(b6, 10),
    nozzleMm: b8 ? round(f32(b8, 12), 1) : null,
    trayUid: b9 ? b9.toString('hex').toUpperCase() : null,
    widthMm: b10 ? u16(b10, 4) / 100 : null,
    lengthM: b14 ? u16(b14, 4) : null,
    productionDate: b12 ? str(b12) : null,   // "YYYY_MM_DD_HH_MM"
  };
}

module.exports = { bambuKeysA, parseBambuBlocks, BAMBU_SECTORS };
