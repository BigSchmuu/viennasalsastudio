"use client";

import { useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { mitVerbindung } from "@/lib/auth/verbindung";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("profile");
  const [loading, setLoading] = useState(false);

  async function handleLogout(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      // PROJ-92: Der einzige dieser Knöpfe ohne eigene Anzeigefläche — deshalb
      // ein Hinweis als Einblendung. Ohne ihn wurde der Knopf nach einem
      // Abbruch einfach wieder normal, und der Kunde blieb angemeldet, ohne
      // es zu erfahren.
      const ergebnis = await mitVerbindung(() => signOut());
      if (ergebnis && typeof ergebnis === "object" && "error" in ergebnis) {
        toast.error(t("logoutFailed"));
        return;
      }
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    // action={signOut}: progressive-enhancement fallback so a pre-hydration
    // click still submits (button type="submit") instead of doing nothing —
    // see PROJ-2 QA BUG-1/BUG-2 follow-up. Once hydrated, onClick's
    // preventDefault takes over for the nicer loading-state UX.
    <form action={signOut}>
      <Button type="submit" variant="outline" onClick={handleLogout} disabled={loading}>
        {loading ? t("loggingOut") : t("logout")}
      </Button>
    </form>
  );
}
