# `main.js` — code map

`main.js` is the **Electron main process** (~3,784 lines): app/window lifecycle,
the static file server, NFC/RFID, TD1S sensor, auto-updater, and the per-brand
printer **discovery probes + MQTT/HTTP/camera bridges** (the renderer can't open
raw TLS/UDP/MQTT sockets, so every printer transport lives here behind IPC).

**Anchor-first navigation**: line numbers drift, anchor names don't. Always
`grep -n "anchorName"` (or `grep -n "ipcMain.*'channel'"`) and trust the grep
over the L-number here — the L-ranges are for orientation only.

Keep in sync: `npm run codemap:check` (pre-commit hook) validates that each
section's function anchors fall inside its declared range.

> **IPC channels** are listed for orientation but are NOT range-checked (they
> contain `:` / `-`, so the checker skips them); only the backticked **function
> names** in the Anchors column are verified.

---

## Bird's-eye structure

```
L1-519       App bootstrap — logging, single-instance, static HTTP server, splash, main window
L520-1217    NFC / RFID — reader lifecycle, chip read/write/burn, cloud-encode
             (USB scale HID transport block inlined at L626-716)
L1218-1459   TD1S color sensor — serial watcher, parse, IPC replay
L1460-1748   Auto-updater + migration gate
L1749-2011   Google-auth loopback, shell open, detached camera-wall window
L2012-2733   Printer discovery probes (FlashForge / Creality / Bambu / Elegoo / Snapmaker)
L2735-2890   Infra IPC — image cache, LAN subnets, mDNS, app info, TigerTag DB
L2891-3027   Elegoo MQTT bridge + timelapse download + ffmpeg detection
L3028-3281   Bambu Lab — MQTT (8883) + JPEG-TCP (6000) & RTSP (322) cameras
L5908-6232   Anycubic LAN — MQTT (9883) + slicer-config provisioning + FLV camera (18088)
L6233-6647   Anycubic cloud — signed REST + shared cloud-MQTT (publish + subscribe)
L4480-4540   App lifecycle (whenReady, window-all-closed, activate)
```

---

## App bootstrap, static server, splash & main window (L180-495)

| L | What | Anchors |
|---|---|---|
| 116-235 | Minimal static file server so `location.protocol === 'http:'` (Firebase Auth needs it) | `startRendererServer` |
| 236-387 | Splash window (`renderer/splash/`: the ecosystem scene, a loading line in the saved language, a bar fed by the real startup steps, a fade into the main window) shown before the main window paints | `createSplash`, `splashStep`, `_splashLang`, `revealMainWindow` |
| 388-412 | UID hex→decimal + TigerTag SDK payload builder | `normalizeUid`, `_sdkPayload` |
| 413-519 | `BrowserWindow` creation, preload wiring, CSP, devtools | `createWindow` |

## NFC / RFID reader + chip write (L640-1950)

| L | What | Anchors / IPC |
|---|---|---|
| 520-705 | Reader connect/disconnect lifecycle, card-present events, auto-read | `_onNfcMessage`, `initNFC` |
| 706-805 | USB scale (Dymo M-series) — HID open + hot-plug poll, frame decode, `usb-scale-update` / `usb-scale-data` events, `usb-scale:state` IPC | `_scaleDecode`, `_tryOpenScale`, `initUsbScale` |
| 806-1228 | IPC: `rfid:read-now` / `rfid:write-now` / `rfid:repair` (restore from backup) / `rfid:format` (reinitialize via `TigerTag.asInit`) / `rfid:erase` (blank NDEF) / `rfid:write-ndef` + `rfid:ndef-size` + `rfid:ndef-capacity` (link, Wi-Fi, contact… via services/ndef.js; chip room from the capability container, `_ndefCapacity`) / `rfid:encode-cloud` / `rfid:burn-one` / `rfid:refresh-api` / `rfid:lookup-product`; surgical page diff before write | `_pagesFromBytes`, `_pagesToWrite` |
| 1372-1424 | IPC `catalog:fetch-all` — pages the WHOLE product catalogue (`product/get/all`, `per_page` 1000, follows `nextPage`) so the renderer can cache and search it offline | `XANO_PRODUCT_ALL_URL` |

## TD1S color sensor (L1646-2028)

| L | What | Anchors / IPC |
|---|---|---|
| 1596-1904 | Serial-port watcher, TD/color line parse, state replayed to renderer on reload; IPC `td1s:need` / `td1s:release` | `initTD1S` |

## Auto-updater + migration gate (L2259-2583)

