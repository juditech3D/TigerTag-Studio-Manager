/**
 * fork-report/fork-report.js — the fork's "Something wrong?" bubble.
 *
 * A round button at the bottom right of the window opens a small card: the
 * tester describes the problem, may give a Discord name, may attach a capture of
 * the window (taken with the card and the bubble hidden), and presses Send. The
 * main process (main.js `forkReport:send`) posts it to the fork's Discord
 * channel through a webhook, with the app version, the system and the last lines
 * of the log (scrubbed of e-mails, IPs and keys).
 *
 * Why not the "Bug or idea?" card (renderer/report): that one files issues on
 * the OFFICIAL project's tracker, which must not receive reports about this
 * unofficial fork.
 *
 * Shown only in the desktop app and only when the build carries a webhook
 * (`forkReport.available()`); otherwise nothing is added to the page. The draft
 * (text, name, capture) survives closing the card until it is sent.
 *
 * Public API: initForkReport({ t })
 */

const NAME_KEY = 'tigertag.forkReport.name';   // the Discord name last typed (per device)

let _t = k => k;
let _bubble, _card, _text, _name, _shotRow, _shotImg, _shotTake, _status, _sendBtn;
let _image = null;     // JPEG data URL of the capture, or null
let _busy = false;

const $el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const BUG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5.5V4h6v1.5"/><rect x="6.5" y="6" width="11" height="13" rx="5.5"/><path d="M12 10v6M3 13h3.5M17.5 13H21M4.5 8l2 2M19.5 8l-2 2M4.5 18l2-2M19.5 18l-2-2"/></svg>';

// data-i18n / data-i18n-placeholder: applyTranslations() (inventory.js) redraws
// them when the language changes.
function _i18n(el, key) { el.dataset.i18n = key; el.textContent = _t(key); }
function _i18nPh(el, key) { el.dataset.i18nPlaceholder = key; el.placeholder = _t(key); }

function _setStatus(msg, kind) {
  _status.textContent = msg || '';
  _status.className = 'fr-status' + (kind ? ` fr-status--${kind}` : '');
}

function _open() {
  _card.hidden = false;
  requestAnimationFrame(() => _card.classList.add('open'));
  _bubble.setAttribute('aria-expanded', 'true');
  setTimeout(() => _text.focus(), 60);
}
function _close() {
  _card.classList.remove('open');
  _bubble.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!_card.classList.contains('open')) _card.hidden = true; }, 180);
}
const _isOpen = () => _card.classList.contains('open');

function _showShot() {
  _shotRow.classList.toggle('has-shot', !!_image);
  if (_image) _shotImg.src = _image; else _shotImg.removeAttribute('src');
  _i18n(_shotTake, _image ? 'forkReportRecapture' : 'forkReportCapture');
}

async function _capture() {
  // Hide the card and the bubble for the very next frame, so the capture shows
  // the app as the tester sees it.
  _card.style.visibility = 'hidden'; _bubble.style.visibility = 'hidden';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try { _image = await window.electronAPI.captureWindow(); }
  catch { _image = null; }
  finally { _card.style.visibility = ''; _bubble.style.visibility = ''; }
  _showShot();
}

function _done() {
  _card.classList.add('sent');
  setTimeout(() => {
    _close();
    setTimeout(() => {
      _card.classList.remove('sent');
      _text.value = ''; _image = null; _showShot(); _setStatus('');
    }, 220);
  }, 2600);
}

async function _send() {
  if (_busy) return;
  const text = _text.value.trim();
  if (!text) { _setStatus(_t('forkReportEmpty'), 'err'); _text.focus(); return; }
  _busy = true; _sendBtn.disabled = true; _setStatus(_t('forkReportSending'));
  const pseudo = _name.value.trim();
  try { localStorage.setItem(NAME_KEY, pseudo); } catch { /* private mode */ }
  let res;
  try { res = await window.electronAPI.forkReport.send({ text, pseudo, image: _image }); }
  catch { res = { ok: false, error: 'network' }; }
  _busy = false; _sendBtn.disabled = false;
  if (res?.ok) { _setStatus(''); _done(); return; }
  _setStatus(res?.error === 'too-soon' ? _t('forkReportTooSoon') : _t('forkReportFailed'), 'err');
}

function _build() {
  _bubble = $el('button', 'fr-bubble', `${BUG_SVG}<span></span>`);
  _bubble.type = 'button';
  _i18n(_bubble.querySelector('span'), 'forkReportBubble');
  _bubble.setAttribute('aria-label', _t('forkReportTitle'));
  _bubble.setAttribute('aria-expanded', 'false');
  _bubble.addEventListener('click', () => (_isOpen() ? _close() : _open()));

  _card = $el('div', 'fr-card');
  _card.hidden = true;
  _card.setAttribute('role', 'dialog');
  _card.setAttribute('aria-label', _t('forkReportTitle'));
  _card.innerHTML = `
    <div class="fr-form">
      <div class="fr-head"><b class="fr-title"></b><button type="button" class="fr-x" aria-label="">✕</button></div>
      <textarea class="fr-text" rows="4" maxlength="3500"></textarea>
      <input class="fr-name" type="text" maxlength="60" autocomplete="off">
      <div class="fr-shot">
        <img class="fr-shot-img" alt="">
        <button type="button" class="fr-btn fr-shot-take"></button>
        <button type="button" class="fr-btn fr-shot-drop"></button>
      </div>
      <p class="fr-auto"></p>
      <p class="fr-status" aria-live="polite"></p>
      <button type="button" class="fr-send"></button>
    </div>
    <div class="fr-sent"><span class="fr-check">✓</span><b></b><p></p></div>`;
  const q = s => _card.querySelector(s);
  _i18n(q('.fr-title'), 'forkReportTitle');
  q('.fr-x').setAttribute('aria-label', _t('forkReportClose'));
  q('.fr-x').addEventListener('click', _close);
  _text = q('.fr-text'); _i18nPh(_text, 'forkReportPlaceholder');
  _name = q('.fr-name'); _i18nPh(_name, 'forkReportName');
  try { _name.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* private mode */ }
  _shotRow = q('.fr-shot'); _shotImg = q('.fr-shot-img');
  const take = _shotTake = q('.fr-shot-take');
  _i18n(take, 'forkReportCapture');
  take.addEventListener('click', _capture);
  const drop = q('.fr-shot-drop');
  _i18n(drop, 'forkReportRemove');
  drop.addEventListener('click', () => { _image = null; _showShot(); });
  _i18n(q('.fr-auto'), 'forkReportAuto');
  _status = q('.fr-status');
  _sendBtn = q('.fr-send'); _i18n(_sendBtn, 'forkReportSend');
  _sendBtn.addEventListener('click', _send);
  _text.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) _send(); });
  _card.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); _close(); } });
  _i18n(q('.fr-sent b'), 'forkReportSent');
  _i18n(q('.fr-sent p'), 'forkReportSentSub');

  document.body.append(_card, _bubble);
  _showShot();
}

export async function initForkReport({ t } = {}) {
  if (typeof t === 'function') _t = t;
  const api = window.electronAPI?.forkReport;
  if (!api) return;                         // the browser build (Studio Web) has no bubble
  let ok = false;
  try { ok = await api.available(); } catch { ok = false; }
  if (ok) _build();
}
