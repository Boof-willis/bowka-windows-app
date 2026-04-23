import { requireRole } from "@/lib/auth";
import { createLead } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NewLeadPage() {
  await requireRole("admin", "sales_rep");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/leads" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to leads
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createLead} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer_name">Customer name *</Label>
                <Input id="customer_name" name="customer_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Input id="source" name="source" placeholder="google_ads, referral, d2d…" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address_line1">Address</Label>
                <Input id="address_line1" name="address_line1" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" defaultValue="UT" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zip">Zip</Label>
                  <Input id="zip" name="zip" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year_built">Year built</Label>
                <Input id="year_built" name="year_built" type="number" min={1800} max={2100} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link href="/leads">Cancel</Link>
              </Button>
              <Button type="submit">Create lead</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
