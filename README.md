# QUARSH'S PRINTING HUB — Business Suite

A complete, installable (Android + iPhone) business application for **Quarsh's Printing Hub**, Ho — Barracks Newtown, Zoomlion Junction.

Sales · Expenses · Stock · Statements · Staff logins · Oversight · Backups — all offline-capable and timestamped.

---

## 1 · First run (2 minutes)

1. Open the app on the shop's main phone/tablet/PC.
2. The landing page appears. Because no administrator exists yet, it shows **Administrator Setup**.
3. Enter your name, a username (max 15 characters), your Ghana mobile number (e.g. `0558103988`) and a 4–6 digit PIN.
4. Tap **Create Administrator**. The starter stock catalogue (A-sheets, toners, laminate film, binding materials) loads automatically.

You are now signed in as **Administrator** with full oversight.

## 2 · Giving staff access (10 logins)

Two ways:

**Staff self-register** — on the landing page they tap **Request Access**, enter name, username (max 15), Ghana mobile, and a PIN. Their account stays locked.

**Admin creates it** — *Staff & Logins → + Add staff login*.

Then, as administrator: *Staff & Logins* → **Approve** or **Decline**. Nobody can sign in until approved. The 10-login ceiling is enforced automatically; suspend, revoke or delete a login to free a slot.

## 3 · Daily workflow

| Task | Where |
|---|---|
| Record a job (printing, passport pictures, website, app, lamination, binding, books, brochures, result checking) | **Sales & Revenue → + Record sale** |
| Record a cost (paper, toner, electricity, transport, wages…) | **Expenses → + Record expense** |
| Receive or issue A-sheets/toners | **Stock & Materials → + In / − Out** |
| Print a receipt for a customer | **Sales → Receipt** |
| Print the day's statement | **Statements → Daily Statement → Print / Save as PDF** |

Every entry is stamped with the staff member's name, date and time — the administrator sees all of it, and every edit and deletion is written to the **Activity Trail**.

## 4 · Statements & reports

**Daily Statement · Profit & Loss · Balance Sheet · Cash Flow · Sales Register · Expense Ledger · General Ledger · Period Comparison (daily / weekly / monthly / yearly) · Staff Activity · Stock Valuation**

Choose any period (today, yesterday, this week, last week, this month, last month, this quarter, YTD, or a custom date range).

- **Print / Save as PDF** — a print-ready A4 statement with letterhead, prepared/approved signature lines and footer. In the print dialog choose *Save as PDF*.
- **Download CSV** — opens in Excel or Google Sheets.

## 5 · Accounts: staff or administrator

Anyone can request a login. On the **Request Access** form they choose the account type:

| Type | Sees | Can do |
|---|---|---|
| **Staff** | Dashboard, Sales, Expenses, Stock, Statements | Record sales/expenses/stock, print receipts & statements, edit or delete **their own** entries, change their own PIN |
| **Administrator** | Everything above **plus** Staff & Logins, Activity Trail, Settings | Approve/reject/suspend logins, grant or withhold administrator rights, edit or delete **anyone's** entries, issue PIN resets, change business settings |

A request for administrator rights arrives marked **"requested admin"**. The administrator approving it decides whether to grant that — approval is never automatic.

## 5b · Forgotten PIN / password reset

Three routes, by design:

1. **Self-service (signed in)** — *Settings → Change my PIN*. Needs the current PIN, updates the phone **and** the shared database.
2. **Self-service (locked out)** — on the sign-in screen tap **Forgot PIN?**, enter the mobile number or username. A reset request lands in the administrator's **Staff & Logins → PIN reset requests** panel.
3. **Administrator-assisted** — *Set temporary PIN* → the new PIN is written on this device and, once the `admin-reset-pin` Edge Function is deployed, into the shared database so it works on every phone. They then sign in and change it themselves.

