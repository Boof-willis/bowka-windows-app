-- Row-level security policies
-- admin: full access
-- sales_rep: own leads/quotes, their assigned jobs, no cost visibility (enforced at query layer)
-- installer: assigned jobs only, read-only on quotes/windows, can upload photos/consumables/dump trips

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.windows enable row level security;
alter table public.manufacturer_invoices enable row level security;
alter table public.job_photos enable row level security;
alter table public.consumable_rates enable row level security;
alter table public.job_consumables enable row level security;
alter table public.dump_trips enable row level security;
alter table public.dump_trip_jobs enable row level security;
alter table public.labor_payouts enable row level security;
alter table public.burden_rates enable row level security;
alter table public.pay_scales enable row level security;
alter table public.user_pay_scales enable row level security;
alter table public.lenders enable row level security;
alter table public.loan_plans enable row level security;

-- Helper: get current user's role
create or replace function public.current_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_all" on public.profiles
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- LEADS
-- ============================================================
create policy "leads_admin_all" on public.leads
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "leads_rep_own" on public.leads
  for all using (
    public.current_role() = 'sales_rep'
    and (assigned_rep_id = auth.uid() or created_by = auth.uid())
  )
  with check (
    public.current_role() = 'sales_rep'
    and (assigned_rep_id = auth.uid() or created_by = auth.uid())
  );

create policy "leads_installer_read" on public.leads
  for select using (
    public.current_role() = 'installer'
    and exists (
      select 1 from public.quotes q
      join public.jobs j on j.quote_id = q.id
      where q.lead_id = leads.id and j.assigned_installer_id = auth.uid()
    )
  );

-- ============================================================
-- QUOTES
-- ============================================================
create policy "quotes_admin_all" on public.quotes
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "quotes_rep_own" on public.quotes
  for all using (
    public.current_role() = 'sales_rep' and sales_rep_id = auth.uid()
  )
  with check (
    public.current_role() = 'sales_rep' and sales_rep_id = auth.uid()
  );

create policy "quotes_installer_read" on public.quotes
  for select using (
    public.current_role() = 'installer'
    and exists (
      select 1 from public.jobs j
      where j.quote_id = quotes.id and j.assigned_installer_id = auth.uid()
    )
  );

-- ============================================================
-- JOBS
-- ============================================================
create policy "jobs_admin_all" on public.jobs
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "jobs_rep_read" on public.jobs
  for select using (
    public.current_role() = 'sales_rep'
    and exists (select 1 from public.quotes q where q.id = jobs.quote_id and q.sales_rep_id = auth.uid())
  );

create policy "jobs_installer_assigned" on public.jobs
  for select using (
    public.current_role() = 'installer' and assigned_installer_id = auth.uid()
  );

create policy "jobs_installer_update" on public.jobs
  for update using (
    public.current_role() = 'installer' and assigned_installer_id = auth.uid()
  )
  with check (
    public.current_role() = 'installer' and assigned_installer_id = auth.uid()
  );

-- ============================================================
-- WINDOWS
-- ============================================================
create policy "windows_admin_all" on public.windows
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "windows_rep_own_quote" on public.windows
  for all using (
    public.current_role() = 'sales_rep'
    and exists (select 1 from public.quotes q where q.id = windows.quote_id and q.sales_rep_id = auth.uid())
  )
  with check (
    public.current_role() = 'sales_rep'
    and exists (select 1 from public.quotes q where q.id = windows.quote_id and q.sales_rep_id = auth.uid())
  );

create policy "windows_installer_read" on public.windows
  for select using (
    public.current_role() = 'installer'
    and exists (
      select 1 from public.jobs j where j.quote_id = windows.quote_id and j.assigned_installer_id = auth.uid()
    )
  );

-- ============================================================
-- JOB PHOTOS — installers and admins can write; reps can read their jobs
-- ============================================================
create policy "job_photos_admin_all" on public.job_photos
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "job_photos_installer_rw" on public.job_photos
  for all using (
    public.current_role() = 'installer'
    and exists (select 1 from public.jobs j where j.id = job_photos.job_id and j.assigned_installer_id = auth.uid())
  )
  with check (
    public.current_role() = 'installer'
    and exists (select 1 from public.jobs j where j.id = job_photos.job_id and j.assigned_installer_id = auth.uid())
  );

create policy "job_photos_rep_read" on public.job_photos
  for select using (
    public.current_role() = 'sales_rep'
    and exists (
      select 1 from public.jobs j
      join public.quotes q on q.id = j.quote_id
      where j.id = job_photos.job_id and q.sales_rep_id = auth.uid()
    )
  );

-- ============================================================
-- MANUFACTURER INVOICES (admin only — cost data)
-- ============================================================
create policy "manufacturer_invoices_admin_all" on public.manufacturer_invoices
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- CONSUMABLES, DUMP, LABOR, BURDEN, PAY SCALES — admin manages; installers can log
-- ============================================================
create policy "consumable_rates_admin_all" on public.consumable_rates
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "consumable_rates_read" on public.consumable_rates
  for select using (auth.uid() is not null);

create policy "job_consumables_admin_all" on public.job_consumables
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "job_consumables_installer_insert" on public.job_consumables
  for insert with check (
    public.current_role() = 'installer'
    and exists (select 1 from public.jobs j where j.id = job_consumables.job_id and j.assigned_installer_id = auth.uid())
  );

create policy "dump_trips_admin_all" on public.dump_trips
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "dump_trips_installer_insert" on public.dump_trips
  for insert with check (public.current_role() = 'installer');

create policy "dump_trips_installer_read" on public.dump_trips
  for select using (public.current_role() = 'installer' and recorded_by = auth.uid());

create policy "dump_trip_jobs_admin_all" on public.dump_trip_jobs
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "dump_trip_jobs_installer_insert" on public.dump_trip_jobs
  for insert with check (public.current_role() = 'installer');

create policy "labor_payouts_admin_all" on public.labor_payouts
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "burden_rates_admin_all" on public.burden_rates
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "burden_rates_read" on public.burden_rates
  for select using (auth.uid() is not null);

create policy "pay_scales_admin_all" on public.pay_scales
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "user_pay_scales_admin_all" on public.user_pay_scales
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "user_pay_scales_self_read" on public.user_pay_scales
  for select using (user_id = auth.uid());

create policy "lenders_admin_all" on public.lenders
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "lenders_read" on public.lenders
  for select using (auth.uid() is not null);

create policy "loan_plans_admin_all" on public.loan_plans
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "loan_plans_read" on public.loan_plans
  for select using (auth.uid() is not null);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('manufacturer-invoices', 'manufacturer-invoices', false),
  ('job-photos', 'job-photos', false),
  ('loan-sheets', 'loan-sheets', false)
on conflict (id) do nothing;

-- Storage RLS: admins can do anything, installers can upload to job-photos, read on their jobs
create policy "storage_admin_all" on storage.objects
  for all to authenticated using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "storage_installer_job_photos" on storage.objects
  for all to authenticated using (
    bucket_id = 'job-photos' and public.current_role() = 'installer'
  )
  with check (
    bucket_id = 'job-photos' and public.current_role() = 'installer'
  );
