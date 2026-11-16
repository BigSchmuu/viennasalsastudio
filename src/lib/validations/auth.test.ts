import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  adminProfileSchema,
} from "./auth";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

/**
 * PROJ-101: Ein plausibles Geburtsdatum, das in jedem Lauf gültig bleibt.
 * Ein festes Datum würde irgendwann an der Mindestalter-Grenze scheitern.
 */
const GEBURTSDATUM = "1995-06-15";

/** Der jüngste erlaubte Tag: genau heute vor zehn Jahren. */
function juengsterErlaubterTag(): string {
  const heute = heuteAlsText();
  return `${Number(heute.slice(0, 4)) - 10}${heute.slice(4)}`;
}

function heuteAlsText(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

describe("loginSchema", () => {
  it("accepts a valid email/password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  // Bewusst unveraendert: Bestandskunden mit kuerzerem Passwort muessen sich
  // weiterhin anmelden koennen. Die neue Regel gilt nur fuer *neue* Passwoerter.
  it("nimmt ein kurzes Bestandspasswort beim Anmelden weiterhin an", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "123456" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  // PROJ-94: Der Kern der Änderung — ohne Namen entsteht kein Konto.
  it("verlangt Vor- und Nachnamen", () => {
    const ohne = registerSchema.safeParse({ email: "a@b.com", password: "Passwort1" });
    expect(ohne.success).toBe(false);

    for (const feld of ["first_name", "last_name"] as const) {
      const leer = registerSchema.safeParse({
        email: "a@b.com",
        password: "Passwort1",
        first_name: "Anna",
        last_name: "Müller",
        [feld]: "   ",
      });
      expect(leer.success, `${feld} leer wurde angenommen`).toBe(false);
    }
  });

  it("nimmt Vor- und Nachnamen mit Leerzeichen am Rand und kürzt sie", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      password: "Passwort1",
      first_name: "  Anna ",
      last_name: " Müller  ",
      birthdate: GEBURTSDATUM,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_name).toBe("Anna");
      expect(result.data.last_name).toBe("Müller");
    }
  });

  // Acht Zeichen aus drei Zeichenklassen. Dieselbe Regel muss im
  // Supabase-Dashboard stehen, sonst sagt die App "passt" und der Dienst
  // weist ab -- siehe den Kommentar in auth.ts.
  it("nimmt ein Passwort an, das alle drei Zeichenklassen und 8 Zeichen hat", () => {
    const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password: "Passwort1" });
    expect(result.success).toBe(true);
  });

  it("lehnt sieben Zeichen ab, auch wenn alle Klassen vorkommen", () => {
    const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password: "Passw1r" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Ziffer ab", () => {
    const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password: "Passwortt" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Großbuchstaben ab", () => {
    const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password: "passwort1" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Kleinbuchstaben ab", () => {
    const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password: "PASSWORT1" });
    expect(result.success).toBe(false);
  });

  it("nennt in der Meldung die vollständige Anforderung, nicht nur die Länge", () => {
    // Seit 2026-09-13 liefert das Schema Schlüssel statt deutscher Sätze (das
    // Formular übersetzt sie). Die Absicht bleibt: Jeder Verstoß — Länge,
    // Ziffer, Groß- oder Kleinbuchstabe — führt auf dieselbe vollständige
    // Anforderung, nie auf eine Meldung, die nur die Länge nennt.
    for (const password of ["Passw1r", "Passwortt", "passwort1", "PASSWORT1"]) {
      const result = registerSchema.safeParse({ birthdate: GEBURTSDATUM, email: "a@b.com", first_name: "Anna", last_name: "Müller", password });
      expect(result.success, password).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message, password).toBe("passwordHint");
      }
    }
    // Und der Text hinter dem Schlüssel nennt die Ziffer tatsächlich.
    expect(de.auth.passwordHint).toContain("Ziffer");
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects a missing email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Passwort1",
      confirmPassword: "Passwort1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "123456",
      confirmPassword: "654321",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema (PROJ-73)", () => {
  const gueltig = {
    currentPassword: "Altes2026",
    password: "Neues2026",
    confirmPassword: "Neues2026",
  };

  it("accepts a current password plus a matching new one", () => {
    expect(changePasswordSchema.safeParse(gueltig).success).toBe(true);
  });

  it("rejects a mismatched repetition", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, confirmPassword: "Neues2027" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("valPasswordsDiffer");
  });

  it("holds the new password to the same rule as a reset", () => {
    const result = changePasswordSchema.safeParse({
      ...gueltig,
      password: "kleinbuchstaben",
      confirmPassword: "kleinbuchstaben",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("passwordHint");
  });

  it("rejects an empty current password", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, currentPassword: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("valPasswordRequired");
  });

  // Bestandskunden haben teils kürzere Passwörter als die heutige Regel
  // verlangt. Das *aktuelle* Feld darf sie deshalb nicht prüfen — sonst käme
  // niemand von ihnen je zu einem neuen Passwort.
  it("does not hold the current password to the new rule", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, currentPassword: "kurz" });
    expect(result.success).toBe(true);
  });
});