Every request, reset and dismissal is written to the **Activity Trail** with the administrator's name and the exact time. PINs are stored only as salted PBKDF2-SHA256 hashes.

## 5c · Revenue & expenditure lines

**21 revenue lines** (colour printing, photocopy single/front-and-back in colour and B/W, typing only, typing & printing, book design only, book design & printing colour and B/W, banner design only, banner design & printing, passport, lamination, binding, brochures, results, web, app, other) and **16 expenditure lines** (15 operating costs + *Drawings (owner withdrawal)*).

The full chart of accounts — with what belongs in each line, price guidance and a worked monthly example — is in **`REVENUE-EXPENSE-LINES.md`**, and inside the app under **Settings → Revenue & expenditure lines**.

**Add your own lines three ways — no code:**

| Where | How |
|---|---|
| While selling | Sale form → Service → **➕ Add a new revenue line…** → type the name → save |
| While spending | Expense form → Category → **➕ Add a new expenditure line…** → type the name → save |
| Anytime | **Settings → Revenue & expenditure lines → + Add revenue / expenditure line**, or ✎ to rename & reprice, ✕ to remove |

New lines instantly become part of the chart of accounts, appear in the P&L and the trial balance, and sync to every approved phone. Removing a line never changes past entries — old sales keep their name and amount in every statement.

**Drawings:** choosing **Drawings (owner withdrawal)** on the expense form records an owner drawing — it appears in the register with a gold **CAPITAL** tag and in the balance sheet and trial balance, but is kept out of profit.

## 5d · Trial balance

**Statements & Reports** now holds a **complete set of accounts**. Tabs, in the order an accountant reads them:

| Tab | What it answers |
|---|---|
| **Financial Performance** *(the formal income & loss)* | Income by line, cost of sales, expenditure, depreciation → **surplus or deficit**, with this-period vs previous-period columns, change, change % and % of income |
| **Daily Statement** | What happened today, cash reconciled |
| **Profit & Loss** | The same figures in the classic shop format |
| **Balance Sheet** | What the business owns and owes (includes fixed assets at net book value) |
| **Trial Balance** | Every account, Dr and Cr, with a ✓ BALANCED control |
| **Cash Flow** | Where the cash actually moved, including equipment bought and sold |
| **Changes in Equity** | Capital in, surplus kept, drawings out — and it ties to the balance sheet |
| **Fixed Assets** | Asset register and depreciation schedule |
| **Debtors (owed to you)** | Every unpaid or part-paid sale, aged 0–30 / 31–60 / 61–90 / 90+ days |
| **Sales / Expenses / Ledger / Periods / Staff / Stock** | The detail registers behind the statements |

Every tab prints to PDF with the gold letterhead and exports to CSV.

**Statements & Reports → Trial Balance** lists every ledger account with debits and credits and prints a **✓ BALANCED** control check:

- **Debits:** cash & bank, trade receivables, inventory, cost of sales, each expense line, owner's drawings
- **Credits:** owner's capital, each revenue line, materials & timing reserve (stock on hand)

## 5e · Fixed assets (equipment you keep)

**Stock ≠ fixed assets.** Paper, toner, film and rings are **consumables** — they live in *Stock & Materials* and are used up on jobs. A printer, photocopier, computer, laminator, binding machine, camera or furniture is a **fixed asset**: you keep it for years.

**Operations → Fixed Assets** keeps a proper register:

| Field | What it does |
|---|---|
| Tag (FA-001) | Automatic, so the machine can be identified at a glance |
| Cost, date bought, supplier, invoice, serial | The purchase record |
| Useful life (years) | You type the years — 5 for a press, 4 for a laptop. The app turns that into months |
| Depreciation method | Straight line (ICA recommended for equipment) or reducing balance |
| Rate (% per year) | Only for reducing balance — filled in automatically from the GRA rate for the category |
| Resale (scrap) value | Optional; usually 0. The asset never depreciates below this |
| Net book value | Cost less everything written off so far |

