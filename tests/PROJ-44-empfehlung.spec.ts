import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
try { process.loadEnvFile(".env.local"); } catch {}

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Was check_coupon_code zurückgibt — der Testclient kennt das Schema nicht. */
type CodePruefung = {
  valid: boolean;
  code_kind: string | null;
  discount_type: string | null;
  discount_amount: number | null;
  rate_limited: boolean;
};

async function kundeMit(mail: string) {
  const { data } = await svc.auth.admin.listUsers({ perPage: 300 });
  return data.users.find((u) => u.email === mail)!.id;
}

async function anmelden(page: import("@playwright/test").Page, mail: string, ziel = /\/(profil|admin)$/) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(mail);
  await page.getByLabel("Passwort").fill("CorrectPassword123!");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(ziel, { timeout: 15000 });
}

test.describe("PROJ-44: Empfehlungsprogramm", () => {
  test.use({ locale: "de-DE" });

  test("Der Kunde findet seinen Code im Profil und kann ihn kopieren", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const kunde = await kundeMit("e2e12-a@viennasalsastudio.test");
    const { data: p } = await svc.from("profiles").select("referral_code").eq("id", kunde).single();
    expect(p!.referral_code).toMatch(/^VSS-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    await anmelden(page, "e2e12-a@viennasalsastudio.test", /\/profil$/);
    await page.getByRole("button", { name: "Empfehlen und Guthaben" }).click();
    await page.waitForTimeout(700);
    await expect(page.getByText(p!.referral_code!)).toBeVisible();
    await expect(page.getByText("du € 15,00, dein Freund € 15,00")).toBeVisible();

    await page.getByRole("button", { name: "Kopieren" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: "Kopiert" })).toBeVisible();
    const inZwischenablage = await page.evaluate(() => navigator.clipboard.readText());
    expect(inZwischenablage).toBe(p!.referral_code);
  });

  test("Zwei Kunden haben verschiedene, nicht erratbare Codes", async () => {
    const { data } = await svc.from("profiles").select("referral_code").eq("role", "customer");
    const codes = data!.map((d) => d.referral_code);
    expect(codes.every((c) => c !== null)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    // Kein Code enthält O, 0, I, 1 oder L — sie werden abgetippt.
    expect(codes.every((c) => !/[O0I1L]/.test(c!.slice(4)))).toBe(true);
  });

  test("Der eigene Code wird nicht anerkannt", async () => {
    const kunde = await kundeMit("e2e12-a@viennasalsastudio.test");
    const { data: p } = await svc.from("profiles").select("referral_code").eq("id", kunde).single();
    await svc.from("profiles").update({ referred_by: null }).eq("id", kunde);

    // Mit der Anmeldung des Kunden selbst — so, wie es das Buchungsfeld tut:
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: sess } = await anon.auth.signInWithPassword({
      email: "e2e12-a@viennasalsastudio.test",
      password: "CorrectPassword123!",
    });
    const alsKunde = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess.session!.access_token}` } },
    });
    const { data: pruefung } = await alsKunde.rpc("check_coupon_code", { p_code: p!.referral_code! }).maybeSingle<CodePruefung>();
    expect(pruefung!.valid).toBe(false);
  });

  test("Ein fremder Code wird erkannt, ein Bestandskunde bekommt ihn nicht", async () => {
    const werber = await kundeMit("e2e12-a@viennasalsastudio.test");
    const { data: w } = await svc.from("profiles").select("referral_code").eq("id", werber).single();

    // Ein Kunde ohne Abo
    const { data: users } = await svc.auth.admin.listUsers({ perPage: 300 });
    const { data: mitAbo } = await svc.from("subscriptions").select("customer_id");
    const kundenMitAbo = new Set(mitAbo!.map((s) => s.customer_id));
    const frisch = users.users.find(
      (u) => u.email?.includes("viennasalsastudio.test") && u.id !== werber && !kundenMitAbo.has(u.id)
    )!;
    await svc.from("profiles").update({ referred_by: null }).eq("id", frisch.id);

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: sess, error } = await anon.auth.signInWithPassword({
      email: frisch.email!,
      password: "CorrectPassword123!",
    });
    if (error) test.skip(true, "Kein anmeldbarer Kunde ohne Abo verfügbar");
    const alsFrisch = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess!.session!.access_token}` } },
    });
    const { data: pruefung } = await alsFrisch.rpc("check_coupon_code", { p_code: w!.referral_code! }).maybeSingle<CodePruefung>();
    console.log("Fremder Code für Kunden ohne Abo:", JSON.stringify(pruefung));
    expect(pruefung!.valid).toBe(true);
    expect(pruefung!.code_kind).toBe("referral");
    expect(Number(pruefung!.discount_amount)).toBe(15);

    // Derselbe Code für einen Kunden MIT Abo
    const mitAboKunde = users.users.find((u) => kundenMitAbo.has(u.id) && u.email?.includes(".test"))!;
    const { data: sess2, error: e2 } = await anon.auth.signInWithPassword({
      email: mitAboKunde.email!,
      password: "CorrectPassword123!",
    });
    if (e2) return;
    const alsBestand = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess2!.session!.access_token}` } },
    });
    const { data: pruefung2 } = await alsBestand.rpc("check_coupon_code", { p_code: w!.referral_code! }).maybeSingle<CodePruefung>();
    console.log("Derselbe Code für einen Bestandskunden:", JSON.stringify(pruefung2));
    expect(pruefung2!.valid).toBe(false);
  });

  test("Der Betreiber pflegt beide Beträge bei den Preisen", async ({ page }) => {
    await anmelden(page, "e2e8-admin@viennasalsastudio.test");
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(1500);
    await expect(page.getByText("Empfehlungsguthaben", { exact: true })).toBeVisible();
    await expect(page.locator("#referral-reward-referrer")).toHaveValue("15");
    await expect(page.locator("#referral-reward-referee")).toHaveValue("15");

    // Auf 0 setzen schaltet das Programm ab; danach wieder zurück.
    await page.locator("#referral-reward-referrer").fill("0");
    await page.locator("#referral-reward-referee").fill("0");
    await page.getByRole("button", { name: "Speichern" }).first().click();
    await page.waitForTimeout(2000);
    const { data: aus } = await svc.from("dropin_pricing").select("referral_reward_referrer").limit(1).single();
    expect(Number(aus!.referral_reward_referrer)).toBe(0);

    await page.locator("#referral-reward-referrer").fill("15");
    await page.locator("#referral-reward-referee").fill("15");
    await page.getByRole("button", { name: "Speichern" }).first().click();
    await page.waitForTimeout(2000);
    const { data: an } = await svc.from("dropin_pricing").select("referral_reward_referrer").limit(1).single();
    expect(Number(an!.referral_reward_referrer)).toBe(15);
  });
});

test.describe("PROJ-44: von der Buchung bis zur Gutschrift", () => {
  test.use({ locale: "de-DE" });

  test("Belohnung erst nach der ersten erfolgreichen Abbuchung, dann verrechnet und angekündigt", async ({ page }) => {
    const werber = await kundeMit("e2e12-a@viennasalsastudio.test");
    const { data: w } = await svc.from("profiles").select("referral_code").eq("id", werber).single();

    // Ein Geworbener mit aktivem Abo und Mandat, damit der Lauf ihn erfasst.
    const { data: abos } = await svc
      .from("subscriptions")
      .select("id, customer_id, price, profiles!inner(full_name)")
      .eq("status", "active")
      .not("price", "is", null)
      .limit(50);
    const { data: mandate } = await svc.from("sepa_mandates").select("customer_id").is("revoked_at", null);
    const mitMandat = new Set(mandate!.map((m) => m.customer_id));
    const geworben = abos!.find((a) => a.customer_id !== werber && mitMandat.has(a.customer_id));
    test.skip(!geworben, "Kein E2E-Kunde mit Abo und Mandat verfügbar");

    const gid = geworben!.customer_id;
    await svc.from("customer_credits").delete().in("customer_id", [werber, gid]);
    await svc.from("profiles").update({ referred_by: werber, referral_rewarded_at: null }).eq("id", gid);
    await svc.from("notification_queue").delete().eq("customer_id", werber).eq("event_type", "empfehlung");

    // 1. Lauf: die erste Lastschrift des Geworbenen, in der Vergangenheit.
    const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data: lauf1 } = await svc.from("sepa_collection_runs").insert({ due_date: gestern }).select("id").single();
    const { data: pos1 } = await svc
      .from("sepa_collection_items")
      .insert({
        run_id: lauf1!.id, customer_id: gid, subscription_id: geworben!.id, amount: geworben!.price!,
        iban: "AT611904300234573201", account_holder_name: "Test", mandate_reference: "E2E44-" + Date.now(),
      })
      .select("id").single();

    // 2. Lauf über die Oberfläche des Betreibers — hier soll die Belohnung entstehen.
    await anmelden(page, "e2e8-admin@viennasalsastudio.test");
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(1500);
    const faellig = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(faellig);
    await page.getByRole("button", { name: /Lauf erstellen|Erstellen|Anlegen/ }).first().click();
    await page.waitForTimeout(6000);
    const bestaetigen = page.getByRole("button", { name: /Trotzdem|Fortfahren/ });
    if (await bestaetigen.count()) { await bestaetigen.first().click(); await page.waitForTimeout(6000); }

    const { data: gutschriften } = await svc
      .from("customer_credits").select("customer_id, amount, origin").in("customer_id", [werber, gid]);
    console.log("GUTSCHRIFTEN:", JSON.stringify(gutschriften));
    expect(gutschriften!.filter((g) => g.origin === "referral" && Number(g.amount) === 15).length).toBe(2);

    const { data: markiert } = await svc.from("profiles").select("referral_rewarded_at").eq("id", gid).single();
    expect(markiert!.referral_rewarded_at).not.toBeNull();

    // Der Werbende wird benachrichtigt, mit Betrag und neuem Kontostand.
    const { data: nachricht } = await svc
      .from("notification_queue").select("payload").eq("dedupe_key", `empfehlung:${gid}`).maybeSingle();
    console.log("NACHRICHT:", JSON.stringify(nachricht?.payload));
    expect(nachricht).not.toBeNull();
    expect(Number((nachricht!.payload as Record<string, number>).amount)).toBe(15);

    // Das frische Guthaben mindert schon diesen Lauf, und die Ankündigung
    // nennt den geminderten Betrag.
    const { data: lauf2 } = await svc
      .from("sepa_collection_runs").select("id").eq("due_date", faellig).order("created_at", { ascending: false }).limit(1).single();
    // Der Kunde kann mehrere Positionen im Lauf haben — gemeint ist die zu
    // seinem Abo, denn nur Abo-Positionen werden mit Guthaben verrechnet.
    const { data: pos2 } = await svc
      .from("sepa_collection_items")
      .select("id, amount, customer_id")
      .eq("run_id", lauf2!.id)
      .eq("subscription_id", geworben!.id)
      .single();
    expect(pos2).not.toBeNull();
    {
      console.log("POSITION DES GEWORBENEN:", geworben!.price, "→", pos2!.amount);
      expect(Number(pos2!.amount)).toBe(Number(geworben!.price) - 15);
      // Genau die Ankündigung zu diesem Lauf, nicht die neueste überhaupt:
      // Auf der Produktionsdatenbank kann jederzeit ein anderer Lauf
      // dazwischenkommen, und dann prüfte der Test etwas anderes als er sagt.
      const { data: ank } = await svc
        .from("notification_queue").select("payload")
        .eq("dedupe_key", `sepa_item:${geworben!.id}:${lauf2!.id}`).single();
      console.log("ANKÜNDIGUNG:", JSON.stringify(ank!.payload));
      expect(Number((ank!.payload as Record<string, number>).amount)).toBe(Number(pos2!.amount));

      const { data: rechnung } = await svc
        .from("invoices").select("description, gross_amount").eq("collection_item_id", pos2!.id).maybeSingle();
      console.log("RECHNUNG:", JSON.stringify(rechnung));
      expect(rechnung!.description).toContain("15,00 € Guthaben verrechnet");
    }

    // Aufräumen
    await svc.from("invoices").delete().in("collection_item_id", [pos1!.id, pos2?.id ?? pos1!.id]);
    const { data: alleP } = await svc.from("sepa_collection_items").select("id").eq("run_id", lauf2!.id);
    await svc.from("invoices").delete().in("collection_item_id", alleP!.map((p) => p.id));
    await svc.from("customer_credits").delete().in("customer_id", [werber, gid]);
    await svc.from("sepa_collection_items").delete().eq("run_id", lauf2!.id);
    await svc.from("sepa_collection_items").delete().eq("id", pos1!.id);
    await svc.from("sepa_collection_runs").delete().in("id", [lauf1!.id, lauf2!.id]);
    await svc.from("profiles").update({ referred_by: null, referral_rewarded_at: null }).eq("id", gid);
    await svc.from("notification_queue").delete().eq("event_type", "empfehlung");
  });
});

test.describe("PROJ-44: der Kunde kann sich kein Guthaben verschaffen", () => {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  async function alsKunde(mail: string) {
    const anon = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: mail, password: "CorrectPassword123!" });
    if (error) throw error;
    return {
      id: data.session!.user.id,
      client: createClient(URL, KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } },
      }),
    };
  }

  test("Er kann seine Belohnung nicht zurücksetzen und sie so erneut kassieren", async () => {
    const { id, client } = await alsKunde("e2e12-a@viennasalsastudio.test");
    const vorher = new Date().toISOString();
    await svc.from("profiles").update({ referral_rewarded_at: vorher }).eq("id", id);

    const versuch = await client.from("profiles").update({ referral_rewarded_at: null }).eq("id", id).select();
    expect(versuch.error).not.toBeNull();

    const { data: stand } = await svc.from("profiles").select("referral_rewarded_at").eq("id", id).single();
    expect(stand!.referral_rewarded_at).not.toBeNull();
    await svc.from("profiles").update({ referral_rewarded_at: null }).eq("id", id);
  });

  test("Er kann sich weder einen Werbenden noch einen Wunschcode eintragen", async () => {
    const { id, client } = await alsKunde("e2e12-a@viennasalsastudio.test");
    const { data: vorher } = await svc.from("profiles").select("referral_code, referred_by").eq("id", id).single();

    const fremd = (await svc.from("profiles").select("id").eq("role", "customer").neq("id", id).limit(1).single()).data!;
    expect((await client.from("profiles").update({ referred_by: fremd.id }).eq("id", id).select()).error).not.toBeNull();
    expect((await client.from("profiles").update({ referral_code: "VSS-WUNSCH" }).eq("id", id).select()).error).not.toBeNull();

    const { data: nachher } = await svc.from("profiles").select("referral_code, referred_by").eq("id", id).single();
    expect(nachher).toEqual(vorher);
  });

  test("Was er darf, darf er weiterhin — Name, Telefon, Sprache", async () => {
    const { id, client } = await alsKunde("e2e12-a@viennasalsastudio.test");
    const r = await client.from("profiles").update({ full_name: "E2E12 A", language: "de" }).eq("id", id).select();
    expect(r.error).toBeNull();
    expect(r.data!.length).toBe(1);
  });

  test("Er sieht keine fremden Empfehlungscodes", async () => {
    const { id, client } = await alsKunde("e2e12-a@viennasalsastudio.test");
    const { data } = await client.from("profiles").select("id, referral_code").neq("id", id);
    expect(data!.length).toBe(0);
  });

  test("Eine echte Buchung mit fremdem Code setzt die Zuordnung", async () => {
    const werber = await kundeMit("e2e12-a@viennasalsastudio.test");
    const { data: w } = await svc.from("profiles").select("referral_code").eq("id", werber).single();

    // Ein eigener Neukunde: Das Programm gilt nur fuer Neukunden, und ein
    // vorhandener Testkunde kann laengst ein Abo haben — dann wuerde der Test
    // etwas anderes messen als er behauptet.
    const mail = `e2e44-neu-${Date.now()}@viennasalsastudio.test`;
    const { data: angelegt, error: anlageFehler } = await svc.auth.admin.createUser({
      email: mail, password: "CorrectPassword123!", email_confirm: true,
    });
    expect(anlageFehler).toBeNull();
    const id = angelegt!.user!.id;
    await svc.from("profiles").upsert({ id, full_name: "E2E44 Neukunde", role: "customer" });

    const anon = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.signInWithPassword({ email: mail, password: "CorrectPassword123!" });
    const client = createClient(URL, KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess!.session!.access_token}` } },
    });

    // Der Neukunde hat selbst einen Code bekommen, ohne Zutun.
    const { data: eigen } = await svc.from("profiles").select("referral_code").eq("id", id).single();
    expect(eigen!.referral_code).toMatch(/^VSS-/);

    const { data: kurse } = await svc
      .from("courses").select("id, name, role_query_enabled").is("prerequisite_note", null).limit(40);
    const termin = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    let buchung: { id: string } | null = null;
    for (const k of kurse!) {
      const r = await client.rpc("create_regular_course_booking", {
        p_course_id: k.id, p_desired_plan: "single_course", p_chosen_date: termin, p_note: null,
        p_prerequisite_confirmed: false, p_dance_role: k.role_query_enabled ? "leader" : null,
        p_coupon_code: w!.referral_code, p_wants_student_price: false,
        p_terms_accepted: true, p_terms_version: "2026-08",
      });
      if (!r.error) { buchung = r.data as { id: string }; break; }
    }
    expect(buchung, "kein buchbarer Kurs gefunden").not.toBeNull();

    const { data: nachher } = await svc.from("profiles").select("referred_by").eq("id", id).single();
    expect(nachher!.referred_by).toBe(werber);

    await svc.from("course_bookings").delete().eq("id", buchung!.id);
    await svc.auth.admin.deleteUser(id);
  });
});
