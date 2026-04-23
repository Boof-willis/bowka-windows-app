-- Bowka Ops — initial schema
-- Lead → Quote → Job lifecycle with per-window line items, financing, consumables, labor, dump fees.

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'sales_rep', 'installer');

create type lead_status as enum ('new', 'contacted', 'measured', 'quoted', 'won', 'lost');
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type job_status as enum (
  'pending_order',       -- quote accepted, waiting to place manufacturer order
  'ordered',             -- manufacturer order placed
  'in_production',
  'ready_to_install',
  'scheduled',
  'installed',
  'completed',
  'cancelled'
);

create type payment_method as enum ('cash', 'check', 'credit_card', 'ach', 'finance');
create type window_type as enum (
  'picture', 'single_hung', 'double_hung', 'single_slider',
  'double_slider', 'casement', 'awning', 'bay', 'bow', 'garden', 'custom'
);
create type fin_type as enum ('nail_fin', 'flush_fin', 'block_frame', 'retrofit');
create type operation_type as enum ('fixed', 'up', 'down', 'xo', 'ox', 'xox', 'oxo');
create type exterior_substrate as enum ('brick', 'siding', 'wood', 'stucco', 'foundation');

-- ============================================================
-- USERS / PROFILES
-- Supabase auth.users is extended by public.profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'sales_rep',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- LEADS
-- ============================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text,
  phone text,
  address_line1 text,
  city text,
  state text default 'UT',
  zip text,
  year_built int,
  source text, -- google_ads, meta, referral, d2d, etc.
  status lead_status not null default 'new',
  notes text,
  assigned_rep_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_assigned_rep_idx on public.leads(assigned_rep_id);
create index leads_status_idx on public.leads(status);

-- ============================================================
-- LOAN PLANS — imported from lender rate sheets (Synchrony first)
-- ============================================================
create table public.lenders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  activation_fee_cents int not null default 0, -- e.g. Synchrony $69
  min_monthly_volume_cents int not null default 0, -- e.g. Synchrony $4000
  min_volume_shortfall_fee_cents int not null default 0, -- e.g. Synchrony $40
  notes text,
  created_at timestamptz not null default now()
);

create table public.loan_plans (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.lenders(id) on delete cascade,
  plan_code text not null, -- e.g. '930', '933'
  promotional_offer text not null,
  monthly_payment_factor numeric(6,4), -- e.g. 0.0250 = 2.5%
  est_num_payments int,
  merchant_fee_bps int not null, -- basis points, e.g. 1360 = 13.60%
  category text, -- 'deferred_interest' | 'fixed_payment' | 'equal_monthly'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (lender_id, plan_code)
);

create index loan_plans_lender_idx on public.loan_plans(lender_id, active);

-- ============================================================
-- QUOTES
-- ============================================================
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  quote_number text unique, -- human-readable, e.g. Q-2026-0042
  status quote_status not null default 'draft',
  -- Pricing (snapshot)
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  -- Payment
  payment_method payment_method,
  loan_plan_id uuid references public.loan_plans(id) on delete set null,
  down_payment_cents int default 0,
  -- Install details
  exterior_substrate exterior_substrate,
  install_notes text,
  existing_frame_material text, -- aluminum, wood, vinyl, etc.
  -- Quote sales fields
  sales_rep_id uuid references public.profiles(id) on delete set null,
  redline_total_cents int, -- minimum acceptable price (for commission calc)
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_lead_idx on public.quotes(lead_id);
create index quotes_status_idx on public.quotes(status);

-- ============================================================
-- JOBS — created when a quote is accepted
-- ============================================================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  job_number text unique, -- human-readable
  status job_status not null default 'pending_order',
  -- Install
  assigned_installer_id uuid references public.profiles(id) on delete set null,
  scheduled_install_date date,
  measured_at timestamptz,
  installed_at timestamptz,
  completed_at timestamptz,
  -- Manufacturer order
  manufacturer_name text,
  manufacturer_order_number text,
  manufacturer_order_placed_at timestamptz,
  -- Costs (populated as data comes in)
  actual_material_cost_cents int default 0, -- sum of windows.actual_cost_cents
  actual_labor_payout_cents int default 0,
  actual_consumable_cost_cents int default 0,
  actual_dump_cost_cents int default 0,
  -- Notes
  install_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_status_idx on public.jobs(status);
create index jobs_installer_idx on public.jobs(assigned_installer_id);

