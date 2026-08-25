import { LegalNotice } from "@/components/legal/legal-notice";
export const metadata = {
  title: "Impressum",
};

export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <LegalNotice variant="germanOnly" />

      <h1 className="font-heading text-3xl font-bold">Impressum</h1>

      <section className="space-y-1 text-sm">
        <p className="font-medium">Vienna Salsa Studio by Lisa &amp; Samuel OG</p>
        <p>Große Schiffgasse 9/Top 6</p>
        <p>1020 Wien, Österreich</p>
      </section>

      <section className="space-y-1 text-sm">
        <p>
          Telefon: <a href="tel:+436787826067" className="underline">+43 678 7826067</a>
        </p>
        <p>
          E-Mail: <a href="mailto:info@viennasalsastudio.at" className="underline">info@viennasalsastudio.at</a>
        </p>
      </section>

      <section className="space-y-1 text-sm">
        <p>Vertretungsbefugte Gesellschafter: Samuel Kramer, Lisa Vogler</p>
        <p>Rechtsform: Offene Gesellschaft (OG)</p>
        <p>Firmenbuchnummer: FN 624090 f</p>
        <p>Firmenbuchgericht: Handelsgericht Wien</p>
        <p>UID-Nummer: ATU82688156</p>
      </section>

      <section className="space-y-1 text-sm">
        <p className="font-medium">Unternehmensgegenstand</p>
        <p>
          Betrieb eines Tanzstudios, Durchführung von Tanzkursen (insbesondere Salsa und verwandte Tanzstile),
          Workshops sowie Tanzveranstaltungen und Events.
        </p>
      </section>

      <section className="space-y-1 text-sm">
        <p className="font-medium">Aufsichtsbehörde / Gewerbebehörde</p>
        <p>Magistrat der Stadt Wien</p>
      </section>

      <section className="space-y-1 text-sm">
        <p className="font-medium">Anwendbare Vorschriften</p>
        <p>
          Gewerbeordnung (GewO), Unternehmensgesetzbuch (UGB), E-Commerce-Gesetz (ECG) — abrufbar unter{" "}
          <a href="https://www.ris.bka.gv.at" className="underline" target="_blank" rel="noreferrer">
            www.ris.bka.gv.at
          </a>
          .
        </p>
      </section>

      <section className="space-y-1 text-sm">
        <p className="font-medium">Für den Inhalt verantwortlich</p>
        <p>Samuel Kramer</p>
      </section>
    </div>
  );
}
