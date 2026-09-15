import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BILDER_BUCKET, MAX_BILD_BYTES } from "@/lib/events/medien";

/**
 * PROJ-55: Regeln, die die Datenbank und der Bildspeicher selbst durchsetzen.
 *
 * Die Verwaltung prüft dasselbe, aber ein Aufruf an ihr vorbei darf es nicht
 * umgehen — beim Hochladen gilt das besonders: Die Prüfung im Browser ist
 * bequem, aber umgehbar.
 *
 * Braucht die Migration 20260915180000_proj55_event_bilder_videos.sql in der
 * Testdatenbank.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const KUNDE_MAIL = "proj55-medien-kunde@viennasalsastudio.test";
const ADMIN_MAIL = "proj55-medien-admin@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";
const ART_NAME = "E2E PROJ-55 Art";

let service: SupabaseClient;
let kunde: string;
let admin: string;
let artId: string;
let eventId: string;
let serieId: string;
const hochgeladen: string[] = [];

/**
 * Ein winziges „Bild" — für die Rechteprüfung zählt der Typ, nicht der Inhalt.
 *
 * Als Rohdaten, nicht als `Blob` oder `File`: Der Speicher-Client packt jedes
 * Blob in ein Formular ohne Dateinamen, und in Node geht der Typ dabei
 * verloren — beim Server kommt `text/plain` an. Rohdaten schickt er dagegen
 * mit dem Typ, der danebensteht.
 */
function bilddaten(): Uint8Array {
  return new Uint8Array([1, 2, 3]);
}

