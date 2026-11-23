# Worklog — v2.60.0

## Added

- Catalogue: pick the brands you follow. The Search views show only their products (lighter, and fewer product photos asked of the `/img` function); the first visit asks for them (`_catViewAskBrands`, the brands card opens), the toolbar's "N brands" button reopens the card (`#catBrandsPanel`: search, All / None, a toggle row per maker with its product count, saved once on close; everything unticked goes back to the first state, the view asks again); a search that only matches unfollowed brands says how many and offers to edit them. Kept in `prefs/app.catalogBrands` (read with the language at launch, no extra read; shared with the mobile app) and `tigertag.catalogBrands.<uid>`. i18n: `catBrandsTitle`, `catBrandsTip`, `catBrandsBtn`, `catBrandsSearch`, `catBrandsAll`, `catBrandsNone`, `catBrandsCount`, `catBrandsDone`, `catBrandsAskTitle`, `catBrandsAskSub`, `catBrandsAskCta`, `catBrandsElsewhere`, `catBrandsElsewhereCta`. Files: `renderer/inventory.js`, `renderer/inventory.html`, `renderer/css/70-detail-misc.css`, `renderer/locales/*.json`, `docs/i18n-keys.md`, `docs/firestore-schema.md`, `renderer/CODEMAP.md`.
- Catalogue: "Sort by: Series" — brand, then series, then colour, so a series' colours sit side by side (grid and table).
- Inventory: "Find by colour" in the search bar of the inventory views (grid, table, storage), the Search views' colour card (HEX, RAL Classic, photo, ΔE ceiling, multicolour). Spools past the ceiling are hidden (dimmed in storage), the grid and the table show the closest first; the colour is one of the bar's chips. Not in a friend's view. New `_colorSearchScope`, `_rowMatchesColor`, `_invColorRank`, body class `color-search`. i18n: `colorSearchSubInv` (the card's subtitle in the inventory views). Files: `renderer/inventory.js`, `renderer/css/70-detail-misc.css`, `renderer/locales/*.json`, `docs/i18n-keys.md`, `renderer/CODEMAP.md`.