| L | What | Anchors / IPC |
|---|---|---|
| 2135-2157 | Auto-update on/off preference (on disk) | `readAutoUpdatePref`, `writeAutoUpdatePref` |
| 2158-2273 | Updater event wiring; IPC: `migration:set-in-flight`, `install-update`, `update:set-auto` | `wireUpdaterEvents`, `initUpdater` |

## Google auth loopback, shell, detached cam window (L1769-2031)

| L | What | IPC |
|---|---|---|
| 1645-1860 | Google OAuth loopback sign-in (`auth:google-loopback`); `shell:open-external` | — |
| 2051-2097 | Detached camera-wall `BrowserWindow` (`cam:open-detached`); `update:check-now` | — |

## Local MCP server — prefs, renderer relay, IPC (L1976-2553)

| L | What | IPC |
|---|---|---|
| 1852-2038 | MCP server for AI assistants: `<userData>/mcp.json` prefs (enabledFor [uid] / writeFor [uid] — write tools listed only for those / port 5795 / token; server follows the signed-in account via `mcp:set-account`), stdio bridge copied to `<userData>/mcp/`, `tools/call` relayed to the renderer, started by `initMcp()` at boot. Protocol: `services/mcpServer.js` | `mcp:get-config`, `mcp:set-account`, `mcp:set-enabled`, `mcp:set-write`, `mcp:new-token`, `mcp:register-tools`, `mcp:call` / `mcp:result`, `mcp:hosted-grants` (Hub hosted-connector grants list / revoke, CORS-exempt) |

## Printer discovery probes (L2677-3643)

| L | What | Anchors / IPC |
|---|---|---|
| 2553-2689 | FlashForge — HTTP POST bridge (`ffg:http-post`), UDP multicast (`ffg:multicast-discover`) | — |
| 2690-2773 | FlashForge — UDP identity probe port 19000 (`ffg:udp-probe`, returns model+serial credential-free), TCP M115 probe (`ffg:tcp-probe`) | `_ffgParseUdpIdentity` |
| 2774-2858 | Creality — TCP 9999 open-check (`cre:tcp-probe`) | — |
| 2859-3058 | Bambu Lab — SSDP multicast (`bambu:ssdp-discover`) + TLS cert sniff (`bambu:tls-probe`) + print thumbnail via FTPS | `_parseBambuSsdp` |
| 3059-3173 | Elegoo — UDP discovery/probe (`elegoo:udp-discover` / `elegoo:udp-probe`) | `_parseElegooReply` |
| 3174-3223 | Snapmaker — HTTP GET bridge (`snap:http-get`) | — |
| 3297-3408 | Prusa — PrusaLink HTTP IPC (`prusa:http`: Digest auth, cached challenge, path allowlist, binary for thumbnails/snapshots) + discovery probe (`prusa:probe`, one unauthenticated `GET /api/version`) | — |
| 3224-3288 | Creality — Moonraker HTTP IPC port 7125, live controls (`cre:http`) | — |

## Infra IPC — image cache, subnets, mDNS, app info, DB (L2945-3100)

| L | What | IPC |
|---|---|---|
| 2821-2875 | Image disk cache (`img:get`) | — |
| 2876-2966 | LAN /24 subnet list (`net:get-local-subnets`), MAC behind a LAN IP from the OS ARP cache, directly attached subnets only (`net:arp-mac`), mDNS Snapmaker browse (`mdns:browse-snapmaker`) | — |
| 2966-2976 | App/platform info for diagnostics (`app:info`, `app:renderer-path`); TigerTag DB lookups (`db:*`) | — |

## Elegoo MQTT bridge + timelapse + ffmpeg (L3101-3237)

| L | What | IPC |
|---|---|---|
| 3517-3546 | Timelapse video download (`timelapse:download`) | — |
| 3547-3619 | Elegoo MQTT 1883 bridge (`elegoo:connect` / `disconnect` / `publish`) | — |
| 3620-3674 | Shared `ffmpeg` binary detection (Bambu RTSP + Anycubic FLV cameras) — each candidate is PROBED, not just stat'ed | — |

## Camera captures — photo/video from printer camera sources, filed per printer under Pictures/Tiger Studio/Captures (cam:* IPC) (L4597-4789)

## Demo mode — printer simulator (L4790-4798)

Registers `services/demo` (`demo:faces`, `demo:allocate`, `demo:sync`, `demo:state`, `demo:set`) with the detected ffmpeg; stops every face on `will-quit`. The simulator itself lives in `services/demo/` — see `docs/DEMO-MODE.md`.

