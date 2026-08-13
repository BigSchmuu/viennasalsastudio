import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading">Einloggen</CardTitle>
          <CardDescription>Willkommen zurück bei Vienna Salsa Studio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params.error === "confirm_failed" && (
            <Alert variant="destructive">
              <AlertDescription>
                Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere ihn erneut an
                oder registriere dich neu.
              </AlertDescription>
            </Alert>
          )}
          <LoginForm redirectTo={params.redirect} />
        </CardContent>
      </Card>
    </div>
  );
}
