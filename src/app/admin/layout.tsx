import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();

  // PROJ-39: the badge is a question ("how many bookings are open right
  // now?"), not a stored counter — so it can never drift out of sync and
  // clears itself as soon as the last request is handled. Trials are
  // auto-confirmed and therefore never "open", so they drop out on their own.
  const { count } = await supabase
    .from("course_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold">Verwaltung</h1>
          <Link href="/profil" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Zurück zu Mein Profil
          </Link>
        </div>
        <AdminNav openBookingsCount={count ?? 0} />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
