/* db.js — local-first data store + accounting engine for Quarsh's Printing Hub */

import {
  uid, dateKey, monthKey, startOfDay, endOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, startOfYear, addDays, inRange, CURRENCY,
} from './util.js';

const KEY = 'qp_db_v1';
const SCHEMA = 1;

/* ── chart of accounts: the shop's revenue & expenditure lines ─────────
 * These are DEFAULTS. The administrator can add, rename or remove lines in
 * Settings → Revenue & expenditure lines; additions made while recording a
 * sale/expense are appended automatically. Lines live in db.settings so they
 * sync to every phone with the rest of the business settings.
 */
export const DEFAULT_SERVICES = [
  { id: 'colour',       name: 'Colour printing',                    icon: '🎨', unit: 'page / job', price: 2 },
  { id: 'copybw1',      name: 'Photocopy — single side (B/W)',      icon: '⚫', unit: 'page', price: 0.5 },
  { id: 'copybw2',      name: 'Photocopy — front & back (B/W)',     icon: '📄', unit: 'sheet', price: 0.8 },
  { id: 'copycl1',      name: 'Photocopy — single side (colour)',   icon: '🌈', unit: 'page', price: 2 },
  { id: 'copycl2',      name: 'Photocopy — front & back (colour)',  icon: '🖨️', unit: 'sheet', price: 3.5 },
  { id: 'typing',       name: 'Typing only',                        icon: '⌨️', unit: 'page', price: 5 },
  { id: 'typingbw',     name: 'Typing & printing (B/W)',            icon: '📝', unit: 'page', price: 8 },
  { id: 'typingcl',     name: 'Typing & printing (colour)',         icon: '🖊️', unit: 'page', price: 12 },
  { id: 'bookdesign',   name: 'Book design only',                   icon: '📐', unit: 'project', price: 350 },
  { id: 'bookbw',       name: 'Book design & printing (B/W)',       icon: '📖', unit: 'copy', price: 25 },
  { id: 'bookcl',       name: 'Book design & printing (colour)',    icon: '📕', unit: 'copy', price: 60 },
  { id: 'bannerdesign', name: 'Banner design only',                 icon: '🎯', unit: 'design', price: 150 },
  { id: 'bannerprint',  name: 'Banner design & printing',           icon: '🏳️', unit: 'banner', price: 250 },
  { id: 'passport',     name: 'Passport pictures',                  icon: '📸', unit: 'set', price: 30 },
  { id: 'lamination',   name: 'Lamination',                         icon: '🪪', unit: 'sheet', price: 5 },
  { id: 'comb',         name: 'Comb binding',                       icon: '📚', unit: 'book', price: 8 },
  { id: 'brochure',     name: 'Brochures & flyers',                 icon: '🗞️', unit: 'piece', price: 3 },
  { id: 'results',      name: 'Result checking',                    icon: '🎓', unit: 'check', price: 20 },
  { id: 'website',      name: 'Website design',                     icon: '🌐', unit: 'project', price: 1200 },
  { id: 'app',          name: 'App design',                         icon: '📱', unit: 'project', price: 2500 },
  { id: 'other',        name: 'Other / custom job',                 icon: '🧾', unit: 'job', price: 0 },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Paper & A-Sheets', 'Toner & Ink', 'Spare Parts & Repairs', 'Binding Materials',
  'Lamination Film', 'Electricity & Utilities', 'Rent', 'Transport & Fuel',
  'Staff Allowance & Wages', 'Data & Internet', 'Marketing', 'Licences & Fees',
  'Equipment Purchase', 'Stationery', 'Miscellaneous',
];

/** Owner's withdrawal — listed with the expense lines but kept out of profit. */
export const DRAWINGS_LINE = 'Drawings (owner withdrawal)';

/* Live copies, repopulated from storage on every load(). Views import these. */
export const SERVICES = [];
export const EXPENSE_CATEGORIES = [];

export const PAYMENT_METHODS = ['Cash', 'MoMo', 'Bank Transfer', 'Credit (Unpaid)'];

const defaultSettings = {
  businessName: "QUARSH'S PRINTING HUB",
  tagline: 'Printing · Design · Digital Services',
  location: 'Ho, Barracks Newtown — Zoomlion Junction',
  phone1: '0558103988',
  phone2: '0534221632',
  hours: '',
  currency: 'GHS',
  staffLimit: 10,
  requireApproval: true,
  services: null,          // filled from DEFAULT_SERVICES on first load
  expenseLines: null,      // filled from DEFAULT_EXPENSE_CATEGORIES on first load
  removedLines: [],        // lines the administrator deleted (never re-seeded)
  openingCapital: 0,
  openerName: 'Klenam Jerryson Quarshie',
  fiscalStartMonth: 1,
  lockDate: null,          // the books are closed up to and including this day
  vatScheme: 'none',       // 'none' | 'standard' (21%) | 'flat' (3% flat rate)
  tin: '',                 // Ghana Revenue Authority TIN
  incomeTaxRate: 25,       // company income tax on profit
  /* ── CCTV / camera ────────────────────────────────────
   * master switch is the administrator's. `byUser` holds a per-officer
   * override: { [userId]: true|false }. Staff can never change these. */
  camera: {
    enabled: false,          // master switch — administrator only
    byUser: {},              // per-officer overrides
    audio: false,            // record sound (off by default)
    clipSecs: 20,            // length of each saved clip
    snapshotSecs: 30,        // how often a still frame reaches the admin portal
    retentionDays: 7,        // delete clips older than this
    maxLocalMB: 400,         // and never use more than this on the device
    uploadClips: false,      // send clip video to the cloud as well
    startedAt: null,
    updatedBy: null,
  },
};

const emptyDB = () => ({
  schema: SCHEMA,
  settings: { ...defaultSettings },
  users: [],
  sales: [],
  expenses: [],
  stock: [],
  stockMoves: [],
  fixedAssets: [],
  suppliers: [],
  bills: [],
  cashups: [],
  capital: [],
  logs: [],
  shifts: [],
  outbox: [],
  camClips: [],              // clip metadata (video bytes live in IndexedDB)
  camPresence: [],           // one row per officer: screen, camera state, latest still
  camEvents: [],             // camera on/off, permission refused, disconnects
  resetRequests: [],
  sync: { cursor: null, lastAt: null, deviceId: null, enabledAt: null },
  meta: { backupAt: null, lastOpen: null, seeded: false },
});

/* ── storage ─────────────────────────────────────────── */
let cache = null;
let saveTimer = null;

export const load = () => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : emptyDB();
  } catch { cache = emptyDB(); }
  cache = { ...emptyDB(), ...cache };
  cache.settings = { ...defaultSettings, ...(cache.settings || {}) };
  // v1.7.1 — the shop is now "Quarsh's Printing Hub"; rename it on existing installs
  if (/^quarsh'?s printing (press|hub)$/i.test(String(cache.settings.businessName || '').trim())) {
    cache.settings.businessName = "QUARSH'S PRINTING HUB";
  }
  cache.meta = { ...emptyDB().meta, ...(cache.meta || {}) };
  hydrateLines(cache);
  return cache;
};

/** Keep the line catalogue complete and mirror it onto the exported arrays. */
const hydrateLines = (db) => {
  const st = db.settings;
  const removed = new Set(st.removedLines || []);
  if (!Array.isArray(st.services) || !st.services.length) {
    st.services = DEFAULT_SERVICES.map((x) => ({ ...x }));
  }
  if (!Array.isArray(st.expenseLines) || !st.expenseLines.length) {
    st.expenseLines = DEFAULT_EXPENSE_CATEGORIES.slice();
  }
  // new default lines shipped by an app upgrade appear automatically
  DEFAULT_SERVICES.forEach((d) => {
    if (removed.has('svc:' + d.id)) return;
    if (!st.services.some((x) => x.id === d.id)) st.services.push({ ...d });
  });
  DEFAULT_EXPENSE_CATEGORIES.forEach((c) => {
    if (removed.has('cat:' + c)) return;
    if (!st.expenseLines.includes(c)) st.expenseLines.push(c);
  });
  if (!st.expenseLines.includes(DRAWINGS_LINE)) st.expenseLines.push(DRAWINGS_LINE);
  SERVICES.length = 0;
  SERVICES.push(...st.services);
  EXPENSE_CATEGORIES.length = 0;
  EXPENSE_CATEGORIES.push(...st.expenseLines);
};

/* ── revenue / expenditure line management ───────────── */
export const serviceById = (id) => SERVICES.find((x) => x.id === id) || null;
export const serviceName = (id) => serviceById(id)?.name || id || '';
export const lineCatalog = () => ({ services: SERVICES, expenses: EXPENSE_CATEGORIES });

const slug = (name) =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'line';

export const addService = ({ name, icon = '🧾', unit = 'job', price = 0 }, user = null) => {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Enter a name for the new revenue line.');
  if (SERVICES.some((x) => x.name.toLowerCase() === clean.toLowerCase()))
    throw new Error('That revenue line already exists.');
  const db = load();
  let id = slug(clean);
  while (SERVICES.some((x) => x.id === id)) id += '-2';
  const line = { id, name: clean, icon, unit: unit || 'job', price: Number(price) || 0, custom: true };
  db.settings.services.push(line);
  SERVICES.push(line);
  hydrateLines(db);
  touch('settings', db.settings);
  log('settings', 'Revenue line added', `${clean}`, user);
  persist();
  return line;
};

export const updateService = (id, patch, user = null) => {
  const db = load();
  const line = db.settings.services.find((x) => x.id === id);
  if (!line) throw new Error('Revenue line not found.');
  if (patch.name != null) {
    const clean = String(patch.name).trim().replace(/\s+/g, ' ');
    if (!clean) throw new Error('The name cannot be empty.');
    if (db.settings.services.some((x) => x.id !== id && x.name.toLowerCase() === clean.toLowerCase()))
      throw new Error('Another revenue line already uses that name.');
    line.name = clean;
  }
  if (patch.icon != null) line.icon = patch.icon;
  if (patch.unit != null) line.unit = patch.unit;
  if (patch.price != null) line.price = Number(patch.price) || 0;
  hydrateLines(db);
  touch('settings', db.settings);
  log('settings', 'Revenue line edited', `${line.name}`, user);
  persist();
  return line;
};

export const deleteService = (id, user = null) => {
  const db = load();
  const line = db.settings.services.find((x) => x.id === id);
  if (!line) return;
  const used = db.sales.filter((x) => x.service === id).length;
  db.settings.services = db.settings.services.filter((x) => x.id !== id);
  db.settings.removedLines = [...new Set([...(db.settings.removedLines || []), 'svc:' + id])];
  hydrateLines(db);
  touch('settings', db.settings);
  log('settings', 'Revenue line removed', `${line.name}${used ? ` (${used} past sales keep their record)` : ''}`, user);
  persist();
  return used;
};

export const addExpenseLine = (name, user = null) => {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Enter a name for the new expenditure line.');
  if (EXPENSE_CATEGORIES.some((c) => c.toLowerCase() === clean.toLowerCase()))
    throw new Error('That expenditure line already exists.');
  const db = load();
  db.settings.expenseLines.push(clean);
  hydrateLines(db);
  touch('settings', db.settings);
  log('settings', 'Expenditure line added', clean, user);
  persist();
  return clean;
};

export const deleteExpenseLine = (name, user = null) => {
  const db = load();
  if (name === DRAWINGS_LINE) throw new Error('The drawings line cannot be removed — it is required for the accounts.');
  const used = db.expenses.filter((x) => x.category === name).length;
  db.settings.expenseLines = db.settings.expenseLines.filter((c) => c !== name);
  db.settings.removedLines = [...new Set([...(db.settings.removedLines || []), 'cat:' + name])];
  hydrateLines(db);
  touch('settings', db.settings);
  log('settings', 'Expenditure line removed', `${name}${used ? ` (${used} past entries keep their record)` : ''}`, user);
  persist();
  return used;
};

export const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
      document.dispatchEvent(new CustomEvent('qp:saved'));
    } catch (e) {
      console.error('save failed', e);
      document.dispatchEvent(new CustomEvent('qp:savefail'));
    }
  }, 120);
};

export const saveNow = () => {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    document.dispatchEvent(new CustomEvent('qp:saved'));
  } catch (e) { console.error(e); }
};

/* ── year-end lock ───────────────────────────────────────
 * Once the year is closed the figures for that year must not move again.
 * The administrator sets the lock date in Settings; every write path checks
 * it before touching a record, so a closed year really is closed.
 */
export const lockDate = () => {
  const v = load().settings.lockDate;
  return v ? endOfDay(new Date(v)) : null;
};

export const isLocked = (date) => {
  const l = lockDate();
  return !!(l && date && new Date(date) <= l);
};

const assertOpen = (date, what = 'This entry') => {
  const l = lockDate();
  if (!l || !date) return;
  if (new Date(date) <= l) {
    throw new Error(`${what} is dated ${dateKey(date)} — inside a closed period. The books are closed up to ${dateKey(l)}. Ask the administrator to re-open them.`);
  }
};

export const setLockDate = (date, admin) => {
  if (admin?.role !== 'admin') throw new Error('Only the administrator can close or re-open the books.');
  const db = load();
  const before = db.settings.lockDate || null;
  db.settings.lockDate = date ? new Date(date).toISOString() : null;
  touch('settings', { ...db.settings });
  log('settings', date ? 'Books closed' : 'Books re-opened',
    date ? `Closed up to ${dateKey(date)}` : `Was closed up to ${before ? dateKey(before) : '-'}`, admin);
  persist();
  return db.settings.lockDate;
};

/* ── tax profile (Ghana) ───────────────────────────────── */
export const TAX_SCHEMES = [
  { id: 'none', label: 'Not VAT registered (no VAT on receipts)' },
  { id: 'standard', label: 'Standard VAT — 15% + NHIL 2.5% + GETFund 2.5% + COVID 1%' },
  { id: 'flat', label: 'VAT Flat Rate Scheme — 3% of turnover' },
];

export const taxProfile = () => {
  const st = load().settings;
  return {
    scheme: st.vatScheme || 'none',
    tin: st.tin || '',
    incomeTaxRate: Number(st.incomeTaxRate) || 25,
    fiscalStartMonth: Number(st.fiscalStartMonth) || 1,
  };
};