## Bambu Lab — MQTT + JPEG-TCP/RTSP cameras (L4799-5169)

| L | What | Anchors / IPC |
|---|---|---|
| 3675-3735 | MQTTS 8883 control bus (`bambulab:connect` / `disconnect` / `publish`) | — |
| 3736-3883 | JPEG-TCP camera, port 6000 (`bambulab:cam-start` / `cam-stop`) — 80-byte auth packet, retry/timeout | `_bambuCamAuthPacket` |
| 3884-4001 | RTSP camera via ffmpeg, port 322 (`bambulab:cam-start-rtsp` / `cam-stop-rtsp`) — 30 fps + low-latency flags; the spawn is guarded (it throws synchronously on a bad CPU type) | — |
| 4226-4385 | Prusa Buddy3D camera — plain RTSP `rtsp://<camera-ip>/live` via the same ffmpeg pipeline, 15 fps (`prusa:cam-start-rtsp` / `prusa:cam-stop-rtsp`, frames on `prusa:cam-frame`) | — |

## Bambu Lab cloud — REST + shared cloud MQTT (L5170-6059)

| L | What | Anchors / IPC |
|---|---|---|
| 4002-4094 | Tolerant REST helper over ELECTRON's `net` — Chromium's stack on purpose, because the login sits behind Cloudflare, which reads the TLS fingerprint | `_bblFetch`, `_bblHeaders` |
| 4095-4218 | Auth: `cloud-send-code`, `cloud-login` (code / password, `verifyCode` + `tfa` branches), `cloud-tfa` (token arrives in a COOKIE), `cloud-uid` (token is NOT a JWT), `cloud-bind` (machines + their LAN access codes), `cloud-device-version` | — |
| 4219-4480 | ONE cloud-MQTT client per ACCOUNT: `cloud-connect` (us→eu fallback), `cloud-subscribe` (+ `pushall`), `cloud-publish`, `cloud-unsubscribe`, `cloud-disconnect`. Telemetry is emitted on the LAN `bambulab:message` channel — same payload, same parser | `_bblCloudOpen`, `_bblCloudPushAll` |

## Anycubic LAN — MQTT, provisioning, FLV camera (L5862-6186)

| L | What | Anchors / IPC |
|---|---|---|
| 5691-5767 | MQTTS 9883 control bus, TLS 1.2 (`anycubic:connect` / `disconnect` / `publish`) | — |
| 5768-5861 | FLV camera via ffmpeg, port 18088 (`anycubic:cam-start` / `cam-stop`) — URL-aware (`/flv` or `/live/<token>`) | — |
| 5862-5927 | Slicer on-disk credential reader (`anycubic:read-slicer-config`) — keyless deobfuscation | `_acuDeobfuscate`, `_acuConfCandidates` |
| 5928-5992 | LAN scan: TCP probe (`anycubic:tcp-probe`), FLV liveness (`anycubic:flv-probe`, accepts 200/206), `/info` (`anycubic:http-info`) | — |

## Anycubic cloud — REST + cloud MQTT (L6187-6670)

| L | What | Anchors / IPC |
|---|---|---|
| 3862-3934 | Signed REST helpers (`Xx-Signature` md5, `XX-Token`) | `_cloudHeaders`, `_cloudFetch` |
| 3935-4046 | Web login (`anycubic:cloud-web-login`) + CDP token grab (`anycubic:cloud-cdp-token`) from a bridge-mode slicer | `_cdpEvaluate` |
| 4047-4185 | REST: `cloud-get-printers`, `cloud-printer-info` (temps + thumbnail + latest project), `cloud-verify`, `cloud-send-order`, `cloud-camera-open` (order 1001 → Agora "shengwang" creds) | — |
| 4186-4222 | Cloud-uploaded files (§9c): `cloud-files-list` (POST `/work/index/files`), `cloud-file-delete` (POST `/work/index/delFiles`); print reuses `cloud-send-order` order 1 | — |
| 4223-4488 | Shared cloud-MQTT client (one per user): `cloud-connect` / `subscribe` / `publish` / `unsubscribe`; RSA-encrypted token login | `_buildCloudLogin`, `_routeCloudMessage`, `_ensureCloudClient` |

## App lifecycle (L6408-6476)

| L | What |
|---|---|
| 5751-5815 | `app.whenReady` (img cache dir, server, window, NFC/TD1S/updater init), `window-all-closed`, `activate` |
