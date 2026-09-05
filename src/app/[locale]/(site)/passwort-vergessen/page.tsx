import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getTranslations } from "next-intl/server";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("forgotTitle")} description={t("forgotSubtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
