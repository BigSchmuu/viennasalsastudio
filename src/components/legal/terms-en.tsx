import { Link } from "@/i18n/navigation";

/**
 * Englische Fassung der AGB (PROJ-43).
 *
 * **Eine Übersetzung zur Lesehilfe, kein eigenständiges Rechtsdokument.** Die
 * deutsche Fassung ist die verbindliche; der Hinweis darüber sagt das. Wird der
 * deutsche Text inhaltlich geändert, ist diese Datei nachzuziehen und
 * `AGB_TRANSLATION_VERSION` in src/lib/legal.ts hochzuzählen — bis dahin zeigt
 * die englische Seite den deutschen Text.
 */
export function TermsEn() {
  return (
    <>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">1. Scope</h2>
        <p>
          These terms apply to all class bookings, memberships and ticket purchases made through the Vienna
          Salsa Studio app, offered by Vienna Salsa Studio by Lisa &amp; Samuel OG (see{" "}
          <Link href="/impressum" className="underline">
            Imprint
          </Link>
          ).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">2. Memberships and term</h2>
        <p>
          Class memberships run in rolling 4-week cycles and renew automatically for a further 4 weeks unless
          they are paused or cancelled in time through your customer profile.
        </p>
        <p>
          You can pause or cancel at any time yourself in your customer profile; it takes effect at the end of
          the 4-week cycle currently running. No reason or proof is required. A pause or cancellation you have
          already scheduled can be undone in your profile at any point before it takes effect.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">3. Trial classes and drop-ins</h2>
        <p>
          Trial classes and drop-in sessions can be cancelled or moved free of charge through your customer
          profile up to one day before the booked date. For later cancellations there is no entitlement to a
          refund or to rebooking.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">4. Right of withdrawal in distance contracts</h2>
        <p>
          Class bookings are made at a distance through this app. For services connected with leisure activities
          where the contract provides for performance on a specific date or within a specific period (§ 18 (1)
          no. 10 FAGG) — which applies to our classes with a fixed weekly slot — there is no statutory 14-day
          right of withdrawal. Independently of this, you can pause or cancel your membership at any time in
          accordance with clause 2.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">5. Payment terms</h2>
        <p>
          Memberships are paid by SEPA direct debit on the basis of the mandate given in your customer profile.
          By providing your bank details you authorise us to collect the amounts due. Bank fees arising from a
          returned direct debit will be passed on to you. In the event of late payment, statutory default
          interest of 4% p.a. applies.
        </p>
        <p>Drop-in payments are made in cash or by card directly at the studio.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">6. Account credit</h2>
        <p>
          Credit can arise in two ways: from our referral programme, when someone you referred takes out a
          membership and their first payment has been collected successfully, or as a credit granted by us, for
          example to make up for a cancelled class.
        </p>
        <p>
          Credit is offset against future course fees only: it is deducted automatically from your next
          membership payment, reducing the amount collected accordingly. If your credit exceeds the amount due,
          it is offset down to zero only; the remainder stays on your account and is applied in the following
          months.
        </p>
        <p>
          <strong>Credit cannot be paid out</strong> — neither in cash nor by bank transfer. It is not
          transferable to other people and does not earn interest. If your membership ends, existing credit does
          not expire: it will continue to be offset against your course fees under a later membership. Credit is
          not applied to drop-ins, tickets or events.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">7. Liability</h2>
        <p>
          We are liable only for damage caused intentionally or through gross negligence. We accept no liability
          for the loss of or damage to personal belongings during a class. Participation in dance classes is at
          your own health responsibility.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">8. Final provisions</h2>
        <p>
          Austrian law applies. Should any provision of these terms be invalid, the validity of the remaining
          provisions is unaffected.
        </p>
      </section>
    </>
  );
}
