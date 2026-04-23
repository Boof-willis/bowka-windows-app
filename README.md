# Bowka Ops

Internal operations + P&L app for **Bowka Windows**. Tracks leads → quotes → jobs, ingests manufacturer invoices via AI, and rolls up cost averages at a per-tag granularity (nail fin, tempered, obscured, grid, etc.).

Stack: Next.js 15 (App Router) + Tailwind + Supabase (Postgres / Auth / Storage) + Anthropic Claude for invoice extraction. Deploys to Cloudflare Pages via `@opennextjs/cloudflare`.

---

## Local setup

```bash
cd bowka-ops
npm install
cp .env.local.example .env.local
# fill in Supabase + Anthropic keys
npm run dev
```

### Supabase

1. Create a project at supabase.com.
2. In the SQL editor run these in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed.sql`
3. Auth → Users → Invite yourself. After signing in, promote yourself to admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'j.spenceroberts@gmail.com';
   ```
4. Invite Brady and set `role = 'installer'`.

See `supabase/README.md` for more detail.

### Anthropic

Invoice + loan-sheet extraction uses `claude-opus-4-7` via the Anthropic SDK. Put your key in `ANTHROPIC_API_KEY`.

---

## Roles

- **admin** — full access to every page, including P&L, cost data, settings.
- **sales_rep** — create/manage their own leads and quotes. Can't see cost data.
- **installer** — sees only jobs they're assigned to. Can upload before/after photos, log dump trips, flag consumable anomalies.

Role enforcement is double-layered: Postgres RLS policies AND `requireRole(...)` in page server components.

---

## Core workflows

### Sales → job

1. Sales rep creates a **lead** (`/leads/new`).
2. From the lead page, clicks **Build quote** → redirected to the quote builder.
3. Adds window line items with all specs (type, fin, size, glass, tempered/obscured/grid/tint, operation, quoted price).
4. Fills install details (substrate, existing frame material, notes) and payment (cash/finance + plan selection).
5. Exports **order form PDF** (`/api/quotes/:id/order-form`) to email to the manufacturer.
6. Marks quote sent, then **accepts** → a `job` record is auto-created via DB trigger and the lead flips to `won`.

### Job lifecycle

1. Admin uploads the **manufacturer invoice PDF** on the job page. A Claude pipeline extracts:
   - invoice number, date, manufacturer name, invoice total
   - each line item with specs + per-unit cost
2. If the invoice has per-line costs, they populate `windows.actual_cost_cents` by position match.
3. Installer logs **dump trips**, uploads **before/after photos**, and can flag consumable overrides when something unusual happens.
4. Admin logs **labor payouts** (install, commission, etc.).
5. The **P&L card** on the job page computes:
   ```
   contract total
   − merchant fee (based on selected loan plan)
   = net revenue
   − material cost (actual from invoice, falls back to quoted)
   − consumables (allocated per-window rates + any overrides)
   − labor payouts + labor burden (WC + FICA + FUTA + UT SUI)
   − dump fees (pro-rata by windows hauled)
   = gross profit + margin %
   ```

### Reports

`/reports` shows rolling averages across **every window with a recorded actual cost**, broken down:

- Overall (count, avg $/window, avg $/sqft)
- By window type
- By tag — Δ vs overall so you can immediately see "tempered windows cost 18% more on average," etc.

---

## Financing

Synchrony Tier 3 (1933 40MV) plans are seeded. To add another lender or replace a rate sheet:

1. Go to `/settings/loan-plans`.
2. Upload CSV (with columns `plan_code, promotional_offer, monthly_payment_factor, est_num_payments, merchant_fee`) or a PDF rate sheet.
3. Claude extracts plans and upserts them (conflict on `lender_id + plan_code`).

---

## Labor burden rates

Seeded with placeholders in `0003_seed.sql`:

| Item | Rate |
|---|---|
| Workers comp | 8.00% |
| FICA (employer) | 7.65% |
| FUTA | 0.60% |
| Utah SUI (new employer) | 1.20% |

⚠️ **Verify with your payroll provider and UT DWS rate notice before go-live.** Edit in `/settings/burden`.

---

## Consumables

Default per-window rates (editable in `/settings/consumables`):

| Item | Unit | Cost |
|---|---|---|
| Nails | window | $0.17 |
| Caulk | window | $1.50 |
| Foam | window | $2.00 |
| Sticky trim | window | $1.25 |
| Multitool blade | window | $0.50 |
| Cooler / drinks | job | $10.00 |

These are rough starting points — tune them after your first 5–10 installs.

---

## Deploy to Cloudflare Pages

```bash
npm run pages:build
npm run pages:deploy
```

Set env vars on the Cloudflare dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. `https://ops.bowkawindows.com`)

---

## Known limitations for v1

- **Commission engine is scaffold-only** — `pay_scales` tables exist, `redline_total_cents` is captured on quotes, but there's no automatic commission calculation yet.
- **Consumables use allocated rates** — no actual bucket-level inventory tracking. Override on a per-job basis when something unusual happens.
- **No mobile-native app** — installer UX is responsive web.
- **PDF invoice extraction accuracy** depends heavily on the manufacturer's format. First 5–10 invoices will need human review against the extracted data; report what's failing so prompts can be tuned.
- **No calendar / scheduling integration.**
- **No customer portal.**

These are all candidates for v2.