**You do not calculate anything.** Enter the **date bought**, the **cost**, the **years** and the **method** — the app works out the monthly charge, the yearly charge, accumulated depreciation, net book value and the whole year-by-year schedule by itself, and shows it live in the form and in a **Depreciable schedule** panel before you save.

**The two ICA/IAS 16 methods, as this app applies them:**

| Method | How it is calculated | Best for |
|---|---|---|
| **Straight line** (default) | (Cost − scrap value) ÷ (years × 12). The same amount every month | Presses, photocopiers, laminators, binding machines, furniture — anything that wears out evenly |
| **Reducing balance** | A fixed % per year taken off the value left in the books; the monthly rate is `1 − (1 − rate)^(1/12)`. Bigger charge now, smaller later | Computers, cameras, phones — things that lose value fast, and where the GRA allowance is a % per year |

Purchase month counts as month 1, depreciation stops at the end of the useful life or at the scrap value, and the app never writes an asset down below its scrap value.

**Category defaults** (all editable):

| Category | Life (years) | GRA reducing-balance rate |
|---|---|---|
| Printing machine | 5 | 30% |
| Photocopier | 5 | 30% |
| Computer & laptop | 4 | 40% |
| Camera & studio | 4 | 40% |
| Laminator | 3 | 30% |
| Binding machine | 5 | 30% |
| Power & generator | 5 | 30% |
| Tools | 3 | 30% |
| Furniture & fittings | 10 | 20% |
| Other equipment | 5 | 20% |

**Why it matters:** if you spend GH₵6,000 on a copier and record it as an expense, that month shows a huge loss and every later month shows too much profit. Capitalised, the copier shows GH₵167 a month for 36 months — which is the truth.

Where it flows, automatically:
- **Profit & Loss** — one line: *Depreciation of fixed assets*.
- **Balance Sheet** — assets at cost, less accumulated depreciation, at net book value.
- **Trial Balance** — Dr 1400 fixed assets at cost · Dr 6600 depreciation · Cr 1410 accumulated depreciation.
- **Cash Flow** — the full price as cash out in the month you paid it.

**Three ways to add one**
1. **Fixed Assets → + Add asset** — the full form (cost, life, supplier, serial).
2. **Expenses → choose Equipment Purchase** — a gold box appears: *"This is equipment the shop keeps"* — tick it and the entry becomes a depreciating asset instead of an expense.
3. **Already recorded as an expense?** In the expense list tap **→ Asset** on that row. The expense is removed and the asset created, keeping its date and amount.

**Sell or scrap it:** **Sell** on the register records the date and money received — the asset leaves the balance sheet, the proceeds hit the cash flow statement, and the history stays in *Sold or written off*.

**See the whole life of one machine:** **Schedule** on any register row opens the year-by-year table — opening value, charge for the year, closing value — to the end of its life.

**Print it:** **Print register** produces a signed-off *Fixed Asset Register & Depreciation Schedule* (PDF or CSV) for the bank, an auditor or a loan application. The printed register shows the method and the life in years on every row, plus a depreciation-schedule appendix covering every asset to the end of its life.

## 5f · Credit sales & debtors (money owed to you)

When a customer takes work and pays later, choose **Credit (Unpaid)** as the payment method. The sale still counts as revenue — but the cash does not appear until it arrives, and the balance sits in **receivables** on the balance sheet.

**Recording the money when it comes:**
1. **Sales & Revenue** — unpaid rows show **owed GH₵…** under the payment tag and a gold **Receive** button.
2. Tap **Receive** → the amount (pre-filled with the full balance), the method and the date → **Record payment**.
3. Part payments are fine. Cash goes up, the debt goes down, and the whole thing is logged in the Activity Trail.

**Watching it:** **Statements & Reports → Debtors (owed to you)** shows every unpaid invoice, who owes it, how old it is, and the ageing buckets. Over 90 days is where money starts dying — chase it. The Dashboard KPI **Owed to you** shows the total at a glance.

