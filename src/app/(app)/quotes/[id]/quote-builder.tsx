"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, FileDown, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatSqft, parseMoneyInput, windowSqft } from "@/lib/format";
import { saveQuoteWindows, updateQuoteMeta, sendQuote, acceptQuote } from "../actions";
import type { Lead, LoanPlan, Quote, UserRole, Window } from "@/types/db";

type LoanPlanWithLender = LoanPlan & { lender?: { name: string } };

const WINDOW_TYPES: { value: string; label: string }[] = [
  { value: "picture", label: "Picture" },
  { value: "single_hung", label: "Single Hung" },
  { value: "double_hung", label: "Double Hung" },
  { value: "single_slider", label: "Single Slider" },
  { value: "double_slider", label: "Double Slider" },
  { value: "casement", label: "Casement" },
  { value: "awning", label: "Awning" },
  { value: "bay", label: "Bay" },
  { value: "bow", label: "Bow" },
  { value: "garden", label: "Garden" },
  { value: "custom", label: "Custom" },
];

const FIN_TYPES = [
  { value: "nail_fin", label: "Nail Fin" },
  { value: "flush_fin", label: "Flush Fin" },
  { value: "block_frame", label: "Block Frame" },
  { value: "retrofit", label: "Retrofit" },
];

const OPERATIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "xo", label: "XO" },
  { value: "ox", label: "OX" },
  { value: "xox", label: "XOX" },
  { value: "oxo", label: "OXO" },
];

type Draft = {
  id?: string;
  position: number;
  location_label: string;
  window_type: string;
  fin_type: string | null;
  width_inches: number;
  height_inches: number;
  color: string;
  glass_type: string;
  tempered: boolean;
  obscured: boolean;
  grid: boolean;
  storms: boolean;
  wraps: boolean;
  tinted: boolean;
  tint_color: string;
  operation: string;
  quoted_price_cents: number;
};

function windowToDraft(w: Window): Draft {
  return {
    id: w.id,
    position: w.position,
    location_label: w.location_label,
    window_type: w.window_type,
    fin_type: w.fin_type,
    width_inches: w.width_inches,
    height_inches: w.height_inches,
    color: w.color ?? "White",
    glass_type: w.glass_type ?? "LoE 366",
    tempered: w.tempered,
    obscured: w.obscured,
    grid: w.grid,
    storms: w.storms,
    wraps: w.wraps,
    tinted: w.tinted,
    tint_color: w.tint_color ?? "",
    operation: w.operation ?? "fixed",
    quoted_price_cents: w.quoted_price_cents,
  };
}

function blankDraft(position: number): Draft {
  return {
    position,
    location_label: "",
    window_type: "single_hung",
    fin_type: "nail_fin",
    width_inches: 36,
    height_inches: 54,
    color: "White",
    glass_type: "LoE 366",
    tempered: false,
    obscured: false,
    grid: false,
    storms: false,
    wraps: false,
    tinted: false,
    tint_color: "",
    operation: "up",
    quoted_price_cents: 0,
  };
}

