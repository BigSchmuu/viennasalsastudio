/**
 * Die häufigen Fragen — zweisprachig, an einer Stelle (PROJ-66).
 *
 * Wie bei den Rechtstexten stehen die Inhalte im Code und nicht in der
 * Datenbank: Sie ändern sich selten, und eine Verwaltungsoberfläche dafür
 * wäre mehr Pflege, als sie erspart. Eine Änderung ist ein Einzeiler hier
 * plus ein Deploy.
 *
 * Nur Text, kein Markup: Dieselben Sätze gehen als strukturierte Daten an
 * Suchmaschinen, und dort hätten Links und Fettungen nichts verloren.
 *
 * **Wer hier etwas ändert, ändert es in beiden Sprachen.** Eine fehlende
 * Übersetzung fiele sonst erst auf, wenn ein englischsprachiger Gast vor der
 * deutschen Antwort steht.
 */

export type FaqEintrag = {
  frage: { de: string; en: string };
  antwort: { de: string; en: string };
};

export type FaqGruppe = {
  titel: { de: string; en: string };
  eintraege: FaqEintrag[];
};

export const FAQ: FaqGruppe[] = [
  {
    titel: { de: "Ausprobieren und buchen", en: "Trying a class and booking" },
    eintraege: [
      {
        frage: { de: "Kann ich einen Kurs erst einmal ausprobieren?", en: "Can I try a class first?" },
        antwort: {
          de: "Ja. Jede und jeder hat eine kostenlose Probestunde. Du suchst dir beim Kurs den Termin aus, der dir passt — die Buchung ist sofort bestätigt, und du brauchst dafür weder Bankdaten noch eine Mitgliedschaft. Bis zum Vortag kannst du sie selbst umbuchen oder absagen.",
          en: "Yes. Everyone gets one free trial class. Pick the date that suits you when booking the course — it is confirmed straight away, and you need neither bank details nor a membership. You can reschedule or cancel it yourself until the day before.",
        },
      },
      {
        frage: { de: "Was ist ein Drop-in?", en: "What is a drop-in?" },
        antwort: {
          de: "Eine einzelne Stunde ohne Anmeldung für den ganzen Kurs. Den Preis siehst du beim Buchen; bezahlt wird vor Ort, bar oder mit Karte. Studierende zahlen weniger — das Häkchen dafür steht im Buchungsfenster.",
          en: "A single class without signing up for the whole course. You see the price when booking; you pay on site, in cash or by card. Students pay less — tick the box in the booking dialog.",
        },
      },
      {
        frage: { de: "Wie melde ich mich fest für einen Kurs an?", en: "How do I sign up for a course properly?" },
        antwort: {
          de: "Im Buchungsfenster wählst du „Anmeldung\". Dafür brauchst du ein SEPA-Lastschriftmandat in deinem Profil — das hinterlegst du einmal und danach nie wieder. Deine Anfrage schauen wir uns an und bestätigen sie; erst danach läuft dein Platz.",
          en: "Choose “Sign up” in the booking dialog. You need a SEPA direct debit mandate in your profile — you set that up once and never again. We review your request and confirm it; your place starts from then.",
        },
      },
      {
        frage: { de: "Der Kurs ist voll. Was kann ich tun?", en: "The course is full. What can I do?" },
        antwort: {
          de: "Dann steht beim Kurs „Auf die Warteliste\". Wird ein Platz frei, melden wir uns bei dir. Ein Blick auf einen Parallelkurs im Stundenplan lohnt sich oft auch.",
          en: "You will see “Join the waiting list” on the course. We will get in touch when a place opens up. It is often worth looking at a parallel course in the schedule as well.",
        },
      },
    ],
  },
  {
    titel: { de: "Bezahlen, pausieren, kündigen", en: "Paying, pausing, cancelling" },
    eintraege: [
      {
        frage: { de: "Wie wird bezahlt?", en: "How do I pay?" },
        antwort: {
          de: "Per SEPA-Lastschrift von dem Konto, das du in deinem Profil hinterlegt hast. Vor jedem Einzug bekommst du eine Ankündigung mit Betrag und Datum, und jede Rechnung findest du danach in deinem Profil unter „Zahlungen\". Drop-ins zahlst du vor Ort.",
          en: "By SEPA direct debit from the account you set up in your profile. Before every collection you get a notice with the amount and the date, and every invoice is then in your profile under “Payments”. Drop-ins are paid on site.",
        },
      },
      {
        frage: { de: "Kann ich mein Abo pausieren?", en: "Can I pause my membership?" },
        antwort: {
          de: "Ja, selbst und jederzeit in deinem Profil. Die Pause gilt ab dem Ende des laufenden Zyklus — der angefangene ist bereits eingeplant. Bis dahin kannst du sie mit einem Klick wieder zurücknehmen.",
          en: "Yes, yourself and at any time in your profile. The pause takes effect at the end of the current cycle — the one already running is planned for. Until then you can undo it with one click.",
        },
      },
      {
        frage: { de: "Wie kündige ich?", en: "How do I cancel?" },
        antwort: {
          de: "Genauso: in deinem Profil beim jeweiligen Kurs. Auch die Kündigung wird zum Ende des laufenden Zyklus wirksam und lässt sich bis dahin zurücknehmen. Du musst uns dafür nicht schreiben.",
          en: "The same way: in your profile, at the course in question. Cancelling also takes effect at the end of the current cycle and can be undone until then. There is no need to write to us.",
        },
      },
      {
        frage: { de: "Kann ich in einen anderen Kurs wechseln?", en: "Can I switch to a different course?" },
        antwort: {
          de: "Ja, und zwar sofort — nicht erst zum Zyklusende. Dein Preis bleibt dabei unverändert. Den Wechsel machst du selbst in deinem Profil.",
          en: "Yes, and right away — you do not have to wait for the end of a cycle. Your price stays the same. You make the switch yourself in your profile.",
        },
      },
      {
        frage: { de: "Was hat es mit dem Guthaben auf sich?", en: "What is the credit about?" },
        antwort: {
          de: "Empfiehlst du uns weiter und jemand bucht mit deinem Code, bekommt ihr beide 15 € Guthaben, sobald die erste Abbuchung durch ist. Das Guthaben wird beim nächsten Einzug automatisch abgezogen; was übrig bleibt, bleibt stehen. Deinen Code findest du im Profil.",
          en: "If you recommend us and someone books with your code, you both get €15 in credit once their first payment has gone through. The credit is deducted automatically at the next collection; whatever is left stays for the next one. Your code is in your profile.",
        },
      },
    ],
  },
  {
    titel: { de: "Im Kurs", en: "At the studio" },
    eintraege: [
      {
        frage: { de: "Muss ich mich anmelden, wenn ich komme?", en: "Do I need to check in when I arrive?" },
        antwort: {
          de: "Du kannst dich selbst eintragen: Ab sechs Stunden vor Kursbeginn steht bei deinem Termin unter „Mein Bereich\" ein Knopf dafür, bis der Kurs zu Ende ist. Wenn du es vergisst, trägt dich dein Lehrer ein — es geht nichts verloren.",
          en: "You can check yourself in: from six hours before the class starts, a button appears at your class under “My area”, and stays until the class ends. If you forget, your teacher will mark you as present — nothing gets lost.",
        },
      },
      {
        frage: { de: "Brauche ich eine Partnerin oder einen Partner?", en: "Do I need a partner?" },
        antwort: {
          de: "Nein. In den Kursen wird gewechselt, und wir achten beim Anmelden darauf, dass Leader und Follower halbwegs im Gleichgewicht bleiben. Fehlt einmal eine Rolle, laden wir erfahrene Tänzerinnen und Tänzer als Gäste dazu — wenn du selbst einspringen magst, trägst du dich im Profil dafür ein.",
          en: "No. We rotate partners in class, and when people sign up we keep an eye on the balance between leaders and followers. If a role is short, we invite experienced dancers as guests — if you would like to step in yourself, sign up for it in your profile.",
        },
      },
    ],
  },
  {
    titel: { de: "Konto und App", en: "Account and app" },
    eintraege: [
      {
        frage: { de: "Wo finde ich meine Rechnungen?", en: "Where do I find my invoices?" },
        antwort: {
          de: "In deinem Profil unter „Zahlungen\". Dort liegt jede Rechnung als eigene Seite, die du ausdrucken oder als PDF sichern kannst.",
          en: "In your profile under “Payments”. Every invoice has its own page there, which you can print or save as a PDF.",
        },
      },
      {
        frage: { de: "Kann ich einstellen, worüber ihr mich benachrichtigt?", en: "Can I choose what you notify me about?" },
        antwort: {
          de: "Ja, in deinem Profil. Du entscheidest je Art, ob du eine E-Mail willst, und kannst zusätzlich Mitteilungen aufs Handy erlauben. Auf dem iPhone geht das, sobald du die Seite zum Home-Bildschirm hinzugefügt hast.",
          en: "Yes, in your profile. You decide per type whether you want an email, and you can additionally allow notifications on your phone. On iPhone that works once you have added the site to your home screen.",
        },
      },
      {
        frage: { de: "Gibt es die Seite auf Englisch?", en: "Is the site available in German?" },
        antwort: {
          de: "Ja. Oben rechts schaltest du zwischen Deutsch und Englisch um; bist du angemeldet, merkt sich dein Konto die Wahl. Unsere Rechtstexte bleiben rechtlich verbindlich auf Deutsch.",
          en: "Yes. Switch between German and English at the top right; if you are signed in, your account remembers the choice. Our legal texts remain legally binding in German.",
        },
      },
      {
        frage: { de: "Ich habe eine Frage, die hier nicht steht.", en: "My question is not answered here." },
        antwort: {
          de: "Schreib uns an info@viennasalsastudio.at oder ruf an unter +43 678 7826067. Wir antworten meistens am selben Tag.",
          en: "Write to info@viennasalsastudio.at or call +43 678 7826067. We usually reply the same day.",
        },
      },
    ],
  },
];

/** Alle Fragen und Antworten in einer Sprache, flach — für die strukturierten Daten. */
export function faqFlach(sprache: "de" | "en"): { frage: string; antwort: string }[] {
  return FAQ.flatMap((gruppe) =>
    gruppe.eintraege.map((eintrag) => ({
      frage: eintrag.frage[sprache],
      antwort: eintrag.antwort[sprache],
    }))
  );
}
