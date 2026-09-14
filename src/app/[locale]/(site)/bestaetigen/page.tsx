import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { redirect } from "@/i18n/navigation";
import { linkEinloesen } from "@/lib/actions/link-einloesen";
import { linkTyp, linkZweck } from "@/lib/auth/einmal-link";

// Die Adresse trägt ein Einmal-Token — nichts für Suchmaschinen.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const TEXTE = {
  bestaetigen: { intro: "linkIntroConfirm", knopf: "linkButtonConfirm" },
  passwort: { intro: "linkIntroPassword", knopf: "linkButtonPassword" },
  einladung: { intro: "linkIntroInvite", knopf: "linkButtonInvite" },
  anmelden: { intro: "linkIntroLogin", knopf: "linkButtonLogin" },
} as const;

type Props = {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
};

/**
 * Hier wird ein Link aus einer Supabase-Mail eingelöst: beim Tippen auf den
 * Knopf, nicht beim Öffnen der Seite (warum: lib/auth/einmal-link.ts).
 *
 * Die Seite selbst darf deshalb nie etwas einlösen, auch nicht zur
 * Bequemlichkeit — genau diesen Aufruf machen die Scanner.
 */
export default async function LinkBestaetigenPage({ searchParams }: Props) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const typ = linkTyp(type);

  if (!tokenHash || !typ) {
    return redirect({ href: "/login?error=confirm_failed", locale: await getLocale() });
  }

  const t = await getTranslations("auth");
  const texte = TEXTE[linkZweck(typ)];

  return (
    <AuthShell title={t("linkTitle")} description={t(texte.intro)}>
      <form action={linkEinloesen} className="space-y-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={typ} />
        <input type="hidden" name="next" value={next ?? ""} />
        <AuthSubmitButton loading={false} loadingText={t("linkWorking")} className="w-full">
          {t(texte.knopf)}
        </AuthSubmitButton>
        <p className="text-sm text-muted-foreground">{t("linkWhy")}</p>
      </form>
    </AuthShell>
  );
}
