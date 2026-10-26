import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

/**
 * PROJ-94: Vorname, Nachname und der zusammengesetzte Name.
 *
 * Die wichtigste Prüfung hier ist die unscheinbarste: dass ein direktes
 * Schreiben auf `full_name` weiterhin trägt, solange keine Teile da sind.
 * Daran hängen 34 Schreibzugriffe in 47 Testdateien — hätte der Trigger sie
 * übergangen, wäre die halbe Suite rot geworden, und zwar an Stellen, die mit
 * Namen nichts zu tun haben.
 *
 * Braucht die Migration 20261026160000_proj94_vorname_nachname.sql.
 */

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let service: SupabaseClient;
const konten: string[] = [];

/** Ein frisches Konto samt Profil — der Trigger legt es an. */
async function konto(metadaten?: Record<string, string>): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email: `proj94-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@viennasalsastudio.test`,
    password: "CorrectPassword123!",
    email_confirm: true,
    ...(metadaten ? { user_metadata: metadaten } : {}),
  });
  if (error || !data.user) throw new Error(`PROJ-94 Konto: ${error?.message}`);
  konten.push(data.user.id);
  return data.user.id;
}

async function profil(id: string) {
  const { data, error } = await service
    .from("profiles")
    .select("first_name, last_name, full_name")
    .eq("id", id)
    .single();
  if (error) throw new Error(`PROJ-94 Profil: ${error.message}`);
  return data;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
}, 60_000);

afterAll(async () => {
  for (const id of konten) {
    await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("PROJ-94: Der zusammengesetzte Name folgt den Teilen", () => {
  it("setzt full_name beim Schreiben der Teile zusammen", async () => {
    const id = await konto();
    await service.from("profiles").update({ first_name: "Anna", last_name: "Müller" }).eq("id", id);
    expect((await profil(id)).full_name).toBe("Anna Müller");
  });

  it("zieht nach, wenn nur der Vorname sich ändert", async () => {
    const id = await konto();
    await service.from("profiles").update({ first_name: "Anna", last_name: "Müller" }).eq("id", id);
    await service.from("profiles").update({ first_name: "Anna Maria" }).eq("id", id);
    expect((await profil(id)).full_name).toBe("Anna Maria Müller");
  });

  it("lässt bei fehlendem Nachnamen kein Leerzeichen zurück", async () => {
    const id = await konto();
    await service.from("profiles").update({ first_name: "Lisa", last_name: null }).eq("id", id);
    expect((await profil(id)).full_name).toBe("Lisa");
  });

  it("räumt Leerzeichen am Rand auf", async () => {
    const id = await konto();
    await service.from("profiles").update({ first_name: "  Anna ", last_name: " Müller " }).eq("id", id);
    expect((await profil(id)).full_name).toBe("Anna Müller");
  });

  // Der Grund, warum es ein Trigger ist und keine abgeleitete Spalte: Die
  // bestehenden Testhelfer schreiben `full_name` direkt, und sie sollen weiter
  // tragen.
  it("nimmt ein direktes full_name an, solange keine Teile da sind", async () => {
    const id = await konto();
    const { error } = await service.from("profiles").update({ full_name: "E2E Testperson" }).eq("id", id);
    expect(error, `Direktes Schreiben wurde abgewiesen: ${error?.message}`).toBeNull();
    expect((await profil(id)).full_name).toBe("E2E Testperson");
  });

  // Umgekehrt: Sind Teile da, gewinnen sie — sonst gäbe es zwei Wahrheiten.
  it("überschreibt ein direktes full_name, wenn Teile vorhanden sind", async () => {
    const id = await konto();
    await service.from("profiles").update({ first_name: "Anna", last_name: "Müller" }).eq("id", id);
    await service.from("profiles").update({ full_name: "Etwas Anderes" }).eq("id", id);
    expect((await profil(id)).full_name).toBe("Anna Müller");
  });
});

describe("PROJ-94: Die Registrierung bringt den Namen mit", () => {
  it("übernimmt Vor- und Nachnamen aus den Metadaten der Anmeldung", async () => {
    const id = await konto({ first_name: "Bea", last_name: "Beispiel" });
    const p = await profil(id);
    expect(p.first_name).toBe("Bea");
    expect(p.last_name).toBe("Beispiel");
    // Und der Trigger hat daraus gleich den ganzen Namen gebildet.
    expect(p.full_name).toBe("Bea Beispiel");
  });

  it("legt ein Profil auch ohne Metadaten an — Konten der Verwaltung", async () => {
    const id = await konto();
    const p = await profil(id);
    expect(p.first_name).toBeNull();
    expect(p.last_name).toBeNull();
    expect(p.full_name).toBeNull();
  });

  it("putzt und begrenzt, was aus den Metadaten kommt", async () => {
    // Die Metadaten kommen vom Client. Geprüft wird serverseitig in `signUp`;
    // hier zählt, dass ein zu langer Wert die Registrierung nicht abbricht,
    // sondern beschnitten wird — sonst scheiterte sie an der CHECK-Bedingung.
    const id = await konto({ first_name: "  Carl  ", last_name: "x".repeat(150) });
    const p = await profil(id);
    expect(p.first_name).toBe("Carl");
    expect(p.last_name).toHaveLength(100);
  });
});
