import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getTranslations } from "next-intl/server";

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("registerTitle")} description={t("registerSubtitle")}>
      <RegisterForm />
    </AuthShell>
  );
}