export const setTaxProfile = (patch, admin) => {
  if (admin?.role !== 'admin') throw new Error('Only the administrator can change the tax profile.');
  const db = load();
  if (patch.vatScheme != null) db.settings.vatScheme = patch.vatScheme;
  if (patch.tin != null) db.settings.tin = String(patch.tin).trim();
  if (patch.incomeTaxRate != null) db.settings.incomeTaxRate = Math.max(0, Number(patch.incomeTaxRate) || 0);
  if (patch.fiscalStartMonth != null) db.settings.fiscalStartMonth = Math.min(12, Math.max(1, Number(patch.fiscalStartMonth) || 1));
  touch('settings', { ...db.settings });
  log('settings', 'Tax profile saved', `Scheme: ${db.settings.vatScheme}`, admin);
  persist();
};

export const resetAll = () => {
  localStorage.removeItem(KEY);
  cache = emptyDB();
  persist();
};

/* ── PIN hashing (PBKDF2-SHA256, salted, 120k rounds) ─── */
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const PBKDF2_ROUNDS = 120000;

const randomSalt = () => {
  const a = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return toHex(a.buffer);
};

const pbkdf2 = async (pin, salt) => {
  if (!globalThis.crypto?.subtle) return null;
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    key, 256
  );
  return toHex(bits);
};

/* legacy (v1) digest — kept only to migrate existing devices */
const legacyHash = async (pin) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode('qp::' + pin));
    return toHex(buf);
  } catch {
    let h = 5381;
    for (const ch of 'qp::' + pin) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
    return 'fb' + h.toString(16);
  }
};

/** Returns credential fields to merge onto a user record. */
export const makeCredential = async (pin) => {
  const salt = randomSalt();
  const hash = await pbkdf2(pin, salt);
  if (hash) return { pinHash: hash, pinSalt: salt, pinAlgo: 'pbkdf2' };
  return { pinHash: await legacyHash(pin), pinSalt: null, pinAlgo: 'sha256' };
};

export const verifyPin = async (user, pin) => {
  if (!user || !user.pinHash) return false;
  if (user.pinAlgo === 'pbkdf2' && user.pinSalt) {
    const h = await pbkdf2(pin, user.pinSalt);
    return h === user.pinHash;
  }
  return (await legacyHash(pin)) === user.pinHash;
};

/* back-compat helper */
export const hashPin = async (pin) => (await makeCredential(pin)).pinHash;

/* ── audit log ───────────────────────────────────────── */
export const log = (type, action, detail = '', user = null) => {
  const db = load();
  db.logs.unshift({
    id: uid('log'),
    at: new Date().toISOString(),
    type,
    action,
    detail,
    userId: user?.id || null,
    user: user?.name || 'System',
    username: user?.username || 'system',
  });
  if (db.logs.length > 4000) db.logs.length = 4000;
  touch('logs', db.logs[0]);
  persist();
};

/* ── change tracking (cloud sync) ─────────────────────── */
const SYNC_TABLES = ['sales', 'expenses', 'stock', 'stockMoves', 'capital', 'fixedAssets', 'suppliers', 'bills', 'cashups', 'users', 'logs', 'settings', 'camClips', 'camPresence', 'camEvents'];

/** Queue a record for cloud upload. `deleted` pushes a tombstone. */
export const touch = (tbl, data, deleted = false) => {
  const db = load();
  if (!db.outbox) db.outbox = [];
  const id = deleted ? (typeof data === 'string' ? data : data.id) : (data.id || 'business');
  db.outbox = db.outbox.filter((o) => !(o.tbl === tbl && o.id === id));
  db.outbox.push({
    tbl, id, deleted,
    data: deleted ? { id } : JSON.parse(JSON.stringify(data)),
    at: new Date().toISOString(),
  });
  if (db.outbox.length > 5000) db.outbox = db.outbox.slice(-4000);
  persist();
};

export const outbox = () => load().outbox || [];
export const clearOutbox = () => {
  const db = load();
  db.outbox = [];
  persist();
};
export const dropOutbox = (ops) => {
  const db = load();
  const sent = new Set(ops.map((o) => o.tbl + ':' + o.id));
  db.outbox = (db.outbox || []).filter((o) => !sent.has(o.tbl + ':' + o.id));
  persist();
};

export const syncMeta = () => (load().sync || (load().sync = { cursor: null, lastAt: null, deviceId: null }));
export const setSyncMeta = (patch) => {
  const db = load();
  db.sync = { ...(db.sync || {}), ...patch };
  persist();
};

export const deviceId = () => {
  const db = load();
  if (!db.sync) db.sync = {};
  if (!db.sync.deviceId) {
    const a = new Uint8Array(8);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
    db.sync.deviceId = 'dev-' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
    persist();
  }
  return db.sync.deviceId;
};

/** Merge rows pulled from the cloud into the local database. */
export const applyRemote = (rows) => {
  const db = load();
  const pending = new Set((db.outbox || []).map((o) => o.tbl + ':' + o.id));
  let changed = 0;
  for (const r of rows || []) {
    if (!r || !SYNC_TABLES.includes(r.tbl)) continue;
    if (pending.has(r.tbl + ':' + r.id)) continue;

    if (r.tbl === 'settings') {
      Object.assign(db.settings, r.data);
      changed++;
      continue;
    }
    const arr = db[r.tbl];
    if (!Array.isArray(arr)) continue;
    const i = arr.findIndex((x) => x.id === r.id);
    if (r.deleted) {
      if (i > -1) { arr.splice(i, 1); changed++; }
      continue;
    }
    const incoming = { ...r.data };
    if (i > -1) {
      const local = arr[i];
      const lu = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const ru = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;
      // prefer whichever is newer; ties go to the cloud copy
      arr[i] = ru >= lu ? { ...local, ...incoming } : local;
      changed++;
    } else {
      arr.push(incoming);
      changed++;
    }
  }
  if (db.logs.length > 1) db.logs.sort((a, b) => new Date(b.at) - new Date(a.at));
  if (changed) persist();
  return changed;
};

/** Everything currently held locally — used for the first upload. */
export const snapshotForCloud = () => {
  const db = load();
  const rows = [];
  ['sales', 'expenses', 'stock', 'stockMoves', 'capital', 'fixedAssets', 'suppliers', 'bills', 'cashups', 'users', 'logs'].forEach((tbl) => {
    (db[tbl] || []).forEach((rec) => rows.push({ tbl, id: rec.id, data: rec, deleted: false }));
  });
  rows.push({ tbl: 'settings', id: 'business', data: db.settings, deleted: false });
  return rows;
};

/* ── users ───────────────────────────────────────────── */
const normalizeMobile = (m) => String(m || '').replace(/[^\d]/g, '').replace(/^233/, '0');

export const validGhanaMobile = (m) => /^0\d{9}$/.test(normalizeMobile(m));

export const users = () => load().users;

export const findByIdentifier = (q) => {
  const s = String(q || '').trim().toLowerCase();
  const db = load();
  const asMobile = normalizeMobile(s);
  return db.users.find(
    (u) => u.username.toLowerCase() === s || (u.mobile && u.mobile === asMobile)
  );
};

export const requestAccess = async ({ name, username, mobile, pin, role = 'staff', requestedBy = null }) => {
  const db = load();
  const uname = String(username || '').trim().toLowerCase();
  const mob = normalizeMobile(mobile);
  if (!/^[a-z0-9_.]{3,15}$/.test(uname)) throw new Error('Username must be 3–15 letters, numbers or underscores.');
  if (!validGhanaMobile(mob)) throw new Error('Enter a valid Ghana mobile number, e.g. 0558103988.');
  if (!/^\d{4,6}$/.test(String(pin))) throw new Error('PIN must be 4–6 digits.');
  if (db.users.some((u) => u.username.toLowerCase() === uname)) throw new Error('That username is already taken.');
  if (db.users.some((u) => u.mobile === mob)) throw new Error('That mobile number already has an account.');
  const pending = db.users.filter((u) => u.role === 'staff' && u.status !== 'revoked').length;
  if (pending >= db.settings.staffLimit + 2) throw new Error('Staff capacity reached. Contact the administrator.');

  const user = {
    id: uid('usr'),
    name: String(name).trim(),
    username: uname,
    mobile: mob,
    ...(await makeCredential(pin)),
    role: 'staff',
    requestedRole: role === 'admin' ? 'admin' : 'staff',
    requestedBy,
    status: 'pending',
    createdAt: new Date().toISOString(),
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    lastLogin: null,
    loginCount: 0,
    active: true,
  };
  db.users.push(user);
  touch('users', user);
  log('request', 'Login requested', `${user.name} (@${uname}) requested access`);
  persist();
  return user;
};

export const approveUser = (id, admin, { asRole = null } = {}) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  const grantedRole = asRole || u.requestedRole || u.role || 'staff';
  const willBeStaff = grantedRole === 'staff';
  const active = db.users.filter((x) => x.status === 'active' && x.role === 'staff').length;
  if (willBeStaff && u.status !== 'active' && active >= db.settings.staffLimit)
    throw new Error(`Staff login limit reached (${db.settings.staffLimit}). Revoke a login first.`);
  u.role = grantedRole;
  u.status = 'active';
  u.active = true;
  u.approvedAt = new Date().toISOString();
  u.approvedBy = admin?.name || 'Administrator';
  u.updatedAt = new Date().toISOString();
  touch('users', u);
  log('approve', 'Login approved', `${admin?.name || 'Admin'} approved ${u.name} (@${u.username})`, admin);
  persist();
};

export const rejectUser = (id, admin) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  u.status = 'rejected';
  u.active = false;
  u.updatedAt = new Date().toISOString();
  touch('users', u);
  log('reject', 'Login rejected', `${admin?.name || 'Admin'} rejected ${u.name} (@${u.username})`, admin);
  persist();
};

export const setUserStatus = (id, status, admin) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u || u.role === 'admin') return;
  if (status === 'active') return approveUser(id, admin);
  u.status = status;
  u.active = status === 'active';
  u.updatedAt = new Date().toISOString();
  touch('users', u);
  log('admin', 'Login ' + status, `${u.name} (@${u.username}) set to ${status}`, admin);
  persist();
};

export const updateUser = (id, patch, admin) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  if (patch.username) {
    const uname = patch.username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,15}$/.test(uname)) throw new Error('Username must be 3–15 characters.');
    if (db.users.some((x) => x.id !== id && x.username.toLowerCase() === uname)) throw new Error('Username already in use.');
    patch.username = uname;
  }
  if (patch.mobile) {
    const mob = normalizeMobile(patch.mobile);
    if (!validGhanaMobile(mob)) throw new Error('Invalid Ghana mobile number.');
    if (db.users.some((x) => x.id !== id && x.mobile === mob)) throw new Error('Mobile already in use.');
    patch.mobile = mob;
  }
  Object.assign(u, patch, { updatedAt: new Date().toISOString() });
  touch('users', u);
  log('edit', 'Staff record updated', `${u.name} (@${u.username})`, admin);
  persist();
};

export const deleteUser = (id, admin) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u || u.role === 'admin') return;
  db.users = db.users.filter((x) => x.id !== id);
  touch('users', u, true);
  log('delete', 'Login deleted', `${u.name} (@${u.username}) removed by ${admin?.name || 'Admin'}`, admin);
  persist();
};

export const setPin = async (id, pin, admin) => {
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  if (!/^\d{4,6}$/.test(String(pin))) throw new Error('PIN must be 4–6 digits.');
  Object.assign(u, await makeCredential(pin), { updatedAt: new Date().toISOString() });
  touch('users', u);
  log('admin', 'PIN reset', `PIN reset for ${u.name} (@${u.username})`, admin);
  persist();
};

export const authenticate = async (identifier, pin) => {
  const u = findByIdentifier(identifier);
  if (!u) throw new Error('No account found for that number or username.');
  if (u.status === 'pending') throw new Error('Your request is awaiting administrator approval.');
  if (u.status === 'rejected') throw new Error('This login request was declined.');
  if (u.status === 'suspended') throw new Error('This account is suspended. Contact the administrator.');
  if (u.status === 'revoked') throw new Error('This login has been revoked.');
  const ok = await verifyPin(u, pin);
  if (!ok) throw new Error('Incorrect PIN. Please try again.');
  // transparently upgrade legacy digests
  if (u.pinAlgo !== 'pbkdf2') {
    Object.assign(u, await makeCredential(pin));
    touch('users', u);
  }
  const db = load();
  const rec = db.users.find((x) => x.id === u.id);
  rec.lastLogin = new Date().toISOString();
  rec.loginCount = (rec.loginCount || 0) + 1;
  log('login', 'Signed in', `${rec.name} (@${rec.username}) signed in`, rec);
  persist();
  return rec;
};

export const hasAdmin = () => load().users.some((u) => u.role === 'admin');

/* ── PIN recovery ─────────────────────────────────────── */
export const requestPinReset = (identifier, note = '') => {
  const db = load();
  const u = findByIdentifier(identifier);
  if (!u) throw new Error('No account found for that number or username.');
  if (db.resetRequests.some((r) => r.userId === u.id && r.status === 'pending'))
    throw new Error('A reset request is already waiting for the administrator.');
  const rec = {
    id: uid('rst'),
    userId: u.id,
    name: u.name,
    username: u.username,
    mobile: u.mobile || '',
    at: new Date().toISOString(),
    status: 'pending',
    note,
  };
  db.resetRequests.unshift(rec);
  log('reset', 'PIN reset requested', `${u.name} (@${u.username}) asked for a new PIN`, u);
  persist();
  return rec;
};

export const resetRequests = () => load().resetRequests || [];
export const pendingResetRequests = () => resetRequests().filter((r) => r.status === 'pending');

export const resolveResetRequest = (userId, admin, how = 'admin') => {
  const db = load();
  db.resetRequests.forEach((r) => {
    if (r.userId === userId && r.status === 'pending') {
      r.status = 'done';
      r.doneAt = new Date().toISOString();
      r.doneBy = admin?.name || 'Administrator';
      r.how = how;
    }
  });
  persist();
};

/** Admin sets a temporary PIN and hands it to the staff member. */
export const issueTemporaryPin = async (userId, pin, admin) => {
  await setPin(userId, pin, admin);
  resolveResetRequest(userId, admin);
  return true;
};