## Changed
- Unofficial-fork warning made unmissable: `README.md` opens with a full caution (not published or supported by the TigerTag team, features offered upstream may never be merged, problems go to this fork's issues, no liability), its title becomes "Tiger Studio Fork", the official site button and language row become one line labelled "not this fork", the macOS download button and the "Signed & Notarized" line are replaced by what this fork really ships. `data/release-notes/v2.59.2-fork.4.md` carries the same caution. The window title reads "Tiger Studio Fork (unofficial)" and the sidebar and sign-in screen say "Studio Fork" (`main.js`, `renderer/inventory.html`); the product name, install folder and user data are unchanged.

- Search bar: no magnifier at the right end (the pill reads as a search field on its own). Right to left: QR, Filter, colour (Search and inventory views); the clear button has its own slot left of them while there is text, so nothing shifts as you type. Files: `renderer/inventory.html`, `renderer/css/70-detail-misc.css`.
- Storage plan, Printers plan and camera wall: the mouse wheel scrolls the view (sideways when the plan is wide but not tall), Ctrl / ⌘ + wheel or a trackpad pinch zooms, Ctrl / ⌘ + and − press the plan's zoom buttons; thin themed scrollbars show where you are (#323, asked in #301 and #315; ported from the reporter's fork). New `_planWheelZooms`, `_planWheelSideways`. Files: `renderer/inventory.js`, `renderer/css/30-racks.css`, `renderer/css/40-printers.css`, `FEATURES.md`, `renderer/CODEMAP.md`.
- Find by colour, HEX mode: the colour picker (saturation / brightness area + hue strip) shows in the card at once, above the HEX field and the presets, and follows them both ways — a colour picked elsewhere (preset, field, RAL, photo) glides the picker there in 280 ms (the hue the short way round, the swatch fading; none with reduced motion); it used to hide behind a click on the swatch. `mountColorArea` (the picker alone, inline) split out of `openColorPop`, which uses it. Files: `renderer/color-pop.js`, `renderer/color-search.js`, `renderer/inventory.js`, `renderer/css/70-detail-misc.css`.
- Find by colour, a tidier card: the explanations moved into ⓘ bubbles (the title's says what is searched — catalogue or inventory —, the ΔE one explains the scale, the photo one says nothing is uploaded); ΔE and the multicolour switch are one settings block, under the chosen colour; multicolour is counted by default; in RAL mode the list fills the rest of the card's height, scrolls to the chosen code and has the thin themed scrollbar. Files: `renderer/color-search.js` (`data-mode` on the root, `infoTipHtml`), `renderer/inventory.html`, `renderer/inventory.js` (`openColorSearch`), `renderer/css/70-detail-misc.css`.
- Firebase reads and writes cut (every one justified at 500,000 users):
  - XP history, TigerCoins history and the community history are kept on this computer and topped up with their new rows only (`_deltaLog`: one read when nothing is new, a COUNT check that sends a rebuilt or pruned log back to a full read, a full read once a month). Keys `tigertag.xpLog.<uid>`, `tigertag.coinlog.<uid>` (now `{rows, n, …}`, the old array is replaced on first opening), `tigertag.squadPulseHistory` (topped up at most every 30 min, across launches). The TigerSquad board takes its 20 latest XP rows from the same copy.
  - `users/{uid}` and `userProfiles/{uid}` are no longer read again at sign-in: `syncUserDoc` takes the listeners' first server snapshot (`_ownServerSnap`); the board reads `xpBreakdown` / `xpUnlocked` from the live doc too.
  - Launch telemetry writes only what changed, or once a day (`tigertag.telemetryMemo.<uid>`, `_telDue`): the `users/{uid}` client state, the `telemetry/studio` aggregate (`sessionsCount` now counts days of use), the state snapshot and the `stock` mirror. `recordStudioState` takes the milestone stamps from the sign-in read (`hydratePodSignal`) instead of reading the doc again.
  - Removed `persistPrinterSortIndices` (never called since the printer plan; it rewrote every printer).
  - Files: `renderer/inventory.js`, `renderer/CODEMAP.md`, `docs/firestore-schema.md`.

## Fixed

- Storage: "undefined · 0/NaN" ghost racks that came back every day (#302). `updateRack` wrote with `set(merge)`, so a write landing after a delete — the plan giving a place to a rack the launch's cached snapshot still listed — recreated the document with only `plan` / `lastUpdate` — reproduced on a test rack (deleted on the server while Studio was offline, then placed by the plan). The plan also no longer places or adopts a card whose rack is gone from the list (a deleted rack's card still on the board: four ghosts written at once, x 0 / 14 / 28 / 42, on a friend's account), nor writes it when seeding the plan. `updateRack` now uses `update()` (a deleted rack stays deleted; the plan ignores the not-found), and rack documents with no name and no grid are not shown or counted (`_isRealRack`, own and friend views). Ghost documents already on an account are deleted by Studio from the server's word only, on the account's own racks, and only documents holding nothing but `plan` / `lastUpdate` that no spool points at (`_sweepGhostRacks`). File: `renderer/inventory.js`, `renderer/CODEMAP.md`.
- Find by colour: the search bar's pipette was missing at launch until the view was changed — the `color-search` body class is now set on boot too (as `sel-btn-view` is). File: `renderer/inventory.js`.
- Labels: the maker's logo now prints on every layout that prints the brand. On the vertical labels (30 × 40, 25 × 40) a brand name too long for the room beside the pill used to drop below it as text and the logo was never tried; the Slicer label always printed the name. Now the logo goes where it is tallest — beside the pill, or below it on a vertical label — and stands on the Slicer label's brand line; the name stays the fallback when the brand has no logo. Same change in Tiger NFC Connect (`lib/services/qr_label.dart`), checked identical on the 9 layouts × 203 / 300 dpi. File: `renderer/labels/index.js`.
- Labels: makers' logos drawn for a dark background (white letters on a clear background — OVV3D, American Filament, IC3D's "3D PRINTING") lost their letters when made black. New `_monoLabelLogo`: a logo whose white shapes standing on the clear background are 30 % or more of it prints them black; the others keep white as paper (holes in a coloured block, sticker rims, opaque white backgrounds). The logo is also cropped to its ink, so one drawn small in a wide transparent square no longer prints small. Checked on the 105 brand logos; same rule in Tiger NFC Connect (`lib/services/brand_logo.dart`), identical output. 63 brands still have no logo in the Manager (Generic, 3DMA, Smart3DPT, Atome3D…): their labels print the name. Files: `renderer/inventory.js`, `renderer/CODEMAP.md` (ranges after the insertion).
- Friend view: no empty dark box at the right end of the header — the device card hides when none of its icons shows (#322). File: `renderer/css/60-modals.css`.
- RFID readers: a Feitian ROCKEY-ARM licence dongle is no longer listed as a reader (#320, #312). File: `services/nfc-process.js`.
- `.ttag` import: Import mode no longer fails on every file (`FieldValue.delete()` in a `set()` without merge) (#319, #311). Files: `renderer/inventory.js`, `renderer/CODEMAP.md`.
- Klipper: editing a filament counts for the "Edit a filament in a printer" mission (#318, #268). File: `renderer/printers/klipper/filament-edit.js`.
- Favorites: the view rebuilt every card on each inventory refresh (live updates, scheduled renders), reloading pictures and replaying the fade — it could flicker. `_pvSameAsShown` now skips the rebuild when the markup is unchanged (faves grid / table and the order tab). Files: `renderer/inventory.js`, `renderer/CODEMAP.md`.

## Removed

## i18n
- `linkedChipLinkTip` reworded in the 11 locales: "Link to my inventory" is for the chip the brand already put on the spool (Bambu Lab, Creality, Anycubic…) — link it to one of your spools and scanning it opens that spool (same text in the mobile app).
- `linkedChipAddTag` reworded in the 11 locales: "Add with a Tag" (was "Add with TigerTag"), same text in the mobile app.

## Fork additions (kept on top of upstream v2.60.0)

### Added

- Label card: a "Sheet" choice for the system print dialog and installed printers — the
  label's own size (default), A4 with the label in the top-left corner, or A4 on a full
  sheet's grid centred on the page (the label in its top-left place) — remembered per printer, for drivers that know no page but A4 and printed the
  label blank (#263). PDF / PNG / SVG keep the label's size. `renderer/labels/index.js`
  (`LABEL_PAGES`, `pageFor`, prefs `pageBy`), `main.js` (`label:render` `page`), `CLAUDE.md`
  (`tigertag.label`). i18n: `labelPage`, `labelPageLabel`, `labelPageA4TopLeft`,
  `labelPageA4Centre`, `labelPageHint`.
- Label card on an A4 sheet: the preview draws the whole sheet with each label where it
  prints, and a "Copies" field (plus "Stock (n)" on a Filament Label: one per spool of that
  product in stock) lays several copies out with a chosen spacing (prefs `sheetGap`, 5 mm by default, shown once there is more than one copy) and a margin off the sheet's edges (prefs `sheetMargin`, 0 by default), filled from the
  top-left place, going on to further sheets when one is full; a − / + zoom (100–400 %)
  looks closer at the sheet. `renderer/labels/index.js`
  (`sheetLayout`, `sheetsFor`, `sheetCopies`), `renderer/labels/labels.css` (`.lbl-sheet`,
  `.lbl-copy`), `main.js` (`label:render` `sheets`), `renderer/inventory.js` (ctx
  `stockCount`). i18n: `labelCopies`, `labelCopiesStock`, `labelCopiesFit`, `labelCopiesSheets`,
  `labelSheetGap`, `labelSheetMargin`.
- Stock selection bar: a "Labels" button opens the label card for every selected spool
  (a twin pair once): one label each with its own QR, "Copies each", printed in one run
  — tiled on A4, one page each otherwise, one after the other on the P15 / Brother QL —
  and one PDF holding them all (PNG / SVG stay single-label). The open card follows the
  selection: ticking or unticking a spool updates it, copies kept (`syncLabelBatch`). `renderer/labels/index.js`
  (`openLabelBatch`, `runOf`, `labelsOut`), `main.js` (`label:render` `labels`, indexed
  `sheets`), `renderer/inventory.html` / `70-detail-misc.css` (`#bulkLabels`),
  `renderer/inventory.js`, `CODEMAP-main.md`. i18n: `bulkLabels`, `labelBatchCount`,
  `labelCopiesEach`; `labelPageA4Centre` reworded.
- Label card values: chosen on a giant drawing of the label, drawn for every format from its
  own layout (brand, pill, series bar, colour and its codes, rule, a stand-in QR; texts kept
  clear of the pill and QR and shrunk to fit as printed; sized in
  container units), where each values line sits where it prints as a highlighted choice
  showing the value it prints for this spool. `renderer/labels/index.js` (`giant`, `slotSel`, `fakeQr`),
  `renderer/labels/labels.css` (`.lbl-giant*`).
- Printers board: a "Show all cameras" key plays every camera that can be shown (as if each
  play key were pressed, external camera cards included), shown while one is not playing; a
  "Stop all cameras" key, shown while a feed is
  playing, puts every camera back on its play key at once — the machines' played cameras
  (Bambu Lab, Creality, FlashForge and Anycubic streams are closed, the others go with their
  card) and the external camera cards — except the machine open in the side panel. The
  automatic start waits until the board is opened again from another view; a play key still
  starts its own camera (#272). `renderer/inventory.js` (`_camStopAllBoard`, `_camAutoHeld`,
  `_camPlayAllBoard`, `_syncCamStopBtn`, `_autoStartCams`, `setViewMode`), `renderer/ext-cam/ext-cam.js`
  (`extCamBoardLive`, `extCamBoardPauseAll`, `extCamBoardIdle`, `extCamBoardResumeAll`, `boardCardHtml`, `wireCards`),
  `renderer/css/40-printers.css` (`.pv-plan-bar > [hidden]`, `.cam-play--shown`),
  `renderer/CODEMAP.md`. i18n: `boardCamStopAll`, `boardCamPlayAll`.

- Tile views in select mode: a "Select All" key beside "Select" ticks every spool the
  current filter shows (pressed again, unticks them) — the list header's master box, which
  the tiles had no equivalent of. `renderer/inventory.html` (`#btnSelectAll`),
  `renderer/inventory.js` (`_syncSelAllHeader`), `renderer/css/70-detail-misc.css`
  (`.inv-select-all`). i18n: reuses `ctxSelectAll`.
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
- Release v2.59.2-fork.4: `package.json` / `package-lock.json` version, `CHANGELOG.md`, `data/release-notes/v2.59.2-fork.4.md`, FEATURES / llms.txt version. Bundled data not refreshed (`db_update.py` cannot reach the API from the build session).
- Upstream v2.60.0 merged in; the fork's own entries for the plan wheel scroll (#323), the `.ttag` Import-mode fix (#319) and the ROCKEY-ARM filter (#320) dropped, upstream ships the same changes and its code was kept. Version set to 2.60.0-fork.1 (not released).
- Release v2.60.0-fork.1: `CHANGELOG.md`, `data/release-notes/v2.60.0-fork.1.md` (version already set by the merge). Bundled data is upstream's refresh (24,865 products).

### Fixed

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
