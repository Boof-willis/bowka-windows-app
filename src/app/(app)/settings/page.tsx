import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Droplets, Landmark, ShieldCheck, Users } from "lucide-react";

const SECTIONS = [
  { href: "/settings/consumables", title: "Consumable rates", description: "Per-window costs for nails, caulk, foam, etc.", icon: Droplets },
  { href: "/settings/loan-plans", title: "Loan plans", description: "Lenders + merchant fees per plan.", icon: Landmark },
  { href: "/settings/burden", title: "Labor burden", description: "Workers comp, payroll tax rates.", icon: ShieldCheck },
  { href: "/settings/users", title: "Users & roles", description: "Admins, sales reps, installers.", icon: Users },
];

export default async function SettingsPage() {
  await requireRole("admin");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Tune the cost model and manage users.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="transition-colors hover:bg-accent/30">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
