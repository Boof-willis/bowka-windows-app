import { renderToStream, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { windowSqft } from "@/lib/format";
import type { Lead, Quote, Window } from "@/types/db";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16, borderBottom: 2, borderColor: "#111", paddingBottom: 8 },
  brand: { fontSize: 20, fontWeight: 700 },
  sub: { fontSize: 9, color: "#555" },
  grid2: { flexDirection: "row", gap: 16, marginBottom: 12 },
  col: { flex: 1 },
  label: { fontSize: 8, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10, marginTop: 1 },
  table: { marginTop: 8, borderTop: 1, borderColor: "#aaa" },
  row: { flexDirection: "row", borderBottom: 1, borderColor: "#ddd", paddingVertical: 4 },
  th: { fontWeight: 700, backgroundColor: "#f5f5f5", fontSize: 9 },
  c0: { width: 20 },
  c1: { width: 100 },
  c2: { width: 70 },
  c3: { width: 60 },
  c4: { width: 50 },
  c5: { width: 70 },
  c6: { width: 60 },
  c7: { flex: 1 },
  cell: { paddingHorizontal: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#777" },
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!quote) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: lead } = await supabase.from("leads").select("*").eq("id", quote.lead_id).single();
  const { data: windows } = await supabase.from("windows").select("*").eq("quote_id", id).order("position");

  const doc = <OrderForm quote={quote as Quote} lead={lead as Lead} windows={(windows as Window[]) ?? []} />;
  const stream = await renderToStream(doc);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="order-${quote.quote_number ?? id}.pdf"`,
    },
  });
}

function OrderForm({ quote, lead, windows }: { quote: Quote; lead: Lead | null; windows: Window[] }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>BOKA GLASS</Text>
          <Text style={styles.sub}>Manufacturer Order Form · {quote.quote_number ?? ""}</Text>
        </View>

        <View style={styles.grid2}>
          <View style={styles.col}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{lead?.customer_name ?? "—"}</Text>
            <Text style={styles.value}>{lead?.phone ?? ""}</Text>
            <Text style={styles.value}>{lead?.email ?? ""}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Job Address</Text>
            <Text style={styles.value}>{lead?.address_line1 ?? "—"}</Text>
            <Text style={styles.value}>
              {[lead?.city, lead?.state, lead?.zip].filter(Boolean).join(", ")}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Year Built</Text>
            <Text style={styles.value}>{lead?.year_built ?? "—"}</Text>
            <Text style={styles.label}>Substrate</Text>
            <Text style={styles.value}>{quote.exterior_substrate ?? "—"}</Text>
            <Text style={styles.label}>Existing frame</Text>
            <Text style={styles.value}>{quote.existing_frame_material ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.th]}>
            <Text style={[styles.c0, styles.cell]}>#</Text>
            <Text style={[styles.c1, styles.cell]}>Location</Text>
            <Text style={[styles.c2, styles.cell]}>Type</Text>
            <Text style={[styles.c3, styles.cell]}>Size</Text>
            <Text style={[styles.c4, styles.cell]}>Sqft</Text>
            <Text style={[styles.c5, styles.cell]}>Glass</Text>
            <Text style={[styles.c6, styles.cell]}>Color</Text>
            <Text style={[styles.c7, styles.cell]}>Specs</Text>
          </View>
          {windows.map((w) => {
            const flags: string[] = [];
            if (w.tempered) flags.push("Temp");
            if (w.obscured) flags.push("Obs");
            if (w.grid) flags.push("Grid");
            if (w.storms) flags.push("Storm");
            if (w.wraps) flags.push("Wrap");
            if (w.tinted) flags.push(`Tint:${w.tint_color ?? "Y"}`);
            if (w.fin_type) flags.push(w.fin_type.replace("_", " "));
            if (w.operation) flags.push(w.operation.toUpperCase());

            return (
              <View style={styles.row} key={w.id}>
                <Text style={[styles.c0, styles.cell]}>{w.position}</Text>
                <Text style={[styles.c1, styles.cell]}>{w.location_label}</Text>
                <Text style={[styles.c2, styles.cell]}>{w.window_type.replace("_", " ")}</Text>
                <Text style={[styles.c3, styles.cell]}>{`${w.width_inches}"×${w.height_inches}"`}</Text>
                <Text style={[styles.c4, styles.cell]}>{windowSqft(w.width_inches, w.height_inches).toFixed(1)}</Text>
                <Text style={[styles.c5, styles.cell]}>{w.glass_type ?? ""}</Text>
                <Text style={[styles.c6, styles.cell]}>{w.color ?? ""}</Text>
                <Text style={[styles.c7, styles.cell]}>{flags.join(", ")}</Text>
              </View>
            );
          })}
        </View>

        {quote.install_notes && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Install notes</Text>
            <Text style={styles.value}>{quote.install_notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Generated by Boka Glass · {new Date().toLocaleString()}</Text>
        </View>
      </Page>
    </Document>
  );
}
