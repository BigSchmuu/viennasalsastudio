"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  programmBeitreten,
  programmAendern,
  programmVerlassen,
  gastplatzZusagen,
  gastplatzAbsagen,
} from "@/lib/actions/gasttaenzer";
import type { GasttaenzerAnsicht } from "@/lib/gasttaenzer/laden";
import { LEVEL_NAME, LEVEL_REIHE } from "@/lib/gasttaenzer/level";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Das Gasttänzer-Programm im Profil (PROJ-60).
 *
 * Zweisprachig, weil der Kundenbereich es ist. Die Einladungen sind bereits
 * gefiltert angekommen — hier wird nichts mehr entschieden, nur noch angezeigt
 * und zugesagt.
 */
export function GasttaenzerAbschnitt({ ansicht }: { ansicht: GasttaenzerAnsicht }) {
  const t = useTranslations("guestDancers");
  const locale = useLocale();

  function datum(iso: string): string {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : "de-AT", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Vienna",
    });
  }

  if (ansicht.ausgeschlossen) {
    return (
      <Alert>
        <AlertDescription>{t("excluded")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>

      <Angaben ansicht={ansicht} />

      {ansicht.imProgramm ? (
        <>
          <section className="space-y-3 border-t border-border/60 pt-4">
            <h4 className="font-heading font-semibold">{t("invitations")}</h4>
            {ansicht.einladungen.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noInvitations")}</p>
            ) : (
              <ul className="space-y-3">
                {ansicht.einladungen.map((e) => (
                  <li key={e.slotId} className="rounded-card border border-border/60 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{e.kursName}</p>
                      <Badge variant="secondary">{t("free")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {datum(e.termin)}
                      {e.uhrzeit ? ` · ${e.uhrzeit}` : ""}
                      {e.ort ? ` · ${e.ort}` : ""}
                    </p>
                    <p className="text-sm">
                      {e.rolle === "leader" ? t("searchingLeader") : t("searchingFollower")} ·{" "}
                      {t("seatsLeft", { count: e.freiePlaetze })}
                    </p>
                    <Zusage slotId={e.slotId} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <h4 className="font-heading font-semibold">{t("accepted")}</h4>
            {ansicht.zusagen.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAccepted")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {ansicht.zusagen.map((z) => (
                  <li key={z.buchungId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{z.kursName}</p>
                      <p className="text-sm text-muted-foreground">
                        {datum(z.termin)}
                        {z.uhrzeit ? ` · ${z.uhrzeit}` : ""}
                        {z.ort ? ` · ${z.ort}` : ""}
                      </p>
                    </div>
                    <Absage buchungId={z.buchungId} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Angaben({ ansicht }: { ansicht: GasttaenzerAnsicht }) {
  const t = useTranslations("guestDancers");
  const [rolle, setRolle] = useState(ansicht.rolle ?? "both");
  const [level, setLevel] = useState(ansicht.level ?? "intermediate");
  const [laeuft, setLaeuft] = useState(false);

  async function speichern() {
    setLaeuft(true);
    const formData = new FormData();
    formData.set("dance_role", rolle);
    formData.set("level", level);
    const ergebnis = ansicht.imProgramm ? await programmAendern(formData) : await programmBeitreten(formData);
    setLaeuft(false);
    if ("error" in ergebnis) {
      toast.error(ergebnis.error);
      return;
    }
    toast.success(ansicht.imProgramm ? t("save") : t("memberSince"));
  }

  return (
    <div className="space-y-4">
      {!ansicht.imProgramm ? <p className="text-sm text-muted-foreground">{t("joinHint")}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="gast-rolle">{t("role")}</Label>
          <Select value={rolle} onValueChange={(w) => setRolle(w as typeof rolle)}>
            <SelectTrigger id="gast-rolle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leader">{t("roleLeader")}</SelectItem>
              <SelectItem value="follower">{t("roleFollower")}</SelectItem>
              <SelectItem value="both">{t("roleBoth")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="gast-level">{t("level")}</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="gast-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_REIHE.map((l) => (
                <SelectItem key={l} value={l}>
                  {LEVEL_NAME[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={speichern} disabled={laeuft} className="min-h-11">
          {laeuft ? t("joining") : ansicht.imProgramm ? t("save") : t("join")}
        </Button>
        {ansicht.imProgramm ? <Austritt /> : null}
      </div>
    </div>
  );
}

function Austritt() {
  const t = useTranslations("guestDancers");
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Button
      variant="outline"
      className="min-h-11"
      disabled={laeuft}
      onClick={async () => {
        if (!window.confirm(t("leaveConfirm"))) return;
        setLaeuft(true);
        const ergebnis = await programmVerlassen();
        setLaeuft(false);
        if ("error" in ergebnis) toast.error(ergebnis.error);
      }}
    >
      {t("leave")}
    </Button>
  );
}

function Zusage({ slotId }: { slotId: string }) {
  const t = useTranslations("guestDancers");
  const [bestaetigt, setBestaetigt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`level-${slotId}`}
          checked={bestaetigt}
          onCheckedChange={(w) => setBestaetigt(w === true)}
          className="mt-0.5"
        />
        <Label htmlFor={`level-${slotId}`} className="text-sm font-normal leading-snug">
          {t("levelConfirm")}
        </Label>
      </div>
      <Button
        size="sm"
        className="min-h-11"
        disabled={!bestaetigt || laeuft}
        onClick={async () => {
          setLaeuft(true);
          const ergebnis = await gastplatzZusagen(slotId, bestaetigt);
          setLaeuft(false);
          if ("error" in ergebnis) {
            toast.error(ergebnis.error);
            return;
          }
          toast.success(t("accepted"));
        }}
      >
        {laeuft ? t("accepting") : t("accept")}
      </Button>
    </div>
  );
}

function Absage({ buchungId }: { buchungId: string }) {
  const t = useTranslations("guestDancers");
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={laeuft}
      onClick={async () => {
        if (!window.confirm(t("withdrawConfirm"))) return;
        setLaeuft(true);
        const ergebnis = await gastplatzAbsagen(buchungId);
        setLaeuft(false);
        if ("error" in ergebnis) toast.error(ergebnis.error);
      }}
    >
      {t("withdraw")}
    </Button>
  );
}
