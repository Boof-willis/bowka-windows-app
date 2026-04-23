import { requireProfile } from "@/lib/auth";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <div className="flex min-h-screen">
      <Nav role={profile.role} email={profile.email} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
