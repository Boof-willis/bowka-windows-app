-- Seed baseline configuration data.
-- Safe to re-run: uses on-conflict upserts.

-- ============================================================
-- CONSUMABLE RATES (per-window allocated unless noted)
-- ============================================================
insert into public.consumable_rates (key, display_name, cost_per_unit_cents, unit, notes) values
  ('nails', 'Roofing Nails', 17, 'window', '1 bucket ≈ 1800 nails / 300 windows / $50 → $0.17/window'),
  ('caulk', 'Caulk', 150, 'window', 'Est. tube cost allocated per window — tune after first 10 jobs'),
  ('foam', 'Window Foam', 200, 'window', 'Est. can cost allocated per window — tune after first 10 jobs'),
  ('sticky_trim', 'Sticky Trim', 125, 'window', 'Est. per window — tune after first 10 jobs'),
  ('multitool_blade', 'Multitool Blade', 50, 'window', 'Blades wear at ~1 per 2 windows of stucco cut'),
  ('cooler_drinks', 'Cooler / Drinks', 1000, 'job', 'Flat $10 per job')
on conflict (key) do update set
  display_name = excluded.display_name,
  cost_per_unit_cents = excluded.cost_per_unit_cents,
  unit = excluded.unit,
  notes = excluded.notes;

-- ============================================================
-- BURDEN RATES (Utah, placeholders — verify with payroll provider before go-live)
-- ============================================================
insert into public.burden_rates (key, display_name, rate_bps, applies_to, notes) values
  ('workers_comp', 'Workers Compensation', 800, 'all_payouts', '8% of payout — verify with UT carrier'),
  ('fica_employer', 'FICA (Employer Share)', 765, 'w2_wages', 'Social Security 6.2% + Medicare 1.45%'),
  ('futa', 'FUTA', 60, 'w2_wages', '0.6% on first $7k/employee/year'),
  ('utah_sui', 'Utah SUI (New Employer)', 120, 'w2_wages', '~1.2% placeholder — check UT DWS rate notice')
on conflict (key) do update set
  display_name = excluded.display_name,
  rate_bps = excluded.rate_bps,
  applies_to = excluded.applies_to,
  notes = excluded.notes;

-- ============================================================
-- LENDERS — Synchrony (first partner)
-- ============================================================
insert into public.lenders (name, activation_fee_cents, min_monthly_volume_cents, min_volume_shortfall_fee_cents, notes) values
  ('Synchrony', 6900, 400000, 4000, 'Tier 3 — 1933 40MV rate sheet eff 7/16/2024')
on conflict (name) do update set
  activation_fee_cents = excluded.activation_fee_cents,
  min_monthly_volume_cents = excluded.min_monthly_volume_cents,
  min_volume_shortfall_fee_cents = excluded.min_volume_shortfall_fee_cents;