-- ============================================================
-- WINDOWS — line items, belong to a quote; job inherits via quote
-- ============================================================
create table public.windows (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position int not null, -- 1-indexed row number on the order form
  location_label text not null, -- 'Front Room', 'Master Bath'
  window_type window_type not null,
  fin_type fin_type,
  -- Dimensions (store in inches)
  width_inches numeric(6,2) not null,
  height_inches numeric(6,2) not null,
  net_width_inches numeric(6,2),
  net_height_inches numeric(6,2),
  -- Specs
  color text, -- 'White', 'Bronze/LT', etc.
  glass_type text, -- 'LoE 366', 'LoE 270', etc.
  tempered boolean not null default false,
  obscured boolean not null default false,
  grid boolean not null default false,
  grid_pattern text,
  storms boolean not null default false,
  wraps boolean not null default false,
  tinted boolean not null default false,
  tint_color text,
  u_factor numeric(4,3),
  operation operation_type,
  -- Pricing
  quoted_price_cents int not null default 0,
  actual_cost_cents int, -- populated from manufacturer invoice
  -- Misc
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index windows_quote_idx on public.windows(quote_id);
create index windows_specs_idx on public.windows(window_type, fin_type, tempered, obscured, grid);

-- Computed column helper view for sqft
create view public.windows_with_sqft as
  select
    w.*,
    round((w.width_inches * w.height_inches / 144.0)::numeric, 2) as sqft
  from public.windows w;

-- ============================================================
-- MANUFACTURER INVOICES
-- ============================================================
create table public.manufacturer_invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  manufacturer_name text,
  invoice_number text,
  invoice_date date,
  total_cents int not null default 0,
  file_path text not null, -- Supabase storage key
  file_mime text,
  -- Extraction
  extraction_status text not null default 'pending', -- pending | processing | completed | failed
  extraction_raw jsonb, -- raw Claude response
  extracted_at timestamptz,
  extracted_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index manufacturer_invoices_job_idx on public.manufacturer_invoices(job_id);

-- ============================================================
-- JOB PHOTOS (before / after)
-- ============================================================
create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  file_path text not null, -- Supabase storage key
  phase text not null, -- 'before' | 'after' | 'during'
  caption text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index job_photos_job_idx on public.job_photos(job_id, phase);

-- ============================================================
-- CONSUMABLE RATES (global settings — allocated per window)
-- ============================================================
create table public.consumable_rates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'nails', 'caulk', 'foam', 'sticky_trim', 'multitool_blade', 'cooler_drinks'
  display_name text not null,
  cost_per_unit_cents int not null,
  unit text not null, -- 'window' or 'job'
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Per-job consumable overrides (when installer logs an anomaly)
create table public.job_consumables (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  consumable_key text not null,
  quantity numeric(8,2) not null default 1,
  total_cost_cents int not null,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index job_consumables_job_idx on public.job_consumables(job_id);

-- ============================================================
-- DUMP TRIPS
-- ============================================================
create table public.dump_trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null,
  fee_cents int not null,
  weight_tonnes numeric(6,2),
  windows_hauled int, -- approximate
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Many-to-many: a dump trip can span multiple jobs; a job can contribute to multiple trips
create table public.dump_trip_jobs (
  dump_trip_id uuid not null references public.dump_trips(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  windows_from_job int not null default 0, -- for pro-rata allocation
  primary key (dump_trip_id, job_id)
);

-- ============================================================
-- LABOR PAYOUTS
-- ============================================================
create table public.labor_payouts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  payee_id uuid references public.profiles(id) on delete set null,
  payout_cents int not null,
  payout_type text, -- 'install', 'sales_commission', 'measure', etc.
  paid_at date,
  notes text,
  created_at timestamptz not null default now()
);

create index labor_payouts_job_idx on public.labor_payouts(job_id);

-- ============================================================
-- LABOR BURDEN RATES (workers comp, payroll tax, etc.)
-- ============================================================
create table public.burden_rates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'workers_comp', 'utah_sui', 'fica_employer', 'futa'
  display_name text not null,
  rate_bps int not null, -- basis points, e.g. 800 = 8%
  applies_to text not null default 'w2_wages', -- 'w2_wages' | 'all_payouts'
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PAY SCALES (v2 commission engine — scaffold only)
-- ============================================================
create table public.pay_scales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role user_role not null default 'sales_rep',
  description text,
  -- Redline-with-cap:
  commission_rate_bps int, -- % of markup above redline
  commission_cap_cents int, -- max commission per job
  base_salary_cents int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_pay_scales (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pay_scale_id uuid not null references public.pay_scales(id) on delete restrict,
  effective_from date not null default current_date,
  effective_to date,
  primary key (user_id, pay_scale_id, effective_from)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','leads','quotes','jobs','windows','consumable_rates','burden_rates'])
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at();', t);
  end loop;
end $$;

-- ============================================================
-- AUTO-CREATE JOB WHEN QUOTE IS ACCEPTED
-- ============================================================
create or replace function public.tg_create_job_on_accept()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.jobs (quote_id, job_number)
    values (
      new.id,
      'J-' || to_char(now(), 'YYYY') || '-' || lpad((select count(*)+1 from public.jobs)::text, 4, '0')
    )
    on conflict do nothing;

    if new.accepted_at is null then
      new.accepted_at = now();
    end if;
  end if;
  return new;
end;
$$;

create trigger create_job_on_accept
  before update on public.quotes
  for each row execute function public.tg_create_job_on_accept();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.tg_create_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'sales_rep')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_create_profile();
