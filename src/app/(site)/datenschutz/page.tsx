export const metadata = {
  title: "Datenschutzerklärung",
};

export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="font-heading text-3xl font-bold mb-2">Datenschutzerklärung</h1>
        <p className="text-muted-foreground">Stand: August 2026</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">1. Verantwortlicher</h2>
        <p>
          Vienna Salsa Studio by Lisa &amp; Samuel OG, Große Schiffgasse 9/Top 6, 1020 Wien, Österreich.
          E-Mail:{" "}
          <a href="mailto:info@viennasalsastudio.at" className="underline">
            info@viennasalsastudio.at
          </a>
          . Nähere Angaben siehe <a href="/impressum" className="underline">Impressum</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">2. Welche Daten wir verarbeiten</h2>
        <p>Im Rahmen der Nutzung dieser App verarbeiten wir folgende Kategorien personenbezogener Daten:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Konto- und Profildaten:</span> Vor- und Nachname, E-Mail-Adresse,
            Telefonnummer, Geburtsdatum, Geschlecht.
          </li>
          <li>
            <span className="font-medium">Zahlungsdaten:</span> IBAN und Kontoinhaber:in für das
            SEPA-Lastschriftmandat.
          </li>
          <li>
            <span className="font-medium">Buchungs- und Kursdaten:</span> gebuchte Kurse, Abo-Status, gewählte
            Termine, Anwesenheiten, Wartelisten-Einträge.
          </li>
          <li>
            <span className="font-medium">Rechnungsdaten:</span> Rechnungshistorie aus dem SEPA-Sammeleinzug.
          </li>
          <li>
            <span className="font-medium">Event- und Ticketdaten:</span> gekaufte Tickets für Events/Workshops
            inkl. Zahlungsart und Check-in-Status.
          </li>
          <li>
            <span className="font-medium">Benachrichtigungsdaten:</span> Einstellungen zu E-Mail-/Push-Benachrichtigungen,
            bei aktivierten Push-Benachrichtigungen ein technischer Push-Endpunkt des Browsers.
          </li>
          <li>
            <span className="font-medium">Technische Daten:</span> IP-Adresse, Zeitpunkt des Zugriffs sowie
            technische Fehlerprotokolle (z. B. Absturzberichte) im Rahmen des Betriebs und der Absicherung der App.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">3. Zwecke und Rechtsgrundlagen</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</span> Verwaltung
            deines Kundenkontos, Kursbuchung, Abo-Verwaltung, SEPA-Lastschrifteinzug, Ticketverkauf.
          </li>
          <li>
            <span className="font-medium">Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO):</span>{" "}
            steuer- und unternehmensrechtliche Aufbewahrungspflichten, insbesondere für Rechnungen (UGB, BAO).
          </li>
          <li>
            <span className="font-medium">Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):</span> Sicherheit
            und Fehleranalyse des Betriebs, automatische Nachrück-Logik bei der Warteliste, Betrugs- und Missbrauchsprävention.
          </li>
          <li>
            <span className="font-medium">Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</span> Aktivierung von
            Push-Benachrichtigungen im Browser. Die Einwilligung kann jederzeit im Kundenprofil widerrufen werden.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">4. Weitergabe an Auftragsverarbeiter</h2>
        <p>Zum Betrieb dieser App setzen wir folgende Dienstleister ein, mit denen jeweils ein Auftragsverarbeitungsvertrag besteht bzw. abgeschlossen wird:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Supabase Inc.</span> — Datenbank, Authentifizierung und Datenspeicherung.
          </li>
          <li>
            <span className="font-medium">Vercel Inc.</span> — Hosting der Web-Applikation.
          </li>
          <li>
            <span className="font-medium">Functional Software, Inc. (Sentry)</span> — technische Fehlerüberwachung
            zur Absicherung des laufenden Betriebs.
          </li>
          <li>
            <span className="font-medium">STRATO AG</span> — Versand automatischer E-Mail-Benachrichtigungen.
          </li>
          <li>
            Kreditinstitute und Zahlungsdienstleister im Rahmen der Abwicklung des SEPA-Lastschrifteinzugs.
          </li>
        </ul>
        <p>
          Einige dieser Anbieter verarbeiten Daten auch außerhalb der EU/des EWR (insbesondere USA). In diesen
          Fällen stellen wir ein angemessenes Datenschutzniveau durch geeignete Garantien sicher, etwa EU-Standardvertragsklauseln
          oder einen Angemessenheitsbeschluss der EU-Kommission.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">5. Speicherdauer</h2>
        <p>
          Konto- und Buchungsdaten speichern wir, solange dein Kundenkonto besteht. Rechnungsdaten bewahren wir
          entsprechend der gesetzlichen Aufbewahrungsfristen (grundsätzlich 7 Jahre gemäß UGB/BAO) auch nach
          Beendigung des Kundenverhältnisses auf. Technische Fehlerprotokolle werden nur so lange gespeichert,
          wie es für die Fehleranalyse erforderlich ist.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">6. Deine Rechte</h2>
        <p>Du hast das Recht auf:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Auskunft über die zu deiner Person gespeicherten Daten</li>
          <li>Berichtigung unrichtiger Daten</li>
          <li>Löschung deiner Daten, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht</li>
          <li>Einschränkung der Verarbeitung</li>
          <li>Datenübertragbarkeit</li>
          <li>Widerspruch gegen die Verarbeitung auf Grundlage berechtigten Interesses</li>
          <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft</li>
        </ul>
        <p>
          Wende dich dazu an{" "}
          <a href="mailto:info@viennasalsastudio.at" className="underline">
            info@viennasalsastudio.at
          </a>
          . Du hast außerdem das Recht, dich bei der österreichischen Datenschutzbehörde zu beschweren:
          Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien,{" "}
          <a href="mailto:dsb@dsb.gv.at" className="underline">
            dsb@dsb.gv.at
          </a>
          .
        </p>
      </section>
    </div>
  );
}
