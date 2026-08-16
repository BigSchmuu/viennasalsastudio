import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/nav/site-header";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }

  return (
    <>
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} />
      {children}
    </>
  );
}
