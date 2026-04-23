import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

async function updateRole(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/settings/users");
}

async function toggleActive(formData: FormData) {
  "use server";
  await requireRole("admin");
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("profiles").update({ active }).eq("id", id);
  revalidatePath("/settings/users");
}

export default async function UsersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to settings
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Users & roles</CardTitle>
          <CardDescription>
            Users are invited via Supabase Auth (Auth → Users → Invite). Roles are set here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <form action={updateRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <Select name="role" defaultValue={u.role}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="sales_rep">Sales rep</SelectItem>
                          <SelectItem value="installer">Installer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "success" : "secondary"}>{u.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={(!u.active).toString()} />
                      <Button type="submit" size="sm" variant="ghost">
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
