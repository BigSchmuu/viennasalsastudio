import { formatAgbVersion } from "@/lib/legal";

export const metadata = {
  title: "AGB",
};

export default function AgbPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="font-heading text-3xl font-bold mb-2">Allgemeine Geschäftsbedingungen</h1>
        <p className="text-muted-foreground">Stand: {formatAgbVersion()}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">1. Geltungsbereich</h2>
        <p>
          Diese AGB gelten für alle Kursbuchungen, Abonnements und Ticketkäufe über die Vienna Salsa Studio App,
          angeboten von Vienna Salsa Studio by Lisa &amp; Samuel OG (siehe <a href="/impressum" className="underline">Impressum</a>).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">2. Abonnements und Laufzeit</h2>
        <p>
          Kurs-Abonnements laufen in fortlaufenden 4-Wochen-Zyklen und verlängern sich automatisch um jeweils
          weitere 4 Wochen, sofern sie nicht rechtzeitig über das Kundenprofil pausiert oder gekündigt werden.
        </p>
        <p>
          Eine Pausierung oder Kündigung kann jederzeit selbständig im Kundenprofil vorgenommen werden und wird
          zum Ende des jeweils laufenden 4-Wochen-Zyklus wirksam. Ein Grund oder Nachweis ist dafür nicht
          erforderlich. Bereits geplante Pausierungen oder Kündigungen können bis zu ihrem Wirksamwerden im
          Kundenprofil wieder zurückgenommen werden.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">3. Probestunden und Drop-ins</h2>
        <p>
          Probestunden und Drop-in-Termine können bis spätestens einen Tag vor dem gebuchten Termin über das
          Kundenprofil kostenlos storniert oder umgebucht werden. Bei kurzfristigeren Absagen entfällt der
          Anspruch auf Rückerstattung oder Umbuchung.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">4. Rücktrittsrecht bei Fernabsatzgeschäften</h2>
        <p>
          Kursbuchungen erfolgen im Fernabsatz über diese App. Für Dienstleistungen im Zusammenhang mit
          Freizeitgestaltung, bei denen der Vertrag die Erbringung zu einem bestimmten Termin oder in einem
          bestimmten Zeitraum vorsieht (§ 18 Abs. 1 Z 10 FAGG) — was auf unsere Kurstermine mit fixem
          Wochentermin zutrifft — besteht gesetzlich kein 14-tägiges Rücktrittsrecht. Unabhängig davon kannst du
          dein Abo jederzeit gemäß Punkt 2 pausieren oder kündigen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">5. Zahlungsbedingungen</h2>
        <p>
          Die Zahlung für Abonnements erfolgt per SEPA-Lastschrift auf Grundlage des im Kundenprofil erteilten
          Mandats. Mit Hinterlegung deiner Bankdaten ermächtigst du uns, die jeweils fälligen Beträge einzuziehen.
          Bankgebühren, die durch eine Rücklastschrift entstehen, werden dir weiterverrechnet. Bei Zahlungsverzug
          werden gesetzliche Verzugszinsen in Höhe von 4 % p. a. fällig.
        </p>
        <p>Drop-in-Zahlungen erfolgen bar oder per Kartenzahlung direkt vor Ort im Studio.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">6. Haftung</h2>
        <p>
          Wir haften nur für Schäden, die vorsätzlich oder grob fahrlässig verursacht wurden. Für den Verlust
          oder die Beschädigung persönlicher Gegenstände während des Kursbesuchs übernehmen wir keine Haftung.
          Die Teilnahme an Tanzkursen erfolgt in eigener gesundheitlicher Verantwortung.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">7. Schlussbestimmungen</h2>
        <p>
          Es gilt österreichisches Recht. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die
          Wirksamkeit der übrigen Bestimmungen davon unberührt.
        </p>
      </section>
    </div>
  );
}