**Never going to be paid?** The administrator can write it off (logged as a bad debt) so the books stop flattering you.

## 5g · Owner's drawings

Record money you take out for personal use by choosing **Drawings (owner withdrawal)** on the expense form. The app stores it as a capital transaction: it shows in the expense register with a gold **CAPITAL** tag, appears on the balance sheet and trial balance, and is **never counted as an expense** — so profit stays true.

## 6 · Install on a phone

**Android (Chrome):** open the site → ⋮ → *Install app*.
**iPhone / iPad (Safari):** Share → *Add to Home Screen* → *Add*.

Installed, the app launches full-screen with the gold Q icon and works with **no network at all** — the service worker keeps the whole app cached, and data is written to the device instantly.

## 7 · One live database across every phone (recommended)

Out of the box each phone keeps its own books. Connect a shared cloud database once and **every device sees the same live numbers within about ten seconds** — while still working with no network.

### Set it up once (about 4 minutes)

1. **Create a free project** at <https://supabase.com> → *New project*. Name it `quarshs-press`, choose the free plan, pick the closest region, set a database password.
2. **Create the tables.** In the project, open **SQL Editor → New query**, then copy the contents of `supabase/schema.sql` (or tap *Copy database setup script* inside the app) and press **Run**. This creates the tables and locks them down so only approved staff can read or write.
3. **Switch off email confirmation.** *Authentication → Providers → Email* → turn **Confirm email** off, then save. Staff sign in with a mobile number, so no inbox is needed.
4. **Connect the app.** *Settings → Live cloud sync*: paste the **Project URL** and the **anon public key** (from *Settings → API*), enter your PIN, and tap **Connect & go live**. Your existing records upload automatically and this device becomes the master.

### Bake the key into the app (so staff never paste anything)

Edit **`js/cloud-config.js`** once — paste your publishable key between the quotes — and commit. Vercel redeploys in about a minute, and from then on:

- Every phone that opens the app **connects to the shop database automatically**.
- The landing page shows only **Sign In** and **Request Access** — no URL box, no key box, nothing to copy from WhatsApp.
- A phone that later loses its settings can be re-attached with **Settings → Live cloud sync → Reconnect to the shop database**.

The publishable key is public by design; row-level security still restricts every read and write to approved, signed-in staff. **Never** put the secret key (`sb_secret_…`) in that file.

### Adding the other phones

On each staff phone: open the app (already connected) → **Request Access** → name, mobile, PIN, account type → the administrator approves in **Staff & Logins**. That phone is then live, showing the same books.

### How it behaves

| Situation | What happens |
|---|---|
| Shop has data | Records upload within seconds; other devices pull them |
| Signal drops | App keeps working; changes queue in an outbox and upload on reconnect |
| Two staff sell at once | Both entries are kept — nothing is overwritten |
| An entry is edited or deleted | The change syncs everywhere and is written to the Activity Trail |
| A login is approved or suspended | Takes effect on every device |
| Cloud unreachable | A small banner appears; nothing is lost, retry continues automatically |

Each device also keeps its own daily snapshot (**Settings → Backup & restore**), and you can still export a `.json` backup at any time.

> **Prefer standalone?** Skip step 1–4. The app works exactly as before on a single device — set up everything locally and use file backups to move data.

### Security notes

- PINs are stored as **PBKDF2-SHA256 hashes with a random salt** (120,000 rounds) — never in plain text, locally or in the cloud.
- Cloud sign-in uses Supabase Auth; the app maps `username → username@staff.quarshspress.app` internally, so staff only ever type a mobile number or username and a PIN.
- Row-level security means **only approved (active) profiles** can read or write records. Pending, suspended and revoked logins get nothing.
- Staff can be restricted from viewing other devices’ data in the dashboard if you wish — ask and I can tighten policies further (e.g. per-branch or per-device scoping).