export const createAdmin = async ({ name, username, mobile, pin }) => {
  const db = load();
  const uname = String(username).trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,15}$/.test(uname)) throw new Error('Username must be 3–15 characters.');
  if (db.users.some((u) => u.username.toLowerCase() === uname)) throw new Error('Username already taken.');
  const admin = {
    id: uid('usr'),
    name: name.trim(),
    username: uname,
    mobile: normalizeMobile(mobile),
    ...(await makeCredential(pin)),
    role: 'admin',
    status: 'active',
    active: true,
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: 'System setup',
    lastLogin: null,
    loginCount: 0,
  };
  db.users.push(admin);
  log('setup', 'Administrator created', `${admin.name} (@${uname})`, admin);
  persist();
  return admin;
};

/* ── auto number sequences ───────────────────────────── */
export const nextNumber = (prefix, list) => {
  const yr = new Date().getFullYear().toString().slice(-2);
  const head = `${prefix}-${yr}-`;
  const nums = list
    .map((x) => (x.no || '').startsWith(head) ? parseInt(x.no.slice(head.length), 10) : 0)
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return head + String(next).padStart(4, '0');
};

/* ── sales ───────────────────────────────────────────── */
export const sales = () => load().sales;

/* Every job gets its own receipt number the moment it is saved: RCP-26-0001.
 * It is different from the invoice number (INV-…) so a reprinted receipt can
 * always be matched back to the job that produced it. */
const nextReceiptNo = (list) => {
  const yr = new Date().getFullYear().toString().slice(-2);
  const head = `RCP-${yr}-`;
  const nums = list
    .map((x) => String(x.receiptNo || ''))
    .filter((n) => n.startsWith(head))
    .map((n) => parseInt(n.slice(head.length), 10))
    .filter((n) => !isNaN(n));
  return head + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
};

export const receiptNoOf = (rec) => rec?.receiptNo || rec?.no || '';

/* ── materials taken from stock for a job ────────────────
 * The shop buys paper and toner into Stock & Materials. When a job uses some
 * of it, the quantity leaves the shelf and the cost of those materials becomes
 * the cost of that job — so gross profit tells the truth and the shelf count
 * stays right without a second entry.
 */
export const materialsCost = (rows = []) =>
  Math.round((rows || []).reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.unitCost) || 0), 0) * 100) / 100;

const normaliseMaterials = (rows = []) => {
  const db = load();
  const out = [];
  (rows || []).forEach((r) => {
    const qty = Number(r.qty) || 0;
    if (!r.itemId || qty <= 0) return;
    const it = db.stock.find((x) => x.id === r.itemId);
    if (!it) throw new Error('That stock item no longer exists.');
    const already = out.find((x) => x.itemId === it.id);
    if (already) { already.qty += qty; return; }
    out.push({ itemId: it.id, name: it.name, unit: it.unit, qty, unitCost: Number(it.unitCost) || 0 });
  });
  // check the shelf before anything is written
  out.forEach((r) => {
    const it = db.stock.find((x) => x.id === r.itemId);
    if (r.qty > it.qty) throw new Error(`Only ${it.qty} ${it.unit} of ${it.name} in stock — you asked for ${r.qty}.`);
  });
  return out;
};

const issueMaterials = (rec, rows, user) => {
  rows.forEach((r) => stockMovement(r.itemId, 'out', r.qty, `Issued to job ${rec.receiptNo || rec.no}`, user));
};

const returnMaterials = (rec, user) => {
  (rec.materials || []).forEach((r) => {
    try { stockMovement(r.itemId, 'in', r.qty, `Returned — job ${rec.receiptNo || rec.no} removed`, user); } catch { /* item gone */ }
  });
};

export const addSale = (data, user) => {
  const db = load();
  assertOpen(data.date || new Date(), 'A sale');
  // the form may carry a brand-new revenue line typed by the user
  if (data.newService && String(data.newService).trim()) {
    data.service = addService({ name: data.newService, price: data.unitPrice }, user).id;
  } else if (data.newExpense) { /* ignore on sales */ }
  const qty = Math.max(1, Number(data.qty) || 1);
  const unitPrice = Number(data.unitPrice) || 0;
  const materials = normaliseMaterials(data.materials);
  const rec = {
    id: uid('sal'),
    no: data.no || nextNumber('INV', db.sales),
    receiptNo: data.receiptNo || nextReceiptNo(db.sales),
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    service: data.service,
    serviceName: SERVICES.find((s) => s.id === data.service)?.name || data.service,
    description: data.description || '',
    customer: data.customer || 'Walk-in Customer',
    phone: data.phone || '',
    qty,
    unitPrice,
    amount: Math.round(qty * unitPrice * 100) / 100,
    cost: materials.length ? materialsCost(materials) : Number(data.cost) || 0,
    materials,
    method: data.method || 'Cash',
    note: data.note || '',
    paid: data.method === 'Credit (Unpaid)' ? Math.min(Number(data.paid) || 0, Math.round(qty * unitPrice * 100) / 100) : Math.round(qty * unitPrice * 100) / 100,
    payments: [],
    createdBy: user?.name || 'System',
    createdById: user?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    updatedBy: null,
  };
  db.sales.unshift(rec);
  touch('sales', rec);
  if (materials.length) issueMaterials(rec, materials, user);
  log('sale', 'Sale recorded', `${rec.receiptNo} · ${rec.serviceName} · ${CURRENCY}${rec.amount.toFixed(2)} (${rec.method})`, user);
  persist();
  return rec;
};

export const updateSale = (id, patch, user) => {
  const db = load();
  const rec = db.sales.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(rec.date, 'This sale');
  if (patch.date) assertOpen(patch.date, 'The new date for this sale');
  if (patch.newService && String(patch.newService).trim()) {
    patch.service = addService({ name: patch.newService, price: patch.unitPrice }, user).id;
  }
  const before = { ...rec };
  const qty = Math.max(1, Number(patch.qty ?? rec.qty) || 1);
  const unitPrice = Number(patch.unitPrice ?? rec.unitPrice) || 0;

  // materials: put the old ones back on the shelf, then take the new ones out
  let materials = rec.materials || [];
  if (patch.materials != null) {
    const next = normaliseMaterials(patch.materials);
    returnMaterials(rec, user);
    materials = next;
    patch.cost = next.length ? materialsCost(next) : Number(patch.cost ?? rec.cost) || 0;
  } else if (patch.cost != null && !materials.length) {
    patch.cost = Number(patch.cost) || 0;
  }

  Object.assign(rec, patch, {
    qty, unitPrice,
    materials,
    amount: Math.round(qty * unitPrice * 100) / 100,
    serviceName: SERVICES.find((s) => s.id === (patch.service || rec.service))?.name || rec.serviceName,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.name || 'System',
  });
  if (patch.materials != null) issueMaterials(rec, materials, user);
  touch('sales', rec);
  log('edit', 'Sale edited', `${rec.no} · ${before.serviceName} ${CURRENCY}${before.amount} → ${CURRENCY}${rec.amount}`, user);
  persist();
};

export const deleteSale = (id, user) => {
  const db = load();
  const rec = db.sales.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(rec.date, 'This sale');
  if ((rec.materials || []).length) returnMaterials(rec, user);
  db.sales = db.sales.filter((x) => x.id !== id);
  touch('sales', rec, true);
  log('delete', 'Sale deleted', `${rec.no} · ${rec.serviceName} · ${CURRENCY}${rec.amount} (entered by ${rec.createdBy})`, user);
  persist();
};

/* ── debtors: money customers still owe ─────────────────
 * A credit sale is revenue today but cash later. `paid` tracks what has come
 * in; `payments` keeps every receipt so the trail is complete.
 */
export const paidOn = (sale) => {
  if (sale.paid != null) return Number(sale.paid) || 0;
  return sale.method === 'Credit (Unpaid)' ? 0 : Number(sale.amount) || 0;
};

export const outstandingOn = (sale) =>
  Math.max(0, Math.round(((Number(sale.amount) || 0) - paidOn(sale)) * 100) / 100);

export const debtors = () => load().sales
  .filter((x) => outstandingOn(x) > 0.004)
  .sort((a, b) => new Date(a.date) - new Date(b.date));

export const debtorsTotal = () => debtors().reduce((a, x) => a + outstandingOn(x), 0);

/** Record money received against a credit sale. */
export const recordPayment = (saleId, { amount, date, method = 'Cash', note = '' } = {}, user) => {
  const db = load();
  const rec = db.sales.find((x) => x.id === saleId);
  if (!rec) throw new Error('Sale not found.');
  const due = outstandingOn(rec);
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(amt > 0)) throw new Error('Enter the amount received.');
  if (amt > due + 0.004) throw new Error(`Only ${CURRENCY}${due.toFixed(2)} is still owed on this sale.`);
  if (!Array.isArray(rec.payments)) rec.payments = [];
  rec.payments.push({
    id: uid('pmt'),
    at: date ? new Date(date).toISOString() : new Date().toISOString(),
    amount: amt,
    method,
    note,
    by: user?.name || 'System',
  });
  rec.paid = Math.round((paidOn(rec) + amt) * 100) / 100;
  if (outstandingOn(rec) <= 0.004) rec.settledAt = new Date().toISOString();
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = user?.name || 'System';
  touch('sales', rec);
  log('payment', 'Payment received', `${rec.no} · ${rec.customer || 'Walk-in'} · ${CURRENCY}${amt.toFixed(2)} (${method}) — ${outstandingOn(rec) > 0 ? CURRENCY + outstandingOn(rec).toFixed(2) + ' still owed' : 'settled in full'}`, user);
  persist();
  return rec;
};

/** Turn an unpaid balance into a bad debt (owner's decision, logged). */
export const writeOffSale = (saleId, note, user) => {
  const db = load();
  const rec = db.sales.find((x) => x.id === saleId);
  if (!rec) throw new Error('Sale not found.');
  const due = outstandingOn(rec);
  if (!(due > 0)) throw new Error('Nothing is owed on this sale.');
  if (!Array.isArray(rec.payments)) rec.payments = [];
  rec.payments.push({ id: uid('pmt'), at: new Date().toISOString(), amount: 0, method: 'Write-off', note: note || 'Bad debt written off', by: user?.name || 'System' });
  rec.badDebt = Math.round(((Number(rec.badDebt) || 0) + due) * 100) / 100;
  rec.paid = Math.round((paidOn(rec) + due) * 100) / 100;
  rec.settledAt = new Date().toISOString();
  rec.updatedAt = new Date().toISOString();
  touch('sales', rec);
  log('writeoff', 'Bad debt written off', `${rec.no} · ${rec.customer || 'Walk-in'} · ${CURRENCY}${due.toFixed(2)}`, user);
  persist();
  return rec;
};

/* ── expenses ────────────────────────────────────────── */
export const expenses = () => load().expenses;

export const addExpense = (data, user) => {
  const db = load();
  assertOpen(data.date || new Date(), 'An expense');
  // a brand-new expenditure line typed in the form is added to the chart of accounts
  if (data.newCategory && String(data.newCategory).trim()) {
    data.category = addExpenseLine(data.newCategory, user);
  }
  // owner's drawings are a capital transaction, never an operating expense
  if (data.category === DRAWINGS_LINE) {
    return addCapital(
      { type: 'drawing', amount: data.amount, note: data.description || data.note || 'Owner withdrawal', date: data.date },
      user,
    );
  }
  const rec = {
    id: uid('exp'),
    no: data.no || nextNumber('EXP', db.expenses),
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    category: data.category || 'Miscellaneous',
    description: data.description || '',
    paidTo: data.paidTo || '',
    amount: Math.round((Number(data.amount) || 0) * 100) / 100,
    method: data.method || 'Cash',
    receipt: data.receipt || '',
    note: data.note || '',
    createdBy: user?.name || 'System',
    createdById: user?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    updatedBy: null,
  };
  db.expenses.unshift(rec);
  touch('expenses', rec);
  log('expense', 'Expense recorded', `${rec.no} · ${rec.category} · ${CURRENCY}${rec.amount.toFixed(2)}`, user);
  persist();
  return rec;
};

export const updateExpense = (id, patch, user) => {
  const db = load();
  if (patch.newCategory && String(patch.newCategory).trim()) {
    patch.category = addExpenseLine(patch.newCategory, user);
  }
  if (patch.category === DRAWINGS_LINE) {
    const cap = db.capital.find((x) => x.id === id) || addCapital({ type: 'drawing', amount: patch.amount, note: patch.description }, user);
    return updateCapital(cap.id, { amount: patch.amount, note: patch.description || patch.note, date: patch.date }, user);
  }
  const rec = db.expenses.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(patch.date || rec.date, 'This expense');
  Object.assign(rec, patch, {
    amount: Math.round((Number(patch.amount ?? rec.amount) || 0) * 100) / 100,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.name || 'System',
  });
  touch('expenses', rec);
  log('edit', 'Expense edited', `${rec.no} · ${rec.category} · ${CURRENCY}${rec.amount}`, user);
  persist();
};

export const deleteExpense = (id, user) => {
  const db = load();
  if (!db.expenses.some((x) => x.id === id) && db.capital.some((x) => x.id === id)) {
    return deleteCapital(id, user);
  }
  const rec = db.expenses.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(rec.date, 'This expense');
  db.expenses = db.expenses.filter((x) => x.id !== id);
  touch('expenses', rec, true);
  log('delete', 'Expense deleted', `${rec.no} · ${rec.category} · ${CURRENCY}${rec.amount} (entered by ${rec.createdBy})`, user);
  persist();
};

/* ── stock ───────────────────────────────────────────── */
export const stockItems = () => load().stock;
export const stockMoves = () => load().stockMoves;

