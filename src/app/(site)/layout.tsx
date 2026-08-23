import { createClient } from "@/lib/supabase/server";
import { isTeachingUser } from "@/lib/auth/teaches-courses";
import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/nav/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isTeacher = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
    // PROJ-40: auch ein Admin, der tatsächlich unterrichtet.
    isTeacher = await isTeachingUser(supabase, user.id, profile?.role);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