## 8 · Deploy to Vercel & GitHub

Full beginner walkthrough with screenshots-in-words: **`DEPLOY-GUIDE.md`** (GitHub → Vercel → Supabase → phones → PIN reset function).
This folder is a static site — no build step.

**Option A — the way this shop is actually deployed (recommended)**
1. Upload the contents of this folder to the GitHub repository `samuelquarshie184-sketch/quarshs-press` (branch `main`).
2. On <https://vercel.com>, import that repository once (Framework preset **Other**, no build step).
3. Every commit now redeploys automatically. The live address is **https://quarshs-printing-hub.vercel.app**.

**Option B — CLI**
```bash
npm i -g vercel
cd quarshs-app
vercel --prod
```

Then open **https://quarshs-printing-hub.vercel.app** on your phone and install it. PWA install prompts require HTTPS — Vercel provides that automatically.

## 9 · Notes on the accounting model

- Revenue is recognised when the job is recorded; **Credit (Unpaid)** sales count as revenue and sit under *Trade receivables*.
- **Cash position** = collections (Cash / MoMo / Bank) − expenses + capital injections − drawings.
- **Cost of materials** per job is optional; fill it in for a true gross profit and margin.
- **Inventory** is valued at weighted unit cost from the stock module; it is carried in the *Materials & timing reserve* so assets and equity reconcile exactly.
- The balance sheet prints a **✓ BALANCED** check on every run.

## 10 · File map

```
index.html                 landing page + app shell
css/app.css                cinematic navy/gold design system
js/app.js                  auth, router, shell, PWA wiring
js/db.js                   local-first data store, accounting engine, change tracking
js/cloud.js                shared-database client (auth, outbox push, cursor pull, live loop)
js/cloud-config.js         the shop's database URL + publishable key (fill in once → every phone auto-connects)
supabase/schema.sql        one-time database setup: tables, triggers, row-level security
supabase/functions/admin-reset-pin/
                           Edge Function: administrator PIN resets that work on every phone
DEPLOY-GUIDE.md            beginner step-by-step: GitHub, Vercel, Supabase, phones, PIN reset
REVENUE-EXPENSE-LINES.md   chart of accounts: 21 revenue + 16 expense lines, price guide, worked example
STAFF-QUICK-GUIDE.pdf      one-page printable guide for the shop counter
js/util.js                 money, dates, periods, CSV, charts, modals
js/statements.js           statement builders (HTML + CSV)
js/views/*.js              dashboard, sales, expenses, stock, assets, reports, staff, audit, settings
sw.js                      offline service worker (25 files cached)
manifest.webmanifest       installable app metadata
icons/                     app icon + logo (gold Q in the multicolour ring): icon-192/512, maskable, apple-touch, logo-192
vercel.json                static hosting config
```

---

## Changelog