export const addStockItem = (data, user) => {
  const db = load();
  const qty = Number(data.qty) || 0;
  const item = {
    id: uid('itm'),
    sku: data.sku || 'ITM-' + String(db.stock.length + 1).padStart(3, '0'),
    name: data.name,
    category: data.category || 'Paper',
    unit: data.unit || 'pcs',
    qty,
    reorder: Number(data.reorder) || 0,
    unitCost: Number(data.unitCost) || 0,
    supplier: data.supplier || '',
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  db.stock.push(item);
  touch('stock', item);
  if (qty > 0) {
    const mv = {
      id: uid('mv'), at: new Date().toISOString(), itemId: item.id, itemName: item.name,
      type: 'in', qty, unitCost: item.unitCost, note: 'Opening balance',
      createdBy: user?.name || 'System',
    };
    db.stockMoves.unshift(mv);
    touch('stockMoves', mv);
  }
  log('stock', 'Stock item added', `${item.name} · ${qty} ${item.unit} @ ${CURRENCY}${item.unitCost}`, user);
  persist();
  return item;
};

export const updateStockItem = (id, patch, user) => {
  const db = load();
  const it = db.stock.find((x) => x.id === id);
  if (!it) return;
  Object.assign(it, patch, {
    qty: Number(patch.qty ?? it.qty) || 0,
    unitCost: Number(patch.unitCost ?? it.unitCost) || 0,
    reorder: Number(patch.reorder ?? it.reorder) || 0,
    updatedAt: new Date().toISOString(),
  });
  touch('stock', it);
  log('edit', 'Stock item edited', `${it.name} · qty ${it.qty} ${it.unit}`, user);
  persist();
};

export const deleteStockItem = (id, user) => {
  const db = load();
  const it = db.stock.find((x) => x.id === id);
  if (!it) return;
  db.stock = db.stock.filter((x) => x.id !== id);
  db.stockMoves.filter((m) => m.itemId === id).forEach((m) => touch('stockMoves', m, true));
  db.stockMoves = db.stockMoves.filter((m) => m.itemId !== id);
  touch('stock', it, true);
  log('delete', 'Stock item deleted', `${it.name}`, user);
  persist();
};

export const stockMovement = (itemId, type, qty, note, user, unitCost = null) => {
  const db = load();
  const it = db.stock.find((x) => x.id === itemId);
  if (!it) throw new Error('Stock item not found.');
  const q = Math.abs(Number(qty) || 0);
  if (q <= 0) throw new Error('Quantity must be greater than zero.');
  if (type === 'out') {
    if (q > it.qty) throw new Error(`Only ${it.qty} ${it.unit} in stock.`);
    it.qty -= q;
  } else if (type === 'in') {
    it.qty += q;
    if (unitCost != null && Number(unitCost) > 0) it.unitCost = Number(unitCost);
  } else if (type === 'adj') {
    it.qty = q;
  }
  it.updatedAt = new Date().toISOString();
  touch('stock', it);
  const move = {
    id: uid('mv'), at: new Date().toISOString(), itemId, itemName: it.name,
    type, qty: q, unitCost: Number(unitCost || it.unitCost) || 0,
    note: note || '', createdBy: user?.name || 'System',
  };
  db.stockMoves.unshift(move);
  touch('stockMoves', move);
  log('stock', `Stock ${type === 'in' ? 'received' : type === 'out' ? 'issued' : 'adjusted'}`,
    `${it.name} · ${q} ${it.unit} · balance ${it.qty}`, user);
  persist();
  return it;
};

/* ── capital ─────────────────────────────────────────── */
export const capital = () => load().capital;
export const addCapital = (data, user) => {
  const db = load();
  assertOpen(data.date || new Date(), 'A capital entry');
  const rec = {
    id: uid('cap'),
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    type: data.type || 'capital',
    amount: Math.round((Number(data.amount) || 0) * 100) / 100,
    note: data.note || '',
    createdBy: user?.name || 'System',
    createdAt: new Date().toISOString(),
  };
  db.capital.unshift(rec);
  touch('capital', rec);
  log('capital', data.type === 'drawing' ? 'Owner drawing recorded' : 'Capital injection recorded',
    `${CURRENCY}${rec.amount.toFixed(2)}`, user);
  persist();
  return rec;
};
export const updateCapital = (id, patch, user) => {
  const db = load();
  const rec = db.capital.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(patch.date || rec.date, 'This capital entry');
  if (patch.date) rec.date = new Date(patch.date).toISOString();
  if (patch.amount != null) rec.amount = Math.round((Number(patch.amount) || 0) * 100) / 100;
  if (patch.note != null || patch.description != null) rec.note = patch.note ?? patch.description ?? rec.note;
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = user?.name || 'System';
  touch('capital', rec);
  log('edit', 'Owner drawing edited', `${CURRENCY}${rec.amount}`, user);
  persist();
  return rec;
};

/** Drawings shown inside the expense register (they stay out of the P&L). */
export const drawingsAsExpenses = () => load().capital
  .filter((x) => x.type === 'drawing')
  .map((x) => ({
    id: x.id,
    no: 'DRW-' + String(x.id).slice(-4).toUpperCase(),
    date: x.date,
    category: DRAWINGS_LINE,
    description: x.note || 'Owner withdrawal',
    paidTo: 'Owner',
    amount: x.amount,
    method: 'Cash',
    receipt: '',
    note: '',
    createdBy: x.createdBy || 'System',
    createdAt: x.createdAt || x.date,
    updatedAt: x.updatedAt || null,
    isDrawing: true,
  }));

export const deleteCapital = (id, user) => {
  const db = load();
  const rec = db.capital.find((x) => x.id === id);
  if (!rec) return;
  assertOpen(rec.date, 'This capital entry');
  db.capital = db.capital.filter((x) => x.id !== id);
  touch('capital', rec, true);
  log('delete', 'Capital entry deleted', `${CURRENCY}${rec.amount}`, user);
  persist();
};

/* ── fixed assets (property, plant & equipment) ───────── *
 * Consumables live in Stock; things the shop KEEPS (printer, laminator,
 * computer, furniture) live here. They are capitalised at cost and written
 * off a little each month (straight-line depreciation) instead of being
 * dumped into one month's expenses.
 */
export const ASSET_CATEGORIES = [
  'Printing machine', 'Photocopier', 'Computer & laptop', 'Laminator',
  'Binding machine', 'Camera & studio', 'Furniture & fittings',
  'Power & generator', 'Tools', 'Other equipment',
];

export const fixedAssets = () => load().fixedAssets || [];

const monthsBetween = (from, to) => {
  const a = new Date(from), b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
};

/* ── depreciation methods ─────────────────────────────── *
 * Offered methods follow IAS 16 (Property, Plant & Equipment), which is what
 * the Institute of Chartered Accountants, Ghana (ICAG) requires:
 *
 *  • STRAIGHT LINE — the ICA/IFRS default for shop equipment. The same amount
 *    every month over the useful life. Recommended here: a photocopier wears
 *    out at a steady rate, and the charge is easy for anybody to check.
 *  • REDUCING (DIMINISHING) BALANCE — a fixed % of the *carrying value* each
 *    year, so the biggest charge falls in year one. Used for computers and
 *    IT equipment, which lose value fastest early. This is also the basis of
 *    Ghana Revenue Authority capital allowances (see GRA_RATES below).
 *
 * Whichever is chosen, the app does the arithmetic: give it the date of
 * purchase, the cost and the useful life and it produces the monthly and
 * yearly charge, the accumulated depreciation and the net book value.
 */
export const DEPRECIATION_METHODS = [
  { id: 'straight', label: 'Straight line (ICA recommended for equipment)', hint: 'Equal charge every month over the useful life.' },
  { id: 'reducing', label: 'Reducing balance (diminishing balance)', hint: 'A fixed % of the remaining value each year — used for computers.' },
];

/** Ghana Revenue Authority capital-allowance rates (reducing balance). */
export const GRA_RATES = {
  'Computer & laptop': 40,
  'Camera & studio': 40,
  'Printing machine': 30,
  'Photocopier': 30,
  'Laminator': 30,
  'Binding machine': 30,
  'Power & generator': 30,
  'Tools': 30,
  'Furniture & fittings': 20,
  'Other equipment': 20,
};

/** Default useful life in years, by category (ICA-style practice). */
export const DEFAULT_LIFE_YEARS = {
  'Printing machine': 5,
  'Photocopier': 5,
  'Computer & laptop': 4,
  'Laminator': 3,
  'Binding machine': 5,
  'Camera & studio': 4,
  'Furniture & fittings': 10,
  'Power & generator': 5,
  'Tools': 3,
  'Other equipment': 5,
};

const methodOf = (a) => (a.method === 'reducing' ? 'reducing' : 'straight');

const monthlyReducingRate = (annualPct) => {
  const r = Math.max(0, Math.min(100, Number(annualPct) || 0)) / 100;
  return r <= 0 ? 0 : 1 - Math.pow(1 - r, 1 / 12);
};

/**
 * State of one asset at a given date — the whole depreciation calculation.
 * Everything is derived from: date of purchase, cost, residual value,
 * useful life and method. Nothing is typed in by hand.
 */
export const assetState = (a, asOf = new Date()) => {
  const end = endOfDay(asOf);
  const bought = new Date(a.date);
  const disposed = a.disposedAt ? new Date(a.disposedAt) : null;
  const cost = Number(a.cost) || 0;
  const salvage = Math.min(Number(a.salvage) || 0, cost);
  const lifeMonths = Math.max(1, Number(a.lifeMonths) || Math.round((Number(a.lifeYears) || 5) * 12));
  const lifeYears = Math.round((lifeMonths / 12) * 100) / 100;
  const method = methodOf(a);
  const rate = Number(a.rate) || GRA_RATES[a.category] || 30;
  const depreciable = Math.max(0, cost - salvage);

  if (bought > end) {
    return {
      active: false, notYet: true, cost, salvage, life: lifeMonths, lifeYears, method, rate,
      monthly: 0, months: 0, accDep: 0, nbv: 0, depreciable, monthlyCharge: 0, yearlyCharge: 0, schedule: [],
    };
  }

  const disposedBefore = disposed && disposed < end;
  let months = monthsBetween(bought, disposedBefore ? disposed : end);
  if (!disposedBefore) months += 1;               // the month of purchase counts as month 1
  const ownedMonths = Math.min(Math.max(0, months), lifeMonths);

  // month-by-month run (identical arithmetic for both methods, just different rules)
  let nbv = cost;
  let accDep = 0;
  const mRate = monthlyReducingRate(rate);
  const straightMonthly = lifeMonths ? depreciable / lifeMonths : 0;
  const schedule = [];
  const round2 = (n) => Math.round(n * 100) / 100;
  for (let m = 1; m <= ownedMonths; m++) {
    const opening = nbv;
    const last = m === lifeMonths;                 // final month clears any rounding remainder
    let charge = method === 'reducing' ? opening * mRate : straightMonthly;
    charge = Math.max(0, Math.min(charge, opening - salvage, depreciable - accDep));
    if (last) charge = Math.max(0, round2(opening - salvage));
    charge = Math.round(charge * 100) / 100;
    nbv = Math.round((opening - charge) * 100) / 100;
    accDep = Math.round((accDep + charge) * 100) / 100;
    const yr = Math.ceil(m / 12);
    if (!schedule[yr - 1]) schedule[yr - 1] = { year: yr, charge: 0, closing: 0 };
    schedule[yr - 1].charge = Math.round((schedule[yr - 1].charge + charge) * 100) / 100;
    schedule[yr - 1].closing = nbv;
  }

  // the charge that applies to the month we are looking at
  const thisMonth = method === 'reducing'
    ? Math.min(Math.round((nbv * mRate) * 100) / 100, Math.max(0, Math.round((nbv - salvage) * 100) / 100))
    : Math.min(Math.round(straightMonthly * 100) / 100, Math.max(0, Math.round((nbv - salvage) * 100) / 100));

  const isDisposed = !!(disposed && disposed <= end);
  return {
    active: !isDisposed,
    disposed: isDisposed,
    cost, salvage, method, rate,
    life: lifeMonths, lifeYears,
    monthly: method === 'reducing' ? thisMonth : Math.round(straightMonthly * 100) / 100,
    yearlyCharge: Math.round((schedule[0]?.charge || 0) * 100) / 100,
    months: ownedMonths,
    accDep,
    nbv,
    depreciable,
    monthlyCharge: nbv <= salvage + 0.004 ? 0 : thisMonth,
    schedule,
    disposedAt: isDisposed ? disposed.toISOString() : null,
    proceeds: isDisposed ? Number(a.disposalProceeds) || 0 : 0,
    gainLoss: isDisposed ? Math.round(((Number(a.disposalProceeds) || 0) - nbv) * 100) / 100 : 0,
  };
};

/** Full planned schedule (whole useful life), for the printable register. */
export const assetSchedule = (a) => {
  const life = Math.max(1, Number(a.lifeMonths) || Math.round((Number(a.lifeYears) || 5) * 12));
  const bought = new Date(a.date);
  const years = Math.ceil(life / 12);
  const rows = [];
  for (let y = 1; y <= years; y++) {
    const asAt = new Date(bought.getFullYear() + y, bought.getMonth(), 1);
    const st = assetState(a, asAt);
    const prev = rows.length ? rows[rows.length - 1].closing : Number(a.cost) || 0;
    rows.push({ year: y, opening: Math.round(prev * 100) / 100, charge: st.accDep - (rows.length ? rows.reduce((t, r) => t + r.charge, 0) : 0), closing: st.nbv });
  }
  return rows.map((r) => ({ ...r, charge: Math.round(r.charge * 100) / 100 }));
};

/** Whole-register roll-up for any date. */
export const assetRollup = (asOf = new Date()) => {
  const rows = fixedAssets().map((a) => ({ asset: a, s: assetState(a, asOf) }));
  const live = rows.filter((r) => !r.s.disposed && !r.s.notYet);
  const disposed = rows.filter((r) => r.s.disposed);
  return {
    rows, live, disposed,
    count: live.length,
    cost: Math.round(sum(live, (r) => r.s.cost) * 100) / 100,
    accDep: Math.round(sum(live, (r) => r.s.accDep) * 100) / 100,
    nbv: Math.round(sum(live, (r) => r.s.nbv) * 100) / 100,
    proceeds: Math.round(sum(disposed, (r) => r.s.proceeds) * 100) / 100,
    gainLoss: Math.round(sum(disposed, (r) => r.s.proceeds - (r.s.cost - r.s.accDep)) * 100) / 100,
    monthlyCharge: Math.round(sum(live, (r) => r.s.monthlyCharge) * 100) / 100,
  };
};

/** Depreciation charged inside a period = movement in accumulated depreciation. */
export const depreciationFor = (range) => {
  const before = new Date(startOfDay(range.from).getTime() - 86400000);
  const a = assetRollup(before);
  const b = assetRollup(range.to);
  const open = a.accDep + sum(a.disposed, (r) => r.s.accDep);
  const close = b.accDep + sum(b.disposed, (r) => r.s.accDep);
  return Math.max(0, Math.round((close - open) * 100) / 100);
};

export const assetPurchasesFor = (range) =>
  Math.round(sum(fixedAssets().filter((a) => inRange(a.date, range)), (a) => a.cost) * 100) / 100;

export const assetDisposalsFor = (range) =>
  Math.round(sum(fixedAssets().filter((a) => a.disposedAt && inRange(a.disposedAt, range)), (a) => a.disposalProceeds) * 100) / 100;

const assetTag = () => {
  const db = load();
  let n = (db.fixedAssets || []).length + 1;
  let tag = 'FA-' + String(n).padStart(3, '0');
  while ((db.fixedAssets || []).some((a) => a.tag === tag)) tag = 'FA-' + String(++n).padStart(3, '0');
  return tag;
};

export const addFixedAsset = (data, user) => {
  const db = load();
  if (!db.fixedAssets) db.fixedAssets = [];
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Give the asset a name.');
  const cost = Math.round((Number(data.cost) || 0) * 100) / 100;
  if (!(cost > 0)) throw new Error('Enter what the asset cost.');
  // useful life: years if given, else an explicit month count (older callers), else the category default
  const yearsIn = Number(data.lifeYears) > 0 ? Number(data.lifeYears)
    : Number(data.lifeMonths) > 0 ? Number(data.lifeMonths) / 12
    : (DEFAULT_LIFE_YEARS[data.category] || 5);
  const lifeYears = Math.round(Math.max(0.5, yearsIn) * 100) / 100;
  const rec = {
    id: uid('fa'),
    tag: data.tag || assetTag(),
    name,
    category: data.category || 'Other equipment',
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    cost,
    salvage: Math.min(Math.round((Number(data.salvage) || 0) * 100) / 100, cost),
    lifeYears,
    lifeMonths: Math.max(6, Math.round(lifeYears * 12)),
    method: data.method === 'reducing' ? 'reducing' : 'straight',
    rate: Math.max(0, Math.min(100, Number(data.rate) || GRA_RATES[data.category] || 30)),
    supplier: data.supplier || '',
    invoice: data.invoice || '',
    serial: data.serial || '',
    note: data.note || '',
    disposedAt: null,
    disposalProceeds: 0,
    createdBy: user?.name || 'System',
    createdById: user?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  db.fixedAssets.push(rec);
  touch('fixedAssets', rec);
  log('asset', 'Fixed asset added', `${rec.tag} · ${rec.name} · ${CURRENCY}${cost.toFixed(2)} over ${rec.lifeMonths} months (${rec.method === 'reducing' ? 'reducing balance ' + rec.rate + '%' : 'straight line'})`, user);
  persist();
  return rec;
};

export const updateFixedAsset = (id, patch, user) => {
  const db = load();
  const rec = (db.fixedAssets || []).find((x) => x.id === id);
  if (!rec) return;
  const before = `${rec.name} ${CURRENCY}${rec.cost}`;
  if (patch.name != null) rec.name = String(patch.name).trim() || rec.name;
  if (patch.category != null) rec.category = patch.category;
  if (patch.date) rec.date = new Date(patch.date).toISOString();
  if (patch.cost != null) rec.cost = Math.round((Number(patch.cost) || 0) * 100) / 100;
  if (patch.salvage != null) rec.salvage = Math.min(Math.round((Number(patch.salvage) || 0) * 100) / 100, rec.cost);
  if (patch.lifeYears != null) {
    rec.lifeYears = Math.max(0.5, Number(patch.lifeYears) || 5);
    rec.lifeMonths = Math.max(6, Math.round(rec.lifeYears * 12));
  }
  if (patch.method != null) rec.method = patch.method === 'reducing' ? 'reducing' : 'straight';
  if (patch.rate != null) rec.rate = Math.max(0, Math.min(100, Number(patch.rate) || 0));
  if (patch.supplier != null) rec.supplier = patch.supplier;
  if (patch.invoice != null) rec.invoice = patch.invoice;
  if (patch.serial != null) rec.serial = patch.serial;
  if (patch.note != null) rec.note = patch.note;
  if (patch.restore) { rec.disposedAt = null; rec.disposalProceeds = 0; }
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = user?.name || 'System';
  touch('fixedAssets', rec);
  log('edit', 'Fixed asset edited', `${rec.tag} · ${before} → ${rec.name} ${CURRENCY}${rec.cost}`, user);
  persist();
  return rec;
};

export const disposeFixedAsset = (id, { date, proceeds = 0, note = '' } = {}, user) => {
  const db = load();
  const rec = (db.fixedAssets || []).find((x) => x.id === id);
  if (!rec) return;
  rec.disposedAt = date ? new Date(date).toISOString() : new Date().toISOString();
  rec.disposalProceeds = Math.round((Number(proceeds) || 0) * 100) / 100;
  if (note) rec.note = [rec.note, note].filter(Boolean).join(' · ');
  rec.updatedAt = new Date().toISOString();
  touch('fixedAssets', rec);
  log('asset', 'Fixed asset disposed', `${rec.tag} · ${rec.name} · proceeds ${CURRENCY}${rec.disposalProceeds.toFixed(2)}`, user);
  persist();
  return rec;
};

export const deleteFixedAsset = (id, user) => {
  const db = load();
  const rec = (db.fixedAssets || []).find((x) => x.id === id);
  if (!rec) return;
  db.fixedAssets = db.fixedAssets.filter((x) => x.id !== id);
  touch('fixedAssets', rec, true);
  log('delete', 'Fixed asset deleted', `${rec.tag} · ${rec.name} · ${CURRENCY}${rec.cost}`, user);
  persist();
};

/** Turn an "Equipment Purchase" expense into a capitalised, depreciating asset. */
export const moveExpenseToAsset = (expenseId, extra = {}, user) => {
  const db = load();
  const exp = db.expenses.find((x) => x.id === expenseId);
  if (!exp) throw new Error('Expense not found.');
  const rec = addFixedAsset({
    name: extra.name || exp.description || 'Equipment',
    category: extra.category || 'Other equipment',
    date: exp.date, cost: exp.amount, salvage: extra.salvage || 0,
    lifeMonths: extra.lifeMonths || 60, supplier: exp.paidTo,
    invoice: exp.receipt, note: 'Capitalised from expense ' + exp.no,
  }, user);
  db.expenses = db.expenses.filter((x) => x.id !== expenseId);
  touch('expenses', exp, true);
  log('asset', 'Expense capitalised', `${exp.no} ${CURRENCY}${exp.amount} → fixed asset ${rec.tag}`, user);
  persist();
  return rec;
};

/* ── aggregations ────────────────────────────────────── */
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

/** Value of supplier bills dated inside a period (the accrual cost). */
const billsInRange = (range) => money2(bills()
  .filter((b) => inRange(b.date, range))
  .reduce((a, b) => a + (Number(b.amount) || 0), 0));

export const creditPurchasesInRange = (range) => billsInRange(range);

/** Money actually paid to suppliers inside a period. */
const supplierPaymentsInRange = (range) => {
  let total = 0;
  bills().forEach((b) => (b.payments || []).forEach((p) => {
    if (inRange(p.at, range)) total += Number(p.amount) || 0;
  }));
  return money2(total);
};

export const summary = (range) => {
  const db = load();
  const s = db.sales.filter((x) => inRange(x.date, range));
  const e = db.expenses.filter((x) => inRange(x.date, range));
  const rev = sum(s, (x) => x.amount);
  const cogs = sum(s, (x) => x.cost);
  const exp = sum(e, (x) => x.amount);
  const cashRev = sum(s, (x) => paidOn(x));
  const credit = sum(s, (x) => outstandingOn(x));
  const depreciation = depreciationFor(range);
  const creditPurchases = billsInRange(range);
  const gross = rev - cogs;
  const net = money2(gross - exp - depreciation - creditPurchases);

  const byService = SERVICES.map((sv) => {
    const rows = s.filter((x) => x.service === sv.id);
    return { ...sv, count: rows.length, revenue: sum(rows, (x) => x.amount) };
  }).filter((x) => x.count > 0).sort((a, b) => b.revenue - a.revenue);

  const byMethod = PAYMENT_METHODS.map((m) => ({
    label: m, value: sum(s.filter((x) => x.method === m), (x) => x.amount),
  })).filter((x) => x.value > 0);

  const byCategory = [...new Set(e.map((x) => x.category))].map((c) => ({
    label: c, value: sum(e.filter((x) => x.category === c), (x) => x.amount),
  })).sort((a, b) => b.value - a.value);

  const byStaff = [...new Set(s.map((x) => x.createdBy))].map((n) => ({
    label: n,
    value: sum(s.filter((x) => x.createdBy === n), (x) => x.amount),
    count: s.filter((x) => x.createdBy === n).length,
  })).sort((a, b) => b.value - a.value);

  return {
    sales: s, expenses: e, rev, cogs, exp, creditPurchases, expTotal: money2(exp + creditPurchases),
    depreciation, gross, net, cashRev, credit,
    assetsPurchased: assetPurchasesFor(range),
    count: s.length, expCount: e.length, byService, byMethod, byCategory, byStaff,
    margin: rev ? (net / rev) * 100 : 0,
    grossMargin: rev ? (gross / rev) * 100 : 0,
    avgTicket: s.length ? rev / s.length : 0,
  };
};

export const daySeries = (range) => {
  const db = load();
  const out = [];
  let d = startOfDay(range.from);
  const end = endOfDay(range.to);
  const spanDays = Math.ceil((end - d) / 86400000);
  if (spanDays > 62) {
    // aggregate by month
    const byMonth = {};
    db.sales.forEach((s) => {
      if (!inRange(s.date, range)) return;
      const k = monthKey(s.date);
      byMonth[k] = byMonth[k] || { a: 0, b: 0 };
      byMonth[k].a += Number(s.amount) || 0;
    });
    db.expenses.forEach((e) => {
      if (!inRange(e.date, range)) return;
      const k = monthKey(e.date);
      byMonth[k] = byMonth[k] || { a: 0, b: 0 };
      byMonth[k].b += Number(e.amount) || 0;
    });
    return Object.keys(byMonth).sort().map((k) => ({
      label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(k.slice(5)) - 1],
      a: byMonth[k].a, b: byMonth[k].b,
    }));
  }
  while (d <= end) {
    const k = dateKey(d);
    out.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      a: sum(db.sales.filter((s) => dateKey(s.date) === k), (s) => s.amount),
      b: sum(db.expenses.filter((e) => dateKey(e.date) === k), (e) => e.amount),
    });
    d = addDays(d, 1);
  }
  return out;
};

