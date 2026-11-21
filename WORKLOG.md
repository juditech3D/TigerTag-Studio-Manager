# Worklog — v2.59.2 (in progress)

## Added

## Changed

## Fixed
- Bambu Lab A2L added by IP is recognised from its serial prefix `26A` instead of falling back to "Select printer" (#244, PR #306); the DevModel code `N9` still wins. Prefix read off a reporter's serial, no real A2L tested. `renderer/printers/bambulab/probe.js` (`BBL_SERIAL_PREFIX_TO_ID`), `renderer/printers/bambulab/PROTOCOL.md`.
- Catalogue auto-refresh no longer floods `product/get` (#309: ~450 000 calls a day since 2.59.0, the API went down). The spools are reconciled only after a sync that downloaded a CHANGED mirror (`_catalogSignature`, localStorage `tigertag.catalogSig`), not on every inventory snapshot or window focus; every answered call stamps the spool with the mirror entry it was asked for (`tigertag.catalogAsked.<uid>`, kept across restarts), so a spool the API is behind on is not asked again until that entry moves; a 5xx / timeout / network failure stops the run and pauses every automatic ask (`tigertag.catalogBackoff`, 30 min doubling up to 8 h, also honoured by the check on opening a spool); at most 10 spools per run (`CATALOG_REFRESH_MAX`, was 40). The launch refresh of TigerTag+ spools without a photo goes through the same runner (sequential, capped, once a week per spool). Simulated: 30 spools that stay behind cost 30 calls once, then none; a 503 stops after one call. `renderer/inventory.js` (`_catalogAskBatch`, `_catalogRefreshStale`, `_catalogAutoSync`, `_catalogSync`, `_refreshApiData` `report`, `_catalogCheckOnOpen`), `CLAUDE.md` (localStorage keys), `renderer/CODEMAP.md`.

## Removed

## i18n

## Fork additions (kept on top of upstream v2.59.2)

### Added

- A macOS build (Apple Silicon `mac-arm64` + Intel `mac-x64`, `.dmg` + `.zip`) in every release. It is
  signed ad-hoc (`build.mac.identity: "-"`, no hardened runtime, no notarization: the fork holds no
  Apple Developer ID), which Apple Silicon needs to start it at all; Gatekeeper still asks the user to
  allow it once. `latest-mac.yml` is deliberately left out of the release: Squirrel.Mac only installs an
  update signed by the same Developer ID, so Mac users download each new `.dmg` by hand. README
  "Opening the app on macOS / Ouvrir l'application sur macOS" gives the end-user steps in French and
  English (Open Anyway on Sequoia+, right-click → Open on Sonoma and older, `xattr -cr` for "damaged");
  the next fork release note must carry the same steps and drop "Windows and Linux only" from its
  Known limitations. `package.json` (`build.mac`, script `build:mac:fork`),
  `.github/workflows/build.yml` (mac matrix entry, Apple signing steps removed, ad-hoc signature check,
  draft upload without `latest-mac.yml`, publish check for both `.dmg`), `.github/workflows/test-build.yml`
  (mac test build uses `build:mac:fork`), `README.md`.
- TigerScale card: a "Wake up" button (when the scale is asleep or shown offline) lights its
  screen through the firmware's `POST {lan_url}/wake?c=<lan_access_code>`, which presses nothing;
  the answer shows on the button ("Screen on" / "No answer" / "Update the scale" for a firmware
  without `/wake`). The live view and the screenshot wake a sleeping scale the same way instead of
  a tap in the middle, which pressed a button when `power_state` was one beat stale; on a firmware
  without `/wake` the screenshot is read as it is. `main.js` (IPC `tigerscale:wake`,
  `tigerscale:screenshot`), `preload.js` (`tigerscale.wake`), `renderer/IoT/tigerscale/index.js`
  (`_buildScaleLanHtml`, `_scaleWake`), `renderer/IoT/tigerscale/live.js`. i18n: `scaleWake`,
  `scaleWakeDone`, `scaleWakeFail`, `scaleWakeOld` (11 locales).
- TigerScale live view: its Screenshot button closes the live view before opening the preview,
  which used to open behind it (two `.modal-overlay` of the same z-index, the live one added last),
  so the click seemed to do nothing. `renderer/IoT/tigerscale/live.js` (`openScaleLive`).
- A `tigertag://report?kind=<bug|idea|improve|question>&about=<studio|tigertouch|tigerpod|tigerscale|tigerspool|mobile>&title=…&body=…`
  link opens the request card ("Improvements & suggestions") pre-filled, as the AI assistant's
  `open_ticket` does; a link that arrives before sign-in opens it after. Pre-fill only: the user
  still ticks that the request is public and presses Send. `renderer/inventory.js`
  (`_handleReportDeepLink`, `_pendingReportLink`, flushed in `setConnected`), `main.js` (deep-link
  comment), `CLAUDE.md` (Friends / deep links).
- A TigerScale can stand in for a TigerPOD: while its TigerPOD tool is open on its screen, its
  two readers show up in Studio as two more RFID readers ("TigerScale <name> #1" / "#2"), and every
  chip feature works on them as on a USB reader (open the spool of a chip put down, write a blank
  chip, TigerTag+ upgrade, restore, erase, NFC tools). `services/scale-pod.js` (`ScalePods`) speaks
  the reader-process messages of `services/nfc-process.js` over `ws://<scale>/pod?c=<lan_access_code>`
  for the account's scales that publish `lan_url` + `lan_access_code` (local addresses only, retried
  every 5 s, the code never logged); `main.js` routes each request to whichever side owns the reader
  (`_nfcPost`, `_nfcUp`, IPC `tigerscale:pod-scales`); `preload.js` (`tigerscale.podScales`);
  `renderer/IoT/tigerscale/index.js` hands the list over on every scales snapshot (`_syncPodScales`).
- A spool can be mounted in a printer slot (AMS / CFS / ACE / holder / Ext.) from its detail
  panel: the Storage location section gains a printer row and a slot picker (printer → unit →
  slot). It writes the `uids` already reserved on `printers/{brand}/devices/{id}.units.{unitId}.slots[i]`;
  assigning evicts the previous occupant and removes the spool from any other slot, twin ids go
  together. `renderer/inventory.js` (`spoolMountOf`, `assignSpoolToPrinterSlot`, `_detailMountHTML`,
  `_wireDetailMount`, `_refreshDetailMount`), `renderer/css/10-settings.css`. ROADMAP P1/P2/P4
  marked partly shipped.
- A USB barcode / QR scanner works anywhere in the app: a burst of quick keys outside any field,
  closed by Enter or Tab, is taken as a scan. Its code (or one found inside a QR link) is matched
  exactly against the catalogue (barcode, SKU, id): the Catalogue view opens on it with the product
  selected, so its card is ready to add the spool. A spool QR link (qr.tigertag.io) opens the spool;
  an unknown code stays a search and says so. A field with the focus keeps every key. Digits are
  read from the physical key (`e.code`), so a scanner set to the US layout works on an AZERTY computer.
  `renderer/inventory.js` (`_onCodeScanned`, `_catalogProductsForCode`).
- The barcode scanner has a mode button in the view row (next to Select): "Scanner: everywhere"
  (default, as before, and a code scanned or pasted into the search bar then Enter also opens its
  product), "Scanner: search bar" (only the search bar acts on a code), "Scanner: off" (the search
  bar is a plain search, nothing caught outside fields). Each click moves to the next mode; saved
  on this computer. `renderer/inventory.html` (`#btnScanMode`), `renderer/inventory.js`
  (`_scanMode`, `_setScanMode`, `_paintScanMode`), `renderer/css/70-detail-misc.css`
  (`.inv-scan-btn`), `CLAUDE.md` (localStorage `tigertag.scanMode`). i18n: `scanModeOff`,
  `scanModeSearch`, `scanModeAll`, `scanModeAria` (11 locales).

- A Bambu Lab chip placed on a PC/SC reader is read: its sectors open with keys derived
  from its UID (HKDF-SHA256, per the Bambu Research Group's RFID-Tag-Guide), the data
  blocks are decoded (material, colour, weight, diameter, temperatures…) and the
  new-chip card shows them above its choices; "Catalogue" opens on Bambu Lab and the
  detailed type, sorted by closeness to the chip's colour, the closest product's card
  opened at once within ΔE 10 (`_cpkChipColor`, `_cpkChipRank`). Read only, nothing written, signature not checked. New
  `services/bambu-tag.js` (`bambuKeysA`, `parseBambuBlocks`); `services/nfc-process.js`
  (`_readBambu`, no NTAG read for a MIFARE Classic 1K); `main.js` (`bambu` on
  `rfid-foreign-chip`); `renderer/rfid_protocol/linked/index.js` (`presentBambuInfo`,
  `_bambuSummaryHtml`), `linked.css` (`.lc-bambu*`); `renderer/inventory.js`
  (`openCatalogPick` `prefill`); `docs/LINKED-CHIPS.md`. Not tried on a real chip yet.

### Changed

- `README.md` opens with an "Unofficial fork" warning and gains a "What this fork adds or changes"
  section (base version 2.59.2, no fork installers, additions, fixes, and what is still in progress:
  printer-slot mounting does not work yet).
- `README.md`: the download buttons, the release / build badges, the `git clone` command and the
  Issues link point to this fork (juditech3D) instead of the official repository.
- Release v2.59.2-fork.1: `package.json` / `package-lock.json` version, `build.publish` owner `juditech3D` (auto-updater follows the fork), `.github/workflows/build.yml` without macOS and Web sync, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.1.md`.
- Release v2.59.2-fork.2: `package.json` / `package-lock.json` version, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.2.md`, FEATURES / llms.txt version. Bundled data not refreshed (`db_update.py` cannot reach the API from the build session).

### Fixed

- A Feitian ROCKEY-ARM licence dongle ("FT ROCKEY ARM 0") is no longer taken for an RFID reader: PC/SC lists it as a reader holding a card, so it showed as one more chip next to the real ones. `services/nfc-process.js` skips names matching `rockey`, like the YubiKey and Windows Hello readers.
- `.ttag` import in **Import** mode works again: it wrote `id_tigertag: FieldValue.delete()` in a
  batch `set()` without merge, which Firestore rejects, so every Import-mode file failed with
  "ttagImportErr" and nothing was written. The field is now left out of the new doc
  (`_ttagBuildWrites` in `renderer/inventory.js`). Restore mode was not affected.

### i18n

- Spool → printer slot: `mountSectionLabel`, `mountNone`, `mountPick`, `mountChange`, `mountClear`, `mountSlotEmpty`, `mountNoSlots`, `mountHint` (after `storageNotPlaced`), 11 locales.
- Barcode scan: `scanUnknownCode` (after `catalogTypeUnsupported`), 11 locales.
- Bambu Lab chip: `bambuChipSummary` (after `linkedChipTitle`), 11 locales.
