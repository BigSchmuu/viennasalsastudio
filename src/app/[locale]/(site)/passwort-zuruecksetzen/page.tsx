import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell title={t("resetTitle")} description={t("resetSubtitle")}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            {t("resetLinkInvalid")}{" "}
            <Link href="/passwort-vergessen" className="underline">
              {t("requestNewLink")}
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </AuthShell>
  );
}
