/* settings.js — business profile, security, backup & data */
import * as DB from '../db.js';
import {
  fmtDate, fmtDateTime, fmtStamp, fmtTime, esc, toast, openModal, closeModal,
  confirmDialog, downloadFile, money, relTime, initials, dateKey,
} from '../util.js';
import * as Cloud from '../cloud.js';
import { pageHead, kpi } from './shared.js';

export const renderSettings = (el, ctx) => {
  const { user } = ctx;
  const admin = user.role === 'admin';
  const s = DB.getSettings();
  const backups = DB.listBackups();
  const store = DB.storageUsage();
  const cloudOn = Cloud.isEnabled();
  const tp = DB.taxProfile();
  const usage = (() => {
    try { return (new Blob([localStorage.getItem('qp_db_v1') || '']).size / 1024).toFixed(1); }
    catch { return '?'; }
  })();

  const booksCard = admin ? `
  <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div><h3>Books, tax &amp; year-end</h3><div class="sub">Closing a year freezes it — nothing dated inside it can be changed again.</div></div>
        <span class="tag ${DB.lockDate() ? 'red' : 'green'}">${DB.lockDate() ? 'Closed to ' + esc(fmtDate(DB.lockDate())) : 'Books open'}</span>
      </div>
      <div class="card-pad">
        <form id="taxForm" class="form-grid">
          <div class="fld"><label>Books closed up to</label>
            <input type="date" name="lockDate" value="${DB.lockDate() ? dateKey(DB.lockDate()) : ''}" max="${dateKey(new Date())}" />
            <span class="hint">Leave empty to keep every year open.</span></div>
          <div class="fld"><label>Company income tax rate (%)</label>
            <input type="number" name="incomeTaxRate" min="0" max="60" step="0.5" value="${tp.incomeTaxRate}" /></div>
          <div class="fld full"><label>VAT position</label>
            <select name="vatScheme">${DB.TAX_SCHEMES.map((x) => `<option value="${x.id}" ${tp.scheme === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
            <span class="hint">Used by the Ghana Tax Register in Statements &amp; Reports.</span></div>
          <div class="fld"><label>TIN (Ghana Revenue Authority)</label>
            <input name="tin" maxlength="20" value="${esc(tp.tin)}" placeholder="C0012345678" /></div>
          <div class="fld"><label>Financial year starts in</label>
            <select name="fiscalStartMonth">${['January','February','March','April','May','June','July','August','September','October','November','December']
              .map((m, i) => `<option value="${i + 1}" ${tp.fiscalStartMonth === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        </form>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn gold" id="saveTax">Save tax settings</button>
          <button class="btn" id="btnCloseYear">Close the books on 31 December</button>
          ${DB.lockDate() ? '<button class="btn danger" id="btnReopen">Re-open the books</button>' : ''}
        </div>
        ${DB.lockDate() ? `<div style="margin-top:12px;font-size:11.5px;color:#a52f22;background:#fdeceb;border-radius:9px;padding:10px 12px;line-height:1.6">
          <b>Closed up to ${esc(fmtDate(DB.lockDate()))}.</b> Sales, expenses, drawings, supplier bills and cash-ups dated on or before that day can no longer be added, edited or deleted. Re-open only to correct a genuine error — the change is written to the activity trail either way.
        </div>` : ''}
      </div>
    </div>

  ` : '';

  el.innerHTML = `
  ${pageHead(admin ? 'Settings &amp; Backup' : 'My Account &amp; Backup',
    admin ? 'Business details, security, backups and data export.' : 'Your login details, backups and app installation.',
    `<button class="btn" data-export>Export backup</button>
     <button class="btn primary" data-install>Install app</button>`)}

  <div class="kpi-grid">
    ${kpi('Signed in as', esc(user.name), `@${esc(user.username)} · ${admin ? 'Administrator' : 'Staff'}`, 'rev txt')}
    ${kpi('Data stored', usage + ' KB', 'on this device', 'net')}
    ${kpi('Last auto-backup', s && DB.load().meta.backupAt ? esc(fmtDate(DB.load().meta.backupAt)) : 'not yet', DB.load().meta.backupAt ? relTime(DB.load().meta.backupAt) : 'runs daily on open', 'stk')}
    ${kpi('Records', String(DB.sales().length + DB.expenses().length + DB.stockItems().length), 'sales, expenses & stock items', 'exp')}
  </div>

  ${cloudCard(user, admin)}

  ${admin ? booksCard : ''}

  <div class="grid-2e" style="margin-bottom:16px">
    ${admin ? `
    <div class="card">
      <div class="card-head"><h3>Business profile</h3><span class="tag gold">Appears on every statement</span></div>
      <div class="card-pad">
        <form id="setForm" class="form-grid">
          <div class="fld full"><label>Business name</label><input name="businessName" value="${esc(s.businessName)}" maxlength="50" /></div>
          <div class="fld full"><label>Tagline</label><input name="tagline" value="${esc(s.tagline)}" maxlength="60" /></div>
          <div class="fld full"><label>Location</label><input name="location" value="${esc(s.location)}" maxlength="80" /></div>
          <div class="fld"><label>Phone 1</label><input name="phone1" value="${esc(s.phone1)}" maxlength="15" /></div>
          <div class="fld"><label>Phone 2</label><input name="phone2" value="${esc(s.phone2)}" maxlength="15" /></div>
          <div class="fld"><label>Staff login limit</label><input name="staffLimit" type="number" min="1" max="50" value="${s.staffLimit}" /></div>
          <div class="fld"><label>Require admin approval</label>
            <select name="requireApproval"><option value="true" ${s.requireApproval ? 'selected' : ''}>Yes — always</option><option value="false" ${!s.requireApproval ? 'selected' : ''}>No</option></select>
            <span class="hint">Recommended: keep approvals on.</span></div>
        </form>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn gold" id="saveSettings">Save profile</button>
          <button class="btn" data-changepin>Change my PIN</button>
          <button class="btn" data-my-sessions>My sign-in history</button>
        </div>
      </div>
    </div>` : `
    <div class="card">
      <div class="card-head"><h3>My login</h3>${admin ? '' : '<span class="tag blue">Staff</span>'}</div>
      <div class="card-pad">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <div class="avatar" style="width:46px;height:46px;font-size:17px">${esc(initials(user.name))}</div>
          <div><b style="color:#0a1931">${esc(user.name)}</b><div style="font-size:11.5px;color:#6b7a90">@${esc(user.username)} · ${esc(user.mobile || 'no mobile')}</div></div>
        </div>
        <div style="font-size:12.4px;color:#3d4a61;line-height:1.9">
          <div style="display:flex;justify-content:space-between"><span style="color:#6b7a90">Status</span><b>Active</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#6b7a90">Joined</span><b>${esc(fmtDate(user.createdAt))}</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#6b7a90">Last sign-in</span><b>${user.lastLogin ? esc(fmtDateTime(user.lastLogin)) : '—'}</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#6b7a90">Sign-ins</span><b>${user.loginCount || 1}</b></div>
        </div>
        <button class="btn gold" data-changepin style="margin-top:14px">Change my PIN</button>
        <button class="btn" data-my-sessions style="margin-top:8px">My sign-in history</button>
      </div>
    </div>`}

    <div class="stack">
      <div class="card">
        <div class="card-head"><h3>Backup &amp; restore</h3><span class="tag ${backups.length ? 'green' : 'amber'}">${backups.length} snapshot(s)</span></div>
        <div class="card-pad" style="font-size:12.3px;color:#3d4a61;line-height:1.7">
          <p style="margin:0 0 12px">${cloudOn
            ? 'Your records live in the shared database and every device keeps a copy. These snapshots are extra insurance on this device — export one to Google Drive weekly.'
            : 'Automatic snapshots are kept on this device (the last three). For total safety, export a backup file weekly and keep it in Google Drive or WhatsApp it to yourself.'}</p>
          <div class="store-meter ${store.pct >= 85 ? 'danger' : store.pct >= 70 ? 'warn' : ''}">
            <div class="store-row"><b>Device storage</b><span>${(store.chars / 1024 / 1024).toFixed(2)} MB of 5 MB used · ${store.pct}%</span></div>
            <div class="store-bar"><i style="width:${Math.max(2, store.pct)}%"></i></div>
            <div class="store-note">${store.pct >= 85
              ? 'Nearly full. Export a backup file now and keep it in Google Drive — the books are safe in the file even if this device runs out.'
              : store.pct >= 70
                ? 'Getting full. Export a backup file and keep it safe; snapshots no longer eat this budget, so growth is only your own entries.'
                : 'Snapshots are stored outside this budget, so your books keep almost all of the 5 MB this browser allows.'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button class="btn sm gold" data-export>Export backup file</button>
            <button class="btn sm" data-import>Restore from file</button>
            <button class="btn sm" data-snapshot>Snapshot now</button>
          </div>
          ${backups.length ? backups.map((b) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dotted #e4e9f2">
              <div><b style="font-size:12px">${esc(fmtDateTime(b.at))}</b><div style="font-size:10.6px;color:#6b7a90">${(b.size / 1024).toFixed(1)} KB</div></div>
              <button class="btn sm" data-restore="${esc(b.at)}">Restore</button>
            </div>`).join('') : '<div style="font-size:12px;color:#6b7a90">No snapshots yet — one is created automatically each day you open the app.</div>'}
        </div>
      </div>

      ${admin ? `
      <div class="card">
        <div class="card-head"><h3>Danger zone</h3><span class="tag red">Careful</span></div>
        <div class="card-pad" style="font-size:12.3px;color:#3d4a61;line-height:1.7">
          <p style="margin:0 0 10px">Clear all sales, expenses, stock and logins on this device. Export a backup first — this cannot be undone.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn sm danger" data-wipe>Erase all data</button>
            <button class="btn sm" data-seed>Reload stock catalogue</button>
          </div>
        </div>
      </div>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h3>Offline &amp; installation</h3><span class="tag blue">Works without data</span></div>
    <div class="card-pad" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;font-size:12.3px;color:#3d4a61;line-height:1.8">
      <div>
        <b style="color:#0a1931">Android (Chrome)</b>
        <div style="margin-top:5px">Open the site → tap <b>⋮</b> → <b>Install app</b>. The Q icon lands on your home screen and opens full-screen, even with no network.</div>
      </div>
      <div>
        <b style="color:#0a1931">iPhone / iPad (Safari)</b>
        <div style="margin-top:5px">Tap <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>. Launch it from the home screen to work offline.</div>
      </div>
      <div>
        <b style="color:#0a1931">Windows or Linux laptop (Chrome / Edge)</b>
        <div style="margin-top:5px">Open the site, then click the <b>install icon</b> in the address bar (a small screen with an arrow), or <b>⋮</b> → <b>Apps</b> → <b>Install this site as an app</b>. It opens in its own window and pins to the taskbar or Start menu.</div>
      </div>
      <div>
        <b style="color:#0a1931">Mac laptop (Chrome or Safari 17+)</b>
        <div style="margin-top:5px">Chrome: <b>⋮</b> → <b>Cast, save and share</b> → <b>Install page as app</b>. Safari: <b>File</b> → <b>Add to Dock</b>. Use Firefox in a normal tab — it cannot install web apps.</div>
      </div>
      <div>
        <b style="color:#0a1931">How offline storage works</b>
        <div style="margin-top:5px">${cloudOn
          ? 'Entries are written to this device instantly, then uploaded when a signal returns. A lost network never loses a sale — the queue catches up automatically.'
          : 'Entries are written to this device immediately, so a lost signal never loses a sale. Each device keeps its own copy — export a backup to move data between phones.'}</div>
      </div>
      <div>
        <b style="color:#0a1931">${cloudOn ? 'How the shared books work' : 'Multi-device tip'}</b>
        <div style="margin-top:5px">${cloudOn
          ? 'Every phone and tablet sees the same sales, expenses and stock within about ten seconds. Approve a login once and it works on every device.'
          : 'Keep one “master” device for the shop and export a weekly backup. Importing that file on another device brings every record across.'}</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:16px" id="linesCard">
    <div class="card-head">
      <div><h3>Revenue &amp; expenditure lines</h3><div class="sub">Your chart of accounts — edit it freely; new lines added while recording a sale or expense appear here too</div></div>
      <span class="tag gold">${DB.SERVICES.length} revenue · ${DB.EXPENSE_CATEGORIES.length} expense</span>
    </div>
    <div class="card-pad cloud-form-grid" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#12855f;font-weight:800">Revenue lines</div>
          ${admin ? '<button class="btn sm gold" data-add-line="service">+ Add revenue line</button>' : ''}
        </div>
        ${DB.SERVICES.map((sv) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dotted #e4e9f2;font-size:12.3px">
            <span style="flex:1">${sv.icon || '🧾'} ${esc(sv.name)}</span>
            <span style="color:#6b7a90;font-size:11px;white-space:nowrap">GH₵${Number(sv.price || 0).toFixed(2)} · ${esc(sv.unit || 'job')}</span>
            ${admin ? `<span style="display:flex;gap:4px"><button class="btn sm" data-edit-line="${esc(sv.id)}" title="Rename or reprice">✎</button><button class="btn sm danger" data-del-line="${esc(sv.id)}" title="Remove">✕</button></span>` : ''}
          </div>`).join('')}
        <div style="font-size:11.2px;color:#6b7a90;margin-top:10px;line-height:1.6">Payments: Cash · MoMo · Bank Transfer · Credit (Unpaid)</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#c0392b;font-weight:800">Expenditure lines</div>
          ${admin ? '<button class="btn sm gold" data-add-line="expense">+ Add expenditure line</button>' : ''}
        </div>
        ${DB.EXPENSE_CATEGORIES.map((c) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dotted #e4e9f2;font-size:12.3px">
            <span style="flex:1">${esc(c)}${c === DB.DRAWINGS_LINE ? ' <span class="tag gold" style="font-size:9px">CAPITAL</span>' : ''}</span>
            ${admin && c !== DB.DRAWINGS_LINE ? `<button class="btn sm danger" data-del-cat="${esc(c)}" title="Remove">✕</button>` : ''}
          </div>`).join('')}
        <div style="font-size:11.2px;color:#6b7a90;margin-top:10px;line-height:1.6">
          Owner's capital is recorded separately. <b>${esc(DB.DRAWINGS_LINE)}</b> shows in the expense register but is kept out of profit — as it should be.
        </div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>About this suite</h3><span class="tag gold">v1.10.0 · ${cloudOn ? 'live cloud' : 'standalone'}</span></div>
    <div class="card-pad" style="font-size:12.3px;color:#3d4a61;line-height:1.8">
      <b style="color:#0a1931">Quarsh's Printing Hub — Business Suite.</b>
      Sales &amp; revenue for every service line, a live expense ledger, stock control, a fixed asset register with monthly depreciation, daily statements,
      profit &amp; loss, balance sheet, cash flow, period comparisons, staff oversight and a permanent activity trail.
      Built mobile-first for Ho, Barracks Newtown — Zoomlion Junction.
      <div style="margin-top:10px;color:#6b7a90;font-size:11.5px">Data owner: ${esc(DB.users().find((u) => u.role === 'admin')?.name || '—')}</div>
    </div>
  </div>`;

  wireLines(el, ctx);

  if (admin) {
    el.querySelector('#saveSettings').onclick = () => {
      const f = el.querySelector('#setForm');
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f).entries());
      DB.setSettings({
        businessName: d.businessName.trim().toUpperCase(),
        tagline: d.tagline, location: d.location, phone1: d.phone1, phone2: d.phone2,
        staffLimit: Math.max(1, Number(d.staffLimit) || 10),
        requireApproval: d.requireApproval === 'true',
      }, user);
      toast('Business profile saved', 'ok');
      ctx.refresh();
    };
  }
  const saveTax = el.querySelector('#saveTax');
  if (saveTax) {
    saveTax.onclick = () => {
      const f = el.querySelector('#taxForm');
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f).entries());
      try {
        DB.setTaxProfile({
          vatScheme: d.vatScheme, tin: d.tin,
          incomeTaxRate: Number(d.incomeTaxRate) || 0,
          fiscalStartMonth: Number(d.fiscalStartMonth) || 1,
        }, user);
        // the lock date is handled on its own so the trail records closing and re-opening separately
        const want = d.lockDate ? new Date(d.lockDate + 'T23:59:59').toISOString() : null;
        const now = DB.load().settings.lockDate || null;
        if ((want || null) !== now) DB.setLockDate(want, user);
        toast(want ? `Books closed up to ${fmtDate(want)}` : 'Books open — every year editable', 'ok');
        ctx.refresh();
      } catch (e) { toast(e.message, 'err'); }
    };
  }
  const closeYear = el.querySelector('#btnCloseYear');
  if (closeYear) {
    closeYear.onclick = async () => {
      const y = new Date().getFullYear();
      const at = new Date(y, 11, 31, 23, 59, 59);
      const ok = await confirmDialog({
        title: `Close the ${y} books?`,
        body: `Everything dated up to <b>31 December ${y}</b> becomes read-only. You can re-open later if a real error has to be corrected, and the change is logged.`,
        confirm: 'Close the year', danger: true,
      });
      if (!ok) return;
      try { DB.setLockDate(at.toISOString(), user); toast(`Books closed to 31 Dec ${y}`, 'ok'); ctx.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    };
  }
  const reopen = el.querySelector('#btnReopen');
  if (reopen) {
    reopen.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Re-open the closed books?',
        body: 'Entries dated inside the closed period will become editable again. Only do this to correct a genuine error — the activity trail keeps a record of the change.',
        confirm: 'Re-open', danger: true,
      });
      if (!ok) return;
      try { DB.setLockDate(null, user); toast('Books re-opened', 'ok'); ctx.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  const cp = el.querySelector('[data-changepin]');
  if (cp) cp.onclick = () => openChangePin(ctx);
  const sess = el.querySelector('[data-my-sessions]');
  if (sess) sess.onclick = () => openMySessions(ctx);

  el.querySelectorAll('[data-install]').forEach((b) => {
    b.onclick = () => (document.getElementById('btnInstallTop') || { click() {} }).click();
  });
  el.querySelectorAll('[data-export]').forEach((b) => {
    b.onclick = () => {
      downloadFile(`Quarshs-Press-Backup-${new Date().toISOString().slice(0, 10)}.json`, DB.exportJSON(), 'application/json');
      DB.log('admin', 'Backup exported', 'Full database backup downloaded', user);
      toast('Backup file downloaded — keep it safe', 'ok');
    };
  });
  el.querySelectorAll('[data-import]').forEach((b) => {
    b.onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const file = inp.files[0];
        if (!file) return;
        const txt = await file.text();
        const ok = await confirmDialog({
          title: 'Restore this backup?',
          body: `Everything currently on this device will be replaced by <b>${esc(file.name)}</b>. Export a backup first if you are unsure.`,
          confirm: 'Restore backup',
        });
        if (!ok) return;
        try {
          DB.importJSON(txt);
          DB.log('admin', 'Backup restored', file.name, user);
          toast('Backup restored', 'ok');
          ctx.refresh();
        } catch (e) { toast(e.message, 'err'); }
      };
      inp.click();
    };
  });
  el.querySelectorAll('[data-snapshot]').forEach((b) => {
    b.onclick = () => {
      DB.load().meta.backupAt = null;
      const made = DB.autoBackup();
      toast(made ? 'Snapshot saved on this device' : 'Snapshot already taken today', 'ok');
      ctx.refresh();
    };
  });
  el.querySelectorAll('[data-restore]').forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Restore this snapshot?',
        body: `<b>${esc(fmtDateTime(b.dataset.restore))}</b> will replace the current data on this device.`,
        confirm: 'Restore snapshot',
      });
      if (!ok) return;
      try {
        await DB.restoreBackup(b.dataset.restore);
        toast('Snapshot restored', 'ok');
        ctx.refresh();
      } catch (e) { toast(e.message, 'err'); }
    };
  });
  const wipe = el.querySelector('[data-wipe]');
  if (wipe) wipe.onclick = async () => {
    const ok = await confirmDialog({
      title: 'Erase everything?',
      body: 'All sales, expenses, stock, logins and settings on this device will be deleted and the app returns to first-time setup.<br><br><b>Export a backup first.</b>',
      confirm: 'Erase all data', danger: true,
    });
    if (!ok) return;
    DB.resetAll();
    sessionStorage.removeItem('qp_session');
    location.reload();
  };
  wireCloudCard(el, ctx);

  const seed = el.querySelector('[data-seed]');
  if (seed) seed.onclick = () => {
    DB.load().meta.seeded = false;
    const made = DB.seedStock(user);
    if (!made) { DB.load().meta.seeded = true; toast('Stock catalogue already loaded', ''); }
    else toast('Stock catalogue reloaded', 'ok');
    ctx.refresh();
  };
};

