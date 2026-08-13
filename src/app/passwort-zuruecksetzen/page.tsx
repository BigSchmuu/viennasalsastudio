import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading">Neues Passwort festlegen</CardTitle>
          <CardDescription>Wähle ein neues Passwort für dein Konto.</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ResetPasswordForm />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                Dieser Link ist ungültig oder abgelaufen.{" "}
                <Link href="/passwort-vergessen" className="underline">
                  Neuen Link anfordern
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
