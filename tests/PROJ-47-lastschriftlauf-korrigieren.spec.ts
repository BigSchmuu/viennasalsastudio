import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.use({ locale: "de-DE" });

/**
 * Eigene Fälligkeitsdaten, weit in der Zukunft.
 *
 * Ein Lauf erfasst jeden abbuchbaren Kunden der Testdatenbank — auch die
 * Fixtures von PROJ-10 und PROJ-36. Deshalb bekommt jede Prüfung ihr eigenes
 * Datum, und am Ende wird alles weggeräumt, was zu diesen Daten gehört.
 */
const DATUM = {
  entwurf: "2029-05-01",
  betrag: "2029-05-02",
  entfernen: "2029-05-03",
  hinzufuegen: "2029-05-04",
  verwerfen: "2029-05-05",
  freigabe: "2029-05-06",
  gesperrt: "2029-05-07",
  rechte: "2029-05-08",
  guthaben: "2029-05-09",
  // Bewusst in der Vergangenheit: der vergessene Entwurf.
  ueberfaellig: "2026-01-15",
};
const ALLE_DATEN = Object.values(DATUM);

function anzeige(datum: string): string {
  return new Date(datum).toLocaleDateString("de-AT");
}

/** Räumt alles weg, was zu den Prüfdaten gehört — Guthaben zuerst. */
async function aufraeumen() {
  const { data: laeufe } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .in("due_date", ALLE_DATEN);
  const laufIds = (laeufe ?? []).map((l) => l.id);
  if (laufIds.length === 0) return;

  const { data: positionen } = await svc
    .from("sepa_collection_items")
    .select("id")
    .in("run_id", laufIds);
  const posIds = (positionen ?? []).map((p) => p.id);

  if (posIds.length > 0) {
    // Rechnungen hängen an den Positionen, Guthabenzeilen ebenso.
    await svc.from("invoices").delete().in("collection_item_id", posIds);
    await svc.from("customer_credits").delete().in("collection_item_id", posIds);
    await svc.from("sepa_collection_items").delete().in("id", posIds);
  }
  for (const id of laufIds) {
    await svc.from("notification_queue").delete().like("dedupe_key", `%${id}`);
  }
  await svc.from("sepa_collection_runs").delete().in("id", laufIds);
  await svc.from("customer_credits").delete().eq("reason", "PROJ47-Pruefung");
}

test.beforeAll(aufraeumen);
test.afterAll(aufraeumen);