const openChangePin = (ctx) => {
  const cloudOn = Cloud.isEnabled();
  const tp = DB.taxProfile();
  const card = openModal(`
    <div class="modal-head"><h3>Change my PIN</h3><button class="x" data-close>✕</button></div>
    <div class="modal-body">
      <p style="margin:0 0 14px;font-size:12.5px;color:#3d4a61;line-height:1.7">
        Choose something you will remember but others cannot guess. Avoid 1234 and your birth year.
        ${cloudOn ? 'Your new PIN updates your phone and the shared database in one step.' : ''}
      </p>
      <form id="cpForm" class="form-grid">
        <div class="fld full"><label>Current PIN</label><input name="old" type="password" inputmode="numeric" maxlength="6" required /></div>
        <div class="fld"><label>New PIN</label><input name="pin" type="password" inputmode="numeric" maxlength="6" required /></div>
        <div class="fld"><label>Confirm new PIN</label><input name="pin2" type="password" inputmode="numeric" maxlength="6" required /></div>
      </form>
      <p id="cpMsg" style="min-height:16px;font-size:11.8px;color:#c0392b;margin:10px 0 0"></p>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn gold" id="saveCp">Update PIN</button></div>`);

  card.querySelector('#saveCp').onclick = async () => {
    const f = card.querySelector('#cpForm');
    const msg = card.querySelector('#cpMsg');
    const btn = card.querySelector('#saveCp');
    msg.textContent = '';
    if (!f.reportValidity()) return;
    if (!/^\d{4,6}$/.test(f.pin.value)) { msg.textContent = 'New PIN must be 4–6 digits.'; return; }
    if (f.pin.value !== f.pin2.value) { msg.textContent = 'New PINs do not match.'; return; }
    btn.disabled = true;
    btn.textContent = 'Updating…';
    try {
      await DB.authenticate(ctx.user.username, f.old.value);
      await DB.setPin(ctx.user.id, f.pin.value, ctx.user);
      DB.log('admin', 'PIN changed', `${ctx.user.name} changed their own PIN`, ctx.user);
      if (cloudOn) {
        try {
          await Cloud.updatePassword(f.pin.value);
        } catch (e) {
          msg.style.color = '#94621a';
          msg.textContent = 'PIN changed on this device. Sign in again when you have a signal to update the shared database.';
          btn.disabled = false;
          btn.textContent = 'Update PIN';
          return;
        }
        await DB.ensureOfflineCredential(ctx.user.id, f.pin.value);
        Cloud.sync().catch(() => {});
      }
      closeModal();
      toast('PIN updated — use the new PIN next time', 'ok');
    } catch (e) {
      msg.textContent = 'Current PIN is incorrect.';
      btn.disabled = false;
      btn.textContent = 'Update PIN';
    }
  };
};

