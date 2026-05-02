-- Fix infinite recursion in profiles RLS policies.
-- Original policies called public.current_role(), which queries profiles,
-- which re-evaluates the same policy → 42P17 recursion error.
--
-- New approach:
--  - All authenticated users can READ all profiles (it's just team metadata:
--    name, email, role, phone — fine to share within an internal org).
--  - Self can UPDATE their own profile.
--  - Admin operations on profiles (changing role, deactivating users) go
--    through service-role API routes in the app layer, NOT through RLS.

drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;

create policy "profiles_authenticated_read" on public.profiles
  for select to authenticated using (true);

create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT/DELETE policies — those are handled by the trigger on auth.users
-- (insert) and via service-role only (delete). Without an INSERT/DELETE
-- policy, regular authenticated users cannot insert/delete profile rows.

-- Sanity: ensure the helper function is plpgsql (more reliable inlining
-- semantics for SECURITY DEFINER) and has search_path locked.
create or replace function public.current_role()
returns user_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r user_role;
begin
  select role into r from public.profiles where id = auth.uid();
  return r;
end;
$$;