-- Synchrony plans from 1933 40MV rate sheet
with syf as (select id from public.lenders where name = 'Synchrony')
insert into public.loan_plans (lender_id, plan_code, promotional_offer, monthly_payment_factor, est_num_payments, merchant_fee_bps, category) values
  ((select id from syf), '920', 'No Interest if Paid in Full within 6 Months', 0.0250, null, 660, 'deferred_interest'),
  ((select id from syf), '921', 'No Interest if Paid in Full within 9 Months', 0.0250, null, 860, 'deferred_interest'),
  ((select id from syf), '922', 'No Interest if Paid in Full within 12 Months', 0.0250, null, 935, 'deferred_interest'),
  ((select id from syf), '923', 'No Interest if Paid in Full within 15 Months', 0.0250, null, 980, 'deferred_interest'),
  ((select id from syf), '924', 'No Interest if Paid in Full within 18 Months', 0.0250, null, 1010, 'deferred_interest'),
  ((select id from syf), '925', 'No Interest if Paid in Full within 24 Months', 0.0250, null, 1325, 'deferred_interest'),
  ((select id from syf), '940', '3.99% APR Until Paid in Full', 0.0125, 94, 2475, 'fixed_payment'),
  ((select id from syf), '941', '5.99% APR Until Paid in Full', 0.0125, 102, 1860, 'fixed_payment'),
  ((select id from syf), '942', '7.99% APR Until Paid in Full', 0.0125, 115, 1375, 'fixed_payment'),
  ((select id from syf), '943', '9.99% APR Until Paid in Full', 0.0125, 132, 1060, 'fixed_payment'),
  ((select id from syf), '950', '5.99% APR Until Paid in Full', 0.0150, 82, 1725, 'fixed_payment'),
  ((select id from syf), '951', '7.99% APR Until Paid in Full', 0.0150, 88, 1285, 'fixed_payment'),
  ((select id from syf), '952', '9.99% APR Until Paid in Full', 0.0150, 98, 1025, 'fixed_payment'),
  ((select id from syf), '960', '3.99% APR Until Paid in Full', 0.0175, 64, 1825, 'fixed_payment'),
  ((select id from syf), '961', '5.99% APR Until Paid in Full', 0.0175, 68, 1550, 'fixed_payment'),
  ((select id from syf), '962', '7.99% APR Until Paid in Full', 0.0175, 73, 1175, 'fixed_payment'),
  ((select id from syf), '963', '9.99% APR Until Paid in Full', 0.0175, 78, 985, 'fixed_payment'),
  ((select id from syf), '964', '10.99% APR Until Paid in Full', 0.0175, 82, 675, 'fixed_payment'),
  ((select id from syf), '965', '11.99% APR Until Paid in Full', 0.0175, 86, 560, 'fixed_payment'),
  ((select id from syf), '970', '5.99% APR Until Paid in Full', 0.0200, 58, 1375, 'fixed_payment'),
  ((select id from syf), '971', '7.99% APR Until Paid in Full', 0.0200, 61, 1060, 'fixed_payment'),
  ((select id from syf), '972', '9.99% APR Until Paid in Full', 0.0200, 65, 965, 'fixed_payment'),
  ((select id from syf), '980', '5.99% APR Until Paid in Full', 0.0300, 37, 1060, 'fixed_payment'),
  ((select id from syf), '981', '7.99% APR Until Paid in Full', 0.0300, 38, 985, 'fixed_payment'),
  ((select id from syf), '982', '9.99% APR Until Paid in Full', 0.0300, 40, 900, 'fixed_payment'),
  ((select id from syf), '990', '5.99% APR Until Paid in Full', 0.0400, 27, 985, 'fixed_payment'),
  ((select id from syf), '991', '7.99% APR Until Paid in Full', 0.0400, 28, 960, 'fixed_payment'),
  ((select id from syf), '992', '9.99% APR Until Paid in Full', 0.0400, 28, 795, 'fixed_payment'),
  ((select id from syf), '930', 'No Interest for 25 Months Until Paid in Full', 0.0400, 25, 1360, 'equal_monthly'),
  ((select id from syf), '931', 'No Interest for 36 Months Until Paid in Full', 0.0278, 36, 1845, 'equal_monthly'),
  ((select id from syf), '932', 'No Interest for 48 Months Until Paid in Full', 0.0208, 48, 2020, 'equal_monthly'),
  ((select id from syf), '933', 'No Interest for 60 Months Until Paid in Full', 0.0167, 60, 2270, 'equal_monthly'),
  ((select id from syf), '934', 'No Interest for 72 Months Until Paid in Full', 0.0139, 72, 2620, 'equal_monthly')
on conflict (lender_id, plan_code) do update set
  promotional_offer = excluded.promotional_offer,
  monthly_payment_factor = excluded.monthly_payment_factor,
  est_num_payments = excluded.est_num_payments,
  merchant_fee_bps = excluded.merchant_fee_bps,
  category = excluded.category;
