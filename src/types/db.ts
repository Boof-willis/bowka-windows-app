// Hand-written type snapshot of public schema.
// Regenerate with `supabase gen types typescript` once the project is linked.

export type UserRole = "admin" | "sales_rep" | "installer";
export type LeadStatus = "new" | "contacted" | "measured" | "quoted" | "won" | "lost";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type JobStatus =
  | "pending_order"
  | "ordered"
  | "in_production"
  | "ready_to_install"
  | "scheduled"
  | "installed"
  | "completed"
  | "cancelled";
export type PaymentMethod = "cash" | "check" | "credit_card" | "ach" | "finance";
export type WindowType =
  | "picture"
  | "single_hung"
  | "double_hung"
  | "single_slider"
  | "double_slider"
  | "casement"
  | "awning"
  | "bay"
  | "bow"
  | "garden"
  | "custom";
export type FinType = "nail_fin" | "flush_fin" | "block_frame" | "retrofit";
export type OperationType = "fixed" | "up" | "down" | "xo" | "ox" | "xox" | "oxo";
export type ExteriorSubstrate = "brick" | "siding" | "wood" | "stucco" | "foundation";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  year_built: number | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  assigned_rep_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  lead_id: string;
  quote_number: string | null;
  status: QuoteStatus;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_method: PaymentMethod | null;
  loan_plan_id: string | null;
  down_payment_cents: number | null;
  exterior_substrate: ExteriorSubstrate | null;
  install_notes: string | null;
  existing_frame_material: string | null;
  sales_rep_id: string | null;
  redline_total_cents: number | null;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Window {
  id: string;
  quote_id: string;
  position: number;
  location_label: string;
  window_type: WindowType;
  fin_type: FinType | null;
  width_inches: number;
  height_inches: number;
  net_width_inches: number | null;
  net_height_inches: number | null;
  color: string | null;
  glass_type: string | null;
  tempered: boolean;
  obscured: boolean;
  grid: boolean;
  grid_pattern: string | null;
  storms: boolean;
  wraps: boolean;
  tinted: boolean;
  tint_color: string | null;
  u_factor: number | null;
  operation: OperationType | null;
  quoted_price_cents: number;
  actual_cost_cents: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  quote_id: string;
  job_number: string | null;
  status: JobStatus;
  assigned_installer_id: string | null;
  scheduled_install_date: string | null;
  measured_at: string | null;
  installed_at: string | null;
  completed_at: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  manufacturer_order_number: string | null;
  manufacturer_order_placed_at: string | null;
  manufacturer_order_sent_at: string | null;
  manufacturer_order_sent_to: string | null;
  actual_material_cost_cents: number | null;
  actual_labor_payout_cents: number | null;
  actual_consumable_cost_cents: number | null;
  actual_dump_cost_cents: number | null;
  install_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lender {
  id: string;
  name: string;
  active: boolean;
  activation_fee_cents: number;
  min_monthly_volume_cents: number;
  min_volume_shortfall_fee_cents: number;
  notes: string | null;
  created_at: string;
}

export interface LoanPlan {
  id: string;
  lender_id: string;
  plan_code: string;
  promotional_offer: string;
  monthly_payment_factor: number | null;
  est_num_payments: number | null;
  merchant_fee_bps: number;
  category: string | null;
  active: boolean;
  created_at: string;
}

export interface ConsumableRate {
  id: string;
  key: string;
  display_name: string;
  cost_per_unit_cents: number;
  unit: "window" | "job";
  notes: string | null;
  active: boolean;
  updated_at: string;
}

export interface BurdenRate {
  id: string;
  key: string;
  display_name: string;
  rate_bps: number;
  applies_to: "w2_wages" | "all_payouts";
  notes: string | null;
  active: boolean;
  updated_at: string;
}

export interface ManufacturerInvoice {
  id: string;
  job_id: string;
  manufacturer_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_cents: number;
  file_path: string;
  file_mime: string | null;
  extraction_status: "pending" | "processing" | "completed" | "failed";
  extraction_raw: unknown;
  extracted_at: string | null;
  extracted_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  file_path: string;
  phase: "before" | "after" | "during";
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DumpTrip {
  id: string;
  trip_date: string;
  fee_cents: number;
  weight_tonnes: number | null;
  windows_hauled: number | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface LaborPayout {
  id: string;
  job_id: string;
  payee_id: string | null;
  payout_cents: number;
  payout_type: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}
