import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/auth/profile-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validations/auth";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/profil");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, birthdate, gender")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading">Mein Profil</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <LogoutButton />
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              full_name: profile?.full_name ?? "",
              phone: profile?.phone ?? "",
              birthdate: profile?.birthdate ?? "",
              gender: (profile?.gender ?? "") as ProfileInput["gender"],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