function morgen(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function tag(versatzTage: number): string {
  return new Date(Date.now() + versatzTage * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Ein Bild anlegen; ohne Angaben ein Galeriebild am Event. Wirft den Datenbankfehler weiter. */
async function bildAnlegen(felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("event_images")
    .insert({
      event_id: eventId,
      role: "gallery",
      storage_path: `events/${eventId}/${crypto.randomUUID()}.webp`,
      width: 1600,
      height: 900,
      position: 0,
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function videoAnlegen(felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("event_videos")
    .insert({ event_id: eventId, youtube_id: "dQw4w9WgXcQ", position: 0, ...felder })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function angemeldet(mail: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: mail, password: PASSWORT });
  if (error) throw error;
  return c;
}

async function nutzerAnlegen(mail: string, rolle?: string): Promise<string> {
  const { data: vorhanden } = await service.auth.admin.listUsers({ perPage: 300 });
  const alt = vorhanden.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error) throw error;

  if (rolle) {
    const { error: rollenFehler } = await service.from("profiles").update({ role: rolle }).eq("id", data.user.id);
    if (rollenFehler) throw rollenFehler;
  }
  return data.user.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  kunde = await nutzerAnlegen(KUNDE_MAIL);
  admin = await nutzerAnlegen(ADMIN_MAIL, "admin");

  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_series").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }

  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: ART_NAME })
    .select("id")
    .single();
  if (artFehler) throw artFehler;
  artId = art.id;

  const { data: event, error: eventFehler } = await service
    .from("events")
    .insert({
      name: "E2E PROJ-55 Event",
      slug: `e2e-proj55-event-${Date.now()}`,
      event_type_id: artId,
      sales_mode: "display",
      starts_at: morgen(),
      capacity: null,
      price_normal: null,
      price_student: null,
    })
    .select("id")
    .single();
  if (eventFehler) throw eventFehler;
  eventId = event.id;

  const { data: serie, error: serienFehler } = await service
    .from("event_series")
    .insert({
      name: "E2E PROJ-55 Serie",
      slug: `e2e-proj55-serie-${Date.now()}`,
      event_type_id: artId,
      sales_mode: "display",
      weekday: 4,
      start_time: "21:00",
      starts_on: tag(1),
      pause_in_holidays: false,
    })
    .select("id")
    .single();
  if (serienFehler) throw serienFehler;
  serieId = serie.id;
}, 60000);

afterAll(async () => {
  if (hochgeladen.length > 0) await service.storage.from(BILDER_BUCKET).remove(hochgeladen);
  await service.from("events").delete().eq("event_type_id", artId);
  await service.from("event_series").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
  for (const id of [kunde, admin]) if (id) await service.auth.admin.deleteUser(id);
});

describe("Regeln der Tabelle event_images (PROJ-55)", () => {
  it("verlangt genau ein Ziel — Event oder Serie", async () => {
    await expect(bildAnlegen({ series_id: serieId })).rejects.toMatchObject({ code: "23514" });
    await expect(bildAnlegen({ event_id: null })).rejects.toMatchObject({ code: "23514" });
  });

  it("nimmt nur die beiden Rollen an", async () => {
    await expect(bildAnlegen({ role: "titel" })).rejects.toMatchObject({ code: "23514" });
  });

  it("lässt je Event nur ein Titelbild zu", async () => {
    await bildAnlegen({ role: "cover" });
    await expect(bildAnlegen({ role: "cover" })).rejects.toMatchObject({ code: "23505" });
  });

  it("lässt je Serie nur ein Titelbild zu", async () => {
    await bildAnlegen({ event_id: null, series_id: serieId, role: "cover" });
    await expect(bildAnlegen({ event_id: null, series_id: serieId, role: "cover" })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("erlaubt ein Titelbild am Event und eines an der Serie nebeneinander", async () => {
    // Beide Sperren gelten je Ziel — nicht übergreifend.
    const { data } = await service.from("event_images").select("id, role").eq("role", "cover");
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("verlangt sinnvolle Maße", async () => {
    await expect(bildAnlegen({ width: 0 })).rejects.toMatchObject({ code: "23514" });
    await expect(bildAnlegen({ height: -1 })).rejects.toMatchObject({ code: "23514" });
  });

  it("lässt denselben Ablageort kein zweites Mal zu", async () => {
    const pfad = `events/${eventId}/doppelt-${Date.now()}.webp`;
    await bildAnlegen({ storage_path: pfad });
    await expect(bildAnlegen({ storage_path: pfad })).rejects.toMatchObject({ code: "23505" });
  });

  it("begrenzt die Bildbeschreibung", async () => {
    await expect(bildAnlegen({ alt_text: "x".repeat(301) })).rejects.toMatchObject({ code: "23514" });
    await expect(bildAnlegen({ alt_text: "x".repeat(300) })).resolves.toBeTruthy();
  });
});

describe("Regeln der Tabelle event_videos (PROJ-55)", () => {
  it("nimmt nur eine YouTube-Kennung an, keinen ganzen Link", async () => {
    // Gespeichert wird die Kennung; ein Link brächte Parameter mit, die beim
    // Einbetten nur stören.
    await expect(videoAnlegen({ youtube_id: "https://youtu.be/dQw4w9WgXcQ" })).rejects.toMatchObject({
      code: "23514",
    });
    await expect(videoAnlegen({ youtube_id: "dQw4w9WgXcQ" })).resolves.toBeTruthy();
  });

  it("verlangt genau ein Ziel", async () => {
    await expect(videoAnlegen({ series_id: serieId })).rejects.toMatchObject({ code: "23514" });
    await expect(videoAnlegen({ event_id: null })).rejects.toMatchObject({ code: "23514" });
  });
});

describe("Löschen räumt mit auf (PROJ-55)", () => {
  it("nimmt Bilder und Videos mit, wenn das Event verschwindet", async () => {
    const { data: event } = await service
      .from("events")
      .insert({
        name: "E2E PROJ-55 Wegwerf-Event",
        slug: `e2e-proj55-wegwerf-${Date.now()}`,
        event_type_id: artId,
        sales_mode: "display",
        starts_at: morgen(),
        capacity: null,
        price_normal: null,
        price_student: null,
      })
      .select("id")
      .single();

    const { data: bild } = await service
      .from("event_images")
      .insert({
        event_id: event!.id,
        role: "cover",
        storage_path: `events/${event!.id}/${crypto.randomUUID()}.webp`,
        width: 100,
        height: 100,
      })
      .select("id")
      .single();
    const { data: video } = await service
      .from("event_videos")
      .insert({ event_id: event!.id, youtube_id: "dQw4w9WgXcQ" })
      .select("id")
      .single();

    await service.from("events").delete().eq("id", event!.id);

    const { data: bildDanach } = await service.from("event_images").select("id").eq("id", bild!.id).maybeSingle();
    const { data: videoDanach } = await service.from("event_videos").select("id").eq("id", video!.id).maybeSingle();
    expect(bildDanach).toBeNull();
    expect(videoDanach).toBeNull();
  });
});

describe("Zugriff auf Bilder und Videos (PROJ-55)", () => {
  it("lässt Besucher ohne Konto Bilder und Videos lesen", async () => {
    const bildId = await bildAnlegen();
    const videoId = await videoAnlegen();

    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: bilder } = await anon.from("event_images").select("id").eq("id", bildId);
    const { data: videos } = await anon.from("event_videos").select("id").eq("id", videoId);
    expect(bilder).toEqual([{ id: bildId }]);
    expect(videos).toEqual([{ id: videoId }]);
  });

  it("lässt Kunden kein Bild und kein Video eintragen", async () => {
    const c = await angemeldet(KUNDE_MAIL);
    const bild = await c.from("event_images").insert({
      event_id: eventId,
      role: "gallery",
      storage_path: `events/${eventId}/verboten-${Date.now()}.webp`,
      width: 10,
      height: 10,
    });
    const video = await c.from("event_videos").insert({ event_id: eventId, youtube_id: "dQw4w9WgXcQ" });
    expect(bild.error).not.toBeNull();
    expect(video.error).not.toBeNull();
  });

  it("lässt Kunden kein Bild löschen", async () => {
    const bildId = await bildAnlegen();
    const c = await angemeldet(KUNDE_MAIL);
    await c.from("event_images").delete().eq("id", bildId);

    // Ohne Regel liefe das Löschen stumm ins Leere — deshalb wird nachgesehen.
    const { data } = await service.from("event_images").select("id").eq("id", bildId).maybeSingle();
    expect(data).toMatchObject({ id: bildId });
  });
});

describe("Der Bildspeicher (PROJ-55)", () => {
  it("ist öffentlich lesbar und begrenzt Größe und Format", async () => {
    const { data, error } = await service.storage.getBucket(BILDER_BUCKET);
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
    expect(data?.file_size_limit).toBe(MAX_BILD_BYTES);
    expect(data?.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("nimmt ein Bild vom Admin an", async () => {
    const c = await angemeldet(ADMIN_MAIL);
    const pfad = `events/${eventId}/admin-${Date.now()}.webp`;
    const { error } = await c.storage
      .from(BILDER_BUCKET)
      .upload(pfad, bilddaten(), { contentType: "image/webp" });
    expect(error).toBeNull();
    hochgeladen.push(pfad);
  });

  it("nimmt vom Admin nichts an, was kein Bild ist", async () => {
    // Die verlässliche Schranke sitzt hier, nicht im Browser.
    const c = await angemeldet(ADMIN_MAIL);
    const pfad = `events/${eventId}/kein-bild-${Date.now()}.pdf`;
    const { error } = await c.storage
      .from(BILDER_BUCKET)
      .upload(pfad, bilddaten(), { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("lässt einen Kunden nichts hochladen", async () => {
    const c = await angemeldet(KUNDE_MAIL);
    const pfad = `events/${eventId}/kunde-${Date.now()}.webp`;
    const { error } = await c.storage
      .from(BILDER_BUCKET)
      .upload(pfad, bilddaten(), { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("lässt einen Kunden kein fremdes Bild löschen", async () => {
    const adminClient = await angemeldet(ADMIN_MAIL);
    const pfad = `events/${eventId}/geschuetzt-${Date.now()}.webp`;
    const { error: uploadFehler } = await adminClient
      .storage.from(BILDER_BUCKET)
      .upload(pfad, bilddaten(), { contentType: "image/webp" });
    expect(uploadFehler).toBeNull();
    hochgeladen.push(pfad);

    const kundeClient = await angemeldet(KUNDE_MAIL);
    await kundeClient.storage.from(BILDER_BUCKET).remove([pfad]);

    // Der Speicher meldet ein Löschen ohne Recht nicht als Fehler — deshalb
    // wird nachgesehen, ob die Datei noch da ist.
    const { data } = await service.storage.from(BILDER_BUCKET).list(`events/${eventId}`, { search: pfad.split("/").pop() });
    expect((data ?? []).length).toBe(1);
  });
});
