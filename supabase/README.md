# Supabase setup

## First-time

1. Create a new Supabase project at https://supabase.com/dashboard
2. Copy `URL`, `anon key`, and `service_role key` into `boka-glass-app/.env.local`
3. In the SQL editor, run migrations in order:
   - `migrations/0001_init.sql` — tables, enums, triggers
   - `migrations/0002_rls.sql` — RLS policies + storage buckets
   - `migrations/0003_seed.sql` — consumable rates, burden rates, Synchrony plans
4. Create the first admin:
   - In Auth → Users, invite yourself by email
   - After signup, in the SQL editor run:
     ```sql
     update public.profiles set role = 'admin' where email = 'j.spenceroberts@gmail.com';
     ```

## Invite Brady

1. Auth → Users → Invite by email
2. After he accepts, set his role:
   ```sql
   update public.profiles set role = 'installer' where email = 'brady@bowkaconstruction.com';
   ```

## Notes

- The `tg_create_profile` trigger auto-populates `public.profiles` on user signup. If `raw_user_meta_data->>'role'` is set at invite time, it honors that; otherwise defaults to `sales_rep`.
- Storage buckets (`manufacturer-invoices`, `job-photos`, `loan-sheets`) are private. All reads/writes go through authenticated API routes.
- Burden rates are seeded as placeholders — **verify with your payroll provider and UT DWS rate notice before go-live.**