/* ── a person's own sign-in history ── */
const openMySessions = (ctx) => {
  const me = ctx.user;
  const mine = DB.load().logs
    .filter((l) => l.userId === me.id && ['login', 'logout', 'reset'].includes(l.type))
    .slice(0, 60);
  openModal(`
    <div class="modal-head"><h3>My sign-in history</h3><button class="x" data-close>✕</button></div>
    <div class="modal-body">
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div style="flex:1;min-width:120px"><div class="kpi" style="padding:12px"><div class="label">Sign-ins</div><div class="val sm">${me.loginCount || mine.filter(l => l.type === 'login').length}</div></div></div>
        <div style="flex:1;min-width:120px"><div class="kpi" style="padding:12px"><div class="label">Last sign-in</div><div class="val sm" style="font-size:13px">${me.lastLogin ? esc(fmtDateTime(me.lastLogin)) : '—'}</div></div></div>
      </div>
      ${mine.length ? mine.map((l) => `
        <div class="audit-row" style="padding-left:0;padding-right:0">
          <span class="audit-time">${esc(fmtDate(l.at))}<br>${esc(fmtTime(l.at))}</span>
          <span class="audit-badge ${esc(l.type)}">${esc(l.type)}</span>
          <span style="flex:1"><b style="color:#0a1931">${esc(l.action)}</b><br><span style="color:#6b7a90;font-size:11px">${esc(l.detail || '')}</span></span>
        </div>`).join('') : '<div style="font-size:12.5px;color:#6b7a90">No sign-in history on this device yet.</div>'}
    </div>
    <div class="modal-foot"><button class="btn primary" data-close>Close</button></div>`, { wide: true });
};


