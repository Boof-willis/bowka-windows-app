"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import type { UserRole } from "@/types/db";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sales_rep", "installer"] },
  { href: "/leads", label: "Leads", icon: Users, roles: ["admin", "sales_rep"] },
  { href: "/jobs", label: "Jobs", icon: Briefcase, roles: ["admin", "sales_rep", "installer"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Nav({ role, email }: { role: UserRole; email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <CircleDollarSign className="h-5 w-5" />
        <span className="font-semibold">Boka Glass</span>
      </div>
      <div className="flex-1 space-y-1 p-3">
        {ITEMS.filter((i) => i.roles.includes(role)).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="border-t p-3 text-xs">
        <div className="mb-2 truncate">
          <div className="font-medium text-foreground">{email}</div>
          <div className="text-muted-foreground capitalize">{role.replace("_", " ")}</div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary/60"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
