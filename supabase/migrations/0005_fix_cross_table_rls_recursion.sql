-- Fix cross-table RLS recursion between leads/quotes/jobs/windows/job_photos.
-- The original policies used `exists (select ... from <other_table>)` subqueries
-- that re-triggered RLS evaluation on the other table. When two tables'
-- policies reference each other (quotes ↔ jobs), evaluation loops → 42P17.
--
-- Fix: move the cross-table lookups into SECURITY DEFINER helper functions
-- owned by `postgres` (BYPASSRLS=true). Inside the function, the SELECT runs
-- without RLS evaluation. Policies then call the helper and get a plain bool.

-- ============================================================
-- HELPERS
-- ============================================================
create or replace function public.installer_assigned_to_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    join public.quotes q on q.id = j.quote_id
    where q.lead_id = p_lead_id
      and j.assigned_installer_id = auth.uid()
  );
$$;

create or replace function public.installer_assigned_to_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    where j.quote_id = p_quote_id
      and j.assigned_installer_id = auth.uid()
  );
$$;

create or replace function public.rep_owns_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.quotes q
    where q.id = p_quote_id and q.sales_rep_id = auth.uid()
  );
$$;

create or replace function public.installer_assigned_to_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.assigned_installer_id = auth.uid()
  );
$$;

create or replace function public.rep_owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    join public.quotes q on q.id = j.quote_id
    where j.id = p_job_id and q.sales_rep_id = auth.uid()
  );
$$;

-- ============================================================
-- REWIRE POLICIES
-- ============================================================

-- LEADS
drop policy if exists "leads_installer_read" on public.leads;
create policy "leads_installer_read" on public.leads
  for select using (
    public.current_role() = 'installer'
    and public.installer_assigned_to_lead(leads.id)
  );

-- QUOTES
drop policy if exists "quotes_installer_read" on public.quotes;
create policy "quotes_installer_read" on public.quotes
  for select using (
    public.current_role() = 'installer'
    and public.installer_assigned_to_quote(quotes.id)
  );

-- JOBS
drop policy if exists "jobs_rep_read" on public.jobs;
create policy "jobs_rep_read" on public.jobs
  for select using (
    public.current_role() = 'sales_rep'
    and public.rep_owns_quote(jobs.quote_id)
  );

-- WINDOWS
drop policy if exists "windows_installer_read" on public.windows;
create policy "windows_installer_read" on public.windows
  for select using (
    public.current_role() = 'installer'
    and public.installer_assigned_to_quote(windows.quote_id)
  );

-- JOB_PHOTOS
drop policy if exists "job_photos_installer_rw" on public.job_photos;
create policy "job_photos_installer_rw" on public.job_photos
  for all using (
    public.current_role() = 'installer'
    and public.installer_assigned_to_job(job_photos.job_id)
  )
  with check (
    public.current_role() = 'installer'
    and public.installer_assigned_to_job(job_photos.job_id)
  );

drop policy if exists "job_photos_rep_read" on public.job_photos;
create policy "job_photos_rep_read" on public.job_photos
  for select using (
    public.current_role() = 'sales_rep'
    and public.rep_owns_job(job_photos.job_id)
  );

-- JOB_CONSUMABLES
drop policy if exists "job_consumables_installer_insert" on public.job_consumables;
create policy "job_consumables_installer_insert" on public.job_consumables
  for insert with check (
    public.current_role() = 'installer'
    and public.installer_assigned_to_job(job_consumables.job_id)
  );