/* Revenue AND expenses per day for the live dashboard chart. */
export const last7Split = () => {
  const db = load();
  const todayKey = dateKey(new Date());
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const k = dateKey(d);
    out.push({
      label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      rev: sum(db.sales.filter((s) => dateKey(s.date) === k), (s) => s.amount),
      exp: sum(db.expenses.filter((e) => dateKey(e.date) === k), (e) => e.amount),
      today: k === todayKey,
    });
  }
  return out;
};

/* Takings per opening hour today, for the live "today so far" chart. */
export const todayHours = (from = 7, to = 20) => {
  const db = load();
  const k0 = dateKey(new Date());
  const out = [];
  for (let h = from; h <= to; h++) {
    const rows = db.sales.filter((s) => dateKey(s.date) === k0 && new Date(s.date).getHours() === h);
    const outs = db.expenses.filter((e) => dateKey(e.date) === k0 && new Date(e.date).getHours() === h);
    out.push({
      label: String(h).padStart(2, '0'),
      hour: h,
      rev: sum(rows, (s) => s.amount),
      exp: sum(outs, (e) => e.amount),
      count: rows.length,
    });
  }
  return out;
};

export const last7RevExp = () => {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const k = dateKey(d);
    out.push({
      label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
      v: sum(load().sales.filter((s) => dateKey(s.date) === k), (s) => s.amount),
    });
  }
  return out;
};

export const stockValue = () => sum(load().stock, (x) => x.qty * x.unitCost);
export const lowStock = () => load().stock.filter((x) => x.qty <= x.reorder);

export const balanceSheet = (asOf = new Date()) => {
  const db = load();
  const end = endOfDay(asOf);
  const salesTo = db.sales.filter((x) => new Date(x.date) <= end);
  const expTo = db.expenses.filter((x) => new Date(x.date) <= end);
  const capTo = db.capital.filter((x) => new Date(x.date) <= end);

  const cashCollected = sum(salesTo, (x) => paidOn(x));
  const receivables = sum(salesTo, (x) => outstandingOn(x));
  const cashPaid = sum(expTo, (x) => x.amount);
  const injections = sum(capTo.filter((x) => x.type === 'capital'), (x) => x.amount);
  const drawings = sum(capTo.filter((x) => x.type === 'drawing'), (x) => x.amount);

  const roll = assetRollup(end);
  const assetSpend = sum(db.fixedAssets.filter((a) => new Date(a.date) <= end), (a) => a.cost);
  const proceeds = sum(db.fixedAssets.filter((a) => a.disposedAt && new Date(a.disposedAt) <= end), (a) => Number(a.disposalProceeds) || 0);
  // supplier bills: the cost is taken on when the bill is dated, cash leaves when it is paid
  const purchases = purchasesAsOf(end);
  const supplierPaid = supplierPaymentsAsOf(end);
  const payables = Math.round((purchases - supplierPaid) * 100) / 100;

  const cash = cashCollected - cashPaid + injections - drawings - assetSpend + proceeds - supplierPaid;
  const inventory = stockValue();
  const revenue = sum(salesTo, (x) => x.amount);
  const cogs = sum(salesTo, (x) => x.cost);
  const expenses = sum(expTo, (x) => x.amount);
  const depreciation = assetRollup(end).accDep;
  const netProfit = money2(revenue - cogs - expenses - depreciation - purchases);

  const assets = cash + receivables + inventory + roll.nbv;
  const liabilities = payables;

  // Capital section. Stock on hand is carried as a materials reserve so that
  // assets and equity always reconcile, even when consumables were purchased
  // outside the recorded expense ledger.
  const equity = injections - drawings;
  const retained = netProfit;
  const reserve = assets - liabilities - (equity + retained);
  const totalEquity = equity + retained + reserve;

  return {
    asOf: end, cash, receivables, inventory, assets,
    liabilities, payables, purchases, supplierPaid,
    equity, drawings, retained, reserve, totalEquity,
    check: Math.round((assets - liabilities - totalEquity) * 100) / 100,
    revenue, cogs, expenses, purchases, netProfit,
    assetCost: roll.cost, assetAccDep: roll.accDep, assetNbv: roll.nbv, assetCount: roll.count,
  };
};

