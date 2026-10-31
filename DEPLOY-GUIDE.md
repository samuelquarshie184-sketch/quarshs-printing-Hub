# Deploying Quarsh's Printing Hub — a beginner's step-by-step guide

You will do this in **four parts**. Nothing here needs a paid account, and no coding is required — just copying, pasting and clicking.

Total time: about **20 minutes** the first time.

| Part | What it does | Time |
|---|---|---|
| 1 | Put the app on GitHub (your safe copy) | 5 min |
| 2 | Put the app live on Vercel (your web address) | 5 min |
| 3 | Create the shared database on Supabase | 5 min |
| 4 | Connect the app to the database and install it on phones | 5 min |
| 5 | *(Optional)* Turn on PIN reset for every phone | 5 min |

---

## Before you start, you need

- An **email address** you can open on your phone.
- This **`quarshs-app` folder** — the one you are looking at. It contains `index.html`, `css`, `js`, `icons`, `supabase`, `sw.js`, `manifest.webmanifest`, `vercel.json`.
- About 20 minutes.

> **Important:** don't rename the files or move them out of their folders. The app relies on these names.

---

# PART 1 — Put the app on GitHub

GitHub is a free online cupboard for your project. Vercel (Part 2) reads from it, and it keeps a history of every change so you can go back.

### 1.1 Create your GitHub account
1. Open **https://github.com/signup**
2. Enter your email, a password, and a username (e.g. `quarshs-printing`).
3. Solve the puzzle, then enter the code they email you.
4. On "What kind of work do you do?" pick **Student** or **Personal**, skip the extra questions.

### 1.2 Create the repository (your project cupboard)
1. On github.com, click the **+** at the top right → **New repository**.
2. **Repository name:** `quarshs-press`
3. Choose **Private** (only you can see it) or Public — either works on Vercel's free plan.
4. Leave everything else alone (no README, no .gitignore).
5. Click **Create repository**.

