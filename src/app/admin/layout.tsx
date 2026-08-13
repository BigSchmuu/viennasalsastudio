import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-heading text-2xl font-bold mb-6">Verwaltung</h1>
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