async function login(page: Page, creds: { email: string; password: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Legt über die Oberfläche einen Lauf an und landet auf seiner Detailseite. */
async function legeLaufAn(page: Page, datum: string) {
  await page.goto("/admin/lastschriften");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.locator("#due-date").fill(datum);
  await page.getByRole("button", { name: "Lauf erstellen" }).click();
  await page.waitForURL(/\/admin\/lastschriften\/.+/, { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function laufId(datum: string): Promise<string> {
  const { data } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", datum)
    .single();
  return data!.id;
}

async function freigeben(page: Page) {
  await page.getByRole("button", { name: "Lauf freigeben" }).click();
  await page.getByRole("button", { name: "Freigeben" }).click();
  await page.waitForTimeout(3000);
}

test.describe("PROJ-47: Lastschriftlauf vor dem Bankupload korrigieren", () => {
  test("AC Entwurf: ein neuer Lauf ist ein Entwurf — ohne Rechnungen, ohne Nachricht, ohne Bankdatei", async ({
    page,
  }) => {
    const rechnungenVorher = (await svc.from("invoices").select("id", { count: "exact", head: true }))
      .count;

    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.entwurf);

    await expect(page.getByText("Entwurf").first()).toBeVisible();
    await expect(
      page.getByText("es wurden noch keine Rechnungen erstellt und niemand benachrichtigt")
    ).toBeVisible();

    // Keine Bankdatei im Entwurf — sie könnte sonst bei der Bank landen,
    // während die Anwendung den Lauf für änderbar hält.
    await expect(page.getByRole("button", { name: "SEPA-XML herunterladen" })).toHaveCount(0);
    // Und keine Rücklastschrift-Markierung: eingezogen wurde noch nichts.
    await expect(page.getByRole("button", { name: /rückgebucht markieren/ })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Position hinzufügen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entwurf verwerfen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lauf freigeben" })).toBeVisible();

    const id = await laufId(DATUM.entwurf);
    const rechnungenNachher = (await svc.from("invoices").select("id", { count: "exact", head: true }))
      .count;
    expect(rechnungenNachher, "Ein Entwurf darf keine Rechnung erzeugen").toBe(rechnungenVorher);

    const { count: nachrichten } = await svc
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .like("dedupe_key", `%${id}`);
    expect(nachrichten, "Ein Entwurf darf niemanden benachrichtigen").toBe(0);
  });

  test("AC Betrag: ändern wirkt auf Liste und Summe, Null und Vertipper werden abgewiesen", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.betrag);

    const zeile = page.getByRole("row").filter({ hasText: "€" }).first();
    await zeile.getByRole("button", { name: "Betrag ändern" }).click();
    await expect(page.getByRole("heading", { name: "Betrag ändern" })).toBeVisible();

    const absenden = page.getByRole("button", { name: "Betrag ändern", exact: true }).last();

    await page.getByLabel("Neuer Betrag").fill("0");
    await page.waitForTimeout(300);
    await expect(absenden, "Null darf nicht abschickbar sein").toBeDisabled();

    await page.getByLabel("Neuer Betrag").fill("4500");
    await page.waitForTimeout(300);
    await expect(page.locator("p.text-destructive").filter({ hasText: "Höchstens" })).toBeVisible();
    await expect(absenden, "Der Vertipper 4500 statt 45,00 darf nicht durchgehen").toBeDisabled();

    await page.getByLabel("Neuer Betrag").fill("12,34");
    await page.waitForTimeout(300);
    await absenden.click();
    await page.waitForTimeout(2500);

    const id = await laufId(DATUM.betrag);
    const { data: positionen } = await svc
      .from("sepa_collection_items")
      .select("amount")
      .eq("run_id", id);
    expect(
      positionen!.some((p) => Number(p.amount) === 12.34),
      "Der geänderte Betrag steht nicht in der Datenbank"
    ).toBe(true);

    await expect(page.getByText("12,34")).toBeVisible();
  });

  test("AC Entfernen: die Position verschwindet aus Liste und Summe", async ({ page }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.entfernen);

    const id = await laufId(DATUM.entfernen);
    const { count: vorher } = await svc
      .from("sepa_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", id);
    expect(vorher, "Der Lauf braucht Positionen für diese Prüfung").toBeGreaterThan(1);

    await page.getByRole("row").filter({ hasText: "€" }).first()
      .getByRole("button", { name: "Entfernen" }).click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { count: nachher } = await svc
      .from("sepa_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", id);
    expect(nachher).toBe(vorher! - 1);
  });

  test("AC Hinzufügen: die Auswahl zeigt nur, was der Lauf noch nicht erfasst hat", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.hinzufuegen);

    const id = await laufId(DATUM.hinzufuegen);

    // Erst eine Position entfernen — dann muss genau sie in der Auswahl auftauchen.
    await page.getByRole("row").filter({ hasText: "€" }).first()
      .getByRole("button", { name: "Entfernen" }).click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { count: nachEntfernen } = await svc
      .from("sepa_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", id);

    await page.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByRole("heading", { name: "Position hinzufügen" })).toBeVisible();

    // Genau ein Eintrag: der eben entfernte. Alles andere steht im Lauf.
    const auswahl = page.getByRole("radio");
    await expect(auswahl).toHaveCount(1);

    await auswahl.first().click();
    await page.waitForTimeout(400);
    await expect(page.getByLabel("Betrag"), "Der Betrag muss vorbelegt sein").not.toHaveValue("");

    await page.getByLabel("Betrag").fill("33,00");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Hinzufügen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: danach } = await svc
      .from("sepa_collection_items")
      .select("amount, subscription_id, event_ticket_id")
      .eq("run_id", id);
    expect(danach!.length).toBe(nachEntfernen! + 1);
    expect(danach!.some((p) => Number(p.amount) === 33), "Der eingegebene Betrag zählt").toBe(true);
    // Der Bezug bleibt erhalten — daran hängen Rechnungstext und Verrechnung.
    expect(
      danach!.every((p) => p.subscription_id !== null || p.event_ticket_id !== null),
      "Jede Position braucht einen Bezug"
    ).toBe(true);
  });

  test("AC Verwerfen: Lauf und Positionen sind weg", async ({ page }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.verwerfen);
    const id = await laufId(DATUM.verwerfen);

    await page.getByRole("button", { name: "Entwurf verwerfen" }).click();
    await page.getByRole("button", { name: "Verwerfen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { count: laeufe } = await svc
      .from("sepa_collection_runs")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(laeufe).toBe(0);

    const { count: positionen } = await svc
      .from("sepa_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", id);
    expect(positionen).toBe(0);
  });

  test("AC Freigabe: Bestätigung nennt Anzahl und Summe, danach entstehen Rechnungen und Ankündigungen", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.freigabe);
    const id = await laufId(DATUM.freigabe);

    const { data: positionen } = await svc
      .from("sepa_collection_items")
      .select("id, amount")
      .eq("run_id", id);
    const anzahl = positionen!.length;
    const summe = positionen!.reduce((s, p) => s + Number(p.amount), 0);

    const rechnungenVorher = (await svc.from("invoices").select("id", { count: "exact", head: true }))
      .count;

    await page.getByRole("button", { name: "Lauf freigeben" }).click();
    await expect(page.getByRole("heading", { name: "Lauf freigeben?" })).toBeVisible();
    await expect(page.getByText(`aus ${anzahl} Positionen`)).toBeVisible();
    // Die Summe steht auch im Kopf der Seite — gemeint ist die im Dialog.
    await expect(
      page
        .getByRole("alertdialog")
        .getByText(summe.toLocaleString("de-AT", { minimumFractionDigits: 2 }))
    ).toBeVisible();

    await page.getByRole("button", { name: "Freigeben" }).click();
    await page.waitForTimeout(3000);

    const { data: lauf } = await svc
      .from("sepa_collection_runs")
      .select("released_at, released_by")
      .eq("id", id)
      .single();
    expect(lauf!.released_at, "Der Lauf ist nicht freigegeben").not.toBeNull();
    expect(lauf!.released_by, "Der Freigeber ist nicht vermerkt").not.toBeNull();

    const rechnungenNachher = (await svc.from("invoices").select("id", { count: "exact", head: true }))
      .count;
    expect(rechnungenNachher! - rechnungenVorher!).toBe(anzahl);

    const { count: nachrichten } = await svc
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .like("dedupe_key", `%${id}`);
    expect(nachrichten).toBe(anzahl);

    // Erst jetzt gibt es die Bankdatei, und die Korrekturen sind fort.
    await expect(page.getByRole("button", { name: "SEPA-XML herunterladen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lauf freigeben" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Entwurf verwerfen" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Betrag ändern" })).toHaveCount(0);
    await expect(page.getByText("Freigegeben am")).toBeVisible();
  });

  test("AC Freigabe: ein freigegebener Lauf lässt sich auch über die Schnittstelle nicht mehr ändern", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.gesperrt);
    const id = await laufId(DATUM.gesperrt);
    await freigeben(page);

    const { data: position } = await svc
      .from("sepa_collection_items")
      .select("id")
      .eq("run_id", id)
      .limit(1)
      .single();

    // Der Admin ist die einzige Rolle mit Schreibrecht — hier greift der
    // Wächter, nicht RLS.
    const alsAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await alsAdmin.auth.signInWithPassword(ADMIN);

    const { error: betrag } = await alsAdmin
      .from("sepa_collection_items")
      .update({ amount: 1 })
      .eq("id", position!.id);
    expect(betrag, "Der Betrag ließ sich nach der Freigabe ändern").toBeTruthy();

    const { error: nochmal } = await alsAdmin.rpc("release_collection_run", { p_run_id: id });
    expect(nochmal, "Der Lauf ließ sich zweimal freigeben").toBeTruthy();
    expect(nochmal!.message).toContain("already released");

    // Die Rücklastschrift muss weiter markierbar bleiben — daran hängen die
    // offenen Posten.
    const { error: bounce } = await alsAdmin
      .from("sepa_collection_items")
      .update({ bounced_at: new Date().toISOString() })
      .eq("id", position!.id);
    expect(bounce, "Die Rücklastschrift ließ sich nicht mehr markieren").toBeNull();
    await alsAdmin.from("sepa_collection_items").update({ bounced_at: null }).eq("id", position!.id);

    await alsAdmin.auth.signOut();
  });

  test("Edge Case: Guthaben wird bei jeder Korrektur zurückgegeben und neu verrechnet", async ({
    page,
  }) => {
    // Ein Kunde mit Abo und Mandat bekommt Guthaben, das seinen Beitrag
    // übersteigt — genau der Fall, an dem die naive Differenzrechnung scheitert.
    const { data: mandate } = await svc
      .from("sepa_mandates")
      .select("customer_id")
      .is("revoked_at", null);
    const { data: abos } = await svc
      .from("subscriptions")
      .select("customer_id, price")
      .eq("status", "active")
      .not("price", "is", null);
    const treffer = (abos ?? []).find((a) =>
      (mandate ?? []).some((m) => m.customer_id === a.customer_id)
    );
    expect(treffer, "Kein Kunde mit Abo und Mandat in der Testdatenbank").toBeTruthy();

    const { data: guthaben } = await svc
      .from("customer_credits")
      .insert({
        customer_id: treffer!.customer_id,
        amount: Number(treffer!.price) + 50,
        origin: "manual",
        reason: "PROJ47-Pruefung",
      })
      .select("id")
      .single();

    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.guthaben);
    const id = await laufId(DATUM.guthaben);

    const { data: position } = await svc
      .from("sepa_collection_items")
      .select("id, amount")
      .eq("run_id", id)
      .eq("customer_id", treffer!.customer_id)
      .single();

    // Das Guthaben deckt den Beitrag vollständig: Der Betrag muss auf 0 sinken
    // — genau das ging vor PROJ-47 stillschweigend daneben.
    expect(Number(position!.amount), "Der Betrag hätte auf 0 sinken müssen").toBe(0);

    const { data: standNachAnlegen } = await svc.rpc("customer_credit_balance", {
      p_customer_id: treffer!.customer_id,
    });
    expect(Number(standNachAnlegen)).toBe(50);

    // Position entfernen: das verrechnete Guthaben kommt vollständig zurück.
    //
    // Die Zeile wird über den Kundennamen gewählt, nicht über den Betrag:
    // „0,00" trifft als Teilzeichenkette auch „€ 30,00", und der Test entfernte
    // dann die Position eines fremden Kunden.
    const { data: profil } = await svc
      .from("profiles")
      .select("full_name")
      .eq("id", treffer!.customer_id)
      .single();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await page
      .getByRole("row")
      .filter({ hasText: profil!.full_name! })
      .getByRole("button", { name: "Entfernen" })
      .click();
    await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: standNachEntfernen } = await svc.rpc("customer_credit_balance", {
      p_customer_id: treffer!.customer_id,
    });
    expect(
      Number(standNachEntfernen),
      "Das verrechnete Guthaben muss vollständig zurückkommen"
    ).toBe(Number(treffer!.price) + 50);

    await svc.from("customer_credits").delete().eq("id", guthaben!.id);
  });

  test("Sicherheit: Kunde und Lehrkraft dürfen weder freigeben noch Guthaben zurückgeben", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await legeLaufAn(page, DATUM.rechte);
    const id = await laufId(DATUM.rechte);
    const { data: position } = await svc
      .from("sepa_collection_items")
      .select("id")
      .eq("run_id", id)
      .limit(1)
      .single();

    for (const zugang of [KUNDE, LEHRER]) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { error: loginFehler } = await client.auth.signInWithPassword(zugang);
      expect(loginFehler).toBeNull();

      const { error: freigabe } = await client.rpc("release_collection_run", { p_run_id: id });
      expect(freigabe, `${zugang.email} konnte freigeben`).toBeTruthy();
      expect(freigabe!.message).toContain("not authorized");

      const { error: rueckgabe } = await client.rpc("return_collection_item_credit", {
        p_collection_item_id: position!.id,
      });
      expect(rueckgabe, `${zugang.email} konnte Guthaben zurückgeben`).toBeTruthy();
      expect(rueckgabe!.message).toContain("not authorized");

      await client.auth.signOut();
    }

    // Und der Lauf ist unberührt geblieben.
    const { data: lauf } = await svc
      .from("sepa_collection_runs")
      .select("released_at")
      .eq("id", id)
      .single();
    expect(lauf!.released_at).toBeNull();
  });

  test("Ein Entwurf mit verstrichener Fälligkeit wird gewarnt, aber nicht gesperrt", async ({
    page,
  }) => {
    // Direkt angelegt statt über die Oberfläche: Ein Lauf mit vergangenem
    // Datum ist genau der Fall, den niemand absichtlich erzeugt.
    // Nicht einfach das erste Mandat: Nicht jeder Mandatsinhaber hat ein Abo,
    // und eine Position braucht genau eine Quelle.
    const { data: mandate } = await svc
      .from("sepa_mandates")
      .select("customer_id, iban, account_holder_name, mandate_reference")
      .is("revoked_at", null);
    const { data: abos } = await svc.from("subscriptions").select("id, price, customer_id");
    const mandat = (mandate ?? []).find((m) =>
      (abos ?? []).some((a) => a.customer_id === m.customer_id)
    );
    expect(mandat, "Kein Kunde mit Mandat und Abo in der Testdatenbank").toBeTruthy();
    const abo = (abos ?? []).find((a) => a.customer_id === mandat!.customer_id)!;

    const { data: lauf } = await svc
      .from("sepa_collection_runs")
      .insert({ due_date: DATUM.ueberfaellig })
      .select("id")
      .single();
    await svc.from("sepa_collection_items").insert({
      run_id: lauf!.id,
      customer_id: mandat!.customer_id,
      subscription_id: abo.id,
      amount: Number(abo.price) || 45,
      iban: mandat!.iban,
      account_holder_name: mandat!.account_holder_name,
      mandate_reference: mandat!.mandate_reference,
    });

    await login(page, ADMIN);

    // In der Übersicht sichtbar — dort, wo jemand den vergessenen Entwurf
    // überhaupt bemerken kann.
    await page.goto("/admin/lastschriften?status=entwurf");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(page.getByText("Fälligkeit verstrichen").first()).toBeVisible();

    await page.goto(`/admin/lastschriften/${lauf!.id}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(page.getByText("Das Fälligkeitsdatum dieses Entwurfs ist verstrichen")).toBeVisible();

    // Gewarnt, nicht gesperrt: Alle Aktionen bleiben verfügbar.
    await expect(page.getByRole("button", { name: "Lauf freigeben" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Position hinzufügen" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Entwurf verwerfen" })).toBeEnabled();

    // Und die Freigabe geht wirklich durch.
    await freigeben(page);
    const { data: danach } = await svc
      .from("sepa_collection_runs")
      .select("released_at")
      .eq("id", lauf!.id)
      .single();
    expect(danach!.released_at, "Ein überfälliger Entwurf muss freigebbar bleiben").not.toBeNull();

    // Nach der Freigabe ist die Warnung fort — sie gilt nur für Entwürfe.
    await expect(page.getByText("Das Fälligkeitsdatum dieses Entwurfs ist verstrichen")).toHaveCount(
      0
    );
  });

  test("Die Übersicht kennzeichnet Entwürfe und lässt nach ihnen filtern", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften?status=entwurf");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Aus den Prüfungen davor stehen mehrere Entwürfe in der Liste.
    const { data: entwuerfe } = await svc
      .from("sepa_collection_runs")
      .select("due_date")
      .is("released_at", null);
    expect(entwuerfe!.length, "Für diese Prüfung braucht es Entwürfe").toBeGreaterThan(0);

    for (const entwurf of entwuerfe!) {
      await expect(page.getByText(anzeige(entwurf.due_date)).first()).toBeVisible();
    }

    // Ein freigegebener Lauf darf hier nicht auftauchen.
    const { data: freigegeben } = await svc
      .from("sepa_collection_runs")
      .select("due_date")
      .not("released_at", "is", null)
      .limit(1);
    if (freigegeben?.length) {
      await expect(page.getByText(anzeige(freigegeben[0].due_date))).toHaveCount(0);
    }
  });
});