### 1.3 Upload your files (no coding tools needed)
1. On the new page you will see **"uploading an existing file"** — click that link.
   *(If you don't see it, click **Add file → Upload files**.)*
2. Open your `quarshs-app` folder on the computer.
3. **Select everything inside it** and drag it into the browser window.
   - You should see the folders `css`, `icons`, `js`, `screenshots`, `supabase` and the files `index.html`, `README.md`, `sw.js`, `manifest.webmanifest`, `vercel.json`.
   - ⚠️ Do **not** drag the `quarshs-app` folder itself — drag what is *inside* it. `index.html` must sit at the top level.
4. Wait for all files to finish uploading (a little bar shows progress).
5. In the box at the bottom type: `First upload of Quarsh's Printing Hub app`
6. Click **Commit changes**.

**Check:** your repository page should now show `index.html` in the file list. If instead you see a single folder called `quarshs-app`, click it, then drag its contents again.

---

# PART 2 — Put it live on Vercel

Vercel gives you a free web address like `quarshs-press.vercel.app` with HTTPS (the padlock), which is required for installing the app on phones.

### 2.1 Sign up
1. Open **https://vercel.com/signup**
2. Choose **Continue with GitHub** (easiest — it connects the two accounts).
3. Click **Authorize** when GitHub asks. You may be asked to verify your email.

### 2.2 Import your project
1. On the Vercel dashboard click **Add New… → Project**.
2. Under *Import Git Repository*, find `quarshs-press` and click **Import**.
   - If you don't see it, click **Adjust GitHub App Permissions** → choose the repository → **Install/Save**.

### 2.3 Deploy (the settings matter — read this bit)
On the configuration screen:

| Setting | What to choose | Why |
|---|---|---|
| **Framework Preset** | **Other** | It is a plain website, not React/Next.js |
| **Root Directory** | leave as `./` | `index.html` is already at the top |
| **Build Command** | leave **empty** | there is nothing to build |
| **Output Directory** | leave **empty** | the files are used as they are |
| **Environment Variables** | none | all settings live inside the app |

Click **Deploy**. Wait about 30 seconds. You will see confetti and a **Visit** button.

### 2.4 Get your address
- Your site is at `https://<project-name>.vercel.app`. Click **Visit** to confirm the landing page appears.
- **Rename it:** Project → **Settings → Domains** → edit the `.vercel.app` name to something like `quarshs-press` → **Save**.

### 2.5 Updating the site later
Any time you change a file:
1. GitHub → open the file → pencil icon ✏️ → edit → **Commit changes**.
2. Vercel rebuilds automatically in ~20 seconds. Refresh your site.

**Upgrading a whole new version (like v1.9):**

1. Go to your repository on GitHub, click **Add file → Upload files**.
2. Open your new `quarshs-app` folder on your computer and drag **the folders and files inside it** into the browser window — `js`, `css`, `index.html`, `sw.js`, `README.md`, the guides, and so on. Drop the **contents**, not the folder itself.
3. GitHub asks *"You are uploading 30+ files"* → scroll down → **Commit changes**.
4. Vercel rebuilds by itself. The word **Ready** appears next to the deployment in about 20 seconds.
5. On your own phone/computer: open the site, then **pull down to refresh twice** (or close it and open it again). The first refresh fetches the new files, the second one switches the app over. The version number is at **Settings & Backup → About this suite** — it must say **v1.9.0**.

> **Your data is not touched by an upgrade.** Sales, expenses, assets and staff records live in the browser/Supabase, not in the files you upload. v1.9 needs **no database change** — do not re-run `schema.sql`.

> If you ever see a **404** after adding a new folder, check that `index.html` is still at the root of the repository.

---

# PART 3 — Create the shared database (Supabase)

This is what lets every phone see the same sales and expenses.

### 3.1 Create the project
1. Open **https://supabase.com** → **Start your project** → sign in with GitHub or email.
2. Click **New project**:
   - **Name:** `quarshs-press`
   - **Database Password:** click *Generate a password* and **save it somewhere safe** (you will rarely need it, but keep it).
   - **Region:** choose the closest to Ghana — **West EU (Ireland)** or **EU Central** works well.
   - **Plan:** Free.
3. Click **Create new project** and wait 1–2 minutes for it to finish setting up.

### 3.2 Create the tables
1. In the left menu open **SQL Editor** → **New query**.
2. In the app (or from the file `supabase/schema.sql`), copy the **whole** setup script:
   - Easiest way: open the app → **Settings → Live cloud sync** → **Copy database setup script**. If the copy button shows a text box instead, select all the text and copy it.
3. Paste into the Supabase editor.
4. Click **Run** (or press Ctrl/⌘ + Enter).
5. You should see **"Success. No rows returned"**. If you see a red error, copy the message and check that you pasted the *entire* script from the first line.

### 3.3 Switch off email confirmation
Staff sign in with a mobile number, so no confirmation email is needed.

1. Left menu → **Authentication** → **Providers** (or **Sign In / Providers**).
2. Click **Email**.
3. Turn **Confirm email** to **OFF**.
4. Click **Save**.

### 3.4 Copy your two keys
1. Left menu → **Settings** (gear) → **API**.
2. Copy and keep these two values:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **anon public** key — a long line starting with `eyJ...`

> 🔐 The **anon** key is designed to be public — it is safe inside the app. Never copy the `service_role` key into the app or send it to anyone.

---

# PART 4 — Connect the app and install it on phones

### 4.0 — Put your key into the app ONCE (so nobody has to type it, ever)
This is the step that makes staff phones painless: the URL and key live **inside the app**, so every phone that installs it is connected automatically and only ever shows **Sign In** and **Request Access**.

1. Go to **github.com** → open your repository → open the **`js`** folder → tap **`cloud-config.js`**.
2. Tap the **pencil** (✏️ Edit) icon at the top right of the file.
3. You will see two lines like this near the bottom:

   ```js
   url: 'https://qlwtvyqfzrghcuqapwnu.supabase.co',
   key: '',                 // ← paste the publishable key here
   ```

4. Put your **publishable** key between the quotes on the `key:` line — so it reads `key: 'sb_publishable_xxxxxxxx',`. Copy it from Supabase → **Project Settings → API Keys → Publishable key** (the 📋 icon).
   - Keep the `https://` URL exactly as it is.
   - **Never** paste the *secret* key (`sb_secret_…`) — that one must stay private.
5. Scroll down → **Commit changes** → **Commit changes** again (leave “Commit directly to the `main` branch”).
6. Go to **vercel.com** → your project → **Deployments**. Wait ~1 minute until the newest deployment says **Ready**.

> The publishable key is designed to be public — it is safe inside a website. Your books are protected by the database rules from Part 3 and by PIN logins.

### 4.1 Connect your own phone / computer first (the master device)
1. Open your Vercel address.
2. Create the administrator account: your name, a username (max 15 letters), your mobile (`0558103988`) and a 4–6 digit PIN.
3. Go to **Settings → Live cloud sync**.
4. Paste the **Project URL**, the **anon public** key, and your **PIN** → **Connect & go live**.
5. The badge turns green: **"Live · all devices in sync"**. Everything you already recorded is uploaded.

### 4.2 Add each staff phone — no keys needed
1. Open the same web address on their phone. (Do 4.0 first — the app must already know your database.)
2. They see **Sign In** and **Request Access** only. Nothing to copy, nothing to paste.
3. Tap **Request Access**: their name, username, mobile, PIN, and **Account type → Staff** (or **Administrator** if you want them to have full oversight).
4. You (the administrator) open **Staff & Logins** — their request appears with a gold **"requested admin"** note if they asked for admin rights.
5. Tap **Approve**. They can now sign in, and their phone shows the same live books.

> Staff capacity is 10 logins; you can suspend a login at any time to free a slot.

### 4.3 Install it like a real app
**Android (Chrome):** open the site → tap the **⋮** menu → **Install app** → **Install**. The gold **Q** icon appears on the home screen and the app opens full-screen.

**iPhone / iPad (Safari):** open the site in **Safari** → tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.

Once installed it works **with no internet**: entries save on the phone and upload automatically when the signal comes back.

### 4.4 Your weekly routine (2 minutes)
- Every Friday: **Settings → Backup & restore → Export backup file** and keep the file in Google Drive or WhatsApp it to yourself.
- Check **Staff & Logins** for any **PIN reset requests**.
- Print the week's statements: **Statements & Reports → period → This week → Print / Save as PDF**.

---

# PART 5 — *(Optional)* PIN reset on every phone

Without this, an administrator's PIN reset works on the device they are using; with it, the new PIN works on **every** phone. Do this once, using the Supabase command line.

### 5.1 Install the Supabase CLI on your computer
- **Windows:** open PowerShell and run `npm install -g supabase` (install Node.js from nodejs.org first if needed).
- **Mac:** `brew install supabase/tap/supabase`

### 5.2 Log in and link the project
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```
`YOUR-PROJECT-REF` is the short code inside your Project URL (`https://abcdefghijk.supabase.co` → `abcdefghijk`).

### 5.3 Deploy the reset function
From inside the `quarshs-app` folder (the one containing `supabase/`):
```bash
supabase functions deploy admin-reset-pin
```
You should see **"Deployed Functions … admin-reset-pin"**.

The function automatically uses the project's built-in secret key — you do not paste any keys.

### 5.4 Test it
1. In the app go to **Staff & Logins**.
2. Tap **PIN** (or **Set temporary PIN** on a reset request).
3. Leave **"Also update the shared database"** ticked → **Set new PIN**.
4. You should see: *"PIN changed here and in the shared database"*.

If you see *"the cloud password was not updated"*, the function is not deployed yet — repeat 5.2–5.3, then try again.

---

# PART 6 — Fixed assets (equipment you keep)

Paper and toner go in **Stock & Materials**. The machines go in **Fixed Assets**.

> **Administrator only.** Staff accounts cannot see *Fixed Assets* — not in the menu, not in Statements & Reports, and they cannot capitalise an expense into it. Sign in as the administrator to do any of this.

1. **Administration → Fixed Assets → + Add asset**
2. Fill in: what it is, **category** (this sets the default life and rate), **date bought**, **cost**, **useful life in years**, and the **depreciation method**:
   - **Straight line (ICA recommended for equipment)** — the same charge every month. Leave this as it is for presses, copiers, laminators, binding machines and furniture.
   - **Reducing balance** — choose this for computers and cameras. A rate box appears, already filled with the GRA rate for the category (40% for computers, 30% for machines, 20% for furniture). Change it only if your accountant tells you to.
3. **You never work out the depreciation yourself.** As you type, the gold box at the top shows the cost and, on the right, the monthly charge, the life in months and the first year's charge. The panel underneath shows the whole year-by-year schedule (opening value → charge → closing value) before you save.
4. Save. From then on every month's profit carries that month's share automatically, and the balance sheet shows what the equipment is still worth. Any row's **Schedule** button shows the full life of that machine.

**Already recorded the purchase as an expense?** Open the expense list → tap **→ Asset** on that row. Or, next time, record it as *Equipment Purchase* and tick the gold box **"This is equipment the shop keeps"**.

**To print the register** (for the bank or an auditor): **Fixed Assets → Print register → Save as PDF**.

---

# PART 7 — Getting paid: credit sales, payment and follow-up

**When a customer collects now and pays later:**
1. **+ New Sale** → fill the job → set **Payment method → Credit (Unpaid)** → **Save sale**.
2. When they bring the money: **Sales & Revenue** → the row shows **owed GH₵…** and a gold **Receive** button → tap it → the amount is pre-filled → **Record payment**. Part payments are welcome.
3. Watch the book: **Statements & Reports → Debtors (owed to you)** lists every unpaid invoice with how many days old it is. The Dashboard's **Owed to you** card shows the total.

**Never paid?** Open Debtors — the administrator can write it off as a bad debt so the accounts tell the truth.

---

# PART 8 — Editing the line catalogue later

Revenue and expenditure lines are yours to change — no code, no redeploy:

- **Settings & Backup → Revenue & expenditure lines**
  - **+ Add revenue line** → name, icon, unit, default price. It appears on the sales form, in every statement and on all approved phones.
  - **✎** renames a line or changes its default price.
  - **✕** removes a line. Past sales and expenses keep their name and amount, so old statements never change.
  - **+ Add expenditure line** adds a new cost line (e.g. *Machine lease*).
- **While recording a sale or expense:** choose **➕ Add a new revenue line… / ➕ Add a new expenditure line…** and type the name — the line is created *and* the entry is saved in one step.

**Owner's drawings:** choose **Drawings (owner withdrawal)** on the expense form. The app files it under capital, shows it in the register with a gold **CAPITAL** tag, and keeps it out of profit — exactly how a real set of accounts does it.

---

# Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| Vercel shows **404: NOT_FOUND** | `index.html` is not at the top of the repository | Re-upload the *contents* of the folder, not the folder |
| Page loads but looks unstyled | The `css` folder did not upload | Upload the `css` folder, commit, wait 20 s |
| **"Could not reach the cloud database"** | Wrong URL or key | Re-copy from Supabase → Settings → API; make sure there is no space at the end |
| **"Cloud still requires email confirmation"** | Step 3.3 skipped | Turn *Confirm email* off in Authentication → Providers → Email |
| Staff sees **"awaiting administrator approval"** | Normal — you have not approved them yet | Staff & Logins → Approve |
| **"profile not active"** banner | Their approval has not synced yet | Tap **Sync now** in Settings, or wait 10 seconds |
| Phone shows the old version after an update | The offline cache is serving old files | Close the app fully and reopen, or Settings → Sync now |
| I forgot my administrator PIN | — | On the sign-in screen tap **Forgot PIN?** — but if you are the only administrator, sign in on a device where you are still logged in and use **Settings → Change my PIN** |

---

# The everyday map (what lives where)

| I want to… | Go to |
|---|---|
| Record a job | **Sales & Revenue → + Record sale** (or the **+ New Sale** button, top right) |
| Record a cost | **Expenses → + Record expense** |
| Receive A-sheets / issue toner | **Stock & Materials → + In / − Out** |
| Give a customer a receipt | **Sales & Revenue → Receipt** |
| Print the day's takings | **Statements & Reports → Daily Statement → Print / Save as PDF** |
| See profit | **Statements & Reports → Profit & Loss** |
| Check the books balance | **Statements & Reports → Trial Balance** |
| Approve a new login | **Staff & Logins → Approve** |
| Help someone who forgot their PIN | **Staff & Logins → PIN reset requests → Set temporary PIN** |
| See who did what and when | **Activity Trail** |
| Back up | **Settings → Export backup file** |

---

**Contacts on file:** 0558103988 · 0534221632 — Mon–Sat 7:30 AM–8:00 PM, closed Sundays.
