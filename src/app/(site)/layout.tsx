import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/nav/site-header";

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
    isTeacher = profile?.role === "teacher";
  }

  return (
    <>
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} />
      {children}
    </>
  );
}
