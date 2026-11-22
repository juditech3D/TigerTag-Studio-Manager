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

- Bambu Lab AMS → stock: under each AMS bay whose spool the AMS recognised (a non-zero
  `tray_uuid` in push_status), a "+ Stock" pill opens the catalogue picker on Bambu Lab, the
  bay's `tray_sub_brands`, its colour and its `tray_id_name`, exactly as a read chip does; the
  spool created from it keeps `bambu_tray_uuid`, where it sits (`ams_seen` { in, printer, name,
  slot, remain, at }) and a weight of `remain` % of the product. A spool already in stock is never
  offered again: one carrying that `tray_uuid`, or one whose linked chip (`rfidAliases`) is the chip
  the AMS reports it read (`tag_uid`, printer-published) shows ✓ with its weight and opens the
  spool (a chip-linked one takes the `tray_uuid` from then on); otherwise, when the stock holds
  Bambu Lab spools of that material and colour with no AMS identity (CIEDE2000 < 12, five at most), a window
  asks "Is it one of these spools?" first, and picking one links it to the bay and keeps its
  weight. Each AMS report afterwards finds the spool again in any
  printer's AMS, shows "printer · AMS · slot · %" in its Storage location section, marks it out
  when no bay of that printer holds it. Weight: until the spool is first weighed it follows the
  AMS estimate (`remain` % of the spool); once a weight not written by this feature appears
  (`ams_seen.weight` holds the last estimate written, `ams_seen.weighed` then stays true), only
  weighings count and the AMS % is just shown. A spool linked through "Is it one of these" keeps
  its weight and counts as weighed. Only what the printer
  publishes is used: nothing is read from the chip and no key is derived. Works in cloud mode
  too (it sends nothing to the printer). A first-use help window (what it is for / what you can
  do / how), reopened by the "?" next to the Filament title. On the Printers board cards, the
  same bay square carries a corner badge (✓ in stock / + to add, same click), and its hover tip
  gives the weight and the AMS %. No chip burn is ever offered for a Bambu Lab spool (its own
  chips are read-only and the AMS recognises it): no burn banner on its card or product card,
  no "Encode" tool, no burn in the manual add form, no burn window after it is created
  (`_isBambuNative`). Matched on a real H2D (PLA-CF, linked chip via `tag_uid`).
  `renderer/printers/bambulab/index.js` (`_mergeTrayStock`, `bambuAmsTrays`, `bambuAmsTray`,
  `ctx.onAmsTrays`), `renderer/printers/bambulab/cards.js` (`_bblStockChip`), `renderer/inventory.js` (`_slotStockBadge`, `.pcs-stock` in `40-printers.css`),
  `renderer/printers/bambulab/bambulab.css` (`.bbl-ams-stock`, `.bbl-ams-help`,
  `.ams-help-step`, `.ams-pick`), `renderer/inventory.js` (`_amsStockClick`, `_amsStockSync`,
  `_amsStockAttach`, `_amsStockHelp`, `_amsSeenHTML`, `openCatalogPick` prefill `ams`,
  `_catalogCreate`), `renderer/CODEMAP.md`, `docs/firestore-schema.md`,
  `renderer/printers/bambulab/PROTOCOL.md`. i18n: `amsStockAdd`, `amsStockAddTip`,
  `amsStockIn`, `amsStockOpen`, `amsStockHelpTitle`, `amsStockHelpWhatH`, `amsStockHelpWhat`,
  `amsStockHelpCanH`, `amsStockHelpCan`, `amsStockHelpHowH`, `amsStockHelpHow`,
  `amsStockHelpGo`, `amsStockHelpOk`, `amsSeenLabel`, `amsStockSameTitle`, `amsStockSameText`,
  `amsStockSameNew` (11 locales). `renderer/rfid_protocol/linked/index.js` (`spoolForChipUid`).
  Demo mode: the simulated Bambu Lab's trays 0-1 hold recognised spools (tray_uuid, tag_uid,
  sub-brand, weight, `remain` dropping while printing), trays 2-3 other makers' spools, so the
  feature can be tried without a printer. `services/demo/faces/bambulab.js` (`bblSpool`),
  `docs/DEMO-MODE.md`.

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
- A Bambu Lab spool is saved or linked only once BOTH of its chips are read (two UIDs,
  same tray UID): while one is missing, every Link banner gives way to a "1 of 2 chips
  read" notice saying what to do (TigerScale: Settings → RFID → Auto with the spool in
  place; TigerPOD: set the spool down flat between the readers), and creations that
  would take the chips are refused. Other makers' chips are unchanged.
  `renderer/rfid_protocol/linked/index.js` (`bambuPairGap`, `bambuPairGapHtml`,
  `_pairBlocked`, `_paintPairGap`, `makerReader`), `renderer/rfid_protocol/linked/linked.css`
  (`.lc-pair-gap`), `renderer/inventory.js` (`saveAddProduct`, `_catalogCreate`,
  `_adpRenderFoot`), `docs/LINKED-CHIPS.md`. i18n: `bambuPairMissing`,
  `bambuPairHintPod`, `bambuPairHintScale`.
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

