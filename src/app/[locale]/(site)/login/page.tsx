import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTranslations } from "next-intl/server";

type Props = {
  searchParams: Promise<{ redirect?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("loginTitle")} description={t("loginSubtitle")}>
      {params.error === "confirm_failed" && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{t("confirmFailed")}</AlertDescription>
        </Alert>
      )}
      <LoginForm redirectTo={params.redirect} />
    </AuthShell>
  );
}