describe("profileSchema", () => {
  // PROJ-94: Der Name ist Pflicht, alles andere bleibt freiwillig. Deshalb
  // steht er in jedem dieser Fälle dabei.
  const name = { first_name: "Anna", last_name: "Müller", birthdate: GEBURTSDATUM };

  // PROJ-101: Das Geburtsdatum steht nicht mehr in dieser Liste — es ist
  // Pflicht geworden. Telefon und Geschlecht bleiben freiwillig.
  it("nimmt leere freiwillige Felder an", () => {
    const result = profileSchema.safeParse({
      ...name,
      phone: "",
      gender: "",
    });
    expect(result.success).toBe(true);
  });

  // PROJ-94: Sonst wäre die Pflicht bei der Registrierung eine Formalität,
  // die man eine Minute später rückgängig macht.
  it("verlangt Vor- und Nachnamen", () => {
    expect(profileSchema.safeParse({ phone: "", birthdate: GEBURTSDATUM, gender: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...name, first_name: "  " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...name, last_name: "" }).success).toBe(false);
  });

  it("accepts a past birthdate", () => {
    const result = profileSchema.safeParse({ ...name, birthdate: "1990-01-01" });
    expect(result.success).toBe(true);
  });

  // Regression guard: the check used to compare a UTC-parsed date against the
  // current instant, so in a UTC+X timezone today's date counted as future
  // during the first X hours of the day.
  //
  // PROJ-101: Geprüft wird das jetzt am **jüngsten erlaubten** Tag statt an
  // heute — heute ist seit der Mindestalter-Grenze kein gültiges Geburtsdatum
  // mehr. Die Grenze, um die es hier geht, ist dieselbe.
  it("nimmt den jüngsten erlaubten Tag an, unabhängig von der Stunde", () => {
    const result = profileSchema.safeParse({ ...name, birthdate: juengsterErlaubterTag() });
    expect(result.success).toBe(true);
  });

  it("rejects a birthdate in the future", () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = profileSchema.safeParse({ ...name, birthdate: `${futureYear}-01-01` });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PROJ-101: Das Geburtsdatum als Pflichtangabe
// ---------------------------------------------------------------------------

describe("PROJ-101: Geburtsdatum bei der Registrierung", () => {
  const konto = {
    email: "a@b.com",
    password: "Passwort1",
    first_name: "Anna",
    last_name: "Müller",
  };

  it("verlangt es", () => {
    expect(registerSchema.safeParse(konto).success).toBe(false);
    expect(registerSchema.safeParse({ ...konto, birthdate: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...konto, birthdate: "   " }).success).toBe(false);
  });

  it("nimmt ein gültiges Datum an", () => {
    expect(registerSchema.safeParse({ ...konto, birthdate: GEBURTSDATUM }).success).toBe(true);
    expect(registerSchema.safeParse({ ...konto, birthdate: juengsterErlaubterTag() }).success).toBe(true);
  });

  it("weist ab, was kein Datum ist", () => {
    for (const krumm of ["15.06.1995", "1995-6-15", "1995", "gestern"]) {
      expect(
        registerSchema.safeParse({ ...konto, birthdate: krumm }).success,
        `${krumm} wurde angenommen`
      ).toBe(false);
    }
  });

  it("weist Zukunft und Unsinn ab", () => {
    const naechstesJahr = new Date().getFullYear() + 1;
    expect(registerSchema.safeParse({ ...konto, birthdate: `${naechstesJahr}-01-01` }).success).toBe(false);
    // Zu alt für einen Menschen …
    expect(registerSchema.safeParse({ ...konto, birthdate: "1899-12-31" }).success).toBe(false);
    // … und zu jung für einen Tanzkurs: heute ist kein Geburtsdatum.
    expect(registerSchema.safeParse({ ...konto, birthdate: heuteAlsText() }).success).toBe(false);
  });

  it("nennt den Schlüssel auch, wenn gar nichts ankommt", () => {
    // Die Formulare haben neben `onSubmit` eine `action`; dann kommt die
    // FormData aus dem DOM, und ein fehlendes Feld ist `null`, nicht "".
    // Zod meldete dafür „Invalid input: expected string, received null" — eine
    // technische Zeile in einer Sprache, die der Kunde nicht gewählt hat.
    for (const nichts of [null, undefined]) {
      const result = registerSchema.safeParse({ ...konto, birthdate: nichts });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("valBirthdateRequired");
      }
    }
  });

  it("nennt den Grund als Schlüssel, den beide Sprachen kennen", () => {
    const fehlt = registerSchema.safeParse({ ...konto, birthdate: "" });
    expect(fehlt.success).toBe(false);
    if (!fehlt.success) {
      const schluessel = fehlt.error.issues[0]?.message ?? "";
      expect(schluessel).toBe("valBirthdateRequired");
      // Ohne Übersetzung stünde der Schlüssel selbst unter dem Feld.
      expect(de.auth).toHaveProperty(schluessel);
      expect(en.auth).toHaveProperty(schluessel);
    }
  });

  it("hat für jede Meldung beide Sprachen", () => {
    for (const schluessel of [
      "valBirthdateRequired",
      "valBirthdateInvalid",
      "valBirthdateFuture",
      "valBirthdateImplausible",
    ]) {
      expect(de.auth, `de fehlt ${schluessel}`).toHaveProperty(schluessel);
      expect(en.auth, `en fehlt ${schluessel}`).toHaveProperty(schluessel);
    }
  });
});

describe("PROJ-101: In der Verwaltung bleibt es freiwillig", () => {
  // An der Tür kennt man ein Geburtsdatum manchmal nicht. Eine Sperre würde
  // dort den Betreiber aufhalten, nicht die Daten verbessern.
  const kunde = { first_name: "Anna", last_name: "Müller" };

  it("nimmt einen Kunden ohne Geburtsdatum an", () => {
    expect(adminProfileSchema.safeParse({ ...kunde, birthdate: "" }).success).toBe(true);
    expect(adminProfileSchema.safeParse(kunde).success).toBe(true);
  });

  it("prüft aber, was dasteht", () => {
    const naechstesJahr = new Date().getFullYear() + 1;
    expect(adminProfileSchema.safeParse({ ...kunde, birthdate: `${naechstesJahr}-01-01` }).success).toBe(false);
    expect(adminProfileSchema.safeParse({ ...kunde, birthdate: "1899-12-31" }).success).toBe(false);
    expect(adminProfileSchema.safeParse({ ...kunde, birthdate: GEBURTSDATUM }).success).toBe(true);
  });

  it("antwortet dort mit ganzen Sätzen, nicht mit Schlüsseln", () => {
    // Der Verwaltungsbereich ist einsprachig deutsch und übersetzt nichts.
    const naechstesJahr = new Date().getFullYear() + 1;
    const result = adminProfileSchema.safeParse({ ...kunde, birthdate: `${naechstesJahr}-01-01` });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Zukunft");
    }
  });
});