/* ══════════════ cloud sync card ══════════════ */
const cloudCard = (user, admin) => {
  const on = Cloud.isEnabled();
  const cfg = Cloud.getConfig() || {};
  const sess = Cloud.session();
  const st = Cloud.status;
  const state = !on ? 'off' : !sess ? 'no-session' : st.state;
  const badge = {
    off: ['grey', 'Not connected'],
    'no-session': ['amber', 'Connected · sign in needed'],
    idle: ['gold', 'Connected'],
    syncing: ['blue', 'Syncing…'],
    synced: ['green', 'Live · all devices in sync'],
    offline: ['amber', 'Offline — queueing'],
    error: ['red', 'Sync error'],
  }[state] || ['grey', state];

  const rows = on && sess ? [
    ['Database', esc(String(cfg.url || '').replace(/^https?:\/\//, ''))],
    ['Signed in as', esc(Cloud.currentUser()?.email || '—')],
    ['Last sync', st.lastSync ? esc(fmtDateTime(st.lastSync)) : 'not yet'],
    ['Waiting to upload', String(Cloud.status.pending || 0) + ' change(s)'],
    ['Mode', 'Offline-first · syncs automatically every 10s'],
  ] : [];

  return `
  <div class="card" style="margin-bottom:16px;border-left:3px solid ${on && sess ? '#12855f' : '#d4af37'}">
    <div class="card-head">
      <div>
        <h3>Live cloud sync — one database, every phone</h3>
        <div class="sub">${on ? 'All devices share the same live books. The app still works offline and uploads when a signal returns.' : 'Connect a free Supabase project so the shop phone, the counter tablet and your own phone all see the same data instantly.'}</div>
      </div>
      <span class="tag ${badge[0]}">${badge[1]}</span>
    </div>
    <div class="card-pad">
      ${!on && Cloud.isPreconfigured() ? `
        <div style="font-size:12.6px;color:#3d4a61;line-height:1.8">
          <b style="color:#0a1931">This app ships already pointed at the shop's database.</b>
          <div style="margin-top:6px">Reconnecting re-attaches this phone to <b>${esc(String(Cloud.preconfigured().url || '').replace(/^https?:\/\//, ''))}</b> — no keys to type.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn gold" data-auto-connect>Reconnect to the shop database</button>
          </div>
          <p id="cloudMsg" style="min-height:15px;font-size:11.5px;color:#c0392b;margin:8px 0 0"></p>
        </div>` : !on ? `
        <div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px" class="cloud-form-grid">
          <div>
            <div style="font-size:12.4px;color:#3d4a61;line-height:1.85">
              <b style="color:#0a1931">Four steps, about 4 minutes</b>
              <div style="display:flex;gap:8px;margin-top:8px"><b style="color:#8a6a1c">1.</b><div>Create a free project at <b>supabase.com</b> (no card required).</div></div>
              <div style="display:flex;gap:8px;margin-top:6px"><b style="color:#8a6a1c">2.</b><div>Open <b>SQL Editor</b>, paste the setup script and run it. <button class="btn sm" data-copy-schema style="margin-left:6px">Copy setup script</button></div></div>
              <div style="display:flex;gap:8px;margin-top:6px"><b style="color:#8a6a1c">3.</b><div>In <b>Authentication → Providers → Email</b>, switch <b>off</b> “Confirm email”.</div></div>
              <div style="display:flex;gap:8px;margin-top:6px"><b style="color:#8a6a1c">4.</b><div>Copy <b>Project URL</b> and the <b>anon public</b> key from <b>Settings → API</b> into the boxes here.</div></div>
              <div style="margin-top:12px;background:#f7f9fd;border-radius:9px;padding:10px 12px;font-size:11.4px;color:#4a5c7c;line-height:1.6">
                Your PIN is used to create your cloud account the first time — it never leaves the device unencrypted.
              </div>
            </div>
          </div>
          <div>
            <form id="cloudForm" style="display:flex;flex-direction:column;gap:10px">
              <div class="fld"><label>Project URL</label><input name="url" placeholder="https://xxxxxxxx.supabase.co" required /></div>
              <div class="fld"><label>Anon public key</label><input name="key" placeholder="eyJhbGciOi..." required /></div>
              <div class="fld"><label>Your PIN (to create your cloud account)</label><input name="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" required /></div>
              <button class="btn gold" type="submit" id="cloudConnectBtn">Connect &amp; go live</button>
              <button class="btn sm" type="button" data-cloud-docs>How to set up Supabase</button>
              <p id="cloudMsg" style="min-height:15px;font-size:11.5px;color:#c0392b;margin:0"></p>
            </form>
          </div>
        </div>` : `
        <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px" class="cloud-form-grid">
          <div>
            ${rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dotted #e4e9f2;font-size:12.4px"><span style="color:#6b7a90">${k}</span><b style="color:#0a1931;text-align:right;overflow-wrap:anywhere">${v}</b></div>`).join('')}
            ${!sess ? '<div style="margin-top:10px;font-size:12px;color:#94621a">Sign out and sign in again to attach this device to the shared database.</div>' : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn gold" data-sync-now>Sync now</button>
            <button class="btn" data-cloud-full>Re-upload this device's records</button>
            <button class="btn" data-copy-schema>Copy database setup script</button>
            ${admin ? '<button class="btn danger" data-cloud-off>Disconnect cloud</button>' : ''}
            <div style="font-size:11.4px;color:#6b7a90;line-height:1.6;margin-top:4px">
              Disconnecting returns this device to standalone mode. Records already uploaded stay in the cloud.
            </div>
          </div>
        </div>`}
    </div>
  </div>`;
};

/* ── revenue / expenditure line editor ─────────────────── */
const wireLines = (el, ctx) => {
  const { user } = ctx;
  if (!user || user.role !== 'admin') return;

  const openEditor = (svc = null) => {
    const isNew = !svc;
    const card = openModal(`
      <div class="modal-head"><h3>${isNew ? 'Add a revenue line' : 'Edit revenue line'}</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body">
        <form id="lineForm" class="form-grid">
          <div class="fld full"><label>Line name</label><input name="name" maxlength="60" value="${esc(svc?.name || '')}" placeholder="e.g. ID card printing" required /></div>
          <div class="fld"><label>Icon</label><input name="icon" maxlength="4" value="${esc(svc?.icon || '🧾')}" /></div>
          <div class="fld"><label>Unit</label><input name="unit" maxlength="18" value="${esc(svc?.unit || 'job')}" placeholder="page / copy / job" /></div>
          <div class="fld"><label>Default price (GH₵)</label><input name="price" type="number" min="0" step="0.01" value="${svc?.price ?? 0}" /></div>
        </form>
        <div style="margin-top:12px;background:#f7f9fd;border-radius:10px;padding:11px 13px;font-size:11.5px;color:#4a5c7c;line-height:1.6">
          This line appears on the sales form, in every statement and on all approved phones.
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn gold" id="saveLine">${isNew ? 'Add line' : 'Save changes'}</button>
      </div>`);
    const f = card.querySelector('#lineForm');
    card.querySelector('#saveLine').onclick = () => {
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f).entries());
      try {
        if (isNew) DB.addService({ name: d.name, icon: d.icon, unit: d.unit, price: d.price }, user);
        else DB.updateService(svc.id, { name: d.name, icon: d.icon, unit: d.unit, price: d.price }, user);
        closeModal();
        toast(isNew ? 'Revenue line added' : 'Revenue line updated', 'ok');
        ctx.refresh();
      } catch (e) { toast(e.message, 'err'); }
    };
  };

  const openCatEditor = () => {
    const card = openModal(`
      <div class="modal-head"><h3>Add an expenditure line</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body">
        <form id="catForm">
          <div class="fld"><label>Line name</label><input name="name" maxlength="60" placeholder="e.g. Printing machine lease" required /></div>
        </form>
        <div style="margin-top:12px;background:#f7f9fd;border-radius:10px;padding:11px 13px;font-size:11.5px;color:#4a5c7c;line-height:1.6">
          It appears on the expense form, the P&amp;L and the trial balance straight away.
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn gold" id="saveCat">Add line</button>
      </div>`);
    const f = card.querySelector('#catForm');
    card.querySelector('#saveCat').onclick = () => {
      if (!f.reportValidity()) return;
      try {
        DB.addExpenseLine(f.name.value, user);
        closeModal();
        toast('Expenditure line added', 'ok');
        ctx.refresh();
      } catch (e) { toast(e.message, 'err'); }
    };
  };

  el.querySelectorAll('[data-add-line="service"]').forEach((b) => { b.onclick = () => openEditor(); });
  el.querySelectorAll('[data-add-line="expense"]').forEach((b) => { b.onclick = () => openCatEditor(); });
  el.querySelectorAll('[data-edit-line]').forEach((b) => {
    b.onclick = () => openEditor(DB.serviceById(b.dataset.editLine));
  });
  el.querySelectorAll('[data-del-line]').forEach((b) => {
    b.onclick = async () => {
      const svc = DB.serviceById(b.dataset.delLine);
      if (!svc) return;
      const ok = await confirmDialog({
        title: 'Remove this revenue line?',
        body: `<b>${esc(svc.name)}</b> will disappear from the sales form. Sales already recorded keep their name and amount in the books and statements.<br><br>You can add it back any time.`,
        confirm: 'Remove line', danger: true,
      });
      if (!ok) return;
      try { DB.deleteService(svc.id, user); toast('Revenue line removed', 'ok'); ctx.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    };
  });
  el.querySelectorAll('[data-del-cat]').forEach((b) => {
    b.onclick = async () => {
      const name = b.dataset.delCat;
      const ok = await confirmDialog({
        title: 'Remove this expenditure line?',
        body: `<b>${esc(name)}</b> will disappear from the expense form. Past entries keep their record and still appear in the statements.<br><br>You can add it back any time.`,
        confirm: 'Remove line', danger: true,
      });
      if (!ok) return;
      try { DB.deleteExpenseLine(name, user); toast('Expenditure line removed', 'ok'); ctx.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    };
  });
};

const wireCloudCard = (el, ctx) => {
  const { user } = ctx;
  const copySchema = async () => {
    let sql = '';
    try {
      const res = await fetch('./supabase/schema.sql');
      sql = await res.text();
    } catch { sql = ''; }
    if (!sql) {
      toast('Could not load the script — open supabase/schema.sql in the project folder', 'err');
      return;
    }
    try {
      await navigator.clipboard.writeText(sql);
      toast('Database setup script copied — paste it in the Supabase SQL Editor', 'ok');
      return;
    } catch { /* clipboard blocked (in-app preview) — fall back to a copyable panel */ }
    openModal(`
      <div class="modal-head"><h3>Database setup script</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body">
        <p style="font-size:12.4px;color:#3d4a61;margin-top:0">Select everything below, copy it, and paste it into <b>Supabase → SQL Editor</b>, then press <b>Run</b>.</p>
        <textarea readonly style="width:100%;height:300px;font-family:var(--mono);font-size:11px;border:1px solid #dde4ef;border-radius:9px;padding:10px;background:#fbfcff;color:#101a2c">${esc(sql)}</textarea>
      </div>
      <div class="modal-foot"><button class="btn primary" data-close>Done</button></div>`, { wide: true });
    const ta = document.querySelector('#modalCard textarea');
    if (ta) setTimeout(() => ta.select(), 120);
  };
  el.querySelectorAll('[data-copy-schema]').forEach((b) => { b.onclick = () => copySchema(); });
  el.querySelectorAll('[data-auto-connect]').forEach((b) => {
    b.onclick = async () => {
      const msg = el.querySelector('#cloudMsg');
      b.disabled = true;
      try {
        const cfg = await Cloud.connectPreconfigured();
        if (!cfg) throw new Error('No shop key is built into this copy of the app.');
        toast('Reconnected to the shop database', 'ok');
        ctx.refresh();
      } catch (e) {
        if (msg) msg.textContent = e.message;
        b.disabled = false;
      }
    };
  });
  el.querySelectorAll('[data-cloud-docs]').forEach((b) => {
    b.onclick = () => openModal(`
      <div class="modal-head"><h3>Connect the shared database</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body" style="font-size:12.8px;line-height:1.8;color:#3d4a61">
        <ol style="padding-left:18px;margin:0">
          <li>Go to <b>supabase.com</b> → <b>New project</b>. Name it <b>quarshs-press</b>, choose the free plan, set a database password and pick the region closest to Ghana (e.g. <i>West EU</i>).</li>
          <li>Open <b>SQL Editor → New query</b>. Tap <b>Copy setup script</b> above, paste, then <b>Run</b>. This creates the tables and locks them down so only approved staff can read or write.</li>
          <li>Go to <b>Authentication → Providers → Email</b> and switch <b>Confirm email</b> off, then save. Staff are identified by mobile number, so no inbox is needed.</li>
          <li>Open <b>Settings → API</b> and copy the <b>Project URL</b> and the <b>anon public</b> key into the two boxes.</li>
          <li>Enter your PIN and tap <b>Connect &amp; go live</b>. Your existing records upload automatically.</li>
        </ol>
        <div style="margin-top:14px;background:#f7f9fd;border-radius:10px;padding:12px;font-size:11.8px;line-height:1.7">
          <b>What happens next:</b> every sale, expense, stock movement and login approval is written locally first,
          then pushed to the cloud within seconds. Other devices pull the same changes, so the books match everywhere.
          If the internet drops, the app keeps working and catches up later.
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary" data-close>Got it</button></div>`);
  });

  const form = el.querySelector('#cloudForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const msg = el.querySelector('#cloudMsg');
      const btn = el.querySelector('#cloudConnectBtn');
      msg.style.color = '#c0392b';
      msg.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Connecting…';
      try {
        const fd = new FormData(form);
        await Cloud.connect({ url: fd.get('url'), key: fd.get('key') });
        // create or attach the cloud account for the signed-in administrator
        let sess;
        try {
          const res = await Cloud.signUp({
            name: user.name, username: user.username, mobile: user.mobile, pin: fd.get('pin'),
          });
          if (res.needsConfirm) throw new Error('Cloud still requires email confirmation — switch it off in Authentication → Providers → Email.');
          sess = res.session;
        } catch (err) {
          if (/already|registered|exists/i.test(err.message)) {
            await Cloud.signInPassword(user.username, fd.get('pin'));
          } else throw err;
        }
        const prof = await Cloud.myProfile();
        if (prof) {
          if (user.id !== prof.id) DB.linkUserIdentity(user.id, prof.id);
          DB.upsertUserFromProfile(prof);
          const fresh = DB.users().find((u) => u.id === prof.id);
          if (fresh) { sessionStorage.setItem('qp_session', fresh.id); ctx.user = fresh; }
        }
        const res = await Cloud.sync({ full: true });
        if (res.error) throw new Error(res.error);
        toast('Cloud connected — this device is now live on the shared database', 'ok');
        ctx.refresh();
      } catch (err) {
        msg.textContent = err.message;
        btn.disabled = false;
        btn.textContent = 'Connect & go live';
      }
    };
  }

  el.querySelectorAll('[data-sync-now]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Syncing…';
      const res = await Cloud.sync();
      b.disabled = false; b.textContent = 'Sync now';
      if (res.error) toast(res.error, 'err');
      else toast(`Synced — ${res.pushed || 0} up, ${res.pulled || 0} down`, 'ok');
      ctx.refresh();
    };
  });
  el.querySelectorAll('[data-cloud-full]').forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Re-upload this device?',
        body: 'Every record on this device will be pushed with a fresh timestamp. Use this when a device was offline for a long time. It does not delete anything.',
        confirm: 'Upload now',
      });
      if (!ok) return;
      const res = await Cloud.sync({ full: true });
      toast(res.error ? res.error : 'Upload complete', res.error ? 'err' : 'ok');
      ctx.refresh();
    };
  });
  el.querySelectorAll('[data-cloud-off]').forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Disconnect the shared database?',
        body: 'This device stops syncing and works standalone again. Your data stays in the cloud for other devices.',
        confirm: 'Disconnect', danger: true,
      });
      if (!ok) return;
      await Cloud.signOut();
      Cloud.disable();
      toast('Cloud disconnected', 'ok');
      ctx.refresh();
    };
  });
};
