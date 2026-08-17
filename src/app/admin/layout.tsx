import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold">Verwaltung</h1>
          <Link href="/profil" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Zurück zu Mein Profil
          </Link>
        </div>
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