- **v1.10.0** — **Live charts on every period, and a camera/CCTV module the administrator controls.** **(1) Charts:** the dashboard's Revenue vs Expenses chart follows the Today / This week / This month switch (hour by hour, last 7 days, day by day), always showing revenue **and** expenses, with a new **Where the money goes** card that ranks expenses by line for the same period, and **Today so far** now shows money in *and* out per hour. **(2) Camera:** a new *Camera & CCTV* page with a master switch, per-officer switches, sound, clip length, still interval, retention and a device storage cap — all writable **only by the administrator**; the engine throws if a staff account tries, so hiding buttons is not the protection. On an officer's device the camera starts by itself after sign-in when allowed, records rolling clips (default 20 s) saved in IndexedDB on that device, takes a still every 30 s, keeps the screen awake with a wake lock, restarts itself if the track dies, prunes by age and size, logs every on/off to the camera feed and the audit trail, and shows the officer a permanent **REC** badge. Clips carry the officer, the start and end time, the screen they were on and a SHA-256 fingerprint of the file. **(3) Staff Monitor:** the administrator's portal shows every officer's last still with the time it arrived, the screen they are on right now, their camera state, a per-officer switch, and the recording register. Stills travel through the existing cloud sync (`camPresence`), so **no extra server or port is needed** — but the one-time SQL in `supabase/cctv-migration.sql` must be run to allow the three new table names. **(4) Honest limits:** a browser can only use a camera while the app is open and on screen; locking the phone or closing the app stops it (an OS rule, not a setting). Video stays on the officer's device unless clip upload is switched on, which keeps the free Supabase plan safe. For a true 24/7 picture, a dedicated CCTV unit is still required.
- **v1.10.0 storage headroom (same version)** — The automatic snapshots used to keep **six full copies of the books** in the same 5 MB a browser allows this site, so a busy shop would have run out of device storage in weeks (measured: 1,626 characters per sale, 1,338 per expense, ~5.2 M characters available). Snapshot **data now lives in IndexedDB** (gigabytes) and only a tiny index stays in `qp_backups_v1` — 95 characters instead of ~680,000 with the practice books — which multiplies usable device life about seven times. Restoring a snapshot still works and now reads the copy from IndexedDB (older inline snapshots still restore). Settings → Backup & restore gained a **Device storage** meter (MB used, percentage, and a plain-language warning at 70% and 85%). No storage key, cloud identity or version number changed.
- **v1.10.0 laptop and desktop install (same version)** — Settings → Offline & installation now explains installing as an app on **Windows or Linux (Chrome/Edge)** and **Mac (Chrome, or Safari 17+ Add to Dock)**, alongside the Android and iPhone steps, and notes that Firefox cannot install web apps. Chrome reports the site as installable, and the layout was re-checked at 1024, 1366 and 1920 px with no sideways overflow.
- **v1.10.0 camera fixes (same version)** — Testing the live voice (sound) recording found four camera faults, all fixed. **(1) A recorded clip could never be played.** The IndexedDB helper resolved with the raw request object instead of the stored video, so "Play" threw and no clip opened — it now returns the real file, and a clip is checked for a playable picture and a real length. **(2) The recording register stayed empty** while clips were being saved, because the table was drawn once when the page opened; it now repaints itself the moment a clip closes, without interrupting the camera, and the "This device" counters (clips, today, space used, last clip) update with it. **(3) If the administrator switched sound on but a phone refused the microphone, the camera gave up entirely** — it now records picture only, logs *"Microphone blocked on this device"* to the camera feed, and says so on the officer's screen instead of failing silently. **(4) The officer could not tell whether sound was being recorded** — the REC badge now reads *camera + sound* (or *microphone blocked*), the "Sound" row reports what is actually happening on that phone, and every clip in the register is marked **voice** or **silent**. Proven on a real recording: with sound on the saved file carries an Opus audio track inside the same webm as the picture; with sound off the file has no audio track at all. Sound remains administrator-only and off by default.
- **v1.10.0 cross-check (layout fixes, same version)** — A full end-to-end audit of every screen at phone (390 px) and desktop (1440 px) width found three layout faults, all now fixed and re-verified: **(1) Expenses and Stock pushed the whole page sideways on a phone** because a wide table inside a grid card would not shrink — tables now scroll inside their own card (`.table-wrap`), and grid children are allowed to shrink (`min-width:0`). **(2) Settings overflowed by 180 px** because a long drop-down option was forcing a form column to 483 px — form grids now use `minmax(0,1fr)` and controls are capped at the column width. **(3) The “Revenue & expenditure lines” card stayed two-column on phones** because of a duplicated `class` attribute that stopped its responsive class from ever applying. No storage key, cloud identity, database structure, file count or version number changed.
- **v1.9.1 / v1.10.0 (live charts, part 1)** — **Live dashboard charts.** The dashboard no longer draws once and goes stale. The Revenue vs Expenses chart now shows **both** bars (revenue in gold, expenses in grey) for the last seven days, with a second row of two more live charts: **Money in by method** (a donut for Cash, MoMo, Bank Transfer and Credit, with the legend recalculated) and **Today so far** (takings hour by hour, with the amount taken, the number of sales and the last entry). Every one of them repaints itself the moment an entry is saved on this phone (`qp:saved`), the moment a staff phone's entry arrives over the cloud (`qp:synced`), when the phone wakes up, and on a 20-second sweep — the bars and the donut ring animate to the new values instead of blinking, each card carries a **LIVE** badge with “updated 3s ago”, and a gold flash marks the card that changed. The charts are torn down cleanly on every route change (`qp:unmount`) so no timers are left running. No storage keys, cloud identity or database structure changed.
- **v1.9.0** — **Materials costed straight from stock, closed books, and the Ghana tax register — plus a receipt worth handing over.** **(1) Stock-costed jobs:** a sale can now take paper, toner or any other stock item straight off the shelf. The quantity leaves Stock & Materials, the cost of those materials becomes the cost of that job, and gross profit is right without a second entry. Editing a job puts the old materials back before taking the new ones; deleting a job returns them; asking for more than is on the shelf is refused with the balance. **(2) Year-end lock:** the administrator sets **Books closed up to** in Settings (or one tap on *Close the books on 31 December*). Nothing dated on or before that day can then be added, edited or deleted — sales, expenses, drawings, supplier bills, payments or cash-ups — and only the administrator can re-open, which is logged. **(3) Ghana tax register:** a printable month-by-month working paper with the VAT position, NHIL 2.5%, GETFund 2.5%, COVID-19 levy 1%, VAT at 15%, input VAT credited, VAT credit carried forward, the income-tax estimate at the company rate, and the GRA TIN on the header — Standard VAT, VAT Flat Rate (3%) or not registered. **(4) The receipt:** redesigned as a proper till receipt — navy and gold crown with the emblem, an OFFICIAL RECEIPT masthead, the job in words with the materials listed, the amount in gold, a rotated **PAID** stamp when it is settled, a perforated tear line, a bar strip and the two phone numbers — and every job now carries an **automatic receipt number** (`RCP-26-0001`) shown in the sales register beside its invoice number.
- **v1.8.0** — **Supplier bills (creditors) and the close-of-day cash-up.** Two of the biggest gaps in the books are closed. **(1) Creditors:** record a bill the moment paper, toner or a service arrives — the supplier is added automatically, the cost hits profit in the month the bill is dated, and the amount owed sits under **Trade payables** on the balance sheet, in the trial balance (Dr *Purchases on credit* / Cr *Trade payables*) and in the cash-flow statement. Part-payments, due dates, ageing (not yet due / 1–30 / 31–60 / over 60 days late), supplier statements and a printable **Suppliers & Creditors — Amounts Payable** report with your own signature block. **(2) Close of day:** pick the day, type the opening float, the app pulls money in and money out for **Cash / MoMo / Bank Transfer** straight from the books, you type what you actually counted, and it shows the difference per method and in total. A note is required if the till does not balance, the Z-report prints with *Counted by* and *Approved by* lines, staff can close the day but only the administrator can **approve** it, and every closing is kept in a list you can re-open. The dashboard **Position** card now carries **Owed to suppliers** (with the count of unpaid bills), and the P&L and Statement of Financial Performance carry the credit-purchase line so the profit is fully explained.
- **v1.7.7** — **The gold Q logo now prints on sales receipts**, centred above the shop name, followed by the tagline, the location and both phone numbers — the same emblem used on screens and statements.
- **v1.7.6** — **Sales receipts keep the shop's contact details** (location, 0558103988 · 0534221632 and "No refund after printing · Closed Sundays"), while statements, the Settings panel and the staff guide stay clean. The **Install App** button now lives only on the landing page — the dashboard top bar shows just the clock and **+ New Sale**. Installing is still one tap from the landing page, and Settings still offers an *Install app* shortcut.
- **v1.7.5** — **Contact line removed from the app and the statements.** Printed statements, the sales receipt, the Settings *About* panel and the staff guide now show only the logo, the shop name, the tagline and **Ho, Barracks Newtown — Zoomlion Junction**. The phone numbers and the "Mon–Sat 7:30AM – 8:00PM · Closed Sundays" line are gone from all of them. The two telephone numbers remain **only on the landing page** footer, as asked.
- **v1.7.4** — **Fixed Assets is now administrator-only.** Staff accounts no longer see the tab in the menu, cannot open it by typing the address, do not see the *Fixed Assets* statement in Statements & Reports, and cannot tick *"This is equipment the shop keeps"* when recording an expense. Staff keep Dashboard, Sales & Revenue, Expenses, Stock & Materials, Statements (everything except the asset register) and their own account. The administrator keeps the full register, schedule, disposal and printouts.
- **v1.7.1** — **New logo and new name: QUARSH'S PRINTING HUB.** The gold Q inside the multicolour ring is now the mark everywhere — app icon and home-screen icon (Android + iPhone), browser tab, landing page, sidebar, every printed statement header, the staff quick guide and the sales receipt. The business name changed from *Printing Press* to *Printing Hub* across the screens and the statements, and existing devices rename themselves automatically on the next open. No data, logins or URLs changed.
- **v1.7** — **Automatic depreciation.** You now enter only the **date bought**, the **cost** and the **useful life in years**; the app calculates every figure itself under **IAS 16** — the same standard the Institute of Chartered Accountants, Ghana applies. Two methods: **straight line** (ICA's recommendation for equipment, the default) and **reducing balance** (diminishing balance, for computers and GRA percentage allowances). Live calculation inside the form, a year-by-year schedule on every asset, a **Method** column in the register and register print-out, category defaults for life and GRA rate, and depreciation that stops exactly at the scrap value or end of life. Old assets created in earlier versions keep working — they are read as straight line.
- **v1.6** — **Statement of Financial Performance** (the formal income-and-expenditure statement) with previous-period comparison, change, change % and % of income, gross/net margins and break-even income · **Statement of Changes in Equity** that ties to the balance sheet · **Debtors report** with ageing, part-payments, **Receive** button on every unpaid sale, bad-debt write-off, and receivables that only count what has actually been paid · Dashboard now shows **Owed to you** · Fixed Assets and Debtors available inside Statements & Reports.
- **v1.5** — **Fixed Assets** register: equipment is capitalised and depreciated straight-line (monthly), with net book value, disposal, a printable asset register, and automatic postings to the P&L, balance sheet, trial balance and cash flow · "Equipment Purchase" expenses can be capitalised from the form (**→ Asset**) · the app now flushes unsaved writes when the phone is closed or backgrounded, so the very last entry can never be lost.
- **v1.4** — Photocopy (single / front-and-back, colour and black & white), typing only, typing & printing, book design only, book design & printing (colour and B/W), banner design and banner design & printing added as revenue lines · **Drawings (owner withdrawal)** added as a capital line inside the expense register · revenue and expenditure lines are now **fully editable** (add ✎ rename / reprice ✕ remove) and can be created **while recording** a sale or expense · the shop's database URL and key now live in `js/cloud-config.js`, so a freshly installed phone shows only **Sign In / Request Access** and connects itself · editable-line catalogue syncs to every phone.
- **v1.3** — PIN reset requests, staff/administrator choice at sign-up, gold Q logo on screens and statements, trial balance, deployment guide.
- **v1.2** — cloud sync hardening, duplicate-profile folding, copy-script fallback.
- **v1.0** — first release: sales, expenses, stock, statements, staff oversight, offline PWA.

---

**Contacts on file:** 0558103988 · 0534221632 — Mon–Sat 7:30AM–8:00PM, closed Sundays.
