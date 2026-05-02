import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function addManufacturer(formData: FormData) {
  "use server";
  await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("manufacturers").insert({
    name,
    order_email: String(formData.get("order_email") ?? "") || null,
    order_method: String(formData.get("order_method") ?? "email"),
    contact_phone: String(formData.get("contact_phone") ?? "") || null,
    portal_url: String(formData.get("portal_url") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });
  revalidatePath("/settings/manufacturers");
}

async function updateManufacturer(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase
    .from("manufacturers")
    .update({
      name: String(formData.get("name") ?? ""),
      order_email: String(formData.get("order_email") ?? "") || null,
      order_method: String(formData.get("order_method") ?? "email"),
      contact_phone: String(formData.get("contact_phone") ?? "") || null,
    })
    .eq("id", id);
  revalidatePath("/settings/manufacturers");
}

async function deactivateManufacturer(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("manufacturers").update({ active: false }).eq("id", id);
  revalidatePath("/settings/manufacturers");
}

export default async function ManufacturersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: manufacturers } = await supabase
    .from("manufacturers")
    .select("*")
    .eq("active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Manufacturers</CardTitle>
          <CardDescription>Order destination per supplier. Used by the &quot;Mark as sent&quot; flow on jobs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Order email</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(manufacturers ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell colSpan={5} className="p-0">
                    <form action={updateManufacturer} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-12 md:items-center">
                      <input type="hidden" name="id" value={m.id} />
                      <Input name="name" defaultValue={m.name} className="md:col-span-3" />
                      <Input name="order_email" type="email" defaultValue={m.order_email ?? ""} placeholder="orders@…" className="md:col-span-3" />
                      <select name="order_method" defaultValue={m.order_method ?? "email"} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm md:col-span-2">
                        <option value="email">Email</option>
                        <option value="portal">Portal</option>
                        <option value="fax">Fax</option>
                        <option value="edi">EDI</option>
                      </select>
                      <Input name="contact_phone" defaultValue={m.contact_phone ?? ""} placeholder="Phone" className="md:col-span-2" />
                      <div className="flex gap-1 md:col-span-2">
                        <Button type="submit" size="sm" variant="outline">Save</Button>
                        <Button formAction={deactivateManufacturer} size="sm" variant="ghost" type="submit">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add manufacturer</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addManufacturer} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order_email">Order email</Label>
              <Input id="order_email" name="order_email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order_method">Order method</Label>
              <select name="order_method" id="order_method" defaultValue="email" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                <option value="email">Email</option>
                <option value="portal">Portal</option>
                <option value="fax">Fax</option>
                <option value="edi">EDI</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input id="contact_phone" name="contact_phone" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