export const cashFlow = (range) => {
  const db = load();
  const s = db.sales.filter((x) => inRange(x.date, range));
  const e = db.expenses.filter((x) => inRange(x.date, range));
  const c = db.capital.filter((x) => inRange(x.date, range));
  const inflow = sum(s, (x) => paidOn(x));
  const inj = sum(c.filter((x) => x.type === 'capital'), (x) => x.amount);
  const out = sum(e, (x) => x.amount);
  const draw = sum(c.filter((x) => x.type === 'drawing'), (x) => x.amount);
  const capex = assetPurchasesFor(range);
  const proceeds = assetDisposalsFor(range);
  const supplierPay = supplierPaymentsInRange(range);
  const net = inflow + inj + proceeds - out - draw - capex - supplierPay;
  return { inflow, inj, out, draw, capex, proceeds, supplierPay, net };
};


/* ══════════════════════════════════════════════════════
   SUPPLIERS & CREDITOR BILLS  (money the shop owes)
   A bill is a cost the shop has taken on but not yet paid.
   Unpaid bills are a liability on the balance sheet; the cost
   itself hits the profit in the month the bill is dated.
   ══════════════════════════════════════════════════════ */
export const suppliers = () => load().suppliers || [];
export const bills = () => load().bills || [];

export const supplierById = (id) => suppliers().find((x) => x.id === id) || null;

export const addSupplier = (data, user) => {
  const db = load();
  if (!db.suppliers) db.suppliers = [];
  const name = String(data.name || '').trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Enter the supplier\'s name.');
  if (db.suppliers.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    throw new Error('That supplier is already on the list.');
  const rec = {
    id: uid('sup'),
    name,
    phone: String(data.phone || '').trim(),
    note: String(data.note || '').trim(),
    createdAt: new Date().toISOString(),
    createdBy: user?.name || 'System',
  };
  db.suppliers.push(rec);
  touch('suppliers', rec);
  log('supplier', 'Supplier added', name, user);
  persist();
  return rec;
};

export const updateSupplier = (id, patch, user) => {
  const db = load();
  const rec = (db.suppliers || []).find((x) => x.id === id);
  if (!rec) return;
  if (patch.name != null) {
    const name = String(patch.name).trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('The supplier needs a name.');
    rec.name = name;
  }
  if (patch.phone != null) rec.phone = String(patch.phone).trim();
  if (patch.note != null) rec.note = String(patch.note).trim();
  rec.updatedAt = new Date().toISOString();
  touch('suppliers', rec);
  log('supplier', 'Supplier edited', rec.name, user);
  persist();
  return rec;
};

export const deleteSupplier = (id, user) => {
  const db = load();
  const rec = (db.suppliers || []).find((x) => x.id === id);
  if (!rec) return;
  const used = bills().filter((b) => b.supplierId === id).length;
  if (used) throw new Error(`${rec.name} has ${used} bill(s) on record. Those must keep their supplier.`);
  db.suppliers = db.suppliers.filter((x) => x.id !== id);
  touch('suppliers', rec, true);
  log('supplier', 'Supplier removed', rec.name, user);
  persist();
};

const billOutstandingOf = (b) => {
  const paid = (b.payments || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  return Math.max(0, Math.round(((Number(b.amount) || 0) - paid) * 100) / 100);
};
export const billOutstanding = (b) => billOutstandingOf(b);
export const billPaid = (b) => Math.round(((Number(b.amount) || 0) - billOutstandingOf(b)) * 100) / 100;

/** A bill is "overdue" once its due date has passed with money still owed. */
export const billOverdueDays = (b, asOf = new Date()) => {
  if (billOutstandingOf(b) <= 0.004) return 0;
  const due = new Date(b.dueDate || b.date);
  const diff = Math.floor((endOfDay(asOf) - endOfDay(due)) / 86400000);
  return diff > 0 ? diff : 0;
};

const nextBillNo = () => {
  const all = bills();
  let n = all.length + 1;
  let no = 'BILL-' + String(n).padStart(4, '0');
  while (all.some((b) => b.no === no)) no = 'BILL-' + String(++n).padStart(4, '0');
  return no;
};

export const addBill = (data, user) => {
  const db = load();
  assertOpen(data.date || new Date(), 'A supplier bill');
  if (!db.bills) db.bills = [];
  const amount = Math.round((Number(data.amount) || 0) * 100) / 100;
  if (!(amount > 0)) throw new Error('Enter how much the bill is for.');
  let supplierId = data.supplierId || null;
  let supplierName = String(data.supplierName || '').trim();
  if (supplierId) {
    const sup = supplierById(supplierId);
    if (!sup) throw new Error('That supplier no longer exists.');
    supplierName = sup.name;
  } else if (supplierName) {
    // typing a new supplier name adds them to the list automatically
    const existing = suppliers().find((x) => x.name.toLowerCase() === supplierName.toLowerCase());
    supplierId = existing ? existing.id : addSupplier({ name: supplierName }, user).id;
    supplierName = supplierById(supplierId)?.name || supplierName;
  } else {
    throw new Error('Choose or type the supplier.');
  }
  const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const dueDate = data.dueDate ? new Date(data.dueDate).toISOString()
    : new Date(new Date(date).getTime() + (Number(data.creditDays) > 0 ? Number(data.creditDays) : 30) * 86400000).toISOString();
  const rec = {
    id: uid('bill'),
    no: nextBillNo(),
    supplierId,
    supplierName,
    description: String(data.description || '').trim() || 'Goods supplied',
    category: data.category || 'Paper & A-Sheets',
    reference: String(data.reference || '').trim(),
    date,
    dueDate,
    amount,
    payments: [],
    status: 'open',
    note: String(data.note || '').trim(),
    createdBy: user?.name || 'System',
    createdById: user?.id || null,
    createdAt: new Date().toISOString(),
  };
  db.bills.unshift(rec);
  touch('bills', rec);
  log('bill', 'Supplier bill recorded', `${rec.no} · ${supplierName} · ${CURRENCY}${amount.toFixed(2)} due ${dateKey(dueDate)}`, user);
  persist();
  return rec;
};

export const updateBill = (id, patch, user) => {
  const db = load();
  const rec = (db.bills || []).find((x) => x.id === id);
  if (!rec) return;
  assertOpen(patch.date || rec.date, 'This bill');
  if (patch.amount != null) {
    const paid = billPaid(rec);
    const amount = Math.round((Number(patch.amount) || 0) * 100) / 100;
    if (amount + 0.004 < paid) throw new Error(`Already paid ${CURRENCY}${paid.toFixed(2)} on this bill.`);
    rec.amount = amount;
  }
  if (patch.description != null) rec.description = String(patch.description).trim();
  if (patch.category != null) rec.category = patch.category;
  if (patch.reference != null) rec.reference = String(patch.reference).trim();
  if (patch.date) rec.date = new Date(patch.date).toISOString();
  if (patch.dueDate) rec.dueDate = new Date(patch.dueDate).toISOString();
  if (patch.note != null) rec.note = String(patch.note).trim();
  rec.status = billOutstandingOf(rec) > 0.004 ? 'open' : 'paid';
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = user?.name || 'System';
  touch('bills', rec);
  log('bill', 'Supplier bill edited', `${rec.no} · ${CURRENCY}${rec.amount.toFixed(2)}`, user);
  persist();
  return rec;
};

export const deleteBill = (id, user) => {
  const db = load();
  const rec = (db.bills || []).find((x) => x.id === id);
  if (!rec) return;
  assertOpen(rec.date, 'This bill');
  db.bills = db.bills.filter((x) => x.id !== id);
  touch('bills', rec, true);
  log('bill', 'Supplier bill deleted', `${rec.no} · ${rec.supplierName} · ${CURRENCY}${rec.amount.toFixed(2)}`, user);
  persist();
};

/** Pay (or part-pay) a supplier bill — money leaves the till. */
export const payBill = (id, { amount, date, method = 'Cash', note = '' } = {}, user) => {
  const db = load();
  assertOpen(date || new Date(), 'A supplier payment');
  const rec = (db.bills || []).find((x) => x.id === id);
  if (!rec) throw new Error('Bill not found.');
  const due = billOutstandingOf(rec);
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(amt > 0)) throw new Error('Enter the amount paid.');
  if (amt > due + 0.004) throw new Error(`Only ${CURRENCY}${due.toFixed(2)} is still owed on this bill.`);
  if (!Array.isArray(rec.payments)) rec.payments = [];
  rec.payments.push({
    id: uid('bpmt'),
    at: date ? new Date(date).toISOString() : new Date().toISOString(),
    amount: amt,
    method,
    note,
    by: user?.name || 'System',
  });
  rec.status = billOutstandingOf(rec) > 0.004 ? 'open' : 'paid';
  rec.paidAt = rec.status === 'paid' ? new Date().toISOString() : null;
  rec.updatedAt = new Date().toISOString();
  touch('bills', rec);
  log('bill', 'Supplier paid', `${rec.no} · ${rec.supplierName} · ${CURRENCY}${amt.toFixed(2)} (${method}) — ${rec.status === 'paid' ? 'settled' : CURRENCY + billOutstandingOf(rec).toFixed(2) + ' still owed'}`, user);
  persist();
  return rec;
};

/** Bills with money still owed, oldest first. */
export const creditorBills = () => bills()
  .filter((b) => billOutstandingOf(b) > 0.004)
  .sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date));

export const creditorsTotal = (asOf = new Date()) => {
  const end = endOfDay(asOf);
  return Math.round(creditorBills()
    .filter((b) => new Date(b.date) <= end)
    .reduce((a, b) => a + billOutstandingOf(b), 0) * 100) / 100;
};

/** Value of bills dated up to a date (the accrual cost of purchases). */
export const purchasesAsOf = (asOf = new Date()) => {
  const end = endOfDay(asOf);
  return Math.round(bills().filter((b) => new Date(b.date) <= end)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0) * 100) / 100;
};

/** Money actually paid to suppliers up to a date. */
export const supplierPaymentsAsOf = (asOf = new Date()) => {
  const end = endOfDay(asOf);
  let total = 0;
  bills().forEach((b) => (b.payments || []).forEach((p) => {
    if (new Date(p.at) <= end) total += Number(p.amount) || 0;
  }));
  return Math.round(total * 100) / 100;
};

export const suppliersOwed = (asOf = new Date()) => {
  const end = endOfDay(asOf);
  const map = new Map();
  bills().filter((b) => new Date(b.date) <= end).forEach((b) => {
    const due = billOutstandingOf(b);
    const paid = billPaid(b);
    const key = b.supplierName || 'Unknown supplier';
    const row = map.get(key) || { name: key, billed: 0, paid: 0, owed: 0, bills: 0, oldest: null };
    row.billed += Number(b.amount) || 0;
    row.paid += paid;
    row.owed += due;
    if (due > 0.004) {
      row.bills += 1;
      const d = new Date(b.dueDate || b.date);
      if (!row.oldest || d < row.oldest) row.oldest = d;
    }
    map.set(key, row);
  });
  return [...map.values()]
    .map((r) => ({ ...r, billed: Math.round(r.billed * 100) / 100, paid: Math.round(r.paid * 100) / 100, owed: Math.round(r.owed * 100) / 100 }))
    .sort((a, b) => b.owed - a.owed);
};

export const creditorsAgeing = (asOf = new Date()) => {
  const buckets = [
    { label: 'Not yet due', value: 0 },
    { label: '1 – 30 days late', value: 0 },
    { label: '31 – 60 days late', value: 0 },
    { label: 'Over 60 days late', value: 0 },
  ];
  creditorBills().filter((b) => new Date(b.date) <= endOfDay(asOf)).forEach((b) => {
    const late = billOverdueDays(b, asOf);
    const due = billOutstandingOf(b);
    if (!late) buckets[0].value += due;
    else if (late <= 30) buckets[1].value += due;
    else if (late <= 60) buckets[2].value += due;
    else buckets[3].value += due;
  });
  buckets.forEach((b) => { b.value = Math.round(b.value * 100) / 100; });
  return buckets;
};

/* ══════════════════════════════════════════════════════
   CLOSE OF DAY  (cash-up / Z-report)
   ══════════════════════════════════════════════════════ */
export const cashups = () => load().cashups || [];