- Labels print straight from Studio, without the system print dialog. The label card gains a
  "Printer" list: the system dialog (as before), a **Marklife P15** over Bluetooth LE (found and
  connected by Studio, Web Bluetooth, `select-bluetooth-device` picks it by its advertised name; a Connect
  button starts the scan alone, and while it runs every device seen is listed in the card to pick by
  hand, the names seen being logged when nothing was picked),
  every printer installed on the computer (printed silently through its driver), and the
  **Brother QL** printers announced on the network over mDNS (raster sent to TCP 9100, no driver;
  the roll is the one picked in the card's "Roll" list, else read from the printer's status; a QL-580N
  answers none over the network, so the card then asks for the roll instead of sending a job the
  printer would refuse; the label is turned and scaled down to fit the roll's printable width). An installed Brother QL is printed the same way, on the address behind its Windows printer port or one typed in the card's "Address" field (a Windows port names the printer by host name, BRN…, and is read as such). The mDNS search listens on every LAN interface: on a computer with a VPN or Hyper-V adapter the default socket heard nothing.
  A tenth template "Marklife P15" (25 × 12 mm, a margin on the P15's 12 × 30 mm labels, its series in bold black text rather than white on a black band, which fills in at 203 dpi) fits the P15's labels, and an eleventh "Brother 62 × 29" (four value slots, laid out on the 58 × 23 mm printable area of the QL's DK-11209 labels; a die-cut job is sent at the exact printable length, 271 lines for 62 × 29, or the printer stops on an error), picked with a Brother QL or its 62 × 29 roll (a QL is asked which roll it holds over SNMP v1 — prtInputMediaName, which the QL-580N fills while answering no raster status over the network — and the card takes that roll and its template; the card shows "Printer ready", or "In error: press the printer's Power button once", from the printer's SNMP state line, read every 5 s while it is open; the card's messages and the printer's state are coloured pills — blue while printing or searching, green once sent or ready, red on an error, the message right under the printer rows — a QL-580N in a media error is not cleared from the network); a size the chosen printer's roll cannot take (P15, or the QL roll picked, 5 % leeway) is greyed out, and changing printer or roll moves off it; each printer brings back
  the format last picked with it (`templateBy`), the P15 starting on its own template and never
  keeping a label too wide for its roll, and a direct printer prints at its own resolution (P15 203 dpi, QL 300 dpi).
  P15 protocol (L11, service 0xFF00, credit flow control) from the MIT thermoprint project. New
  `renderer/labels/p15.js`, `services/label-printers.js`; `main.js` (`_labelImage`, `label:printers`,
  `label:bitmap`, `label:print-ql`, `label:render` `deviceName`, `select-bluetooth-device`, the
  `enable-blink-features=WebBluetooth` switch that Linux needs);
  `preload.js` (`listLabelPrinters`, `labelBitmap`, `printLabelQl`); `renderer/labels/index.js`
  (`printDirect`, `searchPrinters`, `printerFor`, layout `p15` with `pillAt`), `labels.css`;
  `CODEMAP-main.md`, `CLAUDE.md` (`tigertag.label`), `llms.txt`, `docs/i18n-keys.md`, `docs/LABEL-PRINTERS.md`
  (setup, troubleshooting, USB QL via its driver, adding a printer). Printed on a Marklife P15 and a
  Brother QL-580N (62 × 29). The Printer list shows each printer's picture (an option's `data-thumb`,
  drawn by `_enhanceSelect` in the list and on the button; `assets/img/label_printers/`: Marklife P15,
  Brother QL-580N for a QL-5xx, QL-800 for any other QL; masters in `assets-src/img/label_printers/`).

### Changed

- `README.md` opens with an "Unofficial fork" warning and gains a "What this fork adds or changes"
  section (base version 2.59.2, no fork installers, additions, fixes, and what is still in progress:
  printer-slot mounting does not work yet).
- `README.md`: the download buttons, the release / build badges, the `git clone` command and the
  Issues link point to this fork (juditech3D) instead of the official repository.
- Release v2.59.2-fork.1: `package.json` / `package-lock.json` version, `build.publish` owner `juditech3D` (auto-updater follows the fork), `.github/workflows/build.yml` without macOS and Web sync, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.1.md`.
- Release v2.59.2-fork.2: `package.json` / `package-lock.json` version, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.2.md`, FEATURES / llms.txt version. Bundled data not refreshed (`db_update.py` cannot reach the API from the build session).
- Release v2.59.2-fork.3: `package.json` / `package-lock.json` version, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.3.md`, FEATURES / llms.txt version. Bundled data not refreshed (`db_update.py` cannot reach the API from the build session).

### Fixed

- A Feitian ROCKEY-ARM licence dongle ("FT ROCKEY ARM 0") is no longer taken for an RFID reader: PC/SC lists it as a reader holding a card, so it showed as one more chip next to the real ones. `services/nfc-process.js` skips names matching `rockey`, like the YubiKey and Windows Hello readers.
- `.ttag` import in **Import** mode works again: it wrote `id_tigertag: FieldValue.delete()` in a
  batch `set()` without merge, which Firestore rejects, so every Import-mode file failed with
  "ttagImportErr" and nothing was written. The field is now left out of the new doc
  (`_ttagBuildWrites` in `renderer/inventory.js`). Restore mode was not affected.
- Settings → "Check for updates" no longer prints electron-updater's raw error (URL, HTTP
  headers, stack) when a release is tagged but its build has not uploaded `latest.yml` yet: it
  says an update is being published and to wait a few minutes. A network failure and any other
  error each get one short sentence; the full error goes to `main.log`. `main.js`
  (`updaterErrorReason`, sends `reason` instead of `error` on `update-status` and
  `update:check-now`), `renderer/inventory.js` (`updateErrorText`), `CODEMAP-main.md`.

### i18n

- Spool → printer slot: `mountSectionLabel`, `mountNone`, `mountPick`, `mountChange`, `mountClear`, `mountSlotEmpty`, `mountNoSlots`, `mountHint` (after `storageNotPlaced`), 11 locales.
- Barcode scan: `scanUnknownCode` (after `catalogTypeUnsupported`), 11 locales.
- Bambu Lab chip: `bambuChipSummary` (after `linkedChipTitle`), 11 locales.
- Label printers: `labelTpl_p15` (after `labelTpl_qrOnly`), `labelPrinter`, `labelPrinterDialog`, `labelPrinterP15`, `labelPrinterConnected`, `labelPrinterNetwork`, `labelPrinterInstalled`, `labelPrinterSearch`, `labelP15NoFit`, `labelPrinting`, `labelPrinted`, `labelP15NotFound`, `labelBtUnavailable`, `labelBtConnect`, `labelBtNotConnected`, `labelBtSearching`, `labelBtPick`, `labelBtNoName`, `labelQlRoll`, `labelQlRollAuto`, `labelQlRollContinuous`, `labelQlNeedRoll`, `labelQlAddress`, `labelQlNoFit`, `labelQlStateError`, `labelQlStateReady` (after `labelExportFailed`), `labelTpl_ql62x29` (after `labelTpl_p15`), 11 locales.
- Update check: `aboutCheckUpdatePending`, `aboutCheckUpdateOffline` (after `aboutCheckUpdateErr`, whose text is now a full sentence), 11 locales.
