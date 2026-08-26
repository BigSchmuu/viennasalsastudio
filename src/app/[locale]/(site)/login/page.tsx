import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;

  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-card shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params.error === "confirm_failed" && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("confirmFailed")}
              </AlertDescription>
            </Alert>
          )}
          <LoginForm redirectTo={params.redirect} />
        </CardContent>
      </Card>
    </div>
  );
}
