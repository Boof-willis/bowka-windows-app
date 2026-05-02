-- Demo / fixture data for local exploration.
-- Safe to delete by truncating the listed tables — does NOT touch profiles or auth.
-- Re-runnable: deletes any prior rows tagged 'DEMO' before inserting.

do $$
declare
  spencer_id uuid := 'bedcc974-09ea-4339-ac95-327215f6435c';
  lead_mitchell uuid := gen_random_uuid();
  lead_chen uuid := gen_random_uuid();
  lead_hayes uuid := gen_random_uuid();
  lead_thompson uuid := gen_random_uuid();
  lead_anderson uuid := gen_random_uuid();
  lead_olsen uuid := gen_random_uuid();
  lead_walsh uuid := gen_random_uuid();
  q_chen uuid := gen_random_uuid();
  q_thompson uuid := gen_random_uuid();
  q_anderson uuid := gen_random_uuid();
  q_olsen uuid := gen_random_uuid();
  job_anderson uuid := gen_random_uuid();
  job_olsen uuid := gen_random_uuid();
  syf_plan_933 uuid;
  trip_id uuid;
begin
  -- Wipe prior demo rows (idempotent)
  delete from public.leads where notes like '%[DEMO]%';

  select id into syf_plan_933 from public.loan_plans where plan_code = '933' limit 1;

  -- ============================================================
  -- LEADS — 7 total in mix of statuses
  -- ============================================================
  insert into public.leads (id, customer_name, email, phone, address_line1, city, state, zip, year_built, source, status, notes, assigned_rep_id, created_by, created_at) values
    (lead_mitchell, 'Sarah Mitchell',  'sarah.m@example.com',     '801-555-1023', '4521 N University Ave', 'Provo',          'UT', '84604', 1985, 'google_ads', 'new',       '[DEMO] North-facing windows, front of house',                       spencer_id, spencer_id, now() - interval '1 day'),
    (lead_chen,     'Marcus Chen',     'mchen@example.com',       '801-555-2447', '892 W Center St',       'Orem',           'UT', '84057', 1992, 'meta',       'quoted',    '[DEMO] Wants quote ASAP — 4 windows kitchen + dining',              spencer_id, spencer_id, now() - interval '4 days'),
    (lead_hayes,    'Patricia Hayes',  'phayes@example.com',      '385-555-7821', '1267 E 1500 N',         'American Fork',  'UT', '84003', 1978, 'd2d',        'measured',  '[DEMO] Stucco install, ~12 windows whole house',                    spencer_id, spencer_id, now() - interval '2 days'),
    (lead_thompson, 'David Thompson',  'dthompson@example.com',   '801-555-3909', '3401 N Center',         'Lehi',           'UT', '84043', 2001, 'referral',   'quoted',    '[DEMO] Quote sent — awaiting decision',                             spencer_id, spencer_id, now() - interval '3 days'),
    (lead_anderson, 'Lauren Anderson', 'landerson@example.com',   '801-555-4522', '3461 Foothill Drive',   'Provo',          'UT', '84604', 1993, 'd2d',        'won',       '[DEMO] 11 windows, aluminum out, stucco install. 30% basement disc.', spencer_id, spencer_id, now() - interval '10 days'),
    (lead_olsen,    'Robert Olsen',    'rolsen@example.com',      '801-555-6677', '724 S 200 W',           'Spanish Fork',   'UT', '84660', 1989, 'lsa',        'won',       '[DEMO] 8 ground-floor windows, install completed',                  spencer_id, spencer_id, now() - interval '16 days'),
    (lead_walsh,    'Jennifer Walsh',  'jwalsh@example.com',      '385-555-1199', '2210 W State Rd',       'Pleasant Grove', 'UT', '84062', 1997, 'google_ads', 'lost',      '[DEMO] Went with competitor — quoted too high',                     spencer_id, spencer_id, now() - interval '8 days');

  -- ============================================================
  -- QUOTES — 4 total (1 sent, 1 sent, 2 accepted)
  -- ============================================================
  insert into public.quotes (id, lead_id, quote_number, status, subtotal_cents, total_cents, payment_method, loan_plan_id, exterior_substrate, existing_frame_material, install_notes, sales_rep_id, sent_at, accepted_at, created_at) values
    (q_chen,     lead_chen,     'DEMO-Q-0001', 'sent',     690000,  690000,  'finance', syf_plan_933, 'siding', 'wood',     '4 windows, kitchen and dining',                                                  spencer_id, now() - interval '2 days',  null,                       now() - interval '4 days'),
    (q_thompson, lead_thompson, 'DEMO-Q-0002', 'sent',     1850000, 1850000, 'finance', syf_plan_933, 'brick',  'aluminum', 'Whole house, 9 windows',                                                         spencer_id, now() - interval '1 day',   null,                       now() - interval '3 days'),
    (q_anderson, lead_anderson, 'DEMO-Q-0003', 'accepted', 2321600, 2321600, 'finance', syf_plan_933, 'stucco', 'aluminum', '11 windows. Frameover. Window fin will stick out from wall (current popouts).', spencer_id, now() - interval '7 days',  now() - interval '5 days',  now() - interval '10 days'),
    (q_olsen,    lead_olsen,    'DEMO-Q-0004', 'accepted', 1289500, 1289500, 'cash',    null,         'siding', 'vinyl',    '8 ground-floor windows',                                                         spencer_id, now() - interval '14 days', now() - interval '12 days', now() - interval '16 days');

  -- ============================================================
  -- WINDOWS
  -- ============================================================

  -- Chen: kitchen + dining (4)
  insert into public.windows (quote_id, position, location_label, window_type, fin_type, width_inches, height_inches, color, glass_type, tempered, obscured, grid, storms, wraps, tinted, operation, quoted_price_cents) values
    (q_chen, 1, 'Kitchen', 'single_slider', 'nail_fin', 48, 36, 'White', 'LoE 366', false, false, false, false, false, false, 'xo', 175000),
    (q_chen, 2, 'Kitchen', 'casement',      'nail_fin', 24, 36, 'White', 'LoE 366', false, false, false, false, false, false, 'fixed', 165000),
    (q_chen, 3, 'Dining',  'single_hung',   'nail_fin', 30, 54, 'White', 'LoE 366', false, false, false, false, false, false, 'up', 175000),
    (q_chen, 4, 'Dining',  'single_hung',   'nail_fin', 30, 54, 'White', 'LoE 366', false, false, false, false, false, false, 'up', 175000);

  -- Thompson: master bed (sketch — 2 of 9)
  insert into public.windows (quote_id, position, location_label, window_type, fin_type, width_inches, height_inches, color, glass_type, tempered, obscured, grid, storms, wraps, tinted, operation, quoted_price_cents) values
    (q_thompson, 1, 'Master Bed', 'picture',  'nail_fin', 60, 60, 'White', 'LoE 366', false, false, false, false, false, false, 'fixed', 285000),
    (q_thompson, 2, 'Master Bed', 'casement', 'nail_fin', 30, 48, 'White', 'LoE 366', false, false, false, false, false, false, 'fixed', 195000);

  -- Anderson: 11 windows mirroring the PDF reference
  insert into public.windows (quote_id, position, location_label, window_type, fin_type, width_inches, height_inches, color, glass_type, tempered, obscured, grid, storms, wraps, tinted, operation, quoted_price_cents) values
    (q_anderson, 1,  'Front Room',  'picture',       'nail_fin', 48, 54, 'White', 'LoE 366', false, false, false, false, false, false, 'fixed', 285000),
    (q_anderson, 2,  'Front Room',  'single_hung',   'nail_fin', 24, 54, 'White', 'LoE 366', false, false, false, false, false, false, 'up',    175000),
    (q_anderson, 3,  'Front Room',  'single_hung',   'nail_fin', 24, 54, 'White', 'LoE 366', false, false, false, false, false, false, 'up',    175000),
    (q_anderson, 4,  'Office',      'single_slider', 'nail_fin', 48, 48, 'White', 'LoE 366', false, false, false, false, false, false, 'xo',    220000),
    (q_anderson, 5,  'Bed 1',       'single_slider', 'nail_fin', 48, 48, 'White', 'LoE 366', false, false, false, false, false, false, 'xo',    220000),
    (q_anderson, 6,  'Master Bed',  'single_slider', 'nail_fin', 66, 48, 'White', 'LoE 366', false, false, false, false, false, false, 'xo',    245000),
    (q_anderson, 7,  'Master Bath', 'single_slider', 'nail_fin', 48, 36, 'White', 'LoE 366', true,  false, false, false, false, false, 'xo',    215000),
    (q_anderson, 8,  'Family Room', 'single_slider', 'nail_fin', 60, 60, 'White', 'LoE 366', false, false, false, false, false, false, 'xo',    265000),
    (q_anderson, 9,  'Dining',      'single_hung',   'nail_fin', 24, 60, 'White', 'LoE 366', false, false, false, false, false, false, 'up',    185000),
    (q_anderson, 10, 'Dining',      'single_hung',   'nail_fin', 24, 60, 'White', 'LoE 366', false, false, false, false, false, false, 'up',    185000),
    (q_anderson, 11, 'Kitchen',     'single_slider', 'nail_fin', 36, 36, 'White', 'LoE 366', false, false, false, false, false, false, 'xo',    151600);

  -- Olsen: 8 windows w/ grids + a tempered/obscured bath
  insert into public.windows (quote_id, position, location_label, window_type, fin_type, width_inches, height_inches, color, glass_type, tempered, obscured, grid, storms, wraps, tinted, operation, quoted_price_cents) values
    (q_olsen, 1, 'Living Room', 'picture',       'flush_fin', 60, 48, 'White', 'LoE 366', false, false, false, false, false, false, 'fixed', 195000),
    (q_olsen, 2, 'Living Room', 'single_hung',   'flush_fin', 30, 48, 'White', 'LoE 366', false, false, true,  false, false, false, 'up',    185000),
    (q_olsen, 3, 'Kitchen',     'casement',      'flush_fin', 30, 36, 'White', 'LoE 366', false, false, true,  false, false, false, 'fixed', 165000),
    (q_olsen, 4, 'Bedroom 1',   'single_slider', 'flush_fin', 48, 36, 'White', 'LoE 366', false, false, true,  false, false, false, 'xo',    145000),
    (q_olsen, 5, 'Bedroom 2',   'single_slider', 'flush_fin', 48, 36, 'White', 'LoE 366', false, false, true,  false, false, false, 'xo',    145000),
    (q_olsen, 6, 'Bath 1',      'awning',        'flush_fin', 24, 24, 'White', 'LoE 366', false, true,  false, false, false, false, 'fixed', 135000),
    (q_olsen, 7, 'Bath 2',      'awning',        'flush_fin', 24, 24, 'White', 'LoE 366', true,  true,  false, false, false, false, 'fixed', 145000),
    (q_olsen, 8, 'Garage',      'single_hung',   'flush_fin', 30, 36, 'White', 'LoE 366', false, false, true,  false, false, false, 'up',    175000);

  -- ============================================================
  -- JOBS — 2 (one scheduled, one completed)
  -- ============================================================
  insert into public.jobs (id, quote_id, job_number, status, scheduled_install_date, installed_at, completed_at, manufacturer_name, manufacturer_order_number, manufacturer_order_placed_at, actual_material_cost_cents, install_notes) values
    (job_anderson, q_anderson, 'DEMO-J-0001', 'scheduled', current_date + interval '4 days', null,                          null,                          'Patriot Series', 'PS-26-1042', now() - interval '4 days',  null,    '[DEMO] Stucco install over existing aluminum frames; 30% basement discount applied at quote'),
    (job_olsen,    q_olsen,    'DEMO-J-0002', 'completed', current_date - interval '6 days', now() - interval '6 days',     now() - interval '4 days',     'Patriot Series', 'PS-26-0987', now() - interval '11 days', 875000,  '[DEMO] Single-day install; clean job; tempered/obscured bath windows passed inspection');

  -- For Olsen (completed): backfill simulated actual_cost_cents on each window (~55% of quoted)
  update public.windows set actual_cost_cents = round(quoted_price_cents * 0.55) where quote_id = q_olsen;

  -- ============================================================
  -- LABOR PAYOUT — Olsen (completed)
  -- ============================================================
  insert into public.labor_payouts (job_id, payout_cents, payout_type, paid_at, notes) values
    (job_olsen, 240000, 'install', current_date - interval '4 days', '[DEMO] Brady — install crew, 8 windows');

  -- ============================================================
  -- DUMP TRIP — Olsen
  -- ============================================================
  insert into public.dump_trips (trip_date, fee_cents, weight_tonnes, windows_hauled, notes)
  values (current_date - interval '4 days', 4500, 0.42, 8, '[DEMO] Single trip after Olsen install')
  returning id into trip_id;

  insert into public.dump_trip_jobs (dump_trip_id, job_id, windows_from_job)
  values (trip_id, job_olsen, 8);

end $$;

-- Quick verification
select 'leads' as tbl, count(*) from public.leads where notes like '%[DEMO]%'
union all select 'quotes', count(*) from public.quotes q join public.leads l on l.id=q.lead_id where l.notes like '%[DEMO]%'
union all select 'windows', count(*) from public.windows w join public.quotes q on q.id=w.quote_id join public.leads l on l.id=q.lead_id where l.notes like '%[DEMO]%'
union all select 'jobs', count(*) from public.jobs j join public.quotes q on q.id=j.quote_id join public.leads l on l.id=q.lead_id where l.notes like '%[DEMO]%'
union all select 'labor_payouts', count(*) from public.labor_payouts
union all select 'dump_trips', count(*) from public.dump_trips;
