-- Sales flow expansion:
--   • measure appointment fields on leads
--   • financing approval + contract fields on quotes
--   • manufacturer-order send tracking on jobs
--   • manufacturers table (per-supplier order email)
--   • integration_settings (singleton config — GHL webhook URLs)

-- ============================================================
-- LEADS — measure appointment
-- ============================================================
alter table public.leads
  add column if not exists measure_date timestamptz,
  add column if not exists measurer_id uuid references public.profiles(id) on delete set null,
  add column if not exists measure_notes text,
  add column if not exists measure_completed_at timestamptz;

-- ============================================================
-- QUOTES — financing approval + contract
-- ============================================================
alter table public.quotes
  add column if not exists financing_application_id text,
  add column if not exists financing_approved_amount_cents int,
  add column if not exists financing_approved_at timestamptz,
  add column if not exists financing_status text, -- 'pending' | 'approved' | 'denied' | 'expired'
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_file_path text,
  add column if not exists contract_provider text; -- 'docusign' | 'manual' | etc.

-- ============================================================
-- JOBS — manufacturer order tracking
-- ============================================================
alter table public.jobs
  add column if not exists manufacturer_id uuid,
  add column if not exists manufacturer_order_sent_at timestamptz,
  add column if not exists manufacturer_order_sent_to text;

-- ============================================================
-- MANUFACTURERS
-- ============================================================
create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_email text,
  order_method text default 'email', -- 'email' | 'portal' | 'fax' | 'edi'
  portal_url text,
  contact_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_manufacturers
  before update on public.manufacturers
  for each row execute function public.tg_set_updated_at();

-- Hook the FK now that the table exists
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_manufacturer_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_manufacturer_id_fkey
      foreign key (manufacturer_id) references public.manufacturers(id) on delete set null;
  end if;
end $$;

alter table public.manufacturers enable row level security;

create policy "manufacturers_admin_all" on public.manufacturers
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "manufacturers_read" on public.manufacturers
  for select using (auth.uid() is not null);

-- ============================================================
-- INTEGRATION SETTINGS (singleton key/value config)
-- ============================================================
create table if not exists public.integration_settings (
  key text primary key,            -- 'ghl_webhook_lead', 'ghl_webhook_job', etc.
  value text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.integration_settings enable row level security;

create policy "integration_settings_admin_all" on public.integration_settings
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Seed empty rows for the GHL webhook URLs (admin fills via /settings/integrations)
insert into public.integration_settings (key, notes) values
  ('ghl_webhook_lead', 'POSTed when a lead is created or its status changes. Body: {event, lead_id, customer_name, phone, email, status, ...}'),
  ('ghl_webhook_job', 'POSTed when a job''s status changes. Body: {event, job_id, customer_name, status, scheduled_install_date, ...}')
on conflict (key) do nothing;

-- ============================================================
-- SEED — placeholder manufacturer entry
-- ============================================================
insert into public.manufacturers (name, order_method, notes) values
  ('Patriot Series (placeholder)', 'email', 'Replace with real supplier name + order email at /settings/manufacturers')
on conflict (name) do nothing;