export function QuoteBuilder({
  quote,
  windows,
  lead,
  loanPlans,
  canSeeCosts: _canSeeCosts,
  viewerRole: _viewerRole,
}: {
  quote: Quote;
  windows: Window[];
  lead: Lead | null;
  loanPlans: LoanPlanWithLender[];
  canSeeCosts: boolean;
  viewerRole: UserRole;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(
    windows.length > 0 ? windows.map(windowToDraft) : [blankDraft(1)],
  );
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<string>(quote.payment_method ?? "finance");
  const [loanPlanId, setLoanPlanId] = useState<string | null>(quote.loan_plan_id);
  const [downPayment, setDownPayment] = useState(quote.down_payment_cents ?? 0);
  const [discount, setDiscount] = useState(quote.discount_cents ?? 0);
  const [tax, setTax] = useState(quote.tax_cents ?? 0);
  const [substrate, setSubstrate] = useState<string>(quote.exterior_substrate ?? "stucco");
  const [frameMaterial, setFrameMaterial] = useState(quote.existing_frame_material ?? "");
  const [installNotes, setInstallNotes] = useState(quote.install_notes ?? "");

  const subtotal = useMemo(() => drafts.reduce((s, d) => s + d.quoted_price_cents, 0), [drafts]);
  const total = subtotal - discount + tax;

  function addRow() {
    setDrafts((d) => [...d, blankDraft(d.length + 1)]);
  }

  function removeRow(idx: number) {
    setDrafts((d) => d.filter((_, i) => i !== idx).map((row, i) => ({ ...row, position: i + 1 })));
  }

  function updateRow(idx: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function saveWindows() {
    startTransition(async () => {
      await saveQuoteWindows(quote.id, drafts);
    });
  }

  function saveMeta() {
    startTransition(async () => {
      await updateQuoteMeta(quote.id, {
        payment_method: paymentMethod,
        loan_plan_id: paymentMethod === "finance" ? loanPlanId : null,
        down_payment_cents: downPayment,
        discount_cents: discount,
        tax_cents: tax,
        exterior_substrate: substrate,
        existing_frame_material: frameMaterial || null,
        install_notes: installNotes || null,
      });
    });
  }

  const editable = quote.status === "draft";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {quote.quote_number} · {lead?.customer_name ?? "—"}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="capitalize">{quote.status}</Badge>
            <span>{new Date(quote.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/quotes/${quote.id}/order-form`} target="_blank" rel="noreferrer">
              <FileDown className="h-4 w-4" /> Order form PDF
            </a>
          </Button>
          {editable && (
            <Button variant="outline" onClick={() => startTransition(() => sendQuote(quote.id))}>
              <Send className="h-4 w-4" /> Mark sent
            </Button>
          )}
          {(quote.status === "draft" || quote.status === "sent") && (
            <Button onClick={() => startTransition(() => acceptQuote(quote.id))}>
              <CheckCircle2 className="h-4 w-4" /> Accept → create job
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Windows</CardTitle>
            <CardDescription>{drafts.length} line item{drafts.length === 1 ? "" : "s"}</CardDescription>
          </div>
          <div className="flex gap-2">
            {editable && (
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add window
              </Button>
            )}
            {editable && (
              <Button size="sm" onClick={saveWindows} disabled={isPending}>
                {isPending ? "Saving…" : "Save windows"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size (W × H in)</TableHead>
                <TableHead>Specs</TableHead>
                <TableHead className="text-right">Price</TableHead>
                {editable && <TableHead className="w-8" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d, idx) => (
                <TableRow key={idx} className="align-top">
                  <TableCell className="pt-4">{d.position}</TableCell>
                  <TableCell>
                    <Input
                      disabled={!editable}
                      value={d.location_label}
                      onChange={(e) => updateRow(idx, { location_label: e.target.value })}
                      placeholder="Front Room"
                    />
                  </TableCell>
                  <TableCell className="min-w-[180px] space-y-2">
                    <Select
                      value={d.window_type}
                      onValueChange={(v) => updateRow(idx, { window_type: v })}
                      disabled={!editable}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WINDOW_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={d.fin_type ?? "nail_fin"}
                      onValueChange={(v) => updateRow(idx, { fin_type: v })}
                      disabled={!editable}
                    >
                      <SelectTrigger><SelectValue placeholder="Fin" /></SelectTrigger>
                      <SelectContent>
                        {FIN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={d.operation}
                      onValueChange={(v) => updateRow(idx, { operation: v })}
                      disabled={!editable}
                    >
                      <SelectTrigger><SelectValue placeholder="Op" /></SelectTrigger>
                      <SelectContent>
                        {OPERATIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-[140px] space-y-2">
                    <div className="flex gap-2">
                      <Input
                        disabled={!editable}
                        type="number"
                        step="0.25"
                        value={d.width_inches}
                        onChange={(e) => updateRow(idx, { width_inches: parseFloat(e.target.value) || 0 })}
                      />
                      <Input
                        disabled={!editable}
                        type="number"
                        step="0.25"
                        value={d.height_inches}
                        onChange={(e) => updateRow(idx, { height_inches: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatSqft(windowSqft(d.width_inches, d.height_inches))}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[180px] space-y-1.5 text-xs">
                    <Input
                      disabled={!editable}
                      placeholder="Glass (LoE 366)"
                      className="h-7 text-xs"
                      value={d.glass_type}
                      onChange={(e) => updateRow(idx, { glass_type: e.target.value })}
                    />
                    <Input
                      disabled={!editable}
                      placeholder="Color (White)"
                      className="h-7 text-xs"
                      value={d.color}
                      onChange={(e) => updateRow(idx, { color: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <Toggle label="Temp" checked={d.tempered} onChange={(v) => updateRow(idx, { tempered: v })} disabled={!editable} />
                      <Toggle label="Obs" checked={d.obscured} onChange={(v) => updateRow(idx, { obscured: v })} disabled={!editable} />
                      <Toggle label="Grid" checked={d.grid} onChange={(v) => updateRow(idx, { grid: v })} disabled={!editable} />
                      <Toggle label="Storm" checked={d.storms} onChange={(v) => updateRow(idx, { storms: v })} disabled={!editable} />
                      <Toggle label="Wrap" checked={d.wraps} onChange={(v) => updateRow(idx, { wraps: v })} disabled={!editable} />
                      <Toggle label="Tint" checked={d.tinted} onChange={(v) => updateRow(idx, { tinted: v })} disabled={!editable} />
                    </div>
                    {d.tinted && (
                      <Input
                        disabled={!editable}
                        placeholder="Tint color"
                        className="h-7 text-xs"
                        value={d.tint_color}
                        onChange={(e) => updateRow(idx, { tint_color: e.target.value })}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      disabled={!editable}
                      className="text-right"
                      defaultValue={(d.quoted_price_cents / 100).toFixed(2)}
                      onBlur={(e) => {
                        const cents = parseMoneyInput(e.target.value) ?? 0;
                        updateRow(idx, { quoted_price_cents: cents });
                      }}
                    />
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Install details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Exterior substrate</Label>
              <Select value={substrate} onValueChange={setSubstrate} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brick">Brick</SelectItem>
                  <SelectItem value="siding">Siding</SelectItem>
                  <SelectItem value="wood">Wood</SelectItem>
                  <SelectItem value="stucco">Stucco</SelectItem>
                  <SelectItem value="foundation">Foundation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Existing frame material</Label>
              <Input disabled={!editable} value={frameMaterial} onChange={(e) => setFrameMaterial(e.target.value)} placeholder="Aluminum, wood, vinyl" />
            </div>
            <div className="space-y-1.5">
              <Label>Install notes</Label>
              <Textarea disabled={!editable} value={installNotes} onChange={(e) => setInstallNotes(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="credit_card">Credit card</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "finance" && (
              <div className="space-y-1.5">
                <Label>Loan plan</Label>
                <Select value={loanPlanId ?? ""} onValueChange={setLoanPlanId} disabled={!editable}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {loanPlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.lender?.name} · {p.plan_code} · {p.promotional_offer} ({(p.merchant_fee_bps / 100).toFixed(2)}% fee)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Down payment (if any)</Label>
              <Input
                disabled={!editable}
                defaultValue={(downPayment / 100).toFixed(2)}
                onBlur={(e) => setDownPayment(parseMoneyInput(e.target.value) ?? 0)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <Input
                  disabled={!editable}
                  defaultValue={(discount / 100).toFixed(2)}
                  onBlur={(e) => setDiscount(parseMoneyInput(e.target.value) ?? 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tax</Label>
                <Input
                  disabled={!editable}
                  defaultValue={(tax / 100).toFixed(2)}
                  onBlur={(e) => setTax(parseMoneyInput(e.target.value) ?? 0)}
                />
              </div>
            </div>
            {editable && (
              <Button onClick={saveMeta} disabled={isPending} className="w-full" variant="outline">
                {isPending ? "Saving…" : "Save payment details"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Totals</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(subtotal)} />
            <Row label="Discount" value={`− ${formatMoney(discount)}`} />
            <Row label="Tax" value={`+ ${formatMoney(tax)}`} />
            <div className="mt-2 border-t pt-2">
              <Row label={<strong>Total</strong>} value={<strong>{formatMoney(total)}</strong>} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