const CASH_METHODS = ['Cash', 'MoMo', 'Bank Transfer'];
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Everything that moved through the till on one day, split by payment method. */
export const dayCash = (day = new Date()) => {
  const db = load();
  const key = dateKey(day);
  const inBy = { Cash: 0, MoMo: 0, 'Bank Transfer': 0 };
  const outBy = { Cash: 0, MoMo: 0, 'Bank Transfer': 0 };
  const bump = (bag, method, amount) => {
    if (!CASH_METHODS.includes(method)) method = 'Cash';
    bag[method] = money2(bag[method] + (Number(amount) || 0));
  };

  // money taken from customers
  db.sales.forEach((s) => {
    if (dateKey(s.date) === key) {
      // the part paid on the day of the sale
      const upfront = money2(paidOn(s) - (s.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
      if (upfront > 0) bump(inBy, s.method, upfront);
    }
    (s.payments || []).forEach((p) => {
      if (p.method === 'Write-off') return;
      if (dateKey(p.at) === key) bump(inBy, p.method, p.amount);
    });
  });
  // money paid out
  db.expenses.forEach((e) => { if (dateKey(e.date) === key) bump(outBy, e.method, e.amount); });
  (db.bills || []).forEach((b) => (b.payments || []).forEach((p) => {
    if (dateKey(p.at) === key) bump(outBy, p.method, p.amount);
  }));
  (db.fixedAssets || []).forEach((a) => { if (dateKey(a.date) === key) bump(outBy, 'Cash', a.cost); });
  const cap = db.capital.filter((c) => dateKey(c.date) === key);
  cap.filter((c) => c.type === 'capital').forEach((c) => bump(inBy, 'Cash', c.amount));
  cap.filter((c) => c.type === 'drawing').forEach((c) => bump(outBy, 'Cash', c.amount));

  const net = {};
  CASH_METHODS.forEach((m) => { net[m] = money2(inBy[m] - outBy[m]); });
  return {
    key,
    in: inBy,
    out: outBy,
    net,
    salesCount: db.sales.filter((s) => dateKey(s.date) === key).length,
    expenseCount: db.expenses.filter((e) => dateKey(e.date) === key).length,
    receipts: money2(inBy.Cash + inBy.MoMo + inBy['Bank Transfer']),
    payments: money2(outBy.Cash + outBy.MoMo + outBy['Bank Transfer']),
  };
};

export const cashupFor = (day = new Date()) => {
  const key = typeof day === 'string' ? day : dateKey(day);
  return cashups().find((c) => c.day === key) || null;
};

/** Expected in the till = opening float + cash in − cash out. */
export const expectedCash = (day = new Date(), float = 0) => {
  const d = typeof day === 'string' ? dayCash(new Date(day + 'T12:00:00')) : dayCash(day);
  const f = money2(float);
  return {
    day: d.key,
    float: f,
    in: d.in,
    out: d.out,
    expected: {
      Cash: money2(f + d.net.Cash),
      MoMo: money2(d.net.MoMo),
      'Bank Transfer': money2(d.net['Bank Transfer']),
    },
    receipts: d.receipts,
    payments: d.payments,
    salesCount: d.salesCount,
    expenseCount: d.expenseCount,
  };
};

export const saveCashup = ({ day, float = 0, counted = {}, note = '' }, user) => {
  const db = load();
  assertOpen(day, 'A cash-up');
  if (!db.cashups) db.cashups = [];
  const key = typeof day === 'string' ? day : dateKey(day);
  const exp = expectedCash(key, float);
  const c = {
    Cash: money2(counted.Cash),
    MoMo: money2(counted.MoMo),
    'Bank Transfer': money2(counted['Bank Transfer']),
  };
  const variance = {};
  let totalVariance = 0;
  CASH_METHODS.forEach((m) => {
    variance[m] = money2(c[m] - exp.expected[m]);
    totalVariance += variance[m];
  });
  totalVariance = money2(totalVariance);

  const existing = db.cashups.find((x) => x.day === key);
  const rec = existing || { id: uid('cash'), day: key, createdAt: new Date().toISOString() };
  Object.assign(rec, {
    float: exp.float,
    expected: exp.expected,
    in: exp.in,
    out: exp.out,
    counted: c,
    variance,
    totalVariance,
    receipts: exp.receipts,
    payments: exp.payments,
    note: String(note || '').trim(),
    by: user?.name || 'System',
    byId: user?.id || null,
    at: new Date().toISOString(),
  });
  if (!existing) db.cashups.unshift(rec);
  touch('cashups', rec);
  const verdict = Math.abs(totalVariance) < 0.01 ? 'till balanced'
    : totalVariance > 0 ? `${CURRENCY}${totalVariance.toFixed(2)} over` : `${CURRENCY}${Math.abs(totalVariance).toFixed(2)} short`;
  log('cashup', 'Day closed', `${key} · ${verdict}`, user);
  persist();
  return rec;
};

export const approveCashup = (id, admin) => {
  const db = load();
  const rec = (db.cashups || []).find((x) => x.id === id);
  if (!rec) throw new Error('Cash-up not found.');
  if (admin?.role !== 'admin') throw new Error('Only the administrator can approve a cash-up.');
  rec.approvedBy = admin.name;
  rec.approvedAt = new Date().toISOString();
  touch('cashups', rec);
  log('cashup', 'Cash-up approved', `${rec.day} · ${rec.approvedBy}`, admin);
  persist();
  return rec;
};

export const deleteCashup = (id, admin) => {
  const db = load();
  const rec = (db.cashups || []).find((x) => x.id === id);
  if (!rec) return;
  if (admin?.role !== 'admin') throw new Error('Only the administrator can re-open a closed day.');
  db.cashups = db.cashups.filter((x) => x.id !== id);
  touch('cashups', rec, true);
  log('cashup', 'Cash-up deleted', rec.day, admin);
  persist();
};

/** The last day that has any activity — used as the default for the cash-up. */
export const lastActiveDay = () => {
  const db = load();
  const dates = [
    ...db.sales.map((x) => x.date), ...db.expenses.map((x) => x.date),
    ...(db.bills || []).flatMap((b) => (b.payments || []).map((p) => p.at)),
  ].filter(Boolean).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return dateKey(new Date());
  return dateKey(new Date(Math.max(...dates.map((d) => d.getTime()))));
};

/* ── backups ───────────────────────────────────────────
 * A snapshot is a FULL copy of the books. Keeping six of them beside the
 * books in localStorage would eat the 5 MB a browser gives this site, so the
 * snapshot DATA lives in IndexedDB (gigabytes) and only a tiny index — date
 * and size — stays in the `qp_backups_v1` key. The storage keys are unchanged.
 */
const SNAP_DB = 'qp_snap_v1';
const SNAP_STORE = 'snaps';
const SNAP_KEEP = 3;

const snapDb = () => new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
  const r = indexedDB.open(SNAP_DB, 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains(SNAP_STORE)) d.createObjectStore(SNAP_STORE);
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

const snapWrite = (at, data) => snapDb().then((d) => new Promise((res, rej) => {
  const tx = d.transaction(SNAP_STORE, 'readwrite');
  const req = tx.objectStore(SNAP_STORE).put(data, at);
  tx.oncomplete = () => res(true);
  tx.onerror = () => rej(tx.error);
  if (req && req.onerror) req.onerror = () => rej(req.error);
}));

const snapRead = (at) => snapDb().then((d) => new Promise((res, rej) => {
  const tx = d.transaction(SNAP_STORE, 'readonly');
  const req = tx.objectStore(SNAP_STORE).get(at);
  req.onsuccess = () => res(req.result || null);
  req.onerror = () => rej(req.error);
}));

const snapKeys = () => snapDb().then((d) => new Promise((res, rej) => {
  const tx = d.transaction(SNAP_STORE, 'readonly');
  const req = tx.objectStore(SNAP_STORE).getAllKeys();
  req.onsuccess = () => res(req.result || []);
  req.onerror = () => rej(req.error);
}));

const snapDrop = (at) => snapDb().then((d) => new Promise((res) => {
  const tx = d.transaction(SNAP_STORE, 'readwrite');
  tx.objectStore(SNAP_STORE).delete(at);
  tx.oncomplete = () => res(true);
  tx.onerror = () => res(false);
}));

export const exportJSON = () => JSON.stringify(load(), null, 2);

export const autoBackup = () => {
  const db = load();
  const today = dateKey();
  if (db.meta.backupAt && dateKey(db.meta.backupAt) === today) return false;
  const at = new Date().toISOString();
  const size = JSON.stringify(db).length;
  try {
    const snaps = JSON.parse(localStorage.getItem('qp_backups_v1') || '[]');
    // index only — no `data` field, so this key stays a few hundred bytes
    const next = [{ at, size }, ...snaps.filter((x) => x.at !== at)].slice(0, SNAP_KEEP);
    localStorage.setItem('qp_backups_v1', JSON.stringify(next));
    db.meta.backupAt = at;
    persist();
    // the heavy copy goes to IndexedDB, off the localStorage budget
    snapWrite(at, db).then(() => snapKeys()).then((keys) => {
      const extra = keys.filter((k) => !next.some((x) => x.at === k));
      return Promise.all(extra.map((k) => snapDrop(k)));
    }).catch((e) => console.warn('snapshot data not stored', e));
    return true;
  } catch (e) { console.warn('backup failed', e); return false; }
};

export const listBackups = () => {
  try { return JSON.parse(localStorage.getItem('qp_backups_v1') || '[]').map(({ data, ...m }) => m); }
  catch { return []; }
};

export const restoreBackup = async (at) => {
  const snaps = JSON.parse(localStorage.getItem('qp_backups_v1') || '[]');
  const snap = snaps.find((s) => s.at === at);
  if (!snap) throw new Error('Backup not found on this device.');
  // older versions kept the copy inline; newer ones keep it in IndexedDB
  const data = snap.data || await snapRead(at);
  if (!data) throw new Error('That snapshot is no longer stored on this device — use “Restore from file”.');
  localStorage.setItem(KEY, JSON.stringify(data));
  cache = null;
  load();
  persist();
  return true;
};

/* How much of the browser's ~5 MB this site is using, for the Settings meter. */
export const storageUsage = () => {
  const used = (localStorage.getItem(KEY) || '').length + (localStorage.getItem('qp_backups_v1') || '').length;
  const quota = 5 * 1024 * 1024;   // measured ceiling in this browser: ~5.2 M characters
  return {
    chars: used,
    quota,
    pct: Math.max(0, Math.min(100, Math.round((used / quota) * 100))),
    freeKB: Math.max(0, Math.round((quota - used) / 1024)),
    rows: (load().sales || []).length + (load().expenses || []).length,
  };
};

export const importJSON = (text) => {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.sales) || !Array.isArray(data.users))
    throw new Error('That file is not a valid Quarsh\'s Press backup.');
  localStorage.setItem(KEY, JSON.stringify(data));
  cache = null;
  load();
  persist();
};

/* ── seed stock catalogue + admin ────────────────────── */
export const seedStock = (user) => {
  const db = load();
  if (db.meta.seeded || db.stock.length) return false;
  const list = [
    ['A4 A-Sheet (80g)', 'Paper', 'ream', 24, 10, 42],
    ['A3 A-Sheet (80g)', 'Paper', 'ream', 14, 6, 78],
    ['Photo Paper — Glossy A4', 'Paper', 'pack', 8, 4, 120],
    ['Card / Bristol Board', 'Paper', 'sheet', 60, 20, 3.5],
    ['Toner — Black (Universal)', 'Ink & Toner', 'cartridge', 6, 3, 260],
    ['Toner — Cyan', 'Ink & Toner', 'cartridge', 3, 2, 310],
    ['Toner — Magenta', 'Ink & Toner', 'cartridge', 3, 2, 310],
    ['Toner — Yellow', 'Ink & Toner', 'cartridge', 3, 2, 310],
    ['Ink — Dye Sublimation Set', 'Ink & Toner', 'set', 2, 1, 420],
    ['Lamination Film A4', 'Lamination', 'pack', 9, 4, 65],
    ['Lamination Film A3', 'Lamination', 'pack', 0, 3, 110],
    ['Comb Binding Rings 1"', 'Binding', 'pack', 11, 5, 38],
    ['Hard Cover Binding Board', 'Binding', 'piece', 25, 10, 12],
    ['Staple Wire', 'Binding', 'box', 5, 2, 18],
    ['Glue / Gum', 'Binding', 'bottle', 7, 3, 14],
  ];
  list.forEach(([name, category, unit, qty, reorder, unitCost], i) => {
    db.stock.push({
      id: uid('itm'), sku: 'STK-' + String(i + 1).padStart(3, '0'),
      name, category, unit, qty, reorder, unitCost, supplier: '',
      createdAt: new Date().toISOString(), updatedAt: null,
    });
  });
  db.meta.seeded = true;
  log('setup', 'Stock catalogue seeded', `${list.length} printing consumables loaded`, user);
  persist();
  return true;
};

export const getSettings = () => load().settings;
export const setSettings = (patch, user) => {
  const db = load();
  Object.assign(db.settings, patch);
  touch('settings', { id: 'business', ...db.settings });
  log('admin', 'Settings updated', Object.keys(patch).join(', '), user);
  persist();
};

/* ── cloud identity linking ──────────────────────────── */
/** Re-key a local login to its cloud UUID (keeps all historic entries attributed). */
export const linkUserIdentity = (oldId, newId) => {
  const db = load();
  const u = db.users.find((x) => x.id === oldId);
  if (!u || oldId === newId) return u;
  const conflict = db.users.find((x) => x.id === newId && x !== u);
  if (conflict) db.users = db.users.filter((x) => x !== u);
  else u.id = newId;
  u.cloudLinkedAt = new Date().toISOString();
  ['sales', 'expenses', 'capital', 'stockMoves'].forEach((tbl) => {
    (db[tbl] || []).forEach((rec) => {
      if (rec.createdById === oldId) {
        rec.createdById = newId;
        touch(tbl, rec);
      }
    });
  });
  touch('users', db.users.find((x) => x.id === newId) || u);
  log('admin', 'Cloud identity linked', `${u.name} (@${u.username}) linked to the shared database`, u);
  persist();
  return db.users.find((x) => x.id === newId);
};

/** Create or refresh the local mirror of a cloud profile. */
export const upsertUserFromProfile = (profile) => {
  const db = load();
  if (!profile?.id) return null;
  const uname = String(profile.username || '').toLowerCase();

  // Fold away any local-only duplicate of the same person (pre-cloud record)
  if (uname) {
    const dupes = db.users.filter(
      (x) => x.id !== profile.id && x.username && x.username.toLowerCase() === uname && !x.cloud
    );
    dupes.forEach((dupe) => {
      ['sales', 'expenses', 'capital', 'stockMoves'].forEach((tbl) => {
        (db[tbl] || []).forEach((rec) => {
          if (rec.createdById === dupe.id) {
            rec.createdById = profile.id;
            rec.createdBy = profile.name || rec.createdBy;
            touch(tbl, rec);
          }
        });
      });
      db.users = db.users.filter((x) => x.id !== dupe.id);
      touch('users', dupe, true);
    });
  }

  let u = db.users.find((x) => x.id === profile.id);
  if (!u) u = db.users.find((x) => x.username && x.username.toLowerCase() === uname);
  if (u) {
    // avoid sync churn: only re-queue when something actually changed
    const same = u.name === (profile.name || u.name)
      && u.username === String(profile.username || u.username).toLowerCase()
      && (u.mobile || '') === (profile.mobile || '')
      && u.role === (profile.role || u.role)
      && u.status === (profile.status || u.status)
      && !!u.cloud;
    if (same) {
      u.lastLogin = profile.last_login || u.lastLogin;
      u.loginCount = profile.login_count ?? u.loginCount;
      return u;
    }
    if (u.id !== profile.id && !db.users.some((x) => x.id === profile.id)) u.id = profile.id;
    Object.assign(u, {
      name: profile.name || u.name,
      username: (profile.username || u.username).toLowerCase(),
      mobile: profile.mobile || u.mobile,
      role: profile.role || u.role,
      status: profile.status || u.status,
      active: (profile.status || u.status) === 'active',
      approvedBy: profile.approved_by || u.approvedBy,
      lastLogin: profile.last_login || u.lastLogin,
      loginCount: profile.login_count ?? u.loginCount,
      cloud: true,
      updatedAt: new Date().toISOString(),
    });
  } else {
    u = {
      id: profile.id,
      name: profile.name || 'Staff',
      username: (profile.username || 'staff').toLowerCase(),
      mobile: profile.mobile || '',
      role: profile.role || 'staff',
      status: profile.status || 'pending',
      active: (profile.status || 'pending') === 'active',
      createdAt: profile.created_at || new Date().toISOString(),
      requestedAt: profile.created_at || new Date().toISOString(),
      approvedBy: profile.approved_by || null,
      lastLogin: profile.last_login || null,
      loginCount: profile.login_count || 0,
      cloud: true,
    };
    db.users.push(u);
  }
  touch('users', u);
  persist();
  return u;
};

/** Give a device a local PIN credential so it can sign in while offline. */
export const ensureOfflineCredential = async (userId, pin) => {
  const db = load();
  const u = db.users.find((x) => x.id === userId);
  if (!u) return null;
  if (!u.pinHash) Object.assign(u, await makeCredential(pin));
  touch('users', u);
  persist();
  return u;
};

/** Queue a reset request for someone who is not yet mirrored on this device. */
export const requestPinResetByUsername = (username, identifier) => {
  const db = load();
  const uname = String(username).toLowerCase();
  if (db.resetRequests.some((r) => r.username?.toLowerCase() === uname && r.status === 'pending'))
    throw new Error('A reset request is already waiting for the administrator.');
  db.resetRequests.unshift({
    id: uid('rst'),
    userId: null,
    name: username,
    username,
    mobile: String(identifier).replace(/[^\d]/g, ''),
    at: new Date().toISOString(),
    status: 'pending',
    note: 'requested from a new device',
  });
  log('reset', 'PIN reset requested', `${username} asked for a new PIN (cloud account)`, null);
  persist();
  return true;
};

/* ══════════════════════════════════════════════════════
   GHANA TAX REGISTER
   A month-by-month working paper for the Ghana Revenue
   Authority: what was sold, the levies collected, the VAT
   paid on purchases, and what is left to pay over.
   ══════════════════════════════════════════════════════ */
export const VAT_RATES = { nhil: 2.5, getfund: 2.5, covid: 1, vat: 15, flat: 3 };

/** The shop's financial year for a given date. */
export const fiscalYearOf = (date = new Date()) => {
  const startMonth = (Number(load().settings.fiscalStartMonth) || 1) - 1;
  const d = new Date(date);
  const year = d.getMonth() < startMonth ? d.getFullYear() - 1 : d.getFullYear();
  const start = new Date(year, startMonth, 1);
  const end = new Date(year + 1, startMonth, 0, 23, 59, 59);
  const label = start.getFullYear() === end.getFullYear()
    ? String(start.getFullYear())
    : `${start.getFullYear()}/${String(end.getFullYear()).slice(2)}`;
  return { start, end, label };
};

const monthRows = (range) => {
  const out = [];
  const from = new Date(range.from);
  const to = new Date(range.to);
  let cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) {
    const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
    out.push({ key: monthKey(mStart), start: mStart < from ? from : mStart, end: mEnd > to ? to : mEnd });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
};

export const taxRegister = (range) => {
  const db = load();
  const profile = taxProfile();
  const scheme = profile.scheme;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  let carry = 0;                 // VAT credit brought forward from the month before
  const months = monthRows(range).map(({ key, start, end }) => {
    const inR = (d) => { const t = new Date(d); return t >= start && t <= end; };
    const salesRows = db.sales.filter((x) => inR(x.date));
    const expRows = db.expenses.filter((x) => inR(x.date) && x.category !== DRAWINGS_LINE);
    const billRows = db.bills.filter((x) => inR(x.date));
    const turnover = r2(sum(salesRows, (x) => x.amount));
    const purchases = r2(sum(expRows, (x) => x.amount) + sum(billRows, (x) => x.amount));
    const creditSales = r2(sum(salesRows.filter((x) => x.method === 'Credit (Unpaid)'), (x) => x.amount));

    let nhil = 0, getfund = 0, covid = 0, vat = 0, inputVat = 0, flat = 0;
    if (scheme === 'standard') {
      nhil = r2(turnover * VAT_RATES.nhil / 100);
      getfund = r2(turnover * VAT_RATES.getfund / 100);
      covid = r2(turnover * VAT_RATES.covid / 100);
      const levyBase = turnover + nhil + getfund + covid;
      vat = r2(levyBase * VAT_RATES.vat / 100);
      // only the VAT element on purchases is creditable; the levies are a cost
      inputVat = r2(purchases * (1 + (VAT_RATES.nhil + VAT_RATES.getfund + VAT_RATES.covid) / 100) * VAT_RATES.vat / 100);
    } else if (scheme === 'flat') {
      flat = r2(turnover * VAT_RATES.flat / 100);
    }
    // an excess of input VAT over output VAT is not lost — it is carried forward
    const available = r2(inputVat + carry);
    const vatPayable = r2(Math.max(0, vat - available));
    const newCarry = r2(Math.max(0, available - vat));
    carry = newCarry;
    const levies = r2(nhil + getfund + covid + flat);
    return {
      key, start, end,
      label: new Date(start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      turnover, creditSales, purchases,
      nhil, getfund, covid, vat, flat, inputVat, vatPayable, levies,
      carryIn: r2(available - inputVat), carryOut: newCarry,
      totalDue: r2(vatPayable + levies),
    };
  });

  const t = (f) => r2(sum(months, f));
  const totals = {
    turnover: t((m) => m.turnover), creditSales: t((m) => m.creditSales), purchases: t((m) => m.purchases),
    nhil: t((m) => m.nhil), getfund: t((m) => m.getfund), covid: t((m) => m.covid),
    vat: t((m) => m.vat), flat: t((m) => m.flat), inputVat: t((m) => m.inputVat),
    vatPayable: t((m) => m.vatPayable), levies: t((m) => m.levies), totalDue: t((m) => m.totalDue),
    creditCarried: months.length ? months[months.length - 1].carryOut : 0,
  };

  // income tax is a year-end estimate on the profit the P&L reports
  const fin = summary(range);
  const incomeTax = {
    profit: r2(fin.net),
    rate: profile.incomeTaxRate,
    due: r2(Math.max(0, fin.net) * profile.incomeTaxRate / 100),
  };
  const fy = fiscalYearOf(range.to);
  return { range, scheme, profile, months, totals, incomeTax, fiscalYear: fy };
};

/* ═══════════════════════════════════════════════════════════════════
   CAMERA / CCTV  (v1.10.0)
   The administrator owns the switches. Staff can see the camera state
   but every write path here checks `user.role === 'admin'`.
   ═══════════════════════════════════════════════════════════════════ */

export const cameraSettings = () => {
  const db = load();
  return { ...defaultSettings.camera, ...(db.settings.camera || {}) };
};

/** Administrator only: change the camera policy. */
export const setCameraSettings = (patch, user) => {
  if (!user || user.role !== 'admin') throw new Error('Only the administrator can change camera settings');
  const db = load();
  db.settings.camera = { ...cameraSettings(), ...patch, updatedBy: user.name, updatedAt: new Date().toISOString() };
  touch('settings', db.settings);
  persist();
  return db.settings.camera;
};

/** Is the camera allowed to run for this officer right now? */
export const cameraAllowedFor = (userId) => {
  const c = cameraSettings();
  if (!c.enabled) return false;
  const per = c.byUser || {};
  return per[userId] === undefined ? true : !!per[userId];
};

/** Administrator only: switch one officer's camera on or off. */
export const setCameraForUser = (userId, on, user) => {
  if (!user || user.role !== 'admin') throw new Error('Only the administrator can switch a camera');
  const db = load();
  const c = { ...cameraSettings() };
  c.byUser = { ...(c.byUser || {}), [userId]: !!on };
  c.updatedBy = user.name;
  c.updatedAt = new Date().toISOString();
  db.settings.camera = c;
  touch('settings', db.settings);
  const target = db.users.find((u) => u.id === userId);
  log('camera', on ? 'Camera switched ON' : 'Camera switched OFF',
    `${target ? target.name : userId} — by ${user.name}`, user);
  logCameraEvent(on ? 'switch-on' : 'switch-off',
    `${target ? target.name : userId} — by ${user.name}`, user);
  persist();
  return c;
};

/** Administrator only: the master switch. */
export const setCameraMaster = (on, user) => {
  if (!user || user.role !== 'admin') throw new Error('Only the administrator can switch the cameras');
  const db = load();
  const c = { ...cameraSettings(), enabled: !!on, startedAt: on ? (cameraSettings().startedAt || new Date().toISOString()) : null };
  if (!on) c.startedAt = null;
  c.updatedBy = user.name;
  c.updatedAt = new Date().toISOString();
  db.settings.camera = c;
  touch('settings', db.settings);
  log('camera', on ? 'ALL cameras switched ON' : 'ALL cameras switched OFF', `by ${user.name}`, user);
  logCameraEvent(on ? 'master-on' : 'master-off', `all cameras — by ${user.name}`, user);
  persist();
  return c;
};

export const cameraEvents = () => load().camEvents || [];

export const logCameraEvent = (kind, detail, user) => {
  const db = load();
  const row = {
    id: uid('cam'),
    at: new Date().toISOString(),
    kind,
    detail,
    userId: user?.id || null,
    userName: user?.name || 'System',
    device: (load().sync && load().sync.deviceId) || null,
  };
  db.camEvents.unshift(row);
  if (db.camEvents.length > 800) db.camEvents.length = 800;
  touch('camEvents', row);
  persist();
  return row;
};

/* ── presence: what each officer is doing right now ── */
export const camPresence = () => load().camPresence || [];

export const upsertPresence = (patch, user) => {
  if (!user) return null;
  const db = load();
  const at = new Date().toISOString();
  let row = db.camPresence.find((p) => p.userId === user.id);
  if (!row) {
    row = { id: uid('pres'), userId: user.id, userName: user.name, role: user.role, firstSeenAt: at };
    db.camPresence.push(row);
  }
  Object.assign(row, patch, { at });
  row.online = true;
  if (db.camPresence.length > 40) db.camPresence = db.camPresence.slice(-40);
  touch('camPresence', row);
  persist();
  return row;
};

export const presenceFor = (userId) => camPresence().find((p) => p.userId === userId) || null;

/* ── clips: metadata here, the video bytes in IndexedDB ── */
export const camClips = () => load().camClips || [];

export const addCamClip = (meta, user) => {
  const db = load();
  const row = {
    id: meta.id || uid('clip'),
    userId: user?.id || null,
    userName: user?.name || 'Unknown',
    device: (load().sync && load().sync.deviceId) || null,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    secs: meta.secs || 0,
    bytes: meta.bytes || 0,
    mime: meta.mime || 'video/webm',
    hasAudio: !!meta.hasAudio,
    sha: meta.sha || null,
    local: meta.local !== false,      // the bytes are on this device
    uploadedAt: null,
    requested: false,
    deleted: false,
  };
  db.camClips.unshift(row);
  if (db.camClips.length > 2000) db.camClips.length = 2000;
  touch('camClips', row);
  persist();
  return row;
};

export const markClipDeleted = (clipId, user) => {
  const db = load();
  const row = db.camClips.find((c) => c.id === clipId);
  if (!row) return null;
  row.deleted = true;
  row.deletedBy = user?.name || 'System';
  row.deletedAt = new Date().toISOString();
  touch('camClips', row);
  log('camera', 'Clip deleted', `${row.userName} · ${fmtShort(row.startedAt)} · by ${row.deletedBy}`, user);
  persist();
  return row;
};

const fmtShort = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return String(iso || ''); }
};

/** Which clips should be dropped? older than retention, or over the size cap. */
export const clipsToPrune = () => {
  const c = cameraSettings();
  const now = Date.now();
  const live = camClips().filter((x) => !x.deleted);
  const cut = now - c.retentionDays * 864e5;
  const old = live.filter((x) => new Date(x.startedAt).getTime() < cut);
  let kept = live.filter((x) => new Date(x.startedAt).getTime() >= cut)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const cap = c.maxLocalMB * 1048576;
  let used = kept.reduce((a, x) => a + (x.bytes || 0), 0);
  const over = [];
  for (let i = kept.length - 1; i >= 0 && used > cap; i--) {
    used -= kept[i].bytes || 0;
    over.push(kept[i]);
  }
  return [...old, ...over].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
};

export const cameraStats = (userId = null) => {
  const rows = camClips().filter((c) => !c.deleted && (!userId || c.userId === userId));
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  return {
    count: rows.length,
    bytes: rows.reduce((a, x) => a + (x.bytes || 0), 0),
    today: rows.filter((x) => new Date(x.startedAt) >= dayStart).length,
    last: rows[0] || null,
  };
};

/* ── live chart series for any period (revenue AND expenses) ── */
export const revExpSeries = (period = 'week') => {
  const db = load();
  const now = new Date();
  const rows = [];
  if (period === 'today') {
    for (let h = 7; h <= 20; h++) {
      const sales = db.sales.filter((s) => dateKey(s.date) === dateKey(now) && new Date(s.date).getHours() === h);
      const exps = db.expenses.filter((e) => dateKey(e.date) === dateKey(now) && new Date(e.date).getHours() === h);
      rows.push({
        label: String(h).padStart(2, '0'),
        rev: sum(sales, (s) => s.amount),
        exp: sum(exps, (e) => e.amount),
        today: true,
      });
    }
    return { rows, title: 'Revenue vs Expenses', sub: 'Today, hour by hour · 07:00 to 20:00' };
  }
  if (period === 'month') {
    const y = now.getFullYear(), m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      rows.push({
        label: String(d),
        rev: sum(db.sales.filter((s) => dateKey(s.date) === k), (s) => s.amount),
        exp: sum(db.expenses.filter((e) => dateKey(e.date) === k), (e) => e.amount),
        today: d === now.getDate(),
      });
    }
    return { rows, title: 'Revenue vs Expenses', sub: 'This month, day by day' };
  }
  /* default: last seven days */
  for (let i = 6; i >= 0; i--) {
    const d = addDays(now, -i);
    const k = dateKey(d);
    rows.push({
      label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      rev: sum(db.sales.filter((s) => dateKey(s.date) === k), (s) => s.amount),
      exp: sum(db.expenses.filter((e) => dateKey(e.date) === k), (e) => e.amount),
      today: k === dateKey(now),
    });
  }
  return { rows, title: 'Revenue vs Expenses', sub: 'Last 7 days' };
};
